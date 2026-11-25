#!/usr/bin/env python3
"""Contenido inicial del sitio público (tomado de spectrumpro.cl en noviembre de 2026).

Genera dos archivos a partir de los mismos datos:
  · sitio/contenido.js  → copia de respaldo que el sitio usa si Supabase no responde.
  · supabase/migrations/20261125010000_sitio.sql (bloque de carga inicial, entre marcas).

Uso:  python3 sitio/contenido-inicial.py
Después de la carga inicial, el contenido se edita en la plataforma (sección «Sitio web»);
este archivo ya no se usa para cambios del día a día.
"""
import json, pathlib, re

RAIZ = pathlib.Path(__file__).resolve().parent.parent

TEXTOS = {
    # Inicio
    'inicio_titulo': 'Transformando la perspectiva del mundo',
    'inicio_bajada': 'Somos una productora audiovisual y centro de formación artística que apuesta por el talento neurodivergente para crear proyectos artísticos únicos.',
    'inicio_comunidad': 'Buscamos que todas las personas tengan un espacio a su medida, donde puedan desarrollar sus intereses, divertirse y formar comunidad, sin las presiones y dificultades de los espacios neurotípicos.',
    'inicio_video': 'https://youtu.be/HeqezlV1OBs',
    # Nosotros
    'proposito_titulo': 'Transformar la perspectiva del mundo',
    'proposito_texto': 'Nacemos en un mundo lleno de posibilidades, pero a lo largo de la vida esas posibilidades se van limitando a una sola forma de hacer las cosas, un estándar, un camino típico y neurotípico.\n¿Qué pasaría si pudiéramos habitar el mundo desde otra lógica, con otra perspectiva?\nUna perspectiva fresca, espontánea, verdadera y más empática. Hacer del mundo un lugar más auténtico, con nuevas formas, colores e ideas para poder fluir y ser quienes somos. Necesitamos un respiro de lo ya establecido, de lo estructurado, de lo normado.',
    'mision': 'Entregar herramientas creativas y sociales a jóvenes neurodivergentes, para potenciar y visibilizar sus talentos.',
    'vision': 'Ser un referente en creatividad e inclusión.',
    'cultura': 'Una cultura flexible y colaborativa, donde todas y todos tenemos un espacio para ser auténticos y potenciar lo que nos hace únicos.',
    # Formación
    'formacion_intro': 'Talleres, mentorías y programas para desarrollar intereses creativos, aprender técnicas audiovisuales y ser parte de un equipo de producción.',
    'formapro_texto': 'Actividades con foco formativo orientadas al desarrollo de conocimientos, competencias y sentido de pertenencia a un equipo de producción audiovisual.\nRequiere una entrevista previa y tomar al menos 3 módulos, incluyendo al menos uno de formación general (Referentes Culturales, Habilidades para la vida o Arte Terapia). Se pueden sumar talleres adicionales y trabajar en proyectos cuando corresponde.',
    'online_texto': 'Espacio abierto a públicos diversos enfocado en la creación de un proyecto animado colectivo, abarcando desde el diseño gráfico, storytelling y guion, hasta las voces y la animación. El proceso combina sesiones grupales online con tareas que los participantes suben a la plataforma para el desarrollo del proyecto.',
    # Arte y Apoyo
    'arte_terapia_texto': 'Actividades dirigidas por terapeutas profesionales (psicólogos/as, terapeutas ocupacionales, etc.) con foco terapéutico explícito a partir del arte. Busca promover y fortalecer las habilidades sociales y comunicativas, la integración sensorial, la autocomprensión y la autoestima, mediante talleres artísticos individuales o en grupos pequeños.',
    'terapia_ocupacional_texto': 'Talleres guiados por nuestra terapeuta ocupacional para ganar autonomía en la vida diaria a través de actividades concretas y creativas.',
    # Productora
    'productora_texto': 'Nuestro equipo de producción es completamente inclusivo. Ofrecemos servicios audiovisuales buscando la excelencia técnica y creativa. Todos los ingresos generados se destinan íntegramente a apoyar la creación de becas, infraestructura técnica y formación de nuestros/as artistas.',
    # Colabora
    'colabora_donacion': 'Nuestra empresa reinvierte todo su ingreso en el proceso de aprendizaje de nuestros jóvenes. Algunos/as participan pagando un arancel diferenciado y la diferencia se cubre con becas financiadas por colaboradores de SpectrumPro. Apoya nuestro esfuerzo donando la suma que puedas.',
    'colabora_suscripcion': 'Algunas personas prefieren apoyarnos mensualmente, para sostener becas y aranceles diferenciados de jóvenes que participan en nuestras actividades. Una suscripción es una donación mensual por la suma que tú definas. No hay monto pequeño: todo contribuye al desarrollo de nuestros/as jóvenes creativos/as.',
    'enlace_donacion': 'https://link.mercadopago.cl/spectrumpro',
    'enlace_suscripcion': 'https://www.mercadopago.cl/subscriptions/checkout?preapproval_plan_id=2c93808481fd8f080181ff8571c80108',
    # Contacto
    'direccion': 'Doctor Roberto del Río 1137, Providencia, Santiago, Chile',
    'whatsapp': '56996389673',
    'correo': 'administracion@spectrumpro.cl',
    'instagram': 'spectrumpro.cl',
    'youtube': 'https://www.youtube.com/@spectrumpro1710',
    'patreon': 'https://www.patreon.com/cw/spectrumpro',
}

