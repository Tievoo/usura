# Usura — Especificación

App personal de finanzas. **Multi-usuario por invitación**: Tievo y un puñado de amigos, cada uno con sus datos completamente aislados. No es un producto público. Uso diario en mobile y consulta en web.
Inspiración: Meow Money Manager. Reemplaza a Meow + complementa Splitwise.

Estado: especificación acordada (2026-08-11). Sin código todavía.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataforma | **PWA** — React + Vite + TypeScript. Instalable en Android/iOS, misma base para web. |
| Datos | **Offline-first**: IndexedDB local + sync a **Supabase** (Postgres). Se carga un gasto sin señal y sube solo. |
| Auth | **Solo por invitación.** Magic link por email, alta pública desactivada. RLS por `user_id` en toda tabla de datos. Requiere SMTP propio. |
| Aislamiento | Total. Ningún usuario ve nada de otro, ni siquiera si comparten un gasto en la vida real. |
| Moneda | ARS y USD. Se guarda **monto original + moneda + snapshot de cotización del día**. |
| Cotización | **Dólar oficial** por defecto. Se persisten las cuatro (oficial/blue/MEP/cripto) por si cambia el régimen. |
| Reportes | Fuera de alcance en v1 salvo total del mes y desglose por categoría. IPC/USD constante: 2ª iteración (el modelo ya lo permite). |
| Medios de pago | Etiqueta simple (Mercadopago / Efectivo / Crédito). **Sin saldos ni cuentas.** |
| Etiquetas | Categoría + subcategoría (estructurado) **+ etiquetas libres** para personas y eventos (`#tati`, `#viaje-junko`). |
| Recurrentes | Se generan **automáticamente** en su fecha. Cada instancia es editable/borrable sin romper la serie. |
| Deudas | Import **solo-lectura** de Splitwise + deudas manuales. Splitwise sigue siendo fuente de verdad de lo compartido. |
| Histórico | Migrar 1.152 de los 1.230 registros con mapeo revisado. Ver `CATEGORIAS.md`. |
| Diseño | Dirección **«Instrumento»** (oscura, ámbar sobre carbón cálido). Sistema en `design-system/`, sincronizado a Claude Design. |
| Tipografía | Superfamilia **IBM Plex** (Sans Condensed / Sans / Mono), autohospedada vía `@fontsource`. |

## 2. Alcance por iteración

**Iteración 1 — Núcleo (lo que hace que la app se use)**
- Design system en Claude Design + implementación de tokens y componentes base.
- Alta de gasto en el mínimo de toques posible. Es *la* pantalla; todo lo demás es secundaria.
- Total del mes **arriba a la izquierda**: notorio, no protagonista. Ver abajo.
- Lista de movimientos del mes agrupada por día con subtotal diario. Es el cuerpo de la pantalla.
- Editar y borrar movimiento.
- Categorías/subcategorías cargadas, para el alta.
- ARS + USD con conversión y snapshot de cotización.
- Offline-first funcionando de verdad (alta sin señal, sync al volver).

**Iteración 2 — Migración**
- Importador del CSV de Meow con las reglas de `CATEGORIAS.md`.
- Bandeja de "Sin categorizar" para reclasificar desde la app.
- Backfill de cotizaciones históricas (ene 2024 → hoy).

**Iteración 3 — Recurrentes**
- Suscripciones (mensual/anual) y cuotas (N de M, con monto y total conocidos).
- Generación automática, edición de instancia suelta, baja de la serie.
- Vista de "qué se viene este mes".

**Iteración 4 — Análisis**
- Navegación por meses y años, gasto por categoría y subcategoría, comparativas.
- Acá entran USD constante e IPC.

**Iteración 5 — Deudas**
- Ledger propio: quién me debe, a quién le debo, saldos por persona.
- Gasto compartido genera la deuda a favor automáticamente.
- Import de grupos, gastos y balances de Splitwise.

### Estructura de navegación

Cuatro pestañas. El desglose por categoría **no** va en la pantalla principal: tiene su propia pestaña.

| Pestaña | Qué hay | Iteración |
|---|---|---|
| **Movimientos** | Total del mes arriba a la izquierda, selector de mes, lista agrupada por día con subtotal diario, alta de gasto. | 1 |
| **Análisis** | Gasto por categoría y subcategoría, por mes y por año, comparativas. Acá viven los reportes. | 4 |
| **Recurrentes** | Suscripciones y cuotas activas, qué se viene este mes, alta y baja de series. | 3 |
| **Deudas** | Quién me debe y a quién le debo, saldos por persona, import de Splitwise. | 5 |

Hasta que existan, las pestañas 2–4 muestran un estado vacío honesto en vez de esconderse: la estructura de la app no cambia entre iteraciones.

## 3. Modelo de datos

