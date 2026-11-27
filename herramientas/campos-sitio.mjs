// Marca el HTML del sitio público para que cada texto, botón e imagen se pueda editar desde la
// plataforma (sección «Sitio web») y genera el catálogo sitio-web/sitio/campos.js.
//
// Uso:  node herramientas/campos-sitio.mjs
//
// · Es idempotente: lo ya marcado conserva su clave; lo nuevo recibe una clave nueva.
// · Después de agregar o cambiar texto en un .html del sitio, vuelve a ejecutarlo y sube los cambios.
// · El texto que queda en el .html es el «original»: lo que se ve si nadie lo ha editado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sitio-web');
const PAGINAS = [
  { id: 'inicio', nombre: 'Inicio', ruta: '/', archivo: 'index.html' },
  { id: 'nosotros', nombre: 'Nosotros', ruta: '/nosotros', archivo: 'nosotros.html' },
  { id: 'formacion', nombre: 'Formación', ruta: '/formacion', archivo: 'formacion.html' },
  { id: 'arte', nombre: 'Arte y Apoyo', ruta: '/arte-y-apoyo', archivo: 'arte-y-apoyo.html' },
  { id: 'productora', nombre: 'Productora', ruta: '/productora', archivo: 'productora.html' },
  { id: 'tienda', nombre: 'Tienda', ruta: '/tienda', archivo: 'tienda/index.html' },
  { id: 'comunidad', nombre: 'Comunidad', ruta: '/comunidad', archivo: 'comunidad.html' },
  { id: 'colabora', nombre: 'Colabora', ruta: '/colabora', archivo: 'colabora.html' },
  { id: 'contacto', nombre: 'Contacto', ruta: '/contacto', archivo: 'contacto.html' },
];
// Claves que se editan en la pestaña «Contacto y enlaces» y no en las páginas.
const GLOBALES = new Set(['direccion', 'whatsapp', 'correo', 'instagram', 'youtube', 'linkedin', 'patreon', 'enlace_inscripcion']);
const INSCRIPCION = 'https://inscripcion-spectrum.netlify.app/';
// Nombres para las claves que ya existían.
const NOMBRES = {
  inicio_bajada: 'Bajada bajo el título', inicio_comunidad: 'Texto de la comunidad', inicio_video: 'Video del reel (enlace de YouTube)',
  proposito_titulo: 'Título de la página', proposito_texto: 'Propósito', mision: 'Misión', vision: 'Visión', cultura: 'Cultura de trabajo',
  formacion_intro: 'Introducción', formapro_texto: 'Texto de FormaPro', online_texto: 'Texto de SpectrumOnline',
  arte_terapia_texto: 'Texto de Arte Terapia', terapia_ocupacional_texto: 'Texto de Terapia Ocupacional', productora_texto: 'Introducción',
  colabora_donacion: 'Texto de la donación', colabora_suscripcion: 'Texto de la suscripción',
  comunidad_bienvenida: 'Texto de bienvenida', comunidad_invitacion: 'Texto de la invitación', comunidad_video: 'Video (enlace de YouTube)',
  enlace_donacion: 'Enlace del botón para donar', enlace_suscripcion: 'Enlace del botón para suscribirse',
};

