-- Usura — iteración 1
-- Transacciones y cotizaciones, con RLS en la misma migración que la tabla.
-- Ver docs/ESPECIFICACION.md §3 y §8.
--
-- Identificadores en inglés; los slugs de categoría siguen en castellano a
-- propósito (ver src/data/categories.ts), igual que todo el texto de la UI.

create extension if not exists pgcrypto;

-- ============================================================
-- transactions
-- ============================================================

create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),

  -- El eje del aislamiento. Se toma del token, nunca de lo que manda el cliente.
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,

  type            text not null check (type in ('expense', 'income')),
  date            date not null,
  description     text not null default '',

  -- Dinero en numeric(14,2). Nunca float.
  original_amount numeric(14,2) not null check (original_amount >= 0),
  currency        text not null check (currency in ('ARS', 'USD')),

  -- Snapshot inmutable: se escribe una vez y no se recalcula nunca, ni al
  -- corregir la fuente de datos. Ver el trigger de más abajo.
  ars_amount      numeric(14,2) not null check (ars_amount >= 0),
  fx_rate         numeric(14,2) check (fx_rate > 0),
  fx_type         text check (fx_type in ('official', 'blue', 'mep', 'crypto', 'manual')),
  fx_date         date,

  -- Slug estable de docs/CATEGORIAS.md, en castellano. Cuando exista la tabla de
  -- categorías por usuario, se cuelga de este slug para pisar nombre/color/orden:
  -- la columna no migra.
  category        text not null,
  subcategory     text,

  payment_method  text not null check (payment_method in ('mercadopago', 'cash', 'credit')),

  -- Parte que te devolvieron. Los totales usan ars_amount - refund_ars.
  refund_ars      numeric(14,2) not null default 0 check (refund_ars >= 0),

  notes           text,
  source          text not null default 'manual'
                    check (source in ('manual', 'recurring', 'meow_import', 'splitwise')),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Borrado lógico: si borráramos la fila, el borrado no se propagaría al otro dispositivo.
  deleted_at      timestamptz,

  constraint refund_within_amount check (refund_ars <= ars_amount),
  -- Un gasto en dólares sin cotización es válido (API caída) y queda pendiente de convertir,
  -- pero si trae cotización tiene que traer también tipo y fecha.
  constraint fx_complete check (
    (fx_rate is null and fx_type is null and fx_date is null)
    or (fx_rate is not null and fx_type is not null and fx_date is not null)
  ),
  constraint fx_only_for_usd check (currency = 'USD' or fx_rate is null)
);

-- La consulta de la app es "el mes de este usuario"; el pull de sync usa updated_at.
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc)
  where deleted_at is null;

create index if not exists transactions_user_updated_idx
  on public.transactions (user_id, updated_at);

-- ---- updated_at y protección del snapshot ----

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- El snapshot de cotización es inmutable por regla del proyecto. Esto lo hace
-- cumplir en la base, no solo en el cliente.
create or replace function public.fx_immutable()
returns trigger language plpgsql as $$
begin
  -- Se permite completar una conversión pendiente (era null), nunca cambiarla.
  if old.fx_rate is not null and new.fx_rate is distinct from old.fx_rate then
    raise exception 'fx_rate es inmutable: no se recalcula una cotización ya guardada';
  end if;
  if old.ars_amount > 0 and new.ars_amount is distinct from old.ars_amount
     and old.currency = 'USD' and old.fx_rate is not null then
    raise exception 'ars_amount es inmutable en transacciones en dólares ya convertidas';
  end if;
  return new;
end $$;

create or replace trigger transactions_fx_immutable
  before update on public.transactions
  for each row execute function public.fx_immutable();

-- ---- RLS ----

alter table public.transactions enable row level security;

create policy "owner only" on public.transactions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- fx_rates — la única tabla sin user_id
-- La cotización del dólar es dato del mundo, no de una persona.
-- ============================================================

create table if not exists public.fx_rates (
  date            date primary key,
  official_buy    numeric(14,2) not null,
  official_sell   numeric(14,2) not null,
  blue            numeric(14,2),
  mep             numeric(14,2),
  crypto          numeric(14,2),
  -- Quién dio el dato ('dolarapi.com'). No es el `source` de transactions,
  -- que dice cómo se creó el registro; por eso no comparten nombre.
  provider        text not null,
  fetched_at      timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

create policy "read for authenticated" on public.fx_rates
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
