import { formatear, formatearUsd, sumar } from '../lib/plata'
import { encabezadoDia } from '../lib/fechas'
import { neto, nombreMedio, type Movimiento } from '../lib/tipos'
import { nombreCategoria, nombreSubcategoria } from '../data/categorias'

interface Props {
  movimientos: Movimiento[]
  onTocar: (m: Movimiento) => void
  mesVacio: string
  onCargar: () => void
}

/** Agrupa por día. El encabezado de día y sus filas son un bloque: no hay divisor entre ellos. */
export function ListaMovimientos({ movimientos, onTocar, mesVacio, onCargar }: Props) {
  if (!movimientos.length) {
    return (
      <div className="feed">
        <div className="vacio">
          <p>Todavía no cargaste nada en {mesVacio}.</p>
          <button type="button" className="chip" onClick={onCargar}>Cargar el primero</button>
        </div>
      </div>
    )
  }

  const dias = [...new Set(movimientos.map((m) => m.fecha))]

  return (
    <div className="feed">
      {dias.map((fecha) => {
        const delDia = movimientos.filter((m) => m.fecha === fecha)
        const subtotal = sumar(delDia.filter((m) => m.tipo === 'gasto').map(neto))
        return (
          <div key={fecha}>
            <div className="dia">
              <span className="d">{encabezadoDia(fecha)}</span>
              <span className="st">{formatear(subtotal)}</span>
            </div>
            {delDia.map((m) => (
              <Fila key={m.id} m={m} onTocar={onTocar} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Fila({ m, onTocar }: { m: Movimiento; onTocar: (m: Movimiento) => void }) {
  const sub = nombreSubcategoria(m.categoria, m.subcategoria)
  const meta = [nombreCategoria(m.categoria), sub, nombreMedio(m.medioPago)].filter(Boolean).join(' · ')
  const esUsd = m.moneda === 'USD'
  const sinConvertir = esUsd && m.fxValor === null

  return (
    <button type="button" className="mv" onClick={() => onTocar(m)}>
      <span className="mv-body">
        <span className="mv-nm">{m.concepto || nombreCategoria(m.categoria)}</span>
        <span className="mv-sub">{meta}</span>
      </span>

      {m._dirty === 1 && <span className="punto-pendiente" title="Sin sincronizar" />}

      <span className={'mv-v' + (m.tipo === 'ingreso' ? ' ingreso' : '')}>
        {sinConvertir ? (
          <>
            {formatearUsd(m.montoOriginal)}
            <em>a convertir</em>
          </>
        ) : (
          <>
            {(m.tipo === 'ingreso' ? '+' : '') + formatear(neto(m))}
            {esUsd && m.fxValor !== null && (
              <em>
                {formatearUsd(m.montoOriginal)} × {formatear(m.fxValor)}
              </em>
            )}
            {m.reembolsoArs > 0 && <em>de {formatear(m.montoArs)}</em>}
          </>
        )}
      </span>
    </button>
  )
}
