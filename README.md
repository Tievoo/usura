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

Esto va una sola vez, en el dashboard del proyecto. Sin los pasos 1 y 2 la app
funciona igual —guarda todo en IndexedDB— pero no sincroniza.

**1. Crear las tablas.** SQL Editor → pegar y correr `supabase/migrations/0001_transactions.sql`.
Crea `transactions` y `fx_rates`, activa RLS en las dos y cierra el rol anónimo.

**2. Cerrar el alta pública.** Authentication → Sign In / Providers → desactivar
el registro de usuarios nuevos. Sin esto, cualquiera con la publishable key se
hace una cuenta en el proyecto.

**3. Invitarte a vos mismo.** Authentication → Users → Invite user, con tu mail.
Después entrás a la app y pedís el magic link.

**4. SMTP propio** (Resend o Postmark). El servicio de mail que trae Supabase
está limitado a unos pocos correos por hora y es solo para desarrollo: con varios
usuarios pidiendo magic links, el login empieza a fallar en silencio.

Antes del primer deploy, el checklist de `docs/ESPECIFICACION.md` §8.

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
