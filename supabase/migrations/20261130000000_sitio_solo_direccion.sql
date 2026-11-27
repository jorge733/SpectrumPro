-- El sitio web público (spectrumpro.cl) y la Comunidad los gestiona solo dirección.
--
-- · puede_editar_sitio() pasa a ser solo 'admin'. Con eso quedan solo para dirección: textos,
--   listas y fotos del sitio, PDF del bucket «documentos», boletines y suscriptores.
-- · El rol Equipo sigue editando la tienda (eso no cambia).
-- · La función enviar-boletin también exige dirección: vuelve a desplegarla
--   (supabase functions deploy enviar-boletin, o pega supabase/funciones-panel/enviar-boletin.ts en el panel).
-- Requiere 20261127020000_sitio_web.sql y 20261129000000_comunidad.sql. Se puede ejecutar más de una vez.

create or replace function public.puede_editar_sitio()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual()::text = 'admin', false) $$;

-- Las políticas de la Comunidad y del bucket «sitio» usan puede_editar_sitio(). Se recrean por si
-- se ejecutó una versión anterior de esta migración que las cambiaba a puede_gestionar_comunidad().
drop policy if exists suscriptores_ver on public.suscriptores;
create policy suscriptores_ver on public.suscriptores for select to authenticated
  using (public.puede_editar_sitio());
drop policy if exists suscriptores_baja on public.suscriptores;
create policy suscriptores_baja on public.suscriptores for update to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio() and estado = 'baja');
drop policy if exists suscriptores_eliminar on public.suscriptores;
create policy suscriptores_eliminar on public.suscriptores for delete to authenticated
  using (public.puede_editar_sitio());

drop policy if exists boletines_ver_equipo on public.boletines;
create policy boletines_ver_equipo on public.boletines for select to authenticated
  using ((publico and estado = 'enviado') or public.puede_editar_sitio());
drop policy if exists boletines_editar on public.boletines;
create policy boletines_editar on public.boletines for all to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio());

drop policy if exists sitio_fotos_subir on storage.objects;
create policy sitio_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'sitio' and public.puede_editar_sitio());

drop function if exists public.puede_gestionar_comunidad();
