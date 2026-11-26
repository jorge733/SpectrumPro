-- Talleres online: cada taller es presencial u online, y los online guardan el enlace a la videollamada.
alter table public.talleres
  add column if not exists modalidad text not null default 'presencial',
  add column if not exists enlace    text not null default '';

alter table public.talleres drop constraint if exists talleres_modalidad_check;
alter table public.talleres add constraint talleres_modalidad_check
  check (modalidad in ('presencial', 'online'));

alter table public.talleres drop constraint if exists talleres_enlace_check;
alter table public.talleres add constraint talleres_enlace_check
  check (enlace = '' or (modalidad = 'online' and enlace ~* '^https://[^[:space:]"''<>]+$'));

-- Los talleres del área SpectrumOnline pasan a la sección de talleres online.
update public.talleres set modalidad = 'online' where area = 'SpectrumOnline' and modalidad = 'presencial';
