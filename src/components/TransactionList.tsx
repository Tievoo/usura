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
  const meta = [categoryName(t.category), sub, paymentMethodLabel(t.paymentMethod)].filter(Boolean).join(' · ')
  const isUsd = t.currency === 'USD'
  const unconverted = isUsd && t.fxRate === null

  return (
    <button type="button" className="mv" onClick={() => onTap(t)}>
      <span className="mv-body">
        <span className="mv-nm">{t.description || categoryName(t.category)}</span>
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
