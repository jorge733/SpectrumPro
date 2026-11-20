-- SpectrumPro · Gestión de alumnado
-- Esquema, seguridad por filas (RLS) y auditoría.
-- Roles:
--   admin      → dirección y administración: ve y edita todo, gestiona usuarios.
--   terapeuta  → ve todo el alumnado, incluidos los datos privados de salud; edita fichas.
--   tallerista → ve solo a quienes están inscritos en sus talleres y pasa lista en ellos.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos y utilidades
-- ---------------------------------------------------------------------------
create type public.rol_usuario as enum ('admin', 'terapeuta', 'tallerista');

-- Fecha de hoy en Chile (la base de datos trabaja en UTC).
create or replace function public.hoy_chile()
returns date language sql stable
as $$ select (now() at time zone 'America/Santiago')::date $$;

create or replace function public.tocar_actualizado()
returns trigger language plpgsql
as $$ begin new.actualizado := now(); return new; end $$;

-- ---------------------------------------------------------------------------
-- Perfiles (uno por cuenta de Supabase Auth)
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null default '',
  nombre      text not null default '',
  rol         public.rol_usuario,
  activo      boolean not null default false,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create trigger perfiles_actualizado before update on public.perfiles
  for each row execute function public.tocar_actualizado();

-- Cada cuenta nueva nace sin rol e inactiva. Solo un admin (o la función
-- gestionar-usuario) puede darle rol y activarla. Así un registro público
-- nunca obtiene acceso, aunque alguien envíe metadatos inventados.
create or replace function public.crear_perfil()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'nombre', ''));
  return new;
end $$;
create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

-- Rol de la persona conectada (null si no tiene rol o está inactiva).
create or replace function public.rol_actual()
returns public.rol_usuario language sql stable security definer set search_path = ''
as $$ select rol from public.perfiles where id = auth.uid() and activo $$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual() = 'admin', false) $$;

create or replace function public.ve_todo()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual() in ('admin', 'terapeuta'), false) $$;

-- No se puede dejar la plataforma sin ningún admin activo.
create or replace function public.proteger_ultimo_admin()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.rol = 'admin' and old.activo)
     or (tg_op = 'UPDATE' and old.rol = 'admin' and old.activo and (new.rol is distinct from 'admin' or not new.activo)) then
    if not exists (select 1 from public.perfiles where rol = 'admin' and activo and id <> old.id) then
      raise exception 'Debe quedar al menos una persona con rol admin activa.' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end $$;
create trigger perfiles_ultimo_admin before update or delete on public.perfiles
  for each row execute function public.proteger_ultimo_admin();

-- ---------------------------------------------------------------------------
-- Talleres y equipo
-- ---------------------------------------------------------------------------
create table public.talleres (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (length(trim(nombre)) > 0),
  area        text not null default '',
  dias        smallint[] not null default '{}' check (dias <@ array[0,1,2,3,4,5,6]::smallint[]),
  hora_inicio time,
  hora_fin    time,
  encargado   text not null default '',
  color       text not null default '#635CC7' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  activo      boolean not null default true,
  orden       integer not null default 0,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  check (hora_fin is null or hora_inicio is null or hora_fin > hora_inicio)
);
create trigger talleres_actualizado before update on public.talleres
  for each row execute function public.tocar_actualizado();

-- Qué cuentas del equipo están a cargo de cada taller (pueden pasar lista).
create table public.taller_equipo (
  taller_id uuid not null references public.talleres (id) on delete cascade,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  primary key (taller_id, perfil_id)
);
create index on public.taller_equipo (perfil_id);

