import { format, formatUsd, sum } from '../lib/money'
import { dayHeading } from '../lib/dates'
import { net, paymentMethodLabel, type Transaction } from '../lib/types'
import { categoryName, subcategoryName } from '../data/categories'

interface Props {
  transactions: Transaction[]
  onTap: (t: Transaction) => void
  emptyMonth: string
  onAdd: () => void
}

/** Agrupa por día. El encabezado de día y sus filas son un bloque: no hay divisor entre ellos. */
export function TransactionList({ transactions, onTap, emptyMonth, onAdd }: Props) {
  if (!transactions.length) {
    return (
      <div className="feed">
        <div className="vacio">
          <p>Todavía no cargaste nada en {emptyMonth}.</p>
          <button type="button" className="chip" onClick={onAdd}>Cargar el primero</button>
        </div>
      </div>
    )
  }

  const days = [...new Set(transactions.map((t) => t.date))]

  return (
    <div className="feed">
      {days.map((date) => {
        const ofDay = transactions.filter((t) => t.date === date)
        const subtotal = sum(ofDay.filter((t) => t.type === 'expense').map(net))
        return (
          <div key={date}>
            <div className="dia">
              <span className="d">{dayHeading(date)}</span>
              <span className="st">{format(subtotal)}</span>
            </div>
            {ofDay.map((t) => (
              <Row key={t.id} t={t} onTap={onTap} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Row({ t, onTap }: { t: Transaction; onTap: (t: Transaction) => void }) {
  const sub = subcategoryName(t.category, t.subcategory)
  // La cuota va en la meta y no en el nombre: «4 de 12» dice dónde estás parado
  // en la serie, que es lo mismo que dice la categoría sobre el gasto.
  const cuota = t.installmentNo !== null && t.installmentTotal !== null
    ? `${t.installmentNo} de ${t.installmentTotal}`
    : null
  const meta = [categoryName(t.category), sub, cuota, paymentMethodLabel(t.paymentMethod)].filter(Boolean).join(' · ')
  const isUsd = t.currency === 'USD'
  const unconverted = isUsd && t.fxRate === null

  return (
    <button type="button" className="mv" onClick={() => onTap(t)}>
      <span className="mv-body">
        <span className="mv-nm">
          {t.description || categoryName(t.category)}
          {t.recurringRuleId !== null && <> <span className="chip-rec">Recurrente</span></>}
        </span>
        <span className="mv-sub">{meta}</span>
      </span>

      {t._dirty === 1 && <span className="punto-pendiente" title="Sin sincronizar" />}

      <span className={'mv-v' + (t.type === 'income' ? ' ingreso' : '')}>
        {unconverted ? (
          <>
            {formatUsd(t.originalAmount)}
            <em>a convertir</em>
          </>
        ) : (
          <>
            {(t.type === 'income' ? '+' : '') + format(net(t))}
            {isUsd && t.fxRate !== null && (
              <em>
                {formatUsd(t.originalAmount)} × {format(t.fxRate)}
              </em>
            )}
            {t.refundArs > 0 && <em>de {format(t.arsAmount)}</em>}
          </>
        )}
      </span>
    </button>
  )
}
