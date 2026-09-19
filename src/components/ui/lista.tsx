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
  acciones,
  children,
  className,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {(titulo || acciones) && (
        <header className="mb-2 flex items-end justify-between gap-3 px-1">
          <div>
            {titulo && <h2 className="text-title3 font-semibold text-foreground">{titulo}</h2>}
            {descripcion && <p className="text-footnote text-muted-foreground">{descripcion}</p>}
          </div>
          {acciones}
        </header>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
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
