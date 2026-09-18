import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIError, corsHeaders, notConfigured, readConfig, transcribe } from "../_shared/ai.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const cfg = readConfig();
    if (!cfg) return notConfigured(corsHeaders);

    const { audio } = await req.json();
    if (!audio || typeof audio !== "string") {
      throw new AIError("No llegó el audio a transcribir.", 400);
    }

    const bytes = base64ABytes(audio);
    const texto = await transcribe(cfg, new Blob([bytes], { type: "audio/webm" }));

    return new Response(JSON.stringify({ text: texto, provider: cfg.provider }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en voice-to-text:", error);
    const status = error instanceof AIError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
