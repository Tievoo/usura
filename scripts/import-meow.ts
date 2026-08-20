/**
 * Importador del histórico de Meow. Se corre a mano, una vez.
 *
 *   bun run scripts/import-meow.ts --user tievolib@gmail.com
 *   bun run scripts/import-meow.ts --user <email> --apply
 *
 * Por defecto **no escribe nada**: parsea, imprime el resumen y deja el SQL en
 * un archivo para que lo mires antes de aplicarlo. Con `--apply` lo aplica él
 * mismo llamando al CLI de Supabase.
 *
 * No hace falta ninguna credencial nueva: usa las que `supabase link` dejó
 * cacheadas. La secret key no se toca.
 *
 * Los ids salen de un hash de cada fila del CSV, así que correrlo dos veces no
 * duplica nada. Por defecto los que ya están no se tocan (`do nothing`): un CSV
 * más nuevo agrega lo que falta sin pisar lo que corregiste desde la app. Con
 * `--overwrite` sí se pisan, para reclasificar con reglas nuevas.
 */

import { importarMeow, type ResultadoImport } from '../src/lib/meow'
import { toNumeric } from '../src/lib/money'
import type { Transaction } from '../src/lib/types'

/* ---------- argumentos ---------- */

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const bool = (name: string) => args.includes(`--${name}`)

const CSV = flag('file') ?? 'meow_export_records.csv'
const EMAIL = flag('user')
const SALIDA = flag('out') ?? 'scripts/.out/import-meow.sql'
const DESDE = flag('desde')
const HASTA = flag('hasta')
const APLICAR = bool('apply')
const PISAR = bool('overwrite')

if (bool('help') || (!EMAIL && !flag('user-id'))) {
  console.log(`
Uso:
  bun run scripts/import-meow.ts --user <email> [--apply]

  --user <email>     De quién son los movimientos. Se resuelve contra auth.users.
  --user-id <uuid>   Alternativa, si ya sabés el uuid.
  --file <ruta>      CSV de Meow. Default: meow_export_records.csv
  --desde <YYYY-MM-DD> / --hasta <YYYY-MM-DD>   Acotan el rango. Default: todo.
  --out <ruta>       Dónde dejar el SQL. Default: scripts/.out/import-meow.sql
  --apply            Aplica el SQL además de generarlo.
  --overwrite        Pisa los movimientos ya importados (reclasificar con reglas
                     nuevas). Sin esto, solo se insertan los que faltan y no se
                     tocan las correcciones que hiciste desde la app.
`)
  process.exit(bool('help') ? 0 : 1)
}

/* ---------- helpers ---------- */

const sh = async (cmd: string[]): Promise<string> => {
  const p = Bun.spawn(cmd, { stdout: 'pipe', stderr: 'pipe' })
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()])
  if ((await p.exited) !== 0) throw new Error(err || out)
  return out
}

/** Escape de literal de Postgres. Nada de acá viene de una fuente confiable. */
const q = (v: string | null): string =>
  v === null ? 'null' : `'${v.replace(/'/g, "''")}'`

const num = (v: number | null): string => (v === null ? 'null' : `'${toNumeric(v)}'`)

/* ---------- resolver el usuario ---------- */

async function resolverUserId(): Promise<string> {
  const dado = flag('user-id')
  if (dado) return dado

  console.log(`Buscando el usuario ${EMAIL} en auth.users…`)
  const out = await sh([
    'bun', 'x', 'supabase', 'db', 'query', '--linked',
    `select id from auth.users where email = '${EMAIL!.replace(/'/g, "''")}' limit 1`,
  ])
  const m = out.match(/"id":\s*"([0-9a-f-]{36})"/i)
  if (!m) throw new Error(`No encontré un usuario con el mail ${EMAIL}. ¿Ya lo invitaste desde el dashboard?`)
  return m[1]!
}

/* ---------- SQL ---------- */

const COLUMNAS = [
  'id', 'user_id', 'type', 'date', 'time', 'description', 'original_amount', 'currency',
  'ars_amount', 'fx_rate', 'fx_type', 'fx_date', 'category', 'subcategory',
  'payment_method', 'refund_ars', 'notes', 'source', 'created_at', 'updated_at',
]

