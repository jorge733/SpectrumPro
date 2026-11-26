-- Tienda de productos (gestionspectrumpro.cl/tienda/).
--
-- · El público (anon) solo LEE: los productos visibles y los datos de contacto.
-- · Dirección (es_admin()) edita todo desde la plataforma, sección «Tienda».
-- · Las fotos se guardan en el bucket público «tienda» de Storage; solo dirección sube o borra.
-- Se puede ejecutar más de una vez sin duplicar nada.

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------
create table if not exists public.tienda_productos (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text not null default '',
  categoria    text not null default 'accesorios',
  precio       integer,                       -- en pesos chilenos; null = «Consultar precio»
  variantes    text not null default '',      -- tallas, colores… en texto libre
  imagen       text not null default '',      -- URL de la foto (Storage o /tienda/img/…)
  visible      boolean not null default true,
  agotado      boolean not null default false,
  orden        integer not null default 0,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),

  constraint tienda_nombre_largo      check (char_length(trim(nombre)) between 1 and 80),
  constraint tienda_descripcion_largo check (char_length(descripcion) <= 300),
  constraint tienda_categoria_valida  check (categoria in ('ropa', 'accesorios', 'papeleria')),
  constraint tienda_precio_valido     check (precio is null or precio between 0 and 10000000),
  constraint tienda_variantes_largo   check (char_length(variantes) <= 160),
  constraint tienda_imagen_largo      check (char_length(imagen) <= 500)
);
create index if not exists tienda_productos_orden on public.tienda_productos (orden, nombre);

drop trigger if exists tocar_tienda_productos on public.tienda_productos;
create trigger tocar_tienda_productos before update on public.tienda_productos
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- Datos de contacto y compra (una sola fila, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.tienda_ajustes (
  id           smallint primary key default 1,
  whatsapp     text not null default '56996389673',  -- solo dígitos, con código de país
  instagram    text not null default '',             -- usuario sin @
  pago         text not null default '',
  entrega      text not null default '',
  actualizado  timestamptz not null default now(),

  constraint tienda_ajustes_unica      check (id = 1),
  constraint tienda_whatsapp_formato   check (whatsapp ~ '^[0-9]{8,15}$'),
  constraint tienda_instagram_formato  check (instagram ~ '^[A-Za-z0-9._]{0,30}$'),
  constraint tienda_pago_largo         check (char_length(pago) <= 200),
  constraint tienda_entrega_largo      check (char_length(entrega) <= 200)
);
insert into public.tienda_ajustes (id) values (1) on conflict (id) do nothing;

drop trigger if exists tocar_tienda_ajustes on public.tienda_ajustes;
create trigger tocar_tienda_ajustes before update on public.tienda_ajustes
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.tienda_productos enable row level security;
alter table public.tienda_ajustes enable row level security;

-- El público no puede ejecutar es_admin() (la migración base se lo quita a anon),
-- por eso su regla de lectura es aparte y solo mira «visible».
drop policy if exists tienda_productos_ver on public.tienda_productos;
create policy tienda_productos_ver on public.tienda_productos for select to anon
  using (visible);
drop policy if exists tienda_productos_ver_equipo on public.tienda_productos;
create policy tienda_productos_ver_equipo on public.tienda_productos for select to authenticated
  using (visible or public.es_admin());

drop policy if exists tienda_productos_admin on public.tienda_productos;
create policy tienda_productos_admin on public.tienda_productos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

drop policy if exists tienda_ajustes_ver on public.tienda_ajustes;
create policy tienda_ajustes_ver on public.tienda_ajustes for select to anon, authenticated
  using (true);

drop policy if exists tienda_ajustes_admin on public.tienda_ajustes;
create policy tienda_ajustes_admin on public.tienda_ajustes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

revoke all on public.tienda_productos, public.tienda_ajustes from anon, authenticated;
grant usage on schema public to anon;
grant select on public.tienda_productos, public.tienda_ajustes to anon;
grant select, insert, update, delete on public.tienda_productos to authenticated;
grant select, update on public.tienda_ajustes to authenticated;
grant all on public.tienda_productos, public.tienda_ajustes to service_role;

-- Cada cambio queda en la auditoría, como el resto de la plataforma.
drop trigger if exists auditar_tienda_productos on public.tienda_productos;
create trigger auditar_tienda_productos after insert or update or delete on public.tienda_productos
  for each row execute function public.auditar();
drop trigger if exists auditar_tienda_ajustes on public.tienda_ajustes;
create trigger auditar_tienda_ajustes after update on public.tienda_ajustes
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------------
-- Fotos: bucket público «tienda» (máx. 3 MB, solo imágenes)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tienda', 'tienda', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tienda_fotos_ver on storage.objects;
create policy tienda_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'tienda' and public.es_admin());
drop policy if exists tienda_fotos_subir on storage.objects;
create policy tienda_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'tienda' and public.es_admin());
drop policy if exists tienda_fotos_cambiar on storage.objects;
create policy tienda_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'tienda' and public.es_admin()) with check (bucket_id = 'tienda' and public.es_admin());
drop policy if exists tienda_fotos_borrar on storage.objects;
create policy tienda_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'tienda' and public.es_admin());

-- ---------------------------------------------------------------------------
-- Productos iniciales (los del sitio de Google), solo si la tabla está vacía
-- ---------------------------------------------------------------------------
insert into public.tienda_productos (nombre, descripcion, categoria, variantes, imagen, orden)
select * from (values
  ('Poleras unisex',   'Con el logo de SpectrumPro adelante y atrás.',            'ropa',       'Negra y roja',                 '/tienda/img/poleras.jpg',     1),
  ('Polerón unisex',   'Con el logo pequeño adelante y grande en la espalda.',    'ropa',       'Gris',                         '/tienda/img/poleron.jpg',     2),
  ('Tazón y chapita',  'Edición Muestra Audiovisual 2026.',                       'accesorios', '',                             '/tienda/img/tazon.jpg',       3),
  ('Calendarios',      'De escritorio.',                                          'papeleria',  'A color o en blanco y negro',  '/tienda/img/calendarios.jpg', 4),
  ('Cuadernos',        'Con el logo o con Pipripiolo para colorear.',             'papeleria',  'Logo o Pipripiolo',            '/tienda/img/cuadernos.jpg',   5),
  ('Chapitas',         'Con los logos de SpectrumPro.',                           'accesorios', 'Negra o a color',              '/tienda/img/chapitas.jpg',    6),
  ('Bolso blanco',     'Tote bag con el logo de SpectrumPro en negro.',           'accesorios', '',                             '/tienda/img/bolso.jpg',       7),
  ('Morral negro',     'Mochila de cuerdas con el logo en blanco.',               'accesorios', '',                             '/tienda/img/morral.jpg',      8)
) as v (nombre, descripcion, categoria, variantes, imagen, orden)
where not exists (select 1 from public.tienda_productos);
