-- Encuesta para quienes asistirán a la Muestra Audiovisual
-- (viernes 11 de diciembre de 2026, 11:00, Centro Cultural La Moneda).
--
-- La responde el público desde encuesta.html, sin iniciar sesión:
--   · anon solo puede INSERTAR, nunca leer, editar ni borrar.
--   · Las respuestas las ven dirección y terapeutas (ve_todo()); dirección puede borrarlas.
-- La tabla sirve para próximos eventos: basta con agregar el nuevo código a la regla de "evento".

create table if not exists public.encuesta_evento (
  id                    uuid primary key default gen_random_uuid(),
  creado                timestamptz not null default now(),
  evento                text not null default 'muestra-audiovisual-2026',
  nombre                text not null,
  email                 text not null,
  telefono              text,
  acompanantes          smallint not null default 0,
  relacion              text not null,
  medio                 text,
  accesibilidad         text[] not null default '{}',
  accesibilidad_detalle text,
  expectativas          text,
  novedades             boolean not null default false,
  consentimiento        boolean not null,

  constraint encuesta_evento_valido  check (evento in ('muestra-audiovisual-2026')),
  constraint encuesta_nombre_largo   check (char_length(trim(nombre)) between 2 and 120),
  constraint encuesta_email_formato  check (char_length(email) <= 160 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint encuesta_telefono_largo check (telefono is null or char_length(telefono) <= 30),
  constraint encuesta_acompanantes   check (acompanantes between 0 and 10),
  constraint encuesta_relacion_largo check (char_length(relacion) <= 80),
  constraint encuesta_medio_largo    check (medio is null or char_length(medio) <= 80),
  constraint encuesta_acces_largo    check (cardinality(accesibilidad) <= 12),
  constraint encuesta_detalle_largo  check (accesibilidad_detalle is null or char_length(accesibilidad_detalle) <= 1000),
  constraint encuesta_expect_largo   check (expectativas is null or char_length(expectativas) <= 1000),
  constraint encuesta_consentimiento check (consentimiento)
);

create index if not exists encuesta_evento_creado on public.encuesta_evento (evento, creado desc);

alter table public.encuesta_evento enable row level security;

drop policy if exists encuesta_responder on public.encuesta_evento;
create policy encuesta_responder on public.encuesta_evento for insert to anon, authenticated
  with check (consentimiento and evento = 'muestra-audiovisual-2026');

drop policy if exists encuesta_ver on public.encuesta_evento;
create policy encuesta_ver on public.encuesta_evento for select to authenticated
  using (public.ve_todo());

drop policy if exists encuesta_borrar on public.encuesta_evento;
create policy encuesta_borrar on public.encuesta_evento for delete to authenticated
  using (public.es_admin());

-- Acceso por la API: el público solo inserta (sin "returning", así no necesita leer).
revoke all on public.encuesta_evento from anon, authenticated;
grant usage on schema public to anon;
grant insert on public.encuesta_evento to anon;
grant select, insert, delete on public.encuesta_evento to authenticated;
grant all on public.encuesta_evento to service_role;
