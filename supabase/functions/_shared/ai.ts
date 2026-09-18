/**
 * Capa de IA intercambiable.
 *
 * MindTask no depende de un proveedor: el modelo se elige con variables de
 * entorno, así que cualquiera que clone el proyecto puede apuntarlo a su propia
 * cuenta o a un modelo local sin tocar el código.
 *
 *   AI_PROVIDER   ollama | openai | anthropic | lovable | custom   (default: ninguno)
 *   AI_BASE_URL   sobrescribe la URL del proveedor (obligatoria en "custom")
 *   AI_API_KEY    la llave del proveedor (Ollama local no la necesita)
 *   AI_MODEL      el modelo de texto
 *   AI_STT_MODEL  el modelo de transcripción, si el proveedor la soporta
 *
 * Nota sobre modelos locales: estas funciones corren en los servidores de
 * Supabase, así que no alcanzan un "localhost" de tu máquina. Para usar Ollama
 * hay que correr el proyecto en local (`supabase functions serve`) o exponer el
 * servidor con un túnel y poner esa URL en AI_BASE_URL.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type Provider = "ollama" | "openai" | "anthropic" | "lovable" | "custom";

/** Valores por defecto de cada proveedor, para que baste con AI_PROVIDER + AI_API_KEY. */
const DEFAULTS: Record<Provider, { baseUrl: string; model: string; sttModel: string; needsKey: boolean }> = {
  ollama: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
    sttModel: "", // Ollama no transcribe audio
    needsKey: false,
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    sttModel: "whisper-1",
    needsKey: true,
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-opus-5",
    sttModel: "", // Anthropic no transcribe audio
    needsKey: true,
  },
  lovable: {
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    model: "google/gemini-2.5-flash",
    sttModel: "whisper-1",
    needsKey: true,
  },
  custom: {
    baseUrl: "",
    model: "",
    sttModel: "",
    needsKey: false,
  },
};

/** Error con código de estado, para responderle al frontend algo entendible. */
export class AIError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

export type AIConfig = {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  sttModel: string;
};

/**
 * Lee la configuración del entorno. Devuelve null cuando no hay IA configurada,
 * para que la app pueda seguir funcionando sin sus funciones de IA en vez de
 * tronar.
 */
export function readConfig(): AIConfig | null {
  const raw = (Deno.env.get("AI_PROVIDER") ?? "").trim().toLowerCase();

  // Compatibilidad: los proyectos creados en Lovable solo traen LOVABLE_API_KEY
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!raw && lovableKey) {
    return {
      provider: "lovable",
      baseUrl: DEFAULTS.lovable.baseUrl,
      apiKey: lovableKey,
      model: Deno.env.get("AI_MODEL") ?? DEFAULTS.lovable.model,
      sttModel: Deno.env.get("AI_STT_MODEL") ?? DEFAULTS.lovable.sttModel,
    };
  }

  if (!raw) return null;
  if (!(raw in DEFAULTS)) {
    throw new AIError(`AI_PROVIDER no reconocido: "${raw}". Usa ollama, openai, anthropic, lovable o custom.`, 500);
  }

  const provider = raw as Provider;
  const d = DEFAULTS[provider];
  const baseUrl = (Deno.env.get("AI_BASE_URL") ?? d.baseUrl).replace(/\/+$/, "");
  const apiKey = Deno.env.get("AI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY") ?? "";

  if (!baseUrl) throw new AIError("Falta AI_BASE_URL para el proveedor custom.", 500);
  if (d.needsKey && !apiKey) throw new AIError(`Falta AI_API_KEY para el proveedor ${provider}.`, 500);

  return {
    provider,
    baseUrl,
    apiKey,
    model: Deno.env.get("AI_MODEL") ?? d.model,
    sttModel: Deno.env.get("AI_STT_MODEL") ?? d.sttModel,
  };
}

/** Respuesta estándar cuando no hay IA configurada. */
export function notConfigured(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({
      error: "La función de IA no está configurada en este despliegue.",
      hint: "Configura AI_PROVIDER, AI_API_KEY y AI_MODEL en los secretos de Supabase. Puedes usar tu propia llave de OpenAI o Anthropic, o un modelo local con Ollama.",
      code: "ai_not_configured",
    }),
    { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Genera texto. Anthropic usa su propio formato; el resto habla el de OpenAI. */
export async function chat(cfg: AIConfig, messages: ChatMessage[], maxTokens = 1024): Promise<string> {
  if (cfg.provider === "anthropic") return chatAnthropic(cfg, messages, maxTokens);
  return chatOpenAICompatible(cfg, messages, maxTokens);
}

async function chatOpenAICompatible(cfg: AIConfig, messages: ChatMessage[], maxTokens: number): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) throw new AIError(`El proveedor ${cfg.provider} respondió ${res.status}: ${await res.text()}`, 502);

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new AIError(`Respuesta inesperada del proveedor ${cfg.provider}.`, 502);
  return text;
}

async function chatAnthropic(cfg: AIConfig, messages: ChatMessage[], maxTokens: number): Promise<string> {
  // Anthropic separa el system del resto de la conversación.
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");

  const res = await fetch(`${cfg.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: rest.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) throw new AIError(`Anthropic respondió ${res.status}: ${await res.text()}`, 502);

  const data = await res.json();
  if (data?.stop_reason === "refusal") throw new AIError("El modelo declinó responder a esta petición.", 502);

  const text = (data?.content ?? [])
    .filter((b: { type?: string }) => b?.type === "text")
    .map((b: { text?: string }) => b.text ?? "")
    .join("");
  if (!text) throw new AIError("Respuesta vacía de Anthropic.", 502);
  return text;
}

/** Transcribe audio. Solo con proveedores que exponen /audio/transcriptions. */
export async function transcribe(cfg: AIConfig, audio: Blob, filename = "audio.webm"): Promise<string> {
  if (!cfg.sttModel) {
    throw new AIError(
      `El proveedor ${cfg.provider} no transcribe audio. Configura AI_STT_MODEL con un proveedor que sí lo haga (por ejemplo OpenAI con whisper-1).`,
      501,
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", cfg.sttModel);

  const headers: Record<string, string> = {};
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, { method: "POST", headers, body: form });
  if (!res.ok) throw new AIError(`La transcripción falló (${res.status}): ${await res.text()}`, 502);

  const data = await res.json();
  if (typeof data?.text !== "string") throw new AIError("Respuesta inesperada del servicio de transcripción.", 502);
  return data.text;
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
