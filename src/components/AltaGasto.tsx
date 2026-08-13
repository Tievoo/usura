import { useEffect, useRef, useState } from 'react'
import { aPesos, desdeTecleado, formatear } from '../lib/plata'
import { hoy } from '../lib/fechas'
import { resolver, TIPO_POR_DEFECTO, type Resuelta } from '../lib/fx'
import { CAT_POR_SLUG, TOP_GASTO, colorCategoria } from '../data/categorias'
import { MEDIOS, type MedioPago, type Moneda, type Movimiento } from '../lib/tipos'

interface Props {
  abierto: boolean
  userId: string
  /** Lo último que cargaste: el alta hereda de acá para no pedir nada dos veces. */
  ultimo: { categoria: string; subcategoria: string | null; medioPago: MedioPago } | null
  onCerrar: () => void
  onGuardar: (m: Movimiento) => void
}

/**
 * La pantalla más importante de la app.
 *
 * Teclado propio en vez del del sistema: el del OS tapa media pantalla y esconde
 * las categorías justo cuando las necesitás. Y Guardar no espera a nada — ni a la
 * red, ni a la cotización. Si la API del dólar no responde, el gasto se guarda
 * igual y queda marcado.
 */
export function AltaGasto({ abierto, userId, ultimo, onCerrar, onGuardar }: Props) {
  const [digitos, setDigitos] = useState('')
  const [moneda, setMoneda] = useState<Moneda>('ARS')
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState(ultimo?.categoria ?? 'comida')
  const [subcategoria, setSubcategoria] = useState<string | null>(ultimo?.subcategoria ?? null)
  const [medioPago, setMedioPago] = useState<MedioPago>(ultimo?.medioPago ?? 'mercadopago')
  const [fx, setFx] = useState<Resuelta | null>(null)
  const guardando = useRef(false)

  // Al abrir: monto en blanco y el resto heredado del último gasto.
  useEffect(() => {
    if (!abierto) return
    setDigitos('')
    setConcepto('')
    setMoneda('ARS')
    setCategoria(ultimo?.categoria ?? 'comida')
    setSubcategoria(ultimo?.subcategoria ?? null)
    setMedioPago(ultimo?.medioPago ?? 'mercadopago')
    guardando.current = false
  }, [abierto, ultimo])

  // La cotización se resuelve en cuanto pasás a dólares, para mostrarla antes de confirmar.
  useEffect(() => {
    if (moneda !== 'USD') { setFx(null); return }
    let vivo = true
    void resolver(hoy(), TIPO_POR_DEFECTO).then((r) => { if (vivo) setFx(r) })
    return () => { vivo = false }
  }, [moneda])

  const monto = desdeTecleado(digitos)
  const cat = CAT_POR_SLUG[categoria]
  const enPesos = moneda === 'USD' && fx ? aPesos(monto, fx.valor) : monto

  function tecla(k: string) {
    if (k === 'del') return setDigitos((d) => d.slice(0, -1))
    if (k === '000') return setDigitos((d) => (d ? (d + '000').slice(0, 9) : d))
    setDigitos((d) => (d + k).replace(/^0+/, '').slice(0, 9))
  }

  function guardar() {
    if (!monto || guardando.current) return
    guardando.current = true

    const ahora = new Date().toISOString()
    const usd = moneda === 'USD'

    onGuardar({
      id: crypto.randomUUID(),
      userId,
      tipo: 'gasto',
      fecha: hoy(),
      concepto: concepto.trim(),
      montoOriginal: monto,
      moneda,
      // Sin cotización se guarda en 0 y queda "a convertir": nunca inventamos un número.
      montoArs: usd ? (fx ? aPesos(monto, fx.valor) : 0) : monto,
      fxValor: usd ? (fx?.valor ?? null) : null,
      fxTipo: usd ? (fx?.tipo ?? null) : null,
      fxFecha: usd ? (fx?.fecha ?? null) : null,
      categoria,
      subcategoria,
      medioPago,
      reembolsoArs: 0,
      notas: null,
      origen: 'manual',
      createdAt: ahora,
      updatedAt: ahora,
      deletedAt: null,
      _dirty: 1,
    })
  }

  return (
    <>
      <div className={'scrim' + (abierto ? ' on' : '')} onClick={onCerrar} />
      <section className={'sheet' + (abierto ? ' on' : '')} aria-label="Cargar gasto" aria-hidden={!abierto}>
        <div className="grab"><i /></div>

        <div className="monto">
          <span className={'u-readout-xl v' + (monto ? '' : ' cero')}>
            <small>{moneda === 'ARS' ? '$' : 'US$'}</small>
            {formatear(monto)}
            <span className="caret">|</span>
          </span>
          <span className="seg">
            <button type="button" aria-pressed={moneda === 'ARS'} onClick={() => setMoneda('ARS')}>$</button>
            <button type="button" aria-pressed={moneda === 'USD'} onClick={() => setMoneda('USD')}>US$</button>
          </span>
        </div>

        {moneda === 'USD' && monto > 0 && (
          <p className={'fx-nota' + (fx?.estimado ? ' estimado' : '')}>
            {fx
              ? `≈ $${formatear(enPesos)} · oficial${fx.estimado ? ` del ${fx.fecha}, estimado` : ' de hoy'}`
              : 'Sin cotización todavía. Se guarda en dólares y se convierte cuando haya red.'}
          </p>
        )}

        <div className="campo">
          <input
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Concepto — opcional"
            enterKeyHint="done"
          />
        </div>

        <div className="sec">
          <span className="u-micro">Categoría</span>
          <div className="chips">
            {TOP_GASTO.map((slug) => (
              <button
                key={slug}
                type="button"
                className="chip"
                aria-pressed={categoria === slug}
                onClick={() => { setCategoria(slug); setSubcategoria(null) }}
              >
                <i style={{ background: colorCategoria(slug) }} />
                {CAT_POR_SLUG[slug]?.corto ?? CAT_POR_SLUG[slug]?.nombre}
              </button>
            ))}
            {!TOP_GASTO.includes(categoria as (typeof TOP_GASTO)[number]) && cat && (
              <button type="button" className="chip" aria-pressed>
                <i style={{ background: cat.color }} />
                {cat.corto ?? cat.nombre}
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
                  aria-pressed={subcategoria === s.slug}
                  onClick={() => setSubcategoria(subcategoria === s.slug ? null : s.slug)}
                >
                  {s.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sec">
          <span className="u-micro">Con qué pagaste</span>
          <div className="chips">
            {MEDIOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                className="chip"
                aria-pressed={medioPago === m.valor}
                onClick={() => setMedioPago(m.valor)}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="pad">
          {['1', '2', '3'].map((k) => <button key={k} type="button" onClick={() => tecla(k)}>{k}</button>)}
          <button type="button" className="ok" disabled={!monto} onClick={guardar}>Guardar</button>
          {['4', '5', '6', '7', '8', '9'].map((k) => <button key={k} type="button" onClick={() => tecla(k)}>{k}</button>)}
          <button type="button" className="fn" onClick={() => tecla('del')} aria-label="Borrar un dígito">←</button>
          <button type="button" className="fn" onClick={() => tecla('000')}>000</button>
          <button type="button" onClick={() => tecla('0')}>0</button>
          <button type="button" className="fn" onClick={onCerrar}>Cerrar</button>
        </div>
      </section>
    </>
  )
}
