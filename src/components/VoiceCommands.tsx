import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { describeAIError, showAIErrorToast } from "@/lib/aiErrors";
import { grabarWav, type Grabacion } from "@/lib/grabarWav";

interface VoiceCommandsProps {
  /** En modo compacto es un botón de ícono para la barra superior. */
  compact?: boolean;
  onVoiceCommand: (text: string) => void;
}

type Disponibilidad =
  | { estado: "revisando" }
  | { estado: "disponible" }
  | { estado: "no-disponible"; motivo: string };

/** Formatos en orden de preferencia: Chrome y Firefox graban webm/ogg, Safari solo mp4. */

/** Blob a base64 sin el prefijo "data:...;base64,". */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el audio grabado."));
    reader.readAsDataURL(blob);
  });
}

export const VoiceCommands = ({ onVoiceCommand, compact = false }: VoiceCommandsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>({ estado: "revisando" });
  const grabacionRef = useRef<Grabacion | null>(null);

  // Antes de dejar grabar, preguntar si el navegador puede grabar y si el
  // proveedor configurado transcribe. Así nadie graba para fallar al final.
  useEffect(() => {
    let cancelado = false;

    const revisar = async (): Promise<Disponibilidad> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return { estado: "no-disponible", motivo: "Este navegador no permite grabar audio." };
      }
      const { data, error } = await supabase.functions.invoke("voice-to-text", { method: "GET" });
      if (error) return { estado: "no-disponible", motivo: (await describeAIError(error)).message };
      if (!data?.available) {
        return { estado: "no-disponible", motivo: data?.reason ?? "El dictado no está disponible." };
      }
      return { estado: "disponible" };
    };

    revisar()
      .catch((e: Error) => ({ estado: "no-disponible" as const, motivo: e.message }))
      .then((d) => !cancelado && setDisponibilidad(d));

    return () => {
      cancelado = true;
    };
  }, []);

  const startRecording = async () => {
    try {
      // Se graba WAV de 16 kHz directo del micrófono: es lo único que lee
      // whisper.cpp, y con webm respondía 400.
      grabacionRef.current = await grabarWav();
      setIsRecording(true);
      toast.info("Grabando… habla ahora", {
        description: "Presiona el botón otra vez para detener",
      });
    } catch {
      toast.error("No se pudo usar el micrófono", {
        description: "Revisa que el navegador tenga permiso.",
      });
    }
  };

  const stopRecording = async () => {
    const grabacion = grabacionRef.current;
    if (!grabacion || !isRecording) return;

    grabacionRef.current = null;
    setIsRecording(false);
    const audio = await grabacion.detener();
    await processAudio(audio);
  };

  const processAudio = async (audioBlob: Blob) => {
    if (audioBlob.size === 0) {
      toast.error("No se grabó audio", { description: "Intenta de nuevo y habla un poco más." });
      return;
    }

    setIsProcessing(true);
    try {
      const base64Audio = await blobABase64(audioBlob);

      const { data, error } = await supabase.functions.invoke('voice-to-text', {
        body: { audio: base64Audio, mimeType: audioBlob.type }
      });

      if (error) throw error;

      if (data?.text) {
        onVoiceCommand(data.text);
        toast.success("Comando reconocido", {
          description: data.text
        });
      } else {
        toast.info("No se entendió nada", { description: "Intenta de nuevo, más cerca del micrófono." });
      }
    } catch (error) {
      showAIErrorToast(await describeAIError(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      void stopRecording();
    } else {
      void startRecording();
    }
  };

  const noDisponible = disponibilidad.estado === "no-disponible";

  // Versión compacta: un botón de ícono junto a "Nueva tarea". El motivo real de
  // por qué no se puede dictar viaja en el title, para no ocupar una tarjeta entera.
  if (compact) {
    const etiqueta = noDisponible
      ? `Dictado no disponible: ${disponibilidad.motivo}`
      : isRecording
        ? "Detener grabación"
        : "Dictar una tarea";

    return (
      <Button
        onClick={toggleRecording}
        disabled={isProcessing || disponibilidad.estado !== "disponible"}
        variant={isRecording ? "destructive" : "outline"}
        size="icon"
        title={etiqueta}
        aria-label={etiqueta}
      >
        {disponibilidad.estado === "revisando" || isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
    );
  }

  return (
    <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-secondary" />
          Comandos de Voz
        </CardTitle>
        <CardDescription id="voz-descripcion">
          {noDisponible
            ? `Dictado no disponible: ${disponibilidad.motivo}`
            : 'Di "crear tarea" y describe tu tarea'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={toggleRecording}
          disabled={isProcessing || disponibilidad.estado !== "disponible"}
          aria-describedby="voz-descripcion"
          variant={isRecording ? "destructive" : "secondary"}
          className="w-full"
        >
          {disponibilidad.estado === "revisando" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Revisando dictado...
            </>
          ) : isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Detener Grabación
            </>
          ) : noDisponible ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Dictado no disponible
            </>
          ) : (
            <>
              <Mic className="mr-2 h-4 w-4" />
              Grabar Comando
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
