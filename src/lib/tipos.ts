import type { Centavos } from './plata'
import type { Fecha } from './fechas'

export type Tipo = 'gasto' | 'ingreso'
export type Moneda = 'ARS' | 'USD'
export type MedioPago = 'mercadopago' | 'efectivo' | 'credito'
export type FxTipo = 'oficial' | 'blue' | 'mep' | 'cripto' | 'manual'
export type Origen = 'manual' | 'recurrente' | 'import_meow' | 'splitwise'

export const MEDIOS: { valor: MedioPago; nombre: string }[] = [
  { valor: 'mercadopago', nombre: 'Mercado Pago' },
  { valor: 'efectivo', nombre: 'Efectivo' },
  { valor: 'credito', nombre: 'Crédito' },
]

export const nombreMedio = (m: MedioPago): string =>
  MEDIOS.find((x) => x.valor === m)?.nombre ?? m

export interface Movimiento {
  id: string
  userId: string
  tipo: Tipo
  fecha: Fecha
  concepto: string

  /** Tal como se pagó, en centavos. */
  montoOriginal: Centavos
  moneda: Moneda
  /** Snapshot inmutable: se escribe una vez al crear y no se recalcula nunca. */
  montoArs: Centavos
  /** Cotización aplicada, en centavos. null si moneda === 'ARS'. */
  fxValor: Centavos | null
  fxTipo: FxTipo | null
  /** Puede diferir de `fecha` en fin de semana o feriado. */
  fxFecha: Fecha | null

  categoria: string
  subcategoria: string | null
  medioPago: MedioPago
  /** Parte que te devolvieron. Los totales usan montoArs - reembolsoArs. */
  reembolsoArs: Centavos

  notas: string | null
  origen: Origen

  createdAt: string
  updatedAt: string
  deletedAt: string | null

  /** Solo local: 1 = todavía no subió. Dexie no indexa booleanos. */
  _dirty: 0 | 1
}

/** Lo que realmente salió de tu bolsillo. */
export const neto = (m: Movimiento): Centavos => m.montoArs - m.reembolsoArs

export interface Cotizacion {
  fecha: Fecha
  oficialCompra: Centavos
  oficialVenta: Centavos
  blue: Centavos | null
  mep: Centavos | null
  cripto: Centavos | null
  fuente: string
  fetchedAt: string
}

/** Estado de la conexión y de la cola, para el indicador de la UI. */
export interface EstadoSync {
  online: boolean
  pendientes: number
  sincronizando: boolean
  ultimoError: string | null
}
