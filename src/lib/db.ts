import Dexie, { type EntityTable } from 'dexie'
import type { Cotizacion, Movimiento } from './tipos'
import { rangoMes, type Mes } from './fechas'

/**
 * IndexedDB es la fuente de verdad de la UI. Supabase es una réplica a la que
 * empujamos cuando hay red. Ninguna pantalla espera a la red para pintar.
 */

interface Meta {
  clave: string
  valor: string
}

const db = new Dexie('usura') as Dexie & {
  movimientos: EntityTable<Movimiento, 'id'>
  cotizaciones: EntityTable<Cotizacion, 'fecha'>
  meta: EntityTable<Meta, 'clave'>
}

db.version(1).stores({
  // _dirty indexado: es la consulta de la cola de sincronización.
  movimientos: 'id, fecha, updatedAt, _dirty, categoria, [fecha+id]',
  cotizaciones: 'fecha',
  meta: 'clave',
})

export { db }

/* ---------- meta ---------- */

export async function leerMeta(clave: string): Promise<string | null> {
  return (await db.meta.get(clave))?.valor ?? null
}

export async function escribirMeta(clave: string, valor: string): Promise<void> {
  await db.meta.put({ clave, valor })
}

/* ---------- movimientos ---------- */

/** Los del mes, sin borrados, ordenados de más nuevo a más viejo. */
export async function movimientosDelMes(mes: Mes): Promise<Movimiento[]> {
  const [desde, hasta] = rangoMes(mes)
  const filas = await db.movimientos.where('fecha').between(desde, hasta, true, true).toArray()
  return filas
    .filter((m) => !m.deletedAt)
    .sort((a, b) => (a.fecha === b.fecha ? b.createdAt.localeCompare(a.createdAt) : b.fecha.localeCompare(a.fecha)))
}

/** Alta local. Marca sucio para que la cola lo suba cuando pueda. */
export async function guardarMovimiento(m: Movimiento): Promise<void> {
  await db.movimientos.put({ ...m, _dirty: 1 })
}

export async function borrarMovimiento(id: string): Promise<void> {
  const ahora = new Date().toISOString()
  // Borrado lógico: si borráramos la fila, el borrado no se propagaría al otro dispositivo.
  await db.movimientos.update(id, { deletedAt: ahora, updatedAt: ahora, _dirty: 1 })
}

export const contarPendientes = (): Promise<number> => db.movimientos.where('_dirty').equals(1).count()

/* ---------- cotizaciones ---------- */

export const cotizacionLocal = (fecha: string): Promise<Cotizacion | undefined> => db.cotizaciones.get(fecha)

export async function guardarCotizacion(c: Cotizacion): Promise<void> {
  await db.cotizaciones.put(c)
}

/** La más reciente que tengamos, para cuando la API no responde. */
export async function ultimaCotizacion(): Promise<Cotizacion | undefined> {
  return db.cotizaciones.orderBy('fecha').last()
}

/** Se llama al cerrar sesión: la base local es de un solo usuario a la vez. */
export async function vaciarTodo(): Promise<void> {
  await Promise.all([db.movimientos.clear(), db.meta.clear()])
  // Las cotizaciones no se borran: son dato del mundo, no de la persona.
}
