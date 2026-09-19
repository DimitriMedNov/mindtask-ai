import { cn } from "@/lib/utils";

/**
 * El símbolo de MindTask: un anillo con una muesca arriba.
 *
 * Es el mismo anillo que mide el avance del día y el bloque de enfoque, así que
 * la marca y la función son la misma figura. La muesca marca dónde empieza el
 * tiempo, como la aguja de un reloj en las doce.
 */
export function Marca({ className, size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.35" />
      <path
        d="M12 3a9 9 0 0 1 7.79 4.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.25" fill="currentColor" />
    </svg>
  );
}

/** Símbolo más nombre, como aparece en la barra superior. */
export function Logotipo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Marca className="text-primary" />
      <span className="display text-callout tracking-tight text-foreground">MindTask</span>
    </span>
  );
}
