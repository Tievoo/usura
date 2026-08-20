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
export interface TransactionRow {
  id: string
  user_id: string
  type: string
  date: string
  time: string | null
  description: string
  original_amount: string
  currency: string
  ars_amount: string
  fx_rate: string | null
  fx_type: string | null
  fx_date: string | null
  category: string
  subcategory: string | null
  payment_method: string
  refund_ars: string
  notes: string | null
  source: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
