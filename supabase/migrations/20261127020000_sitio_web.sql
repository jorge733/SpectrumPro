-- Sitio web público (spectrumpro.cl) editable desde la plataforma, sección «Sitio web».
--
-- · sitio_textos: textos sueltos y datos de contacto (clave → valor).
-- · sitio_elementos: listas del sitio (valores, equipo, talleres, mentorías, módulos,
--   apoyos, actividades, servicios y producciones).
-- · El público (anon) solo LEE: todos los textos y los elementos visibles.
-- · Dirección y el rol Equipo editan todo. Cada cambio queda en la auditoría.
-- · Las fotos se guardan en el bucket público «sitio» de Storage.
-- Requiere 20261124040000_rol_equipo.sql. Se puede ejecutar más de una vez sin duplicar nada.

create or replace function public.puede_editar_sitio()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(public.rol_actual()::text in ('admin', 'equipo'), false) $$;

revoke execute on function public.puede_editar_sitio() from public, anon;
grant execute on function public.puede_editar_sitio() to authenticated;

-- ---------------------------------------------------------------------------
-- Textos
-- ---------------------------------------------------------------------------
create table if not exists public.sitio_textos (
  clave        text primary key,
  valor        text not null default '',
  actualizado  timestamptz not null default now(),

  constraint sitio_textos_clave_formato check (clave ~ '^[a-z0-9_]{1,60}$'),
  constraint sitio_textos_valor_largo   check (char_length(valor) <= 3000)
);

drop trigger if exists tocar_sitio_textos on public.sitio_textos;
create trigger tocar_sitio_textos before update on public.sitio_textos
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- Elementos de las listas
-- ---------------------------------------------------------------------------
create table if not exists public.sitio_elementos (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,
  titulo       text not null,
  subtitulo    text not null default '',
  texto        text not null default '',
  lista        text not null default '',     -- una línea por punto (objetivos de un taller)
  nota         text not null default '',
  imagen       text not null default '',     -- URL de la foto (Storage o /sitio/img/…)
  enlace       text not null default '',
  orden        integer not null default 0,
  visible      boolean not null default true,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now(),

  constraint sitio_tipo_valido      check (tipo in ('valor', 'equipo', 'taller', 'mentoria', 'modulo', 'apoyo', 'actividad', 'servicio', 'produccion')),
  constraint sitio_titulo_largo     check (char_length(trim(titulo)) between 1 and 120),
  constraint sitio_subtitulo_largo  check (char_length(subtitulo) <= 160),
  constraint sitio_texto_largo      check (char_length(texto) <= 3000),
  constraint sitio_lista_largo      check (char_length(lista) <= 2000),
  constraint sitio_nota_largo       check (char_length(nota) <= 500),
  constraint sitio_imagen_largo     check (char_length(imagen) <= 500),
  constraint sitio_enlace_largo     check (char_length(enlace) <= 500)
);
create index if not exists sitio_elementos_orden on public.sitio_elementos (tipo, orden);

drop trigger if exists tocar_sitio_elementos on public.sitio_elementos;
create trigger tocar_sitio_elementos before update on public.sitio_elementos
  for each row execute function public.tocar_actualizado();

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------
alter table public.sitio_textos enable row level security;
alter table public.sitio_elementos enable row level security;

drop policy if exists sitio_textos_ver on public.sitio_textos;
create policy sitio_textos_ver on public.sitio_textos for select to anon, authenticated
  using (true);
drop policy if exists sitio_textos_editar on public.sitio_textos;
create policy sitio_textos_editar on public.sitio_textos for all to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio());

-- El público no puede ejecutar puede_editar_sitio(): su regla de lectura es aparte.
drop policy if exists sitio_elementos_ver on public.sitio_elementos;
create policy sitio_elementos_ver on public.sitio_elementos for select to anon
  using (visible);
drop policy if exists sitio_elementos_ver_equipo on public.sitio_elementos;
create policy sitio_elementos_ver_equipo on public.sitio_elementos for select to authenticated
  using (visible or public.puede_editar_sitio());
drop policy if exists sitio_elementos_editar on public.sitio_elementos;
create policy sitio_elementos_editar on public.sitio_elementos for all to authenticated
  using (public.puede_editar_sitio()) with check (public.puede_editar_sitio());

