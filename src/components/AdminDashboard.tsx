import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, CheckSquare, TrendingUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Panel de Administrador
          </h2>
          <p className="text-muted-foreground">Vista completa del sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-3xl font-bold">{users.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Tareas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-3xl font-bold">{allTasks.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-success" />
              <span className="text-3xl font-bold text-success">{completedTasks}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Completitud</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-3xl font-bold">{completionRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-6">
        <UserRoleManager />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Usuarios del Sistema</CardTitle>
            <CardDescription>Estadísticas de cada usuario</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{user.email}</p>
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role === 'admin' ? 'Admin' : 'Usuario'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {user.completedTasks}/{user.totalTasks} tareas completadas
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">
                        {user.totalTasks > 0 ? Math.round((user.completedTasks / user.totalTasks) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tareas Recientes del Sistema</CardTitle>
            <CardDescription>Últimas tareas de todos los usuarios</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {allTasks.slice(0, 20).map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 border rounded">
                    <div className={`w-2 h-2 rounded-full ${task.completed ? 'bg-success' : 'bg-muted'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{task.category}</Badge>
                        <Badge variant="outline" className="text-xs">{task.priority}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};