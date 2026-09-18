/**
 * Límite de uso por usuario de las funciones de IA (20 llamadas por hora por
 * función). El conteo vive en la tabla ai_rate_limits y lo lleva la función de
 * Postgres consume_ai_quota(), que corre con el JWT del propio usuario.
 */

export type AIFunction = "ai-task-suggestions" | "voice-to-text";

/**
 * Id del usuario que hace la petición. El JWT ya lo validó el gateway de
 * Supabase (verify_jwt = true en config.toml), así que aquí solo se lee.
 */
export function userIdFromRequest(req: Request): string | null {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const sub = JSON.parse(atob(payload)).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

/**
 * Consume un lugar del límite. Devuelve null si la llamada puede seguir, o la
 * respuesta 429 que hay que regresarle al usuario.
 */
export async function checkQuota(
  req: Request,
  fn: AIFunction,
  headers: Record<string, string>,
): Promise<Response | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const auth = req.headers.get("Authorization");
  if (!url || !anonKey) throw new Error("Faltan SUPABASE_URL o SUPABASE_ANON_KEY en el entorno de la función.");
  if (!auth) {
    return json({ error: "Necesitas iniciar sesión para usar la IA.", code: "unauthenticated" }, 401, headers);
  }

  const res = await fetch(`${url}/rest/v1/rpc/consume_ai_quota`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: auth },
    body: JSON.stringify({ p_function: fn }),
  });
  if (!res.ok) throw new Error(`consume_ai_quota respondió ${res.status}: ${await res.text()}`);

  const [fila] = await res.json();
  if (fila?.allowed) return null;

  const segundos = Number(fila?.retry_after_seconds) || 3600;
  const minutos = Math.ceil(segundos / 60);
  return json(
    {
      error: `Llegaste al límite de ${fila?.used ?? 20} usos por hora de esta función. Podrás usarla de nuevo en ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`,
      code: "rate_limited",
      retryAfterSeconds: segundos,
    },
    429,
    { ...headers, "Retry-After": String(segundos) },
  );
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}
