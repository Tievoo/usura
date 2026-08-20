import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { onSync, startSync } from './lib/sync'
import { countPending, clearAll } from './lib/db'
import { preload } from './lib/fx'
import { Login } from './components/Login'
import { TabBar, type Tab } from './components/TabBar'
import { Transactions } from './screens/Transactions'
import { ComingSoon } from './screens/ComingSoon'

/** El orden de las pestañas, que es el que recorre el swipe. */
const ORDEN: Tab[] = ['transactions', 'analytics', 'recurring', 'debts']

/** Mínimo recorrido horizontal para que cuente como swipe y no como toque. */
const MIN_DX = 60
/** Cuánto más horizontal que vertical tiene que ser, para no robarle el scroll a la lista. */
const RATIO = 1.5
/** Un arrastre lento es alguien leyendo, no cambiando de pantalla. */
const MAX_MS = 600

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('transactions')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncError, setSyncError] = useState<string | null>(null)

  const pending = useLiveQuery(() => countPending(), [], 0)
  const gesto = useRef<{ x: number; y: number; t: number } | null>(null)

  function alTocar(e: React.TouchEvent) {
    // Dentro de una hoja o su fondo, el swipe no cambia de pestaña. Y con una hoja
    // abierta tampoco, aunque el gesto arranque en el header: la pista se movería
    // llevándose el modal puesto.
    if ((e.target as HTMLElement).closest('.sheet, .scrim')) { gesto.current = null; return }
    if (document.querySelector('.sheet.on')) { gesto.current = null; return }
    const p = e.touches[0]
    gesto.current = p ? { x: p.clientX, y: p.clientY, t: Date.now() } : null
  }

  function alSoltar(e: React.TouchEvent) {
    const g = gesto.current
    gesto.current = null
    const p = e.changedTouches[0]
    if (!g || !p) return

    const dx = p.clientX - g.x
    const dy = p.clientY - g.y
    if (Math.abs(dx) < MIN_DX) return
    if (Math.abs(dx) < Math.abs(dy) * RATIO) return
    if (Date.now() - g.t > MAX_MS) return

    // Arrastrar a la izquierda avanza, como el orden de lectura.
    const i = ORDEN.indexOf(tab)
    const j = dx < 0 ? i + 1 : i - 1
    const destino = ORDEN[j]
    if (destino) setTab(destino)
  }

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      // La base local es de un solo usuario a la vez: al salir, se limpia.
      if (event === 'SIGNED_OUT') void clearAll()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    preload()
    const stop = startSync()
    const off = onSync(({ error }) => setSyncError(error))
    return () => { stop(); off() }
  }, [session])

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (loading) return <div className="app" />
  if (!session) return <div className="app"><Login /></div>

  const status = { online, pending, error: syncError }

  const indice = ORDEN.indexOf(tab)

  // Las cuatro montadas: lo que se anima es el desplazamiento de la pista, así que
  // la pantalla que entra tiene que existir antes de entrar.
  const paneles: { id: Tab; contenido: React.ReactNode }[] = [
    { id: 'transactions', contenido: <Transactions userId={session.user.id} status={status} /> },
    {
      id: 'analytics',
      contenido: (
        <ComingSoon
          title="Análisis"
          text="El gasto por categoría, por mes y por año llega en una próxima iteración. Todo lo que cargues ya queda listo para aparecer acá."
        />
      ),
    },
    {
      id: 'recurring',
      contenido: (
        <ComingSoon
          title="Recurrentes"
          text="Suscripciones y cuotas, generándose solas en su fecha. Todavía no está."
        />
      ),
    },
    {
      id: 'debts',
      contenido: (
        <ComingSoon
          title="Deudas"
          text="Quién te debe y a quién le debés, más el import de Splitwise. Todavía no está."
        />
      ),
    },
  ]

  return (
    <div className="app" onTouchStart={alTocar} onTouchEnd={alSoltar}>
      <div className="track" style={{ transform: `translateX(${indice * -100}%)` }}>
        {paneles.map((p) => (
          <section key={p.id} className="pane" aria-hidden={p.id !== tab}>
            {p.contenido}
          </section>
        ))}
      </div>
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
