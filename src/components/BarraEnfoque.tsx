import { useEffect, useRef, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MINUTOS_TRABAJO = 25;
const MINUTOS_DESCANSO = 5;

/**
 * Enfoque, no temporizador.
 *
 * Antes el Pomodoro era una tarjeta con un 25:00 enorme que no sabía en qué
 * estabas trabajando. Aquí el tiempo siempre pertenece a una tarea: se elige
 * una, la barra baja y se queda abajo mientras corre, como el reproductor de
 * Música en iOS. Si no hay nada corriendo, la barra no existe.
 */
export function BarraEnfoque({
  tarea,
  onCerrar,
  onCompletar,
}: {
  tarea: { id: string; title: string } | null;
  onCerrar: () => void;
  onCompletar: (id: string) => void;
}) {
  const [restante, setRestante] = useState(MINUTOS_TRABAJO * 60);
  const [corriendo, setCorriendo] = useState(true);
  const [descanso, setDescanso] = useState(false);
  const tareaId = tarea?.id;
  const anteriorRef = useRef<string | undefined>(undefined);

  // Cada tarea empieza con su tiempo completo.
  useEffect(() => {
    if (tareaId && tareaId !== anteriorRef.current) {
      anteriorRef.current = tareaId;
      setRestante(MINUTOS_TRABAJO * 60);
      setDescanso(false);
      setCorriendo(true);
    }
  }, [tareaId]);

  useEffect(() => {
    if (!tarea || !corriendo) return;

    const id = setInterval(() => {
      setRestante((previo) => {
        if (previo > 1) return previo - 1;

        // Se acabó el bloque: se avisa y se cambia de modo.
        if (descanso) {
          toast.success("Descanso terminado", { description: "Otros 25 minutos cuando quieras." });
          setDescanso(false);
          setCorriendo(false);
          return MINUTOS_TRABAJO * 60;
        }
        toast.success("Bloque completado", { description: `Tómate 5 minutos.` });
        setDescanso(true);
        return MINUTOS_DESCANSO * 60;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [tarea, corriendo, descanso]);

  if (!tarea) return null;

  const total = (descanso ? MINUTOS_DESCANSO : MINUTOS_TRABAJO) * 60;
  const avance = 1 - restante / total;
  const minutos = Math.floor(restante / 60);
  const segundos = restante % 60;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4">
      <div
        className={cn(
          "pointer-events-auto relative w-full max-w-md overflow-hidden rounded-3xl border border-border/60",
          "bg-card/80 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] backdrop-blur-2xl",
          "animate-in slide-in-from-bottom-4 duration-300",
        )}
      >
        {/* El avance se lee en el ancho, sin ocupar un renglón aparte */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear",
            descanso ? "bg-accent/15" : "bg-primary/12",
          )}
          style={{ width: `${avance * 100}%` }}
        />

        <div className="relative flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-caption uppercase tracking-wide text-muted-foreground">
              {descanso ? "Descanso" : "Enfocado en"}
            </p>
            <p className="truncate text-callout font-medium text-foreground">{tarea.title}</p>
          </div>

          <span className="tabular text-title2 font-semibold text-foreground">
            {minutos}:{segundos.toString().padStart(2, "0")}
          </span>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCorriendo((v) => !v)}
              aria-label={corriendo ? "Pausar" : "Continuar"}
            >
              {corriendo ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onCompletar(tarea.id);
                onCerrar();
              }}
            >
              Listo
            </Button>
            <Button variant="ghost" size="icon" onClick={onCerrar} aria-label="Salir del enfoque">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
