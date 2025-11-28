import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { toast } from "sonner";
const POMODORO_MINUTES = 25;
const BREAK_MINUTES = 5;
export const PomodoroTimer = () => {
  const [timeLeft, setTimeLeft] = useState(POMODORO_MINUTES * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleTimerComplete();
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);
  const handleTimerComplete = () => {
    setIsRunning(false);
    if (isBreak) {
      toast.success("¡Descanso terminado!", {
        description: "Hora de volver al trabajo 💪"
      });
      setIsBreak(false);
      setTimeLeft(POMODORO_MINUTES * 60);
    } else {
      toast.success("¡Pomodoro completado! 🎉", {
        description: "Toma un descanso de 5 minutos"
      });
      setIsBreak(true);
      setTimeLeft(BREAK_MINUTES * 60);
    }
  };
  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };
  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(isBreak ? BREAK_MINUTES * 60 : POMODORO_MINUTES * 60);
  };
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  return <Card className={`border-2 ${isBreak ? 'border-accent' : 'border-primary'} bg-gradient-to-br from-card to-${isBreak ? 'accent' : 'primary'}/5`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          {isBreak ? "Descanso" : "Pomodoro Timer"}
        </CardTitle>
        <CardDescription>
          {isBreak ? "Relájate y recarga energías" : "Mantén el foco por 25 minutos"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-6xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-primary">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={toggleTimer} className="flex-1" variant={isRunning ? "secondary" : "default"}>
            {isRunning ? <>
                <Pause className="mr-2 h-4 w-4" />
                Pausar
              </> : <>
                <Play className="mr-2 h-4 w-4" />
                Iniciar
              </>}
          </Button>
          <Button onClick={resetTimer} variant="outline">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>;
};