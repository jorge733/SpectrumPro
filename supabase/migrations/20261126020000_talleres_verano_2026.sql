-- Talleres de verano: fechas exactas de cada sesión, objetivo, edad y una nota de horario.
-- Carga los talleres de verano de diciembre 2026 y enero 2027 (sin valores).
-- Requiere 20261126010000_talleres_temporada.sql. Se puede volver a ejecutar sin duplicar nada.

alter table public.talleres add column if not exists fechas   date[] not null default '{}';
alter table public.talleres add column if not exists objetivo text   not null default '';
alter table public.talleres add column if not exists edad     text   not null default '';
alter table public.talleres add column if not exists nota     text   not null default '';

-- «dias» se deja con los días de la semana de esas fechas, para que se vean en las fichas.
insert into public.talleres (nombre, temporada, area, fechas, dias, hora_inicio, hora_fin, objetivo, edad, nota, color, activo, orden) values
  ('Taller de Creación de Videojuegos · Grupo A', 'verano', 'Centro de Formación',
   '{2026-12-14,2026-12-16,2026-12-18,2026-12-21}', '{1,3,5}', '11:00', '13:00',
   'Diseñar y programar un nivel propio sobre una plantilla base en Construct 3, integrando arte y lógica al ritmo de cada participante para ensamblar un videojuego continuo jugado en grupo.',
   '', '', '#00BC70', true, 103),
  ('Taller de Creación de Videojuegos · Grupo B', 'verano', 'Centro de Formación',
   '{2026-12-14,2026-12-16,2026-12-18,2026-12-21}', '{1,3,5}', '15:00', '16:45',
   'Diseñar y programar un nivel propio sobre una plantilla base en Construct 3, integrando arte y lógica al ritmo de cada participante para ensamblar un videojuego continuo jugado en grupo.',
   '', 'Se abre al llenarse el Grupo A.', '#2BA77A', false, 104),
  ('Semana Intensiva: Universo Tolkien', 'verano', '',
   '{2026-12-15,2026-12-16,2026-12-17,2026-12-18}', '{2,3,4,5}', '09:00', '13:00',
   'Explorar la mitología de la Tierra Media mediante el diseño artístico y manual de un juego de aventuras colectivo (tablero, fichas, dados y cartas), culminando en una partida teatralizada sin competencia.',
   '', '', '#8C6D1F', true, 105),
  ('Taller de Corto de Títeres de Navidad', 'verano', 'Centro de Formación',
   '{2026-12-14,2026-12-16,2026-12-18}', '{1,3,5}', '15:30', '18:30',
   'Combinar el oficio teatral de confección y manipulación de títeres con el lenguaje audiovisual (cámara, iluminación y sonido) para rodar un cortometraje navideño en equipo.',
   '', '', '#F8384B', true, 106),
  ('Taller de Creación de Máscaras', 'verano', 'Arte y Apoyo',
   '{2026-12-14,2026-12-21}', '{1}', '11:00', '12:45',
   'Fomentar la expresión personal, la comunicación y la regulación emocional a través del arteterapia, construyendo y pintando una máscara tridimensional en cartón y papel en un entorno libre de juicios.',
   '', '', '#7C4DCC', true, 107),
  ('Taller de Preparación Física y Habilidades Sociales', 'verano', '',
   '{2026-12-15}', '{2}', '09:00', '13:00',
   'Fortalecer el autocuidado físico y mental, reducir el tiempo frente a pantallas y potenciar el vínculo social presencial mediante una caminata activa, juegos cooperativos y picnic saludable en plazas cercanas a Spectrum.',
   '', 'Incluye colación.', '#5A9E3A', true, 108),
  ('Taller Animación Digital (8 Horas)', 'verano', 'Centro de Formación',
   '{2026-12-11,2026-12-12,2026-12-18,2026-12-19}', '{5,6}', '16:00', '18:00',
   'Programa práctico intensivo de 8 horas totales distribuidas en dos fines de semana (viernes y sábado).',
   '14 años o más', '', '#31B4E7', true, 101),
  ('Taller Animación Stopmotion (8 Horas)', 'verano', 'Centro de Formación',
   '{2026-12-11,2026-12-12,2026-12-18,2026-12-19}', '{5,6}', '11:00', '13:00',
   'Programa práctico intensivo de 8 horas totales distribuidas en dos fines de semana (viernes y sábado).',
   '8 a 12 años', '', '#1F8FBF', true, 102),
  ('Taller de Creación de Videojuegos (Verano 2027)', 'verano', 'Centro de Formación',
   '{2027-01-04,2027-01-06,2027-01-08,2027-01-11}', '{1,3,5}', '11:00', '12:45',
   'Desarrollar habilidades de diseño visual en pixel art y programación lógica creando una sala propia con desafíos y sonido, para unir todas las creaciones en un único videojuego colectivo.',
   '', '', '#00BC70', true, 109),
  ('Taller de Cortometraje de Verano 1', 'verano', 'Centro de Formación',
   '{2027-01-04,2027-01-05,2027-01-06,2027-01-07,2027-01-08}', '{1,2,3,4,5}', '10:00', '13:00',
   'Vivir el proceso real de producción cinematográfica asumiendo roles activos frente y detrás de cámara, fortaleciendo el trabajo colaborativo y la autonomía en set para estrenar una película original en familia.',
   '', 'Viernes: jornada extendida de 10:00 a 18:00.', '#E0B800', true, 110),
  ('Taller de Cortometraje de Verano 2', 'verano', 'Centro de Formación',
   '{2027-01-11,2027-01-12,2027-01-13,2027-01-14,2027-01-15}', '{1,2,3,4,5}', '10:00', '13:00',
   'Crear y filmar un cortometraje colectivo desde la lluvia de ideas hasta el rodaje en estudio, potenciando las habilidades sociales y la creatividad grupal en un ambiente estructurado.',
   '', 'Viernes: jornada extendida de 10:00 a 18:00.', '#F28C28', true, 111)
on conflict do nothing;
