import { describe, expect, it } from "vitest";
import { buildMessages, parseSuggestions } from "../../src/lib/sugerencias";

const LISTA = `[
  {"title": "Revisar el presupuesto", "priority": "high", "category": "Trabajo"},
  {"title": "Agendar dentista", "priority": "low", "category": "Salud"}
]`;

const ESPERADO = [
  { title: "Revisar el presupuesto", priority: "high", category: "Trabajo" },
  { title: "Agendar dentista", priority: "low", category: "Salud" },
];

describe("parseSuggestions", () => {
  it("JSON limpio", () => {
    expect(parseSuggestions(LISTA)).toEqual(ESPERADO);
  });

  it("JSON dentro de un bloque ```json", () => {
    expect(parseSuggestions("```json\n" + LISTA + "\n```")).toEqual(ESPERADO);
  });

  it("JSON dentro de un bloque ``` sin lenguaje", () => {
    expect(parseSuggestions("```\n" + LISTA + "\n```")).toEqual(ESPERADO);
  });

  it("con texto antes y después del bloque", () => {
    const texto = `¡Claro! Aquí tienes tres ideas:\n\n\`\`\`json\n${LISTA}\n\`\`\`\n\nEspero que te sirvan.`;
    expect(parseSuggestions(texto)).toEqual(ESPERADO);
  });

  it("con texto antes y después, sin bloque de código", () => {
    expect(parseSuggestions(`Estas son mis sugerencias: ${LISTA} ¿Quieres más?`)).toEqual(ESPERADO);
  });

  it("envuelto en un objeto {suggestions: [...]}", () => {
    expect(parseSuggestions(`{"suggestions": ${LISTA}}`)).toEqual(ESPERADO);
  });

  it("con comas colgantes", () => {
    const texto = `[{"title": "Revisar el presupuesto", "priority": "high", "category": "Trabajo",},]`;
    expect(parseSuggestions(texto)).toEqual([ESPERADO[0]]);
  });

  it("normaliza prioridades inválidas o en mayúsculas y rellena la categoría", () => {
    const texto = `[
      {"title": "  Uno  ", "priority": "HIGH", "category": "Trabajo"},
      {"title": "Dos", "priority": "urgente"},
      {"title": "Tres", "priority": 3, "category": "  "}
    ]`;
    expect(parseSuggestions(texto)).toEqual([
      { title: "Uno", priority: "high", category: "Trabajo" },
      { title: "Dos", priority: "medium", category: "Personal" },
      { title: "Tres", priority: "medium", category: "Personal" },
    ]);
  });

  it("descarta elementos sin título o que no son objetos", () => {
    const texto = `[{"title": ""}, "texto suelto", null, {"priority": "high"}, {"title": "Válida"}]`;
    expect(parseSuggestions(texto)).toEqual([{ title: "Válida", priority: "medium", category: "Personal" }]);
  });

  it.each([
    ["texto sin JSON", "Lo siento, no puedo ayudarte con eso."],
    ["JSON cortado", `[{"title": "Revisar el presupuesto", "priority": "hi`],
    ["un objeto que no es lista", `{"title": "Sola"}`],
    ["cadena vacía", ""],
  ])("mal formado (%s): error 502 entendible", (_caso, texto) => {
    expect(() => parseSuggestions(texto)).toThrowError(expect.objectContaining({ status: 502, message: expect.stringMatching(/JSON/) }));
  });

  it("una lista sin ninguna sugerencia válida también es error", () => {
    expect(() => parseSuggestions(`[{"foo": 1}]`)).toThrowError(expect.objectContaining({ status: 502, message: expect.stringMatching(/ninguna sugerencia/) }));
  });
});

describe("buildMessages", () => {
  it("incluye las tareas del usuario y pide solo JSON", () => {
    const [system, user] = buildMessages([
      { title: "Correr 5 km", category: "Salud", priority: "low", completed: true },
      { title: "Estudiar" },
    ]);
    expect(system.role).toBe("system");
    expect(user.content).toContain("- Correr 5 km (Salud, prioridad low) ✓");
    expect(user.content).toContain("- Estudiar (sin categoría, prioridad media)");
    expect(user.content).toContain("Devuelve SOLO un arreglo JSON");
  });

  it("sin tareas lo dice en vez de mandar una lista vacía", () => {
    expect(buildMessages([])[1].content).toContain("(el usuario todavía no tiene tareas)");
  });
});
