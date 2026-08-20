import type { Transaction, PaymentMethod, TransactionType } from './types'
import type { DateStr } from './dates'
import type { Cents } from './money'

/**
 * Importador del CSV de Meow Money Manager. Las reglas viven en
 * `docs/CATEGORIAS.md` §3 a §6; acá se ejecutan, no se inventan.
 *
 * Dos propiedades que el importador tiene que cumplir sí o sí:
 *
 * 1. **Determinista.** El id de cada fila sale de un hash de la fila misma, no de
 *    `crypto.randomUUID()`. Reimportar el mismo CSV pisa las mismas filas en vez
 *    de duplicarlas, así se puede correr de nuevo cuando se agreguen reglas.
 * 2. **No inventa.** Lo que no matchea ninguna regla cae en `otros > sin-categorizar`
 *    y queda contado en las estadísticas, no escondido.
 */

/* ---------- CSV ---------- */

/** Parser de CSV con comillas dobles escapadas. El export de Meow trae comas en los comentarios. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++ } else quoted = false
      } else cur += c
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(cur); cur = ''
    } else if (c === '\n') {
      row.push(cur); rows.push(row); row = []; cur = ''
    } else if (c !== '\r') {
      cur += c
    }
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.length > 1)
}

export interface MeowRow {
  fecha: string
  categoria: string
  tipo: string
  monto: string
  activo: string
  reembolsar: string
  comentario: string
}

const COLUMNAS = ['Fecha', 'Categoría', 'Tipo', 'Monto', 'Activo', 'Libro mayor', 'Reembolsar', 'Comentar']

/** Valida el encabezado y devuelve las filas tipadas. Tira si el CSV no es de Meow. */
export function readMeowRows(text: string): MeowRow[] {
  const rows = parseCsv(text)
  const head = rows[0]
  if (!head || COLUMNAS.some((c, i) => head[i]?.trim() !== c)) {
    throw new Error(
      `El CSV no tiene las columnas de Meow. Esperaba: ${COLUMNAS.join(', ')}`,
    )
  }
  return rows.slice(1).map((r) => ({
    fecha: r[0] ?? '',
    categoria: r[1] ?? '',
    tipo: r[2] ?? '',
    monto: r[3] ?? '',
    activo: r[4] ?? '',
    reembolsar: r[6] ?? '',
    comentario: r[7] ?? '',
  }))
}

/* ---------- fecha y monto ---------- */

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, sept: 9, oct: 10, nov: 11, dic: 12,
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** 'ago 01 2026 20:54' -> '2026-08-01'. La hora se descarta: Usura trabaja por día. */
export function parseFecha(raw: string): DateStr | null {
  const m = raw.trim().match(/^([a-záéíóú]+)\s+(\d{1,2})\s+(\d{4})/i)
  if (!m) return null
  const mes = MESES[m[1]!.toLowerCase()]
  if (!mes) return null
  return `${m[3]}-${p2(mes)}-${p2(Number(m[2]))}`
}

