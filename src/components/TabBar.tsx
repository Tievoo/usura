export type Pestania = 'movimientos' | 'analisis' | 'recurrentes' | 'deudas'

const PESTANIAS: { id: Pestania; nombre: string; path: string }[] = [
  { id: 'movimientos', nombre: 'Movimientos', path: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'analisis', nombre: 'Análisis', path: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { id: 'recurrentes', nombre: 'Recurrentes', path: 'M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4' },
  { id: 'deudas', nombre: 'Deudas', path: 'M3 7h18v11H3zM3 11h18M7 15h4' },
]

/**
 * Cuatro pestañas fijas. Las que todavía no existen no se esconden: muestran un
 * estado vacío honesto, así la estructura de la app no cambia entre iteraciones.
 */
export function TabBar({ activa, onCambiar }: { activa: Pestania; onCambiar: (p: Pestania) => void }) {
  return (
    <nav className="tabs">
      {PESTANIAS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onCambiar(p.id)}
          aria-current={activa === p.id ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.path} /></svg>
          {p.nombre}
        </button>
      ))}
    </nav>
  )
}
