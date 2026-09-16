import { useEffect, useRef, useState } from 'react'
import { fromKeypad, toKeypad, format, formatUsd } from '../lib/money'
import { today, dayOf, shortDay, type DateStr } from '../lib/dates'
import { occurrences } from '../lib/recurring'
import { CATEGORY_BY_SLUG, EXPENSE_CATEGORIES, TOP_EXPENSE, categoryColor } from '../data/categories'
import { PAYMENT_METHODS, type PaymentMethod, type Currency, type RecurringRule } from '../lib/types'
import { useCloseOnBack } from '../lib/back'
import { usePhysicalKeypad } from '../lib/keypad'

/**
 * Las tres formas que puede tomar una serie, tal como se eligen. Adentro son dos
 * columnas —`type` y `frequency`—, pero preguntarlas por separado obligaría a
 * elegir «suscripción» y después «mensual» para decir algo que se dice de una.
 */
type Kind = 'monthly' | 'yearly' | 'installments'

const KINDS: { value: Kind; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
  { value: 'installments', label: 'Cuotas' },
]

/** Los planes de cuotas que existen de verdad. El resto se arma con − y +. */
const COMMON_INSTALLMENTS = [3, 6, 12, 18]

interface Props {
  open: boolean
  userId: string
  editing: RecurringRule | null
  onClose: () => void
  onSave: (r: RecurringRule) => void
  onPause: (r: RecurringRule) => void
  onArchive: (r: RecurringRule) => void
}

/**
 * Alta y edición de una serie. Es la misma hoja que el alta de gasto en forma y en
 * teclado, porque cargar una suscripción es cargar un gasto que se repite: lo único
 * que cambia es que en vez de una fecha se define cada cuánto.
 *
 * Editar una serie **no reescribe el pasado**. Lo que ya se generó queda como está;
 * el cambio se aplica de la próxima en adelante, y la hoja lo dice.
 */