/** 'ago 01 2026 20:54' -> '20:54'. null si el export no trae hora. */
export function parseHora(raw: string): string | null {
  const m = raw.trim().match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${p2(Number(m[1]))}:${m[2]}`
}

/** '-11846' -> 1184600 · '+104397.11' -> 10439711. Siempre el valor absoluto, en centavos. */
export function parseMonto(raw: string): Cents {
  const n = Number.parseFloat(raw.replace(/[+\s]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(Math.abs(n) * 100)
}

/** Meow guarda la cuenta con espacios y flechas de transferencia. */
function parseMedioPago(activo: string): PaymentMethod {
  const a = activo.trim().toLowerCase()
  if (a.startsWith('crédito') || a.startsWith('credito')) return 'credit'
  if (a.startsWith('efectivo')) return 'cash'
  return 'mercadopago'
}

/* ---------- normalización de texto ---------- */

/** Minúsculas y sin tildes: las reglas de CATEGORIAS.md se escribieron así. */
export const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const has = (txt: string, patterns: string) => new RegExp(patterns).test(txt)

/* ---------- clasificación ---------- */

export interface Clasificacion {
  category: string
  subcategory: string | null
  tags: string[]
}

const cat = (category: string, subcategory: string | null = null): Clasificacion =>
  ({ category, subcategory, tags: [] })

/** §5.2 — Comida por comentario. */
function subComida(c: string): string {
  if (has(c, 'mcdonalds|mcc|mc |mcaya|nocta|kfc|burger|whatevurger|tasty|pancho')) return 'fast-food'
  if (has(c, 'merienda|medialuna|sanguch|santuch|ciabat|alfajor|alfsjor|brule|batata|milanes|cafe')) return 'merienda'
  if (has(c, 'rappi|pedidos ya|delivery')) return 'delivery'
  if (has(c, 'helado|torta|carrot cake|carro cake|crepas|mousse|postre')) return 'postres'
  if (has(c, 'propina')) return 'propina'
  return 'restaurante'
}

/** §5.3 — Transporte por comentario. */
function subTransporte(c: string): string {
  if (has(c, 'didi|uber|cabify')) return 'apps'
  if (has(c, 'nafta|tanque|combustible|ypf|shell')) return 'nafta'
  if (has(c, 'estacionamiento|estacion|parking')) return 'estacionamiento'
  if (has(c, 'peaje')) return 'peajes'
  if (has(c, 'mecanico|service|partes|puertas|arregl|no funcionan')) return 'mantenimiento'
  if (has(c, 'sube|colectivo|bondi|tren|subte')) return 'publico'
  return 'apps'
}

/**
 * §5.4 — la categoría `Juego` de Meow mezclaba dos cosas distintas: timba y
 * videojuegos. Por eso el fallback es un parámetro y no una constante: un `Juego`
 * que no matchea ningún patrón de apuesta es un videojuego —así lo dice la data,
 * 16 de 17 casos— mientras que un `Timba` que no matchea sigue siendo timba.
 */
function claseApuestas(c: string, fallback: Clasificacion): Clasificacion {
  // Salidas físicas: se juega, pero no se apuesta.
  if (has(c, 'playland|bowling|bolos|pool|golf|rematch|repo')) return cat('entretenimiento', 'salidas')
  if (has(c, 'poker|pokerstars')) return cat('apuestas', 'poker')
  if (has(c, 'stake|sinoca|casino|online')) return cat('apuestas', 'casino')
  // 'timbee' y 'timbita' no contienen 'timba': hay que listar las variantes.
  if (has(c, 'timba|timbit|timbin|timbe|rula|chirolera')) return cat('apuestas', 'timba')
  return fallback
}

/** §5.5 — Tecnología por comentario. */
function subTecnologia(c: string): string | null {
  if (has(c, 'grafica|gabinete|fuente|cooler|monitor|ideapad|placa')) return 'componentes'
  if (has(c, 'celu|celular|telefono')) return 'celular'
  if (has(c, 'mouse|cargador|pilas|pendrive|funda|punta|mic')) return 'accesorios'
  if (has(c, 'arregl|reparac|remodelar')) return 'reparaciones'
  return null
}

/** §5.6 — desarme de `Varios`. Devuelve null si ninguna regla aplica. */
function claseVarios(c: string): Clasificacion | null {
  if (has(c, 'ytp|yt prem|ytpremium|youtube')) return cat('suscripciones', 'streaming')
  if (has(c, 'crunchyroll|runchyroll')) return cat('suscripciones', 'streaming')
  if (has(c, 'meli|ml nivel|mp nivel|mercalibre')) return cat('suscripciones', 'servicios-digitales')
  if (has(c, 'figma|calm|stats fm|google one|dateas|djfumsdote|los datos|calcu')) return cat('suscripciones', 'software')
  if (has(c, 'ysy|fabro|fsbro|cadena ysy')) return { ...cat('entretenimiento', 'recitales'), tags: ['ysy-a'] }
  if (has(c, 'psicolog|osicolog')) return cat('salud', 'psicologa')
  if (has(c, 'gym|gimnasio')) return cat('deporte', 'gym')
  if (has(c, 'monotrib|afip')) return cat('impuestos', 'monotributo')
  if (has(c, 'multa')) return cat('impuestos', 'multas')
  if (has(c, 'pasaporte|isic|fotocopias|fotinis|carnet')) return cat('impuestos', 'documentacion')
  if (has(c, 'extraccion|extracciones|comision')) return cat('impuestos', 'comisiones')
  if (has(c, 'la luz|el piso')) return cat('hogar', 'servicios')
  if (has(c, 'silla')) return cat('hogar', 'muebles')
  if (has(c, 'imax|entrada|makena|frozouda|sabi|pochoclos|pochox')) return cat('entretenimiento', 'eventos')
  if (has(c, 'telo')) return cat('entretenimiento', 'salidas')
  if (has(c, 'trago|birra|guardarropa|alcohol|coca|cocas')) return cat('bebidas', 'alcohol')
  if (has(c, 'uber|didi|sube|parking')) return cat('transporte', subTransporte(c))
  if (has(c, 'shampoo|crema para el pelo|forros')) return cat('cuidado', 'higiene')
  if (has(c, 'gafas')) return cat('salud', 'optica')
  if (has(c, 'aritos|altitude|brth|don rouch')) return cat('ropa', 'accesorios-ropa')
  if (has(c, 'manga|rifas|regale')) return cat('regalos', 'regalos')
  if (has(c, 'burger|cafecito|chino')) return cat('comida', subComida(c))
  return null
}

/** §2 — ingresos. */
function claseIngreso(categoria: string, c: string): Clasificacion {
  const k = norm(categoria).trim()
  if (k === 'salario') return cat('trabajo', 'sueldo')
  if (k === 'cambio') return cat('venta-usd')
  if (k === 'premios') return cat('ganancias-apuestas')
  if (k === 'interes') return cat('inversiones', 'intereses')
  if (k === 'otros') {
    if (has(c, 'base')) return cat('trabajo', 'honorarios')
    if (has(c, 'devolucion|reembolso|rappi')) return cat('reintegros')
  }
  return cat('otros-ingreso')
}

/** §5.1 y §5.6 — gastos. */
function claseGasto(categoria: string, c: string): Clasificacion {
  const k = norm(categoria).trim()

  switch (k) {
    case 'comida': return cat('comida', subComida(c))
    case 'uba': return cat('comida', 'facultad')
    case 'postre': return cat('comida', 'postres')
    case 'propina': return cat('comida', 'propina')
    case 'cafe': return cat('comida', 'merienda')

    case 'coche': return cat('transporte', subTransporte(c))
    case 'autobus': return cat('transporte', 'publico')
    case 'gasto grande obligatorio':
      return { ...cat('transporte', 'mantenimiento'), tags: ['gasto-grande'] }

    case 'bebida':
    case 'beber':
      return cat('bebidas', has(c, 'alcohol|trago|birra|fernet|cerveza|vino') ? 'alcohol' : 'sin-alcohol')

    case 'super': return cat('super', 'super')
    case 'verduras': return cat('super', 'verduleria')

    case 'juego':
      return claseApuestas(c, cat('entretenimiento', 'videojuegos'))
    case 'timba':
      return claseApuestas(c, cat('apuestas', 'timba'))

    case 'cine': return cat('entretenimiento', 'cine')

    case 'deporte':
      if (has(c, 'futbol|fobal|fubol|fuchebol')) return cat('deporte', 'futbol')
      if (has(c, 'gym|gimnasio')) return cat('deporte', 'gym')
      return cat('deporte', 'otros-deportes')

    // Categoría nueva en el export de agosto 2026. Antes el gym venía dentro de
    // `Varios` y lo resolvía la regla por comentario.
    case 'gym':
      return cat('deporte', 'gym')

    case 'medico': return cat('salud', 'medico')
    case 'tecnologia': return cat('tecnologia', subTecnologia(c))

    case 'corte de pelo':
    case 'limpiar':
      return cat('cuidado', 'peluqueria')
    case 'perfume':
    case 'cosmetico':
      return cat('cuidado', 'perfumeria')

    case 'ropa': return cat('ropa', 'ropa')
    case 'regalo': return cat('regalos', 'regalos')

    case 'vacacione':
      if (has(c, 'vuelo|aereo')) return cat('viajes', 'vuelos')
      if (has(c, 'airbnb|hotel|hostel')) return cat('viajes', 'alojamiento')
      return cat('viajes', 'gastos-viaje')
    case 'junko':
      return { ...cat('viajes', 'gastos-viaje'), tags: ['junko', 'viaje-junko'] }

    case 'suscripcion': return cat('suscripciones', 'streaming')

    // Tati no es una categoría, es una persona: la categoría sale del comentario.
    case 'tati': {
      const v = claseVarios(c)
      return v ?? cat('comida', subComida(c))
    }

    case 'me la mande':
    case 'cambio':
      return { ...cat('otros', 'sin-categorizar'), tags: ['revisar'] }

    case 'varios': {
      const v = claseVarios(c)
      return v ?? { ...cat('otros', 'sin-categorizar'), tags: ['revisar'] }
    }

    default:
      return { ...cat('otros', 'sin-categorizar'), tags: ['revisar'] }
  }
}

/* ---------- etiquetas §5.7 ---------- */

const PERSONAS = ['tati', 'maxi', 'junko', 'axel', 'ian', 'fabro', 'tahichi', 'lolo', 'forster', 'dani', 'maria']

function etiquetas(categoria: string, comentario: string): string[] {
  const c = norm(comentario)
  const k = norm(categoria).trim()
  const out = new Set<string>()

  for (const p of PERSONAS) {
    if (new RegExp(`\\b${p}`).test(c)) out.add(p)
  }
  if (k === 'tati') out.add('tati')
  if (has(c, 'service de mam|multa de papa|mi vieja')) out.add('familia')
  return [...out]
}

/* ---------- cuotas §5.8 ---------- */

const RE_CUOTA = /\bcuot[ao]?\s*(\d{1,2})\b|\b(\d{1,2})\s*\/\s*(\d{1,2})\b/

/** Detecta la cuota declarada en el comentario. No se persiste todavía: falta la tabla. */
export function detectarCuota(comentario: string): { nro: number; total: number | null } | null {
  const m = norm(comentario).match(RE_CUOTA)
  if (!m) return null
  if (m[1]) return { nro: Number(m[1]), total: null }
  return { nro: Number(m[2]), total: Number(m[3]) }
}

/* ---------- id determinista ---------- */

/**
 * UUID derivado de la fila. La clave natural (fecha + categoría + monto + comentario)
 * es única en las 1.230 filas del export, así que reimportar pisa y no duplica.
 */
export async function idDeFila(r: MeowRow): Promise<string> {
  const clave = `meow|${r.fecha}|${r.categoria}|${r.monto}|${r.comentario}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave))
  const h = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  // Forma de UUID v4 para que sea una uuid válida en Postgres.
  return [
    h.slice(0, 8), h.slice(8, 12),
    '4' + h.slice(13, 16),
    ((Number.parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-')
}

/* ---------- resultado ---------- */

export type MotivoDescarte = 'transferencia' | 'cobro-de-deuda' | 'prestamo' | 'fecha-invalida' | 'monto-cero'

export interface Descartada {
  row: MeowRow
  motivo: MotivoDescarte
}

export interface ResultadoImport {
  transactions: Transaction[]
  descartadas: Descartada[]
  stats: {
    filas: number
    importadas: number
    gastos: number
    ingresos: number
    descartadas: number
    porMotivo: Record<string, number>
    sinCategorizar: number
    conReembolso: number
    conEtiquetas: number
    cuotasDetectadas: number
    rango: { desde: DateStr; hasta: DateStr } | null
  }
}

/**
 * Convierte el CSV entero. No escribe nada: devuelve las transacciones listas para
 * que la pantalla muestre el resumen y recién después se confirme.
 *
 * `desde` / `hasta` acotan por fecha (inclusive), en 'YYYY-MM-DD'.
 */
export async function importarMeow(
  text: string,
  userId: string,
  rango?: { desde?: DateStr; hasta?: DateStr },
): Promise<ResultadoImport> {
  const rows = readMeowRows(text)
  const transactions: Transaction[] = []
  const descartadas: Descartada[] = []
  const porMotivo: Record<string, number> = {}
  const ahora = new Date().toISOString()

  let sinCategorizar = 0
  let conReembolso = 0
  let conEtiquetas = 0
  let cuotasDetectadas = 0
  let min: DateStr | null = null
  let max: DateStr | null = null

  const descartar = (row: MeowRow, motivo: MotivoDescarte) => {
    descartadas.push({ row, motivo })
    porMotivo[motivo] = (porMotivo[motivo] ?? 0) + 1
  }

  for (const r of rows) {
    const kCat = norm(r.categoria).trim()

    // §3 — lo que no es gasto ni ingreso.
    if (r.tipo.trim() === 'Transferir') { descartar(r, 'transferencia'); continue }
    if (kCat === 'transfe') { descartar(r, 'cobro-de-deuda'); continue }
    if (kCat === 'presto') { descartar(r, 'prestamo'); continue }

    const date = parseFecha(r.fecha)
    if (!date) { descartar(r, 'fecha-invalida'); continue }

    const amount = parseMonto(r.monto)
    if (amount === 0) { descartar(r, 'monto-cero'); continue }

    // Fuera del rango pedido: no es un descarte, simplemente no entra.
    if (rango?.desde && date < rango.desde) continue
    if (rango?.hasta && date > rango.hasta) continue

    const type: TransactionType = r.tipo.trim() === 'Ingreso' ? 'income' : 'expense'
    const comentario = r.comentario.trim()
    const c = norm(comentario)

    const clase = type === 'income' ? claseIngreso(r.categoria, c) : claseGasto(r.categoria, c)
    const tags = [...new Set([...clase.tags, ...etiquetas(r.categoria, comentario)])]

    // §4 — el reembolso viaja aparte; los totales usan el neto.
    const refundArs = parseMonto(r.reembolsar)
    if (refundArs > 0) conReembolso++
    if (clase.category === 'otros') sinCategorizar++
    if (tags.length) conEtiquetas++
    if (detectarCuota(comentario)) cuotasDetectadas++

    if (!min || date < min) min = date
    if (!max || date > max) max = date

    transactions.push({
      id: await idDeFila(r),
      userId,
      type,
      date,
      time: parseHora(r.fecha),
      description: comentario,
      originalAmount: amount,
      currency: 'ARS',
      arsAmount: amount,
      // Meow es todo en pesos: no hay snapshot de cotización que guardar.
      fxRate: null,
      fxType: null,
      fxDate: null,
      category: clase.category,
      subcategory: clase.subcategory,
      paymentMethod: parseMedioPago(r.activo),
      // El reembolso nunca puede superar el monto: lo impide un check en la base.
      refundArs: Math.min(refundArs, amount),
      // Las etiquetas todavía no tienen tabla propia (iteración 1). Se guardan acá
      // para no perderlas; cuando exista `tags`, se migran con un update y se limpian.
      notes: tags.length ? tags.map((t) => `#${t}`).join(' ') : null,
      source: 'meow_import',
      createdAt: ahora,
      updatedAt: ahora,
      deletedAt: null,
      _dirty: 1,
    })
  }

  return {
    transactions,
    descartadas,
    stats: {
      filas: rows.length,
      importadas: transactions.length,
      gastos: transactions.filter((t) => t.type === 'expense').length,
      ingresos: transactions.filter((t) => t.type === 'income').length,
      descartadas: descartadas.length,
      porMotivo,
      sinCategorizar,
      conReembolso,
      conEtiquetas,
      cuotasDetectadas,
      rango: min && max ? { desde: min, hasta: max } : null,
    },
  }
}