revoke all on public.sitio_textos, public.sitio_elementos from anon, authenticated;
grant usage on schema public to anon;
grant select on public.sitio_textos, public.sitio_elementos to anon;
grant select, insert, update, delete on public.sitio_textos, public.sitio_elementos to authenticated;
grant all on public.sitio_textos, public.sitio_elementos to service_role;

drop trigger if exists auditar_sitio_textos on public.sitio_textos;
create trigger auditar_sitio_textos after insert or update or delete on public.sitio_textos
  for each row execute function public.auditar();
drop trigger if exists auditar_sitio_elementos on public.sitio_elementos;
create trigger auditar_sitio_elementos after insert or update or delete on public.sitio_elementos
  for each row execute function public.auditar();

-- ---------------------------------------------------------------------------
-- Fotos: bucket público «sitio» (máx. 3 MB, solo imágenes)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sitio', 'sitio', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists sitio_fotos_ver on storage.objects;
create policy sitio_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'sitio' and public.puede_editar_sitio());
drop policy if exists sitio_fotos_subir on storage.objects;
create policy sitio_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'sitio' and public.puede_editar_sitio());
drop policy if exists sitio_fotos_cambiar on storage.objects;
create policy sitio_fotos_cambiar on storage.objects for update to authenticated
  using (bucket_id = 'sitio' and public.puede_editar_sitio()) with check (bucket_id = 'sitio' and public.puede_editar_sitio());
drop policy if exists sitio_fotos_borrar on storage.objects;
create policy sitio_fotos_borrar on storage.objects for delete to authenticated
  using (bucket_id = 'sitio' and public.puede_editar_sitio());

