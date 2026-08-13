# Usura Design System

Sistema de diseño de **Usura**, la app personal de finanzas de Tievo. PWA mono-usuario (React + Vite + TS), offline-first con Supabase. Se usa a diario en el celular y se consulta en desktop. Idioma: español rioplatense, `vos`.

Reemplaza a **Meow Money Manager** y complementa a **Splitwise**.

## Origen del sistema

No viene de un Figma: se derivó de tres direcciones visuales presentadas en `docs/direcciones-visuales.html` sobre datos reales (2.5 años de gastos exportados de Meow). Se eligió la dirección **B — «Instrumento»**.

Documentos hermanos, fuera de este directorio:
- `docs/ESPECIFICACION.md` — decisiones de producto, modelo de datos, iteraciones.
- `docs/CATEGORIAS.md` — las 17 categorías de gasto y 7 de ingreso, con sus subcategorías.

## La dirección: «Instrumento»

Un panel de medición, oscuro y calmo. **Ámbar sobre carbón cálido.**

Tres ideas que gobiernan todas las decisiones que siguen:

1. **El monto es una lectura, no un titular.** El total del mes vive arriba a la izquierda en cuerpo mediano. La pantalla principal es la lista de movimientos, no un tablero. Si algún componente empieza a competir con la lista por atención, el componente está mal.
2. **Cargar un gasto es la función principal.** Tres toques. Cualquier cosa que agregue un cuarto toque necesita justificarse.
3. **Carbón cálido, no negro azulado.** El sesgo marrón de las superficies es la firma del sistema. Un `#0E1114` cualquiera lo convierte en otro dashboard más.

## CONTENIDO

**Voz.** Directa y sin adornos. La app no felicita, no reta y no opina sobre en qué gastás. No hay presupuestos, alertas de ahorro ni caritas.

**Persona.** Segunda persona, `vos`: «Cargá un gasto», «Todavía no cargaste nada este mes». Nunca `usted`, nunca `tú`.

**Mayúsculas.**
- **Oración** en todo: títulos, labels de botón, nombres de categoría.
- **VERSALITAS + tracking .18em** solo para etiquetas micro: `GASTADO EN JULIO`, `RECURRENTE`, `SIN SINCRONIZAR`.
- Title Case nunca.

**Labels de botón.** Verbo + objeto, 1–3 palabras: `Cargar gasto`, `Guardar`, `Borrar movimiento`, `Marcar pagada`. El botón dice lo que va a pasar, y el mensaje después usa el mismo verbo en pasado: `Guardado`.

**Errores.** Qué pasó y cómo se arregla. Sin disculpas y sin vaguedad.
- Mal: «Ups, algo salió mal.»
- Bien: «No se pudo traer la cotización del dólar. El gasto se guardó en USD y queda pendiente de convertir.»

**Números y fechas.** Formato argentino: `$899.007` (punto de miles, coma decimal). Fechas cortas `31 jul`, largas `viernes 31 de julio`. Montos en dólares siempre como `US$ 15`, nunca `$15` a secas — la ambigüedad con el peso es inaceptable en esta app.

**Emoji.** Nunca. Los iconos hacen todo el trabajo visual.

**Copy canónico:**
- `GASTADO EN JULIO` / `$899.007` / `28% menos que junio · 51 mov.`
- `Cargar gasto`
- `Todavía no cargaste nada en julio. Cargá el primero.`
- `Sin señal. Se guarda acá y sube cuando vuelva.`
- `US$ 15 × 1.500 · oficial del 22 jul`

## FUNDAMENTOS VISUALES

### Color

Todo está en `colors_and_type.css`. Reglas, no sugerencias:

- **Un solo acento: el ámbar `#DDA544`.** Se usa para dos cosas y nada más: el monto de un gasto y la acción primaria. Si aparece en un tercer lugar, deja de significar algo.
- **Semánticos aparte del acento.** `--positive` teal para ingresos, «te deben» y variaciones a la baja del gasto. `--negative` rojo para errores, borrar y «le debés». Nunca se usan de decoración.
- **El tema oscuro es el default.** El claro existe porque al sol el carbón pelea con el reflejo justo cuando estás cargando un gasto en la calle. Es la misma paleta con el papel cálido y el ámbar bajado de luminosidad para que se pueda leer como texto — no un invento nuevo.
- **Elevación por luminosidad de superficie, no por sombra.** `--bg` → `--surface` → `--surface-2` → `--surface-3`. Las únicas dos sombras del sistema son el FAB y el sheet.

**Categorías.** 17 hues definidos, separados en el círculo y con saturación moderada para que no vibren sobre el carbón. Dos reglas:
- Las **subcategorías no tienen color propio**: heredan el hue del padre y varían en luminosidad. Con 17 padres y ~60 hijos, cualquier otra cosa es un sistema de color ingobernable.
- **No se agregan colores a demanda.** Si aparece una categoría nueva, sale de la paleta existente o usa `--cat-otros`.

