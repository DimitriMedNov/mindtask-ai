/**
 * Mide qué tan bien el intérprete entiende una frase dictada o escrita.
 *
 *   npm run medir-interprete
 *   npm run medir-interprete -- --fallos    # además, lista caso por caso lo que falló
 *
 * Corre los casos de evals/frases.json contra src/lib/dictado.ts y reporta el
 * acierto por campo. No llama a ningún modelo ni a la red: el intérprete es
 * código, no IA, así que la medición es determinista y sirve como línea base
 * para comparar contra un modelo el día que valga la pena cambiarlo.
 *
 * Los casos dicen qué DEBERÍA entenderse, no lo que el código hace hoy. Un
 * número menor a 100% no es un error del script: es la deuda pendiente.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { interpretarDictado } from "../src/lib/dictado";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, "..");

type Caso = {
  frase: string;
  titulo: string;
  dias: number | null;
  prioridad: "low" | "medium" | "high";
  categoria: string;
};

/** Un martes, para que "el viernes" y "la próxima semana" caigan en días claros. */
const HOY = new Date(2026, 8, 15);

const { casos } = JSON.parse(
  readFileSync(path.join(raiz, "evals", "frases.json"), "utf8"),
) as { casos: Caso[] };

const campos = ["titulo", "fecha", "prioridad", "categoria"] as const;
type Campo = (typeof campos)[number];

const aciertos: Record<Campo, number> = { titulo: 0, fecha: 0, prioridad: 0, categoria: 0 };
const fallos: Array<{ frase: string; campo: Campo; esperado: string; obtenido: string }> = [];
let completos = 0;

for (const caso of casos) {
  const leido = interpretarDictado(caso.frase, HOY);
  const dias = leido.dueDate ? differenceInCalendarDays(startOfDay(leido.dueDate), startOfDay(HOY)) : null;

  const comparaciones: Array<[Campo, string, string]> = [
    ["titulo", caso.titulo, leido.title],
    ["fecha", String(caso.dias), String(dias)],
    ["prioridad", caso.prioridad, leido.priority],
    ["categoria", caso.categoria, leido.category],
  ];

  let todoBien = true;
  for (const [campo, esperado, obtenido] of comparaciones) {
    if (esperado === obtenido) {
      aciertos[campo]++;
    } else {
      todoBien = false;
      fallos.push({ frase: caso.frase, campo, esperado, obtenido });
    }
  }
  if (todoBien) completos++;
}

const total = casos.length;
const pct = (n: number) => `${((n / total) * 100).toFixed(0)}%`;

console.log(`\nIntérprete de frases · ${total} casos\n`);
console.log("  Campo        Acierto");
console.log("  ─────────────────────");
for (const campo of campos) {
  const nombre = campo === "titulo" ? "Título" : campo === "fecha" ? "Fecha" : campo === "prioridad" ? "Prioridad" : "Categoría";
  console.log(`  ${nombre.padEnd(12)} ${pct(aciertos[campo]).padStart(4)}  (${aciertos[campo]}/${total})`);
}
console.log("  ─────────────────────");
console.log(`  ${"Los cuatro".padEnd(12)} ${pct(completos).padStart(4)}  (${completos}/${total})\n`);

if (process.argv.includes("--fallos") && fallos.length > 0) {
  console.log("Lo que falló:\n");
  for (const f of fallos) {
    console.log(`  "${f.frase}"`);
    console.log(`     ${f.campo}: esperaba «${f.esperado}», entendió «${f.obtenido}»\n`);
  }
}

// Un caso que empeora debe notarse en CI, no en la siguiente demo.
const minimo = Number(process.env.MINIMO_ACIERTO ?? 0);
if (minimo > 0 && completos / total < minimo) {
  console.error(`El acierto completo (${pct(completos)}) quedó debajo del mínimo exigido (${minimo * 100}%).`);
  process.exit(1);
}
