import { describe, expect, it } from "vitest";
import { interpretarDictado } from "../../src/lib/dictado";

// Un martes, para que "el viernes" y "la próxima semana" caigan en días claros.
const HOY = new Date(2026, 8, 15);

describe("interpretarDictado", () => {
  it("usa la frase completa como título cuando no hay muletilla", () => {
    const t = interpretarDictado("comprar café", HOY);
    expect(t.title).toBe("Comprar café");
    expect(t.dueDate).toBeUndefined();
  });

  it("quita las muletillas con las que la gente empieza a dictar", () => {
    for (const frase of [
      "crear tarea comprar café",
      "nueva tarea comprar café",
      "recuérdame comprar café",
      "anotar una tarea de comprar café",
    ]) {
      expect(interpretarDictado(frase, HOY).title).toBe("Comprar café");
    }
  });

  it("entiende hoy, mañana y pasado mañana, y los saca del título", () => {
    expect(interpretarDictado("comprar café hoy", HOY).dueDate).toEqual(new Date(2026, 8, 15));
    expect(interpretarDictado("comprar café mañana", HOY).dueDate).toEqual(new Date(2026, 8, 16));
    expect(interpretarDictado("comprar café pasado mañana", HOY).dueDate).toEqual(new Date(2026, 8, 17));
    expect(interpretarDictado("comprar café mañana", HOY).title).toBe("Comprar café");
  });

  it("entiende un día de la semana y lo lleva al siguiente que toca", () => {
    const t = interpretarDictado("llamar al dentista el viernes", HOY);
    expect(t.dueDate).toEqual(new Date(2026, 8, 18));
    expect(t.title).toBe("Llamar al dentista");
  });

  it("entiende en N días y la próxima semana", () => {
    expect(interpretarDictado("pagar la luz en 3 días", HOY).dueDate).toEqual(new Date(2026, 8, 18));
    expect(interpretarDictado("revisar el reporte la próxima semana", HOY).dueDate).toEqual(new Date(2026, 8, 22));
  });

  it("sube la prioridad cuando se dice urgente y la baja con sin prisa", () => {
    expect(interpretarDictado("mandar el reporte urgente", HOY).priority).toBe("high");
    expect(interpretarDictado("ordenar el clóset sin prisa", HOY).priority).toBe("low");
    expect(interpretarDictado("comprar café", HOY).priority).toBe("medium");
  });

  it("deduce la categoría por lo que se dice", () => {
    expect(interpretarDictado("preparar la junta con el cliente", HOY).category).toBe("Trabajo");
    expect(interpretarDictado("sacar cita con el dentista", HOY).category).toBe("Salud");
    expect(interpretarDictado("estudiar para el examen", HOY).category).toBe("Estudio");
    expect(interpretarDictado("regar las plantas", HOY).category).toBe("Personal");
  });

  it("nunca deja una tarea sin título", () => {
    expect(interpretarDictado("crear tarea", HOY).title).toBe("Tarea dictada");
  });
});
