-- Programa del taller en PDF.
-- Cada taller puede tener un archivo PDF con su programa, guardado en Supabase Storage
-- (bucket privado "programas"). Todo el equipo activo lo puede ver; solo dirección lo sube o lo quita.

-- 1. Dónde está el archivo y con qué nombre se subió.
alter table public.talleres
  add column if not exists programa_pdf    text,
  add column if not exists programa_nombre text not null default '';

-- 2. Bucket privado: solo PDF y hasta 10 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('programas', 'programas', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- 3. Permisos sobre los archivos (los archivos se guardan como <id del taller>/<marca de tiempo>.pdf).
drop policy if exists programas_ver on storage.objects;
drop policy if exists programas_subir on storage.objects;
drop policy if exists programas_editar on storage.objects;
drop policy if exists programas_borrar on storage.objects;

create policy programas_ver on storage.objects for select to authenticated
  using (bucket_id = 'programas' and public.rol_actual() is not null);
create policy programas_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'programas' and public.es_admin());
create policy programas_editar on storage.objects for update to authenticated
  using (bucket_id = 'programas' and public.es_admin())
  with check (bucket_id = 'programas' and public.es_admin());
create policy programas_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'programas' and public.es_admin());