Postgres en Supabase; mismo esquema replicado en IndexedDB (Dexie) para el modo offline.
Montos en `numeric(14,2)`. Nada de floats para dinero.

### `movimientos`
El único lugar donde vive un movimiento.

Esta tabla describe el **modelo final**. La migración `0001_movimientos.sql` crea el subconjunto que la iteración 1 necesita: las columnas de recurrentes, deudas y Splitwise se agregan en la iteración donde aparece cada función.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK a `auth.users`. **No nullable, en todas las tablas de datos.** Es el eje del aislamiento. |
| `tipo` | enum | `gasto` \| `ingreso` |
| `fecha` | date | Fecha del gasto, no de la carga. Define la cotización aplicada. |
| `concepto` | text | Texto libre. Es lo que el usuario escribe y busca. |
| `monto_original` | numeric | Tal como se pagó. |
| `moneda` | enum | `ARS` \| `USD` |
| `monto_ars` | numeric | Derivado al insertar. **Nunca se recalcula.** |
| `fx_valor` | numeric | Cotización aplicada. `null` si `moneda = ARS`. |
| `fx_tipo` | enum | `oficial` \| `blue` \| `mep` \| `cripto` \| `manual` |
| `fx_fecha` | date | Fecha de la cotización usada (puede diferir de `fecha` en fines de semana). |
| `categoria` | text | **Slug estable** de `CATEGORIAS.md` (`comida`, `transporte`), no FK. Ver abajo. |
| `subcategoria` | text | Slug. Nullable: se puede cargar sin subcategoría. |
| `medio_pago` | enum | `mercadopago` \| `efectivo` \| `credito` |
| `reembolso_ars` | numeric | Default 0. Parte que te devolvieron. Los totales usan `monto_ars - reembolso_ars`. |
| `recurrente_id` | fk | Null si es un gasto suelto. |
| `cuota_nro`, `cuota_total` | int | Solo para cuotas. |
| `deuda_id` | fk | Si el gasto generó una deuda a favor. |
| `splitwise_expense_id` | text | Para no duplicar en la sync. |
| `notas` | text | |
| `origen` | enum | `manual` \| `recurrente` \| `import_meow` \| `splitwise` |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | Borrado lógico, necesario para el sync. |

### `categorias` / `subcategorias`
`id`, `user_id`, `nombre`, `icono`, `color`, `orden`, `tipo` (`gasto`\|`ingreso`), `activa`.
Subcategoría cuelga de `categoria_id`. Editables desde la app: la taxonomía inicial es un punto de partida, no una jaula.

**El movimiento guarda un slug de texto, no una FK.** El slug (`comida`, `transporte`, `merienda`) es estable y no cambia nunca. Esta tabla, cuando exista, se *cuelga* del slug para pisar nombre, color, orden o para desactivar una categoría — no es dueña del dato del movimiento. Dos consecuencias buenas:

- La iteración 1 no necesita la tabla: la taxonomía vive en `src/data/categorias.ts` y ya se puede cargar y clasificar gastos.
- Cuando llegue la edición por usuario, **no hay que migrar la columna del movimiento**. Se agrega la tabla y se hace join por slug.

**Son por usuario, no globales.** La taxonomía de `CATEGORIAS.md` es una *plantilla*: al crear una cuenta, un trigger `on auth.user created` le copia las 17 categorías y sus subcategorías. Así cada uno renombra, desactiva o agrega lo suyo sin tocar al resto. La alternativa —categorías globales— significa que si un amigo renombra «Apuestas» a «Timba», se le cambia a todos.

El costo es que la plantilla vive en una migración y actualizarla no retroactúa sobre cuentas ya creadas. Es el precio correcto a pagar.

### `tags` / `transaction_tags`
`tags`: `id`, `nombre`, `clase` (`persona`\|`evento`\|`libre`), `color`.
`transaction_tags`: N a N. Autocompletado por frecuencia de uso.
Una `tag` de clase `persona` puede vincularse a una persona de deudas/Splitwise.

### `fx_rates`
`fecha` (PK), `oficial_compra`, `oficial_venta`, `blue`, `mep`, `cripto`, `fuente`, `fetched_at`.
Una fila por día. Se cachea agresivo: la cotización de un día pasado no cambia nunca.

**Es la única tabla sin `user_id`.** La cotización del dólar es un dato del mundo, no de una persona: se comparte entre todos y se trae una sola vez. Por eso su RLS es distinta al resto —lectura para cualquier autenticado, escritura solo desde el cron con la secret key:

```sql
create policy "lectura para todos" on fx_rates
  for select to authenticated using (true);
-- sin política de insert/update: solo la secret key escribe acá
```

