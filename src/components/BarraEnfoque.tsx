import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play, X } from "lucide-react";
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
  onTiempo,
}: {
  tarea: { id: string; title: string } | null;
  onCerrar: () => void;
  onCompletar: (id: string) => void;
  /** Publica el tiempo restante para que la fila enfocada muestre el mismo reloj. */
  onTiempo?: (texto: string) => void;
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

  // El reloj se comparte con la fila enfocada, para que digan lo mismo.
  useEffect(() => {
    onTiempo?.(tarea ? `${Math.floor(restante / 60)}:${(restante % 60).toString().padStart(2, "0")}` : "");
  }, [restante, tarea, onTiempo]);

  if (!tarea) return null;

  const total = (descanso ? MINUTOS_DESCANSO : MINUTOS_TRABAJO) * 60;
  const avance = 1 - restante / total;
  const minutos = Math.floor(restante / 60);
  const segundos = restante % 60;
  const reloj = `${minutos}:${segundos.toString().padStart(2, "0")}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-5">
      <div
        className={cn(
          "pointer-events-auto relative flex w-full max-w-xl items-center gap-4 overflow-hidden rounded-[22px]",
          "bg-card/85 px-5 py-3.5 shadow-[0_16px_50px_-16px_rgb(0_0_0/0.45)] backdrop-blur-2xl",
          "animate-in slide-in-from-bottom-4 duration-300",
        )}
      >
        {/* El avance se lee en el ancho, sin ocupar un renglón aparte */}
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-1000 ease-linear",
            descanso ? "bg-accent/10" : "bg-primary/10",
          )}
          style={{ width: `${avance * 100}%` }}
        />

        <span
          aria-hidden="true"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[2.5px] border-primary/30 border-t-primary"
          style={{ animation: "spin 3s linear infinite" }}
        />

        <div className="relative min-w-0 flex-1">
          <p className="text-caption uppercase tracking-[0.08em] text-muted-foreground">
            {descanso ? "Descanso" : "Enfocado en"}
          </p>
          <p className="truncate text-callout font-semibold text-foreground">{tarea.title}</p>
        </div>

        <span className="tabular relative text-title2 font-semibold text-foreground">{reloj}</span>

        <div className="relative flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setCorriendo((v) => !v)}
            aria-label={corriendo ? "Pausar" : "Continuar"}
            className="h-9 w-9 rounded-full"
          >
            {corriendo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            onClick={() => {
              onCompletar(tarea.id);
              onCerrar();
            }}
            aria-label="Marcar como hecha"
            title="Marcar como hecha"
            className="h-9 w-9 rounded-full"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCerrar}
            aria-label="Salir del enfoque"
            className="h-9 w-9 rounded-full text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

}
