-- La tienda la editan dirección y el rol «equipo» (antes solo dirección).
-- Requiere 20261124040000_rol_equipo.sql y 20261124060000_tienda.sql.
-- Se puede ejecutar más de una vez.

create or replace function public.puede_editar_tienda()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual()::text in ('admin', 'equipo'), false) $$;

revoke execute on function public.puede_editar_tienda() from public, anon;
grant execute on function public.puede_editar_tienda() to authenticated;

-- Productos
drop policy if exists tienda_productos_ver_equipo on public.tienda_productos;
create policy tienda_productos_ver_equipo on public.tienda_productos for select to authenticated
  using (visible or public.puede_editar_tienda());

drop policy if exists tienda_productos_admin on public.tienda_productos;
create policy tienda_productos_admin on public.tienda_productos for all to authenticated
  using (public.puede_editar_tienda()) with check (public.puede_editar_tienda());

-- Contacto y compra
drop policy if exists tienda_ajustes_admin on public.tienda_ajustes;
create policy tienda_ajustes_admin on public.tienda_ajustes for update to authenticated
  using (public.puede_editar_tienda()) with check (public.puede_editar_tienda());

-- Fotos
drop policy if exists tienda_fotos_ver on storage.objects;
create policy tienda_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'tienda' and public.puede_editar_tienda());
drop policy if exists tienda_fotos_subir on storage.objects;
create policy tienda_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'tienda' and public.puede_editar_tienda());
drop policy if exists tienda_fotos_cambiar on storage.objects;
create policy tienda_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'tienda' and public.puede_editar_tienda()) with check (bucket_id = 'tienda' and public.puede_editar_tienda());
drop policy if exists tienda_fotos_borrar on storage.objects;
create policy tienda_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'tienda' and public.puede_editar_tienda());