create or replace function public.es_equipo_de(p_taller uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.rol_actual() is not null
     and exists (select 1 from public.taller_equipo where taller_id = p_taller and perfil_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Alumnado
-- ---------------------------------------------------------------------------
create table public.alumnos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (length(trim(nombre)) > 0),
  apellidos      text not null check (length(trim(apellidos)) > 0),
  apodo          text not null default '',
  pronombres     text not null default '',
  fecha_nac      date not null check (fecha_nac > date '1900-01-01'),
  rut            text not null default '',
  programa       text not null default 'FormaPro',
  beca           text not null default '',
  estado         text not null default 'activo' check (estado in ('activo', 'pausa', 'egresado', 'retirado')),
  fecha_ingreso  date,
  entrevista     date,
  tutor_nombre   text not null default '',
  tutor_relacion text not null default '',
  tutor_telefono text not null default '',
  tutor_email    text not null default '',
  emergencia     text not null default '',
  direccion      text not null default '',
  intereses      text not null default '',
  apoyos         text not null default '',   -- visible para talleristas: lo necesitan en sesión
  alergias       text not null default '',   -- visible para talleristas: seguridad en sesión
  creado         timestamptz not null default now(),
  actualizado    timestamptz not null default now()
);
create trigger alumnos_actualizado before update on public.alumnos
  for each row execute function public.tocar_actualizado();

-- Datos sensibles: solo admin y terapeutas.
create table public.alumnos_privado (
  alumno_id     uuid primary key references public.alumnos (id) on delete cascade,
  medicacion    text not null default '',
  observaciones text not null default '',
  actualizado   timestamptz not null default now()
);
create trigger privado_actualizado before update on public.alumnos_privado
  for each row execute function public.tocar_actualizado();

create table public.inscripciones (
  alumno_id uuid not null references public.alumnos (id) on delete cascade,
  taller_id uuid not null references public.talleres (id) on delete cascade,
  desde     date not null default public.hoy_chile(),
  primary key (alumno_id, taller_id)
);
create index on public.inscripciones (taller_id);

create or replace function public.puede_ver_alumno(p_alumno uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.ve_todo()
      or (public.rol_actual() is not null and exists (
            select 1 from public.inscripciones i
            join public.taller_equipo e on e.taller_id = i.taller_id
            where i.alumno_id = p_alumno and e.perfil_id = auth.uid()))
$$;

-- ---------------------------------------------------------------------------
-- Asistencia
-- ---------------------------------------------------------------------------
create table public.asistencia (
  id             bigint generated always as identity primary key,
  taller_id      uuid not null references public.talleres (id) on delete cascade,
  alumno_id      uuid not null references public.alumnos (id) on delete cascade,
  fecha          date not null,
  estado         char(1) not null check (estado in ('P', 'R', 'A', 'J')),
  nota           text not null default '',
  registrado_por uuid default auth.uid() references public.perfiles (id) on delete set null,
  actualizado    timestamptz not null default now(),
  unique (taller_id, fecha, alumno_id)
);
create index on public.asistencia (fecha);
create index on public.asistencia (alumno_id, fecha);
create trigger asistencia_actualizado before update on public.asistencia
  for each row execute function public.tocar_actualizado();

create or replace function public.puede_pasar_lista(p_taller uuid, p_alumno uuid, p_fecha date)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (public.ve_todo() or public.es_equipo_de(p_taller))
     and p_fecha <= public.hoy_chile()
     and exists (select 1 from public.inscripciones where taller_id = p_taller and alumno_id = p_alumno)
$$;

-- ---------------------------------------------------------------------------
-- Auditoría (la escriben triggers en la base de datos: no se puede omitir ni falsificar desde el navegador)
-- ---------------------------------------------------------------------------
create table public.auditoria (
  id           bigint generated always as identity primary key,
  creado       timestamptz not null default now(),
  actor        uuid,
  actor_nombre text not null default '',
  accion       text not null,
  tabla        text not null,
  registro     text not null default '',
  detalle      jsonb not null default '{}'
);
create index on public.auditoria (creado desc);

create or replace function public.auditar()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_new, v_old);
  v_detalle jsonb := '{}';
  v_campos text[];
  v_registro text;
begin
  -- Identificador legible del registro afectado.
  v_registro := coalesce(v_fila ->> 'id', v_fila ->> 'alumno_id', '') ||
                case when v_fila ? 'taller_id' and tg_table_name <> 'talleres' then ' / ' || (v_fila ->> 'taller_id') else '' end;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_campos
    from jsonb_object_keys(v_new) k
    where k not in ('actualizado') and v_new -> k is distinct from v_old -> k;
    if v_campos is null then return new; end if;   -- nada cambió de verdad
    v_detalle := jsonb_build_object('campos', v_campos);
  end if;

  -- Contexto útil sin copiar datos sensibles al registro de auditoría.
  if tg_table_name = 'alumnos' then
    v_detalle := v_detalle || jsonb_build_object('alumno', (v_fila ->> 'nombre') || ' ' || (v_fila ->> 'apellidos'));
  elsif tg_table_name = 'asistencia' then
    v_detalle := v_detalle || jsonb_build_object('fecha', v_fila ->> 'fecha', 'estado', v_fila ->> 'estado');
  elsif tg_table_name = 'talleres' then
    v_detalle := v_detalle || jsonb_build_object('taller', v_fila ->> 'nombre');
  elsif tg_table_name = 'perfiles' then
    v_detalle := v_detalle || jsonb_build_object('email', v_fila ->> 'email', 'rol', v_fila ->> 'rol', 'activo', v_fila ->> 'activo');
  end if;

  insert into public.auditoria (actor, actor_nombre, accion, tabla, registro, detalle)
  values (
    auth.uid(),
    coalesce((select nullif(nombre, '') from public.perfiles where id = auth.uid()),
             (select email from public.perfiles where id = auth.uid()), 'sistema'),
    lower(tg_op), tg_table_name, v_registro, v_detalle);
  return coalesce(new, old);
end $$;

create trigger auditar_perfiles after insert or update or delete on public.perfiles for each row execute function public.auditar();
create trigger auditar_talleres after insert or update or delete on public.talleres for each row execute function public.auditar();
create trigger auditar_equipo after insert or update or delete on public.taller_equipo for each row execute function public.auditar();
create trigger auditar_alumnos after insert or update or delete on public.alumnos for each row execute function public.auditar();
create trigger auditar_privado after insert or update or delete on public.alumnos_privado for each row execute function public.auditar();
create trigger auditar_inscripciones after insert or update or delete on public.inscripciones for each row execute function public.auditar();
create trigger auditar_asistencia after insert or update or delete on public.asistencia for each row execute function public.auditar();

-- ---------------------------------------------------------------------------
-- Cumpleaños: proyección mínima para todo el equipo activo (como en
-- getStudentBirthdays de la plataforma Michelangelo). No expone otros datos.
-- ---------------------------------------------------------------------------
create or replace function public.cumpleanos()
returns table (id uuid, nombre text, apodo text, apellidos text, fecha_nac date)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.nombre, a.apodo, a.apellidos, a.fecha_nac
  from public.alumnos a
  where public.rol_actual() is not null and a.estado in ('activo', 'pausa')
  order by extract(month from a.fecha_nac), extract(day from a.fecha_nac)
$$;

-- ---------------------------------------------------------------------------
-- Seguridad por filas
-- ---------------------------------------------------------------------------
alter table public.perfiles        enable row level security;
alter table public.talleres        enable row level security;
alter table public.taller_equipo   enable row level security;
alter table public.alumnos         enable row level security;
alter table public.alumnos_privado enable row level security;
alter table public.inscripciones   enable row level security;
alter table public.asistencia      enable row level security;
alter table public.auditoria       enable row level security;

-- perfiles: cada cual ve el suyo; el admin ve y edita todos. Nadie cambia su propio rol.
create policy perfiles_ver on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());
create policy perfiles_editar on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- talleres y equipo: todo el equipo activo los ve; solo admin los gestiona.
create policy talleres_ver on public.talleres for select to authenticated
  using (public.rol_actual() is not null);
