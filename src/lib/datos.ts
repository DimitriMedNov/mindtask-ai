import { PGlite } from "@electric-sql/pglite";
import type { Task } from "@/components/TaskCard";

/**
 * La base de datos, dentro de la app.
 *
 * Antes esto era Postgres en Docker, con Supabase encima: para abrir un gestor
 * de tareas personal había que levantar tres servicios. PGlite es el mismo
 * Postgres compilado a WebAssembly, corriendo en la pestaña y guardado en el
 * navegador, así que la app abre sola y sigue hablando SQL de verdad —las mismas
 * consultas, los mismos tipos— en vez de un almacén de pares clave-valor.
 *
 * No hay cuentas ni sesiones: es tu máquina, tus tareas. Lo que antes protegía
 * el aislamiento por usuario ahora lo protege el sistema operativo.
 */

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  completed    BOOLEAN NOT NULL DEFAULT false,
  priority     TEXT NOT NULL DEFAULT 'medium',
  category     TEXT NOT NULL DEFAULT 'Personal',
  start_date   DATE,
  due_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID REFERENCES tasks(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 25,
  completed        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_stats (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  points             INTEGER NOT NULL DEFAULT 0,
  level              INTEGER NOT NULL DEFAULT 1,
  streak_days        INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  tasks_completed    INTEGER NOT NULL DEFAULT 0
);

-- Una sola fila de estadísticas, siempre la misma.
INSERT INTO user_stats (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ai_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcion       TEXT NOT NULL,
  proveedor     TEXT NOT NULL,
  modelo        TEXT NOT NULL,
  tokens_in     INTEGER,
  tokens_out    INTEGER,
  duracion_ms   INTEGER NOT NULL,
  estado        INTEGER NOT NULL,
  intentos      INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_pomodoro_fecha ON pomodoro_sessions(created_at DESC);
`;

let instancia: Promise<PGlite> | null = null;

/** Abre la base una sola vez y la deja lista con su esquema. */
export function db(): Promise<PGlite> {
  if (!instancia) {
    instancia = (async () => {
      // idb:// la guarda en el navegador; en la app de escritorio vive en su
      // carpeta de datos, no en un servidor.
      const pg = new PGlite("idb://mindtask");
      await pg.exec(ESQUEMA);
      return pg;
    })();
  }
  return instancia;
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

type FilaTarea = {
  id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: string;
  category: string;
  start_date: string | Date | null;
  due_date: string | Date | null;
  created_at: string | Date;
};

/**
 * Una fecha sin hora tiene que quedarse en el día que es.
 *
 * PGlite devuelve las columnas DATE como un Date puesto a medianoche UTC. Leído
 * en México eso cae en las 18:00 del día anterior, así que "vence mañana" se
 * mostraba como "vence hoy". Aquí se reconstruye con los componentes UTC, que
 * son los que de verdad guardó Postgres.
 */
function aFecha(valor: string | Date | null): Date | undefined {
  if (!valor) return undefined;
  if (valor instanceof Date) {
    return new Date(valor.getUTCFullYear(), valor.getUTCMonth(), valor.getUTCDate());
  }
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (soloFecha) return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
  return new Date(valor);
}

/** Guarda la fecha tal como la eligió el usuario, sin convertirla a UTC. */
function aTexto(fecha?: Date): string | null {
  if (!fecha) return null;
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function aTarea(fila: FilaTarea): Task {
  return {
    id: fila.id,
    title: fila.title,
    description: fila.description ?? undefined,
    completed: fila.completed,
    priority: fila.priority as Task["priority"],
    category: fila.category,
    createdAt: new Date(fila.created_at),
    startDate: aFecha(fila.start_date),
    dueDate: aFecha(fila.due_date),
  };
}

export async function listarTareas(): Promise<Task[]> {
  const pg = await db();
  const { rows } = await pg.query<FilaTarea>(
    `SELECT * FROM tasks ORDER BY completed, due_date NULLS LAST, created_at DESC`,
  );
  return rows.map(aTarea);
}

export async function crearTarea(tarea: Omit<Task, "id" | "createdAt">): Promise<Task> {
  const pg = await db();
  const { rows } = await pg.query<FilaTarea>(
    `INSERT INTO tasks (title, description, completed, priority, category, start_date, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      tarea.title,
      tarea.description ?? null,
      tarea.completed,
      tarea.priority,
      tarea.category,
      aTexto(tarea.startDate),
      aTexto(tarea.dueDate),
    ],
  );
  return aTarea(rows[0]);
}

