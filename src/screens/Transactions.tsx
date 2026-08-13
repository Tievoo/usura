import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { MonthHeader } from '../components/MonthHeader'
import { TransactionList } from '../components/TransactionList'
import { NewExpense } from '../components/NewExpense'
import { deleteTransaction, saveTransaction, transactionsOfMonth } from '../lib/db'
import { currentMonth, prevMonth, nextMonth, monthName, monthOf, type MonthStr } from '../lib/dates'
import { net, type PaymentMethod, type Transaction } from '../lib/types'
import { sum } from '../lib/money'
import { sync } from '../lib/sync'

interface Props {
  userId: string
  status: { online: boolean; pending: number; error: string | null }
}

export function Transactions({ userId, status }: Props) {
  const [month, setMonth] = useState<MonthStr>(currentMonth())
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const ofMonth = useLiveQuery(() => transactionsOfMonth(month), [month], [] as Transaction[])
  const ofPrevious = useLiveQuery(() => transactionsOfMonth(prevMonth(month)), [month], [] as Transaction[])

  const expenses = useMemo(() => ofMonth.filter((t) => t.type === 'expense'), [ofMonth])
  const total = useMemo(() => sum(expenses.map(net)), [expenses])
  const previousTotal = useMemo(
    () => sum(ofPrevious.filter((t) => t.type === 'expense').map(net)),
    [ofPrevious],
  )

  /** El alta hereda del último gasto cargado, así casi nunca hay que elegir nada. */
  const last = useMemo(() => {
    const t = ofMonth[0] ?? ofPrevious[0]
    return t
      ? { category: t.category, subcategory: t.subcategory, paymentMethod: t.paymentMethod as PaymentMethod }
      : null
  }, [ofMonth, ofPrevious])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(id)
  }, [toast])

  async function handleSave(t: Transaction) {
    // Local primero: la UI no espera a la red. Si no hay señal, sube después.
    await saveTransaction(t)
    setOpen(false)
    setMonth(monthOf(t.date))
    setToast(status.online ? 'Guardado' : 'Guardado. Sube cuando vuelva la señal.')
    void sync()
  }

  async function handleTap(t: Transaction) {
    // La edición completa llega con la ficha de movimiento; por ahora, borrar.
    if (!window.confirm(`¿Borrar «${t.description || t.category}»?`)) return
    await deleteTransaction(t.id)
    setToast('Borrado')
    void sync()
  }

  return (
    <>
      <MonthHeader
        month={month}
        total={total}
        previousTotal={previousTotal}
        count={expenses.length}
        onPrev={() => setMonth(prevMonth(month))}
        onNext={() => setMonth(nextMonth(month))}
      />

      {!status.online && (
        <div className="aviso">
          <span className="punto-pendiente" />
          <span><b>Sin señal.</b> Se guarda acá y sube cuando vuelva.</span>
        </div>
      )}
      {status.online && status.error && (
        <div className="aviso error">
          <span><b>No se pudo sincronizar.</b> {status.error}</span>
          <button type="button" className="accion" onClick={() => void sync()}>Reintentar</button>
        </div>
      )}

      <TransactionList
        transactions={ofMonth}
        onTap={handleTap}
        emptyMonth={monthName(month)}
        onAdd={() => setOpen(true)}
      />

      <button type="button" className="fab" onClick={() => setOpen(true)} aria-label="Cargar gasto">+</button>

      <NewExpense
        open={open}
        userId={userId}
        last={last}
        onClose={() => setOpen(false)}
        onSave={(t) => void handleSave(t)}
      />

      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </>
  )
}
