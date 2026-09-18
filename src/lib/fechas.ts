import { differenceInCalendarDays, format, isSameYear } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Postgres devuelve las fechas de tipo date como "2026-09-18". `new Date()` las
 * interpreta como UTC, así que en México se corrían un día hacia atrás: una tarea
 * que vencía hoy aparecía como "Venció ayer". Aquí se arman en hora local.
 */
export function fechaLocal(valor: string | Date | null | undefined): Date | undefined {
  if (!valor) return undefined;
  if (valor instanceof Date) return valor;
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/.exec(valor);
  if (soloFecha) {
    const [anio, mes, dia] = valor.split("-").map(Number);
    return new Date(anio, mes - 1, dia);
  }
  return new Date(valor);
}

export type EstadoVencimiento = "vencida" | "hoy" | "pronto" | "lejos";

/**
 * Convierte una fecha límite en algo que se lee de un vistazo.
 * Antes cada tarea mostraba tres fechas casi iguales ("17 sep · Inicio: 17 sep ·
 * Límite: 18 sep"); lo que de verdad importa es cuánto falta.
 */
export function describirVencimiento(fecha: Date, hoy = new Date()) {
  const dias = differenceInCalendarDays(fecha, hoy);

  let texto: string;
  if (dias === 0) texto = "Vence hoy";
  else if (dias === 1) texto = "Vence mañana";
  else if (dias === -1) texto = "Venció ayer";
  else if (dias < -1 && dias >= -6) texto = `Venció hace ${Math.abs(dias)} días`;
  else if (dias > 1 && dias <= 6) texto = `Vence en ${dias} días`;
  else {
    const formato = isSameYear(fecha, hoy) ? "d 'de' MMMM" : "d MMM yyyy";
    texto = `${dias < 0 ? "Venció el" : "Vence el"} ${format(fecha, formato, { locale: es })}`;
  }

  const estado: EstadoVencimiento =
    dias < 0 ? "vencida" : dias === 0 ? "hoy" : dias <= 3 ? "pronto" : "lejos";

  return { texto, estado, dias };
}

/** Color solo cuando urge: lo demás se queda en gris para no gritar. */
export const colorVencimiento: Record<EstadoVencimiento, string> = {
  vencida: "text-destructive",
  hoy: "text-accent-foreground",
  pronto: "text-foreground",
  lejos: "text-muted-foreground",
};
