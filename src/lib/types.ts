import type { Cents } from './money'
import type { DateStr } from './dates'

export type TransactionType = 'expense' | 'income'
export type Currency = 'ARS' | 'USD'
export type PaymentMethod = 'mercadopago' | 'cash' | 'credit'
/** Qué dólar se aplicó. Nombres del mercado argentino, no hay traducción de 'mep'. */
export type FxType = 'official' | 'blue' | 'mep' | 'crypto' | 'manual'
export type Source = 'manual' | 'recurring' | 'meow_import' | 'splitwise'

/** Una suscripción sigue hasta que la cortás; una serie de cuotas tiene fin conocido. */
export type RecurringType = 'subscription' | 'installments'
export type Frequency = 'monthly' | 'yearly'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'mercadopago', label: 'Mercado Pago' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'credit', label: 'Crédito' },
]

export const paymentMethodLabel = (m: PaymentMethod): string =>
  PAYMENT_METHODS.find((x) => x.value === m)?.label ?? m

export interface Transaction {
  id: string
  userId: string
  type: TransactionType
  date: DateStr
  /** Hora local 'HH:MM'. null cuando no se sabe: la UI lo dice, no la inventa. */
  time: string | null
  description: string

  /** Tal como se pagó, en centavos. */
  originalAmount: Cents
  currency: Currency
  /** Snapshot inmutable: se escribe una vez al crear y no se recalcula nunca. */
  arsAmount: Cents
  /** Cotización aplicada, en centavos. null si currency === 'ARS'. */
  fxRate: Cents | null
  fxType: FxType | null
  /** Puede diferir de `date` en fin de semana o feriado. */
  fxDate: DateStr | null

  /** Slug de src/data/categories.ts. En castellano y estable. */
  category: string
  subcategory: string | null
  paymentMethod: PaymentMethod
  /** Parte que te devolvieron. Los totales usan arsAmount - refundArs. */
  refundArs: Cents

  notes: string | null
  source: Source

  /** De qué serie viene, si viene de una. */
  recurringRuleId: string | null
  /** Período que cubre: 'YYYY-MM' mensual y cuotas, 'YYYY' anual. */
  recurringPeriod: string | null
  installmentNo: number | null
  installmentTotal: number | null

  createdAt: string
  updatedAt: string
  deletedAt: string | null

  /** Solo local: 1 = todavía no subió. Dexie no indexa booleanos. */
  _dirty: 0 | 1
}

/** De dónde salió el movimiento, dicho para una persona. */
export function sourceLabel(t: Transaction): string {
  switch (t.source) {
    case 'meow_import': return 'Importado de Meow'
    case 'splitwise': return 'Importado de Splitwise'
    case 'recurring':
      return t.installmentNo !== null && t.installmentTotal !== null
        ? `Generado por una serie · cuota ${t.installmentNo} de ${t.installmentTotal}`
        : 'Generado por una serie'
    default: return 'Cargado a mano'
  }
}

/** Lo que realmente salió de tu bolsillo. */
export const net = (t: Transaction): Cents => t.arsAmount - t.refundArs

export interface FxRate {
  date: DateStr
  officialBuy: Cents
  officialSell: Cents
  blue: Cents | null
  mep: Cents | null
  crypto: Cents | null
  /** Quién dio el dato. No confundir con el `source` de Transaction. */
  provider: string
  fetchedAt: string
}

/** Estado de la conexión y de la cola, para el indicador de la UI. */
export interface SyncStatus {
  online: boolean
  pending: number
  syncing: boolean
  lastError: string | null
}

/**
 * Una serie: la suscripción de Crunchyroll o las 12 cuotas de la notebook.
 *
 * No es dueña de sus instancias. Cada movimiento que genera es un movimiento
 * común: se edita y se archiva solo, y editar la serie no reescribe el pasado.
 */
export interface RecurringRule {
  id: string
  userId: string
  type: RecurringType
  description: string

  /** Lo que se paga **cada vez**. El total de una serie de cuotas se calcula. */
  amount: Cents
  currency: Currency

  category: string
  subcategory: string | null
  paymentMethod: PaymentMethod

  frequency: Frequency
  /** Se recorta al último día si el mes es más corto: el 31 cae 28 en febrero. */
  dayOfMonth: number

  startDate: DateStr
  /** null = sigue hasta que la cortes. En una suscripción es lo normal. */
  endDate: DateStr | null
  /** Solo en cuotas. Es lo que le da fin conocido a la serie. */
  installmentsTotal: number | null

  active: boolean
  notes: string | null

  createdAt: string
  updatedAt: string
  deletedAt: string | null

  _dirty: 0 | 1
}

export const recurringTypeLabel = (r: RecurringRule): string =>
  r.type === 'installments' ? 'Cuotas' : r.frequency === 'yearly' ? 'Anual' : 'Mensual'
