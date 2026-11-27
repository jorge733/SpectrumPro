-- Quita la Comunidad de Supabase (deshace supabase/migrations/20261129000000_comunidad.sql y
-- 20261130000000_comunidad_comentarios.sql).
-- Úsalo solo si el equipo decide no seguir con la Comunidad: BORRA la lista de suscriptores, los
-- boletines, sus comentarios y reacciones. Antes, descarga la lista en la plataforma (Comunidad → Suscriptores → Descargar CSV).
-- El código se quita aparte, revirtiendo el commit «Comunidad…» (ver README, «Comunidad»).
-- No es una migración: se ejecuta a mano en el SQL Editor.

drop view if exists public.boletin_comentarios_publicos;
drop view if exists public.boletin_reacciones_totales;
drop table if exists public.boletin_comentarios;
drop table if exists public.boletin_reacciones;
drop function if exists public.revisar_comentario();
drop table if exists public.boletin_envios;
drop table if exists public.boletines;
drop table if exists public.suscriptores;
drop table if exists public.comunidad_intentos;
drop function if exists public.proteger_envio_boletin();

delete from public.sitio_elementos where tipo in ('recurso', 'episodio');
alter table public.sitio_elementos drop constraint if exists sitio_tipo_valido;
alter table public.sitio_elementos add constraint sitio_tipo_valido
  check (tipo in ('valor', 'equipo', 'taller', 'mentoria', 'modulo', 'apoyo', 'actividad', 'servicio', 'produccion', 'cinta', 'cliente'));
delete from public.sitio_textos where clave like 'comunidad\_%' or clave like 'seo\_comunidad\_%' or clave like 'seccion\_comunidad\_%';
update public.sitio_textos set valor = '2' where clave = 'version_contenido';

drop policy if exists documentos_ver on storage.objects;
drop policy if exists documentos_subir on storage.objects;
drop policy if exists documentos_borrar on storage.objects;
-- El bucket «documentos» solo se puede borrar vacío: vacíalo en Storage y luego ejecuta
-- delete from storage.buckets where id = 'documentos';

-- Y en la terminal: supabase functions delete comunidad && supabase functions delete enviar-boletin
