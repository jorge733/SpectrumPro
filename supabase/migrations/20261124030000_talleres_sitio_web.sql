-- Talleres, módulos y mentorías publicados en spectrumpro.cl (noviembre 2026).
-- El sitio no publica días ni horarios: los nuevos quedan sin horario y
-- dirección los completa desde Talleres. Nada de lo que ya existe se borra.

-- 1. Profesores reales en los talleres iniciales, solo si aún tienen el texto genérico.
update public.talleres t set encargado = v.encargado
from (values
  ('Laboratorio Creativo',                       'Equipo Arte y Apoyo',               'Vicente Bernal'),
  ('Animación Digital',                          'Encargado de Animación Digital',    'Carlos González'),
  ('Dibujo e Ilustración',                       'Encargada de Dibujo e Ilustración', 'Naru Torres'),
  ('Teatro',                                     'Encargado de Teatro',               'Pedro González'),
  ('Títeres y TV',                               'Equipo de Títeres y TV',            'Paco Pasquette y Gonzalo Pavez'),
  ('Videojuegos',                                'Encargado de Videojuegos',          'Bruno Díaz'),
  ('Habilidades para la vida diaria con Cocina', 'Terapeuta ocupacional',             'Laura Quintana'),
  ('Cuentos con Vellón',                         'Terapeuta ocupacional',             'Laura Quintana')
) as v(nombre, generico, encargado)
where lower(trim(t.nombre)) = lower(v.nombre) and t.encargado = v.generico;

-- 2. Lo que falta del sitio web (si ya existe un taller con ese nombre, se deja como está).
insert into public.talleres (nombre, area, dias, encargado, color, orden) values
  ('Club de Tonteras',                                     'Centro de Formación', '{}', 'Benjamín Villalobos',         '#F58A1F', 9),
  ('Juegos de Rol',                                        'Centro de Formación', '{}', 'Carlos González y Naru Torres', '#7A5C3E', 10),
  ('Dibujo e Ilustración Digital',                         'Centro de Formación', '{}', 'Naru Torres',                 '#C2409E', 11),
  ('Animación Stop-Motion',                                'Centro de Formación', '{}', 'Carlos González',             '#1F8FBF', 12),
  ('Modelado 3D',                                          'Centro de Formación', '{}', '',                            '#4B7BE5', 13),
  ('Referentes Culturales',                                'Formación general',   '{}', '',                            '#8C6D1F', 14),
  ('Expresión Corporal y Creación Escénica',               'Formación general',   '{}', '',                            '#D94F70', 15),
  ('Expresión Corporal y Creación Escénica: expresión vocal', 'Formación general', '{}', '',                            '#B03A5B', 16),
  ('Arte Terapia',                                         'Arte y Apoyo',        '{}', 'Vicente Bernal y Paula Jiménez', '#7C4DCC', 17),
  ('Mentoría de Dibujo Digital o Análogo',                 'Mentorías',           '{}', 'Naru Torres',                 '#E65EBE', 18),
  ('Mentoría de Creación de Videojuegos y Animación 3D',   'Mentorías',           '{}', 'Bruno Díaz',                  '#00BC70', 19),
  ('Mentoría de Edición de Videos e Introducción a IA',    'Mentorías',           '{}', 'Gonzalo Pavez',               '#31B4E7', 20),
  ('Proyecto animado colectivo',                           'SpectrumOnline',      '{}', 'Naru Torres',                 '#5A9E3A', 21)
on conflict do nothing;
