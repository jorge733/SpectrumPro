-- Sitio web: todo el sitio editable desde la plataforma (2.ª parte).
--
-- · Dos listas nuevas: «cinta» (las palabras que giran en la portada) y «cliente» (logos de la Productora).
-- · Los demás textos, botones, imágenes, títulos de Google, secciones visibles y el aviso superior se
--   guardan en sitio_textos con su propia clave; mientras nadie los edite, el sitio muestra lo que trae el HTML.
-- · version_contenido = 2 le indica al sitio que ya puede confiar en estas listas (antes usa su respaldo).
-- Requiere 20261127020000_sitio_web.sql. Se puede ejecutar más de una vez sin duplicar nada.

alter table public.sitio_elementos drop constraint if exists sitio_tipo_valido;
alter table public.sitio_elementos add constraint sitio_tipo_valido
  check (tipo in ('valor', 'equipo', 'taller', 'mentoria', 'modulo', 'apoyo', 'actividad', 'servicio', 'produccion', 'cinta', 'cliente'));

insert into public.sitio_elementos (tipo, titulo, imagen, orden)
select * from (values
  ('cinta', 'Dibujo', '', 1),
  ('cinta', 'Animación', '', 2),
  ('cinta', 'Stop motion', '', 3),
  ('cinta', 'Videojuegos', '', 4),
  ('cinta', 'Modelado 3D', '', 5),
  ('cinta', 'Teatro', '', 6),
  ('cinta', 'Títeres', '', 7),
  ('cinta', 'Juegos de rol', '', 8),
  ('cinta', 'Edición', '', 9),
  ('cinta', 'Arte terapia', '', 10),
  ('cinta', 'Humor absurdo', '', 11),
  ('cinta', 'Ilustración digital', '', 12)
) as v (tipo, titulo, imagen, orden)
where not exists (select 1 from public.sitio_elementos where tipo = 'cinta');

insert into public.sitio_elementos (tipo, titulo, imagen, orden)
select * from (values
  ('cliente', 'Fundación Serinclusivo', '/sitio/img/logos/fundacion-serinclusivo.webp', 1),
  ('cliente', 'Corporación Apertus', '/sitio/img/logos/corporacion-apertus.webp', 2),
  ('cliente', 'Facultad de Arquitectura y Urbanismo, Universidad de Chile', '/sitio/img/logos/fau-universidad-de-chile.webp', 3),
  ('cliente', 'Orica', '/sitio/img/logos/orica.webp', 4),
  ('cliente', 'Festival Aprender', '/sitio/img/logos/festival-aprender.webp', 5),
  ('cliente', 'Red Salas de Teatro Metropolitana', '/sitio/img/logos/red-salas-de-teatro.webp', 6),
  ('cliente', 'Ilusión Country', '/sitio/img/logos/ilusion-country.webp', 7),
  ('cliente', 'Panoramas Accesibles', '/sitio/img/logos/panoramas-accesibles.webp', 8),
  ('cliente', 'RLA Event Technologies', '/sitio/img/logos/rla.webp', 9),
  ('cliente', 'Lustro Gestión Cultural', '/sitio/img/logos/lustro.webp', 10),
  ('cliente', 'Ogilvy', '/sitio/img/logos/ogilvy.webp', 11),
  ('cliente', 'Ingeroc, Ingeniería de Rocas', '/sitio/img/logos/ingeroc.webp', 12),
  ('cliente', 'Fundación Vida Independiente Chile', '/sitio/img/logos/fundacion-vida-independiente.webp', 13),
  ('cliente', 'Lotus', '/sitio/img/logos/lotus.webp', 14)
) as v (tipo, titulo, imagen, orden)
where not exists (select 1 from public.sitio_elementos where tipo = 'cliente');

insert into public.sitio_textos (clave, valor) values ('version_contenido', '2')
on conflict (clave) do update set valor = '2';
