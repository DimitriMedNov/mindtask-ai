import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";

export type AIErrorKind = "not_configured" | "rate_limited" | "model_failure";

export interface AIErrorInfo {
  kind: AIErrorKind;
  /** Título corto para el toast, según el caso. */
  title: string;
  /** El mensaje real que devolvió la función, o uno de respaldo si no hubo cuerpo. */
  message: string;
}

const TITULOS: Record<AIErrorKind, string> = {
  not_configured: "La IA no está configurada",
  rate_limited: "Llegaste al límite de uso",
  model_failure: "El modelo no pudo responder",
};

/**
 * Traduce el error de supabase.functions.invoke a algo que se le pueda mostrar
 * al usuario. invoke() solo dice "Edge Function returned a non-2xx status
 * code"; el mensaje útil viene en el cuerpo de la respuesta.
 */
export async function describeAIError(error: unknown): Promise<AIErrorInfo> {
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    let body: { error?: string; hint?: string } = {};
    try {
      body = await res.clone().json();
    } catch {
      // Sin cuerpo JSON: nos quedamos con el mensaje de respaldo
    }

    const kind: AIErrorKind =
      res.status === 503 ? "not_configured" : res.status === 429 ? "rate_limited" : "model_failure";
    const message = [body.error, body.hint].filter(Boolean).join(" ") || `La función respondió ${res.status}.`;
    return { kind, title: TITULOS[kind], message };
  }

  const message = error instanceof Error ? error.message : "Error desconocido";
  return { kind: "model_failure", title: TITULOS.model_failure, message };
}

/** Toast distinto para cada caso: aviso si falta configurar, advertencia en el límite, error si falló el modelo. */
export function showAIErrorToast({ kind, title, message }: AIErrorInfo) {
  const mostrar = kind === "not_configured" ? toast.info : kind === "rate_limited" ? toast.warning : toast.error;
  mostrar(title, { description: message, duration: kind === "model_failure" ? 6000 : 8000 });
}
