import type { EntityTable, Table } from 'dexie'
import { supabase, type RecurringRuleRow, type TransactionRow } from './supabase'
import { db, writeMeta, readMeta } from './db'
import { toNumeric, fromNumeric } from './money'
import type {
  Currency, Frequency, FxType, PaymentMethod, RecurringRule, RecurringType,
  Source, Transaction, TransactionType,
} from './types'

/**
 * Sincronización. Local siempre primero: la UI escribe en Dexie y sigue, y esto
 * corre en segundo plano. Nada de acá puede bloquear ni romper el alta de un gasto.
 *
 * Resolución de conflictos: last-write-wins por updated_at. Alcanza porque nadie
 * escribe filas de otro: los conflictos posibles son solo entre dispositivos
 * de la misma persona.
 */

/* ---------- la forma que tiene que tener una tabla para sincronizarse ---------- */

interface Syncable {
  id: string
  updatedAt: string
  _dirty: 0 | 1
}

interface RemoteRow {
  id: string
  updated_at: string
}

/**
 * Una tabla ya lista para sincronizar, con los tipos borrados en el borde. Adentro
 * de `define` todo está tipado; afuera alcanza con que las dos sepan subir y bajar,
 * y así la lista de tablas es una lista y no un `switch` que crece con el modelo.
 */
interface SyncedTable {
  remote: string
  push(): Promise<void>
  pull(): Promise<void>
}

// En tandas: una lista de 1.152 transacciones importadas no entra en un solo request.
const BATCH = 200
/** Techo por corrida. Si hay más cambios, el cursor queda guardado y siguen en la próxima. */
const PAGE = 1000

function define<L extends Syncable, R extends RemoteRow>(cfg: {
  remote: string
  table: () => EntityTable<L, 'id'>
  toRow: (l: L) => R
  fromRow: (r: R) => L
  /** Clave vieja de la época de una sola tabla, para no re-bajar todo una vez. */
  legacyPullKey?: string
}): SyncedTable {
  const pullKey = `lastPull:${cfg.remote}`
  // `EntityTable` es la vista linda para quien declara la tabla; acá adentro
  // alcanza con la genérica, que sí sabe que la clave es un string.
  const table = () => cfg.table() as unknown as Table<L, string>

  return {
    remote: cfg.remote,

    async push() {
      const dirty = await table().where('_dirty').equals(1).toArray()
      if (!dirty.length) return

      for (let i = 0; i < dirty.length; i += BATCH) {
        const batch = dirty.slice(i, i + BATCH)
        const { error } = await supabase.from(cfg.remote).upsert(batch.map(cfg.toRow), { onConflict: 'id' })
        if (error) throw new Error(error.message)

        // Solo se limpia lo que efectivamente subió; si algo se editó mientras
        // viajaba, su updatedAt cambió y vuelve a marcarse sucio en el próximo put.
        await db.transaction('rw', table(), async () => {
          for (const row of batch) {
            const current = await table().get(row.id)
            if (current && current.updatedAt === row.updatedAt) {
              await table().put({ ...current, _dirty: 0 as const })
            }
          }
        })
      }
    },

    async pull() {
      const from =
        (await readMeta(pullKey)) ??
        (cfg.legacyPullKey ? await readMeta(cfg.legacyPullKey) : null) ??
        '1970-01-01T00:00:00Z'

      const { data, error } = await supabase
        .from(cfg.remote)
        .select('*')
        .gt('updated_at', from)
        .order('updated_at', { ascending: true })
        .limit(PAGE)

      if (error) throw new Error(error.message)
      if (!data?.length) return

      const remote = (data as R[]).map(cfg.fromRow)

      await db.transaction('rw', table(), async () => {
        for (const r of remote) {
          const local = await table().get(r.id)
          // El local sucio y más nuevo gana: todavía no subió y no queremos pisarlo.
          if (local?._dirty === 1 && local.updatedAt >= r.updatedAt) continue
          await table().put(r)
        }
      })

      const last = remote[remote.length - 1]
      if (last) await writeMeta(pullKey, last.updatedAt)
    },
  }
}

/* ---------- mapeo ---------- */

