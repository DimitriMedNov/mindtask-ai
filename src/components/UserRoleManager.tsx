import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, User, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserWithRole {
  id: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
}

export const UserRoleManager = () => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    userId: string;
    newRole: 'admin' | 'user';
    email: string;
  }>({ open: false, userId: '', newRole: 'user', email: '' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Call edge function to get users with emails
      const { data, error } = await supabase.functions.invoke('get-users', {
        body: {}
      });

      if (error) throw error;

      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = (userId: string, newRole: 'admin' | 'user', email: string) => {
    setConfirmDialog({
      open: true,
      userId,
      newRole,
      email
    });
  };

  const confirmRoleChange = async () => {
    const { userId, newRole } = confirmDialog;
    setUpdating(userId);
    
    try {
      const { error } = await supabase.functions.invoke('assign-role', {
        body: { userId, role: newRole }
      });

      if (error) throw error;

      // Update local state
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));

      toast.success("Rol actualizado exitosamente", {
        description: `Usuario ahora es ${newRole === 'admin' ? 'Administrador' : 'Usuario normal'}`
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error("Error al actualizar rol", {
        description: error.message || "Intenta de nuevo"
      });
    } finally {
      setUpdating(null);
      setConfirmDialog({ open: false, userId: '', newRole: 'user', email: '' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Gestión de Roles
              </CardTitle>
              <CardDescription>
                Asigna roles de admin o usuario normal a los miembros
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadUsers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay usuarios registrados
              </div>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-full ${user.role === 'admin' ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                      {user.role === 'admin' ? (
                        <Shield className="h-4 w-4 text-primary" />
                      ) : (
                        <User className="h-4 w-4 text-secondary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.id}
                      </p>
                    </div>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? 'Admin' : 'Usuario'}
                    </Badge>
                  </div>

                  <div className="ml-4">
                    <Select
                      value={user.role}
                      onValueChange={(value: 'admin' | 'user') => handleRoleChange(user.id, value, user.email)}
                      disabled={updating === user.id}
                    >
                      <SelectTrigger className="w-[140px]">
                        {updating === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuario</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => 
        setConfirmDialog({ ...confirmDialog, open })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambio de rol?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de cambiar el rol del usuario{" "}
              <span className="font-medium">{confirmDialog.email}</span> a{" "}
              <span className="font-medium">
                {confirmDialog.newRole === 'admin' ? 'Administrador' : 'Usuario normal'}
              </span>.
              {confirmDialog.newRole === 'admin' ? (
                <p className="mt-2 text-amber-600">
                  ⚠️ Los administradores tienen acceso completo al sistema y pueden ver todas las tareas.
                </p>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};