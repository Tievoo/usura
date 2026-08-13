import { supabase, type FilaMovimiento } from './supabase'
import { db, escribirMeta, leerMeta } from './db'
import { aNumeric, desdeNumeric } from './plata'
import type { FxTipo, MedioPago, Moneda, Movimiento, Origen, Tipo } from './tipos'

/**
 * Sincronización. Local siempre primero: la UI escribe en Dexie y sigue, y esto
 * corre en segundo plano. Nada de acá puede bloquear ni romper el alta de un gasto.
 *
 * Resolución de conflictos: last-write-wins por updated_at. Alcanza porque nadie
 * escribe filas de otro: los conflictos posibles son solo entre dispositivos
 * de la misma persona.
 */

const CLAVE_ULTIMO_PULL = 'ultimoPull'

/* ---------- mapeo ---------- */

function aFila(m: Movimiento): FilaMovimiento {
  return {
    id: m.id,
    user_id: m.userId,
    tipo: m.tipo,
    fecha: m.fecha,
    concepto: m.concepto,
    monto_original: aNumeric(m.montoOriginal),
    moneda: m.moneda,
    monto_ars: aNumeric(m.montoArs),
    fx_valor: m.fxValor === null ? null : aNumeric(m.fxValor),
    fx_tipo: m.fxTipo,
    fx_fecha: m.fxFecha,
    categoria: m.categoria,
    subcategoria: m.subcategoria,
    medio_pago: m.medioPago,
    reembolso_ars: aNumeric(m.reembolsoArs),
    notas: m.notas,
    origen: m.origen,
    created_at: m.createdAt,
    updated_at: m.updatedAt,
    deleted_at: m.deletedAt,
  }
}

function deFila(f: FilaMovimiento): Movimiento {
  return {
    id: f.id,
    userId: f.user_id,
    tipo: f.tipo as Tipo,
    fecha: f.fecha,
    concepto: f.concepto,
    montoOriginal: desdeNumeric(f.monto_original),
    moneda: f.moneda as Moneda,
    montoArs: desdeNumeric(f.monto_ars),
    fxValor: f.fx_valor === null ? null : desdeNumeric(f.fx_valor),
    fxTipo: f.fx_tipo as FxTipo | null,
    fxFecha: f.fx_fecha,
    categoria: f.categoria,
    subcategoria: f.subcategoria,
    medioPago: f.medio_pago as MedioPago,
    reembolsoArs: desdeNumeric(f.reembolso_ars),
    notas: f.notas,
    origen: f.origen as Origen,
    createdAt: f.created_at,
    updatedAt: f.updated_at,
    deletedAt: f.deleted_at,
    _dirty: 0,
  }
}

/* ---------- push ---------- */

async function empujar(): Promise<void> {
  const sucios = await db.movimientos.where('_dirty').equals(1).toArray()
  if (!sucios.length) return

  // En tandas: una lista de 1.152 movimientos importados no entra en un solo request.
  const TANDA = 200
  for (let i = 0; i < sucios.length; i += TANDA) {
    const tanda = sucios.slice(i, i + TANDA)
    const { error } = await supabase.from('movimientos').upsert(tanda.map(aFila), { onConflict: 'id' })
    if (error) throw new Error(error.message)
    // Solo se limpia lo que efectivamente subió; si algo se editó mientras
    // viajaba, su updatedAt cambió y vuelve a marcarse sucio en el próximo put.
    await db.transaction('rw', db.movimientos, async () => {
      for (const m of tanda) {
        const actual = await db.movimientos.get(m.id)
        if (actual && actual.updatedAt === m.updatedAt) {
          await db.movimientos.update(m.id, { _dirty: 0 })
        }
      }
    })
  }
}

/* ---------- pull ---------- */

async function traer(): Promise<void> {
  const desde = (await leerMeta(CLAVE_ULTIMO_PULL)) ?? '1970-01-01T00:00:00Z'

  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .gt('updated_at', desde)
    .order('updated_at', { ascending: true })
    .limit(1000)

  if (error) throw new Error(error.message)
  if (!data?.length) return

  const remotos = (data as FilaMovimiento[]).map(deFila)

  await db.transaction('rw', db.movimientos, async () => {
    for (const r of remotos) {
      const local = await db.movimientos.get(r.id)
      // El local sucio y más nuevo gana: todavía no subió y no queremos pisarlo.
      if (local?._dirty === 1 && local.updatedAt >= r.updatedAt) continue
      await db.movimientos.put(r)
    }
  })

  const ultimo = remotos[remotos.length - 1]
  if (ultimo) await escribirMeta(CLAVE_ULTIMO_PULL, ultimo.updatedAt)
}

/* ---------- orquestación ---------- */

let corriendo = false
type Escucha = (e: { sincronizando: boolean; error: string | null }) => void
const escuchas = new Set<Escucha>()

export function alSincronizar(f: Escucha): () => void {
  escuchas.add(f)
  return () => escuchas.delete(f)
}

const avisar = (sincronizando: boolean, error: string | null) => {
  for (const f of escuchas) f({ sincronizando, error })
}

export async function sincronizar(): Promise<void> {
  if (corriendo || !navigator.onLine) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return

  corriendo = true
  avisar(true, null)
  try {
    await empujar()
    await traer()
    avisar(false, null)
  } catch (e) {
    // Un fallo de sync no es un error del usuario: se reintenta y se avisa sin drama.
    avisar(false, e instanceof Error ? e.message : 'Error de sincronización')
  } finally {
    corriendo = false
  }
}

/** Arranca los disparadores: al volver la red, al volver a la pestaña, y cada 2 minutos. */
export function iniciarSync(): () => void {
  const disparar = () => void sincronizar()

  window.addEventListener('online', disparar)
  const alVolver = () => { if (document.visibilityState === 'visible') disparar() }
  document.addEventListener('visibilitychange', alVolver)
  const intervalo = window.setInterval(disparar, 120_000)

  disparar()

  return () => {
    window.removeEventListener('online', disparar)
    document.removeEventListener('visibilitychange', alVolver)
    window.clearInterval(intervalo)
  }
}
