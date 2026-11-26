-- Segundo contacto de emergencia en la ficha del joven.
-- Mismo nivel de acceso que el primero (lo ven quienes pueden ver la ficha).
alter table public.alumnos
  add column if not exists emergencia2 text not null default '';
