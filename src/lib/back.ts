import { useEffect, useRef } from 'react'

/**
 * El botón atrás del teléfono cierra el modal abierto en vez de salir de la app.
 *
 * Se hace con una sola entrada de historial compartida entre todos los modales,
 * no una por modal. El motivo es la transición detalle -> edición: ahí un modal se
 * cierra y otro se abre en el mismo tick, y con una entrada por modal el `back()`
 * de la limpieza del primero se come la entrada que acababa de empujar el segundo,
 * cerrándolo de inmediato. Contando los abiertos y reconciliando en un timer de 0,
 * esa secuencia se ve como «seguía habiendo un modal» y no toca el historial.
 */

let abiertos = 0
let empujado = false
let timer: number | undefined
let instalado = false
/** El último que se abrió es el primero que cierra el atrás. */
const pila: (() => void)[] = []

function reconciliar() {
  if (timer !== undefined) return
  timer = window.setTimeout(() => {
    timer = undefined
    if (abiertos > 0 && !empujado) {
      history.pushState({ usuraModal: true }, '')
      empujado = true
    } else if (abiertos === 0 && empujado) {
      // Se cerró con un botón: hay que sacar la entrada que empujamos, o el
      // próximo atrás no haría nada visible.
      empujado = false
      history.back()
    }
  }, 0)
}

function instalar() {
  if (instalado) return
  instalado = true
  window.addEventListener('popstate', () => {
    // Si no hay entrada nuestra, esto es una navegación ajena: no se toca.
    if (!empujado) return
    empujado = false
    pila[pila.length - 1]?.()
  })
}

export function useCloseOnBack(open: boolean, onClose: () => void): void {
  // Por referencia: si el padre pasa una arrow inline, el efecto no debe
  // reejecutarse en cada render y empujar historial de más.
  const cb = useRef(onClose)
  cb.current = onClose

  useEffect(() => {
    if (!open) return
    instalar()
    const cerrar = () => cb.current()
    pila.push(cerrar)
    abiertos++
    reconciliar()

    return () => {
      const i = pila.indexOf(cerrar)
      if (i >= 0) pila.splice(i, 1)
      abiertos--
      reconciliar()
    }
  }, [open])
}
