/**
 * Prompt y parseo de ai-task-suggestions, separados de la función para poder
 * probarlos y para que scripts/medir-ia.ts mida exactamente la misma petición.
 */
import { AIError, type ChatMessage } from "./ai.ts";

export type Suggestion = { title: string; priority: "high" | "medium" | "low"; category: string };

type TaskInput = { title?: string; category?: string; priority?: string; completed?: boolean };

export const SYSTEM = `Eres un asistente de productividad. Analiza las tareas del usuario y sugiere 3 tareas nuevas que le ayuden a avanzar. Deben ser específicas, accionables y relacionadas con lo que ya tiene.`;

export function buildMessages(tasks: TaskInput[]): ChatMessage[] {
  const contexto = tasks
    .map((t) =>
      `- ${t.title ?? "(sin título)"} (${t.category ?? "sin categoría"}, prioridad ${t.priority ?? "media"})${t.completed ? " ✓" : ""}`
    )
    .join("\n");

  return [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content:
        `Basándote en estas tareas:\n${contexto || "(el usuario todavía no tiene tareas)"}\n\n` +
        `Sugiere 3 tareas nuevas. Devuelve SOLO un arreglo JSON con este formato exacto:\n` +
        `[{"title": "título", "priority": "high|medium|low", "category": "categoría"}]`,
    },
  ];
}

const PRIORIDADES = new Set(["high", "medium", "low"]);

/** Intenta JSON.parse; si falla, prueba quitando comas colgantes, un error común de modelos chicos. */
function intentarParsear(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    try {
      return JSON.parse(texto.replace(/,\s*([\]}])/g, "$1"));
    } catch {
      return undefined;
    }
  }
}

/**
 * Saca la lista de sugerencias de lo que devolvió el modelo. Aguanta el JSON
 * dentro de un bloque de código, con texto antes o después, envuelto en un
 * objeto {"suggestions": [...]} y con comas colgantes. Descarta los elementos
 * sin título y normaliza prioridad y categoría. Si no hay nada utilizable,
 * lanza un AIError 502 con un mensaje entendible.
 */
export function parseSuggestions(texto: string): Suggestion[] {
  const candidatos: string[] = [];

  const bloque = texto.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloque) candidatos.push(bloque[1].trim());
  candidatos.push(texto.trim());

  const inicio = texto.indexOf("[");
  const fin = texto.lastIndexOf("]");
  if (inicio !== -1 && fin > inicio) candidatos.push(texto.slice(inicio, fin + 1));

  let lista: unknown[] | undefined;
  for (const c of candidatos) {
    let valor = intentarParsear(c);
    if (valor && typeof valor === "object" && !Array.isArray(valor) && Array.isArray((valor as { suggestions?: unknown }).suggestions)) {
      valor = (valor as { suggestions: unknown[] }).suggestions;
    }
    if (Array.isArray(valor)) {
      lista = valor;
      break;
    }
  }

  if (!lista) throw new AIError("El modelo no devolvió un JSON que se pueda leer.", 502);

  const sugerencias = lista.flatMap((s): Suggestion[] => {
    if (!s || typeof s !== "object") return [];
    const { title, priority, category } = s as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim()) return [];
    const p = typeof priority === "string" ? priority.trim().toLowerCase() : "";
    return [{
      title: title.trim(),
      priority: (PRIORIDADES.has(p) ? p : "medium") as Suggestion["priority"],
      category: typeof category === "string" && category.trim() ? category.trim() : "Personal",
    }];
  });

  if (sugerencias.length === 0) throw new AIError("El modelo no devolvió ninguna sugerencia válida.", 502);
  return sugerencias;
}