def e(tipo, titulo, subtitulo='', texto='', lista='', nota='', imagen='', enlace=''):
    return dict(tipo=tipo, titulo=titulo, subtitulo=subtitulo, texto=texto, lista=lista, nota=nota, imagen=imagen, enlace=enlace)

I = '/sitio/img/'
ELEMENTOS = [
    # Valores
    e('valor', 'Libertad', texto='Para ser tú mismo.'),
    e('valor', 'Empatía', texto='Para entender y aceptarnos en las diferencias.'),
    e('valor', 'Creatividad', texto='Para explorar y validar los propios imaginarios.'),
    e('valor', 'Colaboración', texto='Para aprender y crecer con otros.'),
    e('valor', 'Diversión', texto='Como principal motor de aprendizaje.'),

    # Equipo (orden del sitio actual)
    e('equipo', 'Rosario Pavez', 'Directora General', 'Socióloga y especialista certificada por la National Autistic Society del Reino Unido. Como fundadora de SpectrumPro, lidera la visión estratégica de la organización. En el área de producción, es el primer punto de contacto con los clientes y coordina los proyectos.', nota='rosario@spectrumpro.cl', imagen=I + 'eq-rosario-pavez.webp'),
    e('equipo', 'Gabriela Banderas', 'Directora de Formación', 'Actriz y docente con amplia trayectoria en la enseñanza. Es responsable de FormaPro, el programa cuyos módulos se orientan al desarrollo de conocimientos, competencias y sentido de pertenencia, y participa como relatora en las capacitaciones de la organización.', nota='gabriela@spectrumpro.cl', imagen=I + 'eq-gabriela-banderas.webp'),
    e('equipo', 'Gonzalo Pavez', 'Director Audiovisual', 'Director audiovisual y montajista con experiencia en producción cinematográfica y televisiva. Lidera al equipo de editores y supervisa la postproducción de los proyectos internos y de clientes.', nota='gonzalo@spectrumpro.cl', imagen=I + 'eq-gonzalo-pavez.webp'),
    e('equipo', 'Alberto Merino', 'Director de Gestión', 'Abogado, académico y especialista en sistemas de formación y capacitación. Como cofundador, está a cargo de la gestión legal y administrativa y coordina las relaciones internacionales de la institución.', nota='alberto@spectrumpro.cl', imagen=I + 'eq-alberto-merino.webp'),
    e('equipo', 'Paco Pasquette', 'Encargado Equipo de Títeres y TV', 'Actor, docente, músico y titiritero profesional, con trayectoria en proyectos como 31 Minutos. Aporta en el desarrollo de guiones y dirige el área de títeres en producciones internas y para televisión.', imagen=I + 'eq-paco-pasquette.webp'),
    e('equipo', 'Alexandra Torres (Naru)', 'Encargada Equipo de Dibujo e Ilustración', 'Ilustradora especialista en dibujo análogo y digital. Lidera el equipo de ilustración, es relatora en los cursos online y dirige el taller de juegos de rol.', imagen=I + 'eq-alexandra-torres.webp'),
    e('equipo', 'Carlos González', 'Encargado Equipo de Animación Digital', 'Licenciado en Artes Visuales y animador profesional. Conduce el área de animación y stop motion, en proyectos internos y para instituciones públicas y privadas.', imagen=I + 'eq-carlos-gonzalez.webp'),
    e('equipo', 'Bruno Díaz', 'Encargado Equipo de Videojuegos', 'Programador, diseñador de videojuegos, docente y dibujante. Lidera el área de videojuegos, hace clases de videojuegos y diseño 3D y es profesor en las mentorías online.', imagen=I + 'eq-bruno-diaz.webp'),
    e('equipo', 'Pedro González', 'Encargado Equipo de Teatro', 'Docente, ilustrador y bailarín. Dirige la compañía de teatro de la organización y lidera los procesos formativos y de expresión corporal.', imagen=I + 'eq-pedro-gonzalez.webp'),
    e('equipo', 'Vicente Bernal', 'Encargado Área de Artes y Apoyo', 'Psicólogo y arteterapeuta, especializado en el trabajo grupal y en procesos creativos como herramientas de expresión y acompañamiento. Está a cargo del Laboratorio Creativo y de Arte Terapia.', imagen=I + 'eq-vicente-bernal.webp'),
    e('equipo', 'Laura Quintana', 'Terapeuta ocupacional', 'Terapeuta ocupacional, maestra waldorf y creadora textil, con experiencia en salud y educación.', imagen=I + 'eq-laura-quintana.webp'),
    e('equipo', 'Paula Jiménez', 'Arteterapeuta', 'Actriz, arteterapeuta y profesora de teatro y canto. Facilita Arte Terapia, sumando a los procesos plásticos y audiovisuales el cuerpo y la voz para contar historias.', imagen=I + 'eq-paula-jimenez.webp'),
    e('equipo', 'Benjamín Villalobos', 'Tallerista', 'Actor, montajista y docente. Colabora en producciones internas y externas y dirige el Club de Tonteras.', imagen=I + 'eq-benjamin-villalobos.webp'),
    e('equipo', 'Roberto González', 'Ilustrador y animador', 'Artista gráfico y animador que traduce ideas, textos y conceptos en imágenes.', imagen=I + 'eq-roberto-gonzalez.webp'),
    e('equipo', 'Sebastián Ramírez', 'Asistente audiovisual', 'Apoya el desarrollo técnico y logístico de las producciones: equipos, cámaras e iluminación listos para operar. Capacitado por SpectrumPro.', imagen=I + 'eq-sebastian-ramirez.webp'),
    e('equipo', 'Diego Pedraza', 'Diseñador gráfico', 'Transforma ideas y mensajes en composiciones visuales, combinando tipografías, colores, imágenes y espacios. Capacitado por SpectrumPro.', imagen=I + 'eq-diego-pedraza.webp'),
    e('equipo', 'Adán Rodríguez', 'Asistente de Arte', 'Artista transdisciplinario. Diseña y realiza títeres y construye la escenografía de las producciones.', imagen=I + 'eq-adan-rodriguez.webp'),

    # Talleres
    e('taller', 'Dibujo e Ilustración', 'Naru Torres', 'Taller introductorio a técnicas tradicionales de dibujo e ilustración, con foco en fundamentos gráficos y exploración creativa guiada.',
      'Desarrollar habilidades básicas de observación, trazo, composición y color.\nConocer principios simples de narrativa visual en ilustración.\nFavorecer un espacio participativo y amistoso de creación personal.',
      'Cada participante elabora un conjunto de dibujos e ilustraciones aplicando técnicas básicas y criterios simples de composición.', I + 'ta-dibujo.webp'),
    e('taller', 'Dibujo e Ilustración Digital', 'Naru Torres', 'Taller práctico introductorio a técnicas digitales con tabletas y software gráfico: pinceles virtuales, capas, color y narrativa visual, en un espacio de creación amigable.',
      '', 'Cada participante elabora un conjunto de dibujos e ilustraciones digitales aplicando técnicas básicas de composición y criterios propios.', I + 'ta-dibujo.webp'),
    e('taller', 'Animación Stop-Motion', 'Carlos González', 'Proyecto centrado en el corto «The Office Break»: guion, creación de personajes, maquetas, puppets, cámara y edición en stop motion.',
      'Desarrollar habilidades en construcción de personajes y escenografías físicas.\nComprender el proceso técnico del stop motion, desde el rodaje hasta el montaje.\nFomentar la paciencia, la precisión y el trabajo en equipo.',
      'Cada participante produce y anima planos o escenas que se integran al corto colectivo.', I + 'ta-stopmotion.webp'),
    e('taller', 'Modelado 3D', '', 'Iniciación al diseño tridimensional con Blender, software profesional de código abierto: interfaz, flujo de trabajo y herramientas esenciales de modelado. Dirigido a principiantes sin experiencia previa.',
      '', 'Cada participante crea su propia criatura u objeto tridimensional, una base sólida para seguir explorando el diseño digital.', I + 'ta-3d.webp'),
    e('taller', 'Creación de Videojuegos', 'Bruno Díaz', 'Taller introductorio para diseñar y programar videojuegos simples con Construct 3, integrando concepto, personajes, jugabilidad, sonido e interacción básica.',
      'Explorar el lenguaje de los videojuegos como medio de expresión.\nDesarrollar nociones básicas de diseño de niveles, lógica de juego y recursos audiovisuales.\nFomentar el trabajo autónomo y la perseverancia en un proyecto propio.',
      'Cada participante diseña y programa un videojuego sencillo, jugable y con identidad propia.', I + 'ta-videojuegos.webp'),
    e('taller', 'Juegos de Rol', 'Carlos González y Naru Torres', 'Taller de alta socialización en torno a juegos de rol narrativos, donde se crean personajes y se viven aventuras imaginarias en grupo.',
      'Promover habilidades sociales, comunicación y toma de decisiones colectivas.\nDesarrollar la imaginación y la construcción de personajes e historias.\nFomentar el respeto a turnos, reglas y acuerdos del grupo.',
      'Cada participante sostiene un personaje dentro de una campaña, interactuando con el grupo y la narrativa.', I + 'ta-rol.webp'),
    e('taller', 'Teatro', 'Pedro González', 'Compañía teatral que desarrolla montajes como «La Tempestad» y «Hamlet» de Shakespeare, con trabajo serio y sostenido de elenco.',
      'Profundizar en la formación actoral para escena teatral.\nDesarrollar disciplina de ensayo, memorización y trabajo en elenco.\nExplorar textos clásicos desde una mirada propia del grupo.',
      'Cada participante interpreta un personaje en el montaje, con ensayos y funciones programadas.', I + 'ta-escena.webp', 'https://youtu.be/yl8qVgpDaTY'),
    e('taller', 'Títeres y TV', 'Paco Pasquette y Gonzalo Pavez', 'Taller práctico para crear historias con títeres, diseñar personajes y escenografías y producir pequeñas piezas audiovisuales en tono humorístico.',
      'Explorar la animación con títeres como forma de expresión escénica y audiovisual.\nDesarrollar habilidades básicas de construcción de títeres y escenografía.\nPracticar la actuación, la manipulación y el trabajo en equipo frente a cámara.',
      'Cada participante colabora en la producción de una escena audiovisual con títeres, en la creación y en la representación.', I + 'ta-titeres.webp'),
    e('taller', 'Club de Tonteras', 'Benjamín Villalobos', 'Taller de humor audiovisual para crear sketches inspirados en la tradición del humor absurdo (Monty Python, Plan Z y otros).',
      'Explorar el humor como recurso creativo en el lenguaje audiovisual.\nDesarrollar habilidades básicas de guion corto, actuación y grabación de sketches.\nFortalecer la confianza y la espontaneidad en un entorno grupal lúdico.',
      'Cada participante crea y graba al menos un sketch de humor absurdo.', I + 'ta-escena.webp'),

    # Mentorías
    e('mentoria', 'Dibujo Digital o Análogo', 'Alexandra Torres (Naru)', 'Aprendizaje personalizado para dominar técnicas de ilustración, software de diseño y tabletas digitalizadoras. Es una de las principales vías de ingreso a SpectrumPro: busca descubrir el talento de cada participante con contención, apoyo y un ambiente seguro desde el primer día.'),
    e('mentoria', 'Creación de Videojuegos y Animación 3D', 'Bruno Díaz', 'Guía individual adaptada a los intereses de cada estudiante, desde fundamentos de animación hasta motores de desarrollo. Funciona como bienvenida a la productora: nos permite conocer en profundidad a cada joven y potenciar sus habilidades en modelado y videojuegos.'),
    e('mentoria', 'Edición de Videos e Introducción a IA', 'Gonzalo Pavez', 'Acompañamiento técnico individual desde el montaje audiovisual básico hasta el uso estratégico de herramientas de inteligencia artificial. Un punto de partida para identificar las habilidades de cada participante y orientarlas a proyectos de postproducción.'),

    # Módulos de formación general (FormaPro)
    e('modulo', 'Referentes Culturales', texto='Análisis, reflexión y comprensión cultural a través de obras audiovisuales. Los participantes exploran diversos lenguajes artísticos y desarrollan una mirada crítica que nutre sus propios intereses creativos.'),
    e('modulo', 'Expresión Corporal y Creación Escénica', texto='Expresión a través del cuerpo, la improvisación y la voz. Se desarrolla conciencia corporal, confianza y conexión con las emociones en un entorno seguro, y se montan pequeñas piezas dramáticas.'),
    e('modulo', 'Expresión vocal', texto='Desarrollo de la expresión oral con la voz, la interpretación y herramientas de la narrativa literaria. Con improvisación y narración se construyen personajes y relatos, y el proceso termina con breves performances escénicas.'),

    # Actividades complementarias
    e('actividad', 'Cine Club', texto=''),
    e('actividad', 'Eventos', texto=''),

    # Arte y Apoyo
    e('apoyo', 'Laboratorio Creativo', 'Arte Terapia', 'La puerta de entrada al área de Arte y Apoyo: un espacio semanal personalizado de exploración y creación para descubrir los intereses y talentos de cada participante, en un entorno respetuoso.'),
    e('apoyo', 'Habilidades para la vida diaria con Cocina', 'Terapia Ocupacional', ''),
    e('apoyo', 'Cuentos con Vellón', 'Terapia Ocupacional', ''),

    # Servicios de la productora
    e('servicio', 'Videos corporativos', texto='Piezas audiovisuales para presentar empresas o proyectos en sitios web, redes sociales, ferias o eventos.'),
    e('servicio', 'Registro de eventos', texto='Registro audiovisual de actividades académicas, empresariales, artísticas y sociales.'),
    e('servicio', 'Transmisiones en vivo', texto='Transmisión de eventos de diversa naturaleza por redes sociales y otras plataformas.'),
    e('servicio', 'Animaciones y piezas gráficas', texto='Para videos, sitios web, presentaciones u otros soportes, para diferenciar el mensaje y transmitir una idea de forma amigable.'),
    e('servicio', 'Audio y podcast', texto='Apoyo en la idea creativa y en todo lo técnico de un podcast, programa radial o radioteatro.'),
    e('servicio', 'Locución', texto='Locutores y locutoras profesionales que aportan un elemento distintivo a tu mensaje de audio.'),
    e('servicio', 'Arriendo de salas', texto='Salas para capacitación, estudio audiovisual, ensayo y estudio de audio. Pide las especificaciones técnicas por correo.'),

    # Producciones (trailers en YouTube)
    e('produccion', 'Metamopatosis', 'Trailer', imagen=I + 'pr-metamopatosis.webp', enlace='https://youtu.be/8lm-lVkyFtM'),
    e('produccion', 'The Gruffalo', 'Trailer', imagen=I + 'pr-gruffalo.webp', enlace='https://youtu.be/cMKg1UW3jrg'),
    e('produccion', 'La Maldición del Cuadro', 'Trailer', imagen=I + 'pr-maldicion.webp', enlace='https://youtu.be/LuXGJBaeub0'),
    e('produccion', 'El Laboratorio del Doctor Jeremías', 'Trailer', imagen=I + 'pr-jeremias.webp', enlace='https://youtu.be/X6Dw9_JBkkY'),
    e('produccion', 'La Tempestad', 'Obra completa', imagen=I + 'fo-teatro.webp', enlace='https://youtu.be/yl8qVgpDaTY'),
]
# Orden dentro de cada tipo, según la lista.
_cuenta = {}
for x in ELEMENTOS:
    _cuenta[x['tipo']] = _cuenta.get(x['tipo'], 0) + 1
    x['orden'] = _cuenta[x['tipo']]


