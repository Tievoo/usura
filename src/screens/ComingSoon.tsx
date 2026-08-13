/**
 * Estado vacío honesto para las pestañas que todavía no existen. Prefiero esto a
 * esconderlas: la estructura de la app no cambia entre iteraciones.
 */
export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <>
      <header className="hd">
        <div className="hd-total">
          <span className="u-micro">{title}</span>
        </div>
      </header>
      <div className="feed">
        <div className="vacio">
          <p className="solo">{text}</p>
        </div>
      </div>
    </>
  )
}