export function RuleSheet({ open, userId, editing, onClose, onSave, onPause, onArchive }: Props) {
  const [digits, setDigits] = useState('')
  const [currency, setCurrency] = useState<Currency>('ARS')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<Kind>('monthly')
  const [installments, setInstallments] = useState(12)
  const [category, setCategory] = useState('suscripciones')
  const [subcategory, setSubcategory] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit')
  const [startDate, setStartDate] = useState<DateStr>(today())
  const [allCats, setAllCats] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const saving = useRef(false)

  useCloseOnBack(open, onClose)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setDigits(toKeypad(editing.amount))
      setCurrency(editing.currency)
      setDescription(editing.description)
      setKind(editing.type === 'installments' ? 'installments' : editing.frequency === 'yearly' ? 'yearly' : 'monthly')
      setInstallments(editing.installmentsTotal ?? 12)
      setCategory(editing.category)
      setSubcategory(editing.subcategory)
      setPaymentMethod(editing.paymentMethod)
      setStartDate(editing.startDate)
    } else {
      setDigits('')
      setDescription('')
      setCurrency('ARS')
      setKind('monthly')
      setInstallments(12)
      // Lo que más se carga acá es una suscripción con tarjeta; el resto se cambia.
      setCategory('suscripciones')
      setSubcategory(null)
      setPaymentMethod('credit')
      setStartDate(today())
    }
    setAllCats(false)
    setConfirming(false)
    saving.current = false
  }, [open, editing])

  const amount = fromKeypad(digits)
  const cat = CATEGORY_BY_SLUG[category]
  const chips = allCats ? EXPENSE_CATEGORIES.map((c) => c.slug) : [...TOP_EXPENSE, 'suscripciones']
  const isInstallments = kind === 'installments'

  /** La serie tal como quedaría, para poder contar qué generaría antes de guardar. */
  const draft: RecurringRule = {
    id: editing?.id ?? '',
    userId,
    type: isInstallments ? 'installments' : 'subscription',
    description: description.trim(),
    amount,
    currency,
    category,
    subcategory,
    paymentMethod,
    frequency: kind === 'yearly' ? 'yearly' : 'monthly',
    dayOfMonth: dayOf(startDate),
    startDate,
    endDate: editing?.endDate ?? null,
    installmentsTotal: isInstallments ? installments : null,
    active: editing?.active ?? true,
    notes: editing?.notes ?? null,
    createdAt: editing?.createdAt ?? '',
    updatedAt: '',
    deletedAt: null,
    _dirty: 1,
  }

  // Cuántos vencimientos ya pasaron. En una serie nueva es lo que se va a crear
  // apenas guardes; en una que ya existe, lo que ya está y no se toca.
  const overdue = amount > 0 ? occurrences(draft, today()).length : 0
  const nextUp = amount > 0 ? occurrences(draft, `${Number(today().slice(0, 4)) + 2}-12-31`)[overdue] : undefined

  function tap(k: string) {
    if (k === 'del') return setDigits((d) => d.slice(0, -1))
    if (k === ',') return setDigits((d) => (d.includes(',') ? d : (d || '0') + ','))
    setDigits((d) => {
      const [pesos, centavos] = d.split(',')
      if (centavos !== undefined) return k === '000' || centavos.length >= 2 ? d : `${pesos},${centavos}${k}`
      if (k === '000') return d ? (d + '000').slice(0, 9) : d
      return (d + k).replace(/^0+/, '').slice(0, 9)
    })
  }

  function save() {
    if (!amount || !description.trim() || saving.current) return
    saving.current = true
    const now = new Date().toISOString()
    onSave({
      ...draft,
      id: editing?.id ?? crypto.randomUUID(),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  usePhysicalKeypad(open, { tap, save, close: onClose })

  const listo = amount > 0 && description.trim().length > 0

  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} onClick={onClose} />
      <section
        className={'sheet' + (open ? ' on' : '')}
        aria-label={editing ? 'Editar serie' : 'Nueva serie'}
        aria-hidden={!open}
      >
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

        <p className="fx-nota">
          {isInstallments ? 'Cada cuota' : kind === 'yearly' ? 'Por año' : 'Por mes'}
          {currency === 'USD' && ' · cada instancia toma la cotización de su propia fecha'}
        </p>

        <div className="campo">
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Concepto — Crunchyroll, notebook…"
            enterKeyHint="done"
          />
        </div>

        <div className="sec">
          <span className="u-micro">Cada cuánto</span>
          <div className="chips">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                className="chip"
                aria-pressed={kind === k.value}
                onClick={() => setKind(k.value)}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {isInstallments && (
          <div className="sec">
            <span className="u-micro">Cuántas cuotas</span>
            <div className="chips">
              <span className="paso">
                <button type="button" onClick={() => setInstallments((n) => Math.max(2, n - 1))} aria-label="Una cuota menos">−</button>
                <b>{installments}</b>
                <button type="button" onClick={() => setInstallments((n) => Math.min(120, n + 1))} aria-label="Una cuota más">+</button>
              </span>
              {COMMON_INSTALLMENTS.map((n) => (
                <button key={n} type="button" className="chip" aria-pressed={installments === n} onClick={() => setInstallments(n)}>
                  {n}
                </button>
              ))}
            </div>
            {amount > 0 && (
              <p className="nota">
                {installments} × {currency === 'USD' ? formatUsd(amount) : `$${format(amount)}`} ={' '}
                {currency === 'USD' ? formatUsd(amount * installments) : `$${format(amount * installments)}`} en total.
              </p>
            )}
          </div>
        )}

        <div className="sec cuando">
          <label>
            <span className="u-micro">{isInstallments ? 'Primera cuota' : 'Primer cobro'}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value || today())} />
          </label>
        </div>

        {amount > 0 && (
          <p className="nota">
            {kind === 'yearly'
              ? `Cae cada año el ${shortDay(startDate)}.`
              : `Cae todos los meses el día ${dayOf(startDate)}; en un mes más corto, el último.`}
            {editing
              ? ' Lo ya generado no se toca: el cambio corre de la próxima en adelante.'
              : overdue > 0 &&
                ` Se van a crear ${overdue} ${overdue === 1 ? 'movimiento' : 'movimientos'} que ya vencieron.`}
            {nextUp && ` La próxima cae el ${shortDay(nextUp.date)}.`}
          </p>
        )}

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
            {!allCats && !chips.includes(category) && cat && (
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
          <span className="u-micro">Con qué se paga</span>
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

        {editing && (
          <div className="det-acciones">
            {confirming ? (
              <>
                <span className="det-preg">¿Archivar la serie? Los movimientos que generó quedan.</span>
                <button type="button" className="chip" onClick={() => setConfirming(false)}>No</button>
                <button type="button" className="chip peligro" onClick={() => onArchive(editing)}>Sí, archivar</button>
              </>
            ) : (
              <>
                <button type="button" className="chip" onClick={() => setConfirming(true)}>Archivar</button>
                <button type="button" className="chip" onClick={() => onPause(editing)}>
                  {editing.active ? 'Pausar' : 'Reactivar'}
                </button>
              </>
            )}
          </div>
        )}

        <div className="pad">
          {['1', '2', '3'].map((k) => <button key={k} type="button" onClick={() => tap(k)}>{k}</button>)}
          <button type="button" className="ok" disabled={!listo} onClick={save}>Guardar</button>
          {['4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => tap(k)}>{k}</button>)}
          <button type="button" className="fn" onClick={() => tap('del')} aria-label="Borrar un dígito">←</button>
          <button type="button" className="fn" onClick={() => tap('000')}>000</button>
          <button type="button" onClick={() => tap('0')}>0</button>
          <button type="button" className="fn" onClick={onClose}>Cerrar</button>
          <button type="button" onClick={() => tap(',')}>,</button>
        </div>
      </section>
    </>
  )
}
