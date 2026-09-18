import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard, type Task } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { AIAssistant } from "@/components/AIAssistant";
import { AISuggestions } from "@/components/AISuggestions";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { GamificationPanel } from "@/components/GamificationPanel";
import { VoiceCommands } from "@/components/VoiceCommands";
import { AdminDashboard } from "@/components/AdminDashboard";
import { CalendarView } from "@/components/CalendarView";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Shield, Calendar, List } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fechaLocal } from "@/lib/fechas";

/** Guarda la fecha tal como la eligió el usuario, sin convertirla a UTC. */
const aTextoFecha = (fecha?: Date) =>
  fecha
    ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
    : undefined;

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'user' | null>(null);
  const [showAdminView, setShowAdminView] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  // Se abre el espacio de las sugerencias al pedirlas, no cuando llegan: así la
  // lista no salta debajo del usuario a los 30 segundos.
  const [sugerenciasCargando, setSugerenciasCargando] = useState(false);
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate('/auth');
        return;
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadTasks();
      loadUserRole();
    }
  }, [user]);

  const loadUserRole = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setUserRole(data?.role || 'user');
    } catch (error) {
      console.error('Error loading user role:', error);
      setUserRole('user');
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks(data.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        completed: task.completed,
        priority: task.priority as "high" | "medium" | "low",
        category: task.category,
        createdAt: new Date(task.created_at),
        startDate: fechaLocal(task.start_date),
        dueDate: fechaLocal(task.due_date),
      })));
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const addTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          category: taskData.category,
          completed: taskData.completed
        })
        .select()
        .single();

      if (error) throw error;

      const newTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        completed: data.completed,
        priority: data.priority as "high" | "medium" | "low",
        category: data.category,
        createdAt: new Date(data.created_at),
        startDate: fechaLocal(data.start_date),
        dueDate: fechaLocal(data.due_date),
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

  const editTask = async (id: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase.from('tasks').update({
        title: updates.title,
        description: updates.description,
        priority: updates.priority,
        category: updates.category,
        start_date: aTextoFecha(updates.startDate),
        due_date: aTextoFecha(updates.dueDate),
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
      const { error } = await supabase
        .from('tasks')
        .update({ completed: newCompleted })
        .eq('id', id);

      if (error) throw error;

      setTasks(tasks.map(t => t.id === id ? { ...t, completed: newCompleted } : t));

      if (newCompleted) {
        await updateUserStats('complete');
      }

      toast.success(
        newCompleted ? "¡Tarea completada! 🎉" : "Tarea marcada como pendiente",
        {
          description: newCompleted 
            ? `¡Excelente trabajo con "${task.title}"! +10 puntos`
            : `"${task.title}" vuelve a estar pendiente.`
        }
      );
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error("Error al actualizar tarea");
    }
  };

  const deleteTask = async (id: string) => {
    try {
      const task = tasks.find(t => t.id === id);
      const { error } = await supabase.from('tasks').delete().eq('id', id);

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
      const { data: stats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

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
    navigate('/');
    toast.success("Sesión cerrada");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const activeTasks = tasks.filter(task => !task.completed);
  const completedTasks = tasks.filter(task => task.completed);

  const filtros = [
    { valor: "all", texto: "Todas", lista: tasks, vacio: "No hay tareas todavía. Crea la primera." },
    { valor: "active", texto: "Activas", lista: activeTasks, vacio: "Sin pendientes. Bien ahí." },
    { valor: "completed", texto: "Hechas", lista: completedTasks, vacio: "Aún no completas ninguna." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        {/* Encabezado: identidad a la izquierda, acciones a la derecha */}
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-largeTitle font-bold text-foreground">MindTask</h1>
              {userRole === 'admin' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-caption font-medium text-secondary-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  Admin
                </span>
              )}
            </div>
            <p className="mt-1 text-footnote text-muted-foreground">
              {activeTasks.length === 0
                ? "No tienes nada pendiente."
                : `${activeTasks.length} ${activeTasks.length === 1 ? "tarea pendiente" : "tareas pendientes"}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {userRole === 'admin' && (
              <Button
                variant={showAdminView ? "default" : "outline"}
                size="sm"
                onClick={() => setShowAdminView(!showAdminView)}
              >
                <Shield className="mr-2 h-4 w-4" />
                {showAdminView ? "Vista usuario" : "Vista admin"}
              </Button>
            )}
            <VoiceCommands onVoiceCommand={handleVoiceCommand} compact />
            <AddTaskDialog onAddTask={addTask} />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </header>

        {userRole === 'admin' && showAdminView ? (
          <AdminDashboard />
        ) : (
          <>
            {/* Foco manda: es lo único que representa trabajar ahora mismo.
                El progreso lo acompaña, en tono neutro y sin competir. */}
            <section className="mb-8 grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PomodoroTimer />
              </div>
              <GamificationPanel />
            </section>

            {/* Barra de la lista: filtros con su cuenta, vista y la IA juntas */}
            <Tabs defaultValue="all" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  {filtros.map(({ valor, texto, lista }) => (
                    <TabsTrigger key={valor} value={valor} className="gap-1.5">
                      {texto}
                      <span className="tabular text-caption text-muted-foreground">{lista.length}</span>
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-2">
                  <AIAssistant
                    tasks={tasks}
                    onSuggest={handleAISuggestions}
                    onLoadingChange={setSugerenciasCargando}
                  />
                  <div className="inline-flex rounded-lg border border-border p-0.5">
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      aria-label="Ver como lista"
                      aria-pressed={viewMode === 'list'}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('calendar')}
                      aria-label="Ver como calendario"
                      aria-pressed={viewMode === 'calendar'}
                    >
                      <Calendar className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* El espacio se reserva desde el clic: con un modelo local esto
                  puede tardar medio minuto y la espera tiene que verse. */}
              {sugerenciasCargando && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-xl border border-border bg-card p-4 duration-200">
                  <p className="mb-3 text-footnote text-muted-foreground">
                    Pensando en tres tareas para ti. Con un modelo local esto puede tardar.
                  </p>
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                </div>
              )}

              {!sugerenciasCargando && aiSuggestions.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <AISuggestions
                    suggestions={aiSuggestions}
                    onAccept={handleAcceptSuggestion}
                    onReject={handleRejectSuggestion}
                    onClearAll={handleClearSuggestions}
                  />
                </div>
              )}

              {viewMode === 'calendar' ? (
                <CalendarView
                  tasks={tasks}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onEdit={editTask}
                />
              ) : (
                filtros.map(({ valor, lista, vacio }) => (
                  <TabsContent key={valor} value={valor} className="space-y-2">
                    {lista.length === 0 ? (
                      <p className="py-12 text-center text-body text-muted-foreground">{vacio}</p>
                    ) : (
                      lista.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onToggle={toggleTask}
                          onDelete={deleteTask}
                          onEdit={editTask}
                        />
                      ))
                    )}
                  </TabsContent>
                ))
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
