import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ListaAgrupada, ListaVacia } from "@/components/ui/lista";
import { TaskCard, type Task } from "./TaskCard";
import { cn } from "@/lib/utils";

interface CalendarViewProps {
  tasks: Task[];
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, updates: Partial<Task>) => void;
  onEnfocar?: (task: Task) => void;
  /** Solo la cuadrícula, para vivir al lado de la lista en vez de sustituirla. */
  compacto?: boolean;
  /** Día elegido desde fuera, para que calendario y lista hablen del mismo día. */
  elegido?: Date;
  onElegir?: (dia: Date) => void;
}

const INICIALES = ["L", "M", "X", "J", "V", "S", "D"];

/** Un punto por tarea, hasta tres; el color solo distingue lo hecho de lo pendiente. */
const MAXIMO_PUNTOS = 3;

/**
 * Calendario del mes con la misma gramática que el resto de la app: una
 * superficie agrupada, tipografía de la misma escala y un solo acento.
 *
 * La versión anterior mezclaba el calendario con cinco bloques de estadísticas
 * (racha, avance de la semana, del mes, vencidas, próximas) que competían con la
 * cuadrícula y repetían lo que ya dice la pantalla principal. Aquí el calendario
 * hace una cosa: mostrar qué días tienen trabajo y dejar ver el día que elijas.
 */
export const CalendarView = ({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  onEnfocar,
  compacto = false,
  elegido: elegidoFuera,
  onElegir,
}: CalendarViewProps) => {
  const [mes, setMes] = useState(() => startOfMonth(new Date()));
  const [elegidoDentro, setElegidoDentro] = useState<Date>(() => new Date());
  const elegido = elegidoFuera ?? elegidoDentro;
  const elegir = (dia: Date) => {
    setElegidoDentro(dia);
    onElegir?.(dia);
  };

  const dias = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(mes), { weekStartsOn: 1 });
    const fin = endOfWeek(endOfMonth(mes), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: inicio, end: fin });
  }, [mes]);

  const tareasDe = useMemo(() => {
    return (dia: Date) =>
      tasks.filter(t => {
        const inicio = t.startDate ? new Date(t.startDate) : undefined;
        const limite = t.dueDate ? new Date(t.dueDate) : undefined;
        if (limite && isSameDay(limite, dia)) return true;
        if (inicio && isSameDay(inicio, dia)) return true;
        // Una tarea con rango ocupa todos los días intermedios
        if (inicio && limite) return isWithinInterval(dia, { start: inicio, end: limite });
        return false;
      });
  }, [tasks]);

  const delDia = tareasDe(elegido);
  const hoy = new Date();

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Mes y navegación */}
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="display text-title3 capitalize text-foreground">
            {format(mes, "LLLL yyyy", { locale: es })}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setMes(startOfMonth(hoy));
                elegir(hoy);
              }}
            >
              Hoy
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMes(subMonths(mes, 1))} aria-label="Mes anterior">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setMes(addMonths(mes, 1))} aria-label="Mes siguiente">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-t border-border px-2 pt-2">
          {INICIALES.map((inicial, i) => (
            <div key={i} className="pb-1 text-center text-caption text-muted-foreground">
              {inicial}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px px-2 pb-3">
          {dias.map(dia => {
            const delMes = isSameMonth(dia, mes);
            const esHoy = isSameDay(dia, hoy);
            const esElegido = isSameDay(dia, elegido);
            const deEseDia = tareasDe(dia);

            return (
              <button
                key={dia.toISOString()}
                type="button"
                onClick={() => elegir(dia)}
                aria-label={format(dia, "d 'de' MMMM", { locale: es })}
                aria-pressed={esElegido}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl transition-colors",
                  compacto ? "h-11" : "h-14",
                  !delMes && "text-muted-foreground/35",
                  delMes && "text-foreground hover:bg-muted/60",
                  esElegido && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <span className={cn("tabular text-footnote", esHoy && !esElegido && "font-bold text-primary")}>
                  {format(dia, "d")}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {deEseDia.slice(0, MAXIMO_PUNTOS).map(t => (
                    <span
                      key={t.id}
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        esElegido
                          ? "bg-primary-foreground/70"
                          : t.completed
                            ? "bg-muted-foreground/40"
                            : "bg-primary",
                      )}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!compacto && (
      <ListaAgrupada
        titulo={
          isSameDay(elegido, hoy)
            ? "Hoy"
            : format(elegido, "EEEE d 'de' MMMM", { locale: es }).replace(/^./, c => c.toUpperCase())
        }
        descripcion={delDia.length === 1 ? "1 tarea" : `${delDia.length} tareas`}
      >
        {delDia.length === 0 ? (
          <ListaVacia>Nada agendado para este día.</ListaVacia>
        ) : (
          delDia.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={onToggle ?? (() => {})}
              onDelete={onDelete ?? (() => {})}
              onEdit={onEdit}
              onEnfocar={onEnfocar ? () => onEnfocar(task) : undefined}
            />
          ))
        )}
      </ListaAgrupada>
      )}
    </div>
  );
};
