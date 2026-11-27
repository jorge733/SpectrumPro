-- Comunidad: página https://spectrumpro.cl/comunidad, suscripción a las noticias y boletines por correo.
--
-- · sitio_elementos: dos listas nuevas para la página Comunidad, «recurso» (PDF y artículos) y
--   «episodio» (podcasts). Se editan en la plataforma, sección «Sitio web», como las demás.
-- · suscriptores: quienes se suscriben en la página. Nadie del público puede leer ni escribir esta
--   tabla: el formulario pasa por la función «comunidad», que guarda a la persona como «pendiente» y
--   le manda un correo para confirmar (doble confirmación). Solo queda «activo» al abrir ese enlace.
--   Dirección y el rol Equipo ven la lista, la exportan y pueden dar de baja o eliminar; no pueden
--   reactivar a alguien que se dio de baja (eso solo lo hace la propia persona, suscribiéndose otra vez).
-- · boletines: las noticias que se escriben en la plataforma (sección «Comunidad») y se envían con la
--   función «enviar-boletin». Los enviados con «publico» marcado aparecen en la página Comunidad.
-- · boletin_envios: a quién ya se le mandó cada boletín (permite retomar un envío que se cortó).
-- · Bucket público «documentos» para los PDF de la página (máx. 25 MB).
-- Requiere 20261127020000_sitio_web.sql y 20261128000000_sitio_web_completo.sql.
-- Se puede ejecutar más de una vez sin duplicar nada.

-- ---------------------------------------------------------------------------
-- Listas nuevas del sitio
-- ---------------------------------------------------------------------------
alter table public.sitio_elementos drop constraint if exists sitio_tipo_valido;
alter table public.sitio_elementos add constraint sitio_tipo_valido
  check (tipo in ('valor', 'equipo', 'taller', 'mentoria', 'modulo', 'apoyo', 'actividad', 'servicio', 'produccion', 'cinta', 'cliente', 'recurso', 'episodio'));

insert into public.sitio_elementos (tipo, titulo, subtitulo, texto, nota, imagen, enlace, orden)
select * from (values
  ('recurso', 'Estrategias de fomento lector para estudiantes neurodivergentes en Chile', 'PDF · 295 KB', 'Entre la creatividad docente y las barreras sistémicas.', '', '/sitio/img/co-doc-fomento-lector-estudiantes-neurodivergentes.webp', '/sitio/docs/fomento-lector-estudiantes-neurodivergentes.pdf', 1),
  ('recurso', 'Estrategias de enseñanza y aprendizaje para el trastorno del espectro autista', 'PDF · 4,9 MB', 'Publicación con estrategias para el aula.', '', '/sitio/img/co-doc-estrategias-ensenanza-aprendizaje-tea.webp', '/sitio/docs/estrategias-ensenanza-aprendizaje-tea.pdf', 2),
  ('recurso', 'Educar en la complejidad: condiciones neurodivergentes y entornos familiares', 'PDF · 116 KB', '', '', '/sitio/img/co-doc-educar-en-la-complejidad.webp', '/sitio/docs/educar-en-la-complejidad.pdf', 3),
  ('recurso', 'Hacia una educación sin barreras', 'PDF · 16,8 MB', 'Avances y desafíos en la educación inclusiva que evidencian los resultados del SIRIED 2024 (UNESCO).', '', '/sitio/img/co-doc-educacion-sin-barreras-siried-2024.webp', '/sitio/docs/educacion-sin-barreras-siried-2024.pdf', 4),
  ('recurso', 'Manual de neurodivergencias y adaptaciones razonables', 'PDF · 868 KB · Diego Vega', 'Una guía para la educación inclusiva, con enfoque en autismo y déficit atencional e hiperactividad.', '', '/sitio/img/co-doc-manual-de-diego.webp', '/sitio/docs/manual-de-diego.pdf', 5),
  ('recurso', '¿Cómo pueden las escuelas apoyar a estudiantes neurodivergentes?', 'Artículo · Child Mind Institute', 'Herramientas que les permitan prosperar académica y socialmente.', 'Leer el artículo', '/sitio/img/co-apoyo-educadores.webp', 'https://childmind.org/es/articulo/como-pueden-las-escuelas-apoyar-a-estudiantes-neurodiversos/', 6)
) as v (tipo, titulo, subtitulo, texto, nota, imagen, enlace, orden)
where not exists (select 1 from public.sitio_elementos where tipo = 'recurso');

