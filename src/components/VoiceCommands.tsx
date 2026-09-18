import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { describeAIError, showAIErrorToast } from "@/lib/aiErrors";

interface VoiceCommandsProps {
  onVoiceCommand: (text: string) => void;
}

type Disponibilidad =
  | { estado: "revisando" }
  | { estado: "disponible" }
  | { estado: "no-disponible"; motivo: string };

/** Formatos en orden de preferencia: Chrome y Firefox graban webm/ogg, Safari solo mp4. */
const FORMATOS = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

/** Blob a base64 sin el prefijo "data:...;base64,". */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el audio grabado."));
    reader.readAsDataURL(blob);
  });
}

export const VoiceCommands = ({ onVoiceCommand }: VoiceCommandsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>({ estado: "revisando" });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Antes de dejar grabar, preguntar si el navegador puede grabar y si el
  // proveedor configurado transcribe. Así nadie graba para fallar al final.
  useEffect(() => {
    let cancelado = false;

    const revisar = async (): Promise<Disponibilidad> => {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
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
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = FORMATOS.find((f) => MediaRecorder.isTypeSupported(f));
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      const pista = stream;
      mediaRecorder.onstop = async () => {
        pista.getTracks().forEach(track => track.stop());
        // El tipo real lo decide el navegador; no siempre es webm
        const audioBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Grabando... Habla ahora", {
        description: "Presiona el botón nuevamente para detener"
      });
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      toast.error("Error al acceder al micrófono", {
        description: "Asegúrate de dar permisos al navegador"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
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
      stopRecording();
    } else {
      startRecording();
    }
  };

  const noDisponible = disponibilidad.estado === "no-disponible";

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
