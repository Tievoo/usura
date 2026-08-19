# Usura

App personal de finanzas. PWA offline-first, multi-usuario por invitación.
Diseño: dirección «Instrumento» — ámbar sobre carbón cálido.

- `docs/ESPECIFICACION.md` — decisiones, modelo de datos, seguridad, iteraciones.
- `docs/CATEGORIAS.md` — taxonomía y reglas del importador de Meow.
- `design-system/` — tokens, previews y prototipo. Entrada: `design-system/SKILL.md`.

## Correr

```bash
bun install
bun run dev        # http://localhost:5173
bun run build      # dist/ + service worker
bun run typecheck
```

`.env.local` tiene que existir con las dos variables de `.env.example`. Ambas son
públicas por diseño; **nunca** poner ahí una `sb_secret_...` ni una key de terceros:
todo `VITE_*` se compila dentro del bundle.

## Puesta a punto de Supabase

Esto va una sola vez. Sin los pasos 1 y 2 la app funciona igual —guarda todo en
IndexedDB— pero no sincroniza.

**1. Crear las tablas.** Con el CLI, que ya está como devDependency:

```bash
bun x supabase login                                # abre el navegador, una vez por máquina
bun x supabase link --project-ref ykrjrjrtcwhocozjmhyk   # pide la password de la base
bun x supabase db push                              # aplica supabase/migrations/
```

Crea `transactions` y `fx_rates`, activa RLS en las dos y cierra el rol anónimo.
De ahí en más, cada cambio de esquema es un archivo nuevo:
`bun x supabase migration new <nombre>` y otro `db push`. **Nada de tocar el
esquema desde el SQL Editor**: lo que no está en `supabase/migrations/` no existe.

Los nombres de archivo llevan timestamp (`20260813230913_transactions.sql`)
porque es lo que el CLI usa para ordenar y para saber qué ya aplicó. Un prefijo
`0001_` lo rechaza.

**2. Config de auth.** Vive en `supabase/config.toml` y se aplica con:

```bash
bun x supabase config push
```

Ahí están el `site_url` (`http://localhost:5173`, el puerto de Vite) y
`enable_signup = false`, que es lo que cierra el alta pública: sin eso, cualquiera
con la publishable key se hace una cuenta en el proyecto.

**Cuidado con `config push`: empuja la sección de auth entera, no solo lo que
cambiaste.** Cualquier ajuste hecho a mano en el dashboard que no esté en
`config.toml` se pisa con el default de la plantilla — y varios de esos defaults
son *más flojos* que los del proyecto (`max_frequency` de 1m a 1s, `otp_length`
de 8 a 6). Revisá el diff que imprime antes de aceptarlo, y si tocaste algo en el
dashboard, traelo al archivo primero.

**3. Invitarte a vos mismo.** Authentication → Users → Invite user, con tu mail.
Esto sí es del dashboard. Es obligatorio: `Login.tsx` manda `shouldCreateUser: false`,
así que un mail no invitado no puede entrar aunque pida el link.

**4. SMTP propio** (Resend o Postmark). El servicio de mail que trae Supabase
está limitado a unos pocos correos por hora y es solo para desarrollo: con varios
usuarios pidiendo magic links, el login empieza a fallar en silencio.

Antes del primer deploy, el checklist de `docs/ESPECIFICACION.md` §8.

## Importar el histórico de Meow

Es una migración de una sola vez y **no tiene botón en la app**: se corre a mano.
Las reglas están en `docs/CATEGORIAS.md` §3 a §6 y se ejecutan en `src/lib/meow.ts`.

```bash
bun run import:meow --user tu@mail.com            # parsea, resume, escribe el SQL. No toca la base.
bun run import:meow --user tu@mail.com --apply    # además lo aplica
```

Por defecto no escribe nada: deja el SQL en `scripts/.out/` para que lo mires.
No necesita ninguna credencial nueva —usa las que cacheó `supabase link`— y la
secret key no se toca. Acepta `--desde` / `--hasta` para acotar el rango.

El SQL es idempotente: el id de cada movimiento sale de un hash de su fila del
CSV, así que correrlo dos veces actualiza en vez de duplicar. Eso permite volver
a correrlo cuando se agreguen reglas de clasificación.

**Lo que el importador todavía no puede guardar**, porque faltan las tablas:
las etiquetas (van a `notes` como `#tati`, para no perderlas) y las series de
cuotas (se detectan y se cuentan, pero no se arma el recurrente).

## Estado

**Iteración 1 en curso.** Andando: alta de gasto con teclado propio, ARS/USD con
snapshot de cotización, total del mes, lista por día con subtotales, borrado
lógico, cola de sincronización, login por magic link, PWA instalable.

Sin implementar todavía: edición de un movimiento (por ahora se toca y se borra),
etiquetas, importador del CSV de Meow, y las pestañas Análisis, Recurrentes y Deudas
—que existen y muestran un estado vacío honesto, no están escondidas.

## Arquitectura en un párrafo

IndexedDB (Dexie) es la fuente de verdad de la UI; Supabase es una réplica.
Toda escritura va primero a local con `_dirty = 1` y una cola la empuja cuando hay
red. El pull trae lo que cambió desde el último `updated_at` conocido, con
last-write-wins. Nada en la ruta del alta de un gasto espera a la red: ni la API
de cotización, ni el sync, ni el service worker.
