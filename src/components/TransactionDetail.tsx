import { useEffect, useState } from 'react'
import { format, formatUsd } from '../lib/money'
import { parseDate } from '../lib/dates'
import { net, paymentMethodLabel, type Transaction } from '../lib/types'
import { categoryName, subcategoryName, categoryColor } from '../data/categories'
import { useCloseOnBack } from '../lib/back'

interface Props {
  transaction: Transaction | null
  onClose: () => void
  onEdit: (t: Transaction) => void
  onArchive: (t: Transaction) => void
}

const fechaLarga = new Intl.DateTimeFormat('es-AR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

/**
 * Primer toque sobre un movimiento: ver qué es. Antes esto era un `confirm` del
 * navegador que solo ofrecía borrar, lo cual convertía cualquier curiosidad en un
 * riesgo. Acá se lee primero y se decide después.
 *
 * Muestra los estados del dato en vez de esconderlos: lo que no sincronizó, lo que
 * vino del import, lo que tiene reembolso y lo que no tiene hora.
 */
export function TransactionDetail({ transaction, onClose, onEdit, onArchive }: Props) {
  const [confirming, setConfirming] = useState(false)
  const open = !!transaction

  useCloseOnBack(open, onClose)

  // Al cerrar y volver a abrir, la confirmación no queda armada de la vez anterior.
  useEffect(() => { if (!open) setConfirming(false) }, [open])

  const t = transaction
  const sub = t ? subcategoryName(t.category, t.subcategory) : null
  const isUsd = t?.currency === 'USD'
  const unconverted = isUsd && t?.fxRate === null

  return (
    <>
      <div className={'scrim' + (open ? ' on' : '')} onClick={onClose} />
      <section className={'sheet' + (open ? ' on' : '')} aria-label="Detalle del movimiento" aria-hidden={!open}>
        <div className="grab"><i /></div>

        {t && (
          <>
            <div className="monto">
              <span className={'u-readout-xl v' + (t.type === 'income' ? ' ingreso' : '')}>
                <small>{unconverted ? 'US$' : '$'}</small>
                {unconverted ? format(t.originalAmount) : format(net(t))}
              </span>
            </div>

            <dl className="det">
              <div>
                <dt>Categoría</dt>
                <dd>
                  <i className="pun" style={{ background: categoryColor(t.category) }} />
                  {categoryName(t.category)}{sub ? ` · ${sub}` : ''}
                </dd>
              </div>
              <div>
                <dt>Descripción</dt>
                <dd className={t.description ? '' : 'vacia'}>{t.description || 'Sin descripción'}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>{fechaLarga.format(parseDate(t.date))}</dd>
              </div>
              <div>
                <dt>Hora</dt>
                <dd className={t.time ? 'cifra' : 'vacia'}>{t.time ?? 'Sin hora'}</dd>
              </div>
              <div>
                <dt>Con qué pagaste</dt>
                <dd>{paymentMethodLabel(t.paymentMethod)}</dd>
              </div>

              {isUsd && (
                <div>
                  <dt>En dólares</dt>
                  <dd className="cifra">
                    {formatUsd(t.originalAmount)}
                    {t.fxRate !== null
                      ? ` × ${format(t.fxRate)} (${t.fxType} del ${t.fxDate})`
                      : ' — a convertir'}
                  </dd>
                </div>
              )}
              {t.refundArs > 0 && (
                <div>
                  <dt>Reembolso</dt>
                  <dd className="cifra">{format(t.refundArs)} de {format(t.arsAmount)}</dd>
                </div>
              )}
              {t.notes && (
                <div>
                  <dt>Etiquetas</dt>
                  <dd>{t.notes}</dd>
                </div>
              )}
              {t.source !== 'manual' && (
                <div>
                  <dt>Origen</dt>
                  <dd>{t.source === 'meow_import' ? 'Importado de Meow' : t.source}</dd>
                </div>
              )}
              {t._dirty === 1 && (
                <div>
                  <dt>Sincronización</dt>
                  <dd><span className="punto-pendiente" /> Pendiente de subir</dd>
                </div>
              )}
            </dl>

            <div className="det-acciones">
              {confirming ? (
                <>
                  <span className="det-preg">¿Archivar este movimiento?</span>
                  <button type="button" className="chip" onClick={() => setConfirming(false)}>No</button>
                  <button type="button" className="chip peligro" onClick={() => onArchive(t)}>Sí, archivar</button>
                </>
              ) : (
                <>
                  <button type="button" className="chip" onClick={() => setConfirming(true)}>Archivar</button>
                  <button type="button" className="chip primario" onClick={() => onEdit(t)}>Editar gasto</button>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </>
  )
}
