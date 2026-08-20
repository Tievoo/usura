import type { Cents } from './money'
import { sum } from './money'
import { net, type Transaction } from './types'
import { monthOf, type MonthStr, type DateStr } from './dates'
import { CATEGORY_BY_SLUG, categoryColor, categoryName, subcategoryName } from '../data/categories'

/**
 * Agregaciones para la pestaña Análisis. Todo se calcula sobre lo que ya está en
 * Dexie: no hay una consulta al servidor ni un total precomputado que pueda
 * quedar desincronizado de la lista.
 *
 * Sobre el color: la paleta de categorías tiene pares que no se distinguen bien
 * —`impuestos` y `hogar` quedan a ΔE 7,7, y `bebidas` con `super` son casi el
 * mismo color en deuteranopía—, así que el color nunca es el canal de identidad.
 * Cada fila lleva su nombre escrito y la barra solo refuerza. Por eso acá no hay
 * torta ni barra apilada: ahí el color sí sería la única pista.
 */

export interface Tajada {
  slug: string
  name: string
  color: string
  total: Cents
  /** Proporción sobre el total del período, 0 a 1. */
  share: number
  count: number
}

const ordenar = (xs: Tajada[]) => xs.sort((a, b) => b.total - a.total)

/** Gasto por categoría, de mayor a menor. Los ingresos no entran. */
export function porCategoria(ts: Transaction[]): Tajada[] {
  const gastos = ts.filter((t) => t.type === 'expense')
  const total = sum(gastos.map(net))
  const acc = new Map<string, { total: Cents; count: number }>()

  for (const t of gastos) {
    const a = acc.get(t.category) ?? { total: 0, count: 0 }
    a.total += net(t)
    a.count++
    acc.set(t.category, a)
  }

  return ordenar([...acc].map(([slug, a]) => ({
    slug,
    name: categoryName(slug),
    color: categoryColor(slug),
    total: a.total,
    share: total > 0 ? a.total / total : 0,
    count: a.count,
  })))
}

/** Subcategorías de una categoría. `null` agrupa lo que no tiene subcategoría. */
export function porSubcategoria(ts: Transaction[], categoria: string): Tajada[] {
  const gastos = ts.filter((t) => t.type === 'expense' && t.category === categoria)
  const total = sum(gastos.map(net))
  const acc = new Map<string | null, { total: Cents; count: number }>()

  for (const t of gastos) {
    const a = acc.get(t.subcategory) ?? { total: 0, count: 0 }
    a.total += net(t)
    a.count++
    acc.set(t.subcategory, a)
  }

  const color = categoryColor(categoria)
  return ordenar([...acc].map(([slug, a]) => ({
    slug: slug ?? '(sin)',
    name: slug
      ? subcategoryName(categoria, slug) ?? slug
      : `${CATEGORY_BY_SLUG[categoria]?.name ?? categoria}, sin subcategoría`,
    color,
    total: a.total,
    share: total > 0 ? a.total / total : 0,
    count: a.count,
  })))
}

export interface PuntoMes {
  month: MonthStr
  total: Cents
}

/** Serie de gasto por mes, para los meses que se pidan y en ese orden. */
export function serieMensual(ts: Transaction[], meses: MonthStr[]): PuntoMes[] {
  const acc = new Map<MonthStr, Cents>()
  for (const t of ts) {
    if (t.type !== 'expense') continue
    const m = monthOf(t.date)
    acc.set(m, (acc.get(m) ?? 0) + net(t))
  }
  return meses.map((month) => ({ month, total: acc.get(month) ?? 0 }))
}

/**
 * Total de gastos acotado a la misma altura del período.
 *
 * `corte` es el sufijo de la fecha hasta donde se cuenta —'20' para un mes en
 * curso, '08-20' para un año en curso— y null cuenta todo. Es lo que evita que un
 * período en curso se compare contra uno completo y muestre una caída inventada.
 */
export function totalHasta(ts: Transaction[], corte: string | null, largoCorte: number): Cents {
  const gastos = ts.filter((t) => {
    if (t.type !== 'expense') return false
    if (corte === null) return true
    return (t.date as DateStr).slice(10 - largoCorte) <= corte
  })
  return sum(gastos.map(net))
}

export const totalGastos = (ts: Transaction[]): Cents =>
  sum(ts.filter((t) => t.type === 'expense').map(net))

export const totalIngresos = (ts: Transaction[]): Cents =>
  sum(ts.filter((t) => t.type === 'income').map(net))
