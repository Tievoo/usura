# Usura — Especificación

App personal de finanzas. **Multi-usuario por invitación**: Tievo y un puñado de amigos, cada uno con sus datos completamente aislados. No es un producto público. Uso diario en mobile y consulta en web.
Inspiración: Meow Money Manager. Reemplaza a Meow + complementa Splitwise.

Estado: iteración 1 andando en producción (2026-08-20). Histórico de Meow migrado: 1.190 movimientos.

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
| Diseño | Dirección **«Instrumento»** (oscura, ámbar sobre carbón cálido). Sistema en `design-system/`, que es la fuente de verdad: la copia en Claude Design quedó en otra cuenta y no cuenta. |
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
- Ficha del movimiento al tocarlo, con editar y archivar. Nunca un `confirm` del
  navegador: tocar para mirar no puede ser un riesgo.
- Hora del movimiento, además de la fecha.
- **Comparación honesta con el mes anterior.** Un mes en curso se compara contra el
  anterior *cortado en el mismo día*; comparar 20 días contra 31 inventa una caída
  que no existe. Un mes ya cerrado sí se compara completo. La UI dice cuál de las
  dos está mostrando.
- **Controles del sistema.** El botón atrás cierra el modal abierto en vez de salir
  de la app, y el swipe horizontal cambia de pestaña. En un PWA instalado esto no
  viene gratis: sin el manejo del historial, atrás te expulsa de la app.

**Iteración 2 — Migración y categorías**
- Importador del CSV de Meow con las reglas de `CATEGORIAS.md`.
- Bandeja de "Sin categorizar" para reclasificar desde la app.
- Backfill de cotizaciones históricas (ene 2024 → hoy).
- **Gestión de categorías**: lista, alta y edición, con acceso desde la pantalla
  principal y desde el alta de gasto. Hoy la taxonomía es un archivo y solo se
  puede elegir, no cambiar. Ver `categories` en §3: la tabla se cuelga del slug,
  así que esto no migra la columna del movimiento.

**Iteración 3 — Recurrentes**
- Suscripciones (mensual/anual) y cuotas (N de M, con monto y total conocidos).
- Generación automática, edición de instancia suelta, baja de la serie.
- Vista de "qué se viene este mes".
- **Lista de series** con, por cada una: cuántas veces se generó ya, si tiene fin
  conocido (las cuotas) o sigue hasta que la cortes vos (las suscripciones), y
  cuánto lleva gastado en total. Una suscripción sin fecha de fin no es un error:
  es lo normal, y la lista tiene que distinguirlo de una cuota 3 de 12.

**Iteración 4 — Análisis**
- Navegación por meses y años, gasto por categoría y subcategoría, comparativas.
- Acá entran USD constante e IPC. *(Pendientes: falta el backfill de cotizaciones
  históricas de la iteración 2 y una serie de IPC.)*
- **Nada de torta ni de barra apilada.** La paleta de categorías tiene pares que no
  se distinguen —`impuestos` con `hogar` a ΔE 7,7 con visión normal, `bebidas` con
  `super` a ΔE 2,8 en deuteranopía— y en esas formas el color es la única pista de
  quién es quién. El desglose va como lista rankeada con el nombre en cada fila y
  la barra reforzando la magnitud. Los colores de categoría no se retocan: son del
  design system.

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

**Los identificadores van en inglés** —tablas, columnas y valores de enum— aunque la UI y estos documentos estén en castellano. La única excepción son los **slugs de categoría**, que siguen en castellano a propósito: son valores de dominio que ya viajan en las filas y en el CSV de Meow, no identificadores.

### `transactions`
El único lugar donde vive un movimiento.

Esta tabla describe el **modelo final**. La migración `0001_transactions.sql` crea el subconjunto que la iteración 1 necesita: las columnas de recurrentes, deudas y Splitwise se agregan en la iteración donde aparece cada función.

