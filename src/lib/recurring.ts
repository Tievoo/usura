import { db, instancesOfRule, recurringRules } from './db'
import { resolveRate, DEFAULT_FX_TYPE, type ResolvedRate } from './fx'
import { toArs, sum, type Cents } from './money'
import {
  addDays, currentMonth, daysInMonth, monthOf, monthRange, nextMonth, parseDate, today,
  type DateStr, type MonthStr,
} from './dates'
import { net, type RecurringRule, type Transaction } from './types'

/**
 * Recurrentes. Una serie describe *cuándo y cuánto*; los movimientos que genera
 * son movimientos comunes, y una vez creados la serie no manda más sobre ellos.
 *
 * Dos reglas gobiernan todo este archivo:
 *
 * 1. **Generar dos veces no duplica.** El id de cada instancia se deriva de
 *    (serie, período), así que dos dispositivos que abren la app el mismo día
 *    escriben la misma fila y el upsert los pone de acuerdo solo.
 * 2. **Nada de números inventados.** Una instancia futura no se crea; se muestra
 *    como estimada. Y una serie en dólares con vencimiento viejo, sin cotización
 *    de esa fecha, se guarda sin convertir en vez de aplicarle la de hoy.
 */

/** Un vencimiento de la serie: qué período cubre y qué día cae. */
export interface Occurrence {
  /** 'YYYY-MM' en mensuales y cuotas, 'YYYY' en anuales. */
  period: string
  date: DateStr
  /** 4, en «4 de 12». null en suscripciones. */
  installmentNo: number | null
}

/** Tope de cordura para una suscripción sin fin: 50 años de vencimientos. */
const MAX_OCCURRENCES = 600
/** Días de gracia para aceptar una cotización que no es la del día exacto. */
const FX_TOLERANCE_DAYS = 4
/** Horizonte para calcular «cuándo cae la próxima»: alcanza para las anuales. */
const HORIZON_DAYS = 400

/** El día que le toca a la serie dentro de un mes, recortado si el mes es más corto. */
function dueDate(rule: RecurringRule, month: MonthStr): DateStr {
  const day = Math.min(rule.dayOfMonth, daysInMonth(month))
  return `${month}-${String(day).padStart(2, '0')}`
}

/**
 * Todos los vencimientos de la serie desde que arranca hasta `until` inclusive.
 *
 * Un vencimiento anterior a `startDate` no cuenta: si la serie arranca el 20 y
 * cae los 5, el primer cobro es el 5 del mes siguiente, no cinco días antes de
 * que la serie existiera.
 */
export function occurrences(rule: RecurringRule, until: DateStr): Occurrence[] {
  const out: Occurrence[] = []
  const yearly = rule.frequency === 'yearly'
  const anchorMonth = rule.startDate.slice(5, 7)
  const limit = rule.endDate && rule.endDate < until ? rule.endDate : until
  const max = rule.installmentsTotal ?? MAX_OCCURRENCES

  let month = monthOf(rule.startDate)
  while (out.length < max) {
    const date = dueDate(rule, month)
    if (date > limit) break
    if (date >= rule.startDate) {
      out.push({
        period: yearly ? month.slice(0, 4) : month,
        date,
        installmentNo: rule.installmentsTotal ? out.length + 1 : null,
      })
    }
    month = yearly ? `${Number(month.slice(0, 4)) + 1}-${anchorMonth}` : nextMonth(month)
  }
  return out
}

/**
 * El id de una instancia se deriva de (serie, período) en vez de sortearse: es un
 * UUID v5 con la serie como espacio de nombres. Por eso dos dispositivos que
 * generan el mismo mes no crean dos gastos, y el índice único de la base es el
 * cinturón y no el que hace el trabajo.
 */