create policy talleres_admin on public.talleres for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy equipo_ver on public.taller_equipo for select to authenticated
  using (public.rol_actual() is not null);
create policy equipo_admin on public.taller_equipo for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- alumnos: admin y terapeutas ven y editan todo; talleristas leen solo a su alumnado.
create policy alumnos_ver on public.alumnos for select to authenticated
  using (public.puede_ver_alumno(id));
create policy alumnos_crear on public.alumnos for insert to authenticated
  with check (public.ve_todo());
create policy alumnos_editar on public.alumnos for update to authenticated
  using (public.ve_todo()) with check (public.ve_todo());
create policy alumnos_borrar on public.alumnos for delete to authenticated
  using (public.es_admin());

create policy privado_todo on public.alumnos_privado for all to authenticated
  using (public.ve_todo()) with check (public.ve_todo());

create policy inscripciones_ver on public.inscripciones for select to authenticated
  using (public.puede_ver_alumno(alumno_id));
create policy inscripciones_gestionar on public.inscripciones for all to authenticated
  using (public.ve_todo()) with check (public.ve_todo());

-- asistencia: se ve y se registra según el taller; nunca en fechas futuras.
create policy asistencia_ver on public.asistencia for select to authenticated
  using (public.ve_todo() or public.es_equipo_de(taller_id));
create policy asistencia_crear on public.asistencia for insert to authenticated
  with check (public.puede_pasar_lista(taller_id, alumno_id, fecha));
create policy asistencia_editar on public.asistencia for update to authenticated
  using (public.ve_todo() or public.es_equipo_de(taller_id))
  with check (public.puede_pasar_lista(taller_id, alumno_id, fecha));
create policy asistencia_borrar on public.asistencia for delete to authenticated
  using (public.ve_todo() or public.es_equipo_de(taller_id));

-- auditoría: solo lectura para admin. Se escribe únicamente vía trigger.
create policy auditoria_ver on public.auditoria for select to authenticated
  using (public.es_admin());

-- Permisos de las funciones: nada para anónimos.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.cumpleanos(), public.rol_actual(), public.es_admin(), public.ve_todo(),
  public.es_equipo_de(uuid), public.puede_ver_alumno(uuid), public.puede_pasar_lista(uuid, uuid, date),
  public.hoy_chile() to authenticated;
