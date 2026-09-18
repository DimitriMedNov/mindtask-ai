import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

/**
 * Tres estados, no dos: claro, oscuro y "el del sistema", que es el que trae por
 * defecto. Así quien tiene su Mac en automático no pelea con la app.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = useState(false);

  // El tema real solo se conoce en el navegador; antes de eso se pinta el icono
  // neutro para que no parpadee al cargar.
  useEffect(() => setMontado(true), []);

  const opciones = [
    { valor: "light", texto: "Claro", Icono: Sun },
    { valor: "dark", texto: "Oscuro", Icono: Moon },
    { valor: "system", texto: "El del sistema", Icono: Monitor },
  ] as const;

  const actual = opciones.find((o) => o.valor === theme) ?? opciones[2];
  const IconoActual = montado ? actual.Icono : Monitor;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Tema: ${actual.texto}. Cambiar tema`}>
          <IconoActual className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {opciones.map(({ valor, texto, Icono }) => (
          <DropdownMenuItem
            key={valor}
            onClick={() => setTheme(valor)}
            className={theme === valor ? "font-medium" : undefined}
          >
            <Icono className="mr-2 h-4 w-4" />
            {texto}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
