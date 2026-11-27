-- El sitio web público (spectrumpro.cl) lo edita solo dirección.
--
-- · puede_editar_sitio(): pasa a ser solo 'admin'. Con eso, textos, listas, fotos del sitio
--   (cambiar y borrar) y PDF del bucket «documentos» quedan solo para dirección.
-- · Comunidad (boletines y suscriptores) sigue siendo de dirección y el rol Equipo, con la
--   nueva función puede_gestionar_comunidad().
-- · Las imágenes de los boletines se suben al bucket «sitio», así que el rol Equipo puede
--   seguir SUBIENDO imágenes nuevas ahí (no cambia ni borra las existentes ni edita el sitio).
-- Requiere 20261127020000_sitio_web.sql y 20261129000000_comunidad.sql. Se puede ejecutar más de una vez.

create or replace function public.puede_editar_sitio()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual()::text = 'admin', false) $$;

create or replace function public.puede_gestionar_comunidad()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual()::text in ('admin', 'equipo'), false) $$;

revoke execute on function public.puede_gestionar_comunidad() from public, anon;
grant execute on function public.puede_gestionar_comunidad() to authenticated;

-- Suscriptores
drop policy if exists suscriptores_ver on public.suscriptores;
create policy suscriptores_ver on public.suscriptores for select to authenticated
  using (public.puede_gestionar_comunidad());
drop policy if exists suscriptores_baja on public.suscriptores;
create policy suscriptores_baja on public.suscriptores for update to authenticated
  using (public.puede_gestionar_comunidad()) with check (public.puede_gestionar_comunidad() and estado = 'baja');
drop policy if exists suscriptores_eliminar on public.suscriptores;
create policy suscriptores_eliminar on public.suscriptores for delete to authenticated
  using (public.puede_gestionar_comunidad());

-- Boletines
drop policy if exists boletines_ver_equipo on public.boletines;
create policy boletines_ver_equipo on public.boletines for select to authenticated
  using ((publico and estado = 'enviado') or public.puede_gestionar_comunidad());
drop policy if exists boletines_editar on public.boletines;
create policy boletines_editar on public.boletines for all to authenticated
  using (public.puede_gestionar_comunidad()) with check (public.puede_gestionar_comunidad());

-- Bucket «sitio»: el rol Equipo solo sube imágenes nuevas (para los boletines).
drop policy if exists sitio_fotos_subir on storage.objects;
create policy sitio_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'sitio' and public.puede_gestionar_comunidad());
