-- Cada persona del equipo puede guardar su propia fecha de nacimiento.
-- La tabla perfiles solo la edita dirección (RLS), así que se usa una función
-- que cambia únicamente la columna fecha_nac de la cuenta conectada.
create or replace function public.guardar_mi_fecha_nac(p_fecha date)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if public.rol_actual() is null then
    raise exception 'Tu cuenta no está activa.' using errcode = '42501';
  end if;
  if p_fecha is not null and p_fecha > public.hoy_chile() then
    raise exception 'La fecha de nacimiento no puede ser futura.' using errcode = 'P0001';
  end if;
  update public.perfiles set fecha_nac = p_fecha where id = auth.uid();
end $$;

revoke execute on function public.guardar_mi_fecha_nac(date) from public, anon;
grant execute on function public.guardar_mi_fecha_nac(date) to authenticated;
