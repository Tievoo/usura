/**
 * Taxonomía derivada de dos años y medio de gastos reales. Ver docs/CATEGORIAS.md.
 *
 * El slug es la clave que se guarda en el movimiento y **no cambia nunca**. Cuando
 * llegue la edición de categorías por usuario, esa tabla se cuelga de este slug
 * para pisar nombre, color u orden: así la columna del movimiento no se migra.
 */

export type TipoCategoria = 'gasto' | 'ingreso'

export interface Subcategoria {
  slug: string
  nombre: string
}

export interface Categoria {
  slug: string
  nombre: string
  /** Para los chips del alta, donde no entra el nombre largo. */
  corto?: string
  tipo: TipoCategoria
  color: string
  subs: Subcategoria[]
}

const sub = (slug: string, nombre: string): Subcategoria => ({ slug, nombre })

export const CATEGORIAS: Categoria[] = [
  {
    slug: 'comida', nombre: 'Comida', tipo: 'gasto', color: 'var(--cat-comida)',
    subs: [
      sub('restaurante', 'Restaurante'), sub('delivery', 'Delivery'), sub('fast-food', 'Fast food'),
      sub('merienda', 'Merienda y cafetería'), sub('facultad', 'Facultad'),
      sub('postres', 'Postres y helados'), sub('propina', 'Propina'),
    ],
  },
  {
    slug: 'super', nombre: 'Supermercado', corto: 'Super', tipo: 'gasto', color: 'var(--cat-super)',
    subs: [sub('super', 'Super'), sub('verduleria', 'Verdulería y carnicería'), sub('kiosco', 'Kiosco y chino'), sub('limpieza', 'Limpieza y hogar')],
  },
  {
    slug: 'bebidas', nombre: 'Bebidas', tipo: 'gasto', color: 'var(--cat-bebidas)',
    subs: [sub('sin-alcohol', 'Sin alcohol'), sub('alcohol', 'Alcohol'), sub('boliche', 'Salidas y boliche')],
  },
  {
    slug: 'transporte', nombre: 'Transporte', tipo: 'gasto', color: 'var(--cat-transporte)',
    subs: [
      sub('apps', 'Apps'), sub('nafta', 'Nafta'), sub('estacionamiento', 'Estacionamiento'),
      sub('peajes', 'Peajes'), sub('mantenimiento', 'Mantenimiento y reparación'), sub('publico', 'Transporte público'),
    ],
  },
  {
    slug: 'apuestas', nombre: 'Apuestas', tipo: 'gasto', color: 'var(--cat-apuestas)',
    subs: [sub('poker', 'Póker'), sub('casino', 'Casino y online'), sub('timba', 'Timba con amigos')],
  },
  {
    slug: 'entretenimiento', nombre: 'Entretenimiento', corto: 'Entretenim.', tipo: 'gasto', color: 'var(--cat-entretenim)',
    subs: [
      sub('recitales', 'Recitales y shows'), sub('cine', 'Cine'), sub('videojuegos', 'Videojuegos'),
      sub('salidas', 'Salidas y juegos'), sub('eventos', 'Eventos y entradas'),
    ],
  },
  {
    slug: 'deporte', nombre: 'Deporte', tipo: 'gasto', color: 'var(--cat-deporte)',
    subs: [sub('futbol', 'Fútbol'), sub('gym', 'Gym'), sub('otros-deportes', 'Otros deportes')],
  },
  {
    slug: 'salud', nombre: 'Salud', tipo: 'gasto', color: 'var(--cat-salud)',
    subs: [sub('psicologa', 'Psicóloga'), sub('medico', 'Médico y estudios'), sub('farmacia', 'Farmacia'), sub('optica', 'Óptica')],
  },
  {
    slug: 'suscripciones', nombre: 'Suscripciones', corto: 'Suscrip.', tipo: 'gasto', color: 'var(--cat-suscrip)',
    subs: [sub('streaming', 'Streaming'), sub('software', 'Software'), sub('servicios-digitales', 'Servicios digitales')],
  },
  {
    slug: 'tecnologia', nombre: 'Tecnología', tipo: 'gasto', color: 'var(--cat-tecnologia)',
    subs: [sub('componentes', 'Componentes y PC'), sub('celular', 'Celular'), sub('accesorios', 'Accesorios'), sub('reparaciones', 'Reparaciones')],
  },
  {
    slug: 'cuidado', nombre: 'Cuidado personal', corto: 'Cuidado', tipo: 'gasto', color: 'var(--cat-cuidado)',
    subs: [sub('peluqueria', 'Peluquería'), sub('perfumeria', 'Perfumería y cosmética'), sub('higiene', 'Higiene')],
  },
  {
    slug: 'ropa', nombre: 'Ropa y accesorios', corto: 'Ropa', tipo: 'gasto', color: 'var(--cat-ropa)',
    subs: [sub('ropa', 'Ropa'), sub('calzado', 'Calzado'), sub('accesorios-ropa', 'Accesorios')],
  },
  {
    slug: 'regalos', nombre: 'Regalos y ocasiones', corto: 'Regalos', tipo: 'gasto', color: 'var(--cat-regalos)',
    subs: [sub('regalos', 'Regalos'), sub('flores', 'Flores'), sub('aniversarios', 'Aniversarios y cumpleaños')],
  },
  {
    slug: 'hogar', nombre: 'Hogar y servicios', corto: 'Hogar', tipo: 'gasto', color: 'var(--cat-hogar)',
    subs: [sub('servicios', 'Servicios'), sub('muebles', 'Muebles y equipamiento'), sub('mantenimiento-hogar', 'Mantenimiento')],
  },
  {
    slug: 'impuestos', nombre: 'Impuestos y trámites', corto: 'Impuestos', tipo: 'gasto', color: 'var(--cat-impuestos)',
    subs: [sub('monotributo', 'Monotributo y AFIP'), sub('multas', 'Multas'), sub('documentacion', 'Documentación'), sub('comisiones', 'Comisiones bancarias')],
  },
  {
    slug: 'viajes', nombre: 'Viajes', tipo: 'gasto', color: 'var(--cat-viajes)',
    subs: [sub('vuelos', 'Vuelos'), sub('alojamiento', 'Alojamiento'), sub('gastos-viaje', 'Gastos en viaje')],
  },
  {
    slug: 'otros', nombre: 'Otros', tipo: 'gasto', color: 'var(--cat-otros)',
    subs: [sub('sin-categorizar', 'Sin categorizar')],
  },

  // ---- ingresos ----
  { slug: 'trabajo', nombre: 'Trabajo', tipo: 'ingreso', color: 'var(--inc-trabajo)', subs: [sub('honorarios', 'Honorarios'), sub('sueldo', 'Sueldo')] },
  { slug: 'venta-usd', nombre: 'Venta de USD', tipo: 'ingreso', color: 'var(--inc-usd)', subs: [] },
  { slug: 'ganancias-apuestas', nombre: 'Apuestas', tipo: 'ingreso', color: 'var(--inc-apuestas)', subs: [] },
  { slug: 'inversiones', nombre: 'Inversiones', tipo: 'ingreso', color: 'var(--inc-inversiones)', subs: [sub('intereses', 'Intereses y rendimientos')] },
  { slug: 'reintegros', nombre: 'Reintegros', tipo: 'ingreso', color: 'var(--inc-reintegros)', subs: [] },
  { slug: 'otros-ingreso', nombre: 'Otros', tipo: 'ingreso', color: 'var(--inc-otros)', subs: [] },
]

export const CAT_POR_SLUG: Record<string, Categoria> = Object.fromEntries(
  CATEGORIAS.map((c) => [c.slug, c]),
)

export const CATEGORIAS_GASTO = CATEGORIAS.filter((c) => c.tipo === 'gasto')
export const CATEGORIAS_INGRESO = CATEGORIAS.filter((c) => c.tipo === 'ingreso')

/**
 * Los cinco chips que se ven sin desplegar nada en el alta. Cubren el ~85% de
 * los gastos del export de Meow, así que la categoría casi nunca cuesta un toque extra.
 */
export const TOP_GASTO = ['transporte', 'comida', 'super', 'entretenimiento', 'deporte'] as const

export function nombreCategoria(slug: string): string {
  return CAT_POR_SLUG[slug]?.nombre ?? 'Sin categoría'
}

export function colorCategoria(slug: string): string {
  return CAT_POR_SLUG[slug]?.color ?? 'var(--cat-otros)'
}

export function nombreSubcategoria(catSlug: string, subSlug: string | null): string | null {
  if (!subSlug) return null
  return CAT_POR_SLUG[catSlug]?.subs.find((s) => s.slug === subSlug)?.nombre ?? null
}