async function instanceId(ruleId: string, period: string): Promise<string> {
  const hex = ruleId.replace(/-/g, '')
  const ns = new Uint8Array(16)
  for (let i = 0; i < 16; i++) ns[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)

  const name = new TextEncoder().encode(period)
  const input = new Uint8Array(ns.length + name.length)
  input.set(ns)
  input.set(name, ns.length)

  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', input))
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50 // versión 5
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80 // variante RFC 4122

  const out = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`
}

/**
 * La cotización a aplicar a un vencimiento. Un fin de semana o un feriado largo
 * se toleran; la de hoy aplicada a un vencimiento de hace ocho meses sería un
 * número inventado, así que en ese caso la instancia se guarda sin convertir y
 * la lista la muestra como «a convertir».
 */
async function rateFor(date: DateStr): Promise<ResolvedRate | null> {
  const r = await resolveRate(date, DEFAULT_FX_TYPE)
  if (!r || !r.estimated) return r
  const days = Math.abs(parseDate(date).getTime() - parseDate(r.date).getTime()) / 86_400_000
  return days <= FX_TOLERANCE_DAYS ? r : null
}

async function instanceFor(rule: RecurringRule, occ: Occurrence): Promise<Transaction> {
  const now = new Date().toISOString()
  const usd = rule.currency === 'USD'
  const fx = usd ? await rateFor(occ.date) : null

  return {
    id: await instanceId(rule.id, occ.period),
    userId: rule.userId,
    type: 'expense',
    date: occ.date,
    // La serie sabe el día, no la hora, y no la vamos a inventar.
    time: null,
    description: rule.description,
    originalAmount: rule.amount,
    currency: rule.currency,
    arsAmount: usd ? (fx ? toArs(rule.amount, fx.value) : 0) : rule.amount,
    fxRate: usd ? fx?.value ?? null : null,
    fxType: usd ? fx?.type ?? null : null,
    fxDate: usd ? fx?.date ?? null : null,
    category: rule.category,
    subcategory: rule.subcategory,
    paymentMethod: rule.paymentMethod,
    refundArs: 0,
    notes: rule.notes,
    source: 'recurring',
    recurringRuleId: rule.id,
    recurringPeriod: occ.period,
    installmentNo: occ.installmentNo,
    installmentTotal: rule.installmentsTotal,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    _dirty: 1,
  }
}

let generating = false

/**
 * Crea los movimientos que las series ya deben, hasta hoy inclusive. Se corre al
 * abrir la app y después de cada sync.
 *
 * Lo que ya existe no se toca —ni siquiera si lo archivaste—: archivar la
 * instancia de marzo es una decisión, no un hueco que haya que rellenar.
 */
export async function generateDue(): Promise<number> {
  if (generating) return 0
  generating = true
  try {
    const hoy = today()
    let created = 0

    for (const rule of await recurringRules()) {
      if (!rule.active) continue
      const done = new Set((await instancesOfRule(rule.id)).map((t) => t.recurringPeriod))

      for (const occ of occurrences(rule, hoy)) {
        if (done.has(occ.period)) continue
        await db.transactions.put(await instanceFor(rule, occ))
        created++
      }
    }
    return created
  } finally {
    generating = false
  }
}

/* ---------- lo que la pantalla necesita saber de una serie ---------- */

export interface RuleSummary {
  rule: RecurringRule
  /** Cuántas veces se generó ya, archivadas incluidas. */
  generated: number
  /** Lo que efectivamente salió por esta serie, en pesos y sin las archivadas. */
  spent: Cents
  /** Cuándo cae la próxima, o null si la serie ya no tiene próxima. */
  next: DateStr | null
  /** La cuota que viene: el 4 de «4 de 12». null en suscripciones. */
  nextInstallment: number | null
  /** Cuántas quedan. null cuando no tiene fin conocido, que es lo normal en una suscripción. */
  remaining: number | null
}

export function summarize(rule: RecurringRule, instances: Transaction[]): RuleSummary {
  const mine = instances.filter((t) => t.recurringRuleId === rule.id)
  const alive = mine.filter((t) => !t.deletedAt)
  const hoy = today()

  const future = rule.active
    ? occurrences(rule, addDays(hoy, HORIZON_DAYS)).find((o) => o.date > hoy)
    : undefined

  return {
    rule,
    generated: mine.length,
    spent: sum(alive.map(net)),
    next: future?.date ?? null,
    nextInstallment: future?.installmentNo ?? null,
    remaining: rule.installmentsTotal === null ? null : Math.max(0, rule.installmentsTotal - mine.length),
  }
}

/** El próximo vencimiento de una serie dentro del mes en curso, si todavía no pasó. */
export interface Upcoming {
  rule: RecurringRule
  date: DateStr
  installmentNo: number | null
}

/**
 * Qué se viene en lo que queda del mes. No son movimientos: todavía no ocurrieron,
 * así que la pantalla los muestra como estimados y no suman a ningún total real.
 */
export function upcomingThisMonth(rules: RecurringRule[]): Upcoming[] {
  const hoy = today()
  const mes = currentMonth()

  return rules
    .filter((r) => r.active)
    .flatMap((rule) =>
      occurrences(rule, addDays(hoy, HORIZON_DAYS))
        .filter((o) => o.date > hoy && monthOf(o.date) === mes)
        .map((o) => ({ rule, date: o.date, installmentNo: o.installmentNo })),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
}

/* ---------- lo que las series comprometen en un mes ---------- */

export interface Commitment {
  total: Cents
  /** true si alguna parte todavía no ocurrió o se convirtió con la cotización de hoy. */
  estimated: boolean
}

/**
 * Cuánto pesa lo recurrente en un mes. Lo que ya se generó cuenta por lo que
 * realmente salió —incluida la edición que le hayas hecho a esa instancia—; lo que
 * falta, por lo que dice la serie. Si hay algo de lo segundo el número es estimado
 * y la pantalla lo dice, porque un cobro que todavía no pasó puede no pasar.
 */
export function monthCommitment(
  rules: RecurringRule[],
  instances: Transaction[],
  month: MonthStr,
  rate: ResolvedRate | null,
): Commitment {
  const [, endOfMonth] = monthRange(month)
  let total: Cents = 0
  let estimated = false

  for (const rule of rules) {
    if (!rule.active) continue

    for (const occ of occurrences(rule, endOfMonth)) {
      if (monthOf(occ.date) !== month) continue

      const done = instances.find((t) => t.recurringRuleId === rule.id && t.recurringPeriod === occ.period)
      if (done) {
        // Archivada: la sacaste a propósito y no vuelve a contar.
        if (!done.deletedAt) total += net(done)
        continue
      }

      estimated = true
      if (rule.currency !== 'USD') total += rule.amount
      // Sin cotización no inventamos la conversión: queda afuera del total y el
      // «estimado» ya avisa que el número no está completo.
      else if (rate) total += toArs(rule.amount, rate.value)
    }
  }

  return { total, estimated }
}
