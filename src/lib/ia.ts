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
 *   AI_STT_BASE_URL / AI_STT_API_KEY  opcionales: mandan la transcripción a otro
 *                 servidor mientras el texto sigue en el proveedor principal
 *   AI_STT_FORMAT  "openai" (por defecto) o "whisper-cpp". whisper.cpp expone
 *                 /inference en vez de la ruta de OpenAI, así que necesita su
 *                 propio trato aunque el resto sea igual
 *
 * Modelos locales: esta capa corre en la máquina del usuario, así que alcanza
 * sin problema un servidor en localhost. Ollama necesita permitir el origen de
 * la app (OLLAMA_ORIGINS), porque el navegador aplica sus reglas de origen.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * De dónde sale la configuración.
 *
 * Antes esto vivía en una Edge Function y leía Deno.env. Ahora corre en la app,
 * así que lee las variables de Vite —las que empiezan con VITE_— y, en las
 * pruebas, las del proceso. Un solo lugar para que el resto del archivo no
 * sepa dónde está corriendo.
 */
export function leerVariable(nombre: string): string | undefined {
  // El proceso manda sobre Vite: en el navegador no existe, y en las pruebas
  // así cada caso pone su propia configuración sin que se cuele el .env real.
  const proceso = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const delProceso = proceso?.env?.[`VITE_${nombre}`] ?? proceso?.env?.[nombre];
  if (delProceso) return delProceso;

  const deVite = (import.meta as { env?: Record<string, string | undefined> }).env;
  return deVite?.[`VITE_${nombre}`] ?? deVite?.[nombre];
}

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
  /** Adónde va la transcripción; por defecto, el mismo servidor que el texto. */
  sttBaseUrl: string;
  sttApiKey: string;
  /** Qué ruta y qué respuesta espera el transcriptor. */
  sttFormat: "openai" | "whisper-cpp";
};

/** Aplica AI_STT_BASE_URL y AI_STT_API_KEY sobre la configuración ya elegida. */
// sttFormat también sale de aquí, así que quien llama no tiene que pasarlo.
function conSTT(cfg: Omit<AIConfig, "sttBaseUrl" | "sttApiKey" | "sttFormat">): AIConfig {
  return {
    ...cfg,
    sttBaseUrl: (leerVariable("AI_STT_BASE_URL") ?? cfg.baseUrl).replace(/\/+$/, ""),
    sttApiKey: leerVariable("AI_STT_API_KEY") ?? cfg.apiKey,
    sttFormat: (leerVariable("AI_STT_FORMAT") ?? "openai").trim().toLowerCase() === "whisper-cpp"
      ? "whisper-cpp"
      : "openai",
  };
}

/**
 * Lee la configuración del entorno. Devuelve null cuando no hay IA configurada,
 * para que la app pueda seguir funcionando sin sus funciones de IA en vez de
 * tronar.
 */
