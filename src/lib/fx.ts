import { cotizacionLocal, guardarCotizacion, ultimaCotizacion } from './db'
import { desdeNumeric, type Centavos } from './plata'
import { hoy, type Fecha } from './fechas'
import type { Cotizacion, FxTipo } from './tipos'

/**
 * Cotización del dólar. Dos reglas que gobiernan todo esto:
 *
 * 1. El snapshot es inmutable: una vez que un movimiento guardó su fxValor, no se
 *    recalcula nunca, ni si después corregimos la fuente.
 * 2. Una API caída no bloquea el alta. Si no hay cotización, se usa la última
 *    conocida y se devuelve `estimado: true` para que la UI lo diga.
 */

const API = 'https://dolarapi.com/v1/dolares'

interface RespuestaDolar {
  casa: string
  compra: number | null
  venta: number | null
  fechaActualizacion: string
}

export interface Resuelta {
  valor: Centavos
  tipo: FxTipo
  fecha: Fecha
  /** true cuando la cotización no es la del día pedido (fin de semana, feriado, API caída). */
  estimado: boolean
}

/** Dólar oficial por defecto: el blue y el cripto dejaron de ser referencia. */
export const TIPO_POR_DEFECTO: FxTipo = 'oficial'

function valorSegunTipo(c: Cotizacion, tipo: FxTipo): Centavos {
  switch (tipo) {
    case 'blue': return c.blue ?? c.oficialVenta
    case 'mep': return c.mep ?? c.oficialVenta
    case 'cripto': return c.cripto ?? c.oficialVenta
    default: return c.oficialVenta
  }
}

async function traerDeApi(): Promise<Cotizacion | null> {
  try {
    const r = await fetch(API, { signal: AbortSignal.timeout(6000) })
    if (!r.ok) return null
    const datos = (await r.json()) as RespuestaDolar[]
    const casa = (n: string) => datos.find((d) => d.casa === n)

    const oficial = casa('oficial')
    if (!oficial?.venta) return null

    const c: Cotizacion = {
      // La fecha es la del día en que rige, no la de actualización del feed.
      fecha: hoy(),
      oficialCompra: desdeNumeric(oficial.compra ?? oficial.venta),
      oficialVenta: desdeNumeric(oficial.venta),
      blue: casa('blue')?.venta ? desdeNumeric(casa('blue')!.venta) : null,
      // dolarapi llama 'bolsa' al MEP.
      mep: casa('bolsa')?.venta ? desdeNumeric(casa('bolsa')!.venta) : null,
      cripto: casa('cripto')?.venta ? desdeNumeric(casa('cripto')!.venta) : null,
      fuente: 'dolarapi.com',
      fetchedAt: new Date().toISOString(),
    }
    await guardarCotizacion(c)
    return c
  } catch {
    return null
  }
}

/**
 * Resuelve la cotización a aplicar a un gasto con fecha `fecha`.
 * Devuelve null solo si nunca conseguimos ninguna cotización: en ese caso el
 * movimiento se guarda en dólares sin convertir y queda pendiente.
 */
export async function resolver(fecha: Fecha, tipo: FxTipo = TIPO_POR_DEFECTO): Promise<Resuelta | null> {
  const cacheada = await cotizacionLocal(fecha)
  if (cacheada) {
    return { valor: valorSegunTipo(cacheada, tipo), tipo, fecha, estimado: false }
  }

  if (fecha === hoy()) {
    const fresca = await traerDeApi()
    if (fresca) return { valor: valorSegunTipo(fresca, tipo), tipo, fecha, estimado: false }
  }

  // Fin de semana, feriado, o sin red: la última que tengamos, avisando que es estimada.
  const ultima = await ultimaCotizacion()
  if (!ultima) return null
  return { valor: valorSegunTipo(ultima, tipo), tipo, fecha: ultima.fecha, estimado: true }
}

/** Precarga al abrir la app, en segundo plano. Si falla, no pasa nada. */
export function precargar(): void {
  void cotizacionLocal(hoy()).then((c) => {
    if (!c) void traerDeApi()
  })
}
