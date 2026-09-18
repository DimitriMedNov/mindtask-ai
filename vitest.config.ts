import { defineConfig } from "vitest/config";

// Dos grupos de pruebas:
//   unit — rápidas, sin red ni base de datos: la capa de IA y el parseo (npm test)
//   db   — contra el Supabase local de `supabase start`: políticas de RLS (npm run test:db)
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup-deno.ts"],
        },
      },
      {
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
