import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Un solo grupo de pruebas, rápido y sin dependencias externas.
 *
 * Antes había dos: uno unitario y otro contra el Postgres de Docker, para las
 * políticas por usuario. Ese segundo desapareció con Supabase: ahora la base
 * vive en la máquina de cada quien y quien la protege es el sistema operativo,
 * no una política SQL.
 */
export default defineConfig({
  // El .env de la app no debe llegar a las pruebas: si llega, "sin proveedor
  // configurado" deja de poder probarse. Aquí se apunta a una carpeta sin .env.
  envDir: path.resolve(__dirname, "tests"),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup-env.ts"],
  },
});
