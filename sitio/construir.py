#!/usr/bin/env python3
"""Arma las páginas del sitio público con la misma cabecera, pie y metadatos.

Cada página vive en sitio/paginas/<nombre>.html y empieza con un bloque de datos:
    ---
    ruta: /nosotros/
    titulo: Nosotros
    descripcion: ...
    ---
    <main>…</main>
El resultado se escribe en la carpeta de su ruta (por ejemplo nosotros/index.html).

Uso:  python3 sitio/construir.py
"""
import pathlib, re, html

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITIO = 'https://spectrumpro.vercel.app'
LOGO = (RAIZ / 'assets' / 'logo.svg').read_text(encoding='utf-8').replace('<svg ', '<svg aria-hidden="true" ', 1)

MENU = [('/nosotros/', 'Nosotros'), ('/formacion/', 'Formación'), ('/arte-y-apoyo/', 'Arte y Apoyo'),
        ('/productora/', 'Productora'), ('/tienda/', 'Tienda'), ('/contacto/', 'Contacto')]

CABECERA = f'''<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cabecera"><div class="wrap">
  <a class="marca" href="/" aria-label="SpectrumPro, ir al inicio">{LOGO}<span>Spectrum<br>Pro</span></a>
  <button type="button" class="abrir-menu" aria-expanded="false" aria-controls="menu">Menú</button>
  <nav id="menu" class="menu" aria-label="Principal">
    {''.join(f'<a href="{r}">{t}</a>' for r, t in MENU)}
    <a class="colabora" href="/colabora/">Colabora</a>
  </nav>
</div></header>
<div class="franja" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'''

PIE = '''<footer class="pie-sitio"><div class="wrap">
  <div>
    <h2>Transformando la perspectiva del mundo</h2>
    <p>Productora audiovisual y centro de formación artística que apuesta por el talento neurodivergente.</p>
  </div>
  <div>
    <h3>Contacto</h3>
    <ul>
      <li><a data-mapa href="/contacto/" target="_blank" rel="noopener"><span data-texto="direccion" data-formato="linea">Doctor Roberto del Río 1137, Providencia, Santiago, Chile</span></a></li>
      <li><a data-wa="" href="https://wa.me/56996389673" target="_blank" rel="noopener">WhatsApp <span data-telefono>+56 9 9638 9673</span></a></li>
      <li><a data-correo="texto" href="mailto:administracion@spectrumpro.cl">administracion@spectrumpro.cl</a></li>
    </ul>
  </div>
  <div>
    <h3>Síguenos</h3>
    <ul>
      <li><a data-instagram href="https://instagram.com/spectrumpro.cl" target="_blank" rel="noopener">Instagram</a></li>
      <li><a data-enlace="youtube" href="https://www.youtube.com/@spectrumpro1710" target="_blank" rel="noopener">YouTube</a></li>
      <li><a data-enlace="patreon" href="https://www.patreon.com/cw/spectrumpro" target="_blank" rel="noopener">Patreon</a></li>
    </ul>
  </div>
  <div class="legal"><span>© SpectrumPro</span><span><a href="/tienda/">Tienda</a> · <a href="/colabora/">Colabora</a> · <a href="/plataforma/">Acceso equipo</a></span></div>
</div></footer>'''

# Si alguien llega a la raíz con un enlace viejo de la plataforma (#panel, #asistencia…)
# o con el enlace de un correo de invitación o de cambio de contraseña, se le lleva a /plataforma/.
REDIRIGIR_PLATAFORMA = '''<script>
(function(){var h=location.hash,q=location.search;
if(/^#(panel|asistencia|cumpleanos|alumnos|talleres|tienda|administracion)$/.test(h)||/access_token=|type=(recovery|invite|signup)|error_description=/.test(h)||/[?&](code|token_hash)=/.test(q))
location.replace('/plataforma/'+q+h);})();
</script>'''


def construir():
    paginas = sorted((RAIZ / 'sitio' / 'paginas').glob('*.html'))
    for p in paginas:
        s = p.read_text(encoding='utf-8')
        m = re.match(r'---\n(.*?)\n---\n', s, re.S)
        datos = dict(l.split(': ', 1) for l in m.group(1).splitlines())
        cuerpo = s[m.end():]
        ruta, titulo, desc = datos['ruta'], datos['titulo'], datos['descripcion']
        img = datos.get('imagen', '/assets/og/sitio.jpg')
        titulo_completo = titulo if ruta == '/' else f'{titulo} · SpectrumPro'
        t, d = html.escape(titulo_completo), html.escape(desc)
        pagina = f'''<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="theme-color" content="#0d0c10">
<link rel="canonical" href="{SITIO}{ruta}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="SpectrumPro">
<meta property="og:locale" content="es_CL">
<meta property="og:url" content="{SITIO}{ruta}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{SITIO}{img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/icono-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/sitio/sitio.css">
{REDIRIGIR_PLATAFORMA if ruta == '/' else ''}
</head>
<body>
{CABECERA}
{cuerpo.strip()}
{PIE}
<script src="/config.js"></script>
<script src="/sitio/contenido.js"></script>
<script src="/sitio/sitio.js"></script>
</body>
</html>
'''
        destino = RAIZ / ruta.strip('/') / 'index.html' if ruta != '/' else RAIZ / 'index.html'
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text(pagina, encoding='utf-8')
        print('→', destino.relative_to(RAIZ))


if __name__ == '__main__':
    construir()
