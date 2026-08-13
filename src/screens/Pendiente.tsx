/**
 * Estado vacío honesto para las pestañas que todavía no existen. Prefiero esto a
 * esconderlas: la estructura de la app no cambia entre iteraciones.
 */
export function Pendiente({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <header className="hd">
        <div className="hd-total">
          <span className="u-micro">{titulo}</span>
        </div>
      </header>
      <div className="feed">
        <div className="vacio">
          <p className="solo">{texto}</p>
        </div>
      </div>
    </>
  )
}
