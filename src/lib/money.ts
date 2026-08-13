/**
 * Dinero. Todo se maneja en **centavos como entero**: nunca un float.
 * `numeric(14,2)` en Postgres viene como string por PostgREST, así que la
 * conversión pasa siempre por acá y en un solo lugar.
 */

/** Centavos. Es un entero, siempre. */
export type Cents = number

const intFmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const decimalFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 2250000 -> "22.500" · 119250 -> "1.192,50" */
export function format(c: Cents): string {
  const abs = Math.abs(c)
  const sign = c < 0 ? '−' : ''
  return abs % 100 === 0
    ? sign + intFmt.format(abs / 100)
    : sign + decimalFmt.format(abs / 100)
}

/** Con el signo de ingreso adelante: "+5.500" */
export function formatWithSign(c: Cents, type: 'expense' | 'income'): string {
  return (type === 'income' ? '+' : '') + format(c)
}

/** "US$ 15" — el prefijo va siempre, la ambigüedad con el peso no se tolera acá. */
export function formatUsd(c: Cents): string {
  return 'US$ ' + format(c)
}

/** Lo que tipeás en el teclado del alta: dígitos crudos -> centavos. */
export function fromKeypad(digits: string): Cents {
  if (!digits) return 0
  const n = Number.parseInt(digits, 10)
  return Number.isFinite(n) ? n * 100 : 0
}

/** numeric(14,2) de Postgres -> centavos. */
export function fromNumeric(v: string | number | null | undefined): Cents {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number.parseFloat(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** centavos -> string para numeric(14,2). */
export function toNumeric(c: Cents): string {
  return (c / 100).toFixed(2)
}

/**
 * Convierte a pesos con la cotización del día.
 * Ambos argumentos en centavos; el resultado también.
 *   US$ 15 (1500) × $1.500,00 (150000) = $22.500 (2250000)
 */
export function toArs(usdAmount: Cents, fxRate: Cents): Cents {
  return Math.round((usdAmount * fxRate) / 100)
}

export const sum = (xs: Cents[]): Cents => xs.reduce((a, b) => a + b, 0)