insert into public.sitio_elementos (tipo, titulo, subtitulo, texto, nota, imagen, enlace, orden)
select * from (values
  ('episodio', 'Ley de Autismo: el desafío de la educación inclusiva', 'No desistas · Episodio 1', 'Un podcast sobre autismo y educación para docentes, directivos y equipos de apoyo: información basada en la normativa vigente, la investigación y la práctica, con recomendaciones concretas para el aula.', '', '/sitio/img/co-podcast-no-desistas.webp', 'https://open.spotify.com/episode/5svYlebiN8fhUpFRNwd5up', 1),
  ('episodio', 'Educación superior inclusiva: admisión especial en las universidades chilenas', 'No desistas · Episodio 6', '', '', '/sitio/img/co-podcast-no-desistas.webp', 'https://open.spotify.com/episode/5qofHlGccui29l3zUZ05X6', 2),
  ('episodio', 'Familia y escuela, una alianza estratégica', 'No desistas · Episodio 4', '', '', '/sitio/img/co-podcast-no-desistas.webp', 'https://open.spotify.com/episode/7gCL9QRUenGTLk8FJVJ383', 3),
  ('episodio', 'Alejandra Flores: una mirada neuroafirmativa del autismo', 'Dale la vuelta al Autismo, con Paula Blanco', 'Psicóloga y magíster en Psicología Educacional, especializada en altas capacidades y espectro autista. Propone entender el autismo no solo desde el déficit, sino como parte de la variabilidad humana.', '', '/sitio/img/co-podcast-dale-la-vuelta.webp', 'https://open.spotify.com/episode/6JPgPpsNeLEncmHVOfNXi6', 4)
) as v (tipo, titulo, subtitulo, texto, nota, imagen, enlace, orden)
where not exists (select 1 from public.sitio_elementos where tipo = 'episodio');

-- El sitio ya puede confiar en las listas de la base (antes usa su respaldo, contenido.js).
insert into public.sitio_textos (clave, valor) values ('version_contenido', '3')
on conflict (clave) do update set valor = '3';

-- ---------------------------------------------------------------------------
-- Suscriptores
-- ---------------------------------------------------------------------------
create table if not exists public.suscriptores (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  nombre         text not null default '',
  perfil         text not null default '',
  estado         text not null default 'pendiente',
  token          uuid not null default gen_random_uuid(),   -- va en los enlaces de confirmar y darse de baja
  creado         timestamptz not null default now(),
  confirmado     timestamptz,
  baja_en        timestamptz,
  ultimo_aviso   timestamptz,                               -- último correo de confirmación enviado
  actualizado    timestamptz not null default now(),

  constraint suscriptores_email_unico   unique (email),
  constraint suscriptores_token_unico   unique (token),
  constraint suscriptores_email_formato check (email = lower(email) and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and char_length(email) <= 160),
  constraint suscriptores_nombre_largo  check (char_length(nombre) <= 80),
  constraint suscriptores_perfil_valido check (perfil in ('', 'familia', 'neurodivergente', 'educacion', 'salud', 'politicas', 'otro')),
  constraint suscriptores_estado_valido check (estado in ('pendiente', 'activo', 'baja'))
);
create index if not exists suscriptores_estado on public.suscriptores (estado, creado);

drop trigger if exists tocar_suscriptores on public.suscriptores;
create trigger tocar_suscriptores before update on public.suscriptores
  for each row execute function public.tocar_actualizado();

alter table public.suscriptores enable row level security;
drop policy if exists suscriptores_ver on public.suscriptores;
create policy suscriptores_ver on public.suscriptores for select to authenticated
  using (public.puede_editar_sitio());
-- Desde la plataforma solo se puede dar de baja (nunca reactivar ni cambiar el correo).
drop policy if exists suscriptores_baja on public.suscriptores;
create policy suscriptores_baja on public.suscriptores for update to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio() and estado = 'baja');
drop policy if exists suscriptores_eliminar on public.suscriptores;
create policy suscriptores_eliminar on public.suscriptores for delete to authenticated
  using (public.puede_editar_sitio());

revoke all on public.suscriptores from anon, authenticated;
grant select (id, email, nombre, perfil, estado, creado, confirmado, baja_en), delete on public.suscriptores to authenticated;
grant update (estado, baja_en) on public.suscriptores to authenticated;
grant all on public.suscriptores to service_role;

