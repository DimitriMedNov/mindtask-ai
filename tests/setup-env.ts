/**
 * La capa de IA lee su configuración con leerVariable(), que en la app consulta
 * las variables de Vite. En las pruebas no hay Vite, así que se usan las del
 * proceso: cada prueba llena las suyas con setEnv() y se vacían antes de cada
 * una, para que ninguna herede la configuración de la anterior.
 */
import { beforeEach } from "vitest";

const puestas = new Set<string>();

export function setEnv(valores: Record<string, string>) {
  for (const [clave, valor] of Object.entries(valores)) {
    process.env[clave] = valor;
    puestas.add(clave);
  }
}

beforeEach(() => {
  for (const clave of puestas) delete process.env[clave];
  puestas.clear();
});
