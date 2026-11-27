-- Recordatorio de cumpleaños por correo.
-- Cada mañana (08:00 de Chile en horario de verano, 07:00 en invierno) Supabase llama a la
-- Edge Function «recordatorio-cumpleanos», que avisa por correo de los cumpleaños de HOY y de
-- los que vienen EN 3 DÍAS (jóvenes vigentes y equipo).
-- Lo reciben las cuentas activas que tengan marcado «Recibir el aviso de cumpleaños por correo»
-- (al principio, todas las de dirección). Se cambia en Administración → editar cuenta.
-- Se puede volver a ejecutar sin romper nada.

-- 1. Quién recibe el aviso.
alter table public.perfiles
  add column if not exists aviso_cumple boolean not null default false;

do $$ begin
  if not exists (select 1 from public.perfiles where aviso_cumple) then
    update public.perfiles set aviso_cumple = true where rol = 'admin' and activo;
  end if;
end $$;

-- 2. Clave compartida entre el reloj (pg_cron) y la función, guardada en Vault.
--    Se genera sola la primera vez; nadie tiene que copiarla.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'recordatorio_cumpleanos') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'recordatorio_cumpleanos',
      'Clave con la que pg_cron llama a la función recordatorio-cumpleanos');
  end if;
end $$;

-- La función la consulta para comprobar que la llamada viene del reloj. Solo la clave de servicio puede.
create or replace function public.clave_recordatorio_cumpleanos()
returns text language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'recordatorio_cumpleanos' limit 1 $$;
revoke execute on function public.clave_recordatorio_cumpleanos() from public, anon, authenticated;
grant execute on function public.clave_recordatorio_cumpleanos() to service_role;

-- 3. El reloj: todos los días a las 11:00 UTC.
select cron.schedule(
  'recordatorio-cumpleanos',
  '0 11 * * *',
  $cron$
  select net.http_post(
    url := 'https://wgmbtmakxipuvejfffmt.supabase.co/functions/v1/recordatorio-cumpleanos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-recordatorio', (select decrypted_secret from vault.decrypted_secrets where name = 'recordatorio_cumpleanos' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  )
  $cron$
);