export function readConfig(): AIConfig | null {
  const raw = (leerVariable("AI_PROVIDER") ?? "").trim().toLowerCase();

  // Compatibilidad: los proyectos creados en Lovable solo traen LOVABLE_API_KEY
  const lovableKey = leerVariable("LOVABLE_API_KEY");
  if (!raw && lovableKey) {
    return conSTT({
      provider: "lovable",
      baseUrl: DEFAULTS.lovable.baseUrl,
      apiKey: lovableKey,
      model: leerVariable("AI_MODEL") ?? DEFAULTS.lovable.model,
      sttModel: leerVariable("AI_STT_MODEL") ?? DEFAULTS.lovable.sttModel,
    });
  }

  if (!raw) return null;
  if (!(raw in DEFAULTS)) {
    throw new AIError(`AI_PROVIDER no reconocido: "${raw}". Usa ollama, openai, anthropic, lovable o custom.`, 500);
  }

  const provider = raw as Provider;
  const d = DEFAULTS[provider];
  const baseUrl = (leerVariable("AI_BASE_URL") ?? d.baseUrl).replace(/\/+$/, "");
  const apiKey = leerVariable("AI_API_KEY") ?? leerVariable("LOVABLE_API_KEY") ?? "";

  if (!baseUrl) throw new AIError("Falta AI_BASE_URL para el proveedor custom.", 500);
  if (d.needsKey && !apiKey) throw new AIError(`Falta AI_API_KEY para el proveedor ${provider}.`, 500);

  return conSTT({
    provider,
    baseUrl,
    apiKey,
    model: leerVariable("AI_MODEL") ?? d.model,
    sttModel: leerVariable("AI_STT_MODEL") ?? d.sttModel,
  });
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

// ---------------------------------------------------------------------------
// Llamadas al modelo: tiempo límite, reintentos y registro de uso
// ---------------------------------------------------------------------------

/** Tiempo máximo de una llamada al modelo, reintentos y esperas incluidos. */
export const TIMEOUT_MS = 30_000;
/** Reintentos después del primer intento, solo ante 429 o 5xx del proveedor. */
export const MAX_RETRIES = 2;
/** Espera antes del primer reintento; se duplica en cada uno (1 s, 2 s). */
export const BACKOFF_MS = 1_000;

export const TIMEOUT_MESSAGE = "El modelo tardó demasiado en responder";

/** Lo que se registra de cada llamada; ver la tabla ai_usage. */
export type Usage = {
  kind: "chat" | "transcription";
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  durationMs: number;
  /** Estado que termina viendo el usuario: 200 si salió bien, o el del AIError. */
  status: number;
  attempts: number;
};

export type CallOptions = {
  maxTokens?: number;
  timeoutMs?: number;
  /** Se llama una vez por llamada, salga bien o mal. Un error aquí nunca rompe la respuesta. */
  onUsage?: (usage: Usage) => void | Promise<void>;
  /** Solo para pruebas: sustituye la espera entre reintentos. */
  sleep?: (ms: number) => Promise<void>;
};

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 429 y 5xx son fallas pasajeras del proveedor; un 400 no se arregla reintentando. */
export function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Retry-After en segundos, si el proveedor lo manda. */
function retryAfterMs(res: Response): number | null {
  const valor = Number(res.headers.get("retry-after"));
  return Number.isFinite(valor) && valor > 0 ? valor * 1000 : null;
}

type Parsed = { value: string; inputTokens: number | null; outputTokens: number | null };

/**
 * Hace la petición con un AbortController de `timeoutMs` que cubre todos los
 * intentos, las esperas y la lectura del cuerpo. Reintenta con espera
 * progresiva solo ante 429 o 5xx. Registra el uso al final, pase lo que pase.
 */
async function callModel(
  cfg: AIConfig,
  kind: Usage["kind"],
  model: string,
  url: string,
  init: RequestInit,
  parse: (data: unknown) => Parsed,
  opts: CallOptions,
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? TIMEOUT_MS;
  const sleep = opts.sleep ?? esperar;
  const inicio = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let attempts = 0;
  let status = 200;
  let tokens: { input: number | null; output: number | null } = { input: null, output: null };

  // Una espera que también se corta si se acaba el tiempo
  const pausa = (ms: number) =>
    Promise.race([
      sleep(ms),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new DOMException("timeout", "AbortError")), { once: true })
      ),
    ]);

  try {
    while (true) {
      attempts++;
      let res: Response;
      try {
        res = await fetch(url, { ...init, signal: controller.signal });
      } catch (err) {
        if (controller.signal.aborted) throw err;
        throw new AIError(`No se pudo conectar con el proveedor ${cfg.provider}: ${(err as Error).message}`, 502);
      }

      if (res.ok) {
        const parsed = parse(await res.json());
        tokens = { input: parsed.inputTokens, output: parsed.outputTokens };
        return parsed.value;
      }

      const cuerpo = await res.text();
      if (isRetryable(res.status) && attempts <= MAX_RETRIES) {
        const espera = retryAfterMs(res) ?? BACKOFF_MS * 2 ** (attempts - 1);
        // Si la espera no cabe en el tiempo que queda, no tiene caso reintentar
        if (Date.now() - inicio + espera < timeoutMs) {
          await pausa(espera);
          continue;
        }
      }
      // Quién falló importa: el transcriptor puede ser otro servicio distinto
      // del que genera el texto, y culpar al equivocado manda a revisar donde no es.
      const quien = kind === "transcription"
        ? `El servicio de transcripción (${cfg.sttFormat === "whisper-cpp" ? "whisper.cpp" : cfg.provider})`
        : `El proveedor ${cfg.provider}`;
      throw new AIError(`${quien} respondió ${res.status}: ${cuerpo.slice(0, 500)}`, 502);
    }
  } catch (err) {
    if (err instanceof AIError) {
      status = err.status;
      throw err;
    }
    if (controller.signal.aborted) {
      status = 504;
      throw new AIError(TIMEOUT_MESSAGE, 504);
    }
    status = 500;
    throw err;
  } finally {
    clearTimeout(timer);
    if (opts.onUsage) {
      try {
        await opts.onUsage({
          kind,
          provider: cfg.provider,
          model,
          inputTokens: tokens.input,
          outputTokens: tokens.output,
          durationMs: Date.now() - inicio,
          status,
          attempts,
        });
      } catch (err) {
        console.error("No se pudo registrar el uso de IA:", err);
      }
    }
  }
}

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Genera texto. Anthropic usa su propio formato; el resto habla el de OpenAI. */
export function chat(cfg: AIConfig, messages: ChatMessage[], opts: CallOptions = {}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 1024;
  return cfg.provider === "anthropic"
    ? chatAnthropic(cfg, messages, maxTokens, opts)
    : chatOpenAICompatible(cfg, messages, maxTokens, opts);
}

