import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY. Copiá .env.example a .env.local.',
  )
}

/**
 * La publishable key es pública por diseño: viaja en el bundle y no da acceso
 * a nada por sí sola. Lo que protege los datos es RLS. Ver docs/ESPECIFICACION.md §8.
 */
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Fila tal como viaja por PostgREST: snake_case y numeric como string. */
export interface FilaMovimiento {
  id: string
  user_id: string
  tipo: string
  fecha: string
  concepto: string
  monto_original: string
  moneda: string
  monto_ars: string
  fx_valor: string | null
  fx_tipo: string | null
  fx_fecha: string | null
  categoria: string
  subcategoria: string | null
  medio_pago: string
  reembolso_ars: string
  notas: string | null
  origen: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
