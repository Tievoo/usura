/**
 * Dinero. Todo se maneja en **centavos como entero**: nunca un float.
 * `numeric(14,2)` en Postgres viene como string por PostgREST, así que la
 * conversión pasa siempre por acá y en un solo lugar.
 */

/** Centavos. Es un entero, siempre. */
export type Centavos = number

const fmtEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const fmtDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 2250000 -> "22.500" · 119250 -> "1.192,50" */
export function formatear(c: Centavos): string {
  const abs = Math.abs(c)
  const signo = c < 0 ? '−' : ''
  return abs % 100 === 0
    ? signo + fmtEntero.format(abs / 100)
    : signo + fmtDecimal.format(abs / 100)
}

/** Con el signo de ingreso adelante: "+5.500" */
export function formatearConSigno(c: Centavos, tipo: 'gasto' | 'ingreso'): string {
  return (tipo === 'ingreso' ? '+' : '') + formatear(c)
}

/** "US$ 15" — el prefijo va siempre, la ambigüedad con el peso no se tolera acá. */
export function formatearUsd(c: Centavos): string {
  return 'US$ ' + formatear(c)
}

/** Lo que tipeás en el teclado del alta: dígitos crudos -> centavos. */
export function desdeTecleado(digitos: string): Centavos {
  if (!digitos) return 0
  const n = Number.parseInt(digitos, 10)
  return Number.isFinite(n) ? n * 100 : 0
}

/** numeric(14,2) de Postgres -> centavos. */
export function desdeNumeric(v: string | number | null | undefined): Centavos {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** centavos -> string para numeric(14,2). */
export function aNumeric(c: Centavos): string {
  return (c / 100).toFixed(2)
}

/**
 * Convierte a pesos con la cotización del día.
 * Ambos argumentos en centavos; el resultado también.
 *   US$ 15 (1500) × $1.500,00 (150000) = $22.500 (2250000)
 */
export function aPesos(montoUsd: Centavos, fxValor: Centavos): Centavos {
  return Math.round((montoUsd * fxValor) / 100)
}

export const sumar = (xs: Centavos[]): Centavos => xs.reduce((a, b) => a + b, 0)
