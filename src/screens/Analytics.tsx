import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { transactionsBetween, transactionsOfMonth } from '../lib/db'
import {
  currentMonth, monthName, monthYearName, prevMonth, nextMonth,
  today, dayOf, monthRange, dayHeading, type MonthStr,
} from '../lib/dates'
import { format, formatUsd, type Cents } from '../lib/money'
import { net, paymentMethodLabel, type Transaction } from '../lib/types'
import { categoryName, subcategoryName } from '../data/categories'
import { useCloseOnBack } from '../lib/back'
import {
  porCategoria, porSubcategoria, serieMensual, totalHasta,
  totalGastos, totalIngresos, type Tajada,
} from '../lib/analytics'

type Modo = 'mes' | 'anio'

/** Cuántos meses muestra la tira en modo mes. Scrollea, así que puede ser larga. */
const VENTANA = 24

/** Los N meses que terminan en `hasta`, del más viejo al más nuevo. */
function ultimos(hasta: MonthStr, n: number): MonthStr[] {
  const out: MonthStr[] = [hasta]
  for (let i = 0; i < n - 1; i++) out.unshift(prevMonth(out[0]!))
  return out
}

const anioDe = (m: MonthStr) => m.slice(0, 4)

/** Qué se está mirando en la hoja de movimientos. */
interface Drill {
  category: string
  subcategory: string | null
}

/**
 * Análisis. Lee lo que ya está en Dexie, así que no hay un total precomputado que
 * pueda contradecir a la lista de movimientos.
 *
 * El desglose es una lista rankeada y no una torta: la paleta de categorías tiene
 * pares que no se distinguen —`impuestos` con `hogar`, `bebidas` con `super` en
 * deuteranopía—, y en una torta el color es la única pista de quién es quién. Acá
 * cada fila lleva su nombre y la barra solo refuerza la magnitud.
 */
