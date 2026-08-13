import { latestRate, localRate, saveRate } from './db'
import { fromNumeric, type Cents } from './money'
import { today, type DateStr } from './dates'
import type { FxRate, FxType } from './types'

/**
 * Cotización del dólar. Dos reglas que gobiernan todo esto:
 *
 * 1. El snapshot es inmutable: una vez que una transacción guardó su fxRate, no se
 *    recalcula nunca, ni si después corregimos la fuente.
 * 2. Una API caída no bloquea el alta. Si no hay cotización, se usa la última
 *    conocida y se devuelve `estimated: true` para que la UI lo diga.
 */

const API = 'https://dolarapi.com/v1/dolares'

interface DolarApiRow {
  casa: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

export interface ResolvedRate {
  value: Cents
  type: FxType
  date: DateStr
  /** true cuando la cotización no es la del día pedido (fin de semana, feriado, API caída). */
  estimated: boolean
}

/** Dólar oficial por defecto: el blue y el cripto dejaron de ser referencia. */
export const DEFAULT_FX_TYPE: FxType = 'official'

function rateFor(r: FxRate, type: FxType): Cents {
  switch (type) {
    case 'blue': return r.blue ?? r.officialSell
    case 'mep': return r.mep ?? r.officialSell
    case 'crypto': return r.crypto ?? r.officialSell
    default: return r.officialSell
  }
}

async function fetchFromApi(): Promise<FxRate | null> {
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = (await res.json()) as DolarApiRow[]
    // 'casa' y sus valores son de la API, no nuestros: se dejan como vienen.
    const casa = (n: string) => data.find((d) => d.casa === n)

    const official = casa('oficial')
    if (!official?.venta) return null

    const rate: FxRate = {
      // La fecha es la del día en que rige, no la de actualización del feed.
      date: today(),
      officialBuy: fromNumeric(official.compra ?? official.venta),
      officialSell: fromNumeric(official.venta),
      blue: casa('blue')?.venta ? fromNumeric(casa('blue')!.venta) : null,
      // dolarapi llama 'bolsa' al MEP.
      mep: casa('bolsa')?.venta ? fromNumeric(casa('bolsa')!.venta) : null,
      crypto: casa('cripto')?.venta ? fromNumeric(casa('cripto')!.venta) : null,
      provider: 'dolarapi.com',
      fetchedAt: new Date().toISOString(),
    }
    await saveRate(rate)
    return rate
  } catch {
    return null
  }
}

/**
 * Resuelve la cotización a aplicar a un gasto con fecha `date`.
 * Devuelve null solo si nunca conseguimos ninguna cotización: en ese caso la
 * transacción se guarda en dólares sin convertir y queda pendiente.
 */
export async function resolveRate(date: DateStr, type: FxType = DEFAULT_FX_TYPE): Promise<ResolvedRate | null> {
  const cached = await localRate(date)
  if (cached) {
    return { value: rateFor(cached, type), type, date, estimated: false }
  }

  if (date === today()) {
    const fresh = await fetchFromApi()
    if (fresh) return { value: rateFor(fresh, type), type, date, estimated: false }
  }

  // Fin de semana, feriado, o sin red: la última que tengamos, avisando que es estimada.
  const last = await latestRate()
  if (!last) return null
  return { value: rateFor(last, type), type, date: last.date, estimated: true }
}

/** Precarga al abrir la app, en segundo plano. Si falla, no pasa nada. */
export function preload(): void {
  void localRate(today()).then((r) => {
    if (!r) void fetchFromApi()
  })
}
