import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { transactionsBetween, transactionsOfMonth } from '../lib/db'
import {
  currentMonth, monthName, monthYearName, prevMonth, nextMonth,
  today, dayOf, monthRange, type MonthStr,
} from '../lib/dates'
import { format, type Cents } from '../lib/money'
import type { Transaction } from '../lib/types'
import {
  porCategoria, porSubcategoria, serieMensual, totalHasta,
  totalGastos, totalIngresos, type Tajada,
} from '../lib/analytics'

type Modo = 'mes' | 'anio'

/** Los doce meses que terminan en `hasta`, del más viejo al más nuevo. */
function ultimosDoce(hasta: MonthStr): MonthStr[] {
  const out: MonthStr[] = [hasta]
  for (let i = 0; i < 11; i++) out.unshift(prevMonth(out[0]!))
  return out
}

const anioDe = (m: MonthStr) => m.slice(0, 4)

/**
 * Análisis. Lee lo que ya está en Dexie, así que no hay un total precomputado que
 * pueda contradecir a la lista de movimientos.
 *
 * El desglose es una lista rankeada con barras y no una torta: la paleta de
 * categorías tiene pares que no se distinguen —`impuestos` con `hogar`, `bebidas`
 * con `super` en deuteranopía—, y en una torta el color es la única pista de quién
 * es quién. Acá cada fila lleva su nombre y la barra solo refuerza la magnitud.
 */
export function Analytics() {
  const [modo, setModo] = useState<Modo>('mes')
  const [ancla, setAncla] = useState<MonthStr>(currentMonth())
  const [abierta, setAbierta] = useState<string | null>(null)

  const anio = anioDe(ancla)
  const esMes = modo === 'mes'

  // Rango del período y del anterior, para comparar.
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
   * En modo mes, los doce que terminan en el mes que mirás. En modo año, los doce
   * del año: anclar al mes ahí mostraría meses del año anterior.
   */
  const doce = useMemo(
    () => (esMes ? ultimosDoce(ancla) : Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`)),
    [esMes, ancla, anio],
  )
  const tsDoce = useLiveQuery(
    () => transactionsBetween(`${doce[0]}-01`, `${doce[11]}-31`),
    [doce], [] as Transaction[],
  )

  const total = useMemo(() => totalGastos(periodo), [periodo])
  const ingresos = useMemo(() => totalIngresos(periodo), [periodo])
  const cats = useMemo(() => porCategoria(periodo), [periodo])
  const serie = useMemo(() => serieMensual(tsDoce, doce), [tsDoce, doce])

  /**
   * Si el período está en curso, el anterior se corta a la misma altura. Comparar
   * 20 días contra 31 —o cuatro meses contra doce— inventa una caída que no existe.
   */
  const enCurso = esMes ? ancla === currentMonth() : anio === anioDe(currentMonth())
  const corte = !enCurso ? null : esMes ? today().slice(8, 10) : today().slice(5, 10)
  const largo = esMes ? 2 : 5
  const totalAnterior = useMemo(
    () => totalHasta(anterior, corte, largo),
    [anterior, corte, largo],
  )

  const pct = totalAnterior > 0 && total > 0
    ? Math.round((Math.abs(total - totalAnterior) / totalAnterior) * 100)
    : null
  const menos = total < totalAnterior
  const topeSerie = Math.max(...serie.map((p) => p.total), 1)
  const etiquetaAnterior = esMes ? monthName(prevMonth(ancla)) : anioAnt

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

  const alFinal = esMes ? ancla >= currentMonth() : anio >= anioDe(currentMonth())

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
        {/* Tendencia: una sola serie, así que un solo color y sin leyenda. */}
        <div className="an-sec">
          <span className="u-micro">{esMes ? 'Últimos 12 meses' : `Los 12 meses de ${anio}`}</span>
          <div className="an-trend" role="img"
            aria-label={`Gasto de los últimos 12 meses, de ${monthYearName(doce[0]!)} a ${monthYearName(ancla)}`}>
            {serie.map((p) => {
              // En modo año los doce son del año, así que resaltar por año resaltaría
              // todo: se marca el mes corriente si cae adentro.
              const activo = esMes ? p.month === ancla : p.month === currentMonth()
              return (
                <button
                  key={p.month}
                  type="button"
                  className={'an-bar' + (activo ? ' on' : '')}
                  onClick={() => { setModo('mes'); setAncla(p.month); setAbierta(null) }}
                  title={`${monthYearName(p.month)}: $${format(p.total)}`}
                >
                  <i style={{ height: `${Math.max(2, Math.round((p.total / topeSerie) * 100))}%` }} />
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
    </>
  )
}

function Fila({ t, tope, abierta, onAbrir, subs }: {
  t: Tajada
  tope: Cents
  abierta: boolean
  onAbrir: () => void
  subs: Tajada[] | null
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
            <div key={s.slug} className="an-sub">
              <span className="an-nm">{s.name}</span>
              <span className="an-v">{format(s.total)}</span>
              <span className="an-pct">{Math.round(s.share * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