export function Analytics() {
  const [modo, setModo] = useState<Modo>('mes')
  const [ancla, setAncla] = useState<MonthStr>(currentMonth())
  const [abierta, setAbierta] = useState<string | null>(null)
  const [drill, setDrill] = useState<Drill | null>(null)
  const tira = useRef<HTMLDivElement | null>(null)

  const [shell, setShell] = useState<HTMLElement | null>(null)
  useEffect(() => setShell(document.getElementById('app-shell')), [])

  const anio = anioDe(ancla)
  const esMes = modo === 'mes'

  const [desde, hasta] = esMes ? monthRange(ancla) : [`${anio}-01-01`, `${anio}-12-31`]
  const anioAnt = String(Number(anio) - 1)
  const [desdeAnt, hastaAnt] = esMes
    ? monthRange(prevMonth(ancla))
    : [`${anioAnt}-01-01`, `${anioAnt}-12-31`]

  const periodo = useLiveQuery(
    () => (esMes ? transactionsOfMonth(ancla) : transactionsBetween(desde, hasta)),
    [esMes, ancla, desde, hasta], [] as Transaction[],
  )
  const anterior = useLiveQuery(
    () => transactionsBetween(desdeAnt, hastaAnt),
    [desdeAnt, hastaAnt], [] as Transaction[],
  )

  /**
   * La ventana de la tira **no** se mueve con el mes elegido: se ancla al mes
   * corriente. Anclarla a la selección hacía que el mes que tocabas quedara
   * siempre último, así que el gráfico se reordenaba abajo de tu dedo.
   */
  const meses = useMemo(
    () => (esMes
      ? ultimos(currentMonth(), VENTANA)
      : Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`)),
    [esMes, anio],
  )
  const tsTira = useLiveQuery(
    () => transactionsBetween(`${meses[0]}-01`, `${meses[meses.length - 1]}-31`),
    [meses], [] as Transaction[],
  )

  const total = useMemo(() => totalGastos(periodo), [periodo])
  const ingresos = useMemo(() => totalIngresos(periodo), [periodo])
  const cats = useMemo(() => porCategoria(periodo), [periodo])
  const serie = useMemo(() => serieMensual(tsTira, meses), [tsTira, meses])

  // Arranca mostrando lo más reciente, que es el extremo derecho.
  useEffect(() => {
    const el = tira.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [meses])

  const enCurso = esMes ? ancla === currentMonth() : anio === anioDe(currentMonth())
  const corte = !enCurso ? null : esMes ? today().slice(8, 10) : today().slice(5, 10)
  const largo = esMes ? 2 : 5
  const totalAnterior = useMemo(() => totalHasta(anterior, corte, largo), [anterior, corte, largo])

  const pct = totalAnterior > 0 && total > 0
    ? Math.round((Math.abs(total - totalAnterior) / totalAnterior) * 100)
    : null
  const menos = total < totalAnterior
  const tope = Math.max(...serie.map((p) => p.total), 1)
  const etiquetaAnterior = esMes ? monthName(prevMonth(ancla)) : anioAnt
  const alFinal = esMes ? ancla >= currentMonth() : anio >= anioDe(currentMonth())

  function moverPeriodo(dir: -1 | 1) {
    setAbierta(null)
    if (esMes) {
      const m = dir === -1 ? prevMonth(ancla) : nextMonth(ancla)
      if (m <= currentMonth()) setAncla(m)
      return
    }
    const y = Number(anio) + dir
    if (y <= Number(anioDe(currentMonth()))) setAncla(`${y}-01`)
  }

  const delDrill = useMemo(() => {
    if (!drill) return []
    return periodo
      .filter((t) => t.type === 'expense'
        && t.category === drill.category
        && (drill.subcategory === null || t.subcategory === drill.subcategory))
      .sort((a, b) => (a.date === b.date ? (b.time ?? '').localeCompare(a.time ?? '') : b.date.localeCompare(a.date)))
  }, [periodo, drill])

  return (
    <>
      <header className="hd">
        <div className="hd-total">
          <span className="u-micro">Gastado en {esMes ? monthName(ancla) : anio}</span>
          <span className={'u-readout-l amt' + (total ? '' : ' cero')}>
            <small>$</small>{format(total)}
          </span>
          <span className="hd-delta">
            {pct !== null ? (
              <b className={menos ? 'menos' : ''}>
                {pct}% {menos ? 'menos' : 'más'} que {etiquetaAnterior}
                {corte !== null && (esMes ? ` hasta el ${dayOf(today())}` : ' a esta altura')}
              </b>
            ) : (
              <b>{total ? 'Sin período anterior para comparar' : 'Nada cargado en este período'}</b>
            )}
          </span>
        </div>

        <div className="mo">
          <span className="seg an-seg">
            <button type="button" aria-pressed={esMes} onClick={() => { setModo('mes'); setAbierta(null) }}>Mes</button>
            <button type="button" aria-pressed={!esMes} onClick={() => { setModo('anio'); setAbierta(null) }}>Año</button>
          </span>
          <span className="nav">
            <button type="button" onClick={() => moverPeriodo(-1)} aria-label="Período anterior">&lt;</button>
            <button type="button" onClick={() => moverPeriodo(1)} disabled={alFinal} aria-label="Período siguiente">&gt;</button>
          </span>
        </div>
      </header>

      <div className="feed">
        {/* Una sola serie: un color y sin leyenda. */}
        <div className="an-sec">
          <span className="u-micro">{esMes ? `Últimos ${VENTANA} meses` : `Los 12 meses de ${anio}`}</span>
          <div className="an-trend" ref={tira} role="img"
            aria-label={`Gasto mensual de ${monthYearName(meses[0]!)} a ${monthYearName(meses[meses.length - 1]!)}`}>
            {serie.map((p) => {
              const activo = esMes ? p.month === ancla : p.month === currentMonth()
              return (
                <button
                  key={p.month}
                  type="button"
                  className={'an-bar' + (activo ? ' on' : '')}
                  onClick={() => { setModo('mes'); setAncla(p.month); setAbierta(null) }}
                  title={`${monthYearName(p.month)}: $${format(p.total)}`}
                >
                  <i style={{ height: `${Math.max(2, Math.round((p.total / tope) * 100))}%` }} />
                  <em>{monthName(p.month).slice(0, 3)}</em>
                </button>
              )
            })}
          </div>
        </div>

        <div className="an-sec">
          <span className="u-micro">Por categoría</span>
          {cats.length === 0 ? (
            <p className="an-vacio">Sin gastos en este período.</p>
          ) : (
            <div className="an-lista">
              {cats.map((c) => (
                <Fila
                  key={c.slug}
                  t={c}
                  tope={cats[0]!.total}
                  abierta={abierta === c.slug}
                  onAbrir={() => setAbierta(abierta === c.slug ? null : c.slug)}
                  subs={abierta === c.slug ? porSubcategoria(periodo, c.slug) : null}
                  onVer={(sub) => setDrill({ category: c.slug, subcategory: sub })}
                />
              ))}
            </div>
          )}
        </div>

        {ingresos > 0 && (
          <div className="an-sec">
            <span className="u-micro">Ingresos del período</span>
            <p className="an-ingreso">
              <span className="cifra">{format(ingresos)}</span>
              <em>No se restan del gasto: son dos lecturas distintas.</em>
            </p>
          </div>
        )}
      </div>

      {shell && createPortal(
        <DrillSheet
          drill={drill}
          transactions={delDrill}
          periodo={esMes ? monthYearName(ancla) : anio}
          onClose={() => setDrill(null)}
        />,
        shell,
      )}
    </>
  )
}

function Fila({ t, tope, abierta, onAbrir, subs, onVer }: {
  t: Tajada
  tope: Cents
  abierta: boolean
  onAbrir: () => void
  subs: Tajada[] | null
  onVer: (sub: string | null) => void
}) {
  return (
    <>
      <button type="button" className={'an-fila' + (abierta ? ' on' : '')} onClick={onAbrir} aria-expanded={abierta}>
        <span className="an-nm">{t.name}</span>
        <span className="an-v">{format(t.total)}</span>
        <span className="an-pct">{Math.round(t.share * 100)}%</span>
        <span className="an-track">
          <i style={{ width: `${Math.max(1, Math.round((t.total / tope) * 100))}%`, background: t.color }} />
        </span>
      </button>

      {abierta && subs && (
        <div className="an-subs">
          {subs.map((s) => (
            <button
              key={s.slug}
              type="button"
              className="an-sub"
              onClick={() => onVer(s.slug === '(sin)' ? null : s.slug)}
            >
              <span className="an-nm">{s.name}</span>
              <span className="an-v">{format(s.total)}</span>
              <span className="an-pct">{Math.round(s.share * 100)}%</span>
            </button>
          ))}
          <div className="an-acciones">
            <button type="button" className="chip" onClick={() => onVer(null)}>
              Ver los {t.count} {t.count === 1 ? 'movimiento' : 'movimientos'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}

/** Hoja con los movimientos de una categoría o subcategoría del período. */
function DrillSheet({ drill, transactions, periodo, onClose }: {
  drill: Drill | null
  transactions: Transaction[]
  periodo: string
  onClose: () => void
}) {
  const open = !!drill
  useCloseOnBack(open, onClose)

  const titulo = drill
    ? drill.subcategory
      ? `${categoryName(drill.category)} · ${subcategoryName(drill.category, drill.subcategory) ?? drill.subcategory}`
      : categoryName(drill.category)
    : ''
  const total = transactions.reduce((a, t) => a + net(t), 0)

  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} onClick={onClose} />
      <section className={'sheet dr' + (open ? ' on' : '')} aria-label="Movimientos de la categoría" aria-hidden={!open}>
        <div className="grab"><i /></div>

        <div className="dr-hd">
          <div>
            <span className="u-micro">{periodo}</span>
            <b>{titulo}</b>
          </div>
          <span className="dr-total">{format(total)}</span>
        </div>

        <div className="dr-lista">
          {transactions.map((t) => (
            <div key={t.id} className="dr-fila">
              <span className="dr-body">
                <span className="dr-nm">{t.description || categoryName(t.category)}</span>
                <span className="dr-sub">
                  {dayHeading(t.date)}{t.time ? ` · ${t.time}` : ''} · {paymentMethodLabel(t.paymentMethod)}
                </span>
              </span>
              <span className="dr-v">
                {format(net(t))}
                {t.currency === 'USD' && <em>{formatUsd(t.originalAmount)}</em>}
              </span>
            </div>
          ))}
        </div>

        <div className="det-acciones">
          <span className="det-preg">
            Desde acá solo se mira. Para editar, andá a Movimientos.
          </span>
          <button type="button" className="chip" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </>
  )
}
