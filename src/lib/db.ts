import Dexie, { type EntityTable } from 'dexie'
import type { FxRate, RecurringRule, Transaction } from './types'
import { monthRange, type DateStr, type MonthStr } from './dates'

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
  recurringRules: EntityTable<RecurringRule, 'id'>
  fxRates: EntityTable<FxRate, 'date'>
  meta: EntityTable<Meta, 'key'>
}

db.version(1).stores({
  // _dirty indexado: es la consulta de la cola de sincronización.
  transactions: 'id, date, updatedAt, _dirty, category, [date+id]',
  fxRates: 'date',
  meta: 'key',
})

// v2 — recurrentes. `recurringRuleId` indexado porque la pantalla de series
// pregunta «qué generó esta regla» una vez por regla.
db.version(2).stores({
  transactions: 'id, date, updatedAt, _dirty, category, [date+id], recurringRuleId',
  recurringRules: 'id, updatedAt, _dirty, active',
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

/** Rango arbitrario de fechas, sin borradas. Lo usa Análisis. */
export async function transactionsBetween(from: DateStr, to: DateStr): Promise<Transaction[]> {
  const rows = await db.transactions.where('date').between(from, to, true, true).toArray()
  return rows.filter((t) => !t.deletedAt)
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

/** Lo que todavía no subió, de todas las tablas: es el indicador de la UI. */
export async function countPending(): Promise<number> {
  const [t, r] = await Promise.all([
    db.transactions.where('_dirty').equals(1).count(),
    db.recurringRules.where('_dirty').equals(1).count(),
  ])
  return t + r
}

/* ---------- recurrentes ---------- */

/** Todas las series vivas, las activas primero y dentro de eso por descripción. */
export async function recurringRules(): Promise<RecurringRule[]> {
  const rows = await db.recurringRules.toArray()
  return rows
    .filter((r) => !r.deletedAt)
    .sort((a, b) =>
      a.active === b.active
        ? a.description.localeCompare(b.description, 'es-AR')
        : Number(b.active) - Number(a.active),
    )
}

export async function saveRule(r: RecurringRule): Promise<void> {
  await db.recurringRules.put({ ...r, _dirty: 1 })
}

export async function deleteRule(id: string): Promise<void> {
  const now = new Date().toISOString()
  await db.recurringRules.update(id, { deletedAt: now, updatedAt: now, _dirty: 1 })
}

/**
 * Lo que generó una serie, **incluidas las archivadas**. Es a propósito: si
 * borraste la instancia de marzo, no queremos volver a crearla en la próxima
 * corrida. El archivado es una decisión, no un hueco.
 */
export function instancesOfRule(ruleId: string): Promise<Transaction[]> {
  return db.transactions.where('recurringRuleId').equals(ruleId).toArray()
}

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
  await Promise.all([db.transactions.clear(), db.recurringRules.clear(), db.meta.clear()])
  // Las cotizaciones no se borran: son dato del mundo, no de la persona.
}
