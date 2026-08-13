---
name: usura-design-system
description: Sistema de diseño de Usura, la app personal de finanzas. Dirección «Instrumento» — ámbar sobre carbón cálido, oscuro por defecto, español rioplatense. Usar al construir o modificar cualquier pantalla, componente o estado visual de Usura.
---

# Usura Design System

App personal de finanzas, mono-usuario, PWA (React + Vite + TS), offline-first + Supabase.
Español rioplatense (`vos`). Dirección visual: **«Instrumento»**, panel de medición oscuro.

## Antes de escribir una línea

1. Leer `colors_and_type.css`. Todos los valores salen de ahí; ninguno se escribe a mano.
2. Mirar `preview/components-movimiento.html`. La fila de movimiento es el componente central de la app.
3. Si es una pantalla nueva, mirar `ui_kits/usura-app/index.html` para ver el sistema armado.

## Las cinco reglas que no se rompen

1. **Un solo acento.** El ámbar `--amber` se usa para el monto de un gasto y para la acción primaria. Nada más. `--positive` y `--negative` son semánticos, no decorativos.
2. **Todo monto en `--font-figure` con `tabular-nums`.** Sin excepción. Es lo que permite leer una lista de gastos de un barrido vertical.
3. **El total del mes no es un titular.** Arriba a la izquierda, `--t-readout-l` (30px), con el selector de mes a la derecha. Ningún componente compite con la lista de movimientos.
4. **La UI no espera a la red.** El movimiento aparece al instante; si no sincronizó, lleva el marcador de pendiente. Nada de spinners ni de bloquear el alta porque falló una API.
5. **Toque mínimo 44px.** La fila mide 46px y no se comprime para meter una fila más.

## Tokens de un vistazo

```
superficies   --bg #141210 · --surface #1D1A17 · --surface-2 #241F1B · --surface-3 #2B251F
líneas        --rule #2E2924 · --rule-strong #423A32
texto         --text #EDE7DE · --text-2 #B8AEA3 · --text-3 #8B8177
acento        --amber #DDA544 (+ hover/press/ink/soft)
semánticos    --positive #5FA391 · --negative #C25B4A
categorías    --cat-comida … --cat-otros (17)
tipografía    --font-readout (Plex Sans Condensed) · --font-ui (Plex Sans) · --font-figure (Plex Mono)
radios        2 / 3 / 6 / 10 / 999(solo chips)
```

Tema claro: `:root[data-theme="light"]`. Misma paleta, papel cálido, ámbar oscurecido. No inventar valores nuevos para el claro.

## Copy

- Segunda persona, `vos`. Oración, no Title Case. VERSALITAS con tracking `.18em` solo en etiquetas micro.
- Botón = verbo + objeto (`Cargar gasto`). Confirmación con el mismo verbo en pasado (`Guardado`).
- Error = qué pasó + cómo se arregla. Sin disculpas.
- Pesos `$899.007`. Dólares **siempre** `US$ 15`, nunca `$15`.
- Emoji nunca.

## Estados del dato

Cinco, y todos tienen forma visual definida en `preview/components-estados.html` y
`preview/components-movimiento.html`: estimado, pendiente de sync, recurrente, compartido,
sin categorizar. Si un dato es aproximado, la UI lo dice.

## Qué no hacer

- No agregar colores de categoría a demanda: se usa la paleta existente o `--cat-otros`.
- No poner iconos por categoría en la lista de movimientos.
- No usar sombras fuera del FAB y el sheet.
- No usar emoji, gradientes, glass ni skeletons animados.
- No poner presupuestos, metas de ahorro ni mensajes que opinen sobre el gasto: la app no juzga.
