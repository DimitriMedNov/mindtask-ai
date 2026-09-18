import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chat, corsHeaders, errorResponse, notConfigured, readConfig, usageRecorder } from "../_shared/ai.ts";
import { checkQuota, userIdFromRequest } from "../_shared/quota.ts";
import { buildMessages, parseSuggestions } from "../_shared/suggestions.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cfg = readConfig();
    // Sin IA configurada la app sigue viva: solo esta función se apaga.
    if (!cfg) return notConfigured(corsHeaders);

    const limitada = await checkQuota(req, "ai-task-suggestions", corsHeaders);
    if (limitada) return limitada;

    const { userTasks } = await req.json();
    const tasks = Array.isArray(userTasks) ? userTasks : [];

    const texto = await chat(cfg, buildMessages(tasks), {
      onUsage: usageRecorder("ai-task-suggestions", userIdFromRequest(req)),
    });
    const suggestions = parseSuggestions(texto);

    return new Response(JSON.stringify({ suggestions, provider: cfg.provider, model: cfg.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en ai-task-suggestions:", error);
    return errorResponse(error, corsHeaders);
  }
});
