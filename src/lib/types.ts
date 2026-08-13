import type { Cents } from './money'
import type { DateStr } from './dates'

export type TransactionType = 'expense' | 'income'
export type Currency = 'ARS' | 'USD'
export type PaymentMethod = 'mercadopago' | 'cash' | 'credit'
/** Qué dólar se aplicó. Nombres del mercado argentino, no hay traducción de 'mep'. */
export type FxType = 'official' | 'blue' | 'mep' | 'crypto' | 'manual'
export type Source = 'manual' | 'recurring' | 'meow_import' | 'splitwise'

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

  createdAt: string
  updatedAt: string
  deletedAt: string | null

  /** Solo local: 1 = todavía no subió. Dexie no indexa booleanos. */
  _dirty: 0 | 1
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
