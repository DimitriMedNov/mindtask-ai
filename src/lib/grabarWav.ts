/**
 * Grabadora que entrega WAV de 16 kHz en mono.
 *
 * MediaRecorder graba en webm o mp4 según el navegador, y whisper.cpp solo lee
 * WAV: con webm respondía 400 "Invalid request". En vez de convertir del lado
 * del servidor (que pediría ffmpeg dentro de la Edge Function), aquí se toma el
 * audio crudo del micrófono y se arma el WAV en el navegador. De paso el archivo
 * pesa menos, porque 16 kHz mono es justo lo que Whisper necesita.
 */

const FRECUENCIA_DESTINO = 16000;

export type OpcionesGrabacion = {
  /** Se llama muchas veces por segundo con el volumen actual, de 0 a 1. */
  onNivel?: (nivel: number) => void;
};

export type Grabacion = {
  /** Corta la grabación, suelta el micrófono y devuelve el WAV. */
  detener: () => Promise<Blob>;
  /** WAV de lo grabado hasta ahora, sin cortar. Sirve para ir transcribiendo en vivo. */
  instantanea: () => Blob;
  /** Segundos grabados hasta ahora. */
  duracion: () => number;
  /** Suelta el micrófono sin producir nada, por si el usuario cancela. */
  cancelar: () => void;
};

export async function grabarWav({ onNivel }: OpcionesGrabacion = {}): Promise<Grabacion> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const AudioCtx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexto = new AudioCtx();
  const fuente = contexto.createMediaStreamSource(stream);

  // ScriptProcessor está marcado como obsoleto, pero es lo único que funciona
  // igual en todos los navegadores sin cargar un AudioWorklet aparte.
  const procesador = contexto.createScriptProcessor(4096, 1, 1);
  const trozos: Float32Array[] = [];

  procesador.onaudioprocess = (evento) => {
    const entrada = evento.inputBuffer.getChannelData(0);
    // Hay que copiar: el buffer se reutiliza en el siguiente ciclo.
    trozos.push(new Float32Array(entrada));

    if (onNivel) {
      // Volumen eficaz del trozo, para mover las barras mientras alguien habla.
      let suma = 0;
      for (let i = 0; i < entrada.length; i++) suma += entrada[i] * entrada[i];
      onNivel(Math.min(1, Math.sqrt(suma / entrada.length) * 4));
    }
  };

  fuente.connect(procesador);
  procesador.connect(contexto.destination);

  const soltar = () => {
    procesador.disconnect();
    fuente.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void contexto.close();
  };

  const armar = () => {
    const muestras = unir(trozos);
    return aWav(remuestrear(muestras, contexto.sampleRate, FRECUENCIA_DESTINO), FRECUENCIA_DESTINO);
  };

  return {
    detener: async () => {
      const wav = armar();
      soltar();
      return wav;
    },
    // Se arma sobre lo acumulado, sin tocar la grabación: Whisper no transcribe
    // en vivo, así que se le manda todo lo dicho hasta el momento y se reemplaza
    // el texto. Sale más coherente que pegar pedacitos sueltos.
    instantanea: armar,
    duracion: () => trozos.reduce((suma, t) => suma + t.length, 0) / contexto.sampleRate,
    cancelar: soltar,
  };
}

function unir(trozos: Float32Array[]): Float32Array {
  const total = trozos.reduce((suma, t) => suma + t.length, 0);
  const salida = new Float32Array(total);
  let offset = 0;
  for (const t of trozos) {
    salida.set(t, offset);
    offset += t.length;
  }
  return salida;
}

/** Promedio de las muestras que caen en cada paso: evita el chirrido de tomar una sí y otra no. */
function remuestrear(muestras: Float32Array, desde: number, hasta: number): Float32Array {
  if (desde === hasta) return muestras;

  const proporcion = desde / hasta;
  const salida = new Float32Array(Math.round(muestras.length / proporcion));
  let posicionSalida = 0;
  let posicionEntrada = 0;

  while (posicionSalida < salida.length) {
    const siguiente = Math.round((posicionSalida + 1) * proporcion);
    let suma = 0;
    let cuenta = 0;
    for (let i = posicionEntrada; i < siguiente && i < muestras.length; i++) {
      suma += muestras[i];
      cuenta++;
    }
    salida[posicionSalida] = cuenta > 0 ? suma / cuenta : 0;
    posicionSalida++;
    posicionEntrada = siguiente;
  }

  return salida;
}

/** WAV de 16 bits: cabecera de 44 bytes y las muestras en enteros con signo. */
function aWav(muestras: Float32Array, frecuencia: number): Blob {
  const buffer = new ArrayBuffer(44 + muestras.length * 2);
  const vista = new DataView(buffer);

  const texto = (offset: number, valor: string) => {
    for (let i = 0; i < valor.length; i++) vista.setUint8(offset + i, valor.charCodeAt(i));
  };

  texto(0, "RIFF");
  vista.setUint32(4, 36 + muestras.length * 2, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  vista.setUint32(16, 16, true); // tamaño del bloque fmt
  vista.setUint16(20, 1, true); // PCM sin comprimir
  vista.setUint16(22, 1, true); // un canal
  vista.setUint32(24, frecuencia, true);
  vista.setUint32(28, frecuencia * 2, true); // bytes por segundo
  vista.setUint16(32, 2, true); // bytes por muestra
  vista.setUint16(34, 16, true); // bits por muestra
  texto(36, "data");
  vista.setUint32(40, muestras.length * 2, true);

  let offset = 44;
  for (let i = 0; i < muestras.length; i++) {
    const s = Math.max(-1, Math.min(1, muestras[i]));
    vista.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
