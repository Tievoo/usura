/**
 * Fechas. Todo se guarda como 'YYYY-MM-DD' en hora local, nunca como ISO con
 * timezone: un gasto del 31 de julio a las 23:00 en Buenos Aires no puede
 * contarse en agosto porque UTC ya cambió de día.
 */

export type DateStr = string // 'YYYY-MM-DD'

const p2 = (n: number) => String(n).padStart(2, '0')

export function today(): DateStr {
  return toDateStr(new Date())
}

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

/** Parsea en hora local. `new Date('2026-07-31')` sería UTC y restaría un día. */
export function parseDate(f: DateStr): Date {
  const [y, m, d] = f.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

/** 'HH:MM' local, para sellar la hora de un gasto que se carga ahora. */
export function nowTime(): string {
  const d = new Date()
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** '2026-07' — la clave de mes que usa toda la app. */
export type MonthStr = string
export const monthOf = (f: DateStr): MonthStr => f.slice(0, 7)
export const currentMonth = (): MonthStr => monthOf(today())

export function nextMonth(m: MonthStr): MonthStr {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y ?? 1970, (mm ?? 1) - 1 + 1, 1)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
}

export function prevMonth(m: MonthStr): MonthStr {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y ?? 1970, (mm ?? 1) - 1 - 1, 1)
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`
}

/** Rango [desde, hasta] inclusive de un mes, para consultar por índice. */
export function monthRange(m: MonthStr): [DateStr, DateStr] {
  const [y, mm] = m.split('-').map(Number)
  const last = new Date(y ?? 1970, mm ?? 1, 0).getDate()
  return [`${m}-01`, `${m}-${p2(last)}`]
}

const monthFmt = new Intl.DateTimeFormat('es-AR', { month: 'long' })
const monthYearFmt = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long' })
const shortDayFmt = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })

const firstDay = (m: MonthStr) => parseDate(`${m}-01`)

/** 'julio' */
export const monthName = (m: MonthStr): string => monthFmt.format(firstDay(m))
/** 'julio de 2026' */
export const monthYearName = (m: MonthStr): string => monthYearFmt.format(firstDay(m))
/** 'viernes 31' — el encabezado de día de la lista */
export function dayHeading(f: DateStr): string {
  const d = parseDate(f)
  return `${weekdayFmt.format(d)} ${d.getDate()}`
}
/** '31 jul' */
export const shortDay = (f: DateStr): string => shortDayFmt.format(parseDate(f)).replace('.', '')
