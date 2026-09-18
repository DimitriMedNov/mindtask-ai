import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

/**
 * Un clic, un cambio. Sin menú de por medio.
 * Mientras nadie lo toca, la app sigue el tema del sistema; al primer clic
 * el usuario manda y su elección se recuerda.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  // El tema real solo se conoce en el navegador; antes de eso se pinta el icono
  // neutro para que no parpadee al cargar.
  useEffect(() => setMontado(true), []);

  const esOscuro = resolvedTheme === "dark";
  const siguiente = esOscuro ? "claro" : "oscuro";

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(esOscuro ? "light" : "dark")}
      title={`Cambiar a tema ${siguiente}`}
      aria-label={`Cambiar a tema ${siguiente}`}
    >
      {montado && esOscuro ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
