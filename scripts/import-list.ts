/**
 * Carga una lista de gastos armada a mano (o dictada) en un txt. Para ponerse al
 * día cuando no cargaste nada en semanas. Se corre a mano, como el de Meow.
 *
 *   bun run import:list --file movimientos.txt --user <email>
 *   bun run import:list --file movimientos.txt --user <email> --apply
 *
 * Una línea por movimiento, columnas separadas por `|`:
 *
 *   dd/mm hh:mm | monto | ARS|USD | medio | categoria/subcategoria | descripción | nota
 *
 * - La hora es opcional. El año sale de `--year` (default: el actual).
 * - El monto va sin separador de miles; los decimales con punto (`0.92`).
 * - El medio: `MP` es Mercado Pago; cualquier otro (Brubank, ICBC…) va como
 *   tarjeta. Queda escrito en la nota igual.
 * - Si la nota trae `devuelto <monto>`, eso va a `refund_ars`: el gasto se guarda
 *   entero y los totales usan el neto, igual que en la app.
 * - Las líneas que empiezan con `#` se ignoran. Una línea con `?` en el monto o
 *   en la categoría frena todo: la lista tiene que estar confirmada.
 *
 * Por defecto no escribe nada: valida, busca duplicados contra la base y deja el
 * SQL en `scripts/.out/`. Los ids salen de un hash de cada línea, así que
 * aplicarlo dos veces no duplica.
 *
 * Los gastos en dólares toman el oficial de `fx_rates` del día, o el último
 * anterior si ese día no hay (fin de semana): en ese caso la nota lo dice.
 */

import { CATEGORY_BY_SLUG } from '../src/data/categories'
import { toArs, toNumeric, fromNumeric, type Cents } from '../src/lib/money'
import { addDays, type DateStr } from '../src/lib/dates'
import type { Currency, PaymentMethod } from '../src/lib/types'

/* ---------- argumentos ---------- */

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const bool = (name: string) => args.includes(`--${name}`)

const FILE = flag('file')
const EMAIL = flag('user')
const YEAR = flag('year') ?? String(new Date().getFullYear())
const SALIDA = flag('out') ?? 'scripts/.out/import-list.sql'
const APLICAR = bool('apply')
const CON_DUPLICADOS = bool('include-dupes')

if (bool('help') || !FILE || (!EMAIL && !flag('user-id'))) {
  console.log(`
Uso:
  bun run import:list --file <txt> --user <email> [--apply]

  --file <ruta>      La lista. Formato en el encabezado de scripts/import-list.ts.
  --user <email>     De quién son los movimientos. Se resuelve contra auth.users.
  --user-id <uuid>   Alternativa, si ya sabés el uuid.
  --year <YYYY>      Año de las fechas dd/mm. Default: el actual.
  --out <ruta>       Dónde dejar el SQL. Default: scripts/.out/import-list.sql
  --apply            Aplica el SQL además de generarlo.
  --include-dupes    Carga también los que parecen ya estar en la base.
`)
  process.exit(bool('help') ? 0 : 1)
}

/* ---------- helpers ---------- */

const tmp = 'scripts/.out/.query.sql'

/**
 * Siempre por archivo: en Windows, `bun x` vuelve a partir los argumentos y un
 * SQL pasado como string llega al CLI en pedazos.
 */
async function query<T>(sql: string): Promise<T[]> {
  await Bun.write(tmp, sql)
  const out = await sh(['bun', 'x', 'supabase', 'db', 'query', '--linked', '-f', tmp])
  return (JSON.parse(out.slice(out.indexOf('{'))) as { rows: T[] }).rows
}

const sh = async (cmd: string[]): Promise<string> => {
  const p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()])
  if ((await p.exited) !== 0) throw new Error(err || out)
  return out
}

const q = (v: string | null): string =>
  v === null ? 'null' : `'${v.replace(/'/g, "''")}'`
const num = (v: Cents | null): string => (v === null ? 'null' : `'${toNumeric(v)}'`)

/** '0.92' -> 92 · '19666' -> 1966600. Sin pasar por float. */
function parseCents(s: string): Cents | null {
  const m = s.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!m) return null
  return Number.parseInt(m[1]!, 10) * 100 + Number.parseInt(((m[2] ?? '') + '00').slice(0, 2), 10)
}

