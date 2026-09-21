import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard, type Task } from "@/components/TaskCard";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { AIAssistant } from "@/components/AIAssistant";
import { AISuggestions } from "@/components/AISuggestions";
import { BarraEnfoque } from "@/components/BarraEnfoque";
import { VoiceCapture } from "@/components/VoiceCapture";
import { CalendarView } from "@/components/CalendarView";
import { Button } from "@/components/ui/button";
import { Mic, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Anillo, ListaAgrupada, ListaVacia } from "@/components/ui/lista";
import { Logotipo } from "@/components/Marca";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { actualizarTarea, borrarTarea, crearTarea, leerEstadisticas, listarTareas, sumarTareaCompletada } from "@/lib/datos";
import { esParaHoy, fechaLarga, fechaLocal } from "@/lib/fechas";
import { isSameDay } from "date-fns";

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
  // Se abre el espacio de las sugerencias al pedirlas, no cuando llegan: así la
  // lista no salta debajo del usuario a los 30 segundos.
  const [sugerenciasCargando, setSugerenciasCargando] = useState(false);
  const [dictando, setDictando] = useState(false);
  const [enfoque, setEnfoque] = useState<Task | null>(null);
  /** Lo publica la barra de enfoque para que la fila muestre el mismo reloj. */
  const [tiempoEnfoque, setTiempoEnfoque] = useState<string>("");
  const [nivel, setNivel] = useState(1);
  const [racha, setRacha] = useState(0);
  const [vista, setVista] = useState<"hoy" | "pronto" | "hechas">("hoy");
  /** Día elegido en el calendario; manda sobre el filtro mientras esté puesto. */
  const [diaElegido, setDiaElegido] = useState<Date | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Array<{
    title: string;
    description?: string;
    priority: "low" | "medium" | "high";
    category: string;
    startDate?: Date;
    dueDate?: Date;
    completed: false;
  }>>([]);

  // Sin sesión ni usuarios: la base vive en esta máquina y es de quien la abre.
  useEffect(() => {
    void (async () => {
      await Promise.all([cargarTareas(), cargarEstadisticas()]);
      setLoading(false);
    })();
  }, []);

  const cargarTareas = async () => {
    try {
      setTasks(await listarTareas());
    } catch (error) {
      console.error("No se pudieron leer las tareas:", error);
      toast.error("No se pudieron leer las tareas");
    }
  };

  const cargarEstadisticas = async () => {
    try {
      const stats = await leerEstadisticas();
      setNivel(stats.level);
      setRacha(stats.streak_days);
    } catch (error) {
      console.error("No se pudieron leer las estadísticas:", error);
    }
  };

  const addTask = async (taskData: Omit<Task, "id" | "createdAt">) => {
    try {
      const nueva = await crearTarea(taskData);
      setTasks((previas) => [nueva, ...previas]);
      toast.success("Tarea creada", { description: nueva.title });
    } catch (error) {
      console.error("No se pudo crear la tarea:", error);
      toast.error("No se pudo crear la tarea");
    }
  };

  const editTask = async (id: string, updates: Partial<Task>) => {
    try {
      await actualizarTarea(id, updates);
      setTasks((previas) => previas.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      toast.success("Tarea actualizada");
    } catch (error) {
      console.error("No se pudo actualizar la tarea:", error);
      toast.error("No se pudo actualizar la tarea");
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const completada = !task.completed;
    try {
      await actualizarTarea(id, { completed: completada });
      setTasks((previas) => previas.map((t) => (t.id === id ? { ...t, completed: completada } : t)));

      if (completada) {
        const stats = await sumarTareaCompletada();
        const subioDeNivel = stats.level > nivel;
        setNivel(stats.level);
        setRacha(stats.streak_days);
        toast.success(subioDeNivel ? `Subiste al nivel ${stats.level}` : "Hecho", {
          description: subioDeNivel ? `${task.title} · +10 puntos` : `${task.title} · +10 puntos`,
        });
      }
    } catch (error) {
      console.error("No se pudo actualizar la tarea:", error);
      toast.error("No se pudo actualizar la tarea");
    }
  };

  const deleteTask = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    try {
      await borrarTarea(id);
      setTasks((previas) => previas.filter((t) => t.id !== id));
      toast.success("Tarea eliminada", { description: task?.title });
    } catch (error) {
      console.error("No se pudo eliminar la tarea:", error);
      toast.error("No se pudo eliminar la tarea");
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
  const hoyEs = new Date();
  const vencidas = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date(hoyEs.toDateString()));
  const paraHoy = activeTasks.filter(t => esParaHoy(t.dueDate) && !vencidas.includes(t));
  const pronto = activeTasks.filter(t => !esParaHoy(t.dueDate));
  const sinFecha = activeTasks.filter(t => !t.dueDate);
  const hechasHoy = completedTasks.filter(t => isSameDay(new Date(t.createdAt), hoyEs));

  const delDia = diaElegido
    ? tasks.filter(t => t.dueDate && isSameDay(new Date(t.dueDate), diaElegido))
    : [];

  // El anillo del encabezado: cuánto del día ya está resuelto.
  const totalHoy = paraHoy.length + vencidas.length + hechasHoy.length;
  const avanceHoy = totalHoy > 0 ? hechasHoy.length / totalHoy : 0;

  const saludo = vencidas.length > 0
    ? `${vencidas.length} ${vencidas.length === 1 ? "tarea se te pasó" : "tareas se te pasaron"}.`
    : paraHoy.length === 0
      ? hechasHoy.length > 0 ? "Día resuelto." : "Nada pendiente para hoy."
      : `${paraHoy.length} ${paraHoy.length === 1 ? "cosa" : "cosas"} para hoy.`;

  const renglon = (task: Task) => (
    <TaskCard
      key={task.id}
      task={task}
      onToggle={toggleTask}
      onDelete={deleteTask}
      onEdit={editTask}
      onEnfocar={() => setEnfoque(task)}
      enfocada={enfoque?.id === task.id}
      tiempoEnfoque={enfoque?.id === task.id ? tiempoEnfoque : undefined}
    />
  );

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Barra translúcida, como las de iOS: el contenido pasa por debajo */}
      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/72 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <Logotipo />
            {/* El punto verde dice, sin explicarlo, que nada sale de esta máquina */}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2 py-0.5 text-caption text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
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
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] px-6">
        {userRole === 'admin' && showAdminView ? (
          <div className="py-8">
            <AdminDashboard />
          </div>
        ) : (
          <>
            {/* Título grande, como el de una pantalla de iOS antes de hacer scroll */}
            <section className="pb-6 pt-10">
              <p className="text-footnote text-muted-foreground">{fechaLarga()}</p>
              <h1 className="display mt-1 text-largeTitle text-foreground">{saludo}</h1>
            </section>

            {/* Lista y calendario conviven: el calendario elige el día y la lista lo obedece */}
            <div className="grid items-start gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {diaElegido ? (
                    <button
                      type="button"
                      onClick={() => setDiaElegido(null)}
                      className="inline-flex items-center gap-2 rounded-xl bg-secondary px-3 py-1.5 text-footnote text-foreground"
                    >
                      {fechaLarga(diaElegido)}
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  ) : (
                    <p className="text-footnote text-muted-foreground">
                      {activeTasks.length} {activeTasks.length === 1 ? "tarea abierta" : "tareas abiertas"}
                    </p>
                  )}

                  <div className="flex items-center gap-2">
                    <AIAssistant
                      tasks={tasks}
                      onSuggest={handleAISuggestions}
                      onLoadingChange={setSugerenciasCargando}
                    />
                    <AddTaskDialog onAddTask={addTask} />
                  </div>
                </div>

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

                {diaElegido ? (
                  <ListaAgrupada titulo={fechaLarga(diaElegido)} descripcion={`${delDia.length} ${delDia.length === 1 ? "tarea" : "tareas"}`}>
                    {delDia.length === 0 ? (
                      <ListaVacia>Nada agendado para este día.</ListaVacia>
                    ) : (
                      delDia.map(renglon)
                    )}
                  </ListaAgrupada>
                ) : (
                  <>
                    {/* Todo apilado: nada se esconde detrás de un filtro */}
                    {vencidas.length > 0 && (
                      <ListaAgrupada titulo="Se te pasaron" tono="alerta" cuenta={vencidas.length}>
                        {vencidas.map(renglon)}
                      </ListaAgrupada>
                    )}

                    <ListaAgrupada titulo="Hoy" cuenta={paraHoy.length}>
                      {paraHoy.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <p className="text-body text-foreground">
                            {hechasHoy.length > 0 ? "Ya terminaste lo de hoy." : "No tienes nada agendado hoy."}
                          </p>
                          <p className="mx-auto mt-1 max-w-sm text-footnote text-muted-foreground">
                            Escribe lo siguiente que tengas en la cabeza, o deja que la IA te proponga algo.
                          </p>
                          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                            <AddTaskDialog onAddTask={addTask} />
                            <Button variant="outline" size="sm" onClick={() => setDictando(true)} className="gap-2">
                              <Mic className="h-4 w-4" />
                              Dictar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        paraHoy.map(renglon)
                      )}
                    </ListaAgrupada>

                    {pronto.length > 0 && (
                      <ListaAgrupada titulo="Pronto" cuenta={pronto.length}>
                        {pronto.slice(0, 6).map(renglon)}
                      </ListaAgrupada>
                    )}

                    {sinFecha.length > 0 && (
                      <ListaAgrupada titulo="Sin fecha" cuenta={sinFecha.length}>
                        {sinFecha.slice(0, 5).map(renglon)}
                      </ListaAgrupada>
                    )}

                    {completedTasks.length > 0 && (
                      <details className="group rounded-2xl border border-border bg-card">
                        <summary className="cursor-pointer list-none px-4 py-3 text-footnote text-muted-foreground transition-colors hover:text-foreground">
                          {completedTasks.length} {completedTasks.length === 1 ? "hecha" : "hechas"} · ver
                        </summary>
                        <div className="divide-y divide-border border-t border-border">
                          {completedTasks.slice(0, 10).map(renglon)}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </div>

              {/* El calendario se queda a la vista mientras se recorre la lista */}
              <div className="space-y-4 lg:sticky lg:top-[76px]">
                <CalendarView
                  tasks={tasks}
                  compacto
                  elegido={diaElegido ?? undefined}
                  onElegir={setDiaElegido}
                />

                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-caption uppercase tracking-wide text-muted-foreground">Tu día</p>
                  <div className="mt-3 flex items-center gap-4">
                    <Anillo avance={avanceHoy} />
                    <div className="space-y-0.5">
                      <p className="text-callout text-foreground">
                        {hechasHoy.length} de {totalHoy || 0} hechas
                      </p>
                      <p className="text-caption text-muted-foreground">
                        Nivel {nivel} · racha de {racha} {racha === 1 ? "día" : "días"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <VoiceCapture abierto={dictando} onOpenChange={setDictando} onCrear={addTask} />
      <BarraEnfoque
        tarea={enfoque}
        onCerrar={() => setEnfoque(null)}
        onCompletar={(id) => toggleTask(id)}
        onTiempo={setTiempoEnfoque}
      />
    </div>
  );
};

export default Dashboard;
