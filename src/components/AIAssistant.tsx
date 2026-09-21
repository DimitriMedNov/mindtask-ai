import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { chat, readConfig, usageRecorder } from "@/lib/ia";
import { buildMessages, parseSuggestions } from "@/lib/sugerencias";
import { toast } from "sonner";
import { describeAIError, showAIErrorToast } from "@/lib/aiErrors";
import { AIError } from "@/lib/ia";
import type { Task } from "./TaskCard";

interface AIAssistantProps {
  tasks: Task[];
  onSuggest: (suggestions: Omit<Task, "id" | "createdAt" | "completed">[]) => void;
  /** Avisa al dashboard para que abra el espacio de las sugerencias mientras llegan. */
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Botón de sugerencias. Antes era una tarjeta del mismo tamaño que el temporizador,
 * compitiendo por atención sin ser la acción principal; ahora vive junto a la lista
 * de tareas, que es donde tiene sentido pedirlas.
 */
export const AIAssistant = ({ tasks, onSuggest, onLoadingChange }: AIAssistantProps) => {
  const [loading, setLoading] = useState(false);

  const cambiarCarga = (valor: boolean) => {
    setLoading(valor);
    onLoadingChange?.(valor);
  };

  const getSuggestions = async () => {
    cambiarCarga(true);
    try {
      const cfg = readConfig();
      if (!cfg) throw new AIError("La IA no está configurada. Define VITE_AI_PROVIDER y su modelo.", 503);

      const texto = await chat(cfg, buildMessages(tasks), { onUsage: usageRecorder("sugerencias") });
      const suggestions = parseSuggestions(texto);

      if (suggestions.length > 0) {
        onSuggest(suggestions.map((s: { title: string; priority: Task["priority"]; category: string }) => ({
          ...s,
          description: s.description || `Sugerencia basada en tus tareas actuales`
        })));
        toast.success("Listas tus sugerencias", {
          description: `${suggestions.length} ideas, con ${cfg.model}`,
        });
      }
    } catch (error) {
      showAIErrorToast(describeAIError(error));
    } finally {
      cambiarCarga(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={getSuggestions}
      disabled={loading || tasks.length === 0}
      title={tasks.length === 0 ? "Crea una tarea primero" : "Sugerir tareas con IA"}
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Pensando…
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Sugerir
        </>
      )}
    </Button>
  );
};
