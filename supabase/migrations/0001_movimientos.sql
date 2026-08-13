-- Usura — iteración 1
-- Movimientos y cotizaciones, con RLS en la misma migración que la tabla.
-- Ver docs/ESPECIFICACION.md §3 y §8.

create extension if not exists pgcrypto;

-- ============================================================
-- movimientos
-- ============================================================

create table if not exists public.movimientos (
  id              uuid primary key default gen_random_uuid(),

  -- El eje del aislamiento. Se toma del token, nunca de lo que manda el cliente.
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,

  tipo            text not null check (tipo in ('gasto', 'ingreso')),
  fecha           date not null,
  concepto        text not null default '',

  -- Dinero en numeric(14,2). Nunca float.
  monto_original  numeric(14,2) not null check (monto_original >= 0),
  moneda          text not null check (moneda in ('ARS', 'USD')),

  -- Snapshot inmutable: se escribe una vez y no se recalcula nunca, ni al
  -- corregir la fuente de datos. Ver el trigger de más abajo.
  monto_ars       numeric(14,2) not null check (monto_ars >= 0),
  fx_valor        numeric(14,2) check (fx_valor > 0),
  fx_tipo         text check (fx_tipo in ('oficial', 'blue', 'mep', 'cripto', 'manual')),
  fx_fecha        date,

  -- Slug estable de docs/CATEGORIAS.md. Cuando exista la tabla de categorías por
  -- usuario, se cuelga de este slug para pisar nombre/color/orden: la columna no migra.
  categoria       text not null,
  subcategoria    text,

  medio_pago      text not null check (medio_pago in ('mercadopago', 'efectivo', 'credito')),

  -- Parte que te devolvieron. Los totales usan monto_ars - reembolso_ars.
  reembolso_ars   numeric(14,2) not null default 0 check (reembolso_ars >= 0),

  notas           text,
  origen          text not null default 'manual'
                    check (origen in ('manual', 'recurrente', 'import_meow', 'splitwise')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Borrado lógico: si borráramos la fila, el borrado no se propagaría al otro dispositivo.
  deleted_at      timestamptz,

  constraint reembolso_no_supera_monto check (reembolso_ars <= monto_ars),
  -- Un gasto en dólares sin cotización es válido (API caída) y queda pendiente de convertir,
  -- pero si trae cotización tiene que traer también tipo y fecha.
  constraint fx_completo check (
    (fx_valor is null and fx_tipo is null and fx_fecha is null)
    or (fx_valor is not null and fx_tipo is not null and fx_fecha is not null)
  ),
  constraint fx_solo_en_usd check (moneda = 'USD' or fx_valor is null)
);

-- La consulta de la app es "el mes de este usuario"; el pull de sync usa updated_at.
create index if not exists movimientos_user_fecha_idx
  on public.movimientos (user_id, fecha desc)
  where deleted_at is null;

create index if not exists movimientos_user_updated_idx
  on public.movimientos (user_id, updated_at);

-- ---- updated_at y protección del snapshot ----

create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace trigger movimientos_updated_at
  before update on public.movimientos
  for each row execute function public.tocar_updated_at();

-- El snapshot de cotización es inmutable por regla del proyecto. Esto lo hace
-- cumplir en la base, no solo en el cliente.
create or replace function public.fx_inmutable()
returns trigger language plpgsql as $$
begin
  -- Se permite completar una conversión pendiente (era null), nunca cambiarla.
  if old.fx_valor is not null and new.fx_valor is distinct from old.fx_valor then
    raise exception 'fx_valor es inmutable: no se recalcula una cotización ya guardada';
  end if;
  if old.monto_ars > 0 and new.monto_ars is distinct from old.monto_ars
     and old.moneda = 'USD' and old.fx_valor is not null then
    raise exception 'monto_ars es inmutable en movimientos en dólares ya convertidos';
  end if;
  return new;
end $$;

create or replace trigger movimientos_fx_inmutable
  before update on public.movimientos
  for each row execute function public.fx_inmutable();

-- ---- RLS ----

alter table public.movimientos enable row level security;

create policy "solo el dueño" on public.movimientos
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- fx_rates — la única tabla sin user_id
-- La cotización del dólar es dato del mundo, no de una persona.
-- ============================================================

create table if not exists public.fx_rates (
  fecha           date primary key,
  oficial_compra  numeric(14,2) not null,
  oficial_venta   numeric(14,2) not null,
  blue            numeric(14,2),
  mep             numeric(14,2),
  cripto          numeric(14,2),
  fuente          text not null,
  fetched_at      timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

create policy "lectura para cualquier autenticado" on public.fx_rates
  for select to authenticated using (true);

-- Sin política de insert/update/delete a propósito: acá escribe solo la secret key
-- desde el cron que trae las cotizaciones.

-- ============================================================
-- Cierre del rol anónimo
-- No hay nada público en Usura. El login pasa por la Auth API, no por PostgREST,
-- así que esto no rompe el magic link.
-- ============================================================

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
