import Dexie, { type EntityTable } from 'dexie'
import type { FxRate, Transaction } from './types'
import { monthRange, type MonthStr } from './dates'

/**
 * IndexedDB es la fuente de verdad de la UI. Supabase es una réplica a la que
 * empujamos cuando hay red. Ninguna pantalla espera a la red para pintar.
 */

interface Meta {
  key: string
  value: string
}

const db = new Dexie('usura') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  fxRates: EntityTable<FxRate, 'date'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  // _dirty indexado: es la consulta de la cola de sincronización.
  transactions: 'id, date, updatedAt, _dirty, category, [date+id]',
  fxRates: 'date',
  meta: 'key',
})

export { db }

/* ---------- meta ---------- */

export async function readMeta(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null
}

export async function writeMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value })
}

/* ---------- transactions ---------- */

/** Las del mes, sin borradas, ordenadas de más nueva a más vieja. */
export async function transactionsOfMonth(month: MonthStr): Promise<Transaction[]> {
  const [from, to] = monthRange(month)
  const rows = await db.transactions.where('date').between(from, to, true, true).toArray()
  return rows
    .filter((t) => !t.deletedAt)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
}

/** Alta local. Marca sucio para que la cola lo suba cuando pueda. */
export async function saveTransaction(t: Transaction): Promise<void> {
  await db.transactions.put({ ...t, _dirty: 1 })
}

export async function deleteTransaction(id: string): Promise<void> {
  const now = new Date().toISOString()
  // Borrado lógico: si borráramos la fila, el borrado no se propagaría al otro dispositivo.
  await db.transactions.update(id, { deletedAt: now, updatedAt: now, _dirty: 1 })
}

export const countPending = (): Promise<number> => db.transactions.where('_dirty').equals(1).count()

/* ---------- cotizaciones ---------- */

export const localRate = (date: string): Promise<FxRate | undefined> => db.fxRates.get(date)

export async function saveRate(r: FxRate): Promise<void> {
  await db.fxRates.put(r)
}

/** La más reciente que tengamos, para cuando la API no responde. */
export async function latestRate(): Promise<FxRate | undefined> {
  return db.fxRates.orderBy('date').last()
}

/** Se llama al cerrar sesión: la base local es de un solo usuario a la vez. */
export async function clearAll(): Promise<void> {
  await Promise.all([db.transactions.clear(), db.meta.clear()])
  // Las cotizaciones no se borran: son dato del mundo, no de la persona.
}
