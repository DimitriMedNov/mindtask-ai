import { afterEach, describe, expect, it, vi } from "vitest";
import { setEnv } from "../setup-deno";
import {
  AIError,
  TIMEOUT_MESSAGE,
  buildAnthropicRequest,
  buildOpenAIRequest,
  chat,
  notConfigured,
  readConfig,
  transcribe,
  type AIConfig,
  type ChatMessage,
  type Usage,
} from "../../supabase/functions/_shared/ai";

const MENSAJES: ChatMessage[] = [
  { role: "system", content: "Eres un asistente." },
  { role: "user", content: "Hola" },
];

const config = (parcial: Partial<AIConfig>): AIConfig => ({
  provider: "openai",
  baseUrl: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "modelo",
  sttModel: "",
  sttBaseUrl: "https://api.example.com/v1",
  sttApiKey: "sk-test",
  ...parcial,
});

const respuesta = (status: number, cuerpo: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json", ...headers } });

const OPENAI_OK = { choices: [{ message: { content: "listo" } }], usage: { prompt_tokens: 12, completion_tokens: 3 } };

/** Sustituye fetch por una secuencia de respuestas y devuelve el mock para revisar las llamadas. */
function mockFetch(...respuestas: Array<Response | (() => Promise<Response>)>) {
  const fn = vi.fn(async () => {
    const r = respuestas.shift();
    if (!r) throw new Error("fetch llamado más veces de las esperadas");
    return typeof r === "function" ? r() : r;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const sinEspera = async () => {};

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------

describe("readConfig: elección del proveedor según el entorno", () => {
  it("sin variables no hay IA configurada", () => {
    expect(readConfig()).toBeNull();
  });

  it("con solo LOVABLE_API_KEY usa el gateway de Lovable (proyectos creados en Lovable)", () => {
    setEnv({ LOVABLE_API_KEY: "lov-123" });
    const cfg = readConfig()!;
    expect(cfg.provider).toBe("lovable");
    expect(cfg.baseUrl).toBe("https://ai.gateway.lovable.dev/v1");
    expect(cfg.apiKey).toBe("lov-123");
    expect(cfg.sttModel).toBe("whisper-1");
  });

  it("ollama funciona sin llave y con sus valores por defecto", () => {
    setEnv({ AI_PROVIDER: "ollama" });
    const cfg = readConfig()!;
    expect(cfg).toMatchObject({ provider: "ollama", baseUrl: "http://localhost:11434/v1", model: "llama3.2", apiKey: "" });
    expect(cfg.sttModel).toBe("");
  });

  it("AI_PROVIDER no distingue mayúsculas ni espacios", () => {
    setEnv({ AI_PROVIDER: "  Anthropic ", AI_API_KEY: "sk-ant" });
    expect(readConfig()!.provider).toBe("anthropic");
  });

  it("AI_PROVIDER gana sobre LOVABLE_API_KEY", () => {
    setEnv({ AI_PROVIDER: "openai", AI_API_KEY: "sk-openai", LOVABLE_API_KEY: "lov-123" });
    const cfg = readConfig()!;
    expect(cfg.provider).toBe("openai");
    expect(cfg.apiKey).toBe("sk-openai");
  });

  it("AI_BASE_URL y AI_MODEL sobrescriben los valores por defecto, sin la diagonal final", () => {
    setEnv({ AI_PROVIDER: "ollama", AI_BASE_URL: "http://host.docker.internal:11434/v1///", AI_MODEL: "qwen2.5" });
    expect(readConfig()).toMatchObject({ baseUrl: "http://host.docker.internal:11434/v1", model: "qwen2.5" });
  });

  it("la transcripción usa el mismo servidor salvo que se indique AI_STT_BASE_URL", () => {
    setEnv({ AI_PROVIDER: "ollama" });
    expect(readConfig()!.sttBaseUrl).toBe("http://localhost:11434/v1");

    setEnv({ AI_STT_BASE_URL: "http://localhost:8080/v1/", AI_STT_MODEL: "whisper-1" });
    expect(readConfig()).toMatchObject({ sttBaseUrl: "http://localhost:8080/v1", sttModel: "whisper-1" });
  });

  it.each(["openai", "anthropic", "lovable"])("%s sin AI_API_KEY es un error 500 claro", (provider) => {
    setEnv({ AI_PROVIDER: provider });
    expect(() => readConfig()).toThrowError(new AIError(`Falta AI_API_KEY para el proveedor ${provider}.`));
  });

  it("custom sin AI_BASE_URL es un error", () => {
    setEnv({ AI_PROVIDER: "custom" });
    expect(() => readConfig()).toThrowError(/Falta AI_BASE_URL/);
  });

  it("un proveedor desconocido es un error que dice cuáles sí existen", () => {
    setEnv({ AI_PROVIDER: "gemini" });
    expect(() => readConfig()).toThrowError(/no reconocido: "gemini".*ollama, openai, anthropic/);
  });
});

describe("notConfigured", () => {
  it("responde 503 con un mensaje y un código que el frontend reconoce", async () => {
    const res = notConfigured({ "Access-Control-Allow-Origin": "*" });
    expect(res.status).toBe(503);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const cuerpo = await res.json();
    expect(cuerpo.code).toBe("ai_not_configured");
    expect(cuerpo.error).toMatch(/no está configurada/);
    expect(cuerpo.hint).toMatch(/AI_PROVIDER/);
  });
});

// ---------------------------------------------------------------------------

describe("formato de las peticiones", () => {
  it("OpenAI y compatibles: /chat/completions, Bearer y el system dentro de messages", () => {
    const { url, init } = buildOpenAIRequest(config({}), MENSAJES, 256);
    expect(url).toBe("https://api.example.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test", "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual({ model: "modelo", messages: MENSAJES, max_tokens: 256 });
  });

  it("OpenAI compatible sin llave (Ollama) no manda Authorization", () => {
    const { init } = buildOpenAIRequest(config({ provider: "ollama", apiKey: "" }), MENSAJES, 256);
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("Anthropic: /messages, x-api-key, anthropic-version y el system aparte", () => {
    const { url, init } = buildAnthropicRequest(
      config({ provider: "anthropic", baseUrl: "https://api.anthropic.com/v1", apiKey: "sk-ant" }),
      [...MENSAJES, { role: "system", content: "Responde en español." }],
      512,
    );
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "sk-ant", "anthropic-version": "2023-06-01" });
    expect(init.headers).not.toHaveProperty("Authorization");

    const cuerpo = JSON.parse(init.body);
    expect(cuerpo.system).toBe("Eres un asistente.\n\nResponde en español.");
    expect(cuerpo.max_tokens).toBe(512);
    expect(cuerpo.messages).toEqual([{ role: "user", content: "Hola" }]);
  });

  it("Anthropic sin mensajes de system no manda el campo system", () => {
    const { init } = buildAnthropicRequest(config({ provider: "anthropic" }), [{ role: "user", content: "Hola" }], 10);
    expect(JSON.parse(init.body)).not.toHaveProperty("system");
  });

  it("chat() elige el formato según el proveedor y lee texto y tokens de cada uno", async () => {
    const fetchMock = mockFetch(
      respuesta(200, OPENAI_OK),
      respuesta(200, {
        content: [{ type: "text", text: "hola " }, { type: "text", text: "mundo" }],
        usage: { input_tokens: 20, output_tokens: 4 },
      }),
    );
    const usos: Usage[] = [];

    expect(await chat(config({}), MENSAJES, { onUsage: (u) => void usos.push(u) })).toBe("listo");
    expect(await chat(config({ provider: "anthropic" }), MENSAJES, { onUsage: (u) => void usos.push(u) })).toBe("hola mundo");

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.example.com/v1/chat/completions",
      "https://api.example.com/v1/messages",
    ]);
    expect(usos.map((u) => [u.inputTokens, u.outputTokens, u.status, u.attempts])).toEqual([
      [12, 3, 200, 1],
      [20, 4, 200, 1],
    ]);
  });

  it("una negativa de Anthropic se reporta como error, no como texto vacío", async () => {
    mockFetch(respuesta(200, { stop_reason: "refusal", content: [] }));
    await expect(chat(config({ provider: "anthropic" }), MENSAJES)).rejects.toMatchObject({ status: 502, message: /declinó/ });
  });

  it("si el proveedor no manda tokens se registran como null", async () => {
    mockFetch(respuesta(200, { choices: [{ message: { content: "x" } }] }));
    let uso: Usage | undefined;
    await chat(config({}), MENSAJES, { onUsage: (u) => void (uso = u) });
    expect(uso).toMatchObject({ inputTokens: null, outputTokens: null });
  });
});

// ---------------------------------------------------------------------------

describe("reintentos y tiempo límite", () => {
  it("reintenta ante 503 con espera progresiva y termina bien", async () => {
    const fetchMock = mockFetch(respuesta(503, {}), respuesta(503, {}), respuesta(200, OPENAI_OK));
    const esperas: number[] = [];
    const texto = await chat(config({}), MENSAJES, { sleep: async (ms) => void esperas.push(ms) });
    expect(texto).toBe("listo");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([1000, 2000]);
  });

  it("ante 429 respeta el Retry-After del proveedor", async () => {
    mockFetch(respuesta(429, {}, { "Retry-After": "3" }), respuesta(200, OPENAI_OK));
    const esperas: number[] = [];
    await chat(config({}), MENSAJES, { sleep: async (ms) => void esperas.push(ms) });
    expect(esperas).toEqual([3000]);
  });

  it("se rinde después de 2 reintentos y responde 502", async () => {
    const fetchMock = mockFetch(respuesta(500, {}), respuesta(502, {}), respuesta(503, { error: "caído" }));
    let uso: Usage | undefined;
    await expect(chat(config({}), MENSAJES, { sleep: sinEspera, onUsage: (u) => void (uso = u) })).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("503"),
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(uso).toMatchObject({ status: 502, attempts: 3 });
  });

  it.each([400, 401, 404, 422])("nunca reintenta un %i", async (status) => {
    const fetchMock = mockFetch(respuesta(status, { error: "mal" }));
    await expect(chat(config({}), MENSAJES, { sleep: sinEspera })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si el modelo no responde a tiempo aborta y responde 504", async () => {
    let señal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        señal = init.signal!;
        return new Promise<Response>((_, reject) =>
          señal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        );
      }),
    );
    let uso: Usage | undefined;
    await expect(chat(config({}), MENSAJES, { timeoutMs: 30, onUsage: (u) => void (uso = u) })).rejects.toEqual(
      new AIError(TIMEOUT_MESSAGE, 504),
    );
    expect(señal!.aborted).toBe(true);
    expect(uso).toMatchObject({ status: 504, attempts: 1 });
  });

  it("no reintenta si la espera ya no cabe en el tiempo límite", async () => {
    const fetchMock = mockFetch(respuesta(503, {}, { "Retry-After": "60" }));
    await expect(chat(config({}), MENSAJES, { sleep: sinEspera })).rejects.toMatchObject({ status: 502 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si no puede conectar con el proveedor lo dice con un 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(chat(config({ provider: "ollama" }), MENSAJES)).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("No se pudo conectar con el proveedor ollama"),
    });
  });

  it("un error al registrar el uso no rompe la respuesta", async () => {
    mockFetch(respuesta(200, OPENAI_OK));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const texto = await chat(config({}), MENSAJES, {
      onUsage: () => {
        throw new Error("la base de datos no responde");
      },
    });
    expect(texto).toBe("listo");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});

describe("transcribe", () => {
  it("con un proveedor que no transcribe responde 501 sin llamar a nadie", async () => {
    const fetchMock = mockFetch();
    await expect(transcribe(config({ provider: "ollama", sttModel: "" }), new Blob(["x"]))).rejects.toMatchObject({
      status: 501,
      message: expect.stringContaining("no transcribe audio"),
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manda el audio al servidor de transcripción configurado", async () => {
    const fetchMock = mockFetch(respuesta(200, { text: "crear tarea comprar pan" }));
    const cfg = config({ provider: "ollama", apiKey: "", sttModel: "whisper-1", sttBaseUrl: "http://localhost:8080/v1", sttApiKey: "" });
    expect(await transcribe(cfg, new Blob(["x"], { type: "audio/webm" }))).toBe("crear tarea comprar pan");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/v1/audio/transcriptions");
    const form = init.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect((form.get("file") as File).name).toBe("audio.webm");
  });
});
