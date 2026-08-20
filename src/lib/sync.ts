import { supabase, type TransactionRow } from './supabase'
import { db, writeMeta, readMeta } from './db'
import { toNumeric, fromNumeric } from './money'
import type { FxType, PaymentMethod, Currency, Transaction, Source, TransactionType } from './types'

/**
 * Sincronización. Local siempre primero: la UI escribe en Dexie y sigue, y esto
 * corre en segundo plano. Nada de acá puede bloquear ni romper el alta de un gasto.
 *
 * Resolución de conflictos: last-write-wins por updated_at. Alcanza porque nadie
 * escribe filas de otro: los conflictos posibles son solo entre dispositivos
 * de la misma persona.
 */

const LAST_PULL_KEY = 'lastPull'

/* ---------- mapeo ---------- */

function toRow(t: Transaction): TransactionRow {
  return {
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
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt,
  }
}

function fromRow(r: TransactionRow): Transaction {
  return {
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
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    _dirty: 0,
  }
}

/* ---------- push ---------- */

async function push(): Promise<void> {
  const dirty = await db.transactions.where('_dirty').equals(1).toArray()
  if (!dirty.length) return

  // En tandas: una lista de 1.152 transacciones importadas no entra en un solo request.
  const BATCH = 200
  for (let i = 0; i < dirty.length; i += BATCH) {
    const batch = dirty.slice(i, i + BATCH)
    const { error } = await supabase.from('transactions').upsert(batch.map(toRow), { onConflict: 'id' })
    if (error) throw new Error(error.message)
    // Solo se limpia lo que efectivamente subió; si algo se editó mientras
    // viajaba, su updatedAt cambió y vuelve a marcarse sucio en el próximo put.
    await db.transaction('rw', db.transactions, async () => {
      for (const t of batch) {
        const current = await db.transactions.get(t.id)
        if (current && current.updatedAt === t.updatedAt) {
          await db.transactions.update(t.id, { _dirty: 0 })
        }
      }
    })
  }
}

/* ---------- pull ---------- */

async function pull(): Promise<void> {
  const from = (await readMeta(LAST_PULL_KEY)) ?? '1970-01-01T00:00:00Z'

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gt('updated_at', from)
    .order('updated_at', { ascending: true })
    .limit(1000)

  if (error) throw new Error(error.message)
  if (!data?.length) return

  const remote = (data as TransactionRow[]).map(fromRow)

  await db.transaction('rw', db.transactions, async () => {
    for (const r of remote) {
      const local = await db.transactions.get(r.id)
      // El local sucio y más nuevo gana: todavía no subió y no queremos pisarlo.
      if (local?._dirty === 1 && local.updatedAt >= r.updatedAt) continue
      await db.transactions.put(r)
    }
  })

  const last = remote[remote.length - 1]
  if (last) await writeMeta(LAST_PULL_KEY, last.updatedAt)
}

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
    await push()
    await pull()
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
