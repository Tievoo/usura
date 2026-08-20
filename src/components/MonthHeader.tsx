import { format, type Cents } from '../lib/money'
import { monthName, monthYearName, currentMonth, prevMonth, type MonthStr } from '../lib/dates'

interface Props {
  month: MonthStr
  total: Cents
  previousTotal: Cents
  count: number
  /**
   * Día en que se cortó el mes anterior para que la comparación sea justa, o null
   * si se comparan dos meses completos.
   */
  comparedUpToDay: number | null
  onPrev: () => void
  onNext: () => void
}

/**
 * El total es una lectura de referencia, no un titular: arriba a la izquierda,
 * con el selector de mes del otro lado.
 *
 * Gastar más no se pinta de rojo. El teal aparece cuando gastaste menos; cuando
 * gastaste más, la barra queda neutra y el número se dice sin adjetivos. La app
 * no juzga, y el rojo está reservado para errores y para lo que debés.
 */
export function MonthHeader({ month, total, previousTotal, count, comparedUpToDay, onPrev, onNext }: Props) {
  const comparable = previousTotal > 0 && total > 0
  const less = total < previousTotal
  const pct = comparable ? Math.round((Math.abs(total - previousTotal) / previousTotal) * 100) : 0
  const width = comparable ? Math.max(6, Math.round((total / Math.max(total, previousTotal)) * 100)) : 0

  return (
    <header className="hd">
      <div className="hd-total">
        <span className="u-micro">Gastado en {monthName(month)}</span>
        <span className={'u-readout-l amt' + (total ? '' : ' cero')}>
          <small>$</small>
          {format(total)}
        </span>
        <span className="hd-delta">
          {comparable ? (
            <>
              <span className="track">
                <i className={less ? 'menos' : ''} style={{ width: `${width}%` }} />
              </span>
              <b className={less ? 'menos' : ''}>
                {pct}% {less ? 'menos' : 'más'} que {monthName(prevMonth(month))}
                {/* Si la comparación es parcial se dice: un mes en curso contra un
                    mes completo daría una caída que no existe. */}
                {comparedUpToDay !== null && ` hasta el ${comparedUpToDay}`}
              </b>
            </>
          ) : (
            <b>{total ? `${count} ${count === 1 ? 'movimiento' : 'movimientos'}` : 'Todavía no cargaste nada'}</b>
          )}
        </span>
      </div>

      <div className="mo">
        <span className="m">{monthYearName(month)}</span>
        <span className="nav">
          <button type="button" onClick={onPrev} aria-label="Mes anterior">&lt;</button>
          {/* No hay futuro que mirar: en el mes en curso la flecha se apaga. */}
          <button type="button" onClick={onNext} disabled={month >= currentMonth()} aria-label="Mes siguiente">&gt;</button>
        </span>
      </div>
    </header>
  )
}
