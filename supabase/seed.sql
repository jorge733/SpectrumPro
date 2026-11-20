-- Talleres iniciales de SpectrumPro. Días: 0 = domingo … 6 = sábado.
-- Los horarios son ilustrativos: ajústalos desde Administración → Talleres.
insert into public.talleres (nombre, area, dias, hora_inicio, hora_fin, encargado, color, orden) values
  ('Laboratorio Creativo',                       'Arte y Apoyo',        '{2}',   '16:00', '17:30', 'Equipo Arte y Apoyo',               '#635CC7', 1),
  ('Animación Digital',                          'Centro de Formación', '{1,3}', '15:00', '17:00', 'Encargado de Animación Digital',    '#31B4E7', 2),
  ('Dibujo e Ilustración',                       'Centro de Formación', '{2,4}', '15:00', '16:30', 'Encargada de Dibujo e Ilustración', '#E65EBE', 3),
  ('Teatro',                                     'Centro de Formación', '{4}',   '16:30', '18:00', 'Encargado de Teatro',               '#F8384B', 4),
  ('Títeres y TV',                               'Centro de Formación', '{5}',   '15:00', '17:00', 'Equipo de Títeres y TV',            '#E0B800', 5),
  ('Videojuegos',                                'Centro de Formación', '{3}',   '17:00', '18:30', 'Encargado de Videojuegos',          '#00BC70', 6),
  ('Habilidades para la vida diaria con Cocina', 'Terapia Ocupacional', '{1}',   '11:00', '12:30', 'Terapeuta ocupacional',             '#2A9D8F', 7),
  ('Cuentos con Vellón',                         'Terapia Ocupacional', '{5}',   '11:00', '12:30', 'Terapeuta ocupacional',             '#9B6AD6', 8);
