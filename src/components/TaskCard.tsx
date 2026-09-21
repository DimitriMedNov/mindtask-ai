import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Timer, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { describirVencimiento } from "@/lib/fechas";
import { EditTaskDialog } from "./EditTaskDialog";

export type Task = {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  category: string;
  createdAt: Date;
  startDate?: Date;
  dueDate?: Date;
};

type TaskCardProps = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: Partial<Task>) => void;
  /** Empieza un bloque de enfoque con esta tarea. */
  onEnfocar?: () => void;
  enfocada?: boolean;
  /** Tiempo restante del bloque, para mostrarlo en la fila enfocada. */
  tiempoEnfoque?: string;
};

/**
 * Un renglón del registro.
 *
 * La línea de abajo junta descripción, categoría y prioridad separadas por
 * puntos medios, como en el mockup: una frase corrida en vez de tres insignias
 * de colores compitiendo. La prioridad alta es lo único que se pinta, porque es
 * lo único que cambia una decisión. A la derecha vive el estado —cuándo vence,
 * o el tiempo si está enfocada— y cede su lugar a las acciones al acercar el
 * cursor, así la fila está tranquila mientras se lee.
 */
export function TaskCard({
  task,
  onToggle,
  onDelete,
  onEdit,
  onEnfocar,
  enfocada,
  tiempoEnfoque,
}: TaskCardProps) {
  const [borrando, setBorrando] = useState(false);

  const handleDelete = () => {
    setBorrando(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  const vencimiento = task.dueDate ? describirVencimiento(new Date(task.dueDate)) : null;
  const vencida = vencimiento?.estado === "vencida" && !task.completed;
  const detalle = [task.description, task.category].filter(Boolean).join(" · ");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 transition-colors duration-150",
        enfocada ? "bg-primary/[0.07]" : "hover:bg-muted/50",
        borrando && "opacity-0",
        task.completed && "opacity-55",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={task.completed ? `Reabrir ${task.title}` : `Completar ${task.title}`}
        className={cn(
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border transition-colors",
          task.completed
            ? "border-success bg-success text-success-foreground"
            : enfocada
              ? "border-primary"
              : "border-muted-foreground/40 hover:border-primary",
        )}
      >
        {task.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        {enfocada && !task.completed && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" strokeWidth={2.5} />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-callout font-semibold",
            enfocada ? "text-primary" : "text-foreground",
            task.completed && "font-medium text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="truncate text-footnote text-muted-foreground">
          {detalle}
          {task.priority === "high" && !task.completed && (
            <>
              {detalle && " · "}
              <span className="font-medium text-destructive">Alta</span>
            </>
          )}
        </p>
      </div>

      <div className="relative flex shrink-0 items-center">
        <span
          className={cn(
            "text-footnote transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0",
            enfocada ? "font-medium text-primary" : "text-muted-foreground",
          )}
        >
          {enfocada && tiempoEnfoque ? (
            `Enfocada · ${tiempoEnfoque}`
          ) : vencida ? (
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
              {vencimiento?.texto}
            </span>
          ) : (
            (!task.completed && vencimiento?.texto) || null
          )}
        </span>

        <div className="absolute right-0 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
          {onEnfocar && !task.completed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onEnfocar}
              aria-label={`Enfocarme en ${task.title}`}
              title="Trabajar en esto 25 minutos"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <Timer className="h-4 w-4" />
            </Button>
          )}
          {onEdit && <EditTaskDialog task={task} onEditTask={onEdit} />}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            aria-label={`Eliminar ${task.title}`}
            className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
