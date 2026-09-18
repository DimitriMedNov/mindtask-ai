/**
 * Mide el desempeño real de ai-task-suggestions contra el proveedor configurado.
 *
 *   npm run medir-ia                 # 20 peticiones
 *   npm run medir-ia -- --n=50       # otra cantidad
 *
 * Lee la configuración de supabase/functions/.env (la misma que usan las Edge
 * Functions); cualquier variable del entorno la sobrescribe. Para estimar costo,
 * define el precio por millón de tokens:
 *
 *   AI_PRICE_INPUT_PER_MTOK=0.15 AI_PRICE_OUTPUT_PER_MTOK=0.60 npm run medir-ia
 *
 * Usa exactamente el mismo prompt y el mismo código (_shared/ai.ts y
 * _shared/suggestions.ts) que la función, pero llama al proveedor directo: no
 * pasa por Supabase ni gasta el límite de uso.
 */
import { readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Entorno: el código compartido lee Deno.env, así que se lo damos en Node
// ---------------------------------------------------------------------------

function leerEnvFile(archivo: string): Record<string, string> {
  if (!existsSync(archivo)) return {};
  const vars: Record<string, string> = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(?:#.*)?$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env: Record<string, string | undefined> = {
  ...leerEnvFile(path.join(raiz, "supabase/functions/.env")),
  ...process.env,
};
// El .env apunta a host.docker.internal porque las funciones corren en Docker;
// este script corre en la máquina, donde Ollama está en localhost.
if (env.AI_BASE_URL) env.AI_BASE_URL = env.AI_BASE_URL.replace("host.docker.internal", "localhost");

(globalThis as unknown as { Deno: unknown }).Deno = { env: { get: (k: string) => env[k] } };

const { readConfig, chat } = await import("../supabase/functions/_shared/ai.ts");
const { buildMessages, parseSuggestions } = await import("../supabase/functions/_shared/suggestions.ts");
type Usage = import("../supabase/functions/_shared/ai.ts").Usage;

// ---------------------------------------------------------------------------
// Peticiones de ejemplo: listas de tareas variadas, como las de un usuario real
// ---------------------------------------------------------------------------

type T = { title: string; category: string; priority: string; completed?: boolean };
const t = (title: string, category: string, priority: string, completed = false): T => ({ title, category, priority, completed });

const EJEMPLOS: T[][] = [
  [t("Terminar el reporte mensual", "Trabajo", "high"), t("Preparar la junta del lunes", "Trabajo", "high")],
  [t("Estudiar una hora", "Estudio", "medium"), t("Hacer ejercicios del módulo 4", "Estudio", "medium")],
  [t("Correr 5 km", "Salud", "low"), t("Sacar cita con el dentista", "Salud", "low")],
  [t("Pagar servicios del mes", "Personal", "high", true), t("Actualizar el currículum", "Personal", "medium")],
  [],
  [t("Mudarme de departamento", "Personal", "high"), t("Cotizar mudanza", "Personal", "medium")],
  [t("Lanzar la versión 2 de la app", "Trabajo", "high"), t("Escribir notas de la versión", "Trabajo", "medium"), t("Probar en Android", "Trabajo", "high")],
  [t("Leer 20 páginas", "Personal", "low"), t("Terminar el libro del club", "Personal", "medium")],
  [t("Organizar la fiesta de cumpleaños", "Personal", "medium"), t("Comprar regalo", "Personal", "high")],
  [t("Declaración anual de impuestos", "Personal", "high"), t("Juntar facturas", "Personal", "high")],
  [t("Aprender TypeScript", "Estudio", "medium"), t("Hacer un proyecto chico con React", "Estudio", "medium")],
  [t("Planear vacaciones", "Personal", "low"), t("Renovar pasaporte", "Personal", "high")],
  [t("Contratar a un diseñador", "Trabajo", "high"), t("Publicar la vacante", "Trabajo", "medium", true)],
  [t("Meditar 10 minutos", "Salud", "low"), t("Dormir antes de las 11", "Salud", "medium")],
  [t("Limpiar el garage", "Hogar", "low"), t("Arreglar la llave del baño", "Hogar", "medium")],
  [t("Preparar examen de estadística", "Estudio", "high"), t("Repasar regresión lineal", "Estudio", "high")],
  [t("Cerrar el trimestre contable", "Trabajo", "high", true), t("Revisar propuestas de proveedores", "Trabajo", "medium")],
  [t("Cocinar para la semana", "Hogar", "medium"), t("Hacer la lista del súper", "Hogar", "low")],
  [t("Escribir un post para el blog", "Trabajo", "low"), t("Grabar el video del tutorial", "Trabajo", "medium")],
  [t("Respaldar la computadora", "Personal", "medium", true), t("Cambiar contraseñas", "Personal", "high")],
];

// ---------------------------------------------------------------------------

const n = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 20);
const precioEntrada = Number(env.AI_PRICE_INPUT_PER_MTOK ?? NaN);
const precioSalida = Number(env.AI_PRICE_OUTPUT_PER_MTOK ?? NaN);

const cfg = readConfig();
if (!cfg) {
  console.error("No hay proveedor configurado. Define AI_PROVIDER (o revisa supabase/functions/.env).");
  process.exit(1);
}

console.log(`Proveedor: ${cfg.provider} · modelo: ${cfg.model} · ${cfg.baseUrl}`);

// Una petición de calentamiento que no cuenta: la primera carga el modelo en
// memoria (en Ollama puede tardar varios segundos) y ensuciaría el p95.
process.stdout.write("Calentando… ");
await chat(cfg, buildMessages(EJEMPLOS[0])).catch(() => {});
console.log("listo.\n");

type Resultado = Usage & { sugerencias: number; error?: string };
const resultados: Resultado[] = [];

for (let i = 0; i < n; i++) {
  let uso: Usage | undefined;
  let sugerencias = 0;
  let error: string | undefined;
  try {
    const texto = await chat(cfg, buildMessages(EJEMPLOS[i % EJEMPLOS.length]), { onUsage: (u) => void (uso = u) });
    sugerencias = parseSuggestions(texto).length;
  } catch (e) {
    error = (e as Error).message;
  }
  const r = { ...(uso as Usage), sugerencias, error };
  resultados.push(r);
  console.log(
    `${String(i + 1).padStart(3)}  ${String(r.durationMs).padStart(6)} ms  ` +
      `in ${r.inputTokens ?? "?"} / out ${r.outputTokens ?? "?"}  ` +
      (error ? `✗ ${error.slice(0, 80)}` : `✓ ${sugerencias} sugerencias`),
  );
}

// ---------------------------------------------------------------------------
// Estadísticas
// ---------------------------------------------------------------------------

/** Percentil por rango más cercano: el valor en la posición ⌈p·n⌉ de la lista ordenada. */
function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b);
  return orden[Math.max(0, Math.ceil(p * orden.length) - 1)];
}
const promedio = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

