import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, ChevronDown, Flag, Plus, Tag } from "lucide-react";
import { interpretarDictado } from "@/lib/dictado";
import { describirVencimiento } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { Task } from "./TaskCard";

type AddTaskDialogProps = {
  onAddTask: (task: Omit<Task, "id" | "createdAt">) => void;
};

const PRIORIDADES: Array<{ valor: Task["priority"]; texto: string }> = [
  { valor: "low", texto: "Baja" },
  { valor: "medium", texto: "Media" },
  { valor: "high", texto: "Alta" },
];

const CATEGORIAS = ["Personal", "Trabajo", "Salud", "Estudio"];

/**
 * Crear una tarea es escribir una frase.
 *
 * Antes eran seis campos: título, descripción, prioridad, categoría, fecha de
 * inicio y fecha límite. Para "comprar café mañana" eso son cinco decisiones de
 * más. Aquí se escribe la frase y el mismo intérprete que usa el dictado saca la
 * fecha, la prioridad y la categoría; se muestran como etiquetas para que se vea
 * qué entendió, y se pueden cambiar con un clic si le erró.
 */
export function AddTaskDialog({ onAddTask }: AddTaskDialogProps) {
  const [abierto, setAbierto] = useState(false);
  const [frase, setFrase] = useState("");
  const [detalle, setDetalle] = useState("");
  const [masOpciones, setMasOpciones] = useState(false);
  /** Ajustes manuales que ganan sobre lo interpretado. */
  const [prioridad, setPrioridad] = useState<Task["priority"] | null>(null);
  const [categoria, setCategoria] = useState<string | null>(null);

  const leido = useMemo(() => (frase.trim() ? interpretarDictado(frase) : null), [frase]);

  const limpiar = () => {
    setFrase("");
    setDetalle("");
    setPrioridad(null);
    setCategoria(null);
    setMasOpciones(false);
  };

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leido) return;

    onAddTask({
      ...leido,
      description: detalle.trim() || undefined,
      priority: prioridad ?? leido.priority,
      category: categoria ?? leido.category,
    });

    limpiar();
    setAbierto(false);
  };

  const prioridadFinal = prioridad ?? leido?.priority ?? "medium";
  const categoriaFinal = categoria ?? leido?.category ?? "Personal";
  const vencimiento = leido?.dueDate ? describirVencimiento(leido.dueDate) : null;

  return (
    <Dialog
      open={abierto}
      onOpenChange={(v) => {
        setAbierto(v);
        if (!v) limpiar();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva tarea</DialogTitle>
          <DialogDescription>
            Escríbela como la dirías: "llamar al dentista el viernes", "mandar el reporte urgente".
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={guardar} className="space-y-4">
          <Input
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            placeholder="¿Qué hay que hacer?"
            autoFocus
            className="h-12 text-callout"
          />

          {/* Lo que entendió, visible antes de guardar */}
          {leido && (
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta icono={<Tag className="h-3.5 w-3.5" />}>{categoriaFinal}</Etiqueta>
              <Etiqueta
                icono={<Flag className="h-3.5 w-3.5" />}
                tono={prioridadFinal === "high" ? "alerta" : undefined}
              >
                {PRIORIDADES.find((p) => p.valor === prioridadFinal)?.texto}
              </Etiqueta>
              {vencimiento && (
                <Etiqueta icono={<CalendarClock className="h-3.5 w-3.5" />}>{vencimiento.texto}</Etiqueta>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setMasOpciones((v) => !v)}
            className="flex items-center gap-1 text-footnote text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", masOpciones && "rotate-180")} />
            {masOpciones ? "Menos opciones" : "Ajustar"}
          </button>

          {masOpciones && (
            <div className="animate-in fade-in slide-in-from-top-1 space-y-4 duration-150">
              <Textarea
                value={detalle}
                onChange={(e) => setDetalle(e.target.value)}
                placeholder="Detalles, si hacen falta"
                rows={2}
                className="resize-none"
              />

              <div className="space-y-2">
                <p className="text-caption uppercase tracking-wide text-muted-foreground">Prioridad</p>
                <div className="inline-flex rounded-xl bg-secondary p-1">
                  {PRIORIDADES.map(({ valor, texto }) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setPrioridad(valor)}
                      aria-pressed={prioridadFinal === valor}
                      className={cn(
                        "rounded-lg px-3 py-1.5 text-footnote transition-colors",
                        prioridadFinal === valor
                          ? "bg-card font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-caption uppercase tracking-wide text-muted-foreground">Categoría</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoria(c)}
                      aria-pressed={categoriaFinal === c}
                      className={cn(
                        "rounded-full border px-3 py-1 text-footnote transition-colors",
                        categoriaFinal === c
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <Button type="submit" disabled={!leido} className="w-full">
            Agregar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Etiqueta({
  icono,
  children,
  tono,
}: {
  icono: React.ReactNode;
  children: React.ReactNode;
  tono?: "alerta";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption",
        tono === "alerta" ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground",
      )}
    >
      {icono}
      {children}
    </span>
  );
}
