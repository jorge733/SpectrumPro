-- Ficha cualitativa del participante.
--
-- La completan familias, participantes o profesionales desde ficha-participante.html, sin iniciar sesión:
--   · anon solo puede INSERTAR, nunca leer, editar ni borrar.
--   · Las fichas las ven dirección y terapeutas (ve_todo()); dirección puede borrarlas.
-- Las columnas principales sirven para buscar y ordenar; el resto de las respuestas va en "datos" (jsonb),
-- con una clave por pregunta (por ejemplo datos->>'diagnosticos' o datos->'fortalezas').

create table if not exists public.ficha_cualitativa (
  id                  uuid primary key default gen_random_uuid(),
  creado              timestamptz not null default now(),
  nombre_completo     text not null,
  fecha_nacimiento    date,
  completado_por      text not null,
  relacion            text,
  email_contacto      text,
  datos               jsonb not null default '{}'::jsonb,
  consentimiento      boolean not null,

  constraint ficha_nombre_largo     check (char_length(trim(nombre_completo)) between 2 and 160),
  constraint ficha_completa_largo   check (char_length(trim(completado_por)) between 2 and 160),
  constraint ficha_relacion_largo   check (relacion is null or char_length(relacion) <= 80),
  constraint ficha_email_formato    check (email_contacto is null or (char_length(email_contacto) <= 160 and email_contacto ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  constraint ficha_datos_objeto     check (jsonb_typeof(datos) = 'object'),
  constraint ficha_datos_tamano     check (pg_column_size(datos) <= 120000),
  constraint ficha_consentimiento   check (consentimiento)
);

create index if not exists ficha_cualitativa_creado on public.ficha_cualitativa (creado desc);

alter table public.ficha_cualitativa enable row level security;

drop policy if exists ficha_cual_enviar on public.ficha_cualitativa;
create policy ficha_cual_enviar on public.ficha_cualitativa for insert to anon, authenticated
  with check (consentimiento);

drop policy if exists ficha_cual_ver on public.ficha_cualitativa;
create policy ficha_cual_ver on public.ficha_cualitativa for select to authenticated
  using (public.ve_todo());

drop policy if exists ficha_cual_borrar on public.ficha_cualitativa;
create policy ficha_cual_borrar on public.ficha_cualitativa for delete to authenticated
  using (public.es_admin());

-- Acceso por la API: el público solo inserta (sin "returning", así no necesita leer).
revoke all on public.ficha_cualitativa from anon, authenticated;
grant usage on schema public to anon;
grant insert on public.ficha_cualitativa to anon;
grant select, insert, delete on public.ficha_cualitativa to authenticated;
grant all on public.ficha_cualitativa to service_role;