- Cotización del día: `https://dolarapi.com/v1/dolares` (devuelve todas juntas).
- Histórico para el backfill: `https://api.argentinadatos.com/v1/cotizaciones/dolares` — **validar formato y cobertura desde ene 2024 antes de la iteración 2.**
- Fin de semana / feriado: se usa la última cotización disponible y se registra en `fx_fecha`.
- Fallback si la API no responde al cargar: se guarda el gasto en USD con `fx_valor = null` y queda pendiente de resolver. Nunca se bloquea la carga de un gasto por una API caída.

### `recurrentes`
`id`, `tipo` (`suscripcion`\|`cuotas`), `concepto`, `monto`, `moneda`, `categoria_id`, `subcategoria_id`, `medio_pago`, `frecuencia` (`mensual`\|`anual`), `dia_del_mes`, `fecha_inicio`, `fecha_fin`, `cuotas_total`, `activo`, `tags`.

- Generación idempotente: clave única `(recurrente_id, periodo)` para que no se dupliquen si la app abre dos veces el mismo día.
- Se generan al abrir la app y también server-side (cron de Supabase), para que el total del mes sea correcto aunque no la abras.
- Editar una instancia no toca la serie. Editar la serie no reescribe el pasado.
- Suscripción en USD: cada instancia toma la cotización de su propia fecha.

### `deudas` / `pagos_deuda`
`deudas`: `id`, `tag_id` (persona), `direccion` (`me_debe`\|`le_debo`), `monto`, `moneda`, `concepto`, `fecha`, `estado` (`abierta`\|`liquidada`), `origen` (`manual`\|`splitwise`\|`gasto_compartido`), `transaction_id`, `splitwise_expense_id`.
`pagos_deuda`: `id`, `deuda_id`, `monto`, `fecha`, `transaction_id`.

Las deudas **no** entran al total de gastos. Un gasto compartido cuenta por lo que te toca a vos: el resto es una deuda a favor.

## 4. Multi-moneda

Regla: **el snapshot es inmutable**. Un gasto de USD 50 el 3 de marzo de 2024 quedó registrado a la cotización de ese día y ese `monto_ars` no se toca nunca, aunque después corrijamos la fuente de datos.

- Al cargar en USD se muestra la conversión estimada antes de confirmar, con la cotización y su fecha visibles.
- Se puede pisar el tipo de cambio a mano (`fx_tipo = manual`) para operaciones puntuales.
- Los totales del mes se muestran en ARS. El switch a USD llega en la iteración 4 y se calcula con los snapshots ya guardados: por eso no hace falta migrar nada después.

## 5. Splitwise

API: https://dev.splitwise.com/

**Acá es donde el multi-usuario cuesta de verdad.** Con un solo usuario alcanzaba una API key personal guardada como secret de Edge Function. Con varios, cada uno tiene su propia cuenta de Splitwise, así que hace falta **OAuth2 por usuario** y una tabla `splitwise_tokens` (`user_id`, `access_token`, `refresh_token`, `expires_at`) con RLS y los tokens cifrados en reposo.

Es la única parte del proyecto donde abrir la app a amigos multiplica el trabajo en serio. Como es la iteración 5, la decisión se puede tomar más adelante sin bloquear nada; mientras tanto, el resto de la app ya queda multi-usuario.

- Solo lectura en v1: `get_groups`, `get_expenses`, `get_friends`.
- Se importan gastos y balances; se muestran junto a las deudas manuales en la misma vista.
- Anti-duplicado por `splitwise_expense_id`.
- Un gasto de Splitwise **no** crea automáticamente un gasto en Usura: se ofrece importarlo, porque muchas veces ya lo cargaste a mano.
- **La API key va como secret de una Edge Function, nunca en el cliente.** El cliente llama a la función, la función llama a Splitwise. Ver sección 8.

## 6. Offline-first y sync

- Escritura siempre local primero, UI optimista, cero spinners en la carga de un gasto.
- Cola de operaciones pendientes con reintento y backoff.
- Resolución de conflictos: last-write-wins por `updated_at`. Alcanza porque **nadie escribe filas de otro**: los conflictos posibles son solo entre dispositivos de la misma persona.
- Borrado lógico (`deleted_at`) para que un borrado se propague en vez de resucitar.
- Indicador discreto de estado de sync. Sin alarmismo: estar offline es normal.

## 7. Principios de producto

1. **Cargar un gasto es la función principal.** Todo lo demás compite por atención en segundo lugar. Si el alta tarda más de tres toques, está mal.
2. **El total del mes está arriba a la izquierda, notorio pero no protagonista.** Es un dato de referencia permanente, no un titular. La pantalla principal es la lista de movimientos, no un tablero.
3. La app no juzga. Nada de presupuestos, alertas ni retos de ahorro salvo que se pidan.
4. Los datos son del usuario: export a CSV/JSON desde el día uno.
5. Sin números falsos: si algo es estimado (una cotización de fin de semana, un recurrente todavía no confirmado), se dice.

## 8. Seguridad

