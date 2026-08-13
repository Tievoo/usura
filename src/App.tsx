import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { alSincronizar, iniciarSync } from './lib/sync'
import { contarPendientes, vaciarTodo } from './lib/db'
import { precargar } from './lib/fx'
import { Login } from './components/Login'
import { TabBar, type Pestania } from './components/TabBar'
import { Movimientos } from './screens/Movimientos'
import { Pendiente } from './screens/Pendiente'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)
  const [pestania, setPestania] = useState<Pestania>('movimientos')
  const [online, setOnline] = useState(navigator.onLine)
  const [errorSync, setErrorSync] = useState<string | null>(null)

  const pendientes = useLiveQuery(() => contarPendientes(), [], 0)

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setCargando(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s)
      // La base local es de un solo usuario a la vez: al salir, se limpia.
      if (evento === 'SIGNED_OUT') void vaciarTodo()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    precargar()
    const detener = iniciarSync()
    const off = alSincronizar(({ error }) => setErrorSync(error))
    return () => { detener(); off() }
  }, [session])

  useEffect(() => {
    const arriba = () => setOnline(true)
    const abajo = () => setOnline(false)
    window.addEventListener('online', arriba)
    window.addEventListener('offline', abajo)
    return () => {
      window.removeEventListener('online', arriba)
      window.removeEventListener('offline', abajo)
    }
  }, [])

  if (cargando) return <div className="app" />
  if (!session) return <div className="app"><Login /></div>

  const estado = { online, pendientes, error: errorSync }

  return (
    <div className="app">
      {pestania === 'movimientos' && <Movimientos userId={session.user.id} estado={estado} />}
      {pestania === 'analisis' && (
        <Pendiente
          titulo="Análisis"
          texto="El gasto por categoría, por mes y por año llega en una próxima iteración. Todo lo que cargues ya queda listo para aparecer acá."
        />
      )}
      {pestania === 'recurrentes' && (
        <Pendiente
          titulo="Recurrentes"
          texto="Suscripciones y cuotas, generándose solas en su fecha. Todavía no está."
        />
      )}
      {pestania === 'deudas' && (
        <Pendiente
          titulo="Deudas"
          texto="Quién te debe y a quién le debés, más el import de Splitwise. Todavía no está."
        />
      )}
      <TabBar activa={pestania} onCambiar={setPestania} />
    </div>
  )
}
