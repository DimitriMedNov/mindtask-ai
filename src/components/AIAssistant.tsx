import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Task } from "./TaskCard";

interface AIAssistantProps {
  tasks: Task[];
  onAddTasks: (tasks: Omit<Task, "id" | "createdAt">[]) => void;
}

export const AIAssistant = ({ tasks, onAddTasks }: AIAssistantProps) => {
  const [loading, setLoading] = useState(false);

  const getSuggestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-task-suggestions', {
        body: { userTasks: tasks }
      });

      if (error) throw error;

      if (data.suggestions && data.suggestions.length > 0) {
        onAddTasks(data.suggestions.map((s: any) => ({
          ...s,
          completed: false,
          description: `Sugerido por IA basado en tus tareas actuales`
        })));
        toast.success("¡Sugerencias de IA añadidas!", {
          description: `Se agregaron ${data.suggestions.length} tareas sugeridas`
        });
      }
    } catch (error: any) {
      toast.error("Error al obtener sugerencias", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Asistente IA
        </CardTitle>
        <CardDescription>
          Obtén sugerencias inteligentes basadas en tus tareas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={getSuggestions}
          disabled={loading || tasks.length === 0}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando sugerencias...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generar Sugerencias
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};