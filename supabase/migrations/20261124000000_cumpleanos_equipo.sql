-- Cumpleaños del equipo (profesores y profesoras): fecha de nacimiento en el perfil.
-- La fija dirección al invitar o editar una cuenta. Es opcional.
alter table public.perfiles
  add column if not exists fecha_nac date check (fecha_nac is null or fecha_nac > date '1900-01-01');

-- Proyección mínima para todo el equipo activo: solo nombre y fecha.
-- (Los perfiles solo los lee dirección por RLS; esta función no expone nada más.)
create or replace function public.cumpleanos_equipo()
returns table (id uuid, nombre text, fecha_nac date)
language sql stable security definer set search_path = ''
as $$
  select p.id, coalesce(nullif(p.nombre, ''), p.email), p.fecha_nac
  from public.perfiles p
  where public.rol_actual() is not null and p.activo and p.rol is not null and p.fecha_nac is not null
  order by extract(month from p.fecha_nac), extract(day from p.fecha_nac)
$$;

revoke execute on function public.cumpleanos_equipo() from public, anon;
grant execute on function public.cumpleanos_equipo() to authenticated;