/** Arma la petición en formato OpenAI. Exportada para poder probarla. */
export function buildOpenAIRequest(cfg: AIConfig, messages: ChatMessage[], maxTokens: number) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  return {
    url: `${cfg.baseUrl}/chat/completions`,
    init: {
      method: "POST",
      headers,
      body: JSON.stringify({ model: cfg.model, messages, max_tokens: maxTokens }),
    },
  };
}

function chatOpenAICompatible(cfg: AIConfig, messages: ChatMessage[], maxTokens: number, opts: CallOptions) {
  const { url, init } = buildOpenAIRequest(cfg, messages, maxTokens);
  return callModel(cfg, "chat", cfg.model, url, init, (data) => {
    const d = data as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const text = d?.choices?.[0]?.message?.content;
    if (typeof text !== "string") throw new AIError(`Respuesta inesperada del proveedor ${cfg.provider}.`, 502);
    return { value: text, inputTokens: numero(d?.usage?.prompt_tokens), outputTokens: numero(d?.usage?.completion_tokens) };
  }, opts);
}

/** Arma la petición en formato Anthropic: el system va aparte. Exportada para poder probarla. */
export function buildAnthropicRequest(cfg: AIConfig, messages: ChatMessage[], maxTokens: number) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return {
    url: `${cfg.baseUrl}/messages`,
    init: {
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
    },
  };
}

function chatAnthropic(cfg: AIConfig, messages: ChatMessage[], maxTokens: number, opts: CallOptions) {
  const { url, init } = buildAnthropicRequest(cfg, messages, maxTokens);
  return callModel(cfg, "chat", cfg.model, url, init, (data) => {
    const d = data as {
      stop_reason?: string;
      content?: { type?: string; text?: string }[];
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
    };
    if (d?.stop_reason === "refusal") throw new AIError("El modelo declinó responder a esta petición.", 502);
    const text = (d?.content ?? [])
      .filter((b) => b?.type === "text")
      .map((b) => b.text ?? "")
      .join("");
    if (!text) throw new AIError("Respuesta vacía de Anthropic.", 502);
    return { value: text, inputTokens: numero(d?.usage?.input_tokens), outputTokens: numero(d?.usage?.output_tokens) };
  }, opts);
}

/** ¿Esta configuración puede transcribir audio? */
export function canTranscribe(cfg: AIConfig | null): boolean {
  if (!cfg) return false;
  // whisper.cpp se levanta con su modelo ya cargado: basta con saber dónde está.
  if (cfg.sttFormat === "whisper-cpp") return Boolean(cfg.sttBaseUrl);
  return Boolean(cfg.sttModel);
}

/**
 * Transcribe audio. Dos formatos posibles:
 *  - "openai": POST a /audio/transcriptions con el modelo en el formulario.
 *  - "whisper-cpp": POST a /inference. El servidor ya trae su modelo cargado y
 *    no acepta el campo `model`, así que se manda solo el archivo.
 */
export function transcribe(cfg: AIConfig, audio: Blob, filename = "audio.webm", opts: CallOptions = {}): Promise<string> {
  if (!canTranscribe(cfg)) {
    return Promise.reject(
      new AIError(
        `El proveedor ${cfg.provider} no transcribe audio. Configura AI_STT_BASE_URL con un servidor de transcripción (por ejemplo whisper.cpp local) o usa un proveedor que sí la tenga.`,
        501,
      ),
    );
  }

  const esWhisperCpp = cfg.sttFormat === "whisper-cpp";

  const form = new FormData();
  form.append("file", audio, filename);
  if (esWhisperCpp) {
    form.append("response_format", "json");
  } else {
    form.append("model", cfg.sttModel);
  }

  const headers: Record<string, string> = {};
  if (cfg.sttApiKey) headers["Authorization"] = `Bearer ${cfg.sttApiKey}`;

  const url = esWhisperCpp ? `${cfg.sttBaseUrl}/inference` : `${cfg.sttBaseUrl}/audio/transcriptions`;
  const modelo = esWhisperCpp ? cfg.sttModel || "whisper.cpp" : cfg.sttModel;

  return callModel(cfg, "transcription", modelo, url, {
    method: "POST",
    headers,
    body: form,
  }, (data) => {
    const d = data as { text?: unknown };
    if (typeof d?.text !== "string") throw new AIError("Respuesta inesperada del servicio de transcripción.", 502);
    return { value: d.text.trim(), inputTokens: null, outputTokens: null };
  }, opts);
}

/**
 * Guarda cada llamada en la base local. Un fallo al registrar nunca rompe la
 * respuesta: medir es útil, pero no a costa de la función que el usuario pidió.
 */
export function usageRecorder(funcion: string) {
  return async (u: Usage) => {
    const { registrarUsoIA } = await import("./datos");
    await registrarUsoIA({
      funcion,
      proveedor: u.provider,
      modelo: u.model,
      tokensIn: u.inputTokens,
      tokensOut: u.outputTokens,
      duracionMs: u.durationMs,
      estado: u.status,
      intentos: u.attempts,
    });
  };
}
