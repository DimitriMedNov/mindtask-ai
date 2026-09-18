/**
 * Las Edge Functions leen su configuración con Deno.env.get. En Node no existe
 * Deno, así que las pruebas usan este sustituto: un mapa que cada prueba llena
 * con setEnv() y que se vacía antes de cada una.
 */
import { beforeEach } from "vitest";

const vars = new Map<string, string>();

(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: (clave: string) => vars.get(clave) },
};

export function setEnv(valores: Record<string, string>) {
  for (const [k, v] of Object.entries(valores)) vars.set(k, v);
}

beforeEach(() => vars.clear());
