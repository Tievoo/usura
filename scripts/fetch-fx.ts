/**
 * Cotización del día -> tabla `fx_rates` de Supabase. Lo corre GitHub Actions
 * dos veces por día (`.github/workflows/fx-rates.yml`).
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... bun run fx:fetch
 *
 * Hace dos cosas a la vez:
 *
 * 1. Llena el histórico de cotizaciones del lado del servidor. En `fx_rates`
 *    escribe solo la secret key: para el cliente la tabla es de solo lectura, y
 *    hoy cada navegador se arma su propia copia local contra dolarapi.
 * 2. Es la actividad que mantiene despierto el proyecto. Supabase pausa los
 *    proyectos del plan gratis después de 7 días con poca actividad de base, y
 *    un `pg_cron` adentro del propio proyecto no alcanza: el request tiene que
 *    entrar de afuera, por la API.
 *
 * Si algo falla, sale con código 1 a propósito: acá no rige «una API caída no
 * bloquea el alta», que es una regla de la UI. Un cron que falla en silencio es
 * peor que no tenerlo, porque te enterás cuando el proyecto ya está pausado.
 */

import { createClient } from '@supabase/supabase-js'
import { fetchDolarApi } from '../src/lib/dolarapi'
import { format, toNumeric } from '../src/lib/money'

const url = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY

if (!url || !secretKey) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SECRET_KEY en el entorno.')
  process.exit(1)
}

const fail = (msg: string, detail?: unknown): never => {
  console.error(msg, detail ?? '')
  process.exit(1)
}

// La fecha sale de la hora local del proceso, así que el workflow fija
// TZ=America/Argentina/Buenos_Aires. En UTC, una corrida de la noche quedaría
// registrada con la fecha del día siguiente.
const rate = await fetchDolarApi(15_000).catch((e) => fail('No se pudo traer la cotización de dolarapi.', e))

const supabase = createClient(url, secretKey, { auth: { persistSession: false } })

const { error } = await supabase.from('fx_rates').upsert(
  {
    date: rate.date,
    official_buy: toNumeric(rate.officialBuy),
    official_sell: toNumeric(rate.officialSell),
    blue: rate.blue === null ? null : toNumeric(rate.blue),
    mep: rate.mep === null ? null : toNumeric(rate.mep),
    crypto: rate.crypto === null ? null : toNumeric(rate.crypto),
    provider: rate.provider,
    fetched_at: rate.fetchedAt,
  },
  { onConflict: 'date' },
)

if (error) fail('No se pudo escribir fx_rates.', error)

console.log(`${rate.date} · oficial ${format(rate.officialSell)} · mep ${rate.mep ? format(rate.mep) : '—'}`)
