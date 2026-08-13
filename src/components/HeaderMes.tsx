import { formatear, type Centavos } from '../lib/plata'
import { nombreMes, nombreMesAnio, mesActual, type Mes } from '../lib/fechas'

interface Props {
  mes: Mes
  total: Centavos
  totalAnterior: Centavos
  cantidad: number
  onCambiarMes: (m: Mes) => void
  onAnterior: () => void
  onSiguiente: () => void
}

/**
 * El total es una lectura de referencia, no un titular: arriba a la izquierda,
 * con el selector de mes del otro lado.
 *
 * Gastar más no se pinta de rojo. El teal aparece cuando gastaste menos; cuando
 * gastaste más, la barra queda neutra y el número se dice sin adjetivos. La app
 * no juzga, y el rojo está reservado para errores y para lo que debés.
 */
export function HeaderMes({ mes, total, totalAnterior, cantidad, onAnterior, onSiguiente }: Props) {
  const hayComparacion = totalAnterior > 0 && total > 0
  const menos = total < totalAnterior
  const pct = hayComparacion ? Math.round((Math.abs(total - totalAnterior) / totalAnterior) * 100) : 0
  const ancho = hayComparacion ? Math.max(6, Math.round((total / Math.max(total, totalAnterior)) * 100)) : 0

  return (
    <header className="hd">
      <div className="hd-total">
        <span className="u-micro">Gastado en {nombreMes(mes)}</span>
        <span className={'u-readout-l amt' + (total ? '' : ' cero')}>
          <small>$</small>
          {formatear(total)}
        </span>
        <span className="hd-delta">
          {hayComparacion ? (
            <>
              <span className="track">
                <i className={menos ? 'menos' : ''} style={{ width: `${ancho}%` }} />
              </span>
              <b className={menos ? 'menos' : ''}>
                {pct}% {menos ? 'menos' : 'más'} que {nombreMes(anterior(mes))}
              </b>
            </>
          ) : (
            <b>{total ? `${cantidad} ${cantidad === 1 ? 'movimiento' : 'movimientos'}` : 'Todavía no cargaste nada'}</b>
          )}
        </span>
      </div>

      <div className="mo">
        <span className="m">{nombreMesAnio(mes)}</span>
        <span className="nav">
          <button type="button" onClick={onAnterior} aria-label="Mes anterior">&lt;</button>
          {/* No hay futuro que mirar: en el mes en curso la flecha se apaga. */}
          <button type="button" onClick={onSiguiente} disabled={mes >= mesActual()} aria-label="Mes siguiente">&gt;</button>
        </span>
      </div>
    </header>
  )
}

function anterior(m: Mes): Mes {
  const [y, mm] = m.split('-').map(Number)
  const d = new Date(y ?? 1970, (mm ?? 1) - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