const ok = resultados.filter((r) => !r.error);
const tiempos = ok.map((r) => r.durationMs);
const entrada = ok.map((r) => r.inputTokens).filter((x): x is number => x !== null);
const salida = ok.map((r) => r.outputTokens).filter((x): x is number => x !== null);
const sugPromedio = promedio(ok.map((r) => r.sugerencias));

const fmtMs = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : "—");
const fmtTok = (v: number) => (Number.isFinite(v) ? v.toFixed(0) : "no reportado");

let costo = "sin precio configurado";
if (Number.isFinite(precioEntrada) && Number.isFinite(precioSalida) && entrada.length && salida.length) {
  const porPeticion = (promedio(entrada) * precioEntrada + promedio(salida) * precioSalida) / 1e6;
  costo = `US$${(porPeticion / sugPromedio).toFixed(6)} por sugerencia (US$${porPeticion.toFixed(6)} por petición de ~${sugPromedio.toFixed(1)})`;
}

const cpu = os.cpus()[0]?.model ?? "CPU desconocida";
const memoria = `${Math.round(os.totalmem() / 1024 ** 3)} GB`;
const fecha = new Date().toISOString().slice(0, 10);

console.log(`
Resumen (${ok.length}/${resultados.length} exitosas)
  Tiempo mediano   ${fmtMs(percentil(tiempos, 0.5))}
  Tiempo p95       ${fmtMs(percentil(tiempos, 0.95))}
  Tokens entrada   ${fmtTok(promedio(entrada))} promedio
  Tokens salida    ${fmtTok(promedio(salida))} promedio
  Costo            ${costo}

Para el README:

| Modelo | Proveedor | Máquina | Peticiones | Mediana | p95 | Tokens entrada (prom.) | Tokens salida (prom.) | Costo por sugerencia |
|---|---|---|---|---|---|---|---|---|
| \`${cfg.model}\` | ${cfg.provider} | ${cpu}, ${memoria} RAM, ${os.platform()} | ${ok.length}/${resultados.length} | ${fmtMs(percentil(tiempos, 0.5))} | ${fmtMs(percentil(tiempos, 0.95))} | ${fmtTok(promedio(entrada))} | ${fmtTok(promedio(salida))} | ${costo.startsWith("US$") ? costo.split(" ")[0] : "—"} |

Medido el ${fecha} con \`npm run medir-ia\`.`);

if (ok.length === 0) process.exit(1);
