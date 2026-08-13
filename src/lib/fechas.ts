/**
 * Fechas. Todo se guarda como 'YYYY-MM-DD' en hora local, nunca como ISO con
 * timezone: un gasto del 31 de julio a las 23:00 en Buenos Aires no puede
 * contarse en agosto porque UTC ya cambió de día.
 */

export type Fecha = string // 'YYYY-MM-DD'

const p2 = (n: number) => String(n).padStart(2, '0')

export function hoy(): Fecha {
  return aFecha(new Date())
}

export function aFecha(d: Date): Fecha {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** Parsea en hora local. `new Date('2026-07-31')` sería UTC y restaría un día. */
export function deFecha(f: Fecha): Date {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** '2026-07' — la clave de mes que usa toda la app. */
export type Mes = string
export const mesDe = (f: Fecha): Mes => f.slice(0, 7)
export const mesActual = (): Mes => mesDe(hoy())

export function mesSiguiente(m: Mes): Mes {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y ?? 1970, (mm ?? 1) - 1 + 1, 1)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
}

export function mesAnterior(m: Mes): Mes {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y ?? 1970, (mm ?? 1) - 1 - 1, 1)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
}

/** Rango [desde, hasta] inclusive de un mes, para consultar por índice. */
export function rangoMes(m: Mes): [Fecha, Fecha] {
  const [y, mm] = m.split('-').map(Number)
  const ultimo = new Date(y ?? 1970, mm ?? 1, 0).getDate()
  return [`${m}-01`, `${m}-${p2(ultimo)}`]
}

const fmtMes = new Intl.DateTimeFormat('es-AR', { month: 'long' })
const fmtMesAnio = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
const fmtDiaSemana = new Intl.DateTimeFormat('es-AR', { weekday: 'long' })
const fmtDiaCorto = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

const primerDia = (m: Mes) => deFecha(`${m}-01`)

/** 'julio' */
export const nombreMes = (m: Mes): string => fmtMes.format(primerDia(m))
/** 'julio de 2026' */
export const nombreMesAnio = (m: Mes): string => fmtMesAnio.format(primerDia(m))
/** 'viernes 31' — el encabezado de día de la lista */
export function encabezadoDia(f: Fecha): string {
  const d = deFecha(f)
  return `${fmtDiaSemana.format(d)} ${d.getDate()}`
}
/** '31 jul' */
export const diaCorto = (f: Fecha): string => fmtDiaCorto.format(deFecha(f)).replace('.', '')
