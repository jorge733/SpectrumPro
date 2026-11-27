-- Mejoras de talleres (noviembre 2026):
--   · correo de la persona a cargo,
--   · programa escrito (pestaña «Programa»; el PDF sigue siendo opcional),
--   · material promocional (afiches) en un bucket privado «afiches»,
--   · orden inicial por área: FormaPro (Formación general) → Centro de Formación → Mentorías
--     → SpectrumOnline → Terapia Ocupacional → Arte y Apoyo.
-- Se puede volver a ejecutar sin romper nada.

-- 1. Campos nuevos.
alter table public.talleres
  add column if not exists encargado_email text not null default '',
  add column if not exists programa_texto  text not null default '',
  add column if not exists afiches         jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.talleres add constraint talleres_encargado_email_formato
    check (encargado_email = '' or encargado_email ~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+(\s*[,;]\s*[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+)*$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.talleres add constraint talleres_afiches_lista check (jsonb_typeof(afiches) = 'array');
exception when duplicate_object then null; end $$;

-- 2. Orden inicial: se agrupan por área y, dentro de cada área, se respeta el orden que ya tenían.
--    (Solo la primera vez: si ya se reordenó desde la plataforma, no se toca.)
do $$ begin
  if not exists (select 1 from public.auditoria where tabla = 'talleres' and detalle ->> 'nota' = 'orden por area 2026-11') then
    with rangos as (
      select id, row_number() over (
        order by case area
          when 'Formación general'   then 0
          when 'Centro de Formación' then 1
          when 'Mentorías'           then 2
          when 'SpectrumOnline'      then 3
          when 'Terapia Ocupacional' then 4
          when 'Arte y Apoyo'        then 5
          else 6 end, orden, nombre) as n
      from public.talleres
    )
    update public.talleres t set orden = r.n from rangos r where r.id = t.id and t.orden is distinct from r.n;
    insert into public.auditoria (actor_nombre, accion, tabla, registro, detalle)
    values ('sistema', 'update', 'talleres', '', jsonb_build_object('nota', 'orden por area 2026-11'));
  end if;
end $$;

-- 3. Bucket privado de afiches: imágenes y PDF, hasta 10 MB cada uno.
--    Los archivos se guardan como <id del taller>/<marca de tiempo>-<azar>.<ext>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('afiches', 'afiches', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists afiches_ver on storage.objects;
drop policy if exists afiches_subir on storage.objects;
drop policy if exists afiches_editar on storage.objects;
drop policy if exists afiches_borrar on storage.objects;

create policy afiches_ver on storage.objects for select to authenticated
  using (bucket_id = 'afiches' and public.rol_actual() is not null);
create policy afiches_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'afiches' and public.es_admin());
create policy afiches_editar on storage.objects for update to authenticated
  using (bucket_id = 'afiches' and public.es_admin())
  with check (bucket_id = 'afiches' and public.es_admin());
create policy afiches_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'afiches' and public.es_admin());
