import { useEffect, useRef } from 'react'

/**
 * En una compu no hay teclado en pantalla: se escribe con el físico. Mientras la
 * hoja está abierta y no estás parado en otro campo, las teclas van al monto,
 * igual que si tocaras el teclado de la app. Enter guarda y Escape cierra.
 */
export function usePhysicalKeypad(
  open: boolean,
  handlers: { tap: (k: string) => void; save: () => void; close: () => void },
): void {
  // Por referencia: si no, el listener se reinstalaría en cada tecla.
  const cb = useRef(handlers)
  cb.current = handlers

  useEffect(() => {
    if (!open) return

    function onKey(e: KeyboardEvent) {
      // Un atajo del navegador sigue siendo del navegador.
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // El campo enfocado se queda con la tecla: el concepto, la fecha y la hora
      // se escriben como en cualquier formulario. Enter es la excepción, porque
      // terminar de escribir el concepto y guardar con Enter es el gesto obvio.
      const el = document.activeElement
      const enFoco =
        el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))

      const k = e.key
      if (enFoco && k !== 'Enter') return

      if (k.length === 1 && k >= '0' && k <= '9') cb.current.tap(k)
      else if (k === ',' || k === '.') cb.current.tap(',')
      else if (k === 'Backspace') cb.current.tap('del')
      else if (k === 'Enter') cb.current.save()
      else if (k === 'Escape') cb.current.close()
      else return

      // Recién acá: Backspace sin esto todavía navega hacia atrás en algunos navegadores.
      e.preventDefault()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
}
