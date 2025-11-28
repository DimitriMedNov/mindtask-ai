import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import type { Task } from "./TaskCard";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: Partial<Task>) => void;
}

export const CalendarView = ({ tasks, onToggle, onDelete, onEdit }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Get tasks for selected date
  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      // Task has start date on this day
      if (task.startDate && isSameDay(new Date(task.startDate), date)) {
        return true;
      }
      // Task has due date on this day
      if (task.dueDate && isSameDay(new Date(task.dueDate), date)) {
        return true;
      }
      // Task is in progress (between start and due date)
      if (task.startDate && task.dueDate) {
        const start = new Date(task.startDate);
        const end = new Date(task.dueDate);
        return isWithinInterval(date, { start, end });
      }
      return false;
    });
  };

  const selectedDateTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  // Get task count for each day to show indicators
  const getTaskCountForDate = (date: Date) => {
    return getTasksForDate(date).length;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-2 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">
            {format(currentDate, "MMMM yyyy", { locale: es })}
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          month={currentDate}
          onMonthChange={setCurrentDate}
          locale={es}
          className={cn("pointer-events-auto")}
          components={{
            Day: ({ date, ...props }) => {
              const taskCount = getTaskCountForDate(date);
              const tasksForDay = getTasksForDate(date);
              const hasStartDate = tasksForDay.some(t => t.startDate && isSameDay(new Date(t.startDate), date));
              const hasDueDate = tasksForDay.some(t => t.dueDate && isSameDay(new Date(t.dueDate), date));
              
              return (
                <div className="relative w-full h-full">
                  <button
                    {...props}
                    className={cn(
                      "w-full h-full p-2 text-sm relative hover:bg-accent rounded-md transition-colors",
                      isSameDay(date, selectedDate || new Date()) && "bg-primary text-primary-foreground hover:bg-primary/90",
                      isSameDay(date, new Date()) && !isSameDay(date, selectedDate || new Date()) && "border border-primary"
                    )}
                  >
                    <span>{format(date, "d")}</span>
                    {taskCount > 0 && (
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                        {hasStartDate && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {hasDueDate && (
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                        )}
                        {!hasStartDate && !hasDueDate && taskCount > 0 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            }
          }}
        />
      </Card>

      {/* Task list for selected date */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarIcon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">
            {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : "Selecciona un día"}
          </h3>
        </div>

        {selectedDateTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay tareas para este día
          </p>
        ) : (
          <div className="space-y-3">
            {selectedDateTasks.map(task => {
              const isStartDate = task.startDate && selectedDate && isSameDay(new Date(task.startDate), selectedDate);
              const isDueDate = task.dueDate && selectedDate && isSameDay(new Date(task.dueDate), selectedDate);
              
              return (
                <div
                  key={task.id}
                  className={cn(
                    "p-3 rounded-lg border transition-all",
                    task.completed && "opacity-60"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => onToggle(task.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-medium text-sm",
                        task.completed && "line-through"
                      )}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge
                          variant={
                            task.priority === "high" ? "destructive" :
                            task.priority === "medium" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {task.priority === "high" ? "Alta" :
                           task.priority === "medium" ? "Media" : "Baja"}
                        </Badge>
                        {isStartDate && (
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                            Inicio
                          </Badge>
                        )}
                        {isDueDate && (
                          <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                            Vence
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedDateTasks.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total: {selectedDateTasks.length} tarea{selectedDateTasks.length !== 1 ? 's' : ''}</span>
              <span>
                {selectedDateTasks.filter(t => t.completed).length} completada{selectedDateTasks.filter(t => t.completed).length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
