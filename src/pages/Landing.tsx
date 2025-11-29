import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Timer, Trophy, Mic, Calendar, ListChecks, Shield, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "Asistente IA",
      description: "Sugerencias inteligentes de tareas basadas en tus patrones y objetivos"
    },
    {
      icon: Timer,
      title: "Pomodoro Timer",
      description: "Técnica Pomodoro integrada para maximizar tu productividad"
    },
    {
      icon: Trophy,
      title: "Gamificación",
      description: "Sistema de puntos, niveles y rachas para mantenerte motivado"
    },
    {
      icon: Mic,
      title: "Comandos de Voz",
      description: "Crea tareas con tu voz, sin necesidad de escribir"
    },
    {
      icon: Calendar,
      title: "Vista Calendario",
      description: "Visualiza tus tareas en un calendario mensual intuitivo"
    },
    {
      icon: ListChecks,
      title: "Organización Total",
      description: "Prioridades, categorías, fechas y descripciones detalladas"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              MindTask AI
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/auth')}>
              Iniciar Sesión
            </Button>
            <Button onClick={() => navigate('/auth')}>
              Comenzar Gratis
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            Gestión de tareas impulsada por IA
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold leading-tight">
            Organiza tu vida con{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              inteligencia artificial
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground">
            La plataforma definitiva para gestionar tareas con IA, Pomodoro, 
            gamificación y comandos de voz. Todo lo que necesitas en un solo lugar.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/auth')} className="text-lg">
              Empezar ahora - Es gratis
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')} className="text-lg">
              Ver Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Todo lo que necesitas para ser más productivo
          </h2>
          <p className="text-muted-foreground text-lg">
            Características diseñadas para ayudarte a alcanzar tus objetivos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardContent className="p-12 text-center space-y-6">
            <Shield className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-3xl md:text-4xl font-bold">
              ¿Listo para transformar tu productividad?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Únete a miles de usuarios que ya están logrando más con MindTask AI. 
              Comienza gratis hoy mismo.
            </p>
            <Button size="lg" onClick={() => navigate('/auth')} className="text-lg">
              Crear cuenta gratuita
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2024 MindTask AI. Organiza tu vida con inteligencia artificial.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
