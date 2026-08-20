import { useEffect, useRef, useState } from 'react'
import { toArs, fromKeypad, format } from '../lib/money'
import { today, nowTime } from '../lib/dates'
import { resolveRate, DEFAULT_FX_TYPE, type ResolvedRate } from '../lib/fx'
import { CATEGORY_BY_SLUG, EXPENSE_CATEGORIES, TOP_EXPENSE, categoryColor } from '../data/categories'
import { PAYMENT_METHODS, type PaymentMethod, type Currency, type Transaction } from '../lib/types'
import { useCloseOnBack } from '../lib/back'

interface Props {
  open: boolean
  userId: string
  /** Lo último que cargaste: el alta hereda de acá para no pedir nada dos veces. */
  last: { category: string; subcategory: string | null; paymentMethod: PaymentMethod } | null
  /** Cuando viene, la hoja edita ese movimiento en vez de crear uno nuevo. */
  editing: Transaction | null
  onClose: () => void
  onSave: (t: Transaction) => void
}

/**
 * La pantalla más importante de la app, y ahora también la de edición: es la misma
 * forma para cargar y para corregir, así no hay dos lugares donde se define un gasto.
 *
 * Teclado propio en vez del del sistema: el del OS tapa media pantalla y esconde
 * las categorías justo cuando las necesitás. Y Guardar no espera a nada — ni a la
 * red, ni a la cotización. Si la API del dólar no responde, el gasto se guarda
 * igual y queda marcado.
 */
