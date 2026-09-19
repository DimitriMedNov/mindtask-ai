import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Los avisos bajan desde arriba, al centro, como los de iOS.
 * Antes aparecían en la esquina de abajo a la derecha, que es la convención de
 * las apps de escritorio web y queda lejos de donde está la atención: en esta
 * app el usuario mira el encabezado y la lista, no la esquina.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      offset={16}
      gap={8}
      duration={3500}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border-border/60 " +
            "group-[.toaster]:bg-card/85 group-[.toaster]:backdrop-blur-xl " +
            "group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.35)]",
          title: "group-[.toast]:text-callout group-[.toast]:font-medium",
          description: "group-[.toast]:text-footnote group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
