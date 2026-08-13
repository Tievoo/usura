import { useEffect, useState } from 'react'
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

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('transactions')
  const [online, setOnline] = useState(navigator.onLine)
  const [syncError, setSyncError] = useState<string | null>(null)

  const pending = useLiveQuery(() => countPending(), [], 0)

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

  return (
    <div className="app">
      {tab === 'transactions' && <Transactions userId={session.user.id} status={status} />}
      {tab === 'analytics' && (
        <ComingSoon
          title="Análisis"
          text="El gasto por categoría, por mes y por año llega en una próxima iteración. Todo lo que cargues ya queda listo para aparecer acá."
        />
      )}
      {tab === 'recurring' && (
        <ComingSoon
          title="Recurrentes"
          text="Suscripciones y cuotas, generándose solas en su fecha. Todavía no está."
        />
      )}
      {tab === 'debts' && (
        <ComingSoon
          title="Deudas"
          text="Quién te debe y a quién le debés, más el import de Splitwise. Todavía no está."
        />
      )}
      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
