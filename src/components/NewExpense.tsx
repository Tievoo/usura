import { useEffect, useRef, useState } from 'react'
import { toArs, fromKeypad, format } from '../lib/money'
import { today } from '../lib/dates'
import { resolveRate, DEFAULT_FX_TYPE, type ResolvedRate } from '../lib/fx'
import { CATEGORY_BY_SLUG, TOP_EXPENSE, categoryColor } from '../data/categories'
import { PAYMENT_METHODS, type PaymentMethod, type Currency, type Transaction } from '../lib/types'

interface Props {
  open: boolean
  userId: string
  /** Lo último que cargaste: el alta hereda de acá para no pedir nada dos veces. */
  last: { category: string; subcategory: string | null; paymentMethod: PaymentMethod } | null
  onClose: () => void
  onSave: (t: Transaction) => void
}

/**
 * La pantalla más importante de la app.
 *
 * Teclado propio en vez del del sistema: el del OS tapa media pantalla y esconde
 * las categorías justo cuando las necesitás. Y Guardar no espera a nada — ni a la
 * red, ni a la cotización. Si la API del dólar no responde, el gasto se guarda
 * igual y queda marcado.
 */
export function NewExpense({ open, userId, last, onClose, onSave }: Props) {
  const [digits, setDigits] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(last?.category ?? 'comida')
  const [subcategory, setSubcategory] = useState<string | null>(last?.subcategory ?? null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(last?.paymentMethod ?? 'mercadopago')
  const [fx, setFx] = useState<ResolvedRate | null>(null)
  const saving = useRef(false)

  // Al abrir: monto en blanco y el resto heredado del último gasto.
  useEffect(() => {
    if (!open) return
    setDigits('')
    setDescription('')
    setCurrency('ARS')
    setCategory(last?.category ?? 'comida')
    setSubcategory(last?.subcategory ?? null)
    setPaymentMethod(last?.paymentMethod ?? 'mercadopago')
    saving.current = false
  }, [open, last])

  // La cotización se resuelve en cuanto pasás a dólares, para mostrarla antes de confirmar.
  useEffect(() => {
    if (currency !== 'USD') { setFx(null); return }
    let alive = true
    void resolveRate(today(), DEFAULT_FX_TYPE).then((r) => { if (alive) setFx(r) })
    return () => { alive = false }
  }, [currency])

  const amount = fromKeypad(digits)
  const cat = CATEGORY_BY_SLUG[category]
  const inArs = currency === 'USD' && fx ? toArs(amount, fx.value) : amount

  function key(k: string) {
    if (k === 'del') return setDigits((d) => d.slice(0, -1))
    if (k === '000') return setDigits((d) => (d ? (d + '000').slice(0, 9) : d))
    setDigits((d) => (d + k).replace(/^0+/, '').slice(0, 9))
  }

  function save() {
    if (!amount || saving.current) return
    saving.current = true

    const now = new Date().toISOString()
    const usd = currency === 'USD'

    onSave({
      id: crypto.randomUUID(),
      userId,
      type: 'expense',
      date: today(),
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
      <section className={'sheet' + (open ? ' on' : '')} aria-label="Cargar gasto" aria-hidden={!open}>
        <div className="grab"><i /></div>

        <div className="monto">
          <span className={'u-readout-xl v' + (amount ? '' : ' cero')}>
            <small>{currency === 'ARS' ? '$' : 'US$'}</small>
            {format(amount)}
            <span className="caret">|</span>
          </span>
          <span className="seg">
            <button type="button" aria-pressed={currency === 'ARS'} onClick={() => setCurrency('ARS')}>$</button>
            <button type="button" aria-pressed={currency === 'USD'} onClick={() => setCurrency('USD')}>US$</button>
          </span>
        </div>

        {currency === 'USD' && amount > 0 && (
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

        <div className="sec">
          <span className="u-micro">Categoría</span>
          <div className="chips">
            {TOP_EXPENSE.map((slug) => (
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
            {!TOP_EXPENSE.includes(category as (typeof TOP_EXPENSE)[number]) && cat && (
              <button type="button" className="chip" aria-pressed>
                <i style={{ background: cat.color }} />
                {cat.short ?? cat.name}
              </button>
            )}
          </div>
        </div>

        {cat && cat.subs.length > 0 && (
          <div className="sec">
            <span className="u-micro">Subcategoría — opcional</span>
            <div className="chips">
              {cat.subs.slice(0, 4).map((s) => (
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
          {['1', '2', '3'].map((k) => <button key={k} type="button" onClick={() => key(k)}>{k}</button>)}
          <button type="button" className="ok" disabled={!amount} onClick={save}>Guardar</button>
          {['4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => key(k)}>{k}</button>)}
          <button type="button" className="fn" onClick={() => key('del')} aria-label="Borrar un dígito">←</button>
          <button type="button" className="fn" onClick={() => key('000')}>000</button>
          <button type="button" onClick={() => key('0')}>0</button>
          <button type="button" className="fn" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </>
  )
}
