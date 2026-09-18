import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AIError, chat, corsHeaders, notConfigured, readConfig } from "../_shared/ai.ts";

const SYSTEM = `Eres un asistente de productividad. Analiza las tareas del usuario y sugiere 3 tareas nuevas que le ayuden a avanzar. Deben ser específicas, accionables y relacionadas con lo que ya tiene.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cfg = readConfig();
    // Sin IA configurada la app sigue viva: solo esta función se apaga.
    if (!cfg) return notConfigured(corsHeaders);

    const { userTasks } = await req.json();
    const tasks = Array.isArray(userTasks) ? userTasks : [];

    const contexto = tasks
      .map((t: { title?: string; category?: string; priority?: string; completed?: boolean }) =>
        `- ${t.title ?? "(sin título)"} (${t.category ?? "sin categoría"}, prioridad ${t.priority ?? "media"})${t.completed ? " ✓" : ""}`
      )
      .join("\n");

    const texto = await chat(cfg, [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          `Basándote en estas tareas:\n${contexto || "(el usuario todavía no tiene tareas)"}\n\n` +
          `Sugiere 3 tareas nuevas. Devuelve SOLO un arreglo JSON con este formato exacto:\n` +
          `[{"title": "título", "priority": "high|medium|low", "category": "categoría"}]`,
      },
    ]);

    // Algunos modelos envuelven el JSON en un bloque de código; hay que sacarlo.
    const bloque = texto.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
    const crudo = bloque ? bloque[1] : texto;

    let suggestions: unknown;
    try {
      suggestions = JSON.parse(crudo);
    } catch {
      // Último intento: quedarse con lo que haya entre el primer [ y el último ]
      const inicio = crudo.indexOf("[");
      const fin = crudo.lastIndexOf("]");
      if (inicio === -1 || fin === -1) {
        throw new AIError("El modelo no devolvió un JSON que se pueda leer.", 502);
      }
      suggestions = JSON.parse(crudo.slice(inicio, fin + 1));
    }

    if (!Array.isArray(suggestions)) {
      throw new AIError("El modelo no devolvió una lista de sugerencias.", 502);
    }

    return new Response(JSON.stringify({ suggestions, provider: cfg.provider, model: cfg.model }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error en ai-task-suggestions:", error);
    const status = error instanceof AIError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Error desconocido";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
