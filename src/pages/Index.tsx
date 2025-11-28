import { useState } from "react";
import { TaskCard, type Task } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { TaskStats } from "@/components/TaskStats";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ListChecks } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Diseñar interfaz de usuario",
      description: "Crear mockups para la aplicación de gestión de tareas",
      completed: false,
      priority: "high",
      category: "Trabajo",
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Configurar base de datos",
      description: "Preparar MongoDB para almacenar las tareas",
      completed: true,
      priority: "medium",
      category: "Trabajo",
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      id: "3",
      title: "Revisar documentación",
      description: "Leer la documentación de React Native",
      completed: false,
      priority: "low",
      category: "Personal",
      createdAt: new Date(Date.now() - 172800000),
    },
  ]);

  const addTask = (taskData: Omit<Task, "id" | "createdAt">) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setTasks([newTask, ...tasks]);
    toast.success("Tarea creada exitosamente", {
      description: `"${newTask.title}" ha sido añadida a tu lista.`,
    });
  };

  const toggleTask = (id: string) => {
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          const newCompleted = !task.completed;
          toast.success(
            newCompleted ? "¡Tarea completada! 🎉" : "Tarea marcada como pendiente",
            {
              description: newCompleted
                ? `¡Excelente trabajo con "${task.title}"!`
                : `"${task.title}" vuelve a estar pendiente.`,
            }
          );
          return { ...task, completed: newCompleted };
        }
        return task;
      })
    );
  };

  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    setTasks(tasks.filter((task) => task.id !== id));
    toast.success("Tarea eliminada", {
      description: task ? `"${task.title}" ha sido eliminada.` : "La tarea ha sido eliminada.",
    });
  };

  const activeTasks = tasks.filter((task) => !task.completed);
  const completedTasks = tasks.filter((task) => task.completed);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Gestión de Tareas
              </h1>
              <p className="text-muted-foreground mt-2">
                Organiza y gestiona tus tareas de manera eficiente
              </p>
            </div>
            <AddTaskDialog onAddTask={addTask} />
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <TaskStats tasks={tasks} />
        </div>

        {/* Task List */}
        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Todas
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Activas
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completadas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No hay tareas. ¡Crea tu primera tarea!</p>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  ¡Genial! No tienes tareas pendientes.
                </p>
              </div>
            ) : (
              activeTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Aún no has completado ninguna tarea.
                </p>
              </div>
            ) : (
              completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
