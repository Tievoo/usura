import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { MonthHeader } from '../components/MonthHeader'
import { TransactionList } from '../components/TransactionList'
import { ExpenseSheet } from '../components/ExpenseSheet'
import { TransactionDetail } from '../components/TransactionDetail'
import { deleteTransaction, saveTransaction, transactionsOfMonth } from '../lib/db'
import { currentMonth, prevMonth, nextMonth, monthName, monthOf, today, dayOf, type MonthStr } from '../lib/dates'
import { net, type PaymentMethod, type Transaction } from '../lib/types'
import { sum } from '../lib/money'
import { sync } from '../lib/sync'

interface Props {
  userId: string
  status: { online: boolean; pending: number; error: string | null }
}

export function Transactions({ userId, status }: Props) {
  const [month, setMonth] = useState<MonthStr>(currentMonth())
  const [sheet, setSheet] = useState(false)
  /** El movimiento que estás mirando en el detalle. */
  const [detail, setDetail] = useState<Transaction | null>(null)
  /** El que se está editando en la hoja. null = alta nueva. */
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /**
   * Los overlays van por portal al shell de la app. `.panes` tiene `transform` y
   * eso lo convierte en bloque contenedor de sus descendientes absolutos: la hoja
   * con `bottom: 0` medía contra la pista, que termina arriba de la tab bar, así
   * que aparecía flotando en vez de cubrirla.
   */
  const [shell, setShell] = useState<HTMLElement | null>(null)
  useEffect(() => setShell(document.getElementById('app-shell')), [])

  const ofMonth = useLiveQuery(() => transactionsOfMonth(month), [month], [] as Transaction[])
  const ofPrevious = useLiveQuery(() => transactionsOfMonth(prevMonth(month)), [month], [] as Transaction[])

  const expenses = useMemo(() => ofMonth.filter((t) => t.type === 'expense'), [ofMonth])
  const total = useMemo(() => sum(expenses.map(net)), [expenses])

  /**
   * Comparar un mes en curso contra un mes cerrado miente: el 20 de agosto vas a
   * ir «60% abajo» de julio solo porque a julio le quedan once días más de gastos.
   * Cuando el mes que ves es el actual, el anterior se corta en el mismo día.
   * Un mes ya terminado sí se compara completo contra completo.
   */
  const cutoffDay = month === currentMonth() ? dayOf(today()) : null
  const previousTotal = useMemo(
    () => sum(
      ofPrevious
        .filter((t) => t.type === 'expense' && (cutoffDay === null || dayOf(t.date) <= cutoffDay))
        .map(net),
    ),
    [ofPrevious, cutoffDay],
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
    setSheet(false)
    setEditing(null)
    setMonth(monthOf(t.date))
    setToast(status.online ? 'Guardado' : 'Guardado. Sube cuando vuelva la señal.')
    void sync()
  }

  async function handleArchive(t: Transaction) {
    await deleteTransaction(t.id)
    setDetail(null)
    setToast('Archivado')
    void sync()
  }

  function handleEdit(t: Transaction) {
    setDetail(null)
    setEditing(t)
    setSheet(true)
  }

  function nuevo() {
    setEditing(null)
    setSheet(true)
  }

  return (
    <>
      <MonthHeader
        month={month}
        total={total}
        previousTotal={previousTotal}
        count={expenses.length}
        comparedUpToDay={cutoffDay}
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
        onTap={setDetail}
        emptyMonth={monthName(month)}
        onAdd={nuevo}
      />

      {shell && createPortal(
        <>
          <button type="button" className="fab" onClick={nuevo} aria-label="Cargar gasto">+</button>

          <TransactionDetail
            transaction={detail}
            onClose={() => setDetail(null)}
            onEdit={handleEdit}
            onArchive={(t) => void handleArchive(t)}
          />

          <ExpenseSheet
            open={sheet}
            userId={userId}
            last={last}
            editing={editing}
            onClose={() => { setSheet(false); setEditing(null) }}
            onSave={(t) => void handleSave(t)}
          />

          <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
        </>,
        shell,
      )}
    </>
  )
}
