import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { describeAIError, showAIErrorToast } from "@/lib/aiErrors";
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
      const { data, error } = await supabase.functions.invoke('ai-task-suggestions', {
        body: { userTasks: tasks }
      });

      if (error) throw error;

      if (data.suggestions && data.suggestions.length > 0) {
        onSuggest(data.suggestions.map((s: any) => ({
          ...s,
          description: s.description || `Sugerencia basada en tus tareas actuales`
        })));
        toast.success("¡Sugerencias generadas!", {
          description: `Revisa ${data.suggestions.length} sugerencias de IA`
        });
      }
    } catch (error) {
      showAIErrorToast(await describeAIError(error));
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
