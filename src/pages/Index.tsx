import { useState, useEffect } from "react";
import { TaskCard, type Task } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { TaskStats } from "@/components/TaskStats";
import { Auth } from "@/components/Auth";
import { AIAssistant } from "@/components/AIAssistant";
import { AISuggestions } from "@/components/AISuggestions";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { GamificationPanel } from "@/components/GamificationPanel";
import { VoiceCommands } from "@/components/VoiceCommands";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ListChecks, LogOut, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
const Index = () => {
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [showAdminView, setShowAdminView] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    title: string;
    description?: string;
    priority: "low" | "medium" | "high";
    category: string;
    startDate?: Date;
    dueDate?: Date;
    completed: false;
  }>>([]);
  useEffect(() => {
    // Check auth status
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (user) {
      loadTasks();
      loadUserRole();
    }
  }, [user]);
  const loadUserRole = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      setUserRole(data?.role || 'user');
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('user');
    }
  };
  const loadTasks = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setTasks(data.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        completed: task.completed,
        priority: task.priority as "high" | "medium" | "low",
        category: task.category,
        createdAt: new Date(task.created_at),
        startDate: task.start_date ? new Date(task.start_date) : undefined,
        dueDate: task.due_date ? new Date(task.due_date) : undefined,
      })));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };
  const addTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    try {
      const {
        data,
        error
      } = await supabase.from('tasks').insert({
        user_id: user.id,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        category: taskData.category,
        completed: taskData.completed
      }).select().single();
      if (error) throw error;
      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        completed: data.completed,
        priority: data.priority as "high" | "medium" | "low",
        category: data.category,
        createdAt: new Date(data.created_at),
        startDate: data.start_date ? new Date(data.start_date) : undefined,
        dueDate: data.due_date ? new Date(data.due_date) : undefined,
      };
      setTasks([newTask, ...tasks]);
      await updateUserStats('add');
      toast.success("Tarea creada exitosamente", {
        description: `"${newTask.title}" ha sido añadida a tu lista.`
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast.error("Error al crear tarea");
    }
  };
  const addMultipleTasks = async (tasksData: Omit<Task, "id" | "createdAt">[]) => {
    for (const taskData of tasksData) {
      await addTask(taskData);
    }
  };

  const editTask = async (id: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase.from('tasks').update({
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        category: updates.category,
        start_date: updates.startDate?.toISOString().split('T')[0],
        due_date: updates.dueDate?.toISOString().split('T')[0],
      }).eq('id', id);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success("Tarea actualizada", {
        description: "Los cambios se han guardado exitosamente"
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error("Error al actualizar tarea");
    }
  };
  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      const newCompleted = !task.completed;
      const {
        error
      } = await supabase.from('tasks').update({
        completed: newCompleted
      }).eq('id', id);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === id ? {
        ...t,
        completed: newCompleted
      } : t));
      if (newCompleted) {
        await updateUserStats('complete');
      }
      toast.success(newCompleted ? "¡Tarea completada! 🎉" : "Tarea marcada como pendiente", {
        description: newCompleted ? `¡Excelente trabajo con "${task.title}"! +10 puntos` : `"${task.title}" vuelve a estar pendiente.`
      });
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error("Error al actualizar tarea");
    }
  };
  const deleteTask = async (id: string) => {
    try {
      const task = tasks.find(t => t.id === id);
      const {
        error
      } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
      setTasks(tasks.filter(t => t.id !== id));
      toast.success("Tarea eliminada", {
        description: task ? `"${task.title}" ha sido eliminada.` : "La tarea ha sido eliminada."
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error("Error al eliminar tarea");
    }
  };
  const updateUserStats = async (action: 'add' | 'complete') => {
    try {
      const {
        data: stats
      } = await supabase.from('user_stats').select('*').eq('user_id', user.id).maybeSingle();
      if (stats) {
        const updates: any = {};
        if (action === 'complete') {
          updates.tasks_completed = (stats.tasks_completed || 0) + 1;
          updates.points = (stats.points || 0) + 10;

          // Level up logic
          const newLevel = Math.floor(updates.points / 100) + 1;
          if (newLevel > stats.level) {
            updates.level = newLevel;
            toast.success("¡Subiste de nivel!", {
              description: `Ahora eres nivel ${newLevel}! 🎊`
            });
          }
        }
        await supabase.from('user_stats').update(updates).eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  };
  const handleVoiceCommand = (text: string) => {
    // Simple parsing: extract task title from voice command
    const lowerText = text.toLowerCase();
    if (lowerText.includes('crear tarea') || lowerText.includes('nueva tarea')) {
      const taskTitle = text.replace(/crear tarea/gi, '').replace(/nueva tarea/gi, '').trim();
      if (taskTitle) {
        addTask({
          title: taskTitle,
          description: "Creada por comando de voz",
          completed: false,
          priority: "medium",
          category: "Personal"
        });
      }
    }
  };

  const handleAISuggestions = (suggestions: Omit<Task, "id" | "createdAt" | "completed">[]) => {
    setAiSuggestions(suggestions.map(s => ({ ...s, completed: false as const })));
  };

  const handleAcceptSuggestion = (suggestion: { title: string; description?: string; priority: "low" | "medium" | "high"; category: string; startDate?: Date; dueDate?: Date; completed: false }) => {
    addTask({ ...suggestion });
    setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
  };

  const handleRejectSuggestion = (index: number) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearSuggestions = () => {
    setAiSuggestions([]);
  };
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>;
  }
  if (!user) {
    return <Auth />;
  }
  const activeTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);
  return <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-primary">
                  Gestión de Tareas Pro
                </h1>
                {userRole === 'admin' && <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium flex items-center gap-1">
                    <Shield className="h-4 w-4" />
                    Admin
                  </span>}
              </div>
              <p className="text-muted-foreground mt-2">
                Con IA, Pomodoro, Gamificación y Comandos de Voz
              </p>
            </div>
            <div className="flex gap-2">
              {userRole === 'admin' && <Button variant={showAdminView ? "default" : "outline"} onClick={() => setShowAdminView(!showAdminView)}>
                  <Shield className="h-4 w-4 mr-2" />
                  {showAdminView ? "Vista Usuario" : "Vista Admin"}
                </Button>}
              <AddTaskDialog onAddTask={addTask} />
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>

        {/* Admin Dashboard or Regular View */}
        {userRole === 'admin' && showAdminView ? <AdminDashboard /> : <>
            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <AIAssistant tasks={tasks} onSuggest={handleAISuggestions} />
              <PomodoroTimer />
              <GamificationPanel />
              <VoiceCommands onVoiceCommand={handleVoiceCommand} />
            </div>

            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="mb-8">
                <AISuggestions
                  suggestions={aiSuggestions}
                  onAccept={handleAcceptSuggestion}
                  onReject={handleRejectSuggestion}
                  onClearAll={handleClearSuggestions}
                />
              </div>
            )}

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
            {tasks.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">No hay tareas. ¡Crea tu primera tarea!</p>
              </div> : tasks.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />)}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeTasks.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">
                  ¡Genial! No tienes tareas pendientes.
                </p>
              </div> : activeTasks.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />)}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTasks.length === 0 ? <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Aún no has completado ninguna tarea.
                </p>
              </div> : completedTasks.map(task => <TaskCard key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />)}
            </TabsContent>
            </Tabs>
          </>}
      </div>
    </div>;
};
export default Index;