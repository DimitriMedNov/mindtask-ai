import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addDays, differenceInDays, isPast, isFuture } from "date-fns";
import { es } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
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

  // Get upcoming tasks (next 7 days)
  const getUpcomingTasks = () => {
    const today = new Date();
    const nextWeek = addDays(today, 7);
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const dueDate = new Date(task.dueDate);
      return !task.completed && isFuture(dueDate) && differenceInDays(dueDate, today) <= 7;
    }).sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  };

  // Get overdue tasks
  const getOverdueTasks = () => {
    const today = new Date();
    return tasks.filter(task => {
      if (!task.dueDate || task.completed) return false;
      return isPast(new Date(task.dueDate)) && !isSameDay(new Date(task.dueDate), today);
    });
  };

  // Get week stats
  const getWeekStats = () => {
    const weekStart = startOfWeek(currentDate, { locale: es });
    const weekEnd = endOfWeek(currentDate, { locale: es });
    
    const weekTasks = tasks.filter(task => {
      if (task.startDate) {
        const start = new Date(task.startDate);
        if (isWithinInterval(start, { start: weekStart, end: weekEnd })) return true;
      }
      if (task.dueDate) {
        const due = new Date(task.dueDate);
        if (isWithinInterval(due, { start: weekStart, end: weekEnd })) return true;
      }
      return false;
    });

    const completed = weekTasks.filter(t => t.completed).length;
    const total = weekTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  };

  const upcomingTasks = getUpcomingTasks();
  const overdueTasks = getOverdueTasks();
  const weekStats = getWeekStats();

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
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Calendar */}
      <Card className="lg:col-span-3 p-6">
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

      {/* Right sidebar with multiple panels */}
      <div className="lg:col-span-2 space-y-6">
        {/* Week Progress */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Progreso Semanal</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Completadas</span>
              <span className="font-semibold">{weekStats.completed} / {weekStats.total}</span>
            </div>
            <Progress value={weekStats.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {weekStats.percentage}% de tareas completadas esta semana
            </p>
          </div>
        </Card>

        {/* Overdue Tasks */}
        {overdueTasks.length > 0 && (
          <Card className="p-6 border-destructive/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h3 className="text-lg font-semibold text-destructive">Tareas Vencidas</h3>
            </div>
            <div className="space-y-2">
              {overdueTasks.slice(0, 3).map(task => (
                <div key={task.id} className="p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-sm font-medium line-clamp-1">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Venció: {format(new Date(task.dueDate), "d MMM", { locale: es })}
                    </p>
                  )}
                </div>
              ))}
              {overdueTasks.length > 3 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  +{overdueTasks.length - 3} tareas más vencidas
                </p>
              )}
            </div>
          </Card>
        )}

        {/* Upcoming Tasks */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Próximas (7 días)</h3>
          </div>
          {upcomingTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay tareas próximas
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingTasks.slice(0, 5).map(task => {
                const daysUntil = task.dueDate ? differenceInDays(new Date(task.dueDate), new Date()) : 0;
                return (
                  <div key={task.id} className="p-2 rounded-lg bg-muted/50 border">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-1 flex-1">{task.title}</p>
                      <Badge variant={daysUntil <= 2 ? "destructive" : "secondary"} className="text-xs shrink-0">
                        {daysUntil === 0 ? "Hoy" : daysUntil === 1 ? "Mañana" : `${daysUntil}d`}
                      </Badge>
                    </div>
                    {task.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(task.dueDate), "d 'de' MMMM", { locale: es })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
    </div>
  );
};
