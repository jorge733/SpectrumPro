-- Comunidad: reacciones y comentarios en los boletines publicados en https://spectrumpro.cl/comunidad.
--
-- · boletin_reacciones: ❤️ 👏 💡 🤝 por boletín. Una de cada tipo por navegador (huella cifrada).
--   El público no escribe la tabla: pasa por la función «comunidad», que limita los intentos.
-- · boletin_comentarios: solo de personas suscritas y confirmadas (la función lo comprueba con su
--   correo, que nunca se muestra). Todos llegan «pendientes» y el equipo los aprueba, oculta o borra
--   en la plataforma (Comunidad → Comentarios), donde también puede responderlos.
-- · El público lee solo dos vistas: los totales de reacciones y los comentarios aprobados, ambos
--   únicamente de boletines enviados y publicados en la página.
-- Requiere 20261129000000_comunidad.sql. Se puede ejecutar más de una vez sin duplicar nada.

-- Los intentos ahora distinguen la acción (suscribir, comentar, reaccionar) para limitar cada una.
alter table public.comunidad_intentos add column if not exists accion text not null default 'suscribir';
drop index if exists public.comunidad_intentos_ip;
create index if not exists comunidad_intentos_ip_accion on public.comunidad_intentos (ip, accion, creado);

-- ---------------------------------------------------------------------------
-- Reacciones
-- ---------------------------------------------------------------------------
create table if not exists public.boletin_reacciones (
  boletin_id  uuid not null references public.boletines (id) on delete cascade,
  tipo        text not null,
  huella      text not null,                 -- navegador que reaccionó (cifrado, no identifica a nadie)
  creado      timestamptz not null default now(),
  primary key (boletin_id, tipo, huella),
  constraint boletin_reacciones_tipo check (tipo in ('gusta', 'aplauso', 'aprendi', 'identifica')),
  constraint boletin_reacciones_huella check (char_length(huella) between 16 and 64)
);
alter table public.boletin_reacciones enable row level security;
revoke all on public.boletin_reacciones from anon, authenticated;
grant all on public.boletin_reacciones to service_role;

-- ---------------------------------------------------------------------------
-- Comentarios
-- ---------------------------------------------------------------------------
create table if not exists public.boletin_comentarios (
  id             uuid primary key default gen_random_uuid(),
  boletin_id     uuid not null references public.boletines (id) on delete cascade,
  suscriptor_id  uuid references public.suscriptores (id) on delete cascade,
  nombre         text not null,
  texto          text not null,
  estado         text not null default 'pendiente',
  respuesta      text not null default '',
  respuesta_en   timestamptz,
  revisado_por   uuid references public.perfiles (id) on delete set null,
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now(),

  constraint boletin_comentarios_nombre_largo check (char_length(trim(nombre)) between 1 and 60),
  constraint boletin_comentarios_texto_largo  check (char_length(trim(texto)) between 2 and 2000),
  constraint boletin_comentarios_resp_largo   check (char_length(respuesta) <= 2000),
  constraint boletin_comentarios_estado       check (estado in ('pendiente', 'aprobado', 'oculto'))
);
create index if not exists boletin_comentarios_boletin on public.boletin_comentarios (boletin_id, estado, creado);
create index if not exists boletin_comentarios_estado on public.boletin_comentarios (estado, creado desc);

drop trigger if exists tocar_boletin_comentarios on public.boletin_comentarios;
create trigger tocar_boletin_comentarios before update on public.boletin_comentarios
  for each row execute function public.tocar_actualizado();

-- Quien revisa queda anotado, y la fecha de la respuesta se pone sola.
create or replace function public.revisar_comentario()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if auth.uid() is not null then new.revisado_por := auth.uid(); end if;
  if new.respuesta is distinct from old.respuesta then
    new.respuesta_en := case when trim(new.respuesta) = '' then null else now() end;
  end if;
  return new;
end $$;
drop trigger if exists revisar_comentario on public.boletin_comentarios;
create trigger revisar_comentario before update on public.boletin_comentarios
  for each row execute function public.revisar_comentario();

alter table public.boletin_comentarios enable row level security;
drop policy if exists comentarios_ver on public.boletin_comentarios;
create policy comentarios_ver on public.boletin_comentarios for select to authenticated
  using (public.puede_editar_sitio());
drop policy if exists comentarios_revisar on public.boletin_comentarios;
create policy comentarios_revisar on public.boletin_comentarios for update to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio());
drop policy if exists comentarios_borrar on public.boletin_comentarios;
create policy comentarios_borrar on public.boletin_comentarios for delete to authenticated
  using (public.puede_editar_sitio());

revoke all on public.boletin_comentarios from anon, authenticated;
grant select, delete on public.boletin_comentarios to authenticated;
grant update (estado, respuesta) on public.boletin_comentarios to authenticated;
grant all on public.boletin_comentarios to service_role;

drop trigger if exists auditar_boletin_comentarios on public.boletin_comentarios;
create trigger auditar_boletin_comentarios after update or delete on public.boletin_comentarios
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------------
-- Lo que ve el público (vistas con los permisos de su dueño: solo exponen estas columnas)
-- ---------------------------------------------------------------------------
create or replace view public.boletin_reacciones_totales as
  select r.boletin_id, r.tipo, count(*)::int as total
  from public.boletin_reacciones r
  join public.boletines b on b.id = r.boletin_id and b.publico and b.estado = 'enviado'
  group by r.boletin_id, r.tipo;

create or replace view public.boletin_comentarios_publicos as
  select c.id, c.boletin_id, c.nombre, c.texto, c.creado, c.respuesta, c.respuesta_en
  from public.boletin_comentarios c
  join public.boletines b on b.id = c.boletin_id and b.publico and b.estado = 'enviado'
  where c.estado = 'aprobado';

revoke all on public.boletin_reacciones_totales, public.boletin_comentarios_publicos from anon, authenticated;
grant select on public.boletin_reacciones_totales, public.boletin_comentarios_publicos to anon, authenticated;