export async function actualizarTarea(id: string, cambios: Partial<Task>): Promise<void> {
  const pg = await db();
  const campos: string[] = [];
  const valores: unknown[] = [];

  const agregar = (columna: string, valor: unknown) => {
    campos.push(`${columna} = $${campos.length + 1}`);
    valores.push(valor);
  };

  if (cambios.title !== undefined) agregar("title", cambios.title);
  if (cambios.description !== undefined) agregar("description", cambios.description ?? null);
  if (cambios.completed !== undefined) agregar("completed", cambios.completed);
  if (cambios.priority !== undefined) agregar("priority", cambios.priority);
  if (cambios.category !== undefined) agregar("category", cambios.category);
  if (cambios.startDate !== undefined) agregar("start_date", aTexto(cambios.startDate));
  if (cambios.dueDate !== undefined) agregar("due_date", aTexto(cambios.dueDate));
  if (campos.length === 0) return;

  campos.push("updated_at = now()");
  valores.push(id);
  await pg.query(`UPDATE tasks SET ${campos.join(", ")} WHERE id = $${valores.length}`, valores);
}

export async function borrarTarea(id: string): Promise<void> {
  const pg = await db();
  await pg.query(`DELETE FROM tasks WHERE id = $1`, [id]);
}

// ---------------------------------------------------------------------------
// Estadísticas y enfoque
// ---------------------------------------------------------------------------

export type Estadisticas = {
  points: number;
  level: number;
  streak_days: number;
  tasks_completed: number;
};

export async function leerEstadisticas(): Promise<Estadisticas> {
  const pg = await db();
  const { rows } = await pg.query<Estadisticas>(
    `SELECT points, level, streak_days, tasks_completed FROM user_stats WHERE id = 1`,
  );
  return rows[0] ?? { points: 0, level: 1, streak_days: 0, tasks_completed: 0 };
}

/** Diez puntos por tarea, cien por nivel, y la racha se mantiene si hubo algo ayer. */
export async function sumarTareaCompletada(): Promise<Estadisticas> {
  const pg = await db();
  await pg.query(`
    UPDATE user_stats SET
      points = points + 10,
      tasks_completed = tasks_completed + 1,
      level = ((points + 10) / 100) + 1,
      streak_days = CASE
        WHEN last_activity_date = CURRENT_DATE THEN streak_days
        WHEN last_activity_date = CURRENT_DATE - 1 THEN streak_days + 1
        ELSE 1
      END,
      last_activity_date = CURRENT_DATE
    WHERE id = 1
  `);
  return leerEstadisticas();
}

export async function registrarPomodoro(taskId: string | null, minutos = 25): Promise<void> {
  const pg = await db();
  await pg.query(`INSERT INTO pomodoro_sessions (task_id, duration_minutes) VALUES ($1, $2)`, [taskId, minutos]);
}

// ---------------------------------------------------------------------------
// Uso de la IA
// ---------------------------------------------------------------------------

export type UsoIA = {
  funcion: string;
  proveedor: string;
  modelo: string;
  tokensIn: number | null;
  tokensOut: number | null;
  duracionMs: number;
  estado: number;
  intentos: number;
};

export async function registrarUsoIA(uso: UsoIA): Promise<void> {
  const pg = await db();
  await pg.query(
    `INSERT INTO ai_usage (funcion, proveedor, modelo, tokens_in, tokens_out, duracion_ms, estado, intentos)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [uso.funcion, uso.proveedor, uso.modelo, uso.tokensIn, uso.tokensOut, uso.duracionMs, uso.estado, uso.intentos],
  );
}

/** Para el script de medición y para enseñar números reales en la app. */
export async function resumenUsoIA() {
  const pg = await db();
  const { rows } = await pg.query<{ funcion: string; llamadas: number; mediana: number; p95: number }>(`
    SELECT funcion,
           COUNT(*)::int AS llamadas,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duracion_ms)::int AS mediana,
           PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duracion_ms)::int AS p95
    FROM ai_usage
    WHERE estado = 200
    GROUP BY funcion
  `);
  return rows;
}

/** Todo lo que hay, en un archivo que puedes guardar o abrir con cualquier cosa. */
export async function exportar(): Promise<string> {
  const pg = await db();
  const tareas = await pg.query(`SELECT * FROM tasks ORDER BY created_at`);
  const sesiones = await pg.query(`SELECT * FROM pomodoro_sessions ORDER BY created_at`);
  const stats = await pg.query(`SELECT * FROM user_stats WHERE id = 1`);
  return JSON.stringify(
    { version: 1, exportado: new Date().toISOString(), tareas: tareas.rows, sesiones: sesiones.rows, estadisticas: stats.rows[0] },
    null,
    2,
  );
}
