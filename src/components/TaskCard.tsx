import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Trash2, CalendarClock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorVencimiento, describirVencimiento } from "@/lib/fechas";
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
};

/** Una raya de color a la izquierda pesa menos que una insignia y se lee igual de rápido. */
const franjaPrioridad = {
  low: "bg-transparent",
  medium: "bg-accent",
  high: "bg-destructive",
};

const etiquetaPrioridad = {
  low: "Prioridad baja",
  medium: "Prioridad media",
  high: "Prioridad alta",
};

export function TaskCard({ task, onToggle, onDelete, onEdit, onEnfocar, enfocada }: TaskCardProps) {
  const [borrando, setBorrando] = useState(false);

  const handleDelete = () => {
    setBorrando(true);
    setTimeout(() => onDelete(task.id), 200);
  };

  const vencimiento = task.dueDate ? describirVencimiento(new Date(task.dueDate)) : null;

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 bg-card py-3 pl-5 pr-3 transition-colors duration-150",
        "hover:bg-muted/40",
        enfocada && "bg-primary/5",
        borrando && "opacity-0",
        task.completed && "opacity-60",
      )}
    >
      {/* La franja de prioridad sustituye a la insignia: mismo dato, menos ruido */}
      <span
        aria-hidden="true"
        className={cn("absolute inset-y-2.5 left-0 w-[3px] rounded-r-full", franjaPrioridad[task.priority])}
      />

      <Checkbox
        checked={task.completed}
        onCheckedChange={() => onToggle(task.id)}
        aria-label={task.completed ? `Reabrir ${task.title}` : `Completar ${task.title}`}
        className="mt-0.5 data-[state=checked]:border-success data-[state=checked]:bg-success"
      />

      <div className="min-w-0 flex-1">
        <h3
          className={cn(
            "text-callout font-medium text-foreground",
            task.completed && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </h3>

        {task.description && (
          <p className="mt-0.5 truncate text-footnote text-muted-foreground">{task.description}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <span className="sr-only">{etiquetaPrioridad[task.priority]}</span>
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-secondary-foreground">
            {task.category}
          </span>
          {vencimiento && !task.completed && (
            <span className={cn("inline-flex items-center gap-1", colorVencimiento[vencimiento.estado])}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {vencimiento.texto}
            </span>
          )}
        </div>
      </div>

      {/* Acciones pegadas al texto, no al otro extremo de la pantalla */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
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
  );
}
