import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { RuleSheet } from '../components/RuleSheet'
import { deleteRule, instancesOfRule, recurringRules, saveRule } from '../lib/db'
import { generateDue, monthCommitment, summarize, upcomingThisMonth, type RuleSummary } from '../lib/recurring'
import { resolveRate, type ResolvedRate } from '../lib/fx'
import { currentMonth, monthName, monthYearName, shortDay, today } from '../lib/dates'
import { format, formatUsd } from '../lib/money'
import { recurringTypeLabel, type RecurringRule } from '../lib/types'
import { categoryName, subcategoryName } from '../data/categories'
import { sync } from '../lib/sync'

/**
 * Las series: suscripciones que siguen hasta que las cortes y cuotas que terminan
 * solas. La diferencia entre las dos es lo que la lista tiene que dejar claro de
 * un vistazo, así que cada fila dice si tiene fin conocido o no.
 *
 * Lo que todavía no se cobró se muestra aparte y marcado como estimado. No es un
 * movimiento: es algo que va a pasar, y la app no cuenta plata que no salió.
 */
export function Recurring({ userId }: { userId: string }) {
  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState<RecurringRule | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [rate, setRate] = useState<ResolvedRate | null>(null)
  const [shell, setShell] = useState<HTMLElement | null>(null)

  useEffect(() => setShell(document.getElementById('app-shell')), [])

  // Una sola consulta: `useLiveQuery` observa las dos tablas que toca y vuelve a
  // correr cuando cambia cualquiera de ellas.
  const data = useLiveQuery(
    async () => {
      const rules = await recurringRules()
      const instances = (await Promise.all(rules.map((r) => instancesOfRule(r.id)))).flat()
      return { rules, instances }
    },
    [],
    { rules: [] as RecurringRule[], instances: [] },
  )

  // La cotización de hoy es lo único con lo que se puede estimar una serie en
  // dólares que todavía no se cobró. Si no hay, esa parte queda afuera del total.
  useEffect(() => { void resolveRate(today()).then(setRate) }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 1800)
    return () => window.clearTimeout(id)
  }, [toast])

  const month = currentMonth()
  const summaries = useMemo(
    () => data.rules.map((r) => summarize(r, data.instances)),
    [data],
  )
  const commitment = useMemo(
    () => monthCommitment(data.rules, data.instances, month, rate),
    [data, month, rate],
  )
  const upcoming = useMemo(() => upcomingThisMonth(data.rules), [data.rules])
  const active = data.rules.filter((r) => r.active).length

  async function handleSave(rule: RecurringRule) {
    await saveRule(rule)
    setSheet(false)
    setEditing(null)
    // Las instancias vencidas se crean acá mismo: la serie recién cargada tiene que
    // aparecer en Movimientos sin esperar a la próxima apertura de la app.
    const created = await generateDue()
    setToast(created > 0 ? `Guardada. ${created} ${created === 1 ? 'movimiento generado' : 'movimientos generados'}.` : 'Guardada')
    void sync()
  }

  async function handlePause(rule: RecurringRule) {
    const pausing = rule.active
    await saveRule({
      ...rule,
      active: !pausing,
      // Al cortarla se registra cuándo; al reactivarla vuelve a no tener fin.
      endDate: pausing ? today() : null,
      updatedAt: new Date().toISOString(),
    })
    setSheet(false)
    setEditing(null)
    setToast(pausing ? 'Pausada. No genera más.' : 'Reactivada')
    void sync()
  }

  async function handleArchive(rule: RecurringRule) {
    await deleteRule(rule.id)
    setSheet(false)
    setEditing(null)
    setToast('Archivada. Los movimientos que generó quedan.')
    void sync()
  }

  function nueva() {
    setEditing(null)
    setSheet(true)
  }

  return (
    <>
      <header className="hd">
        <div className="hd-total">
          <span className="u-micro">Recurrente en {monthName(month)}</span>
          <span className={'u-readout-l amt' + (commitment.total ? '' : ' cero') + (commitment.estimated ? ' u-estimado' : '')}>
            <small>$</small>
            {format(commitment.total)}
          </span>
          <span className="hd-delta">
            <b>
              {active} {active === 1 ? 'serie activa' : 'series activas'}
              {commitment.estimated && ' · incluye lo que todavía no se cobró'}
            </b>
          </span>
        </div>

        <div className="mo">
          <span className="m">{monthYearName(month)}</span>
          <button type="button" className="chip" onClick={nueva}>Nueva serie</button>
        </div>
      </header>

      <div className="feed">
        {!data.rules.length ? (
          <div className="vacio">
            <p>Todavía no cargaste ninguna serie. Una suscripción sigue hasta que la cortes; unas cuotas terminan solas.</p>
            <button type="button" className="chip" onClick={nueva}>Cargar la primera</button>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div>
                <div className="dia">
                  <span className="d">Se viene en {monthName(month)}</span>
                </div>
                {upcoming.map((u) => (
                  <div className="mv estatica" key={`${u.rule.id}-${u.date}`}>
                    <span className="mv-body">
                      <span className="mv-nm">{u.rule.description}</span>
                      <span className="mv-sub">
                        {shortDay(u.date)}
                        {u.installmentNo !== null && ` · cuota ${u.installmentNo} de ${u.rule.installmentsTotal}`}
                      </span>
                    </span>
                    {/* Todavía no ocurrió: subrayado punteado, como manda el sistema. */}
                    <span className="mv-v u-estimado">
                      {u.rule.currency === 'USD' ? formatUsd(u.rule.amount) : format(u.rule.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div className="dia">
                <span className="d">Series</span>
                <span className="st">{data.rules.length}</span>
              </div>
              {summaries.map((s) => (
                <RuleRow key={s.rule.id} s={s} onTap={(r) => { setEditing(r); setSheet(true) }} />
              ))}
            </div>
          </>
        )}
      </div>

      {shell && createPortal(
        <>
          <RuleSheet
            open={sheet}
            userId={userId}
            editing={editing}
            onClose={() => { setSheet(false); setEditing(null) }}
            onSave={(r) => void handleSave(r)}
            onPause={(r) => void handlePause(r)}
            onArchive={(r) => void handleArchive(r)}
          />
          <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
        </>,
        shell,
      )}
    </>
  )
}

/**
 * Una serie en una línea. Lo que la fila tiene que contestar sin abrirla: cuánto
 * es cada vez, cuántas van, si tiene fin y cuánto lleva.
 */
function RuleRow({ s, onTap }: { s: RuleSummary; onTap: (r: RecurringRule) => void }) {
  const { rule } = s
  const sub = subcategoryName(rule.category, rule.subcategory)

  // Una suscripción sin fin no es un dato que falte: es lo normal, y se dice así.
  const serie = !rule.active
    ? 'en pausa'
    : rule.installmentsTotal !== null
      ? `${Math.min(s.generated, rule.installmentsTotal)} de ${rule.installmentsTotal}`
      : `${s.generated} ${s.generated === 1 ? 'cobro' : 'cobros'}`

  const cuando = !rule.active
    ? null
    : s.next
      ? `próxima ${shortDay(s.next)}`
      : s.remaining === 0
        ? 'terminada'
        : null

  const meta = [categoryName(rule.category), sub, serie, cuando].filter(Boolean).join(' · ')

  return (
    <button type="button" className={'mv' + (rule.active ? '' : ' pausada')} onClick={() => onTap(rule)}>
      <span className="mv-body">
        <span className="mv-nm">
          {rule.description} <span className="chip-rec">{recurringTypeLabel(rule)}</span>
        </span>
        <span className="mv-sub">{meta}</span>
      </span>

      <span className="mv-v">
        {rule.currency === 'USD' ? formatUsd(rule.amount) : format(rule.amount)}
        {s.spent > 0 && <em>lleva {format(s.spent)}</em>}
      </span>
    </button>
  )
}
