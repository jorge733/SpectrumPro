-- Separa los talleres por temporada: «semestral» (los de siempre) o «verano».
-- Los talleres existentes quedan como semestrales.
alter table public.talleres
  add column if not exists temporada text not null default 'semestral'
  check (temporada in ('semestral', 'verano'));