-- ---------------------------------------------------------------------------
-- Contenido inicial (el mismo de sitio-web/sitio/contenido.js)
-- ---------------------------------------------------------------------------
insert into public.sitio_textos (clave, valor) values
  ('inicio_titulo', 'Transformando la perspectiva del mundo'),
  ('inicio_bajada', 'Somos una productora audiovisual y centro de formación artística que apuesta por el talento neurodivergente para crear proyectos artísticos únicos.'),
  ('inicio_comunidad', 'Buscamos que todas las personas tengan un espacio a su medida, donde puedan desarrollar sus intereses, divertirse y formar comunidad, sin las presiones y dificultades de los espacios neurotípicos.'),
  ('inicio_video', 'https://youtu.be/HeqezlV1OBs'),
  ('proposito_titulo', 'Transformar la perspectiva del mundo'),
  ('proposito_texto', 'Nacemos en un mundo lleno de posibilidades, pero a lo largo de la vida esas posibilidades se van limitando a una sola forma de hacer las cosas, un estándar, un camino típico y neurotípico.
¿Qué pasaría si pudiéramos habitar el mundo desde otra lógica, con otra perspectiva?
Una perspectiva fresca, espontánea, verdadera y más empática. Hacer del mundo un lugar más auténtico, con nuevas formas, colores e ideas para poder fluir y ser quienes somos. Necesitamos un respiro de lo ya establecido, de lo estructurado, de lo normado.'),
  ('mision', 'Entregar herramientas creativas y sociales a jóvenes neurodivergentes, para potenciar y visibilizar sus talentos.'),
  ('vision', 'Ser un referente en creatividad e inclusión.'),
  ('cultura', 'Una cultura flexible y colaborativa, donde todas y todos tenemos un espacio para ser auténticos y potenciar lo que nos hace únicos.'),
  ('formacion_intro', 'Talleres, mentorías y programas para desarrollar intereses creativos, aprender técnicas audiovisuales y ser parte de un equipo de producción.'),
  ('formapro_texto', 'Actividades con foco formativo orientadas al desarrollo de conocimientos, competencias y sentido de pertenencia a un equipo de producción audiovisual.
Requiere una entrevista previa y tomar al menos 3 módulos, incluyendo al menos uno de formación general (Referentes Culturales, Habilidades para la vida o Arte Terapia). Se pueden sumar talleres adicionales y trabajar en proyectos cuando corresponde.'),
  ('online_texto', 'Espacio abierto a públicos diversos enfocado en la creación de un proyecto animado colectivo, abarcando desde el diseño gráfico, storytelling y guion, hasta las voces y la animación. El proceso combina sesiones grupales online con tareas que los participantes suben a la plataforma para el desarrollo del proyecto.'),
  ('arte_terapia_texto', 'Actividades dirigidas por terapeutas profesionales (psicólogos/as, terapeutas ocupacionales, etc.) con foco terapéutico explícito a partir del arte. Busca promover y fortalecer las habilidades sociales y comunicativas, la integración sensorial, la autocomprensión y la autoestima, mediante talleres artísticos individuales o en grupos pequeños.'),
  ('terapia_ocupacional_texto', 'Talleres guiados por nuestra terapeuta ocupacional para ganar autonomía en la vida diaria a través de actividades concretas y creativas.'),
  ('productora_texto', 'Nuestro equipo de producción es completamente inclusivo. Ofrecemos servicios audiovisuales buscando la excelencia técnica y creativa. Todos los ingresos generados se destinan íntegramente a apoyar la creación de becas, infraestructura técnica y formación de nuestros/as artistas.'),
  ('colabora_donacion', 'Nuestra empresa reinvierte todo su ingreso en el proceso de aprendizaje de nuestros jóvenes. Algunos/as participan pagando un arancel diferenciado y la diferencia se cubre con becas financiadas por colaboradores de SpectrumPro. Apoya nuestro esfuerzo donando la suma que puedas.'),
  ('colabora_suscripcion', 'Algunas personas prefieren apoyarnos mensualmente, para sostener becas y aranceles diferenciados de jóvenes que participan en nuestras actividades. Una suscripción es una donación mensual por la suma que tú definas. No hay monto pequeño: todo contribuye al desarrollo de nuestros/as jóvenes creativos/as.'),
  ('enlace_donacion', 'https://link.mercadopago.cl/spectrumpro'),
  ('enlace_suscripcion', 'https://www.mercadopago.cl/subscriptions/checkout?preapproval_plan_id=2c93808481fd8f080181ff8571c80108'),
  ('direccion', 'Doctor Roberto del Río 1137, Providencia, Santiago, Chile'),
  ('whatsapp', '56996389673'),
  ('correo', 'contacto@spectrumpro.cl'),
  ('instagram', 'spectrumpro.cl'),
  ('youtube', 'https://www.youtube.com/@spectrumpro1710'),
  ('linkedin', 'https://www.linkedin.com/company/spectrum-pro/'),
  ('patreon', 'https://www.patreon.com/cw/spectrumpro')
on conflict (clave) do nothing;

-- Los elementos se cargan solo si la tabla está vacía (para no duplicar ni pisar lo editado).
insert into public.sitio_elementos (tipo, titulo, subtitulo, texto, lista, nota, imagen, enlace, orden)
select * from (values
  ('valor', 'Libertad', '', 'Para ser tú mismo.', '', '', '', '', 1),
  ('valor', 'Empatía', '', 'Para entender y aceptarnos en las diferencias.', '', '', '', '', 2),
  ('valor', 'Creatividad', '', 'Para explorar y validar los propios imaginarios.', '', '', '', '', 3),
  ('valor', 'Colaboración', '', 'Para aprender y crecer con otros.', '', '', '', '', 4),
  ('valor', 'Diversión', '', 'Como principal motor de aprendizaje.', '', '', '', '', 5),
  ('equipo', 'Rosario Pavez', 'Directora General', 'Socióloga y especialista certificada por la National Autistic Society del Reino Unido. Como fundadora de SpectrumPro, lidera la visión estratégica de la organización. En el área de producción, es el primer punto de contacto con los clientes y coordina los proyectos.', '', 'rosario@spectrumpro.cl', '/sitio/img/eq-rosario-pavez.webp', '', 1),
  ('equipo', 'Gabriela Banderas', 'Directora de Formación', 'Actriz y docente con amplia trayectoria en la enseñanza. Es responsable de FormaPro, el programa cuyos módulos se orientan al desarrollo de conocimientos, competencias y sentido de pertenencia, y participa como relatora en las capacitaciones de la organización.', '', 'gabriela@spectrumpro.cl', '/sitio/img/eq-gabriela-banderas.webp', '', 2),
  ('equipo', 'Gonzalo Pavez', 'Director Audiovisual', 'Director audiovisual y montajista con experiencia en producción cinematográfica y televisiva. Lidera al equipo de editores y supervisa la postproducción de los proyectos internos y de clientes.', '', 'gonzalo@spectrumpro.cl', '/sitio/img/eq-gonzalo-pavez.webp', '', 3),
  ('equipo', 'Alberto Merino', 'Director de Gestión', 'Abogado, académico y especialista en sistemas de formación y capacitación. Como cofundador, está a cargo de la gestión legal y administrativa y coordina las relaciones internacionales de la institución.', '', 'alberto@spectrumpro.cl', '/sitio/img/eq-alberto-merino.webp', '', 4),
  ('equipo', 'Paco Pasquette', 'Encargado Equipo de Títeres y TV', 'Actor, docente, músico y titiritero profesional, con trayectoria en proyectos como 31 Minutos. Aporta en el desarrollo de guiones y dirige el área de títeres en producciones internas y para televisión.', '', '', '/sitio/img/eq-paco-pasquette.webp', '', 5),
  ('equipo', 'Alexandra Torres (Naru)', 'Encargada Equipo de Dibujo e Ilustración', 'Ilustradora especialista en dibujo análogo y digital. Lidera el equipo de ilustración, es relatora en los cursos online y dirige el taller de juegos de rol.', '', '', '/sitio/img/eq-alexandra-torres.webp', '', 6),
  ('equipo', 'Carlos González', 'Encargado Equipo de Animación Digital', 'Licenciado en Artes Visuales y animador profesional. Conduce el área de animación y stop motion, en proyectos internos y para instituciones públicas y privadas.', '', '', '/sitio/img/eq-carlos-gonzalez.webp', '', 7),
  ('equipo', 'Bruno Díaz', 'Encargado Equipo de Videojuegos', 'Programador, diseñador de videojuegos, docente y dibujante. Lidera el área de videojuegos, hace clases de videojuegos y diseño 3D y es profesor en las mentorías online.', '', '', '/sitio/img/eq-bruno-diaz.webp', '', 8),
  ('equipo', 'Pedro González', 'Encargado Equipo de Teatro', 'Docente, ilustrador y bailarín. Dirige la compañía de teatro de la organización y lidera los procesos formativos y de expresión corporal.', '', '', '/sitio/img/eq-pedro-gonzalez.webp', '', 9),
  ('equipo', 'Vicente Bernal', 'Encargado Área de Artes y Apoyo', 'Psicólogo y arteterapeuta, especializado en el trabajo grupal y en procesos creativos como herramientas de expresión y acompañamiento. Está a cargo del Laboratorio Creativo y de Arte Terapia.', '', '', '/sitio/img/eq-vicente-bernal.webp', '', 10),
  ('equipo', 'Laura Quintana', 'Terapeuta ocupacional', 'Terapeuta ocupacional, maestra waldorf y creadora textil, con experiencia en salud y educación.', '', '', '/sitio/img/eq-laura-quintana.webp', '', 11),
  ('equipo', 'Paula Jiménez', 'Arteterapeuta', 'Actriz, arteterapeuta y profesora de teatro y canto. Facilita Arte Terapia, sumando a los procesos plásticos y audiovisuales el cuerpo y la voz para contar historias.', '', '', '/sitio/img/eq-paula-jimenez.webp', '', 12),
  ('equipo', 'Benjamín Villalobos', 'Tallerista', 'Actor, montajista y docente. Colabora en producciones internas y externas y dirige el Club de Tonteras.', '', '', '/sitio/img/eq-benjamin-villalobos.webp', '', 13),
  ('equipo', 'Sebastián Ramírez', 'Asistente audiovisual', 'Apoya el desarrollo técnico y logístico de las producciones: equipos, cámaras e iluminación listos para operar. Capacitado por SpectrumPro.', '', '', '/sitio/img/eq-sebastian-ramirez.webp', '', 15),
  ('equipo', 'Diego Pedraza', 'Diseñador gráfico', 'Transforma ideas y mensajes en composiciones visuales, combinando tipografías, colores, imágenes y espacios. Capacitado por SpectrumPro.', '', '', '/sitio/img/eq-diego-pedraza.webp', '', 16),
  ('equipo', 'Adán Rodríguez', 'Asistente de Arte', 'Artista transdisciplinario. Diseña y realiza títeres y construye la escenografía de las producciones.', '', '', '/sitio/img/eq-adan-rodriguez.webp', '', 17),
  ('taller', 'Dibujo e Ilustración', 'Naru Torres', 'Taller introductorio a técnicas tradicionales de dibujo e ilustración, con foco en fundamentos gráficos y exploración creativa guiada.', 'Desarrollar habilidades básicas de observación, trazo, composición y color.
Conocer principios simples de narrativa visual en ilustración.
Favorecer un espacio participativo y amistoso de creación personal.', 'Cada participante elabora un conjunto de dibujos e ilustraciones aplicando técnicas básicas y criterios simples de composición.', '/sitio/img/ta-dibujo.webp', '', 1),
  ('taller', 'Dibujo e Ilustración Digital', 'Naru Torres', 'Taller práctico introductorio a técnicas digitales con tabletas y software gráfico: pinceles virtuales, capas, color y narrativa visual, en un espacio de creación amigable.', '', 'Cada participante elabora un conjunto de dibujos e ilustraciones digitales aplicando técnicas básicas de composición y criterios propios.', '/sitio/img/ta-dibujo.webp', '', 2),
  ('taller', 'Animación Stop-Motion', 'Carlos González', 'Proyecto centrado en el corto «The Office Break»: guion, creación de personajes, maquetas, puppets, cámara y edición en stop motion.', 'Desarrollar habilidades en construcción de personajes y escenografías físicas.
Comprender el proceso técnico del stop motion, desde el rodaje hasta el montaje.
Fomentar la paciencia, la precisión y el trabajo en equipo.', 'Cada participante produce y anima planos o escenas que se integran al corto colectivo.', '/sitio/img/ta-stopmotion.webp', '', 3),
  ('taller', 'Modelado 3D', '', 'Iniciación al diseño tridimensional con Blender, software profesional de código abierto: interfaz, flujo de trabajo y herramientas esenciales de modelado. Dirigido a principiantes sin experiencia previa.', '', 'Cada participante crea su propia criatura u objeto tridimensional, una base sólida para seguir explorando el diseño digital.', '/sitio/img/ta-3d.webp', '', 4),
  ('taller', 'Creación de Videojuegos', 'Bruno Díaz', 'Taller introductorio para diseñar y programar videojuegos simples con Construct 3, integrando concepto, personajes, jugabilidad, sonido e interacción básica.', 'Explorar el lenguaje de los videojuegos como medio de expresión.
Desarrollar nociones básicas de diseño de niveles, lógica de juego y recursos audiovisuales.
Fomentar el trabajo autónomo y la perseverancia en un proyecto propio.', 'Cada participante diseña y programa un videojuego sencillo, jugable y con identidad propia.', '/sitio/img/ta-videojuegos.webp', '', 5),
  ('taller', 'Juegos de Rol', 'Carlos González y Naru Torres', 'Taller de alta socialización en torno a juegos de rol narrativos, donde se crean personajes y se viven aventuras imaginarias en grupo.', 'Promover habilidades sociales, comunicación y toma de decisiones colectivas.
Desarrollar la imaginación y la construcción de personajes e historias.
Fomentar el respeto a turnos, reglas y acuerdos del grupo.', 'Cada participante sostiene un personaje dentro de una campaña, interactuando con el grupo y la narrativa.', '/sitio/img/ta-rol.webp', '', 6),
  ('taller', 'Teatro', 'Pedro González', 'Compañía teatral que desarrolla montajes como «La Tempestad» y «Hamlet» de Shakespeare, con trabajo serio y sostenido de elenco.', 'Profundizar en la formación actoral para escena teatral.
Desarrollar disciplina de ensayo, memorización y trabajo en elenco.
Explorar textos clásicos desde una mirada propia del grupo.', 'Cada participante interpreta un personaje en el montaje, con ensayos y funciones programadas.', '/sitio/img/ta-escena.webp', 'https://youtu.be/yl8qVgpDaTY', 7),
  ('taller', 'Títeres y TV', 'Paco Pasquette y Gonzalo Pavez', 'Taller práctico para crear historias con títeres, diseñar personajes y escenografías y producir pequeñas piezas audiovisuales en tono humorístico.', 'Explorar la animación con títeres como forma de expresión escénica y audiovisual.
Desarrollar habilidades básicas de construcción de títeres y escenografía.
Practicar la actuación, la manipulación y el trabajo en equipo frente a cámara.', 'Cada participante colabora en la producción de una escena audiovisual con títeres, en la creación y en la representación.', '/sitio/img/ta-titeres.webp', '', 8),
  ('taller', 'Club de Tonteras', 'Benjamín Villalobos', 'Taller de humor audiovisual para crear sketches inspirados en la tradición del humor absurdo (Monty Python, Plan Z y otros).', 'Explorar el humor como recurso creativo en el lenguaje audiovisual.
Desarrollar habilidades básicas de guion corto, actuación y grabación de sketches.
Fortalecer la confianza y la espontaneidad en un entorno grupal lúdico.', 'Cada participante crea y graba al menos un sketch de humor absurdo.', '/sitio/img/ta-escena.webp', '', 9),
  ('mentoria', 'Dibujo Digital o Análogo', 'Alexandra Torres (Naru)', 'Aprendizaje personalizado para dominar técnicas de ilustración, software de diseño y tabletas digitalizadoras. Es una de las principales vías de ingreso a SpectrumPro: busca descubrir el talento de cada participante con contención, apoyo y un ambiente seguro desde el primer día.', '', '', '', '', 1),
  ('mentoria', 'Creación de Videojuegos y Animación 3D', 'Bruno Díaz', 'Guía individual adaptada a los intereses de cada estudiante, desde fundamentos de animación hasta motores de desarrollo. Funciona como bienvenida a la productora: nos permite conocer en profundidad a cada joven y potenciar sus habilidades en modelado y videojuegos.', '', '', '', '', 2),
  ('mentoria', 'Edición de Videos e Introducción a IA', 'Gonzalo Pavez', 'Acompañamiento técnico individual desde el montaje audiovisual básico hasta el uso estratégico de herramientas de inteligencia artificial. Un punto de partida para identificar las habilidades de cada participante y orientarlas a proyectos de postproducción.', '', '', '', '', 3),
  ('modulo', 'Referentes Culturales', '', 'Análisis, reflexión y comprensión cultural a través de obras audiovisuales. Los participantes exploran diversos lenguajes artísticos y desarrollan una mirada crítica que nutre sus propios intereses creativos.', '', '', '', '', 1),
  ('modulo', 'Expresión Corporal y Creación Escénica', '', 'Expresión a través del cuerpo, la improvisación y la voz. Se desarrolla conciencia corporal, confianza y conexión con las emociones en un entorno seguro, y se montan pequeñas piezas dramáticas.', '', '', '', '', 2),
  ('modulo', 'Expresión vocal', '', 'Desarrollo de la expresión oral con la voz, la interpretación y herramientas de la narrativa literaria. Con improvisación y narración se construyen personajes y relatos, y el proceso termina con breves performances escénicas.', '', '', '', '', 3),
  ('modulo', 'Preparación Física y Habilidades Sociales', 'Gabriela Banderas', 'Fortalecer el autocuidado físico y mental, reducir el tiempo frente a pantallas y potenciar el vínculo social presencial mediante una caminata activa, juegos cooperativos y picnic saludable en plazas cercanas a Spectrum.', '', '', '', '', 4),
  ('modulo', 'Habilidades para la vida diaria con Cocina', 'Gabriela Banderas', 'Taller práctico para avanzar hacia la autonomía y la vida independiente a través de la cocina: planificar un menú, preparar recetas paso a paso, cuidar la higiene y el autocuidado, y colaborar en equipo para compartir lo cocinado.', '', '', '', '', 5),
  ('modulo', 'Revisteros', 'Gabriela Banderas', 'Un proyecto de análisis y crítica de cine, series, documentales y videojuegos que reúne reseñas, ensayos y recomendaciones donde la opinión informada se encuentra con una mirada creativa. Aquí abrimos un espacio cercano para conversar sobre la cultura audiovisual, mientras jóvenes creadores dan vida a una revista digital y aprenden el oficio de redactar.', '', '', '', '', 6),
  ('modulo', 'Taller de Cortometrajes', 'Gabriela Banderas y Gonzalo Pavez', 'Una experiencia creativa y colaborativa guiada por una actriz y un director audiovisual, donde se recorre todo el proceso de hacer cine desde la idea hasta el rodaje. A través de la elaboración de guion, la actuación y el trabajo en equipo, las y los participantes fortalecen habilidades sociales clave como la comunicación, la escucha, la empatía y la resolución conjunta de desafíos, integrando además elementos esenciales de puesta en escena como arte escénico, vestuario, maquillaje y producción para dar vida a sus propias historias.', '', '', '', '', 7),
  ('actividad', 'Cine Club', '', '', '', '', '', '', 1),
  ('actividad', 'Eventos', '', '', '', '', '', '', 2),
  ('apoyo', 'Laboratorio Creativo', 'Arte Terapia', 'La puerta de entrada al área de Arte y Apoyo: un espacio semanal personalizado de exploración y creación para descubrir los intereses y talentos de cada participante, en un entorno respetuoso.', '', '', '', '', 1),
  ('apoyo', 'Cuentos con Vellón', 'Terapia Ocupacional', 'Espacio creativo y terapéutico donde se combina el oficio artesanal del vellón con la narración audiovisual, trabajando materiales nobles y en equipo para dar vida a historias originales.', '', 'Laura Quintana, Terapeuta Ocupacional', '', '', 3),
  ('servicio', 'Videos corporativos', '', 'Piezas audiovisuales para presentar empresas o proyectos en sitios web, redes sociales, ferias o eventos.', '', '', '', '', 1),
  ('servicio', 'Registro de eventos', '', 'Registro audiovisual de actividades académicas, empresariales, artísticas y sociales.', '', '', '', '', 2),
  ('servicio', 'Transmisiones en vivo', '', 'Transmisión de eventos de diversa naturaleza por redes sociales y otras plataformas.', '', '', '', '', 3),
  ('servicio', 'Animaciones y piezas gráficas', '', 'Para videos, sitios web, presentaciones u otros soportes, para diferenciar el mensaje y transmitir una idea de forma amigable.', '', '', '', '', 4),
  ('servicio', 'Audio y podcast', '', 'Apoyo en la idea creativa y en todo lo técnico de un podcast, programa radial o radioteatro.', '', '', '', '', 5),
  ('servicio', 'Locución', '', 'Locutores y locutoras profesionales que aportan un elemento distintivo a tu mensaje de audio.', '', '', '', '', 6),
  ('servicio', 'Arriendo de salas', '', 'Salas para capacitación, estudio audiovisual, ensayo y estudio de audio. Pide las especificaciones técnicas por correo.', '', '', '', '', 7),
  ('produccion', 'Metamopatosis', 'Trailer', '', '', '', '/sitio/img/pr-metamopatosis.webp', 'https://youtu.be/8lm-lVkyFtM', 1),
  ('produccion', 'The Gruffalo', 'Trailer', '', '', '', '/sitio/img/pr-gruffalo.webp', 'https://youtu.be/cMKg1UW3jrg', 2),
  ('produccion', 'La Maldición del Cuadro', 'Trailer', '', '', '', '/sitio/img/pr-maldicion.webp', 'https://youtu.be/LuXGJBaeub0', 3),
  ('produccion', 'El Laboratorio del Doctor Jeremías', 'Trailer', '', '', '', '/sitio/img/pr-jeremias.webp', 'https://youtu.be/X6Dw9_JBkkY', 4),
  ('produccion', 'La Tempestad', 'Obra completa', '', '', '', '/sitio/img/fo-teatro.webp', 'https://youtu.be/yl8qVgpDaTY', 5)
) as v (tipo, titulo, subtitulo, texto, lista, nota, imagen, enlace, orden)
where not exists (select 1 from public.sitio_elementos);
