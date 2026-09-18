-- Límite de uso de las funciones de IA: máximo N llamadas por usuario por hora.
--
-- Cada llamada permitida deja un registro aquí. Las Edge Functions no insertan
-- directo: llaman a consume_ai_quota(), que cuenta y registra en la misma
-- transacción, con un candado por usuario para que dos peticiones simultáneas
-- no se cuelen las dos cuando solo queda un lugar.

CREATE TABLE public.ai_rate_limits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ai_rate_limits_user_fn_time_idx
  ON public.ai_rate_limits (user_id, function_name, created_at DESC);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Cada quien puede ver su propio consumo. No hay políticas de INSERT, UPDATE ni
-- DELETE: nadie puede borrar su historial para saltarse el límite; solo
-- consume_ai_quota() escribe, y lo hace como SECURITY DEFINER.
CREATE POLICY "Users can view their own AI usage count"
ON public.ai_rate_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- El límite y la ventana viven aquí y no como parámetros: cualquier usuario
-- autenticado puede llamar esta función por RPC, y si pudiera mandar su propia
-- ventana podría borrar su historial y saltarse el límite.
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_function TEXT)
RETURNS TABLE (allowed BOOLEAN, used INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_limit CONSTANT INTEGER := 20;
  p_window CONSTANT INTERVAL := interval '1 hour';
  v_user UUID := auth.uid();
  v_used INTEGER;
  v_oldest TIMESTAMP WITH TIME ZONE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'consume_ai_quota requiere un usuario autenticado';
  END IF;
  IF p_function NOT IN ('ai-task-suggestions', 'voice-to-text') THEN
    RAISE EXCEPTION 'Función desconocida: %', p_function;
  END IF;

  -- Serializa las peticiones del mismo usuario a la misma función
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || ':' || p_function));

  SELECT count(*), min(created_at)
    INTO v_used, v_oldest
    FROM public.ai_rate_limits
   WHERE user_id = v_user
     AND function_name = p_function
     AND created_at > now() - p_window;

  IF v_used >= p_limit THEN
    -- Se libera un lugar cuando la llamada más vieja de la ventana sale de ella
    RETURN QUERY SELECT
      false,
      v_used,
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_oldest + p_window - now()))))::INTEGER;
    RETURN;
  END IF;

  INSERT INTO public.ai_rate_limits (user_id, function_name) VALUES (v_user, p_function);

  -- Limpieza: lo que ya salió de la ventana no sirve para nada
  DELETE FROM public.ai_rate_limits
   WHERE user_id = v_user
     AND function_name = p_function
     AND created_at < now() - p_window;

  RETURN QUERY SELECT true, v_used + 1, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(TEXT) TO authenticated;
