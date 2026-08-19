-- Permisos de tabla para `authenticated`.
--
-- Por qué existe este archivo: RLS no concede nada, solo filtra filas dentro de
-- un permiso que ya tiene que existir. Los proyectos nuevos de Supabase ya no
-- reparten DML a `authenticated` por default —sus default privileges sobre
-- `public` son REFERENCES, TRIGGER, TRUNCATE, MAINTAIN y nada más—, así que una
-- tabla con RLS y política impecables igual devuelve `permission denied` hasta
-- que se otorga el grant a mano.
--
-- Regla para toda tabla nueva: RLS + política + grant, los tres en la misma
-- migración que la tabla. Ver docs/ESPECIFICACION.md §8.

-- Sin `delete` a propósito: el borrado de Usura es lógico (`deleted_at`), y no
-- dárselo al rol del cliente hace que la regla no dependa solo del código.
grant select, insert, update on public.transactions to authenticated;

-- Solo lectura: la cotización es dato del mundo y acá el cliente no escribe.
grant select on public.fx_rates to authenticated;

-- El cron que trae las cotizaciones corre con la secret key (`service_role`).
-- Bypassea RLS, pero el grant de tabla lo necesita igual.
grant select, insert, update on public.fx_rates to service_role;