const fila = (t: Transaction): string => `(${[
  q(t.id), q(t.userId), q(t.type), q(t.date), q(t.time), q(t.description),
  num(t.originalAmount), q(t.currency), num(t.arsAmount),
  num(t.fxRate), q(t.fxType), q(t.fxDate),
  q(t.category), q(t.subcategory), q(t.paymentMethod),
  num(t.refundArs), q(t.notes), q(t.source),
  q(t.createdAt), q(t.updatedAt),
].join(', ')})`

function generarSql(res: ResultadoImport): string {
  const partes: string[] = [
    '-- Import del histórico de Meow. Generado por scripts/import-meow.ts.',
    `-- ${res.stats.importadas} movimientos, ${res.stats.rango?.desde} a ${res.stats.rango?.hasta}.`,
    '-- Idempotente: los ids derivan del hash de cada fila del CSV.',
    'begin;',
  ]

  // En tandas: un solo INSERT de 1.152 filas es un statement incómodo de leer y
  // de diagnosticar si una fila viola un check.
  const TANDA = 200
  for (let i = 0; i < res.transactions.length; i += TANDA) {
    const tanda = res.transactions.slice(i, i + TANDA)
    partes.push(
      `insert into public.transactions (${COLUMNAS.join(', ')}) values`,
      tanda.map(fila).join(',\n'),
      PISAR
        // Con --overwrite se reclasifica lo ya importado. `deleted_at` queda afuera
        // a propósito: lo que archivaste no revive porque se reimporte el CSV.
        ? `on conflict (id) do update set
  type = excluded.type, date = excluded.date, time = excluded.time,
  description = excluded.description, original_amount = excluded.original_amount,
  currency = excluded.currency, ars_amount = excluded.ars_amount,
  category = excluded.category, subcategory = excluded.subcategory,
  payment_method = excluded.payment_method, refund_ars = excluded.refund_ars,
  notes = excluded.notes, source = excluded.source;`
        // Default: un CSV más nuevo agrega lo que falta y no toca lo que ya está.
        // Sin esto, cada reimport borraría las correcciones hechas desde la app.
        : `on conflict (id) do nothing;`,
      '',
    )
  }

  partes.push('commit;', '')
  return partes.join('\n')
}

/* ---------- main ---------- */

const userId = await resolverUserId()
console.log(`user_id: ${userId}`)

const texto = await Bun.file(CSV).text()
const res = await importarMeow(texto, userId, { desde: DESDE, hasta: HASTA })
const s = res.stats

console.log(`
CSV: ${CSV}
  filas leídas        ${s.filas}
  a importar          ${s.importadas}   (${s.gastos} gastos, ${s.ingresos} ingresos)
  descartadas         ${s.descartadas}   ${Object.entries(s.porMotivo).map(([k, v]) => `${k}=${v}`).join(' ')}
  sin categorizar     ${s.sinCategorizar}   (${((s.sinCategorizar / Math.max(1, s.importadas)) * 100).toFixed(1)}%)
  con reembolso       ${s.conReembolso}
  con etiquetas       ${s.conEtiquetas}   (van a notes: falta la tabla de tags)
  cuotas detectadas   ${s.cuotasDetectadas}   (no se arma la serie: falta la tabla de recurrentes)
  rango               ${s.rango?.desde} → ${s.rango?.hasta}
`)

const sql = generarSql(res)
await Bun.write(SALIDA, sql)
console.log(`SQL escrito en ${SALIDA} (${(sql.length / 1024).toFixed(0)} KB)`)

if (!APLICAR) {
  console.log(`
No se aplicó nada todavía. Para aplicarlo:

  bun x supabase db query --linked -f ${SALIDA}

o volvé a correr este script con --apply.`)
  process.exit(0)
}

console.log('\nAplicando…')
await sh(['bun', 'x', 'supabase', 'db', 'query', '--linked', '-f', SALIDA])
console.log('Aplicado.')

const check = await sh([
  'bun', 'x', 'supabase', 'db', 'query', '--linked',
  `select count(*) as n, min(date) as desde, max(date) as hasta
     from public.transactions where user_id = '${userId}' and source = 'meow_import'`,
])
console.log('\nEn la base ahora:', check.match(/"rows":\s*\[[\s\S]*?\]/)?.[0] ?? check)
