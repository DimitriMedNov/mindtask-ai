-- Registro de cada llamada al modelo: quién, con qué proveedor y modelo, cuántos
-- tokens (cuando el proveedor los reporta) y cuánto tardó. Sirve para medir
-- desempeño y costo reales en vez de adivinarlos.

CREATE TABLE public.ai_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chat', 'transcription')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  duration_ms INTEGER NOT NULL,
  -- Estado HTTP que vio el usuario por esta llamada: 200, 502, 504...
  status INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ai_usage_user_time_idx ON public.ai_usage (user_id, created_at DESC);
CREATE INDEX ai_usage_time_idx ON public.ai_usage (created_at DESC);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Las Edge Functions escriben con la service role, que no pasa por RLS. Los
-- usuarios solo leen; sin política de INSERT nadie puede inflar o maquillar las
-- cifras desde el navegador.
CREATE POLICY "Users can view their own AI usage"
ON public.ai_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all AI usage"
ON public.ai_usage
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