-- ---------------------------------------------------------------------------
-- Boletines
-- ---------------------------------------------------------------------------
create table if not exists public.boletines (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,                 -- también es el asunto del correo
  resumen        text not null default '',      -- se ve junto al asunto en la bandeja de entrada
  texto          text not null default '',
  imagen         text not null default '',
  boton_texto    text not null default '',
  boton_enlace   text not null default '',
  publico        boolean not null default true, -- aparece en la página Comunidad una vez enviado
  estado         text not null default 'borrador',
  destinatarios  integer not null default 0,
  enviado_en     timestamptz,
  autor          uuid default auth.uid() references public.perfiles (id) on delete set null,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),

  constraint boletines_titulo_largo  check (char_length(trim(titulo)) between 1 and 150),
  constraint boletines_resumen_largo check (char_length(resumen) <= 200),
  constraint boletines_texto_largo   check (char_length(texto) <= 20000),
  constraint boletines_imagen_largo  check (char_length(imagen) <= 500),
  constraint boletines_boton_largo   check (char_length(boton_texto) <= 60 and char_length(boton_enlace) <= 500),
  constraint boletines_estado_valido check (estado in ('borrador', 'enviando', 'enviado'))
);
create index if not exists boletines_enviados on public.boletines (estado, enviado_en desc);

drop trigger if exists tocar_boletines on public.boletines;
create trigger tocar_boletines before update on public.boletines
  for each row execute function public.tocar_actualizado();

-- El estado del envío solo lo cambia la función enviar-boletin (con la clave de servicio).
create or replace function public.proteger_envio_boletin()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.estado := 'borrador'; new.destinatarios := 0; new.enviado_en := null;
    else
      new.estado := old.estado; new.destinatarios := old.destinatarios; new.enviado_en := old.enviado_en;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists proteger_envio_boletin on public.boletines;
create trigger proteger_envio_boletin before insert or update on public.boletines
  for each row execute function public.proteger_envio_boletin();

alter table public.boletines enable row level security;
drop policy if exists boletines_ver_publico on public.boletines;
create policy boletines_ver_publico on public.boletines for select to anon
  using (publico and estado = 'enviado');
drop policy if exists boletines_ver_equipo on public.boletines;
create policy boletines_ver_equipo on public.boletines for select to authenticated
  using ((publico and estado = 'enviado') or public.puede_editar_sitio());
drop policy if exists boletines_editar on public.boletines;
create policy boletines_editar on public.boletines for all to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio());

revoke all on public.boletines from anon, authenticated;
grant select (id, titulo, texto, imagen, boton_texto, boton_enlace, enviado_en) on public.boletines to anon;
grant select, insert, update, delete on public.boletines to authenticated;
grant all on public.boletines to service_role;

drop trigger if exists auditar_boletines on public.boletines;
create trigger auditar_boletines after insert or update or delete on public.boletines
  for each row execute function public.auditar();

-- A quién ya se le envió cada boletín (solo la función lo usa).
create table if not exists public.boletin_envios (
  boletin_id     uuid not null references public.boletines (id) on delete cascade,
  suscriptor_id  uuid not null references public.suscriptores (id) on delete cascade,
  enviado        timestamptz not null default now(),
  primary key (boletin_id, suscriptor_id)
);
alter table public.boletin_envios enable row level security;
revoke all on public.boletin_envios from anon, authenticated;
grant all on public.boletin_envios to service_role;

-- Intentos de suscripción por dirección IP (cifrada), para frenar abusos del formulario.
create table if not exists public.comunidad_intentos (
  id      bigint generated always as identity primary key,
  ip      text not null,
  creado  timestamptz not null default now()
);
create index if not exists comunidad_intentos_ip on public.comunidad_intentos (ip, creado);
alter table public.comunidad_intentos enable row level security;
revoke all on public.comunidad_intentos from anon, authenticated;
grant all on public.comunidad_intentos to service_role;

-- ---------------------------------------------------------------------------
-- Documentos: bucket público «documentos» (solo PDF, máx. 25 MB)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', true, 26214400, array['application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists documentos_ver on storage.objects;
create policy documentos_ver on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and public.puede_editar_sitio());
drop policy if exists documentos_subir on storage.objects;
create policy documentos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and public.puede_editar_sitio());
drop policy if exists documentos_borrar on storage.objects;
create policy documentos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.puede_editar_sitio());
