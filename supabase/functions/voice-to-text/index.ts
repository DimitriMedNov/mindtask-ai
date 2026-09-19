import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  AIError,
  canTranscribe,
  corsHeaders,
  errorResponse,
  notConfigured,
  readConfig,
  transcribe,
  usageRecorder,
} from "../_shared/ai.ts";
import { checkQuota, userIdFromRequest } from "../_shared/quota.ts";

/** Convierte base64 a bytes por partes, para no reventar la memoria con audios largos. */
function base64ABytes(base64: string, tamano = 32768): Uint8Array {
  const partes: Uint8Array[] = [];
  let posicion = 0;

  while (posicion < base64.length) {
    const parte = base64.slice(posicion, posicion + tamano);
    const binario = atob(parte);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    partes.push(bytes);
    posicion += tamano;
  }

  const total = partes.reduce((suma, p) => suma + p.length, 0);
  const salida = new Uint8Array(total);
  let offset = 0;
  for (const p of partes) {
    salida.set(p, offset);
    offset += p.length;
  }
  return salida;
}

/** Extensión según el tipo que grabó el navegador: Chrome y Firefox dan webm, Safari mp4. */
const EXTENSIONES: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cfg = readConfig();

    // GET: el frontend pregunta si hay dictado antes de dejar grabar. No gasta cuota.
    if (req.method === "GET") {
      if (canTranscribe(cfg)) return json({ available: true, provider: cfg!.provider, model: cfg!.sttModel });
      return json({
        available: false,
        provider: cfg?.provider ?? null,
        reason: cfg
          ? `El proveedor configurado (${cfg.provider}) no transcribe audio.`
          : "La IA no está configurada en este despliegue.",
      });
    }

    if (!cfg) return notConfigured(corsHeaders);

    const { audio, mimeType, parcial } = await req.json();

    // Mientras alguien dicta se mandan avances cada pocos segundos para que el
    // texto se vea aparecer. Esos avances no gastan cupo: si contaran, una sola
    // frase de quince segundos consumiría media docena de usos.
    if (!parcial) {
      const limitada = await checkQuota(req, "voice-to-text", corsHeaders);
      if (limitada) return limitada;
    }

    if (!audio || typeof audio !== "string") {
      throw new AIError("No llegó el audio a transcribir.", 400);
    }

    const tipo = typeof mimeType === "string" ? mimeType.split(";")[0].trim() : "audio/webm";
    const extension = EXTENSIONES[tipo] ?? "webm";
    const bytes = base64ABytes(audio);

    const texto = await transcribe(cfg, new Blob([bytes], { type: tipo }), `audio.${extension}`, {
      onUsage: usageRecorder(parcial ? "voice-to-text-parcial" : "voice-to-text", userIdFromRequest(req)),
    });

    return json({ text: texto, provider: cfg.provider });
  } catch (error) {
    console.error("Error en voice-to-text:", error);
    return errorResponse(error, corsHeaders);
  }
});