def sql_texto(v):
    return "'" + v.replace("'", "''") + "'"


def generar():
    # 1. Copia de respaldo para el sitio.
    js = ('// Generado por sitio/contenido-inicial.py. Respaldo del contenido para cuando Supabase no responde.\n'
          '// El contenido real se edita en la plataforma, sección «Sitio web».\n'
          'window.SITIO_RESPALDO = ' + json.dumps({'textos': TEXTOS, 'elementos': ELEMENTOS}, ensure_ascii=False, indent=1) + ';\n')
    (RAIZ / 'sitio' / 'contenido.js').write_text(js, encoding='utf-8')

    # 2. Bloque de carga inicial en la migración.
    filas_t = ',\n'.join(f'  ({sql_texto(k)}, {sql_texto(v)})' for k, v in TEXTOS.items())
    cols = ['tipo', 'titulo', 'subtitulo', 'texto', 'lista', 'nota', 'imagen', 'enlace', 'orden']
    filas_e = ',\n'.join('  (' + ', '.join(str(x[c]) if c == 'orden' else sql_texto(x[c]) for c in cols) + ')' for x in ELEMENTOS)
    carga = (
        '-- >>> CARGA INICIAL (generada por sitio/contenido-inicial.py)\n'
        'insert into public.sitio_textos (clave, valor) values\n' + filas_t + '\n'
        'on conflict (clave) do nothing;\n\n'
        'insert into public.sitio_elementos (' + ', '.join(cols) + ')\n'
        'select * from (values\n' + filas_e + '\n'
        ') as v (' + ', '.join(cols) + ')\n'
        'where not exists (select 1 from public.sitio_elementos);\n'
        '-- <<< CARGA INICIAL\n')
    mig = RAIZ / 'supabase' / 'migrations' / '20261125010000_sitio.sql'
    s = mig.read_text(encoding='utf-8')
    s = re.sub(r'-- >>> CARGA INICIAL.*?-- <<< CARGA INICIAL\n', lambda m: carga, s, flags=re.S)
    mig.write_text(s, encoding='utf-8')
    print(f'{len(TEXTOS)} textos y {len(ELEMENTOS)} elementos')


if __name__ == '__main__':
    generar()