La app es un cliente: **todo lo que se manda al navegador es público**, sin excepciones. El modelo de seguridad no puede depender de esconder nada en el bundle.

### Claves

| Clave | Dónde vive | Qué puede |
|---|---|---|
| `sb_publishable_...` | En el bundle del cliente. **Es pública por diseño.** | Identifica el proyecto y activa el rol `anon`. Nada más. |
| `sb_secret_...` | Solo Edge Functions y el cron. **Nunca en el cliente.** | Bypassea RLS por completo. Supabase devuelve 401 si la detecta en un browser. |

Las claves JWT viejas (`anon` y `service_role`) quedan deprecadas a fin de 2026: se arranca directo con el modelo nuevo.

**No existe la variable de entorno secreta en un PWA.** Vite compila todo `VITE_*` dentro del bundle. Cualquier credencial de terceros (Splitwise) va como secret de Edge Function.

### RLS

Es el único límite real, y no se activa solo: las tablas creadas con `create table` desde el SQL editor **vienen sin RLS**. Cada tabla del modelo lleva, explícitamente:

```sql
alter table <tabla> enable row level security;

create policy "solo el dueño" on <tabla>
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

RLS activo sin política niega todo: hacen falta las dos cosas. El síntoma de que falta la política es que la app no trae nada y no tira error claro.

### Cierres extra, por ser una app cerrada

No hay nada público en Usura y los usuarios son un grupo conocido, así que se puede cerrar más que en una app normal:

1. **Revocar el acceso del rol anónimo a los datos.** El login pasa por la Auth API, no por PostgREST, así que esto no rompe el magic link:
   ```sql
   revoke all on all tables in schema public from anon;
   alter default privileges in schema public revoke all on tables from anon;
   ```
2. **Alta pública desactivada, altas por invitación.** Es el cierre que más rinde y el que hace que «multi-usuario» no signifique «cualquiera se registra». Los usuarios se crean invitándolos desde el dashboard o con la Admin API desde una Edge Function. Sin esto, cualquiera con la publishable key se hace una cuenta: RLS le bloquea los datos de los demás, pero te llena el proyecto de cuentas ajenas.
3. **`statement_timeout`** en el rol `authenticated`, para que una consulta mal armada no se coma el proyecto.
4. **SMTP propio (Resend, Postmark o similar).** El servicio de mail que trae Supabase está limitado a un puñado de correos por hora y es solo para desarrollo. Con varios amigos pidiendo magic links, el login empieza a fallar en silencio. Es requisito, no opcional.

### El riesgo que aparece recién con varios usuarios

Con un solo usuario, un bug de RLS solo te exponía a vos mismo. Con amigos adentro, **un `user_id` que se olvida en una política filtra los gastos de otra persona**. Por eso:

- Ninguna tabla de datos se crea sin `user_id` no nullable y su política en la misma migración.
- El `user_id` se toma de `auth.uid()` del lado del servidor (default en la columna), **nunca de lo que manda el cliente**.
- La prueba de aceptación de cada tabla es la misma: con el JWT de otro usuario, la consulta devuelve cero filas.

### Checklist antes del primer deploy

- [ ] RLS activo en **todas** las tablas, verificado con el linter de Supabase (avisa de tablas expuestas).
- [ ] Una política por tabla, probada con un JWT ajeno: tiene que devolver cero filas.
- [ ] `user_id` no nullable en toda tabla de datos, con default `auth.uid()`.
- [ ] Alta pública desactivada; probado que un email no invitado no puede registrarse.
- [ ] SMTP propio configurado y probado con un magic link real.
- [ ] Rol `anon` sin privilegios sobre `public`.
- [ ] `sb_secret_...` ausente del repo y del bundle (`grep sb_secret dist/`).
- [ ] Ninguna key de terceros en `import.meta.env` del cliente.

### Lo que este modelo no cubre

- **La base local no está cifrada.** IndexedDB queda en claro en el dispositivo: quien desbloquee tu celular ve tus gastos. La protección es el bloqueo del dispositivo. Cifrar la base local rompería la búsqueda por concepto, así que no vale la pena para este caso.
- **La publishable key permite enumerar el proyecto.** Con RLS bien puesto no da acceso a datos, pero sí revela que el proyecto existe y qué tablas expone la API. Es el costo de una arquitectura sin backend propio.

## 9. Pendiente de decidir

- **Ingresos `Cambio` (30 registros)**: hoy migran como ingreso "Venta de USD". Discutible — es conversión de un activo, no ingreso nuevo. Se puede reclasificar sin migrar nada.
- Notificaciones (recordatorio de carga diaria, aviso de vencimiento de cuota): no hay decisión y en iOS la PWA es limitada.
- Widget / atajo del sistema para cargar sin abrir la app: deseable, no viable en PWA. Eventual app nativa fina solo para eso.
