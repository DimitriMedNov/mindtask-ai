# Auditoría visual del dashboard

Revisión de `/dashboard` contra las Human Interface Guidelines de Apple
(`~/.claude/skills/apple-design/references/hig/`), hecha sobre el entorno local
con datos de ejemplo. Es un diagnóstico: no toca código.

---

## 1. Las cuatro tarjetas de arriba pesan lo mismo

**Qué pasa.** Asistente IA, Pomodoro, Tu Progreso y Comandos de Voz ocupan el mismo
ancho, el mismo alto, el mismo fondo y el mismo tamaño de título. La única que
destaca es Pomodoro, y solo porque tiene un borde de color y un número gigante.

**Por qué importa.** `layout.md › Visual hierarchy` pide colocar los elementos según
su importancia relativa, empezando por arriba y por la izquierda. Aquí las cuatro
compiten y ninguna gana, así que el ojo no sabe dónde empezar. Peor: la tarjeta
visualmente más fuerte (Pomodoro) no es la razón por la que alguien abre una app de
tareas.

**Cómo se arregla.** Decidir cuál es la acción principal — probablemente "Nueva
tarea" o el asistente — y darle una jerarquía distinta: más ancho, o un lugar
propio arriba. Las otras tres bajan a una fila de controles secundarios, más
compactos y sin borde de color.

---

## 2. La jerarquía tipográfica es plana

**Qué pasa.** El título de cada tarjeta, los números de progreso y las etiquetas de
los contadores se mueven en un rango muy estrecho de tamaño y peso. "Total 10",
"Completadas 4" y "Pendientes 6" se ven casi igual de importantes que el nombre de
una tarea.

**Por qué importa.** `typography.md › Conveying hierarchy` dice que el peso, el
tamaño y el color son lo que comunica la jerarquía. Cuando todo pesa parecido, el
usuario tiene que leer todo para encontrar lo que busca.

**Cómo se arregla.** Definir una escala de tres o cuatro niveles y usarla: título de
pantalla, título de sección, cuerpo y etiqueta. Los números de los contadores deben
ser lo prominente de su bloque, y sus etiquetas bajar a texto secundario.

---

## 3. Tres contadores ocupan una fila entera

**Qué pasa.** Total, Completadas y Pendientes toman todo el ancho para mostrar tres
números de una o dos cifras. Debajo viene otra fila con el selector Lista/Calendario
y otra más con los filtros Todas/Activas/Completadas.

**Por qué importa.** Son tres filas seguidas de controles antes de llegar al
contenido real, que son las tareas. `layout.md` pide agrupar controles relacionados
en secciones lógicas; aquí hay tres grupos separados haciendo trabajo parecido:
resumir y filtrar.

**Cómo se arregla.** Fundir los contadores con los filtros: "Todas 10", "Activas 6",
"Completadas 4" en un solo control segmentado. Se ahorra una fila completa, el
número queda junto a la acción que lo usa, y el contenido sube.

---

## 4. La lista de tareas desperdicia el ancho

**Qué pasa.** Cada tarjeta de tarea ocupa todo el ancho de la pantalla para mostrar
un título corto, una descripción de una línea y tres etiquetas pequeñas. En una
pantalla de 1500 px hay un vacío enorme a la derecha, y los botones de editar y
borrar quedan lejísimos del texto.

**Por qué importa.** `boxes.md` recomienda no encerrar contenido en una caja cuando
la caja no agrupa nada: aquí cada tarea es su propia caja con sombra, lo que suma
ruido sin agregar significado. Y por la distancia, para editar hay que cruzar la
pantalla con el cursor.

**Cómo se arregla.** Dos caminos: una lista más densa con separadores en vez de
tarjetas, o una rejilla de dos columnas en pantallas anchas. En ambos, acercar las
acciones al contenido.

---

## 5. La fecha se repite tres veces por tarea

**Qué pasa.** Cada tarea muestra "17 sep · Inicio: 17 sep · Límite: 18 sep". Tres
fechas casi idénticas, con tres iconos distintos, en el renglón más pequeño.

**Por qué importa.** La primera fecha (creación) casi nunca le importa a nadie, y al
repetirse hace que las dos que sí importan pierdan fuerza.

**Cómo se arregla.** Mostrar solo el límite, y en lenguaje humano: "Vence mañana",
"Venció hace 2 días", con color solo cuando está vencida o vence hoy. Lo demás, al
detalle de la tarea.

---

## 6. El mensaje de "Dictado no disponible" dice algo que no es

**Qué pasa.** La tarjeta de Comandos de Voz dice *"La IA no está configurada en este
despliegue"*, pero la IA **sí** está configurada: es Ollama, que simplemente no
transcribe audio. La función del servidor devuelve el motivo correcto
(`"El proveedor configurado (ollama) no transcribe audio"`), pero la interfaz no lo
usa y muestra un texto genérico.

**Por qué importa.** `feedback.md` y el criterio de redacción de la guía piden que un
mensaje diga qué pasó y qué hacer. Este manda al usuario a revisar una configuración
que ya está bien.

**Cómo se arregla.** Mostrar el campo `reason` que ya viene en la respuesta, y
sugerir la salida: configurar `AI_STT_BASE_URL` con un servidor de transcripción, o
cambiar a un proveedor que sí la tenga.

**Nota:** esto es un error funcional, no de estilo. Va directo al agente que está
trabajando en las funciones.

---

## 7. No hay estado de carga visible

**Qué pasa.** Al pedir sugerencias con un modelo local, la respuesta tarda entre 10 y
40 segundos. En ese tiempo el botón se ve igual y no aparece nada.

**Por qué importa.** `loading.md › Showing progress` pide mostrar que algo está
ocurriendo en cuanto empieza, para que la espera no se lea como una falla.

**Cómo se arregla.** Botón en estado de carga, y un bloque con la forma del
resultado (tres renglones grises) mientras llega. Con modelos locales, avisar que
puede tardar.

---

## 8. El panel de sugerencias entra de golpe

**Qué pasa.** Cuando llegan las sugerencias, el panel aparece de una vez y empuja
hacia abajo todo el contenido. Si el usuario estaba leyendo su lista, se le mueve.

**Por qué importa.** El movimiento inesperado del contenido rompe la lectura, y la
guía pide que las transiciones expliquen de dónde salió lo nuevo.

**Cómo se arregla.** Entrada con una transición corta, respetando
`prefers-reduced-motion`, y reservar el espacio desde que empieza la carga para que
nada salte.

---

## Orden sugerido

1. **El punto 6**, porque es un error de verdad, no de gusto.
2. **Puntos 1, 2 y 3**: la jerarquía de la parte de arriba. Es lo que más cambia la
   percepción de la app con menos trabajo.
3. **Puntos 4 y 5**: la lista de tareas, que es donde el usuario pasa el tiempo.
4. **Puntos 7 y 8**: los estados de carga, que importan más aquí que en una app
   normal porque el modelo local es lento.

## Lo que no hay que romper

- El contraste ya es correcto en los textos principales.
- Las áreas táctiles de los botones ya cumplen el mínimo.
- La app es responsiva y no se desborda a lo ancho en pantallas chicas.
- El idioma de la interfaz es consistente en español.
