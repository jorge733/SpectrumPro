'use strict';
/* SpectrumPro · Editor del sitio web público (spectrumpro.cl)
   Dirección y el rol Equipo editan todo el sitio:
   · Páginas: cada antetítulo, título, párrafo, botón e imagen de las 8 páginas y del pie, el título y la
     descripción para Google, y qué secciones se muestran. El catálogo de campos lo genera
     herramientas/campos-sitio.mjs en sitio-web/sitio/campos.js (window.SITIO_CAMPOS).
   · Contacto y enlaces, Aviso superior y las listas (equipo, talleres, producciones, clientes…).
   Los cambios de texto se juntan en un borrador (no se pierden al cambiar de pestaña) y se guardan
   todos juntos. La vista previa abre spectrumpro.cl en un marco y le envía el borrador en vivo.
   Usa las utilidades globales de app.js ($, esc, toast, confirmar, conCarga…). */

(() => {

const SITIO_URL = 'https://spectrumpro.cl';
const CAMPOS = window.SITIO_CAMPOS || { paginas: [], imagenes: [] };
// Las imágenes que vienen con el sitio (/sitio/img/…) están en spectrumpro.cl.
const urlImagen = u => /^\/(sitio|tienda|assets)\//.test(u || '') ? SITIO_URL + u : (u || '');
const ytId = u => (String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
const miniaturaYt = u => ytId(u) ? `https://i.ytimg.com/vi/${ytId(u)}/hqdefault.jpg` : '';
const esCorreo = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const fechaEdicion = s => { if (!s) return ''; const d = new Date(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

/* ---------- campos fijos (fuera del catálogo de páginas) ---------- */
const INSCRIPCION = 'https://inscripcion-spectrum.netlify.app/';
const CONTACTO = [
  { clave: 'direccion', etiqueta: 'Dirección', tipo: 'linea', ayuda: 'Aparece en Contacto, en el pie de todas las páginas y en el mapa.' },
  { clave: 'whatsapp', etiqueta: 'WhatsApp', tipo: 'whatsapp', ayuda: 'Solo números, con el código de país (56). Lo usan todos los botones de WhatsApp.' },
  { clave: 'correo', etiqueta: 'Correo de contacto', tipo: 'correo', ayuda: 'Lo usan los botones «Escríbenos un correo» y «Cotiza».' },
  { clave: 'instagram', etiqueta: 'Instagram', tipo: 'instagram', ayuda: 'Usuario, sin @. Vacío oculta el ícono.' },
  { clave: 'youtube', etiqueta: 'YouTube', tipo: 'enlace', ayuda: 'Enlace completo. Vacío oculta el ícono y el botón del canal.' },
  { clave: 'linkedin', etiqueta: 'LinkedIn', tipo: 'enlace', ayuda: 'Enlace completo. Vacío oculta el ícono.' },
  { clave: 'patreon', etiqueta: 'Patreon', tipo: 'enlace', ayuda: 'Enlace completo. Vacío oculta el ícono.' },
  { clave: 'enlace_inscripcion', etiqueta: 'Formulario de inscripción', tipo: 'enlace', defecto: INSCRIPCION, ayuda: 'Todos los botones «Inscríbete» del sitio llevan aquí.' },
];
const COLORES_AVISO = { amarillo: 'Amarillo', rosado: 'Rosado', celeste: 'Celeste', verde: 'Verde', rojo: 'Rojo', morado: 'Morado', negro: 'Negro' };
const AVISO = [
  { clave: 'aviso_activo', etiqueta: 'Mostrar el aviso', tipo: 'si-no', defecto: 'si' },
  { clave: 'aviso_texto', etiqueta: 'Texto del aviso', tipo: 'linea', ayuda: 'Una frase corta. Vacío = no hay aviso. Ej: «Inscripciones abiertas para los talleres de verano».' },
  { clave: 'aviso_boton', etiqueta: 'Texto del enlace', tipo: 'linea', defecto: 'Ver más', ayuda: 'Solo se muestra si hay un enlace.' },
  { clave: 'aviso_enlace', etiqueta: 'Enlace', tipo: 'enlace', ayuda: 'Opcional. Puede ser una página del sitio (/formacion) o una dirección completa (https://…).' },
  { clave: 'aviso_color', etiqueta: 'Color', tipo: 'opciones', opciones: COLORES_AVISO, defecto: 'amarillo' },
];

/* ---------- listas del sitio ----------
   Cada tipo dice en qué página aparece y qué significa cada campo para él. */
const TIPOS = {
  equipo: { nombre: 'Equipo', nuevo: 'Nueva persona', pagina: 'Nosotros', ruta: '/nosotros#equipo', foto: 'Retrato (cuadrado)', campos: {
    titulo: ['Nombre *', 0], subtitulo: ['Cargo', 0], texto: ['Presentación («Conocer más»)', 5], nota: ['Correo', 0] } },
  valor: { nombre: 'Valores', nuevo: 'Nuevo valor', pagina: 'Nosotros', ruta: '/nosotros#valores', campos: {
    titulo: ['Valor *', 0], texto: ['Frase', 2] } },
  taller: { nombre: 'Talleres', nuevo: 'Nuevo taller', pagina: 'Formación', ruta: '/formacion#talleres', foto: 'Ilustración', campos: {
    titulo: ['Nombre del taller *', 0], subtitulo: ['Con (quién lo dicta)', 0], texto: ['Descripción', 4],
    lista: ['Objetivos (uno por línea)', 4], nota: ['Resultado', 2], enlace: ['Video del resultado (YouTube)', 0] } },
  modulo: { nombre: 'Módulos FormaPro', nuevo: 'Nuevo módulo', pagina: 'Formación', ruta: '/formacion#formapro', campos: {
    titulo: ['Nombre del módulo *', 0], subtitulo: ['Con (quién lo dicta)', 0], texto: ['Descripción', 4] } },
  mentoria: { nombre: 'Mentorías', nuevo: 'Nueva mentoría', pagina: 'Formación', ruta: '/formacion#mentorias', campos: {
    titulo: ['Nombre de la mentoría *', 0], subtitulo: ['Con (quién la dicta)', 0], texto: ['Descripción', 4] } },
  actividad: { nombre: 'Actividades', nuevo: 'Nueva actividad', pagina: 'Formación', ruta: '/formacion#actividades', campos: {
    titulo: ['Actividad complementaria *', 0] } },
  apoyo: { nombre: 'Arte y Apoyo', nuevo: 'Nuevo taller de apoyo', pagina: 'Arte y Apoyo', ruta: '/arte-y-apoyo', campos: {
    subtitulo: ['Sección', ['Arte Terapia', 'Terapia Ocupacional']], titulo: ['Nombre *', 0], nota: ['Encargada o encargado', 0], texto: ['Descripción', 4] } },
  servicio: { nombre: 'Servicios', nuevo: 'Nuevo servicio', pagina: 'Productora', ruta: '/productora#servicios', campos: {
    titulo: ['Servicio *', 0], texto: ['Descripción', 3] } },
  produccion: { nombre: 'Producciones', nuevo: 'Nueva producción', pagina: 'Inicio y Productora', ruta: '/productora#producciones', foto: 'Miniatura (si no hay, se usa la de YouTube)', campos: {
    titulo: ['Título *', 0], subtitulo: ['Tipo (Trailer, Obra completa…)', 0], enlace: ['Enlace de YouTube *', 0] } },
  cliente: { nombre: 'Clientes', nuevo: 'Nuevo cliente', pagina: 'Productora', ruta: '/productora#clientes', foto: 'Logo (mejor con fondo transparente)', fotoObligatoria: true, campos: {
    titulo: ['Nombre de la organización *', 0], enlace: ['Sitio web (opcional)', 0] } },
  cinta: { nombre: 'Cinta de la portada', nuevo: 'Nueva palabra', pagina: 'Inicio', ruta: '/', campos: {
    titulo: ['Palabra o frase corta *', 0] } },
  recurso: { nombre: 'Recursos', nuevo: 'Nuevo recurso', pagina: 'Comunidad', ruta: '/comunidad#recursos', foto: 'Portada del documento (vertical)', documento: true, campos: {
    titulo: ['Título *', 0], subtitulo: ['Tipo y tamaño (ej: PDF · 2 MB, Artículo · Fuente)', 0], texto: ['Descripción breve', 2],
    enlace: ['Enlace del PDF o del artículo *', 0], nota: ['Texto del botón (si se deja vacío: «Descargar PDF» o «Abrir»)', 0] } },
  episodio: { nombre: 'Podcasts', nuevo: 'Nuevo episodio', pagina: 'Comunidad', ruta: '/comunidad#escucha', foto: 'Portada (horizontal, 2:1)', campos: {
    titulo: ['Título del episodio *', 0], subtitulo: ['Podcast y número (ej: No desistas · Episodio 1)', 0], texto: ['Descripción', 3],
    enlace: ['Enlace (Spotify, YouTube…) *', 0], nota: ['Texto del botón (si se deja vacío: «Escuchar en Spotify»…)', 0] } },
};
const LARGOS = { titulo: 120, subtitulo: 160, texto: 3000, lista: 2000, nota: 500, enlace: 500 };

ui.tabSitio ??= 'paginas';
ui.paginaSitio ??= 'inicio';
ui.borradorSitio ??= {};     // clave → valor nuevo (string) o null (= restaurar el original del HTML)
ui.subidasSitio ??= [];      // fotos subidas que aún no se guardan (se borran si se descarta el borrador)
ui.qSitio ??= '';

const T = () => S.sitio?.textos || {};
const elementos = tipo => S.sitio.elementos.filter(e => e.tipo === tipo).sort((a, b) => (a.orden - b.orden) || a.titulo.localeCompare(b.titulo, 'es'));
const elemento = id => S.sitio?.elementos.find(e => e.id === id);
const enBorrador = k => Object.prototype.hasOwnProperty.call(ui.borradorSitio, k);
// Valor guardado (o el original del HTML si nadie lo ha editado).
const guardado = c => T()[c.clave] ?? c.defecto ?? '';
const valor = c => enBorrador(c.clave) ? (ui.borradorSitio[c.clave] ?? c.defecto ?? '') : guardado(c);
const cambios = () => Object.keys(ui.borradorSitio).length;
const pagina = id => CAMPOS.paginas.find(p => p.id === id);

// Todos los campos editables por clave (para validar y para la vista previa).
const TODOS = new Map();
for (const p of CAMPOS.paginas) {
  if (p.seo) { TODOS.set(p.seo.titulo.clave, { ...p.seo.titulo, tipo: 'linea', etiqueta: 'Título en Google' }); TODOS.set(p.seo.descripcion.clave, { ...p.seo.descripcion, tipo: 'parrafo', etiqueta: 'Descripción en Google' }); }
  for (const s of p.secciones) {
    if (p.id !== 'pie') TODOS.set('seccion_' + s.clave, { clave: 'seccion_' + s.clave, tipo: 'seccion', defecto: 'visible', etiqueta: 'Mostrar la sección ' + s.nombre });
    for (const c of s.campos) {
      TODOS.set(c.clave, c);
      if (c.tipo === 'imagen') TODOS.set(c.clave + '_alt', { clave: c.clave + '_alt', tipo: 'linea', defecto: c.alt || '', etiqueta: 'Descripción de la imagen' });
    }
  }
}
for (const c of [...CONTACTO, ...AVISO]) TODOS.set(c.clave, c);

/* =====================================================================
   Vista
   ===================================================================== */
async function vistaSitio(el) {
  if (!puede.sitio()) { location.hash = 'panel'; return; }
  const cab = `
    <header class="cabecera">
      <div><p class="eyebrow">Solo dirección</p><h1>Sitio web</h1><p>Todo spectrumpro.cl: textos, botones, imágenes, listas, Google y aviso. Los cambios se ven en el sitio apenas se guardan.</p></div>
      <div class="controles">
        <button type="button" class="btn btn-sec" data-sitio-previa>Vista previa en vivo</button>
        <a class="btn btn-sec" href="${SITIO_URL}" target="_blank" rel="noopener">Abrir el sitio ↗</a>
      </div>
    </header>`;
  if (!S.sitio) {
    el.innerHTML = cab + `<section class="tarjeta" aria-busy="true">
      <p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Cargando el contenido del sitio…</p>
      ${esqueletoLineas(4)}
    </section>`;
    try { S.sitio = await D.sitio(); S.sitio.fechas ??= {}; }
    catch (e) {
      if (vistaActual() !== 'sitio') return;
      el.innerHTML = cab + `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`;
      return;
    }
    if (vistaActual() === 'sitio') render();
    return;
  }
  const tabs = { paginas: ['Páginas'], contacto: ['Contacto y enlaces'], aviso: ['Aviso', T().aviso_texto && T().aviso_activo !== 'no' ? '●' : null] };
  for (const [k, t] of Object.entries(TIPOS)) tabs[k] = [t.nombre, elementos(k).length];
  tabs.copia = ['Copia de seguridad'];
  if (!tabs[ui.tabSitio]) ui.tabSitio = 'paginas';
  const cuerpo = { paginas: panelPaginas, contacto: panelContacto, aviso: panelAviso, copia: panelCopia }[ui.tabSitio];
  el.innerHTML = cab + `
    <div class="pestanas pestanas-sitio" role="tablist" aria-label="Partes del sitio">
      ${Object.entries(tabs).map(([k, [n, c]]) => `<button type="button" role="tab" data-tab-sitio="${k}" aria-pressed="${ui.tabSitio === k}" aria-selected="${ui.tabSitio === k}">${esc(n)}${c != null ? ` <small>${c}</small>` : ''}</button>`).join('')}
    </div>
    <div class="pila">${cuerpo ? cuerpo() : panelLista(ui.tabSitio)}</div>
    ${barraGuardar()}`;
  if (ui.tabSitio === 'paginas') filtrarCampos();
  enviarPrevia();
}

function barraGuardar() {
  const n = cambios();
  return `<div class="barra-guardar" ${n ? '' : 'hidden'} role="region" aria-label="Cambios sin guardar">
    <span><b>${n}</b> ${n === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}</span>
    <button type="button" class="btn btn-sec" data-sitio-descartar>Descartar</button>
    <button type="button" class="btn" data-sitio-guardar>Guardar y publicar</button>
  </div>`;
}
function actualizarBarra() {
  const vieja = $('.barra-guardar');
  if (vieja) vieja.outerHTML = barraGuardar();
}

/* ---------- un campo ---------- */
function campo(c, { etiqueta = c.etiqueta } = {}) {
  const v = valor(c);
  const borrador = enBorrador(c.clave);
  const editado = c.defecto != null && T()[c.clave] != null && T()[c.clave] !== c.defecto;
  const fecha = S.sitio.fechas?.[c.clave];
  const estado = borrador ? '<span class="chip chip-warn">Sin guardar</span>'
    : editado ? `<span class="chip chip-info" title="${fecha ? 'Editado el ' + esc(fechaEdicion(fecha)) : ''}">Editado</span>` : '';
  const restaurar = (editado || borrador) && c.defecto != null && c.tipo !== 'si-no' && c.tipo !== 'opciones'
    ? `<button type="button" class="enlace-texto" data-sitio-restaurar="${c.clave}" title="Volver al texto original del sitio">Restaurar original</button>` : '';
  const cab = `<span class="campo-cab"><span>${esc(etiqueta)}</span>${estado}${restaurar}</span>`;
  const ayuda = c.ayuda ? `<small class="muted campo-ayuda">${esc(c.ayuda)}</small>` : '';
  const q = qAttr(etiqueta, v, c.defecto);
  const attrs = `data-campo-sitio="${c.clave}" id="cs-${c.clave}"`;
  if (c.tipo === 'imagen') {
    const alt = TODOS.get(c.clave + '_alt');
    return `<div class="campo-sitio campo-imagen ancho" ${q}>
      ${cab}
      <div class="foto-producto">
        <div class="foto-marco"><img src="${esc(urlImagen(v))}" alt="" loading="lazy"></div>
        <div class="foto-acciones">
          <label class="btn btn-sec btn-peq">Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" class="solo-lector" data-sitio-subir="${c.clave}"></label>
          <button type="button" class="btn btn-sec btn-peq" data-sitio-galeria="${c.clave}">Elegir de la galería</button>
          <small class="muted">JPG, PNG o WebP. Se reduce sola; las transparentes se mantienen.</small>
        </div>
      </div>
      ${alt && (alt.defecto || valor(alt)) ? `<label class="campo-alt">Descripción para lectores de pantalla<input ${`data-campo-sitio="${alt.clave}"`} maxlength="300" value="${esc(valor(alt))}" autocomplete="off"></label>` : ''}
    </div>`;
  }
  if (c.tipo === 'si-no' || c.tipo === 'seccion') {
    const on = c.tipo === 'seccion' ? v !== 'oculta' : v !== 'no';
    return `<label class="campo-sitio check-suelto" ${q}><input type="checkbox" ${attrs} data-tipo="${c.tipo}" ${on ? 'checked' : ''}> ${esc(etiqueta)} ${estado}</label>`;
  }
  if (c.tipo === 'opciones') {
    return `<label class="campo-sitio" ${q}>${cab}<select ${attrs}>${Object.entries(c.opciones).map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>${ayuda}</label>`;
  }
  const largo = c.tipo === 'parrafos' || c.tipo === 'parrafo' || (c.tipo === 'resaltado' && String(v).length > 70) || (c.tipo === 'linea' && String(v).length > 90);
  const filas = Math.min(10, Math.max(2, Math.ceil(String(v).length / 80) + (String(v).match(/\n/g) || []).length));
  const tipoInput = c.tipo === 'enlace' ? 'url' : c.tipo === 'correo' ? 'email' : c.tipo === 'whatsapp' ? 'tel' : 'text';
  const ph = c.tipo === 'enlace' ? 'https://…' : c.tipo === 'whatsapp' ? '56912345678' : '';
  const max = c.tipo === 'parrafos' ? 3000 : c.tipo === 'parrafo' ? 300 : 500;
  const ayudaTipo = c.tipo === 'parrafos' ? 'Cada salto de línea empieza un párrafo nuevo.' : c.tipo === 'resaltado' ? c.ayuda : '';
  return `<label class="campo-sitio${largo || c.tipo === 'parrafos' ? ' ancho' : ''}" ${q}>${cab}
    ${largo ? `<textarea ${attrs} rows="${filas}" maxlength="${max}" placeholder="${esc(c.defecto ? '' : 'Vacío')}">${esc(v)}</textarea>`
      : `<input ${attrs} type="${tipoInput}" maxlength="${max}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off"${tipoInput === 'tel' ? ' inputmode="numeric"' : ''}>`}
    ${ayudaTipo && ayudaTipo !== c.ayuda ? `<small class="muted campo-ayuda">${esc(ayudaTipo)}</small>` : ''}${ayuda}
  </label>`;
}

/* ---------- Páginas ---------- */
function panelPaginas() {
  if (!CAMPOS.paginas.length) return '<section class="tarjeta"><p class="aviso-error">No se encontró el catálogo del sitio (sitio-web/sitio/campos.js). Recarga la página.</p></section>';
  if (!pagina(ui.paginaSitio)) ui.paginaSitio = CAMPOS.paginas[0].id;
  const nPag = p => [...(p.seo ? [p.seo.titulo.clave, p.seo.descripcion.clave] : []), ...p.secciones.flatMap(s => ['seccion_' + s.clave, ...s.campos.flatMap(c => [c.clave, c.clave + '_alt'])])].filter(enBorrador).length;
  return `<section class="tarjeta tarjeta-paginas">
    <div class="paginas-sitio" role="tablist" aria-label="Páginas del sitio">
      ${CAMPOS.paginas.map(p => `<button type="button" data-pagina-sitio="${p.id}" aria-pressed="${ui.paginaSitio === p.id}">${esc(p.nombre)}${nPag(p) ? ` <small class="punto-cambios" title="Cambios sin guardar">${nPag(p)}</small>` : ''}</button>`).join('')}
    </div>
    <div class="buscador" role="search">
      ${ICONO_LUPA}
      <input type="search" id="sitio-buscar" placeholder="Buscar un texto en todo el sitio" aria-label="Buscar un texto en todo el sitio" value="${esc(ui.qSitio)}" autocomplete="off" spellcheck="false">
      <span class="buscador-cuenta" id="sitio-buscar-cuenta" aria-live="polite"></span>
    </div>
  </section>
  ${CAMPOS.paginas.map(p => `
    <div class="pagina-sitio" data-pag="${p.id}">
      <div class="pagina-cab"><h2>${esc(p.nombre)}</h2>${p.nota ? `<span class="nota-suave">${esc(p.nota)}</span>` : ''}<a class="enlace-texto" href="${SITIO_URL}${p.ruta}" target="_blank" rel="noopener">Ver página ↗</a></div>
      ${p.seo ? `<section class="tarjeta seccion-sitio" data-sec="seo">
        <h3 class="seccion-titulo"><span>Google y redes sociales</span></h3>
        <p class="nota-suave">Así aparece la página en los resultados de Google y al compartirla por WhatsApp o redes.</p>
        <div class="vista-google" aria-hidden="true"><b data-google-titulo="${p.id}">${esc(valor(TODOS.get(p.seo.titulo.clave)))}</b><span>spectrumpro.cl${esc(p.ruta === '/' ? '' : p.ruta)}</span><small data-google-desc="${p.id}">${esc(valor(TODOS.get(p.seo.descripcion.clave)))}</small></div>
        <div class="campos">${campo(TODOS.get(p.seo.titulo.clave), { etiqueta: 'Título (ideal: menos de 60 caracteres)' })}${campo(TODOS.get(p.seo.descripcion.clave), { etiqueta: 'Descripción (ideal: 120 a 160 caracteres)' })}</div>
      </section>` : ''}
      ${p.secciones.map(s => `
        <section class="tarjeta seccion-sitio ${p.id !== 'pie' && valor(TODOS.get('seccion_' + s.clave)) === 'oculta' ? 'seccion-oculta' : ''}" data-sec="${s.clave}">
          <h3 class="seccion-titulo"><span>${esc(s.nombre)}</span>
            ${p.id !== 'pie' ? campo(TODOS.get('seccion_' + s.clave), { etiqueta: 'Mostrar esta sección' }) : ''}
            <button type="button" class="enlace-texto" data-sitio-ir="${s.clave}" title="Mostrar esta sección en la vista previa">Ver ↗</button>
          </h3>
          ${listaDeSeccion(s.clave)}
          <div class="campos">${s.campos.map(c => campo(c)).join('')}</div>
        </section>`).join('')}
    </div>`).join('')}
  <p class="vacio" id="sitio-sin-resultados" hidden>Ningún texto coincide con la búsqueda.</p>`;
}
// Atajos a las listas que se muestran dentro de una sección.
const LISTAS_EN = {
  nosotros_valores: 'valor', nosotros_equipo: 'equipo', formacion_talleres: 'taller', formacion_mentorias: 'mentoria',
  formacion_formapro: 'modulo', formacion_actividades: 'actividad', arte_arte_terapia: 'apoyo', arte_terapia_ocupaciona: 'apoyo',
  productora_servicios: 'servicio', productora_producciones: 'produccion', inicio_producciones: 'produccion',
  productora_clientes: 'cliente', inicio_cabeza: 'cinta',
};
function listaDeSeccion(clave) {
  const tipo = LISTAS_EN[clave];
  if (!tipo) return '';
  return `<p class="atajo-lista">Esta sección muestra la lista <b>${esc(TIPOS[tipo].nombre)}</b> (${elementos(tipo).length}). <button type="button" class="enlace-texto" data-tab-sitio="${tipo}">Editar la lista →</button></p>`;
}
function filtrarCampos() {
  const q = sinTildes(ui.qSitio.trim()).split(/\s+/).filter(Boolean);
  let total = 0;
  $$('.pagina-sitio').forEach(pg => {
    let vis = 0;
    pg.querySelectorAll('.seccion-sitio').forEach(sec => {
      let n = 0;
      sec.querySelectorAll('.campo-sitio').forEach(c => {
        const ok = !q.length || q.every(w => (c.dataset.q || '').includes(w));
        c.classList.toggle('no-coincide', !ok);
        if (ok) n++;
      });
      sec.hidden = q.length > 0 && !n;
      vis += n;
    });
    pg.hidden = q.length ? !vis : pg.dataset.pag !== ui.paginaSitio;
    if (q.length) total += vis;
  });
  const cuenta = $('#sitio-buscar-cuenta');
  if (cuenta) cuenta.textContent = q.length ? `${total} ${total === 1 ? 'campo' : 'campos'}` : '';
  const sin = $('#sitio-sin-resultados');
  if (sin) sin.hidden = !q.length || total > 0;
}

/* ---------- Contacto y Aviso ---------- */
function panelContacto() {
  return `<section class="tarjeta">
    <h2><span>Contacto y enlaces</span><small><a class="enlace-texto" href="${SITIO_URL}/contacto" target="_blank" rel="noopener">Ver Contacto ↗</a></small></h2>
    <p class="nota-suave">Se usan en todo el sitio: página de Contacto, pie de página y todos los botones de WhatsApp, correo e inscripción. El WhatsApp y el Instagram de la tienda se editan aparte, en la sección Tienda.</p>
    <div class="campos">${CONTACTO.map(c => campo(c)).join('')}</div>
  </section>`;
}
function panelAviso() {
  return `<section class="tarjeta">
    <h2><span>Aviso arriba de todas las páginas</span></h2>
    <p class="nota-suave">Una franja de color sobre el menú, para anunciar inscripciones, una muestra o un cambio de horario. Las visitas pueden cerrarla.</p>
    <div class="vista-aviso" data-vista-aviso></div>
    <div class="campos">${AVISO.map(c => campo(c)).join('')}</div>
  </section>`;
}
function pintarVistaAviso() {
  const caja = $('[data-vista-aviso]');
  if (!caja) return;
  const v = k => valor(TODOS.get(k));
  const txt = v('aviso_texto').trim();
  caja.className = `vista-aviso color-${v('aviso_color')}`;
  caja.innerHTML = txt && v('aviso_activo') !== 'no'
    ? `<span>${esc(txt)}${v('aviso_enlace').trim() ? ` <u>${esc(v('aviso_boton') || 'Ver más')} →</u>` : ''}</span><span aria-hidden="true">✕</span>`
    : '<em>Sin aviso: el sitio se ve como siempre.</em>';
}

/* ---------- Copia de seguridad ---------- */
function panelCopia() {
  const nT = Object.keys(T()).length, nE = S.sitio.elementos.length;
  return `<section class="tarjeta">
    <h2><span>Copia de seguridad</span></h2>
    <p class="nota-suave">Descarga todo el contenido del sitio (${nT} textos y ${nE} elementos de las listas) en un archivo. Sirve para guardar cómo estaba antes de un cambio grande o para revisarlo.</p>
    <div class="dlg-pie" style="justify-content:flex-start;padding:0;border:0"><button type="button" class="btn" data-sitio-exportar>Descargar copia (JSON)</button></div>
  </section>
  <section class="tarjeta">
    <h2><span>Textos editados</span><small>${editadas().length} campos distintos del original</small></h2>
    <p class="nota-suave">Los campos marcados como «Editado» tienen un texto distinto del que trae el sitio. Con «Restaurar original» vuelven a su texto inicial. Cada cambio queda en la auditoría.</p>
    <ul class="lista lista-editados">${editadas().sort((a, b) => (S.sitio.fechas?.[b] || '').localeCompare(S.sitio.fechas?.[a] || '')).slice(0, 40).map(k => {
      const c = TODOS.get(k), ubic = ubicacion(k);
      return `<li class="fila-click" data-sitio-buscar-campo="${k}"><div class="txt"><b>${esc(ubic)}</b><small>${esc(String(T()[k]).slice(0, 120))}</small></div>${S.sitio.fechas?.[k] ? `<small class="muted">${esc(fechaEdicion(S.sitio.fechas[k]))}</small>` : ''}</li>`;
    }).join('') || '<li class="vacio">Aún no se ha editado ningún texto.</li>'}</ul>
  </section>`;
}
// Campos de las páginas con un texto distinto del original del sitio.
const editadas = () => Object.keys(T()).filter(k => TODOS.has(k) && TODOS.get(k).defecto != null && T()[k] !== TODOS.get(k).defecto);
function ubicacion(k) {
  for (const p of CAMPOS.paginas) {
    if (p.seo && (p.seo.titulo.clave === k || p.seo.descripcion.clave === k)) return `${p.nombre} · Google`;
    for (const s of p.secciones) {
      if ('seccion_' + s.clave === k) return `${p.nombre} · ${s.nombre} (visible)`;
      const c = s.campos.find(x => x.clave === k || x.clave + '_alt' === k);
      if (c) return `${p.nombre} · ${s.nombre} · ${c.etiqueta}`;
    }
  }
  if (CONTACTO.some(c => c.clave === k)) return 'Contacto y enlaces · ' + TODOS.get(k).etiqueta;
  if (AVISO.some(c => c.clave === k)) return 'Aviso · ' + TODOS.get(k).etiqueta;
  return k;
}
const paginaDe = k => CAMPOS.paginas.find(p => (p.seo && [p.seo.titulo.clave, p.seo.descripcion.clave].includes(k)) || p.secciones.some(s => 'seccion_' + s.clave === k || s.campos.some(c => c.clave === k || c.clave + '_alt' === k)));

/* ---------- Listas ---------- */
function panelLista(tipo) {
  const t = TIPOS[tipo];
  const lista = elementos(tipo);
  const visibles = lista.filter(e => e.visible).length;
  const foto = e => t.foto ? (e.imagen || (tipo === 'produccion' && miniaturaYt(e.enlace))) : '';
  return `<section class="tarjeta">
    <h2><span>${esc(t.nombre)}</span><small>${visibles} de ${lista.length} visibles · <a class="enlace-texto" href="${SITIO_URL}${t.ruta}" target="_blank" rel="noopener">Ver en ${esc(t.pagina)} ↗</a></small></h2>
    <div class="controles-lista">
      <p class="nota-suave">Toca un elemento para editarlo. Con las flechas cambias el orden; con el ojo lo muestras u ocultas.</p>
      <button type="button" class="btn" data-sitio-nuevo="${tipo}">+ ${esc(t.nuevo)}</button>
    </div>
    ${lista.length > 6 ? buscador('sitio-' + tipo, 'Buscar en ' + t.nombre.toLowerCase()) : ''}
    ${lista.length ? `<div data-filtrable="sitio-${tipo}"><ul class="lista productos">${lista.map((e, i) => `
      <li class="fila-click ${e.visible ? '' : 'oculto'}" data-sitio-elemento="${e.id}" ${qAttr(e.titulo, e.subtitulo, e.nota, e.visible ? '' : 'oculto')}>
        ${t.foto ? (foto(e) ? `<img class="miniatura${tipo === 'cliente' ? ' contener' : ''}" src="${esc(urlImagen(foto(e)))}" alt="" loading="lazy">` : '<span class="miniatura vacia">Sin foto</span>') : ''}
        <div class="txt"><b>${esc(e.titulo)}</b>${e.subtitulo || e.texto ? `<small>${esc(e.subtitulo || e.texto.slice(0, 90) + (e.texto.length > 90 ? '…' : ''))}</small>` : ''}</div>
        <span class="chips">${e.visible ? '' : '<span class="chip chip-neutro">Oculto</span>'}</span>
        <span class="mover">
          <button type="button" data-visible-sitio="${e.id}" aria-label="${e.visible ? 'Ocultar' : 'Mostrar'} ${esc(e.titulo)}" title="${e.visible ? 'Ocultar del sitio' : 'Mostrar en el sitio'}">${e.visible ? '👁' : '🚫'}</button>
          <button type="button" data-mover-sitio="${e.id}" data-dir="-1" aria-label="Subir ${esc(e.titulo)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-mover-sitio="${e.id}" data-dir="1" aria-label="Bajar ${esc(e.titulo)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>
        </span>
      </li>`).join('')}</ul>${sinResultados('Nada coincide con la búsqueda.')}</div>` : `<p class="vacio">Aún no hay elementos. Crea el primero con «${esc(t.nuevo)}».</p>`}
  </section>`;
}

/* =====================================================================
   Borrador de textos
   ===================================================================== */
function limpiar(c, v) {
  v = String(v ?? '').replace(/\r/g, '');
  if (c.tipo !== 'parrafos') v = v.replace(/\n+/g, c.tipo === 'parrafo' ? ' ' : ' ');
  v = v.trim();
  if (c.tipo === 'whatsapp') return v.replace(/\D/g, '');
  if (c.tipo === 'instagram') return v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '');
  return v;
}
function validar(c, v) {
  const n = `«${ubicacion(c.clave)}»`;
  if (c.tipo === 'whatsapp') {
    if (!/^[0-9]{8,15}$/.test(v)) return `${n}: escribe el WhatsApp con código de país y solo números, por ejemplo 56912345678.`;
    if (v.length === 9 && v.startsWith('9')) return `${n}: agrega el código de Chile al comienzo: 56${v}.`;
  }
  if (!v) return '';
  if (c.tipo === 'correo' && !esCorreo(v)) return `${n}: revisa el correo.`;
  if (c.tipo === 'instagram' && !/^[A-Za-z0-9._]{1,30}$/.test(v)) return `${n}: el usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.`;
  if (c.tipo === 'enlace' && !/^(https:\/\/\S+|\/[^\s]*|#[\w-]+|mailto:\S+)$/.test(v)) return `${n}: el enlace debe empezar con https:// (o ser una página del sitio, como /formacion).`;
  if (c.clave === 'inicio_video' && !ytId(v)) return `${n}: debe ser un enlace de YouTube.`;
  if (c.tipo === 'resaltado' && (v.match(/\*/g) || []).length % 2) return `${n}: falta cerrar un asterisco (*…*).`;
  if (v.length > 3000) return `${n}: es demasiado largo.`;
  return '';
}
// Pone un valor en el borrador; si coincide con lo guardado, sale del borrador.
function ponerBorrador(clave, v) {
  const c = TODOS.get(clave);
  if (!c) return;
  if (v === guardado(c)) delete ui.borradorSitio[clave];
  else ui.borradorSitio[clave] = v;
}
function marcarEstado(clave) {
  // Actualiza la etiqueta «Sin guardar» del campo sin repintar (para no perder el foco).
  const el = document.getElementById('cs-' + clave);
  const cab = el?.closest('.campo-sitio')?.querySelector('.campo-cab');
  if (cab) {
    cab.querySelector('.chip')?.remove();
    if (enBorrador(clave)) cab.children[0].insertAdjacentHTML('afterend', '<span class="chip chip-warn">Sin guardar</span>');
  }
  actualizarBarra();
  const p = paginaDe(clave);
  const b = p && $(`[data-pagina-sitio="${p.id}"]`);
  if (b) {
    const n = [...(p.seo ? [p.seo.titulo.clave, p.seo.descripcion.clave] : []), ...p.secciones.flatMap(s => ['seccion_' + s.clave, ...s.campos.flatMap(c => [c.clave, c.clave + '_alt'])])].filter(enBorrador).length;
    b.querySelector('.punto-cambios')?.remove();
    if (n) b.insertAdjacentHTML('beforeend', ` <small class="punto-cambios" title="Cambios sin guardar">${n}</small>`);
  }
}

document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.id === 'sitio-buscar') { ui.qSitio = el.value; filtrarCampos(); return; }
  const clave = el.dataset?.campoSitio;
  if (!clave || el.type === 'checkbox' || el.tagName === 'SELECT') return;
  ponerBorrador(clave, el.value.replace(/\r/g, ''));
  marcarEstado(clave);
  // Vista de Google en vivo.
  const p = paginaDe(clave);
  if (p?.seo?.titulo.clave === clave) { const g = $(`[data-google-titulo="${p.id}"]`); if (g) g.textContent = el.value; }
  if (p?.seo?.descripcion.clave === clave) { const g = $(`[data-google-desc="${p.id}"]`); if (g) g.textContent = el.value; }
  if (clave.startsWith('aviso_')) pintarVistaAviso();
  enviarPrevia();
});
document.addEventListener('change', ev => {
  const el = ev.target;
  const clave = el.dataset?.campoSitio;
  if (!clave || !(el.type === 'checkbox' || el.tagName === 'SELECT')) return;
  const v = el.type === 'checkbox' ? (el.dataset.tipo === 'seccion' ? (el.checked ? 'visible' : 'oculta') : (el.checked ? 'si' : 'no')) : el.value;
  ponerBorrador(clave, v);
  if (el.dataset.tipo === 'seccion') el.closest('.seccion-sitio')?.classList.toggle('seccion-oculta', !el.checked);
  marcarEstado(clave);
  if (clave.startsWith('aviso_')) pintarVistaAviso();
  enviarPrevia();
});
document.addEventListener('focusin', ev => {
  const clave = ev.target.dataset?.campoSitio;
  if (clave) resaltarPrevia(clave.replace(/_alt$/, ''));
});

async function guardarBorrador(btn) {
  const poner = {}, quitar = [];
  for (const [k, v0] of Object.entries(ui.borradorSitio)) {
    const c = TODOS.get(k);
    if (!c) continue;
    if (v0 == null) { quitar.push(k); continue; }
    const v = limpiar(c, v0);
    const m = validar(c, v);
    if (m) {
      toast(m, 'error');
      irACampo(k);
      return;
    }
    // Igual al original y sin fila guardada: no hace falta guardar nada.
    if (v === (c.defecto ?? '') && c.defecto != null && T()[k] == null) continue;
    if (v === (c.defecto ?? '') && c.defecto != null) quitar.push(k); else poner[k] = v;
  }
  botonOcupado(btn, true, 'Publicando…');
  try {
    await conCarga(async () => {
      await D.guardarTextosSitio(poner);
      await D.borrarTextosSitio(quitar);
    });
    S.sitio = await D.sitio();
    S.sitio.fechas ??= {};
    // Las fotos que se reemplazaron y ya no se usan se borran del bucket.
    const usadas = new Set(Object.values(S.sitio.textos));
    ui.subidasSitio.filter(u => !usadas.has(u)).forEach(u => D.borrarFotoSitio(u).catch(() => { }));
    ui.subidasSitio = [];
    ui.borradorSitio = {};
    toast(`Publicado en spectrumpro.cl (${Object.keys(poner).length + quitar.length} ${Object.keys(poner).length + quitar.length === 1 ? 'cambio' : 'cambios'})`);
    render();
  } catch (e) { toast(e.message, 'error'); }
  finally { botonOcupado(btn, false); }
}
async function descartarBorrador() {
  if (!await confirmar('¿Descartar los cambios sin guardar?', `Se pierden ${cambios()} ${cambios() === 1 ? 'cambio' : 'cambios'} y el sitio queda como está.`, 'Descartar')) return;
  ui.subidasSitio.forEach(u => D.borrarFotoSitio(u).catch(() => { }));
  ui.subidasSitio = [];
  ui.borradorSitio = {};
  render();
}
function irACampo(k) {
  const p = paginaDe(k);
  if (p) { ui.tabSitio = 'paginas'; ui.paginaSitio = p.id; ui.qSitio = ''; }
  else if (CONTACTO.some(c => c.clave === k)) ui.tabSitio = 'contacto';
  else if (AVISO.some(c => c.clave === k)) ui.tabSitio = 'aviso';
  render();
  const el = document.getElementById('cs-' + k);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus({ preventScroll: true }); }
}
window.addEventListener('beforeunload', ev => { if (cambios()) { ev.preventDefault(); ev.returnValue = ''; } });

/* ---------- fotos: reducir (manteniendo la transparencia), subir y galería ---------- */
function prepararFoto(archivo, max = 1600) {
  return new Promise((res, rej) => {
    if (!/^image\/(jpeg|png|webp)$/.test(archivo.type)) { rej(new Error('Usa una imagen JPG, PNG o WebP.')); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d');
      const transparente = archivo.type !== 'image/jpeg';
      if (!transparente) { g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      // WebP conserva la transparencia y pesa poco; si el navegador no sabe hacer WebP, entrega PNG.
      c.toBlob(b => b ? (b.size > 3 * 1048576 ? rej(new Error('La imagen sigue siendo muy pesada. Prueba con una más pequeña.')) : res(b)) : rej(new Error('No se pudo procesar la imagen.')),
        transparente ? 'image/webp' : 'image/jpeg', 0.86);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la imagen. Prueba con un JPG o PNG.')); };
    img.src = url;
  });
}
async function subirFoto(archivo, max) {
  const blob = await prepararFoto(archivo, max);
  return await conCarga(() => D.subirFotoSitio(blob), 'Subiendo imagen…');
}
function ponerImagen(clave, url) {
  ponerBorrador(clave, url);
  render();
}

let galeriaDestino = null;   // función que recibe la URL elegida
async function abrirGaleria(alElegir) {
  galeriaDestino = alElegir;
  let dlg = $('#dlg-sitio-galeria');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-sitio-galeria';
    dlg.className = 'dialogo dialogo-ancho';
    dlg.setAttribute('aria-labelledby', 'galeria-titulo');
    document.body.append(dlg);
  }
  const pintarG = subidas => {
    const grupo = (titulo, lista) => lista.length ? `<h3 class="eyebrow">${esc(titulo)}</h3><div class="galeria-sitio">${lista.map(u => `<button type="button" data-galeria-url="${esc(u)}" title="${esc(u.split('/').pop())}"><img src="${esc(urlImagen(u))}" alt="" loading="lazy"></button>`).join('')}</div>` : '';
    dlg.innerHTML = `<header class="dlg-cab"><h2 id="galeria-titulo">Galería del sitio</h2><button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button></header>
      <div class="dlg-cuerpo">
        ${subidas == null ? '<p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Buscando las imágenes subidas…</p>' : grupo('Subidas desde la plataforma', subidas)}
        ${grupo('Imágenes del sitio', CAMPOS.imagenes || [])}
      </div>`;
  };
  pintarG(null);
  dlg.showModal();
  try { pintarG(await D.fotosSitio()); } catch { pintarG([]); }
}

/* =====================================================================
   Elementos de las listas
   ===================================================================== */
let editando = null;   // { id, tipo, imagen, fotoNueva }
function verFoto(src) {
  const img = $('#se-foto-vista');
  if (!img) return;
  img.hidden = !src; $('#se-foto-vacia').hidden = !!src;
  if (src) img.src = urlImagen(src); else img.removeAttribute('src');
  $('#se-foto-quitar').hidden = !editando.imagen && !editando.fotoNueva;
}
function borradorElemento() {
  const form = $('#form-sitio-elemento');
  if (!form || !editando) return null;
  const t = TIPOS[editando.tipo];
  const e = { id: editando.id || 'nuevo', tipo: editando.tipo, titulo: '', subtitulo: '', texto: '', lista: '', nota: '', enlace: '', orden: 0 };
  for (const c of Object.keys(t.campos)) e[c] = String(form.elements[c].value || '').replace(/\r/g, '').trim();
  e.visible = form.elements.visible.checked;
  e.imagen = editando.fotoNueva ? URL.createObjectURL(editando.fotoNueva) : editando.imagen;
  const previo = editando.id ? elemento(editando.id) : null;
  e.orden = previo ? previo.orden : Math.max(0, ...elementos(editando.tipo).map(x => x.orden || 0)) + 1;
  return e;
}
function abrirElemento(tipo, id = null, copiaDe = null) {
  const t = TIPOS[tipo];
  const e = id ? elemento(id) : copiaDe;
  editando = { id, tipo, imagen: e?.imagen || '', fotoNueva: null };
  const campoE = (c, [etq, f]) => {
    const v = e?.[c] ?? '';
    if (Array.isArray(f)) return `<label class="ancho">${esc(etq)}<select name="${c}">${f.map(o => `<option ${o === (v || f[0]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    return `<label class="ancho">${esc(etq)}${f ? `<textarea name="${c}" rows="${f}" maxlength="${LARGOS[c]}">${esc(v)}</textarea>`
      : `<input name="${c}" maxlength="${LARGOS[c]}" value="${esc(v)}" autocomplete="off"${c === 'enlace' ? ' type="url" placeholder="https://…"' : c === 'nota' && tipo === 'equipo' ? ' type="email"' : ''}${c === 'titulo' ? ' required' : ''}></label>`}`;
  };
  const dlg = $('#dlg-sitio');
  dlg.innerHTML = `<form id="form-sitio-elemento" novalidate>
    <header class="dlg-cab">
      <h2 id="sitio-titulo">${id ? 'Editar ' + esc(e.titulo) : copiaDe ? 'Copia de ' + esc(copiaDe.titulo) : esc(t.nuevo)}</h2>
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button>
    </header>
    <div class="dlg-cuerpo">
      ${t.foto ? `<div class="foto-producto">
        <div class="foto-marco${tipo === 'cliente' ? ' contener' : ''}"><img id="se-foto-vista" alt="" hidden><span id="se-foto-vacia">Sin foto</span></div>
        <div class="foto-acciones">
          <label class="btn btn-sec btn-peq">Subir foto<input id="se-foto" type="file" accept="image/jpeg,image/png,image/webp" class="solo-lector"></label>
          <button type="button" class="btn btn-sec btn-peq" id="se-galeria">Elegir de la galería</button>
          <button type="button" class="btn btn-sec btn-peq" id="se-foto-quitar" hidden>Quitar foto</button>
          <p class="nota-suave">${esc(t.foto)}. JPG, PNG o WebP; se reduce sola antes de subirla.</p>
        </div>
      </div>` : ''}
      <div class="campos">${Object.entries(t.campos).map(([c, def]) => campoE(c, def)).join('')}</div>
      ${t.documento ? `<div class="foto-acciones">
        <label class="btn btn-sec btn-peq">Subir PDF<input id="se-pdf" type="file" accept="application/pdf" class="solo-lector"></label>
        <p class="nota-suave">Hasta 25 MB. Al subirlo se llena el enlace (y el tipo y tamaño, si está vacío). Si es un artículo de otra página, pega su enlace.</p>
      </div>` : ''}
      <label class="check-suelto"><input type="checkbox" name="visible" ${!e || e.visible ? 'checked' : ''}> Mostrar en el sitio</label>
      <p id="sitio-error" class="aviso-error" role="alert" hidden></p>
    </div>
    <footer class="dlg-pie">
      ${id ? '<button type="button" class="btn btn-sec" id="se-eliminar">Eliminar</button><button type="button" class="btn btn-sec" id="se-duplicar">Duplicar</button>' : ''}
      <button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
      <button type="submit" class="btn">Guardar y publicar</button>
    </footer>
  </form>`;
  if (t.foto) verFoto(editando.imagen || (tipo === 'produccion' ? miniaturaYt(e?.enlace) : ''));
  dlg.showModal();
  dlg.querySelector('[name="titulo"]').focus();
  enviarPrevia(t.ruta);
}

document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.id === 'se-foto') {
    const f = el.files[0];
    if (!f || !editando) return;
    const err = $('#sitio-error'); err.hidden = true;
    try {
      editando.fotoNueva = await prepararFoto(f, editando.tipo === 'equipo' ? 700 : 1200);
      verFoto(URL.createObjectURL(editando.fotoNueva));
      enviarPrevia();
    } catch (e) { editando.fotoNueva = null; err.textContent = e.message; err.hidden = false; }
    return;
  }
  if (el.id === 'se-pdf') {
    const f = el.files[0], form = $('#form-sitio-elemento');
    if (!f || !form) return;
    const err = $('#sitio-error'); err.hidden = true;
    try {
      const url = await conCarga(() => D.subirDocumentoSitio(f), 'Subiendo el PDF…');
      form.elements.enlace.value = url;
      const mb = f.size / 1048576;
      if (!form.elements.subtitulo.value.trim()) form.elements.subtitulo.value = 'PDF · ' + (mb >= 1 ? mb.toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB');
      if (!form.elements.titulo.value.trim()) form.elements.titulo.value = f.name.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ');
      toast('PDF subido. Recuerda «Guardar y publicar».');
      enviarPrevia();
    } catch (e) { err.textContent = e.message; err.hidden = false; }
    el.value = '';
    return;
  }
  if (el.dataset?.sitioSubir) {
    const clave = el.dataset.sitioSubir, f = el.files[0];
    if (!f) return;
    try {
      const url = await subirFoto(f);
      ui.subidasSitio.push(url);
      ponerImagen(clave, url);
      toast('Imagen subida. Recuerda «Guardar y publicar».');
    } catch (e) { toast(e.message, 'error'); }
  }
});
document.addEventListener('input', ev => { if (ev.target.closest?.('#form-sitio-elemento')) enviarPrevia(); });

document.addEventListener('submit', async ev => {
  if (ev.target.id !== 'form-sitio-elemento') return;
  ev.preventDefault();
  const t = TIPOS[editando.tipo];
  const previo = editando.id ? elemento(editando.id) : null;
  const e = borradorElemento();
  if (!editando.id) delete e.id;
  e.imagen = editando.imagen;
  const err = $('#sitio-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  if (!e.titulo) return mostrar('Completa el campo «' + t.campos.titulo[0].replace(' *', '') + '».');
  if ((editando.tipo === 'recurso' || editando.tipo === 'episodio') && !e.enlace) return mostrar('Falta el enlace' + (editando.tipo === 'recurso' ? ': sube el PDF o pega el enlace del artículo.' : ' del episodio.'));
  // Los recursos pueden apuntar a un PDF que viene con el sitio (/sitio/docs/…).
  const enlaceDelSitio = editando.tipo === 'recurso' && /^\/sitio\/docs\/[\w.-]+\.pdf$/.test(e.enlace);
  if (e.enlace && !enlaceDelSitio && !/^https:\/\/\S+$/.test(e.enlace) && !e.enlace.startsWith('blob:')) return mostrar('El enlace debe empezar con https://');
  if (editando.tipo === 'produccion' && !ytId(e.enlace)) return mostrar('Pega el enlace del video de YouTube.');
  if (editando.tipo === 'taller' && e.enlace && !ytId(e.enlace)) return mostrar('El video del resultado debe ser un enlace de YouTube.');
  if (editando.tipo === 'equipo' && e.nota && !esCorreo(e.nota)) return mostrar('Revisa el correo.');
  if (t.fotoObligatoria && !e.imagen && !editando.fotoNueva) return mostrar('Sube el logo o elígelo de la galería.');
  const btn = ev.submitter;
  const fotoNueva = editando.fotoNueva;
  botonOcupado(btn, true, fotoNueva ? 'Subiendo foto…' : 'Guardando…');
  try {
    await conCarga(async () => {
      if (fotoNueva) e.imagen = await D.subirFotoSitio(fotoNueva);
      await D.guardarElementoSitio(e);
      if (previo?.imagen && previo.imagen !== e.imagen && !S.sitio.elementos.some(x => x.id !== previo.id && x.imagen === previo.imagen)) await D.borrarFotoSitio(previo.imagen).catch(() => { });
    });
    S.sitio = await D.sitio();
    S.sitio.fechas ??= {};
    $('#dlg-sitio').close();
    toast(previo ? 'Publicado en spectrumpro.cl' : 'Agregado a spectrumpro.cl');
    render();
  } catch (x) { mostrar(x.message); }
  finally { botonOcupado(btn, false); }
});
$('#dlg-sitio').addEventListener('close', () => { editando = null; enviarPrevia(); });

async function eliminarElemento() {
  const e = elemento(editando.id);
  $('#dlg-sitio').close();
  if (!await confirmar(`¿Eliminar «${e.titulo}»?`, 'Desaparece del sitio y no se puede deshacer. Si solo quieres esconderlo por un tiempo, usa el ojo para ocultarlo.', 'Eliminar')) return;
  try {
    await intentar(() => D.eliminarElementoSitio(e.id), 'Eliminado del sitio');
    if (!S.sitio.elementos.some(x => x.id !== e.id && x.imagen === e.imagen)) D.borrarFotoSitio(e.imagen).catch(() => { });
    S.sitio.elementos = S.sitio.elementos.filter(x => x.id !== e.id);
    render();
  } catch { /* ya avisado */ }
}
async function alternarVisible(id) {
  const e = elemento(id);
  if (!e) return;
  e.visible = !e.visible;
  render();
  try { await conCarga(() => D.guardarElementoSitio(e)); toast(e.visible ? `«${e.titulo}» se muestra en el sitio` : `«${e.titulo}» quedó oculto`); }
  catch (x) { e.visible = !e.visible; toast(x.message, 'error'); render(); }
}
async function moverElemento(id, dir) {
  const e = elemento(id);
  const lista = elementos(e.tipo);
  const i = lista.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  lista.forEach((x, k) => { x.orden = k + 1; });
  render();
  try { await D.ordenarElementosSitio(lista.map(x => x.id)); }
  catch (x) { toast(x.message, 'error'); S.sitio = await D.sitio().catch(() => S.sitio); render(); }
}

/* =====================================================================
   Vista previa en vivo
   ===================================================================== */
let previa = null, previaLista = false, previaRuta = '/', previaEspera = null;
function rutaActual() {
  if (ui.tabSitio === 'paginas') return pagina(ui.paginaSitio)?.ruta || '/';
  if (TIPOS[ui.tabSitio]) return TIPOS[ui.tabSitio].ruta;
  if (ui.tabSitio === 'contacto') return '/contacto';
  return '/';
}
function datosPrevia() {
  const textos = { ...T() };
  for (const [k, v] of Object.entries(ui.borradorSitio)) {
    const c = TODOS.get(k);
    if (v == null) delete textos[k]; else textos[k] = c ? limpiar(c, v) : v;
  }
  let lista = S.sitio.elementos.filter(e => e.visible);
  const b = borradorElemento();
  if (b) { lista = lista.filter(e => e.id !== b.id); if (b.visible) lista.push(b); }
  return { textos, elementos: lista };
}
function abrirPrevia() {
  if (!previa) {
    previa = document.createElement('dialog');
    previa.id = 'dlg-sitio-previa';
    previa.className = 'panel-previa';
    previa.setAttribute('aria-label', 'Vista previa del sitio');
    previa.innerHTML = `<header>
        <b>Vista previa</b><span class="nota-suave">Muestra los cambios sin guardar. Nadie más los ve.</span>
        <div class="seg" role="group" aria-label="Tamaño">
          <button type="button" data-previa-ancho="" aria-pressed="true">Computador</button><button type="button" data-previa-ancho="390" aria-pressed="false">Celular</button>
        </div>
        <button type="button" class="cerrar" data-previa-cerrar aria-label="Cerrar vista previa">×</button>
      </header>
      <div class="previa-marco"><iframe title="Vista previa de spectrumpro.cl" referrerpolicy="no-referrer"></iframe></div>`;
    document.body.append(previa);
    previa.addEventListener('close', () => document.body.classList.remove('con-previa'));
  }
  previaRuta = '';
  document.body.classList.add('con-previa');
  previa.show();
  enviarPrevia();
}
function enviarPrevia(ruta) {
  if (!previa?.open || !S.sitio) return;
  const r = ruta || (editando ? TIPOS[editando.tipo].ruta : rutaActual());
  const destino = r.split('#')[0] || '/';
  const iframe = previa.querySelector('iframe');
  if (destino !== previaRuta) {
    previaRuta = destino; previaLista = false;
    iframe.src = `${SITIO_URL}${destino}?vista-previa=1${r.includes('#') ? '#' + r.split('#')[1] : ''}`;
    return;   // al cargar, la página avisa con «sitio-lista» y ahí se le envía el borrador
  }
  clearTimeout(previaEspera);
  previaEspera = setTimeout(() => { if (previaLista) iframe.contentWindow.postMessage({ tipo: 'sitio-vista-previa', datos: datosPrevia() }, SITIO_URL); }, 200);
}
function resaltarPrevia(clave) {
  if (!previa?.open) return;
  const p = paginaDe(clave) || paginaDe('seccion_' + clave);
  if (p && p.id !== 'pie' && p.ruta !== previaRuta) { enviarPrevia(p.ruta); setTimeout(() => resaltarPrevia(clave), 1500); return; }
  if (previaLista) previa.querySelector('iframe').contentWindow.postMessage({ tipo: 'sitio-resaltar', clave }, SITIO_URL);
}
window.addEventListener('message', e => {
  if (e.origin !== SITIO_URL || e.data?.tipo !== 'sitio-lista' || !previa) return;
  previaLista = true;
  enviarPrevia();
});

/* =====================================================================
   Clics
   ===================================================================== */
document.addEventListener('click', async ev => {
  const t = ev.target;
  let x;
  if ((x = t.closest('[data-tab-sitio]'))) { ui.tabSitio = x.dataset.tabSitio; render(); window.scrollTo(0, 0); return; }
  if ((x = t.closest('[data-pagina-sitio]'))) { ui.paginaSitio = x.dataset.paginaSitio; ui.qSitio = ''; render(); return; }
  if ((x = t.closest('[data-sitio-restaurar]'))) {
    const c = TODOS.get(x.dataset.sitioRestaurar);
    if (T()[c.clave] != null) ui.borradorSitio[c.clave] = null; else delete ui.borradorSitio[c.clave];
    render(); return;
  }
  if (t.closest('[data-sitio-guardar]')) { guardarBorrador(t.closest('[data-sitio-guardar]')); return; }
  if (t.closest('[data-sitio-descartar]')) { descartarBorrador(); return; }
  if (t.closest('[data-sitio-previa]')) { abrirPrevia(); return; }
  if (t.closest('[data-previa-cerrar]')) { previa.close(); return; }
  if ((x = t.closest('[data-previa-ancho]'))) {
    $$('[data-previa-ancho]', previa).forEach(b => b.setAttribute('aria-pressed', String(b === x)));
    previa.querySelector('.previa-marco').style.setProperty('--ancho', x.dataset.previaAncho ? x.dataset.previaAncho + 'px' : '100%');
    previa.classList.toggle('celular', !!x.dataset.previaAncho);
    return;
  }
  if ((x = t.closest('[data-sitio-ir]'))) { if (!previa?.open) abrirPrevia(); resaltarPrevia(x.dataset.sitioIr); return; }
  if ((x = t.closest('[data-sitio-galeria]'))) {
    const clave = x.dataset.sitioGaleria;
    abrirGaleria(url => ponerImagen(clave, url)); return;
  }
  if (t.closest('#se-galeria')) {
    abrirGaleria(url => { editando.imagen = url; editando.fotoNueva = null; verFoto(url); enviarPrevia(); }); return;
  }
  if ((x = t.closest('[data-galeria-url]'))) { const f = galeriaDestino; $('#dlg-sitio-galeria').close(); if (f) f(x.dataset.galeriaUrl); return; }
  if ((x = t.closest('[data-sitio-buscar-campo]'))) { irACampo(x.dataset.sitioBuscarCampo); return; }
  if (t.closest('[data-sitio-exportar]')) {
    const copia = { sitio: 'spectrumpro.cl', fecha: new Date().toISOString(), textos: T(), elementos: S.sitio.elementos };
    descargar(`spectrumpro-sitio-${iso(hoy())}.json`, JSON.stringify(copia, null, 2), 'application/json');
    toast('Copia descargada'); return;
  }
  if ((x = t.closest('[data-visible-sitio]'))) { alternarVisible(x.dataset.visibleSitio); return; }
  if ((x = t.closest('[data-mover-sitio]'))) { moverElemento(x.dataset.moverSitio, Number(x.dataset.dir)); return; }
  if ((x = t.closest('[data-sitio-nuevo]'))) { abrirElemento(x.dataset.sitioNuevo); return; }
  if ((x = t.closest('[data-sitio-elemento]'))) { const e = elemento(x.dataset.sitioElemento); if (e) abrirElemento(e.tipo, e.id); return; }
  if (t.closest('#se-eliminar')) { eliminarElemento(); return; }
  if (t.closest('#se-duplicar')) {
    const e = borradorElemento();
    const tipo = editando.tipo;
    e.imagen = editando.imagen;
    $('#dlg-sitio').close();
    abrirElemento(tipo, null, { ...e, titulo: e.titulo + ' (copia)' });
    editando.imagen = e.imagen; verFoto(e.imagen);
    return;
  }
  if (t.closest('#se-foto-quitar')) {
    editando.imagen = ''; editando.fotoNueva = null;
    const inp = $('#se-foto'); if (inp) inp.value = '';
    verFoto(editando.tipo === 'produccion' ? miniaturaYt($('#form-sitio-elemento').elements.enlace?.value) : '');
    enviarPrevia();
  }
});

VISTAS.sitio = vistaSitio;
})();
