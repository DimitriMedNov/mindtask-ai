import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Fila, ListaAgrupada, ListaVacia } from "@/components/ui/lista";
import { cn } from "@/lib/utils";
import { UserRoleManager } from "./UserRoleManager";
import type { Task } from "./TaskCard";

interface UserWithStats {
  id: string;
  email: string;
  totalTasks: number;
  completedTasks: number;
  role: string;
}

export const AdminDashboard = () => {
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      // Load all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      setAllTasks(tasksData.map(task => ({
        id: task.id,
        title: task.title,
        description: task.description || '',
        completed: task.completed,
        priority: task.priority as "high" | "medium" | "low",
        category: task.category,
        createdAt: new Date(task.created_at)
      })));

      // Load user statistics
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('user_id, tasks_completed, points');

      if (statsError) throw statsError;

      // Get user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Combine data
      const userStats: Record<string, { completed: number; total: number; role: string }> = {};
      
      tasksData.forEach(task => {
        if (!userStats[task.user_id]) {
          userStats[task.user_id] = { completed: 0, total: 0, role: 'user' };
        }
        userStats[task.user_id].total++;
        if (task.completed) userStats[task.user_id].completed++;
      });

      rolesData?.forEach(role => {
        if (userStats[role.user_id]) {
          userStats[role.user_id].role = role.role;
        }
      });

      const usersArray: UserWithStats[] = Object.keys(userStats).map(userId => ({
        id: userId,
        email: userId.substring(0, 8) + '...',
        totalTasks: userStats[userId].total,
        completedTasks: userStats[userId].completed,
        role: userStats[userId].role
      }));

      setUsers(usersArray);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  const completedTasks = allTasks.filter(t => t.completed).length;
  const completionRate = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;

  const resumen = [
    { etiqueta: "Usuarios", valor: users.length },
    { etiqueta: "Tareas", valor: allTasks.length },
    { etiqueta: "Completadas", valor: completedTasks },
    { etiqueta: "Avance", valor: `${completionRate}%` },
  ];

  const ETIQUETA_PRIORIDAD: Record<string, string> = {
    high: "Alta",
    medium: "Media",
    low: "Baja",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-title1 font-semibold text-foreground">Panel de administración</h2>
        <p className="text-footnote text-muted-foreground">Todo el sistema, de un vistazo</p>
      </div>

      {/* Los cuatro números en una sola superficie: son un resumen, no cuatro tarjetas */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
        {resumen.map(({ etiqueta, valor }) => (
          <div key={etiqueta} className="px-5 py-4">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
            <p className="tabular mt-1 text-title1 font-semibold text-foreground">{valor}</p>
          </div>
        ))}
      </div>

      <UserRoleManager />

      <div className="grid gap-6 lg:grid-cols-2 xl:gap-8">
        <ListaAgrupada titulo="Usuarios" descripcion="Cuánto avanza cada quien">
          {users.length === 0 ? (
            <ListaVacia>Todavía no hay usuarios registrados.</ListaVacia>
          ) : (
            <ScrollArea className="h-[420px]">
              {users.map(user => {
                const avance = user.totalTasks > 0
                  ? Math.round((user.completedTasks / user.totalTasks) * 100)
                  : 0;
                return (
                  <Fila key={user.id} className="justify-between border-b border-border last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate text-callout text-foreground">{user.email}</p>
                      <p className="text-caption text-muted-foreground">
                        {user.completedTasks} de {user.totalTasks} tareas
                        {user.role === "admin" && " · Administrador"}
                      </p>
                    </div>
                    <span className="tabular text-callout font-medium text-foreground">{avance}%</span>
                  </Fila>
                );
              })}
            </ScrollArea>
          )}
        </ListaAgrupada>

        <ListaAgrupada titulo="Actividad reciente" descripcion="Últimas tareas de todos">
          {allTasks.length === 0 ? (
            <ListaVacia>Sin tareas todavía.</ListaVacia>
          ) : (
            <ScrollArea className="h-[420px]">
              {allTasks.slice(0, 20).map(task => (
                <Fila key={task.id} className="border-b border-border last:border-b-0">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      task.completed ? "bg-success" : "bg-muted-foreground/40",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-callout text-foreground", task.completed && "text-muted-foreground line-through")}>
                      {task.title}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {task.category} · Prioridad {ETIQUETA_PRIORIDAD[task.priority] ?? task.priority}
                    </p>
                  </div>
                </Fila>
              ))}
            </ScrollArea>
          )}
        </ListaAgrupada>
      </div>
    </div>
  );
};