| Campo | Tipo | Nota |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | FK a `auth.users`. **No nullable, en todas las tablas de datos.** Es el eje del aislamiento. |
| `type` | enum | `expense` \| `income` |
| `date` | date | Fecha del gasto, no de la carga. Define la cotización aplicada. |
| `time` | time | Hora local, sin timezone. Nullable: `null` = no se sabe y la UI lo dice. No es un `timestamptz` a propósito, ver §4. |
| `description` | text | Texto libre. Es lo que el usuario escribe y busca. |
| `original_amount` | numeric | Tal como se pagó. |
| `currency` | enum | `ARS` \| `USD` |
| `ars_amount` | numeric | Derivado al insertar. **Nunca se recalcula.** |
| `fx_rate` | numeric | Cotización aplicada. `null` si `currency = ARS`. |
| `fx_type` | enum | `official` \| `blue` \| `mep` \| `crypto` \| `manual` |
| `fx_date` | date | Fecha de la cotización usada (puede diferir de `date` en fines de semana). |
| `category` | text | **Slug estable** de `CATEGORIAS.md` (`comida`, `transporte`), en castellano y no FK. Ver abajo. |
| `subcategory` | text | Slug. Nullable: se puede cargar sin subcategoría. |
| `payment_method` | enum | `mercadopago` \| `cash` \| `credit` |
| `refund_ars` | numeric | Default 0. Parte que te devolvieron. Los totales usan `ars_amount - refund_ars`. |
| `recurring_rule_id` | fk | Null si es un gasto suelto. |
| `installment_no`, `installment_total` | int | Solo para cuotas. |
| `debt_id` | fk | Si el gasto generó una deuda a favor. |
| `splitwise_expense_id` | text | Para no duplicar en la sync. |
| `notes` | text | |
| `source` | enum | `manual` \| `recurring` \| `meow_import` \| `splitwise` |
| `created_at`, `updated_at`, `deleted_at` | timestamptz | Borrado lógico, necesario para el sync. |

### `categories` / `subcategories`
`id`, `user_id`, `slug`, `name`, `icon`, `color`, `position`, `type` (`expense`\|`income`), `active`.
La subcategoría cuelga de `category_id`. Editables desde la app: la taxonomía inicial es un punto de partida, no una jaula.

**La transacción guarda un slug de texto, no una FK.** El slug (`comida`, `transporte`, `merienda`) es estable y no cambia nunca. Esta tabla, cuando exista, se *cuelga* del slug para pisar nombre, color, orden o para desactivar una categoría — no es dueña del dato de la transacción. Dos consecuencias buenas:

- La iteración 1 no necesita la tabla: la taxonomía vive en `src/data/categories.ts` y ya se puede cargar y clasificar gastos.
- Cuando llegue la edición por usuario, **no hay que migrar la columna de la transacción**. Se agrega la tabla y se hace join por slug.

**Son por usuario, no globales.** La taxonomía de `CATEGORIAS.md` es una *plantilla*: al crear una cuenta, un trigger `on auth.user created` le copia las 17 categorías y sus subcategorías. Así cada uno renombra, desactiva o agrega lo suyo sin tocar al resto. La alternativa —categorías globales— significa que si un amigo renombra «Apuestas» a «Timba», se le cambia a todos.

El costo es que la plantilla vive en una migración y actualizarla no retroactúa sobre cuentas ya creadas. Es el precio correcto a pagar.

### `tags` / `transaction_tags`
`tags`: `id`, `name`, `kind` (`person`\|`event`\|`free`), `color`.
`transaction_tags`: N a N. Autocompletado por frecuencia de uso.
Una `tag` de clase `person` puede vincularse a una persona de deudas/Splitwise.

### `fx_rates`
`date` (PK), `official_buy`, `official_sell`, `blue`, `mep`, `crypto`, `provider`, `fetched_at`.
Una fila por día. Se cachea agresivo: la cotización de un día pasado no cambia nunca.