**FLAG:** `--cat-salud` (#4FB3B3) y `--cat-viajes` (#57A9C4) son vecinos incómodos. Casi nunca aparecen juntos porque Viajes tiene muy poco volumen en los datos, pero si en Análisis se ven adyacentes hay que separar uno de los dos.

### Tipografía

**Superfamilia IBM Plex**, en tres roles. Es open source (OFL), se autohospeda vía `@fontsource`, y sus cifras tabulares son de verdad — que en una app de plata no es un detalle estético.

| Rol | Familia | Dónde |
|---|---|---|
| Lectura | IBM Plex Sans **Condensed** 600 | Total del mes, monto en el alta, saldos |
| Interfaz | IBM Plex Sans 400/500/600 | Todo el resto del texto |
| Cifras | IBM Plex **Mono** | Cualquier número de dinero en una lista o columna |

**Regla dura:** todo monto que pueda aparecer en columna va en `--font-figure` con `font-variant-numeric: tabular-nums`. Es lo que hace que la lista de movimientos se lea de un barrido vertical en vez de renglón por renglón.

Escala en `colors_and_type.css` (`--t-*`). El tamaño más importante del sistema es `--t-body-s` (12,5px): es la fila de movimiento, o sea el 90% de los píxeles que vas a mirar.

**FLAG:** los previews de este directorio no traen los WOFF2 de Plex; caen a Bahnschrift SemiCondensed y Segoe UI, que en Windows se ven muy parecidas a la dirección aprobada. Los archivos reales se agregan al scaffoldear la app (`npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-sans-condensed @fontsource/ibm-plex-mono`).

### Radios

Instrumento significa casi rectos. `2px` detalles, `3px` controles, `6px` tarjetas y sheets, `10px` contenedores grandes, `999px` **solo** chips de etiqueta. Nada de `rounded-lg` por defecto en todo.

### Bordes y líneas

`--rule` (#2E2924) para divisores de 1px. `--rule-strong` para bordes de control. La lista de movimientos usa divisores entre filas pero **no** entre día y su primer movimiento: el encabezado de día y sus filas son un bloque.

### Sombras

Dos, y se terminó: `--sh-fab` y `--sh-sheet`. En una interfaz oscura las sombras no se ven; la profundidad la da la superficie.

### Layout

- **Mobile:** 16px de padding horizontal (`--pad-screen`). Contenido a ancho completo.
- **Desktop:** la lista se ancla a 560px y queda centrada; nunca se estira a 1400px. Es una app de celular que se puede abrir en una compu, no un dashboard.
- Grilla de espaciado de 4 (`--s-1` … `--s-11`).
- **Altura mínima de toque 44px.** La fila de movimiento mide 46px y eso no se negocia por meter una fila más en pantalla.

### Movimiento

- Transiciones de 120–180ms, `ease` propio (`--ease`). El sheet de alta entra en 240ms.
- **La UI no espera a la red.** El movimiento aparece en la lista al instante, con el marcador de `SIN SINCRONIZAR` si hace falta. Nada de spinners en el alta.
- Sin bounces, sin spring, sin skeletons animados. Un instrumento no rebota.
- `prefers-reduced-motion` anula todo (ya está en el CSS).

### Estados del dato

Esto es propio de esta app y es tan importante como el color:

| Estado | Cómo se ve | Cuándo |
|---|---|---|
| Estimado | `.u-estimado` — subrayado punteado, color apagado | Cotización de fin de semana o feriado |
| Pendiente de sync | Punto `--pendiente` a la izquierda del monto | Cargado sin señal |
| Recurrente | Chip `RECURRENTE` en teal, borde fino | Instancia generada por una serie |
| Compartido | Monto en dos líneas: lo tuyo grande, el total chico abajo | Gasto que generó deuda a favor |
| Sin categorizar | Chip ámbar `A CLASIFICAR` | Importado de Meow sin regla que matchee |

## ICONOGRAFÍA

**Phosphor Icons**, peso `regular`, 20px en filas y 24px en barra de pestañas. MIT, `@phosphor-icons/react`. Construcción geométrica, se lleva bien con el registro técnico de Plex.

- Los iconos heredan `currentColor`. En la barra de pestañas la pestaña activa va en `--amber`.
- Las **categorías no llevan icono en la lista**: se distinguen por texto y, en Análisis, por color. Icono por categoría son 17 decisiones de dibujo que no aportan nada a 12,5px.
- Emoji nunca. Glifos unicode como iconos, nunca.

## Componentes

Lo que la app necesita de verdad, no un catálogo genérico:

| Componente | Preview | Iteración |
|---|---|---|
| Encabezado de mes (total + selector) | `components-header-mes.html` | 1 |
| Encabezado de día con subtotal | `components-movimiento.html` | 1 |
| Fila de movimiento (7 variantes) | `components-movimiento.html` | 1 |
| Sheet de alta de gasto (teclado + categorías) | `components-alta-gasto.html` | 1 |
| Barra de pestañas + FAB | `components-tabs.html` | 1 |
| Botones, inputs, toggle ARS/USD, chips | `components-controles.html` | 1 |
| Estados vacíos, offline y error | `components-estados.html` | 1 |

## Índice

```
design-system/
├── README.md                  ← acá estás
├── SKILL.md                   ← entrada para agentes
├── colors_and_type.css        ← todos los tokens + clases semánticas
├── preview/                   ← tarjetas del panel Design System
│   ├── colors-superficies.html
│   ├── colors-acento.html
│   ├── colors-categorias.html
│   ├── type-escala.html
│   ├── type-cifras.html
│   ├── spacing-radii.html
│   └── components-*.html
└── ui_kits/
    └── usura-app/
        ├── README.md
        └── index.html         ← prototipo interactivo: Movimientos + alta de gasto
```

## Para otros agentes

Entrar por `SKILL.md`. Leer `colors_and_type.css` primero, después recorrer `preview/`, después `ui_kits/usura-app/index.html` para ver el sistema funcionando.
