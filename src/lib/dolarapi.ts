/**
 * dolarapi.com: traer el feed y mapearlo a nuestro `FxRate`.
 *
 * Vive aparte de `fx.ts` porque no toca Dexie, y así lo pueden usar los dos que
 * lo necesitan: la app en el navegador y el cron de `scripts/fetch-fx.ts`, que
 * escribe `fx_rates` en Supabase.
 *
 * Acá se tira el error. La regla de «una API caída no bloquea el alta» la aplica
 * quien llama: `fx.ts` lo atrapa y sigue con la última cotización conocida; el
 * cron lo deja explotar para que GitHub avise.
 */

import { fromNumeric } from './money'
import { today, type DateStr } from './dates'
import type { FxRate } from './types'

const API = 'https://dolarapi.com/v1/dolares'

interface DolarApiRow {
  casa: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

/** El feed crudo -> `FxRate`. `date` es el día en que rige, no el de actualización del feed. */
export function parseDolarApi(rows: DolarApiRow[], date: DateStr): FxRate {
  // 'casa' y sus valores son de la API, no nuestros: se dejan como vienen.
  const casa = (n: string) => rows.find((d) => d.casa === n)

  const official = casa('oficial')
  if (!official?.venta) throw new Error('dolarapi no devolvió el dólar oficial')

  const blue = casa('blue')?.venta
  // dolarapi llama 'bolsa' al MEP.
  const mep = casa('bolsa')?.venta
  const crypto = casa('cripto')?.venta

  return {
    date,
    officialBuy: fromNumeric(official.compra ?? official.venta),
    officialSell: fromNumeric(official.venta),
    blue: blue ? fromNumeric(blue) : null,
    mep: mep ? fromNumeric(mep) : null,
    crypto: crypto ? fromNumeric(crypto) : null,
    provider: 'dolarapi.com',
    fetchedAt: new Date().toISOString(),
  }
}

/** Pega a la API y devuelve la cotización de hoy. Tira si no hay red, si responde mal o si falta el oficial. */
export async function fetchDolarApi(timeoutMs = 6000): Promise<FxRate> {
  const res = await fetch(API, { signal: AbortSignal.timeout(timeoutMs) })
  if (!res.ok) throw new Error(`dolarapi respondió ${res.status}`)
  return parseDolarApi((await res.json()) as DolarApiRow[], today())
}
