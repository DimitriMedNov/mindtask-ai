import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Flame, Star, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";

interface UserStats {
  points: number;
  level: number;
  streak_days: number;
  tasks_completed: number;
}

export const GamificationPanel = () => {
  const [stats, setStats] = useState<UserStats>({
    points: 0,
    level: 1,
    streak_days: 0,
    tasks_completed: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setStats(data);
      } else {
        // Create initial stats
        const { error: insertError } = await supabase
          .from('user_stats')
          .insert({
            user_id: user.id,
            points: 0,
            level: 1,
            streak_days: 0,
            tasks_completed: 0
          });
        
        if (insertError) throw insertError;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Cada nivel cuesta 100 puntos: el nivel se calcula como
  // Math.floor(points / 100) + 1, así que lo que falta es lo que resta para
  // completar la centena actual. Antes multiplicaba por el nivel y en nivel 4
  // con 340 puntos decía "360 pts para nivel 5" en vez de 60.
  const PUNTOS_POR_NIVEL = 100;
  const enEsteNivel = stats.points % PUNTOS_POR_NIVEL;
  const faltan = PUNTOS_POR_NIVEL - enEsteNivel;
  const progress = (enEsteNivel / PUNTOS_POR_NIVEL) * 100;

  return (
    <Card className="border-accent/20 bg-gradient-to-br from-card to-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Tu Progreso
        </CardTitle>
        <CardDescription>
          Sigue completando tareas para subir de nivel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Nivel {stats.level}</span>
            <span className="font-medium">{stats.points} pts</span>
          </div>
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">
            {faltan} pts para nivel {stats.level + 1}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-1">
            <Flame className="h-6 w-6 mx-auto text-orange-500" />
            <p className="text-2xl font-bold">{stats.streak_days}</p>
            <p className="text-xs text-muted-foreground">Racha</p>
          </div>
          <div className="text-center space-y-1">
            <Star className="h-6 w-6 mx-auto text-accent" />
            <p className="text-2xl font-bold">{stats.points}</p>
            <p className="text-xs text-muted-foreground">Puntos</p>
          </div>
          <div className="text-center space-y-1">
            <TrendingUp className="h-6 w-6 mx-auto text-success" />
            <p className="text-2xl font-bold">{stats.tasks_completed}</p>
            <p className="text-xs text-muted-foreground">Tareas</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};