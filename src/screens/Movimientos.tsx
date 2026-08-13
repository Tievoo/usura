import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { HeaderMes } from '../components/HeaderMes'
import { ListaMovimientos } from '../components/ListaMovimientos'
import { AltaGasto } from '../components/AltaGasto'
import { borrarMovimiento, guardarMovimiento, movimientosDelMes } from '../lib/db'
import { mesActual, mesAnterior, mesSiguiente, nombreMes, type Mes } from '../lib/fechas'
import { neto, type MedioPago, type Movimiento } from '../lib/tipos'
import { sumar } from '../lib/plata'
import { sincronizar } from '../lib/sync'

interface Props {
  userId: string
  estado: { online: boolean; pendientes: number; error: string | null }
}

export function Movimientos({ userId, estado }: Props) {
  const [mes, setMes] = useState<Mes>(mesActual())
  const [abierto, setAbierto] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const delMes = useLiveQuery(() => movimientosDelMes(mes), [mes], [] as Movimiento[])
  const delAnterior = useLiveQuery(() => movimientosDelMes(mesAnterior(mes)), [mes], [] as Movimiento[])

  const gastos = useMemo(() => delMes.filter((m) => m.tipo === 'gasto'), [delMes])
  const total = useMemo(() => sumar(gastos.map(neto)), [gastos])
  const totalAnterior = useMemo(
    () => sumar(delAnterior.filter((m) => m.tipo === 'gasto').map(neto)),
    [delAnterior],
  )

  /** El alta hereda del último gasto cargado, así casi nunca hay que elegir nada. */
  const ultimo = useMemo(() => {
    const m = delMes[0] ?? delAnterior[0]
    return m
      ? { categoria: m.categoria, subcategoria: m.subcategoria, medioPago: m.medioPago as MedioPago }
      : null
  }, [delMes, delAnterior])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(t)
  }, [toast])

  async function alGuardar(m: Movimiento) {
    // Local primero: la UI no espera a la red. Si no hay señal, sube después.
    await guardarMovimiento(m)
    setAbierto(false)
    setMes(m.fecha.slice(0, 7))
    setToast(estado.online ? 'Guardado' : 'Guardado. Sube cuando vuelva la señal.')
    void sincronizar()
  }

  async function alTocar(m: Movimiento) {
    // La edición completa llega con la ficha de movimiento; por ahora, borrar.
    if (!window.confirm(`¿Borrar «${m.concepto || m.categoria}»?`)) return
    await borrarMovimiento(m.id)
    setToast('Borrado')
    void sincronizar()
  }

  return (
    <>
      <HeaderMes
        mes={mes}
        total={total}
        totalAnterior={totalAnterior}
        cantidad={gastos.length}
        onCambiarMes={setMes}
        onAnterior={() => setMes(mesAnterior(mes))}
        onSiguiente={() => setMes(mesSiguiente(mes))}
      />

      {!estado.online && (
        <div className="aviso">
          <span className="punto-pendiente" />
          <span><b>Sin señal.</b> Se guarda acá y sube cuando vuelva.</span>
        </div>
      )}
      {estado.online && estado.error && (
        <div className="aviso error">
          <span><b>No se pudo sincronizar.</b> {estado.error}</span>
          <button type="button" className="accion" onClick={() => void sincronizar()}>Reintentar</button>
        </div>
      )}

      <ListaMovimientos
        movimientos={delMes}
        onTocar={alTocar}
        mesVacio={nombreMes(mes)}
        onCargar={() => setAbierto(true)}
      />

      <button type="button" className="fab" onClick={() => setAbierto(true)} aria-label="Cargar gasto">+</button>

      <AltaGasto
        abierto={abierto}
        userId={userId}
        ultimo={ultimo}
        onCerrar={() => setAbierto(false)}
        onGuardar={(m) => void alGuardar(m)}
      />

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </>
  )
}
