import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VoiceCommandsProps {
  onVoiceCommand: (text: string) => void;
}

export const VoiceCommands = ({ onVoiceCommand }: VoiceCommandsProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Grabando... Habla ahora", {
        description: "Presiona el botón nuevamente para detener"
      });
    } catch (error) {
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
    setIsProcessing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        const { data, error } = await supabase.functions.invoke('voice-to-text', {
          body: { audio: base64Audio }
        });

        if (error) throw error;

        if (data.text) {
          onVoiceCommand(data.text);
          toast.success("Comando reconocido", {
            description: data.text
          });
        }
      };
    } catch (error: any) {
      toast.error("Error al procesar audio", {
        description: error.message
      });
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

  return (
    <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5 text-secondary" />
          Comandos de Voz
        </CardTitle>
        <CardDescription>
          Di "crear tarea" y describe tu tarea
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={toggleRecording}
          disabled={isProcessing}
          variant={isRecording ? "destructive" : "secondary"}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Procesando...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="mr-2 h-4 w-4" />
              Detener Grabación
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