const respaldo = (() => {
  const t = fs.readFileSync(path.join(RAIZ, 'sitio/contenido.js'), 'utf8');
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
})();
const decodificar = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const limpio = s => decodificar(s.replace(/<wbr>/g, '')).replace(/\s+/g, ' ').trim();
const slug = s => limpio(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const atributo = (attrs, n) => (attrs.match(new RegExp(`\\s${n}="([^"]*)"`)) || [])[1];
const usadas = new Set();

/* Marca un bloque de HTML (el <main> o el pie) y devuelve el bloque marcado y sus campos por sección. */
function marcar(html, pag) {
  // Zonas que no se tocan: íconos SVG (menos el texto del sello), la vitrina de la tienda, los filtros y el catálogo.
  const protegidas = [];
  const proteger = re => { for (const m of html.matchAll(re)) protegidas.push([m.index, m.index + m[0].length]); };
  proteger(/<svg class="ico"[\s\S]*?<\/svg>/g);
  proteger(/<span class="play">[\s\S]*?<\/span>/g);
  proteger(/<div class="vitrina"[\s\S]*?<\/div>\n/g);
  proteger(/<div class="filtros"[\s\S]*?<\/div>/g);
  proteger(/<div class="catalogo[\s\S]*?<\/div>/g);
  proteger(/<ul class="clientes"[\s\S]*?<\/ul>/g);
  proteger(/<div class="cinta-caja"[\s\S]*?<\/div><\/div><\/div>/g);
  proteger(/<div class="legal">[\s\S]*?<\/div>/g);   // el pie legal se marca aparte
  proteger(/<div[^>]*\sdata-texto="[^"]+"[^>]*>[\s\S]*?<\/div>/g);   // bloques de párrafos que ya tienen clave
  const protegido = (a, b) => protegidas.some(([x, y]) => a >= x && b <= y);

  // Secciones: cada <section> (o el pie entero).
  const secciones = [];
  if (pag.id === 'pie') secciones.push({ ini: 0, fin: html.length, clave: 'pie', nombre: 'Pie de página' });
  else for (const m of html.matchAll(/<section\b([^>]*)>[\s\S]*?<\/section>/g)) {
    const cuerpo = m[0];
    const eyebrow = (cuerpo.match(/class="eyebrow"[^>]*>(?:<span[^>]*>)?([^<]+)</) || [])[1];
    const h = (cuerpo.match(/<h[12][^>]*>(?:<span[^>]*>)?([^<]+)</) || [])[1];
    const id = atributo(m[1], 'id');
    const previa = atributo(m[1], 'data-seccion');
    const n = secciones.length;
    const deId = id ? id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' ') : '';
    const nombre = n === 0 ? 'Encabezado' : limpio(eyebrow || h || deId || (pag.id === 'contacto' ? 'Canales de contacto' : `Sección ${n + 1}`));
    const clave = previa || `${pag.id}_${(n === 0 ? 'cabeza' : slug(id || eyebrow || h || 's' + (n + 1))).slice(0, 18)}`;
    secciones.push({ ini: m.index, fin: m.index + cuerpo.length, clave, nombre, attrs: m[1] });
  }
  const seccionDe = i => secciones.find(s => i >= s.ini && i < s.fin);

  const hallazgos = [];   // { ini, fin, nuevo, campo }
  const agregar = (ini, fin, nuevo, campo) => { if (!protegido(ini, fin)) hallazgos.push({ ini, fin, nuevo, campo }); };
  // Campos que no cambian el HTML (ya tienen su clave): se anotan sin pasar por los solapes.
  const anotar = (ini, campo) => hallazgos.push({ ini, fin: ini, nuevo: null, campo, fijo: true });

  // 1) Párrafos y títulos con resaltados (<mark>, <em> o <span> dentro): formato «resaltado».
  for (const m of html.matchAll(/<(p|h2)((?:\s[^>]*)?)>((?:[^<]|<(mark|em|span)\b[^>]*>[^<]*<\/\4>)+)<\/\1>/g)) {
    if (!/<(mark|em|span)\b/.test(m[3])) continue;
    const [, tag, attrs, cuerpo] = m;
    const interno = cuerpo.match(/<(mark|em|span)\b/)[1];
    const texto = limpio(cuerpo.replace(/<(mark|em|span)\b[^>]*>([^<]*)<\/\1>/g, '*$2*'));
    const rol = tag === 'h2' ? 'Título' : /class="cita"/.test(attrs) ? 'Cita' : 'Frase destacada';
    const clave = atributo(attrs, 'data-texto');
    const extra = clave ? '' : ` data-texto="@@" data-formato="resaltado" data-resaltar="${interno}"`;
    agregar(m.index, m.index + m[0].length, `<${tag}${attrs}${extra}>${cuerpo}</${tag}>`,
      { clave, rol, tipo: 'resaltado', defecto: texto, ayuda: 'Encierra entre asteriscos lo que va resaltado: *así*.' });
  }
  // 2) Textos simples.
  for (const m of html.matchAll(/<(h1|h2|h3|p|b|small|span|li|textPath)((?:\s[^>]*)?)>([^<]*)<\/\1>/g)) {
    const [, tag, attrs, cuerpo] = m;
    if (/\s(data-telefono|data-correo-texto|id|aria-hidden)[\s=>]|class="(n|ir|flecha|circulo[^"]*|vacio)"/.test(' ' + attrs + ' ')) continue;
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(cuerpo)) continue;
    const clave = atributo(attrs, 'data-texto');
    if (clave && GLOBALES.has(clave)) continue;
    const antes = html.slice(0, m.index);
    const abre = (antes.match(/<a\b([^>]*)>\s*$/) || [])[1];
    const enBoton = abre != null;
    const esBtn = enBoton && /class="btn/.test(abre);
    const enH1 = antes.lastIndexOf('<h1') > antes.lastIndexOf('</h1>');
    const enIndice = enBoton && antes.lastIndexOf('<nav class="indice"') > antes.lastIndexOf('</nav>');
    const rol = enIndice ? 'Enlace del índice' : esBtn ? 'Botón' : enBoton ? 'Texto del enlace' : tag === 'textPath' ? 'Texto del sello giratorio'
      : /class="eyebrow"/.test(attrs) ? 'Antetítulo' : tag === 'h1' ? 'Título de la página' : enH1 ? 'Título principal' : tag === 'h2' ? 'Título'
      : tag === 'h3' ? 'Subtítulo' : tag === 'li' ? 'Elemento' : tag === 'p' ? 'Texto' : 'Texto breve';
    const formato = atributo(attrs, 'data-formato');
    const tipo = clave && formato !== 'linea' ? 'parrafos' : 'linea';
    const defecto = clave && respaldo.textos[clave] != null ? respaldo.textos[clave] : limpio(cuerpo.replace(/<p>|<\/p>/g, '\n'));
    agregar(m.index, m.index + m[0].length, clave ? m[0] : `<${tag}${attrs} data-texto="@@" data-formato="linea">${cuerpo}</${tag}>`,
      { clave, rol, tipo, defecto });
  }
  // 2b) Bloques con párrafos que ya tenían clave (<div data-texto="…"><p>…</p></div>).
  for (const m of html.matchAll(/<div((?:\s[^>]*)?\sdata-texto="([a-z0-9_]+)"[^>]*)>/g)) {
    const clave = m[2];
    if (GLOBALES.has(clave)) continue;
    anotar(m.index, { clave, rol: 'Texto', tipo: 'parrafos', defecto: respaldo.textos[clave] ?? '' });
  }
  // 3) Botones y enlaces con texto plano (opcionalmente con una flecha): el texto va en un <span>.
  for (const m of html.matchAll(/<a((?:\s[^>]*)?)>([^<]*[A-Za-zÁÉÍÓÚÑáéíóúñ][^<]*?)(\s*<span class="flecha"[^>]*>[^<]*<\/span>)?<\/a>/g)) {
    if (pag.id === 'pie') continue;
    let [, attrs, texto, flecha = ''] = m;
    if (/\sid="/.test(attrs)) continue;
    const antes = html.slice(0, m.index);
    const enIndice = antes.lastIndexOf('<nav class="indice"') > antes.lastIndexOf('</nav>');
    const sinEspacio = texto.replace(/\s+$/, ''), resto = texto.slice(sinEspacio.length);
    agregar(m.index, m.index + m[0].length, `<a${attrs}><span data-texto="@@" data-formato="linea">${sinEspacio}</span>${resto}${flecha}</a>`,
      { rol: enIndice ? 'Enlace del índice' : 'Botón', tipo: 'linea', defecto: limpio(sinEspacio) });
  }
  // 4) Enlaces que ya tienen clave propia (donar, suscribirse) y el video del reel.
  for (const m of html.matchAll(/<a((?:\s[^>]*)?)\sdata-(enlace|video)="([a-z0-9_]+)"/g)) {
    const clave = m[3];
    if (GLOBALES.has(clave)) continue;
    anotar(m.index, { clave, rol: NOMBRES[clave] || 'Enlace', tipo: 'enlace', defecto: respaldo.textos[clave] ?? '' });
  }
  // 5) Imágenes del sitio.
  for (const m of html.matchAll(/<img((?:\s[^>]*)?)>/g)) {
    const attrs = m[1], src = atributo(attrs, 'src') || '';
    if (!/^\/(sitio|tienda)\//.test(src)) continue;
    const clave = atributo(attrs, 'data-imagen');
    agregar(m.index, m.index + m[0].length, clave ? m[0] : `<img${attrs.replace(/\s*$/, '')} data-imagen="@@">`,
      { clave, rol: 'Imagen', tipo: 'imagen', defecto: src, alt: decodificar(atributo(attrs, 'alt') || '') });
  }

  // Sin solapes: si un hallazgo queda dentro de otro, gana el de afuera (salvo los botones, que contienen su texto).
  hallazgos.sort((a, b) => a.ini - b.ini || (b.fijo ? 1 : 0) - (a.fijo ? 1 : 0) || b.fin - a.fin);
  const finales = [];
  for (const h of hallazgos) {
    if (h.fijo) { finales.push(h); continue; }
    const padre = finales.find(f => !f.fijo && h.ini >= f.ini && h.fin <= f.fin);
    if (padre) {
      // El <span data-texto> ya existente dentro de un botón: se queda el del botón con la clave del span.
      if (padre.campo.rol.startsWith('Botón') || padre.campo.rol === 'Enlace del índice') { if (h.campo.clave) { padre.nuevo = html.slice(padre.ini, padre.fin); padre.campo.clave = h.campo.clave; } }
      continue;
    }
    finales.push(h);
  }

  // Claves, etiquetas y numeración por sección.
  const porSeccion = new Map(secciones.map(s => [s.clave, { clave: s.clave, nombre: s.nombre, campos: [] }]));
  for (const h of finales) {
    const s = seccionDe(h.ini);
    if (!s) continue;
    const c = h.campo, grupo = porSeccion.get(s.clave);
    const base = slug(c.rol === 'Botón' ? 'boton' : c.rol === 'Enlace del índice' ? 'indice' : c.rol).split('_')[0];
    if (!c.clave) {
      let n = 1, k;
      do { k = `${s.clave}_${base}${n > 1 ? n : ''}`; n++; } while (usadas.has(k));
      c.clave = k;
      h.nuevo = h.nuevo.replace('"@@"', `"${k}"`);
    }
    usadas.add(c.clave);
    c.etiqueta = NOMBRES[c.clave] || c.rol;
    grupo.campos.push(c);
  }
  for (const g of porSeccion.values()) {
    const veces = {};
    for (const c of g.campos) veces[c.etiqueta] = (veces[c.etiqueta] || 0) + 1;
    const n = {};
    for (const c of g.campos) if (veces[c.etiqueta] > 1 && !NOMBRES[c.clave]) c.etiqueta += ' ' + (n[c.etiqueta] = (n[c.etiqueta] || 0) + 1);
    g.campos = g.campos.map(c => ({ clave: c.clave, etiqueta: c.etiqueta, tipo: c.tipo, defecto: c.defecto, ...(c.tipo === 'imagen' ? { alt: c.alt } : {}), ...(c.ayuda ? { ayuda: c.ayuda } : {}) }));
  }

  // Aplicar de atrás hacia adelante.
  let out = html;
  for (const h of [...finales].filter(h => h.nuevo != null).sort((a, b) => b.ini - a.ini)) out = out.slice(0, h.ini) + h.nuevo + out.slice(h.fin);
  // Cada <section> recibe data-seccion (para poder ocultarla).
  if (pag.id !== 'pie') {
    let i = 0;
    out = out.replace(/<section\b([^>]*)>/g, (t, attrs) => {
      const s = secciones[i++];
      return /data-seccion=/.test(attrs) ? t : `<section${attrs} data-seccion="${s.clave}">`;
    });
  }
  return { html: out, secciones: [...porSeccion.values()] };
}

/* El pie es igual en todas las páginas: se marca una vez y se copia. */
function marcarPie(pie) {
  let r = marcar(pie, { id: 'pie' });
  let html = r.html;
  // Pie legal: el primer <span> (© …).
  html = html.replace(/<div class="legal"><span>([^<]+)<\/span>/, (t, txt) => `<div class="legal"><span data-texto="pie_legal" data-formato="linea">${txt}</span>`);
  const m = html.match(/<div class="legal"><span data-texto="pie_legal"[^>]*>([^<]+)</);
  if (m) r.secciones[0].campos.push({ clave: 'pie_legal', tipo: 'linea', defecto: limpio(m[1]), etiqueta: 'Texto legal' });
  return { html, secciones: r.secciones };
}

const salida = { paginas: [], imagenes: [] };
let pieMarcado = null;
for (const pag of PAGINAS) {
  const archivo = path.join(RAIZ, pag.archivo);
  let html = fs.readFileSync(archivo, 'utf8');
  // Enlaces de inscripción: comparten la clave global enlace_inscripcion.
  html = html.replace(new RegExp(`<a((?:(?!data-enlace)[^>])*?)href="${INSCRIPCION.replace(/[.\/]/g, '\\$&')}"`, 'g'), (t, a) => `<a${a}data-enlace="enlace_inscripcion" href="${INSCRIPCION}"`);
  // La cinta de la portada y los logos de clientes pasan a ser listas editables (el HTML queda como respaldo).
  html = html.replace(/<div class="rueda"><ul>/, '<div class="rueda"><ul data-lista="cinta">').replace(/<\/ul><ul>(?=<li>)/, '</ul><ul data-lista="cinta">');
  html = html.replace(/<ul class="clientes" role="list">/, '<ul class="clientes" role="list" data-lista="cliente">');
  if (!/<body[^>]*data-pagina=/.test(html)) html = html.replace(/<body([^>]*)>/, `<body$1 data-pagina="${pag.id}">`);

  const ini = html.indexOf('<main'), fin = html.indexOf('</main>') + 7;
  const r = marcar(html.slice(ini, fin), pag);
  html = html.slice(0, ini) + r.html + html.slice(fin);

  const pi = html.indexOf('<footer'), pf = html.indexOf('</footer>') + 9;
  pieMarcado ??= marcarPie(html.slice(pi, pf));
  html = html.slice(0, pi) + pieMarcado.html + html.slice(pf);
  fs.writeFileSync(archivo, html);

  const titulo = limpio((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const descripcion = limpio((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
  salida.paginas.push({
    id: pag.id, nombre: pag.nombre, ruta: pag.ruta,
    seo: { titulo: { clave: `seo_${pag.id}_titulo`, defecto: titulo }, descripcion: { clave: `seo_${pag.id}_descripcion`, defecto: descripcion } },
    secciones: r.secciones,
  });
}
salida.paginas.push({ id: 'pie', nombre: 'Pie de página', ruta: '/', nota: 'Es el mismo en todas las páginas.', secciones: pieMarcado.secciones });

for (const dir of ['sitio/img', 'sitio/img/logos', 'tienda/img']) {
  for (const f of fs.readdirSync(path.join(RAIZ, dir)).sort()) if (/\.(webp|jpe?g|png)$/i.test(f)) salida.imagenes.push(`/${dir}/${f}`);
}
fs.writeFileSync(path.join(RAIZ, 'sitio/campos.js'),
  '// Generado por herramientas/campos-sitio.mjs: no editar a mano.\n' +
  '// Catálogo de lo que se puede editar en cada página del sitio (lo usa la plataforma, sección «Sitio web»).\n' +
  'window.SITIO_CAMPOS = ' + JSON.stringify(salida, null, 1) + ';\n');
const total = salida.paginas.reduce((n, p) => n + p.secciones.reduce((m, s) => m + s.campos.length, 0), 0);
console.log(`${total} campos en ${salida.paginas.length} grupos · ${salida.imagenes.length} imágenes en la galería`);
