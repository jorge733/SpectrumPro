-- Estudio de posts: posts de Instagram armados con las plantillas de la marca
-- (sección «Posts» de la plataforma). Solo dirección (es_admin()) puede verlos,
-- crearlos, editarlos y borrarlos.
--
-- · public.posts guarda cada post: título, formato y las láminas en «datos» (jsonb).
--   Las fotos no van en la tabla: «datos» guarda la ruta dentro del bucket «posts».
-- · Bucket privado «posts» de Storage: una carpeta por post (<id del post>/<foto>.jpg).

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null default 'Post sin título',
  formato     text not null default 'post',
  datos       jsonb not null default '{}'::jsonb,
  miniatura   text,
  creado_por  uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),

  constraint posts_titulo_largo    check (char_length(titulo) between 1 and 140),
  constraint posts_formato_valido  check (formato in ('post', 'cuadrado', 'historia')),
  constraint posts_miniatura_largo check (miniatura is null or (miniatura like 'data:image/%' and char_length(miniatura) <= 300000)),
  constraint posts_datos_tamano    check (pg_column_size(datos) <= 1000000)
);

create index if not exists posts_actualizado on public.posts (actualizado desc);

drop trigger if exists posts_actualizado on public.posts;
create trigger posts_actualizado before update on public.posts
  for each row execute function public.tocar_actualizado();

alter table public.posts enable row level security;

drop policy if exists posts_admin on public.posts;
create policy posts_admin on public.posts for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.posts from anon, authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;

-- ---------------------------------------------------------------------------
-- Fotos de los posts (Storage)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posts', 'posts', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists posts_fotos_ver on storage.objects;
create policy posts_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'posts' and public.es_admin());

drop policy if exists posts_fotos_subir on storage.objects;
create policy posts_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and public.es_admin());

drop policy if exists posts_fotos_editar on storage.objects;
create policy posts_fotos_editar on storage.objects for update to authenticated
  using (bucket_id = 'posts' and public.es_admin())
  with check (bucket_id = 'posts' and public.es_admin());

drop policy if exists posts_fotos_borrar on storage.objects;
create policy posts_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and public.es_admin());
