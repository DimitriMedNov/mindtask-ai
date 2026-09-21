import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
// PGlite trae su propio WebAssembly: si Vite lo pre-empaqueta, el archivo del
// sistema de archivos llega truncado y Postgres no arranca.
const EXCLUIR_DEL_PREEMPAQUETADO = ["@electric-sql/pglite"];

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  optimizeDeps: { exclude: EXCLUIR_DEL_PREEMPAQUETADO },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
