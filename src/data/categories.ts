import type { TransactionType } from '../lib/types'

/**
 * Taxonomía derivada de dos años y medio de gastos reales. Ver docs/CATEGORIAS.md.
 *
 * El slug es la clave que se guarda en la transacción y **no cambia nunca**. Está
 * en castellano a propósito, aunque el resto del código esté en inglés: es un
 * valor de dominio que ya viaja en filas y en el CSV de Meow, no un identificador.
 * Cuando llegue la edición de categorías por usuario, esa tabla se cuelga de este
 * slug para pisar nombre, color u orden: así la columna de la transacción no se migra.
 *
 * Los nombres visibles y los tokens de color (`--cat-*`) también siguen en
 * castellano: son la UI y el design system.
 */

export interface Subcategory {
  slug: string
  name: string
}

export interface Category {
  slug: string
  name: string
  /** Para los chips del alta, donde no entra el nombre largo. */
  short?: string
  type: TransactionType
  color: string
  subs: Subcategory[]
}

const sub = (slug: string, name: string): Subcategory => ({ slug, name })

export const CATEGORIES: Category[] = [
  {
    slug: 'comida', name: 'Comida', type: 'expense', color: 'var(--cat-comida)',
    subs: [
      sub('restaurante', 'Restaurante'), sub('delivery', 'Delivery'), sub('fast-food', 'Fast food'),
      sub('merienda', 'Merienda y cafetería'), sub('facultad', 'Facultad'),
      sub('postres', 'Postres y helados'), sub('propina', 'Propina'),
    ],
  },
  {
    slug: 'super', name: 'Supermercado', short: 'Super', type: 'expense', color: 'var(--cat-super)',
    subs: [sub('super', 'Super'), sub('verduleria', 'Verdulería y carnicería'), sub('kiosco', 'Kiosco y chino'), sub('limpieza', 'Limpieza y hogar')],
  },
  {
    slug: 'bebidas', name: 'Bebidas', type: 'expense', color: 'var(--cat-bebidas)',
    subs: [sub('sin-alcohol', 'Sin alcohol'), sub('alcohol', 'Alcohol'), sub('boliche', 'Salidas y boliche')],
  },
  {
    slug: 'transporte', name: 'Transporte', type: 'expense', color: 'var(--cat-transporte)',
    subs: [
      sub('apps', 'Apps'), sub('nafta', 'Nafta'), sub('estacionamiento', 'Estacionamiento'),
      sub('peajes', 'Peajes'), sub('mantenimiento', 'Mantenimiento y reparación'), sub('publico', 'Transporte público'),
    ],
  },
  {
    slug: 'apuestas', name: 'Apuestas', type: 'expense', color: 'var(--cat-apuestas)',
    subs: [sub('poker', 'Póker'), sub('casino', 'Casino y online'), sub('timba', 'Timba con amigos')],
  },
  {
    slug: 'entretenimiento', name: 'Entretenimiento', short: 'Entretenim.', type: 'expense', color: 'var(--cat-entretenim)',
    subs: [
      sub('recitales', 'Recitales y shows'), sub('cine', 'Cine'), sub('videojuegos', 'Videojuegos'),
      sub('salidas', 'Salidas y juegos'), sub('eventos', 'Eventos y entradas'),
    ],
  },
  {
    slug: 'deporte', name: 'Deporte', type: 'expense', color: 'var(--cat-deporte)',
    subs: [sub('futbol', 'Fútbol'), sub('gym', 'Gym'), sub('otros-deportes', 'Otros deportes')],
  },
  {
    slug: 'salud', name: 'Salud', type: 'expense', color: 'var(--cat-salud)',
    subs: [sub('psicologa', 'Psicóloga'), sub('medico', 'Médico y estudios'), sub('farmacia', 'Farmacia'), sub('optica', 'Óptica')],
  },
  {
    slug: 'suscripciones', name: 'Suscripciones', short: 'Suscrip.', type: 'expense', color: 'var(--cat-suscrip)',
    subs: [sub('streaming', 'Streaming'), sub('software', 'Software'), sub('servicios-digitales', 'Servicios digitales')],
  },
  {
    slug: 'tecnologia', name: 'Tecnología', type: 'expense', color: 'var(--cat-tecnologia)',
    subs: [sub('componentes', 'Componentes y PC'), sub('celular', 'Celular'), sub('accesorios', 'Accesorios'), sub('reparaciones', 'Reparaciones')],
  },
  {
    slug: 'cuidado', name: 'Cuidado personal', short: 'Cuidado', type: 'expense', color: 'var(--cat-cuidado)',
    subs: [sub('peluqueria', 'Peluquería'), sub('perfumeria', 'Perfumería y cosmética'), sub('higiene', 'Higiene')],
  },
  {
    slug: 'ropa', name: 'Ropa y accesorios', short: 'Ropa', type: 'expense', color: 'var(--cat-ropa)',
    subs: [sub('ropa', 'Ropa'), sub('calzado', 'Calzado'), sub('accesorios-ropa', 'Accesorios')],
  },
  {
    slug: 'regalos', name: 'Regalos y ocasiones', short: 'Regalos', type: 'expense', color: 'var(--cat-regalos)',
    subs: [sub('regalos', 'Regalos'), sub('flores', 'Flores'), sub('aniversarios', 'Aniversarios y cumpleaños')],
  },
  {
    slug: 'hogar', name: 'Hogar y servicios', short: 'Hogar', type: 'expense', color: 'var(--cat-hogar)',
    subs: [sub('servicios', 'Servicios'), sub('muebles', 'Muebles y equipamiento'), sub('mantenimiento-hogar', 'Mantenimiento')],
  },
  {
    slug: 'impuestos', name: 'Impuestos y trámites', short: 'Impuestos', type: 'expense', color: 'var(--cat-impuestos)',
    subs: [sub('monotributo', 'Monotributo y AFIP'), sub('multas', 'Multas'), sub('documentacion', 'Documentación'), sub('comisiones', 'Comisiones bancarias')],
  },
  {
    slug: 'viajes', name: 'Viajes', type: 'expense', color: 'var(--cat-viajes)',
    subs: [sub('vuelos', 'Vuelos'), sub('alojamiento', 'Alojamiento'), sub('gastos-viaje', 'Gastos en viaje')],
  },
  {
    slug: 'otros', name: 'Otros', type: 'expense', color: 'var(--cat-otros)',
    subs: [sub('sin-categorizar', 'Sin categorizar')],
  },

  // ---- ingresos ----
  { slug: 'trabajo', name: 'Trabajo', type: 'income', color: 'var(--inc-trabajo)', subs: [sub('honorarios', 'Honorarios'), sub('sueldo', 'Sueldo')] },
  { slug: 'venta-usd', name: 'Venta de USD', type: 'income', color: 'var(--inc-usd)', subs: [] },
  { slug: 'ganancias-apuestas', name: 'Apuestas', type: 'income', color: 'var(--inc-apuestas)', subs: [] },
  { slug: 'inversiones', name: 'Inversiones', type: 'income', color: 'var(--inc-inversiones)', subs: [sub('intereses', 'Intereses y rendimientos')] },
  { slug: 'reintegros', name: 'Reintegros', type: 'income', color: 'var(--inc-reintegros)', subs: [] },
  { slug: 'otros-ingreso', name: 'Otros', type: 'income', color: 'var(--inc-otros)', subs: [] },
]

export const CATEGORY_BY_SLUG: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c]),
)

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.type === 'expense')
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.type === 'income')

/**
 * Los cinco chips que se ven sin desplegar nada en el alta. Cubren el ~85% de
 * los gastos del export de Meow, así que la categoría casi nunca cuesta un toque extra.
 */
export const TOP_EXPENSE = ['transporte', 'comida', 'super', 'entretenimiento', 'deporte'] as const

export function categoryName(slug: string): string {
  return CATEGORY_BY_SLUG[slug]?.name ?? 'Sin categoría'
}

export function categoryColor(slug: string): string {
  return CATEGORY_BY_SLUG[slug]?.color ?? 'var(--cat-otros)'
}

export function subcategoryName(catSlug: string, subSlug: string | null): string | null {
  if (!subSlug) return null
  return CATEGORY_BY_SLUG[catSlug]?.subs.find((s) => s.slug === subSlug)?.name ?? null
}
