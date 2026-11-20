-- Evita talleres repetidos (por ejemplo, si seed.sql se ejecuta dos veces).
-- 1. Borra los duplicados, conservando el primero creado de cada nombre.
--    Antes mueve a ese primero las inscripciones, el equipo y la asistencia de las copias.
with dup as (
  select id, first_value(id) over (partition by lower(trim(nombre)) order by creado, id) as queda
  from public.talleres
)
, mover_insc as (
  insert into public.inscripciones (alumno_id, taller_id, desde)
  select i.alumno_id, d.queda, i.desde from public.inscripciones i join dup d on d.id = i.taller_id and d.id <> d.queda
  on conflict do nothing returning 1
)
, mover_equipo as (
  insert into public.taller_equipo (taller_id, perfil_id)
  select d.queda, e.perfil_id from public.taller_equipo e join dup d on d.id = e.taller_id and d.id <> d.queda
  on conflict do nothing returning 1
)
, mover_asis as (
  insert into public.asistencia (taller_id, alumno_id, fecha, estado, nota, registrado_por)
  select d.queda, a.alumno_id, a.fecha, a.estado, a.nota, a.registrado_por
  from public.asistencia a join dup d on d.id = a.taller_id and d.id <> d.queda
  on conflict do nothing returning 1
)
delete from public.talleres t using dup d
where t.id = d.id and d.id <> d.queda
  and (select count(*) from mover_insc) >= 0
  and (select count(*) from mover_equipo) >= 0
  and (select count(*) from mover_asis) >= 0;

-- 2. Desde ahora la base de datos rechaza dos talleres con el mismo nombre.
create unique index if not exists talleres_nombre_unico on public.talleres (lower(trim(nombre)));
