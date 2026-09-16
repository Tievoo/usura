-- Usura — iteración 3: recurrentes.
--
-- Dos formas del mismo hecho: una **suscripción** (mensual o anual) que sigue
-- hasta que la cortés vos, y una serie de **cuotas** que tiene fin conocido.
-- No son dos tablas: comparten todo salvo si el final existe o no.
--
-- La serie no es dueña de sus instancias. Cada movimiento generado es un
-- movimiento común y corriente: se edita, se archiva y se cuenta en el total del
-- mes como cualquier otro. Editar la serie no reescribe el pasado.
--
-- RLS + política + grant, los tres acá. Ver docs/ESPECIFICACION.md §8.

-- ============================================================
-- recurring_rules
-- ============================================================

create table if not exists public.recurring_rules (
  id                 uuid primary key default gen_random_uuid(),

  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,

  type               text not null check (type in ('subscription', 'installments')),
  description        text not null,

  -- Lo que se paga **cada vez**, no el total de la serie. En cuotas, el total es
  -- amount * installments_total y se calcula, no se guarda: un total guardado se
  -- desincroniza del día que corregís el monto de la cuota.
  amount             numeric(14,2) not null check (amount > 0),
  currency           text not null check (currency in ('ARS', 'USD')),

  category           text not null,
  subcategory        text,
  payment_method     text not null check (payment_method in ('mercadopago', 'cash', 'credit')),

  frequency          text not null check (frequency in ('monthly', 'yearly')),
  -- El día del mes en que cae. Se recorta al último día si el mes es más corto:
  -- una suscripción del 31 se cobra el 28 en febrero, no se saltea el mes.
  day_of_month       int not null check (day_of_month between 1 and 31),

  start_date         date not null,
  -- Null = sigue hasta que la cortes. En una suscripción es lo normal, no un
  -- dato faltante; se completa el día que la das de baja.
  end_date           date,
  -- Solo en cuotas. Es lo que le da fin conocido a la serie.
  installments_total int check (installments_total > 0),

  active             boolean not null default true,
  notes              text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,

  constraint end_after_start check (end_date is null or end_date >= start_date),

  -- Una serie de cuotas sin cantidad de cuotas no tiene fin conocido, que es lo
  -- único que la distingue de una suscripción. Y una suscripción con cuotas
  -- totales es una cuota mal cargada.
  constraint installments_shape check (
    (type = 'installments' and installments_total is not null and frequency = 'monthly')
    or (type = 'subscription' and installments_total is null)
  )
);

create index if not exists recurring_rules_user_active_idx
  on public.recurring_rules (user_id, active)
  where deleted_at is null;

create index if not exists recurring_rules_user_updated_idx
  on public.recurring_rules (user_id, updated_at);

create or replace trigger recurring_rules_updated_at
  before update on public.recurring_rules
  for each row execute function public.touch_updated_at();

alter table public.recurring_rules enable row level security;

create policy "owner only" on public.recurring_rules
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin `delete`: el borrado de Usura es lógico.
grant select, insert, update on public.recurring_rules to authenticated;

-- ============================================================
-- transactions: de qué serie viene cada instancia
-- El modelo de §3 ya las tenía previstas; se agregan en la iteración que las usa.
-- ============================================================

alter table public.transactions
  add column if not exists recurring_rule_id uuid references public.recurring_rules (id),
  -- 'YYYY-MM' en las mensuales y las cuotas, 'YYYY' en las anuales. Es el período
  -- que esta instancia cubre, y lo que hace que generar dos veces no duplique.
  add column if not exists recurring_period  text,
  add column if not exists installment_no    int check (installment_no > 0),
  add column if not exists installment_total int check (installment_total > 0);

comment on column public.transactions.recurring_period is
  'Período que cubre la instancia: YYYY-MM mensual/cuotas, YYYY anual. Null si el gasto es suelto.';

-- La clave de idempotencia. El cliente además deriva el `id` de (regla, período)
-- de forma determinística, así que dos dispositivos que generan la misma
-- instancia escriben la misma fila en vez de pelearse; esto es el cinturón.
create unique index if not exists transactions_recurring_period_idx
  on public.transactions (recurring_rule_id, recurring_period)
  where recurring_rule_id is not null;

-- Una instancia sin período no se puede deduplicar, y un período suelto no dice
-- de qué serie viene: o están los dos o no está ninguno.
alter table public.transactions
  drop constraint if exists recurring_complete;
alter table public.transactions
  add constraint recurring_complete check (
    (recurring_rule_id is null and recurring_period is null)
    or (recurring_rule_id is not null and recurring_period is not null)
  );

-- ============================================================
-- El rol anónimo sigue sin nada, también sobre la tabla nueva.
-- ============================================================

revoke all on public.recurring_rules from anon;
