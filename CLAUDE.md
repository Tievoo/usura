# Usura

App personal de finanzas de Tievo. PWA (React + Vite + TypeScript), offline-first con IndexedDB y sync a Supabase. **Multi-usuario por invitación** (Tievo y amigos), datos totalmente aislados entre usuarios. UI en español rioplatense.

## Documentos

- `docs/ESPECIFICACION.md` — decisiones, modelo de datos, alcance por iteración. **Leer antes de tocar el modelo.**
- `docs/CATEGORIAS.md` — taxonomía de categorías y reglas del importador del CSV de Meow.
- `meow_export_records.csv` — export de Meow Money Manager, ene 2024 → ago 2026. Fuente de la migración.

## Reglas del proyecto

- **Cargar un gasto es la función principal.** Si el alta pasa de tres toques, está mal resuelta.
- **Dinero en `numeric(14,2)`, nunca float.** En TypeScript, montos en centavos o `decimal.js`.
- **Todo el código va en inglés.** Tablas, columnas, valores de enum, tipos, funciones, variables y nombres de archivo. Los **textos de la UI siguen en español rioplatense** y los comentarios y documentos también. Dos excepciones deliberadas: los **slugs de categoría** (`comida`, `transporte`), que son valores de dominio ya presentes en las filas y en el CSV de Meow, y los **tokens de color** del design system (`--cat-comida`).
- **El snapshot de cotización es inmutable.** `ars_amount` y `fx_rate` se escriben una vez al crear la transacción y no se recalculan nunca, ni al corregir la fuente de datos.
- **Escritura local primero.** La UI no espera a la red para confirmar un gasto. Una API caída (cotización, Splitwise) nunca bloquea el alta.
- **Borrado lógico** (`deleted_at`) en todo lo sincronizable.
- **Nada de números inventados.** Si un valor es estimado (cotización de fin de semana, recurrente no confirmado), la UI lo dice.
- Splitwise es **solo lectura** y su API key va como secret de Edge Function, **nunca en el cliente**. En un PWA con Vite no existe la variable de entorno secreta: todo `VITE_*` se compila dentro del bundle.
- **RLS activo y con política en toda tabla nueva, en la misma migración que la tabla.** `create table` desde el SQL editor no lo activa solo. Sin eso, la publishable key deja la base abierta. Ver `docs/ESPECIFICACION.md` §8.
- **`user_id` no nullable en toda tabla de datos**, con default `auth.uid()`. Nunca se toma del cliente. Única excepción: `fx_rates`, que es dato compartido del mundo. Un `user_id` olvidado ahora filtra los gastos de un amigo, no solo los tuyos.

## Diseño

Dirección elegida: **«Instrumento»** — panel de medición oscuro, ámbar `#DDA544` sobre carbón cálido `#141210`. Oscuro por defecto; el tema claro es la contraparte para usar al sol.

El sistema vive en `design-system/` y **el repo es la fuente de verdad**. Se armó en un proyecto de Claude Design (`e045ee14-0ad8-4805-a396-ba38c7d8bf94`) que quedó en otra cuenta y ya no es accesible: esa copia remota no cuenta.

- `design-system/SKILL.md` — entrada obligatoria antes de tocar cualquier pantalla.
- `design-system/colors_and_type.css` — todos los tokens. Ningún valor de color, tipografía o espaciado se escribe a mano.
- `design-system/preview/` — 12 tarjetas del sistema.
- `design-system/ui_kits/usura-app/index.html` — prototipo funcional de Movimientos con los 51 gastos reales de julio 2026.

Reglas que no se rompen: un solo acento (ámbar = monto de gasto + acción primaria), todo monto en `--font-figure` con `tabular-nums`, el total del mes no es un titular, toque mínimo 44px.

Tipografía: superfamilia **IBM Plex** (Sans Condensed / Sans / Mono), autohospedada. `npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-sans-condensed @fontsource/ibm-plex-mono` al scaffoldear.

Existe otro design system del usuario, "Crontu Design System", que es de otro proyecto. No mezclar.

## Código

Bun (no npm). `bun run dev` / `build` / `typecheck`. Vite 8 + React 19 + TS 7, Dexie 4, supabase-js 2, vite-plugin-pwa.

- `src/lib/money.ts` — **todo el dinero pasa por acá**, en centavos enteros. Nunca un float, nunca formatear a mano.
- `src/lib/dates.ts` — fechas como `'YYYY-MM-DD'` en hora local. `new Date('2026-07-31')` es UTC y resta un día.
- `src/lib/db.ts` — Dexie es la fuente de verdad de la UI.
- `src/lib/sync.ts` — cola de subida y pull incremental. Nada de acá bloquea el alta.
- `src/data/categories.ts` — la taxonomía. El slug es la clave, está en castellano y no cambia nunca.
- `supabase/migrations/` — toda tabla nace con su RLS en el mismo archivo.

## Estado

Especificación cerrada, design system armado, **iteración 1 en curso** (2026-08-11).

Andando: alta de gasto, ARS/USD con snapshot, total del mes, lista por día con subtotales, borrado lógico, sync, login por magic link, PWA.

Falta en la iteración 1: editar un movimiento (hoy solo se borra), etiquetas. Después: importador del CSV, recurrentes, análisis, deudas.

Pendiente del lado de Supabase (ver `README.md`): correr la migración, cerrar el alta pública, invitar usuarios, SMTP propio.
