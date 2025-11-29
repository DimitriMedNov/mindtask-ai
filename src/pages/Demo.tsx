import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TaskCard, type Task } from "@/components/TaskCard";
import { TaskStats } from "@/components/TaskStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ListChecks, Brain, Timer, Trophy, Mic, Lock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Demo = () => {
  const navigate = useNavigate();
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);

  // Tareas de ejemplo (estáticas)
  const demoTasks: Task[] = [
    {
      id: "1",
      title: "Revisar correos importantes",
      description: "Responder emails del cliente y organizar reunión",
      completed: false,
      priority: "high",
      category: "Trabajo",
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 86400000),
    },
    {
      id: "2",
      title: "Hacer ejercicio",
      description: "30 minutos de cardio",
      completed: true,
      priority: "medium",
      category: "Personal",
      createdAt: new Date(),
    },
    {
      id: "3",
      title: "Estudiar programación",
      description: "Completar tutorial de React",
      completed: false,
      priority: "high",
      category: "Aprendizaje",
      createdAt: new Date(),
      startDate: new Date(),
      dueDate: new Date(Date.now() + 172800000),
    },
    {
      id: "4",
      title: "Preparar presentación",
      description: "Slides para reunión del lunes",
      completed: false,
      priority: "medium",
      category: "Trabajo",
      createdAt: new Date(),
    },
  ];

  const handleActionBlocked = (action: string) => {
    setShowRegisterPrompt(true);
    toast.info(`Para ${action}, necesitas crear una cuenta`, {
      description: "La demo es solo para explorar la interfaz"
    });
  };

  const activeTasks = demoTasks.filter(task => !task.completed);
  const completedTasks = demoTasks.filter(task => task.completed);

  return (
    <div className="min-h-screen bg-background">
      {/* Banner de Demo */}
      <div className="bg-primary/10 border-b border-primary/20 py-3">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm font-medium">
            🎯 Estás en modo DEMO - Datos de ejemplo · No se guardan cambios ·{" "}
            <Button 
              variant="link" 
              className="p-0 h-auto font-bold text-primary"
              onClick={() => navigate('/auth')}
            >
              Crear cuenta gratis
            </Button>
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-primary">
                  MindTask AI - Demo
                </h1>
              </div>
              <p className="text-muted-foreground mt-2">
                Explora todas las características de forma limitada
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Inicio
              </Button>
              <Button onClick={() => navigate('/auth')}>
                Crear Cuenta
              </Button>
            </div>
          </div>
        </div>

        {/* Feature Cards - Bloqueadas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-2 cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
            onClick={() => handleActionBlocked("usar el Asistente IA")}>
            <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground rounded-full p-1">
              <Lock className="h-3 w-3" />
            </div>
            <CardHeader>
              <Brain className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Asistente IA</CardTitle>
              <CardDescription>
                Obtén sugerencias inteligentes de tareas
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
            onClick={() => handleActionBlocked("usar el Pomodoro Timer")}>
            <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground rounded-full p-1">
              <Lock className="h-3 w-3" />
            </div>
            <CardHeader>
              <Timer className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Pomodoro Timer</CardTitle>
              <CardDescription>
                Gestiona tu tiempo con la técnica Pomodoro
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
            onClick={() => handleActionBlocked("ver tu progreso")}>
            <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground rounded-full p-1">
              <Lock className="h-3 w-3" />
            </div>
            <CardHeader>
              <Trophy className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Gamificación</CardTitle>
              <CardDescription>
                Nivel 5 · 450 puntos · 7 días de racha
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-2 cursor-pointer hover:border-primary/50 transition-colors relative overflow-hidden"
            onClick={() => handleActionBlocked("usar Comandos de Voz")}>
            <div className="absolute top-2 right-2 bg-primary/90 text-primary-foreground rounded-full p-1">
              <Lock className="h-3 w-3" />
            </div>
            <CardHeader>
              <Mic className="h-8 w-8 text-primary mb-2" />
              <CardTitle className="text-lg">Comandos de Voz</CardTitle>
              <CardDescription>
                Crea tareas con tu voz
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <TaskStats tasks={demoTasks} />
        </div>

        {/* Call to Action */}
        <Card className="mb-8 border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold mb-1">
                  ¿Te gusta lo que ves? Desbloquea todas las funciones
                </h3>
                <p className="text-sm text-muted-foreground">
                  Crea tu cuenta gratis y empieza a gestionar tus tareas reales con IA
                </p>
              </div>
              <Button size="lg" onClick={() => navigate('/auth')}>
                Crear Cuenta Gratis
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task List - Solo vista */}
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
            {demoTasks.map(task => (
              <div key={task.id} onClick={() => handleActionBlocked("editar tareas")}>
                <TaskCard
                  task={task}
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onEdit={() => {}}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {activeTasks.map(task => (
              <div key={task.id} onClick={() => handleActionBlocked("editar tareas")}>
                <TaskCard
                  task={task}
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onEdit={() => {}}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedTasks.map(task => (
              <div key={task.id} onClick={() => handleActionBlocked("editar tareas")}>
                <TaskCard
                  task={task}
                  onToggle={() => {}}
                  onDelete={() => {}}
                  onEdit={() => {}}
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog para promover registro */}
      <Dialog open={showRegisterPrompt} onOpenChange={setShowRegisterPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Función bloqueada en modo demo
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <p>
                Esta es una vista previa limitada de MindTask AI. Para acceder a todas las funciones:
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Crear, editar y eliminar tus propias tareas</li>
                <li>Usar el Asistente IA para sugerencias personalizadas</li>
                <li>Gestionar tu tiempo con Pomodoro Timer</li>
                <li>Ganar puntos, niveles y mantener rachas</li>
                <li>Crear tareas con comandos de voz</li>
                <li>Sincronización en todos tus dispositivos</li>
              </ul>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={() => navigate('/auth')}>
                  Crear cuenta gratis
                </Button>
                <Button variant="outline" onClick={() => setShowRegisterPrompt(false)}>
                  Seguir explorando
                </Button>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Demo;
