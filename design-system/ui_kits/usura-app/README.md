# usura-app — prototipo

`index.html` es un prototipo de una sola página, sin build ni dependencias: se abre con doble clic
o desde el celular y funciona. Consume los tokens de `../../colors_and_type.css`.

## Qué prueba

- **La pantalla Movimientos completa**: encabezado de mes, lista agrupada por día con subtotal, FAB, barra de pestañas.
- **El camino corto del alta**: FAB → tipear el monto → Guardar. La categoría, la subcategoría y el medio de pago vienen heredados del último gasto; el concepto es opcional.
- **Teclado propio** en lugar del teclado del sistema: el monto y las categorías nunca quedan tapados.
- **ARS / USD** con la conversión y la cotización visibles antes de confirmar.
- **El movimiento nuevo entra con el punto de «sin sincronizar»**, que es exactamente lo que va a pasar en la app real cuando cargues algo sin señal.
- **Tema claro**, con el botón de arriba, para ver la contraparte al sol.

## Los datos

Julio 2026 son los **51 gastos reales** del export de Meow, remapeados a la taxonomía de
`docs/CATEGORIAS.md`. El total da **$899.007**, que es el número que sale del CSV. Agosto trae los
2 movimientos reales que había cargados, así que al guardar un gasto nuevo se crea el grupo del día
de hoy arriba de todo.

La cotización del dólar (1.500) es un valor de ejemplo del prototipo. Todo el resto es dato real.

## Lo que el prototipo no hace

No persiste (recargar vuelve al estado inicial), no valida, no edita ni borra movimientos, y las
pestañas Análisis, Recurrentes y Deudas no están conectadas. Es una maqueta funcional para validar
el flujo de alta y la densidad de la lista, no un adelanto de la app.