export function ExpenseSheet({ open, userId, last, editing, onClose, onSave }: Props) {
  const [digits, setDigits] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('comida')
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mercadopago')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState<string>('')
  const [fx, setFx] = useState<ResolvedRate | null>(null)
  const [allCats, setAllCats] = useState(false)
  /** Si no tocaste el monto al editar, se conserva exacto: los centavos del import no se pierden. */
  const [amountTouched, setAmountTouched] = useState(false)
  const saving = useRef(false)

  useCloseOnBack(open, onClose)

  /**
   * El snapshot de cotización es inmutable y la base lo hace cumplir con un trigger:
   * si un movimiento en dólares ya se convirtió, su monto no se puede tocar. En vez
   * de dejarte guardar y fallar en el sync, se bloquea acá y se dice por qué.
   */
  const amountLocked = !!editing && editing.currency === 'USD' && editing.fxRate !== null

  useEffect(() => {
    if (!open) return
    if (editing) {
      // En edición el monto arranca en el valor real, centavos incluidos.
      setDigits(String(Math.round(editing.originalAmount / 100)))
      setCurrency(editing.currency)
      setDescription(editing.description)
      setCategory(editing.category)
      setSubcategory(editing.subcategory)
      setPaymentMethod(editing.paymentMethod)
      setDate(editing.date)
      setTime(editing.time ?? '')
      setAmountTouched(false)
    } else {
      setDigits('')
      setDescription('')
      setCurrency('ARS')
      setCategory(last?.category ?? 'comida')
      setSubcategory(last?.subcategory ?? null)
      setPaymentMethod(last?.paymentMethod ?? 'mercadopago')
      setDate(today())
      setTime(nowTime())
      setAmountTouched(true)
    }
    setAllCats(false)
    saving.current = false
  }, [open, editing, last])

  // La cotización se resuelve en cuanto pasás a dólares, para mostrarla antes de confirmar.
  useEffect(() => {
    if (currency !== 'USD' || editing) { setFx(null); return }
    let alive = true
    void resolveRate(today(), DEFAULT_FX_TYPE).then((r) => { if (alive) setFx(r) })
    return () => { alive = false }
  }, [currency, editing])

  const typed = fromKeypad(digits)
  // Monto intacto en edición: se respeta el original con sus centavos.
  const amount = editing && !amountTouched ? editing.originalAmount : typed
  const cat = CATEGORY_BY_SLUG[category]
  const inArs = currency === 'USD' && fx ? toArs(amount, fx.value) : amount
  const chips = allCats ? EXPENSE_CATEGORIES.map((c) => c.slug) : [...TOP_EXPENSE]

  function tap(k: string) {
    if (amountLocked) return
    setAmountTouched(true)
    if (k === 'del') return setDigits((d) => d.slice(0, -1))
    if (k === '000') return setDigits((d) => (d ? (d + '000').slice(0, 9) : d))
    setDigits((d) => (d + k).replace(/^0+/, '').slice(0, 9))
  }

  function save() {
    if (!amount || saving.current) return
    saving.current = true

    const now = new Date().toISOString()

    if (editing) {
      // El snapshot de cotización no se recalcula nunca: se arrastra tal como estaba.
      onSave({
        ...editing,
        date,
        time: time || null,
        description: description.trim(),
        originalAmount: amount,
        arsAmount: editing.currency === 'USD' ? editing.arsAmount : amount,
        category,
        subcategory,
        paymentMethod,
        updatedAt: now,
        _dirty: 1,
      })
      return
    }

    const usd = currency === 'USD'
    onSave({
      id: crypto.randomUUID(),
      userId,
      type: 'expense',
      date,
      time: time || null,
      description: description.trim(),
      originalAmount: amount,
      currency,
      // Sin cotización se guarda en 0 y queda "a convertir": nunca inventamos un número.
      arsAmount: usd ? (fx ? toArs(amount, fx.value) : 0) : amount,
      fxRate: usd ? (fx?.value ?? null) : null,
      fxType: usd ? (fx?.type ?? null) : null,
      fxDate: usd ? (fx?.date ?? null) : null,
      category,
      subcategory,
      paymentMethod,
      refundArs: 0,
      notes: null,
      source: 'manual',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      _dirty: 1,
    })
  }

  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} onClick={onClose} />
      <section
        className={'sheet' + (open ? ' on' : '')}
        aria-label={editing ? 'Editar gasto' : 'Cargar gasto'}
        aria-hidden={!open}
      >
        <div className="grab"><i /></div>

        <div className="monto">
          <span className={'u-readout-xl v' + (amount ? '' : ' cero')}>
            <small>{currency === 'ARS' ? '$' : 'US$'}</small>
            {format(amount)}
            {!amountLocked && <span className="caret">|</span>}
          </span>
          <span className="seg">
            <button type="button" aria-pressed={currency === 'ARS'} disabled={!!editing} onClick={() => setCurrency('ARS')}>$</button>
            <button type="button" aria-pressed={currency === 'USD'} disabled={!!editing} onClick={() => setCurrency('USD')}>US$</button>
          </span>
        </div>

        {amountLocked && (
          <p className="fx-nota estimado">
            El monto no se edita: este gasto ya se convirtió a pesos con la cotización
            del {editing!.fxDate}, y ese snapshot es inmutable.
          </p>
        )}

        {!editing && currency === 'USD' && amount > 0 && (
          <p className={'fx-nota' + (fx?.estimated ? ' estimado' : '')}>
            {fx
              ? `≈ $${format(inArs)} · oficial${fx.estimated ? ` del ${fx.date}, estimado` : ' de hoy'}`
              : 'Sin cotización todavía. Se guarda en dólares y se convierte cuando haya red.'}
          </p>
        )}

        <div className="campo">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concepto — opcional"
            enterKeyHint="done"
          />
        </div>

        <div className="sec cuando">
          <label>
            <span className="u-micro">Fecha</span>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} />
          </label>
          <label>
            <span className="u-micro">Hora</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <div className="sec">
          <span className="u-micro">Categoría</span>
          <div className="chips">
            {chips.map((slug) => (
              <button
                key={slug}
                type="button"
                className="chip"
                aria-pressed={category === slug}
                onClick={() => { setCategory(slug); setSubcategory(null) }}
              >
                <i style={{ background: categoryColor(slug) }} />
                {CATEGORY_BY_SLUG[slug]?.short ?? CATEGORY_BY_SLUG[slug]?.name}
              </button>
            ))}
            {!allCats && !TOP_EXPENSE.includes(category as (typeof TOP_EXPENSE)[number]) && cat && (
              <button type="button" className="chip" aria-pressed>
                <i style={{ background: cat.color }} />
                {cat.short ?? cat.name}
              </button>
            )}
            <button type="button" className="chip mas" onClick={() => setAllCats((v) => !v)}>
              {allCats ? 'Menos' : 'Más'}
            </button>
          </div>
        </div>

        {cat && cat.subs.length > 0 && (
          <div className="sec">
            <span className="u-micro">Subcategoría — opcional</span>
            <div className="chips">
              {cat.subs.map((s) => (
                <button
                  key={s.slug}
                  type="button"
                  className="chip"
                  aria-pressed={subcategory === s.slug}
                  onClick={() => setSubcategory(subcategory === s.slug ? null : s.slug)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sec">
          <span className="u-micro">Con qué pagaste</span>
          <div className="chips">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                className="chip"
                aria-pressed={paymentMethod === m.value}
                onClick={() => setPaymentMethod(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pad">
          {['1', '2', '3'].map((k) => <button key={k} type="button" onClick={() => tap(k)}>{k}</button>)}
          <button type="button" className="ok" disabled={!amount} onClick={save}>
            {editing ? 'Guardar' : 'Guardar'}
          </button>
          {['4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => tap(k)}>{k}</button>)}
          <button type="button" className="fn" onClick={() => tap('del')} aria-label="Borrar un dígito">←</button>
          <button type="button" className="fn" onClick={() => tap('000')}>000</button>
          <button type="button" onClick={() => tap('0')}>0</button>
          <button type="button" className="fn" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </>
  )
}
