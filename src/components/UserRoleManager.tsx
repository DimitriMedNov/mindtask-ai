import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fila, ListaAgrupada, ListaVacia } from "@/components/ui/lista";
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
      <ListaAgrupada titulo="Roles" descripcion="Quién puede administrar el sistema">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </ListaAgrupada>
    );
  }

  return (
    <>
      <ListaAgrupada
        titulo="Roles"
        descripcion="Quién puede administrar el sistema"
        acciones={
          <Button variant="ghost" size="sm" onClick={loadUsers} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Recargar
          </Button>
        }
      >
        {users.length === 0 ? (
          <ListaVacia>No hay usuarios registrados.</ListaVacia>
        ) : (
          users.map((user) => (
                <Fila key={user.id} className="justify-between">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    {user.role === 'admin' ? (
                      <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-callout text-foreground">{user.email}</p>
                      <p className="text-caption text-muted-foreground">
                        {user.role === 'admin' ? 'Administrador' : 'Usuario'}
                      </p>
                    </div>
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
                </Fila>
              ))
        )}
      </ListaAgrupada>

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