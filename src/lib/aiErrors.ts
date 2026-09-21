import { toast } from "sonner";
import { AIError, TIMEOUT_MESSAGE } from "./ia";

export type AIErrorKind = "not_configured" | "slow_model" | "model_failure";

export interface AIErrorInfo {
  kind: AIErrorKind;
  /** Título corto para el toast, según el caso. */
  title: string;
  /** El mensaje real del error, o uno de respaldo. */
  message: string;
}

const TITULOS: Record<AIErrorKind, string> = {
  not_configured: "La IA no está configurada",
  slow_model: "El modelo tardó demasiado",
  model_failure: "El modelo no pudo responder",
};

/**
 * Traduce un error de la capa de IA a algo que se le pueda decir al usuario.
 *
 * Los tres casos que se distinguen son los tres que tienen salidas distintas:
 * falta configurar un proveedor (503), el modelo se tardó más de la cuenta
 * (504) —lo normal con un modelo local en una laptop— o el proveedor falló
 * (todo lo demás).
 */
export function describeAIError(error: unknown): AIErrorInfo {
  if (error instanceof AIError) {
    const kind: AIErrorKind =
      error.status === 503 || error.status === 501
        ? "not_configured"
        : error.status === 504 || error.message.includes(TIMEOUT_MESSAGE)
          ? "slow_model"
          : "model_failure";
    return { kind, title: TITULOS[kind], message: error.message };
  }

  const message = error instanceof Error ? error.message : "Error desconocido";
  const kind: AIErrorKind = message.includes(TIMEOUT_MESSAGE) ? "slow_model" : "model_failure";
  return { kind, title: TITULOS[kind], message };
}

export function showAIErrorToast(info: AIErrorInfo) {
  toast.error(info.title, { description: info.message });
}
