import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Lista agrupada, como las de Ajustes en iOS y macOS.
 *
 * En vez de que cada elemento sea su propia tarjeta con sombra —que multiplica
 * bordes y hace que todo pese igual—, el grupo entero es una sola superficie
 * redondeada y los elementos se separan con una línea de un pixel.
 */
export function ListaAgrupada({
  titulo,
  descripcion,
  cuenta,
  tono,
  acciones,
  children,
  className,
}: {
  titulo?: string;
  descripcion?: string;
  /** Va a la derecha del encabezado, alineado con el borde del grupo. */
  cuenta?: number;
  /** "alerta" pinta el encabezado de rojo: se usa solo en lo vencido. */
  tono?: "alerta";
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(titulo || acciones) && (
        <header className="mb-1.5 flex items-center justify-between gap-3 px-1">
          <div className="flex items-baseline gap-2">
            {titulo && (
              <h2
                className={cn(
                  "text-footnote font-semibold",
                  tono === "alerta" ? "text-destructive" : "text-foreground",
                )}
              >
                {titulo}
              </h2>
            )}
            {descripcion && <p className="text-caption text-muted-foreground">{descripcion}</p>}
          </div>
          <div className="flex items-center gap-2">
            {acciones}
            {typeof cuenta === "number" && (
              <span className="tabular text-footnote text-muted-foreground">{cuenta}</span>
            )}
          </div>
        </header>
      )}
      {/* Sin borde: la separación la hace el fondo de la página, como en iOS */}
      <div className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)]">
        {children}
      </div>
    </section>
  );
}

/** Un renglón de la lista. Con `onClick` se comporta como control. */
export function Fila({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const clases = cn(
    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
    onClick && "hover:bg-muted/60 focus-visible:bg-muted/60",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={clases}>
        {children}
      </button>
    );
  }
  return <div className={clases}>{children}</div>;
}

/** Fila de dato: etiqueta a la izquierda, valor a la derecha. */
export function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <Fila className="justify-between">
      <span className="text-body text-foreground">{etiqueta}</span>
      <span className="tabular text-body font-medium text-foreground">{valor}</span>
    </Fila>
  );
}

/** Cuando no hay nada que mostrar, se dice en una sola línea y sin drama. */
export function ListaVacia({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-footnote text-muted-foreground">{children}</p>;
}

/** Anillo de avance: el mismo dato que una barra, pero ocupa menos y se lee igual. */
export function Anillo({ avance, tamano = 52 }: { avance: number; tamano?: number }) {
  const radio = (tamano - 6) / 2;
  const vuelta = 2 * Math.PI * radio;

  return (
    <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true">
      <circle
        cx={tamano / 2}
        cy={tamano / 2}
        r={radio}
        fill="none"
        stroke="hsl(var(--secondary))"
        strokeWidth="6"
      />
      <circle
        cx={tamano / 2}
        cy={tamano / 2}
        r={radio}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${vuelta * Math.min(1, Math.max(0, avance))} ${vuelta}`}
        transform={`rotate(-90 ${tamano / 2} ${tamano / 2})`}
        style={{ transition: "stroke-dasharray 400ms var(--ease, ease)" }}
      />
    </svg>
  );
}
