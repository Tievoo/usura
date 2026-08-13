export type Tab = 'transactions' | 'analytics' | 'recurring' | 'debts'

const TABS: { id: Tab; label: string; path: string }[] = [
  { id: 'transactions', label: 'Movimientos', path: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'analytics', label: 'Análisis', path: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'recurring', label: 'Recurrentes', path: 'M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4' },
  { id: 'debts', label: 'Deudas', path: 'M3 7h18v11H3zM3 11h18M7 15h4' },
]

/**
 * Cuatro pestañas fijas. Las que todavía no existen no se esconden: muestran un
 * estado vacío honesto, así la estructura de la app no cambia entre iteraciones.
 */
export function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabs">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-current={active === t.id ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={t.path} /></svg>
          {t.label}
        </button>
      ))}
    </nav>
  )
}
