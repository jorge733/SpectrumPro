-- Rol «equipo»: personas de SpectrumPro que no pasan lista ni ven fichas
-- (gestión, asistentes, productora…). Entran a la plataforma, ponen su
-- cumpleaños y ven cumpleaños y talleres.
--
-- No hace falta tocar las políticas de seguridad: las fichas y la asistencia
-- solo las ven dirección, terapeutas y talleristas de cada taller, y una cuenta
-- de equipo no está a cargo de ningún taller. Los talleres y los cumpleaños
-- ya son visibles para cualquier cuenta activa.
alter type public.rol_usuario add value if not exists 'equipo';

-- Cumpleaños con año desconocido: se guardan con el año 1904 (bisiesto, admite
-- el 29 de febrero) y la plataforma no muestra la edad.
comment on column public.perfiles.fecha_nac is 'Fecha de nacimiento. Año 1904 = año desconocido (no se muestra la edad).';
