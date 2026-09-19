import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard, type Task } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { AIAssistant } from "@/components/AIAssistant";
import { AISuggestions } from "@/components/AISuggestions";
import { BarraEnfoque } from "@/components/BarraEnfoque";
import { VoiceCapture } from "@/components/VoiceCapture";
import { AdminDashboard } from "@/components/AdminDashboard";
import { CalendarView } from "@/components/CalendarView";
import { Button } from "@/components/ui/button";
import { LogOut, Shield, Calendar, List, Mic } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { ListaAgrupada, ListaVacia } from "@/components/ui/lista";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { esParaHoy, fechaLarga, fechaLocal } from "@/lib/fechas";

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
  const [dictando, setDictando] = useState(false);
  const [enfoque, setEnfoque] = useState<Task | null>(null);
  const [nivel, setNivel] = useState(1);
  const [racha, setRacha] = useState(0);
  const [vista, setVista] = useState<"hoy" | "pronto" | "hechas">("hoy");
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
      loadStats();
    }
  }, [user]);

  /** Nivel y racha viven en una sola línea del encabezado: son premio, no protagonista. */
  const loadStats = async () => {
    const { data } = await supabase
      .from('user_stats')
      .select('level, streak_days')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setNivel(data.level ?? 1);
      setRacha(data.streak_days ?? 0);
    }
  };

  const loadUserRole = async () => {
    try {
      // Un usuario puede tener más de un rol: el disparador de alta le pone
      // "user" y un administrador puede agregarle "admin" encima. Pedir uno solo
      // con maybeSingle() reventaba y dejaba a los administradores como usuarios
      // normales; aquí se traen todos y gana el más alto.
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;
      const roles = (data ?? []).map((r) => r.role);
      setUserRole(roles.includes('admin') ? 'admin' : 'user');
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

  // "Hoy" contesta una sola pregunta: qué toca ahora. Lo demás se asoma apenas.
  const paraHoy = activeTasks.filter(t => esParaHoy(t.dueDate));
  const pronto = activeTasks.filter(t => !esParaHoy(t.dueDate));

  const vistas = [
    { id: "hoy" as const, texto: "Hoy", lista: paraHoy, vacio: "Nada para hoy. Disfrútalo." },
    { id: "pronto" as const, texto: "Pronto", lista: pronto, vacio: "No hay nada más adelante." },
    { id: "hechas" as const, texto: "Hechas", lista: completedTasks, vacio: "Aún no completas ninguna." },
  ];
  const actual = vistas.find(v => v.id === vista) ?? vistas[0];

  const saludo = paraHoy.length === 0
    ? "Nada pendiente para hoy."
    : `${paraHoy.length} ${paraHoy.length === 1 ? "cosa" : "cosas"} para hoy.`;

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Barra translúcida, como las de iOS: el contenido pasa por debajo */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/72 backdrop-blur-xl">
        <div className="container mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-callout font-semibold text-foreground">MindTask</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-caption text-muted-foreground">
              local
            </span>
          </div>

          <div className="flex items-center gap-1">
            {userRole === 'admin' && (
              <Button variant="ghost" size="sm" onClick={() => setShowAdminView(!showAdminView)}>
                {showAdminView ? "Mis tareas" : "Admin"}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setDictando(true)} aria-label="Dictar una tarea">
              <Mic className="h-5 w-5" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Cerrar sesión">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-5">
        {userRole === 'admin' && showAdminView ? (
          <div className="py-8">
            <AdminDashboard />
          </div>
        ) : (
          <>
            {/* Título grande, como el de una pantalla de iOS antes de hacer scroll */}
            <section className="pb-6 pt-10">
              <p className="text-footnote text-muted-foreground">{fechaLarga()}</p>
              <h1 className="mt-1 text-largeTitle font-bold tracking-tight text-foreground">{saludo}</h1>
              <p className="mt-2 text-footnote text-muted-foreground">
                Nivel {nivel} · racha de {racha} {racha === 1 ? "día" : "días"} · {completedTasks.length} hechas
              </p>
            </section>

            {/* Control segmentado, con su cuenta al lado */}
            <div className="sticky top-[57px] z-20 -mx-5 bg-background/80 px-5 py-2 backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex rounded-xl bg-secondary p-1">
                  {vistas.map(({ id, texto, lista }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setVista(id)}
                      aria-pressed={vista === id}
                      className={cn(
                        "rounded-lg px-3.5 py-1.5 text-footnote font-medium transition-colors",
                        vista === id
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {texto}
                      <span className="tabular ml-1.5 text-caption opacity-60">{lista.length}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <AIAssistant
                    tasks={tasks}
                    onSuggest={handleAISuggestions}
                    onLoadingChange={setSugerenciasCargando}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
                    aria-label={viewMode === 'list' ? "Ver calendario" : "Ver lista"}
                  >
                    {viewMode === 'list' ? <Calendar className="h-5 w-5" /> : <List className="h-5 w-5" />}
                  </Button>
                  <AddTaskDialog onAddTask={addTask} />
                </div>
              </div>
            </div>

            <div className="space-y-4 py-4">
              {sugerenciasCargando && (
                <div className="animate-in fade-in slide-in-from-top-1 rounded-2xl border border-border bg-card p-4 duration-200">
                  <p className="mb-3 text-footnote text-muted-foreground">
                    Pensando en tres tareas para ti. Con un modelo local esto puede tardar.
                  </p>
                  <div className="space-y-2.5">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
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
                <CalendarView tasks={tasks} onToggle={toggleTask} onDelete={deleteTask} onEdit={editTask} />
              ) : (
                <ListaAgrupada>
                  {actual.lista.length === 0 ? (
                    <ListaVacia>{actual.vacio}</ListaVacia>
                  ) : (
                    actual.lista.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={toggleTask}
                        onDelete={deleteTask}
                        onEdit={editTask}
                        onEnfocar={() => setEnfoque(task)}
                        enfocada={enfoque?.id === task.id}
                      />
                    ))
                  )}
                </ListaAgrupada>
              )}
            </div>
          </>
        )}
      </main>

      <VoiceCapture abierto={dictando} onOpenChange={setDictando} onCrear={addTask} />
      <BarraEnfoque
        tarea={enfoque}
        onCerrar={() => setEnfoque(null)}
        onCompletar={(id) => toggleTask(id)}
      />
    </div>
  );
};

export default Dashboard;
