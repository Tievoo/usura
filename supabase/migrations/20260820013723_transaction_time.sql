-- Hora del movimiento, separada de la fecha.
--
-- Por qué una columna `time` y no un `timestamptz`: la regla del proyecto es que
-- las fechas son locales y 'YYYY-MM-DD'. Un timestamptz reintroduce justo el bug
-- que esa regla evita —un gasto del 31 a las 23:00 en Buenos Aires cae en el mes
-- siguiente en UTC—, así que la hora viaja al lado, también local.
--
-- Nullable a propósito: el export de Meow la trae, pero un movimiento cargado a
-- mano puede no tenerla y la UI dice «sin hora» en vez de inventar una.

alter table public.transactions
  add column if not exists time time;

comment on column public.transactions.time is
  'Hora local del movimiento, sin timezone. Null = no se sabe.';
