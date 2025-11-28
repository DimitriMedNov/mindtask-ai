import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock, Calendar, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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
};

const priorityColors = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/10 text-accent border-accent/20",
  high: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityLabels = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export function TaskCard({ task, onToggle, onDelete, onEdit }: TaskCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => onDelete(task.id), 300);
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all duration-300 hover:shadow-lg border-border/50",
        "bg-card backdrop-blur-sm",
        isDeleting && "opacity-0 scale-95",
        task.completed && "opacity-60"
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          className="mt-1 data-[state=checked]:bg-success data-[state=checked]:border-success"
        />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "font-semibold text-foreground transition-all",
                task.completed && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </h3>
            <div className="flex gap-1">
              {onEdit && <EditTaskDialog task={task} onEditTask={onEdit} />}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={priorityColors[task.priority]}>
              {priorityLabels[task.priority]}
            </Badge>
            <Badge variant="secondary" className="font-medium">
              {task.category}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{format(task.createdAt, "d MMM", { locale: es })}</span>
            </div>
            {task.startDate && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-blue-500" />
                <span>Inicio: {format(new Date(task.startDate), "d MMM", { locale: es })}</span>
              </div>
            )}
            {task.dueDate && (
              <div className="flex items-center gap-1">
                <CalendarClock className="h-3 w-3 text-orange-500" />
                <span>Límite: {format(new Date(task.dueDate), "d MMM", { locale: es })}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
