import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { describeAIError } from "@/lib/aiErrors";
import { grabarWav, type Grabacion } from "@/lib/grabarWav";
import { interpretarDictado } from "@/lib/dictado";
import { cn } from "@/lib/utils";
import type { Task } from "./TaskCard";

type Estado = "escuchando" | "transcribiendo" | "listo" | "error";

interface VoiceCaptureProps {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  onCrear: (tarea: Omit<Task, "id" | "createdAt">) => void;
}

const BARRAS = 9;
/** Cada cuánto se pide un avance mientras alguien habla. */
const CADA_MS = 2500;
/** Menos de esto no vale la pena mandar: Whisper devuelve ruido. */
const MINIMO_SEGUNDOS = 1.2;

/**
 * Ventana de dictado. Muestra lo que está pasando en cada momento —te escucho,
 * estoy escribiendo, esto entendí— en vez de dejar al usuario a ciegas hasta que
 * aparece un aviso. El texto se puede corregir antes de guardar, porque ningún
 * transcriptor acierta siempre.
 */
export function VoiceCapture({ abierto, onOpenChange, onCrear }: VoiceCaptureProps) {
  const [estado, setEstado] = useState<Estado>("escuchando");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState("");
  const [nivel, setNivel] = useState(0);
  /** Lo que se lleva entendido mientras se habla; se va reemplazando. */
  const [avance, setAvance] = useState("");
  const grabacionRef = useRef<Grabacion | null>(null);
  const enVueloRef = useRef(false);

  const comenzar = async () => {
    setTexto("");
    setAvance("");
    setError("");
    setEstado("escuchando");
    try {
      grabacionRef.current = await grabarWav({ onNivel: setNivel });
    } catch {
      setError("No se pudo usar el micrófono. Revisa que el navegador tenga permiso.");
      setEstado("error");
    }
  };

  const detener = async () => {
    const grabacion = grabacionRef.current;
    if (!grabacion) return;
    grabacionRef.current = null;
    setNivel(0);
    setEstado("transcribiendo");
    // Si ya había avance, se muestra mientras llega la versión final.
    if (avance) setTexto(avance);

    try {
      const audio = await grabacion.detener();
      const base64 = await blobABase64(audio);
      const { data, error: fallo } = await supabase.functions.invoke("voice-to-text", {
        body: { audio: base64, mimeType: "audio/wav" },
      });
      if (fallo) throw fallo;

      const dicho = (data?.text ?? "").trim();
      if (!dicho) {
        setError("No se entendió nada. Intenta otra vez, más cerca del micrófono.");
        setEstado("error");
        return;
      }
      setTexto(dicho);
      setEstado("listo");
    } catch (e) {
      setError((await describeAIError(e)).message);
      setEstado("error");
    }
  };

  // Avances mientras se habla. Whisper no transcribe en vivo, así que cada pocos
  // segundos se le manda todo lo dicho hasta ahora y se reemplaza el texto. Nunca
  // hay dos peticiones a la vez: si la anterior no ha vuelto, este turno se salta.
  useEffect(() => {
    if (estado !== "escuchando") return;

    const id = setInterval(async () => {
      const grabacion = grabacionRef.current;
      if (!grabacion || enVueloRef.current) return;
      if (grabacion.duracion() < MINIMO_SEGUNDOS) return;

      enVueloRef.current = true;
      try {
        const base64 = await blobABase64(grabacion.instantanea());
        const { data } = await supabase.functions.invoke("voice-to-text", {
          body: { audio: base64, mimeType: "audio/wav", parcial: true },
        });
        const dicho = (data?.text ?? "").trim();
        // Puede haber terminado de grabar mientras esto iba en camino.
        if (dicho && grabacionRef.current) setAvance(dicho);
      } catch {
        // Un avance que falla no importa: al detener se transcribe completo.
      } finally {
        enVueloRef.current = false;
      }
    }, CADA_MS);

    return () => clearInterval(id);
  }, [estado]);

  // Al abrir se empieza a grabar solo: si alguien abrió el dictado, es para dictar.
  useEffect(() => {
    if (abierto) void comenzar();
    return () => {
      grabacionRef.current?.cancelar();
      grabacionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const guardar = () => {
    const limpio = texto.trim();
    if (!limpio) return;
    onCrear(interpretarDictado(limpio));
    onOpenChange(false);
  };

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dictar una tarea</DialogTitle>
          <DialogDescription>
            Habla normal: "comprar café mañana", "llamar al dentista el viernes".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Lo que dijiste, en forma de burbuja, como en un chat */}
          <div className="min-h-28 rounded-2xl bg-muted/60 p-4">
            {estado === "escuchando" && (
              <div className="flex min-h-20 flex-col items-center justify-center gap-3">
                <div className="flex h-10 items-end gap-1" aria-hidden="true">
                  {Array.from({ length: BARRAS }).map((_, i) => {
                    // El centro se mueve más que los extremos: se ve como una voz
                    const peso = 1 - Math.abs(i - (BARRAS - 1) / 2) / BARRAS;
                    const alto = 6 + nivel * 34 * (0.45 + peso);
                    return (
                      <span
                        key={i}
                        className="w-1.5 rounded-full bg-primary transition-[height] duration-75"
                        style={{ height: `${alto}px` }}
                      />
                    );
                  })}
                </div>
                {avance ? (
                  <p className="text-center text-body text-foreground">
                    {avance}
                    <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-primary" />
                  </p>
                ) : (
                  <p className="text-footnote text-muted-foreground">Te escucho…</p>
                )}
              </div>
            )}

            {estado === "transcribiendo" && (
              <div className="flex h-20 items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-footnote">Escribiendo lo que dijiste…</span>
              </div>
            )}

            {estado === "listo" && (
              <div className="space-y-2">
                <p className="text-caption text-muted-foreground">Esto entendí. Corrígelo si hace falta:</p>
                <Textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  autoFocus
                  className="resize-none bg-background text-body"
                />
              </div>
            )}

            {estado === "error" && (
              <div className="flex h-20 items-center justify-center px-2">
                <p className="text-center text-footnote text-destructive">{error}</p>
              </div>
            )}
          </div>

          <div className={cn("flex gap-2", estado === "listo" ? "justify-between" : "justify-center")}>
            {estado === "escuchando" && (
              <Button onClick={detener} className="gap-2">
                <Square className="h-4 w-4" />
                Listo, ya dije
              </Button>
            )}

            {estado === "transcribiendo" && (
              <Button disabled variant="outline" className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Un momento
              </Button>
            )}

            {(estado === "listo" || estado === "error") && (
              <>
                <Button variant="outline" onClick={comenzar} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Repetir
                </Button>
                {estado === "listo" && (
                  <Button onClick={guardar} className="gap-2">
                    <Mic className="h-4 w-4" />
                    Crear tarea
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      resolve(resultado.split(",")[1] ?? "");
    };
    lector.onerror = reject;
    lector.readAsDataURL(blob);
  });
}