async function idDeLinea(linea: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`list|${YEAR}|${linea}`))
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return [
    h.slice(0, 8), h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((Number.parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-')
}

/* ---------- parseo ---------- */

interface Item {
  id: string
  linea: number
  date: DateStr
  time: string | null
  amount: Cents
  currency: Currency
  medio: string
  paymentMethod: PaymentMethod
  category: string
  subcategory: string | null
  description: string
  nota: string
  refund: Cents
}

const errores: string[] = []
const items: Item[] = []

const texto = await Bun.file(FILE).text()
for (const [i, crudo] of texto.split(/\r?\n/).entries()) {
  const linea = crudo.trim()
  if (!linea || linea.startsWith('#')) continue
  const n = i + 1
  const cols = linea.split('|').map((c) => c.trim())
  const [fecha = '', monto = '', moneda = '', medio = '', cat = '', desc = '', nota = ''] = cols

  const f = fecha.match(/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (!f) { errores.push(`línea ${n}: fecha «${fecha}»`); continue }
  const date = `${YEAR}-${f[2]!.padStart(2, '0')}-${f[1]!.padStart(2, '0')}`
  const time = f[3] ? `${f[3].padStart(2, '0')}:${f[4]}` : null

  const amount = parseCents(monto)
  if (!amount) { errores.push(`línea ${n}: monto «${monto}»`); continue }
  if (moneda !== 'ARS' && moneda !== 'USD') { errores.push(`línea ${n}: moneda «${moneda}»`); continue }

  const [catSlug = '', subSlug = null] = cat.split('/')
  const categoria = CATEGORY_BY_SLUG[catSlug]
  if (!categoria || categoria.type !== 'expense') { errores.push(`línea ${n}: categoría «${cat}»`); continue }
  if (subSlug && !categoria.subs.some((s) => s.slug === subSlug)) {
    errores.push(`línea ${n}: subcategoría «${cat}»`); continue
  }
  if (!desc || desc === '?' || nota.includes('?')) { errores.push(`línea ${n}: tiene una duda pendiente`); continue }

  const dev = nota.match(/devuelto\s+(\d+(?:\.\d{1,2})?)/)
  const refund = dev ? parseCents(dev[1]!) ?? 0 : 0
  if (refund > amount) { errores.push(`línea ${n}: devuelto mayor que el monto`); continue }

  items.push({
    id: await idDeLinea(linea),
    linea: n,
    date,
    time,
    amount,
    currency: moneda,
    medio,
    paymentMethod: medio.toUpperCase() === 'MP' ? 'mercadopago' : 'credit',
    category: catSlug,
    subcategory: subSlug,
    description: desc,
    nota: nota.replace(/devuelto\s+\d+(?:\.\d{1,2})?\s*·?\s*/, '').trim(),
    refund,
  })
}

if (errores.length) {
  console.error(`\nLa lista no está lista para cargar:\n  ${errores.join('\n  ')}`)
  process.exit(1)
}
if (!items.length) {
  console.error('La lista está vacía.')
  process.exit(1)
}

/* ---------- base: usuario, cotizaciones, duplicados ---------- */

let userId = flag('user-id')
if (!userId) {
  const rows = await query<{ id: string }>(
    `select id from auth.users where email = ${q(EMAIL!)} limit 1;`)
  if (!rows[0]) throw new Error(`No encontré un usuario con el mail ${EMAIL}.`)
  userId = rows[0].id
}

const desde = items.reduce((m, t) => (t.date < m ? t.date : m), items[0]!.date)
const hasta = items.reduce((m, t) => (t.date > m ? t.date : m), items[0]!.date)

const rates = await query<{ date: string; official_sell: string }>(
  `select date::text, official_sell::text from public.fx_rates
    where date <= ${q(hasta)} and date >= ${q(addDays(desde, -10))} order by date;`)

/** El oficial del día, o el último anterior. null si no hay ninguno. */
function rateFor(date: DateStr): { value: Cents; date: DateStr } | null {
  let best: { value: Cents; date: DateStr } | null = null
  for (const r of rates) if (r.date <= date) best = { value: fromNumeric(r.official_sell), date: r.date }
  return best
}

const enBase = await query<{
  id: string; date: string; time: string | null; description: string
  original_amount: string; currency: string; source: string
}>(
  `select id, date::text, time::text, description, original_amount::text, currency, source
     from public.transactions
    where user_id = ${q(userId)} and deleted_at is null
      and date between ${q(addDays(desde, -5))} and ${q(addDays(hasta, 5))};`)

const propios = new Set(items.map((t) => t.id))
const dias = (a: DateStr, b: DateStr) =>
  Math.abs((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86_400_000)

/** Mismo monto y moneda a cinco días o menos: probablemente ya estaba cargado. */
const duplicados = new Map<string, (typeof enBase)[number]>()
for (const t of items) {
  const d = enBase.find((b) =>
    !propios.has(b.id) && b.currency === t.currency &&
    fromNumeric(b.original_amount) === t.amount && dias(b.date, t.date) <= 5)
  if (d) duplicados.set(t.id, d)
}

/* ---------- resumen ---------- */

const fmt = (c: Cents) => toNumeric(c)
const aCargar = items.filter((t) => CON_DUPLICADOS || !duplicados.has(t.id))
const ya = enBase.filter((b) => propios.has(b.id)).length

console.log(`\nLista: ${FILE}   usuario: ${userId}`)
console.log(`  ${items.length} movimientos, ${desde} → ${hasta}`)
console.log(`  ${ya} ya cargados por una corrida anterior de esta misma lista`)

if (duplicados.size) {
  console.log(`\n  Parecen estar ya en la base${CON_DUPLICADOS ? ' (se cargan igual: --include-dupes)' : ' (no se cargan)'}:`)
  for (const t of items) {
    const d = duplicados.get(t.id)
    if (!d) continue
    console.log(`    línea ${t.linea}: ${t.date} ${t.description} ${t.currency} ${fmt(t.amount)}`)
    console.log(`      ↔ ${d.date} ${d.description || '(sin descripción)'} [${d.source}]`)
  }
}

const filas: string[] = []
const sinCotizacion: Item[] = []
let totalArs = 0
let totalUsd = 0

for (const t of aCargar) {
  const usd = t.currency === 'USD'
  const fx = usd ? rateFor(t.date) : null
  if (usd && !fx) sinCotizacion.push(t)
  // Sin cotización se guarda en 0 y queda «a convertir», como en el alta.
  const ars = usd ? (fx ? toArs(t.amount, fx.value) : 0) : t.amount
  if (usd) totalUsd += t.amount
  totalArs += ars - t.refund

  const notas = [
    t.medio,
    t.nota || null,
    usd && fx && fx.date !== t.date ? `cotización del ${fx.date}, estimada` : null,
  ].filter(Boolean).join(' · ')

  filas.push(`(${[
    q(t.id), q(userId), q('expense'), q(t.date), q(t.time), q(t.description),
    num(t.amount), q(t.currency), num(ars),
    num(fx?.value ?? null), q(fx ? 'official' : null), q(fx?.date ?? null),
    q(t.category), q(t.subcategory), q(t.paymentMethod),
    num(t.refund), q(notas || null), q('manual'),
  ].join(', ')})`)
}

console.log(`\n  A cargar: ${aCargar.length}`)
console.log(`  Neto en pesos: ${fmt(totalArs)}   (incluye US$ ${fmt(totalUsd)} convertidos al oficial)`)
if (sinCotizacion.length) {
  console.log(`  Sin cotización (quedan a convertir): ${sinCotizacion.map((t) => `línea ${t.linea}`).join(', ')}`)
}

if (!filas.length) {
  console.log('\nNada que cargar.')
  process.exit(0)
}

const sql = [
  `-- Generado por scripts/import-list.ts desde ${FILE}.`,
  '-- Idempotente: los ids derivan del hash de cada línea.',
  'begin;',
  `insert into public.transactions (id, user_id, type, date, time, description,
  original_amount, currency, ars_amount, fx_rate, fx_type, fx_date,
  category, subcategory, payment_method, refund_ars, notes, source) values`,
  filas.join(',\n'),
  // Lo que ya está no se toca: si lo corregiste desde la app, gana la app.
  'on conflict (id) do nothing;',
  'commit;',
  '',
].join('\n')

await Bun.write(SALIDA, sql)
console.log(`\nSQL escrito en ${SALIDA}`)

if (!APLICAR) {
  console.log('No se aplicó nada. Para aplicarlo, agregá --apply.')
  process.exit(0)
}

console.log('\nAplicando…')
await sh(['bun', 'x', 'supabase', 'db', 'query', '--linked', '-f', SALIDA])
const despues = await query<{ n: number }>(
  `select count(*)::int as n from public.transactions
    where id in (${items.map((t) => q(t.id)).join(', ')});`)
console.log(`Aplicado. De esta lista hay ${despues[0]?.n ?? 0} en la base.`)