**Es la única tabla sin `user_id`.** La cotización del dólar es un dato del mundo, no de una persona: se comparte entre todos y se trae una sola vez. Por eso su RLS es distinta al resto —lectura para cualquier autenticado, escritura solo desde el cron con la secret key:

```sql
create policy "read for authenticated" on fx_rates
  for select to authenticated using (true);
-- sin política de insert/update: solo la secret key escribe acá
```

- Cotización del día: `https://dolarapi.com/v1/dolares` (devuelve todas juntas).
- Histórico para el backfill: `https://api.argentinadatos.com/v1/cotizaciones/dolares` — **validar formato y cobertura desde ene 2024 antes de la iteración 2.**
- Fin de semana / feriado: se usa la última cotización disponible y se registra en `fx_date`.
- Fallback si la API no responde al cargar: se guarda el gasto en USD con `fx_rate = null` y queda pendiente de resolver. Nunca se bloquea la carga de un gasto por una API caída.

### `recurring_rules`
`id`, `type` (`subscription`\|`installments`), `description`, `amount`, `currency`, `category`, `subcategory`, `payment_method`, `frequency` (`monthly`\|`yearly`), `day_of_month`, `start_date`, `end_date`, `installments_total`, `active`, `tags`.

- Generación idempotente: clave única `(recurring_rule_id, period)` para que no se dupliquen si la app abre dos veces el mismo día.
- Se generan al abrir la app y también server-side (cron de Supabase), para que el total del mes sea correcto aunque no la abras.
- Editar una instancia no toca la serie. Editar la serie no reescribe el pasado.
- Suscripción en USD: cada instancia toma la cotización de su propia fecha.

### `debts` / `debt_payments`
`debts`: `id`, `tag_id` (persona), `direction` (`owed_to_me`\|`i_owe`), `amount`, `currency`, `description`, `date`, `status` (`open`\|`settled`), `source` (`manual`\|`splitwise`\|`shared_expense`), `transaction_id`, `splitwise_expense_id`.
`debt_payments`: `id`, `debt_id`, `amount`, `date`, `transaction_id`.

Las deudas **no** entran al total de gastos. Un gasto compartido cuenta por lo que te toca a vos: el resto es una deuda a favor.

## 4. Multi-moneda

Las fechas son locales y `'YYYY-MM-DD'`, y la hora viaja en su propia columna. Un `timestamptz` reintroduciría el bug que esta regla evita: un gasto del 31 de julio a las 23:00 en Buenos Aires cae en agosto si se guarda en UTC, y el total del mes queda mal.

Regla: **el snapshot es inmutable**. Un gasto de USD 50 el 3 de marzo de 2024 quedó registrado a la cotización de ese día y ese `ars_amount` no se toca nunca, aunque después corrijamos la fuente de datos.

- Al cargar en USD se muestra la conversión estimada antes de confirmar, con la cotización y su fecha visibles.
- Se puede pisar el tipo de cambio a mano (`fx_type = manual`) para operaciones puntuales.
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
alter table <table> enable row level security;

create policy "owner only" on <table>
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

- **La base local no está cifrada.** IndexedDB queda en claro en el dispositivo: quien desbloquee tu celular ve tus gastos. La protección es el bloqueo del dispositivo. Cifrar la base local rompería la búsqueda por concepto (`description`), así que no vale la pena para este caso.
- **La publishable key permite enumerar el proyecto.** Con RLS bien puesto no da acceso a datos, pero sí revela que el proyecto existe y qué tablas expone la API. Es el costo de una arquitectura sin backend propio.

## 9. Pendiente de decidir

- **Ingresos `Cambio` (30 registros)**: hoy migran como ingreso "Venta de USD". Discutible — es conversión de un activo, no ingreso nuevo. Se puede reclasificar sin migrar nada.
- Notificaciones (recordatorio de carga diaria, aviso de vencimiento de cuota): no hay decisión y en iOS la PWA es limitada.
- Widget / atajo del sistema para cargar sin abrir la app: deseable, no viable en PWA. Eventual app nativa fina solo para eso.