const transactions = define<Transaction, TransactionRow>({
  remote: 'transactions',
  table: () => db.transactions,
  legacyPullKey: 'lastPull',

  toRow: (t) => ({
    id: t.id,
    user_id: t.userId,
    type: t.type,
    date: t.date,
    time: t.time,
    description: t.description,
    original_amount: toNumeric(t.originalAmount),
    currency: t.currency,
    ars_amount: toNumeric(t.arsAmount),
    fx_rate: t.fxRate === null ? null : toNumeric(t.fxRate),
    fx_type: t.fxType,
    fx_date: t.fxDate,
    category: t.category,
    subcategory: t.subcategory,
    payment_method: t.paymentMethod,
    refund_ars: toNumeric(t.refundArs),
    notes: t.notes,
    source: t.source,
    recurring_rule_id: t.recurringRuleId,
    recurring_period: t.recurringPeriod,
    installment_no: t.installmentNo,
    installment_total: t.installmentTotal,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt,
  }),

  fromRow: (r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type as TransactionType,
    date: r.date,
    // Postgres devuelve 'HH:MM:SS'; la app trabaja con 'HH:MM'.
    time: r.time ? r.time.slice(0, 5) : null,
    description: r.description,
    originalAmount: fromNumeric(r.original_amount),
    currency: r.currency as Currency,
    arsAmount: fromNumeric(r.ars_amount),
    fxRate: r.fx_rate === null ? null : fromNumeric(r.fx_rate),
    fxType: r.fx_type as FxType | null,
    fxDate: r.fx_date,
    category: r.category,
    subcategory: r.subcategory,
    paymentMethod: r.payment_method as PaymentMethod,
    refundArs: fromNumeric(r.refund_ars),
    notes: r.notes,
    source: r.source as Source,
    // Las columnas nacieron en la iteración 3: una fila vieja las trae ausentes.
    recurringRuleId: r.recurring_rule_id ?? null,
    recurringPeriod: r.recurring_period ?? null,
    installmentNo: r.installment_no ?? null,
    installmentTotal: r.installment_total ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    _dirty: 0,
  }),
})

const recurringRules = define<RecurringRule, RecurringRuleRow>({
  remote: 'recurring_rules',
  table: () => db.recurringRules,

  toRow: (r) => ({
    id: r.id,
    user_id: r.userId,
    type: r.type,
    description: r.description,
    amount: toNumeric(r.amount),
    currency: r.currency,
    category: r.category,
    subcategory: r.subcategory,
    payment_method: r.paymentMethod,
    frequency: r.frequency,
    day_of_month: r.dayOfMonth,
    start_date: r.startDate,
    end_date: r.endDate,
    installments_total: r.installmentsTotal,
    active: r.active,
    notes: r.notes,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    deleted_at: r.deletedAt,
  }),

  fromRow: (r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type as RecurringType,
    description: r.description,
    amount: fromNumeric(r.amount),
    currency: r.currency as Currency,
    category: r.category,
    subcategory: r.subcategory,
    paymentMethod: r.payment_method as PaymentMethod,
    frequency: r.frequency as Frequency,
    dayOfMonth: r.day_of_month,
    startDate: r.start_date,
    endDate: r.end_date,
    installmentsTotal: r.installments_total,
    active: r.active,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    _dirty: 0,
  }),
})

/**
 * Las series van primero: un movimiento generado apunta a su regla con una FK, y
 * subir la instancia antes que la serie que la explica es un error de la base.
 */
const TABLES: SyncedTable[] = [recurringRules, transactions]

/* ---------- orquestación ---------- */

let running = false
type Listener = (e: { syncing: boolean; error: string | null }) => void
const listeners = new Set<Listener>()

export function onSync(f: Listener): () => void {
  listeners.add(f)
  return () => listeners.delete(f)
}

const notify = (syncing: boolean, error: string | null) => {
  for (const f of listeners) f({ syncing, error })
}

export async function sync(): Promise<void> {
  if (running || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return

  running = true
  notify(true, null)
  try {
    for (const t of TABLES) await t.push()
    for (const t of TABLES) await t.pull()
    notify(false, null)
  } catch (e) {
    // Un fallo de sync no es un error del usuario: se reintenta y se avisa sin drama.
    notify(false, e instanceof Error ? e.message : 'Error de sincronización')
  } finally {
    running = false
  }
}

/** Arranca los disparadores: al volver la red, al volver a la pestaña, y cada 2 minutos. */
export function startSync(): () => void {
  const trigger = () => void sync()

  window.addEventListener('online', trigger)
  const onVisible = () => { if (document.visibilityState === 'visible') trigger() }
  document.addEventListener('visibilitychange', onVisible)
  const interval = window.setInterval(trigger, 120_000)

  trigger()

  return () => {
    window.removeEventListener('online', trigger)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(interval)
  }
}
