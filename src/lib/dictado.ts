import { addDays, nextDay, startOfDay, type Day } from "date-fns";
import type { Task } from "@/components/TaskCard";

/**
 * Convierte lo que alguien dictó en una tarea.
 *
 * Antes la app exigía decir literalmente "crear tarea": si dictabas "comprar café
 * mañana", se transcribía y se tiraba. Ahora cualquier frase sirve, y de paso se
 * entienden las fechas y las urgencias más comunes del español hablado.
 */

const DIAS: Record<string, Day> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  "miércoles": 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  "sábado": 6,
  sabado: 6,
};

const PRIORIDAD_ALTA = /\b(urgente|urgentemente|importante|prioridad alta|ya mismo|cuanto antes)\b/i;
const PRIORIDAD_BAJA = /\b(cuando pueda|sin prisa|sin apuro|no urge|prioridad baja)\b/i;

const CATEGORIAS: Array<[RegExp, string]> = [
  [/\b(junta|reunión|reunion|cliente|proveedor|reporte|factura|correo|oficina|trabajo|proyecto)\b/i, "Trabajo"],
  [/\b(doctor|dentista|médico|medico|cita médica|gimnasio|correr|caminar|medicina|salud)\b/i, "Salud"],
  [/\b(estudiar|examen|tarea|curso|clase|leer|escuela|universidad)\b/i, "Estudio"],
];

/** Frases de arranque que la gente dice por costumbre y no son parte de la tarea. */
const MULETILLAS = /^(crear|nueva|agregar|añadir|anotar|apuntar|recordar|recuérdame|recuerdame)\s+(una\s+)?(tarea|pendiente|nota)?\s*(de|para|que)?\s*/i;

export function interpretarDictado(texto: string, hoy = new Date()): Omit<Task, "id" | "createdAt"> {
  let titulo = texto.trim().replace(MULETILLAS, "").trim();

  const { fecha, expresion } = buscarFecha(titulo, hoy);
  if (expresion) titulo = titulo.replace(expresion, " ").replace(/\s{2,}/g, " ").trim();

  const priority: Task["priority"] = PRIORIDAD_ALTA.test(texto)
    ? "high"
    : PRIORIDAD_BAJA.test(texto)
      ? "low"
      : "medium";

  if (PRIORIDAD_ALTA.test(titulo) || PRIORIDAD_BAJA.test(titulo)) {
    titulo = titulo.replace(PRIORIDAD_ALTA, " ").replace(PRIORIDAD_BAJA, " ").replace(/\s{2,}/g, " ").trim();
  }

  const category = CATEGORIAS.find(([patron]) => patron.test(texto))?.[1] ?? "Personal";

  return {
    title: mayusculaInicial(titulo) || "Tarea dictada",
    description: "Dictada por voz",
    completed: false,
    priority,
    category,
    dueDate: fecha,
  };
}

function buscarFecha(texto: string, hoy: Date): { fecha?: Date; expresion?: RegExp } {
  const base = startOfDay(hoy);

  if (/\bpasado mañana\b/i.test(texto)) return { fecha: addDays(base, 2), expresion: /\bpasado mañana\b/i };
  if (/\bmañana\b/i.test(texto)) return { fecha: addDays(base, 1), expresion: /\bmañana\b/i };
  if (/\bhoy\b/i.test(texto)) return { fecha: base, expresion: /\bhoy\b/i };

  const enDias = /\ben (\d{1,2}) d[ií]as?\b/i.exec(texto);
  if (enDias) return { fecha: addDays(base, Number(enDias[1])), expresion: new RegExp(enDias[0], "i") };

  const semana = /\b(la (pr[oó]xima|siguiente) semana|en una semana)\b/i;
  if (semana.test(texto)) return { fecha: addDays(base, 7), expresion: semana };

  for (const [nombre, numero] of Object.entries(DIAS)) {
    const patron = new RegExp(`\\b(el |este |próximo |proximo )?${nombre}\\b`, "i");
    if (patron.test(texto)) return { fecha: nextDay(base, numero), expresion: patron };
  }

  return {};
}

function mayusculaInicial(texto: string): string {
  if (!texto) return texto;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
