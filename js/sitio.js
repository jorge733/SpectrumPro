'use strict';
/* SpectrumPro · Editor del sitio web público (spectrumpro.cl)
   Dirección y el rol Equipo editan los textos, los datos de contacto y las listas del sitio
   (equipo, valores, talleres, mentorías, módulos, apoyos, actividades, servicios y producciones).
   Lo guardado queda en Supabase (tablas sitio_textos y sitio_elementos) y el sitio lo lee al cargar.
   Usa las utilidades globales de app.js ($, esc, toast, confirmar, reducirFoto…). */

(() => {

const SITIO_URL = 'https://spectrumpro.cl';
// Las fotos que vienen con el sitio (/sitio/img/…) están en spectrumpro.cl.
const fotoSitio = u => /^\/(sitio|tienda|assets)\//.test(u || '') ? SITIO_URL + u : (u || '');
const ytId = u => (String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
const miniaturaYt = u => ytId(u) ? `https://i.ytimg.com/vi/${ytId(u)}/hqdefault.jpg` : '';

/* ---------- textos, agrupados por página ----------
   [clave, etiqueta, filas]: filas 0 = una línea; más de 0 = cuadro de texto (cada línea es un párrafo). */
const GRUPOS_TEXTOS = [
  { pagina: 'Inicio', ruta: '/', campos: [
    ['inicio_bajada', 'Bajada bajo el título principal', 3],
    ['inicio_comunidad', 'Texto de la sección «Comunidad»', 3],
    ['inicio_video', 'Video principal (enlace de YouTube)', 0],
  ] },
  { pagina: 'Nosotros', ruta: '/nosotros', campos: [
    ['proposito_titulo', 'Título de la página', 0],
    ['proposito_texto', 'Propósito', 6],
    ['mision', 'Misión', 2],
    ['vision', 'Visión', 2],
    ['cultura', 'Cultura de trabajo', 2],
  ] },
  { pagina: 'Formación', ruta: '/formacion', campos: [
    ['formacion_intro', 'Introducción', 2],
    ['formapro_texto', 'FormaPro', 5],
    ['online_texto', 'SpectrumOnline', 4],
  ] },
  { pagina: 'Arte y Apoyo', ruta: '/arte-y-apoyo', campos: [
    ['arte_terapia_texto', 'Arte Terapia', 4],
    ['terapia_ocupacional_texto', 'Terapia Ocupacional', 3],
  ] },
  { pagina: 'Productora', ruta: '/productora', campos: [
    ['productora_texto', 'Introducción', 4],
  ] },
  { pagina: 'Colabora', ruta: '/colabora', campos: [
    ['colabora_donacion', 'Donación', 4],
    ['enlace_donacion', 'Enlace para donar (Mercado Pago u otro)', 0],
    ['colabora_suscripcion', 'Suscripción mensual', 4],
    ['enlace_suscripcion', 'Enlace para suscribirse', 0],
  ] },
];
const CAMPOS_CONTACTO = [
  ['direccion', 'Dirección', 'Doctor Roberto del Río 1137, Providencia, Santiago, Chile', 'Aparece en Contacto, en el pie de todas las páginas y en el mapa.'],
  ['whatsapp', 'WhatsApp', '56912345678', 'Solo números, con el código de país (56).'],
  ['correo', 'Correo de contacto', 'contacto@spectrumpro.cl', ''],
  ['instagram', 'Instagram', 'spectrumpro.cl', 'Usuario, sin @.'],
  ['youtube', 'YouTube', 'https://www.youtube.com/@…', 'Enlace completo. Vacío = se oculta el ícono.'],
  ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/…', 'Enlace completo. Vacío = se oculta el ícono.'],
  ['patreon', 'Patreon', 'https://www.patreon.com/…', 'Enlace completo. Vacío = se oculta el ícono.'],
];
const CLAVES_ENLACE = new Set(['inicio_video', 'enlace_donacion', 'enlace_suscripcion', 'youtube', 'linkedin', 'patreon']);

/* ---------- listas del sitio ----------
   Cada tipo dice en qué página aparece y qué significa cada campo para él. */
const TIPOS = {
  equipo: { nombre: 'Equipo', nuevo: 'Nueva persona', pagina: 'Nosotros', ruta: '/nosotros#equipo', foto: 'Retrato (cuadrado)', campos: {
    titulo: ['Nombre *', 0], subtitulo: ['Cargo', 0], texto: ['Presentación («Conocer más»)', 5], nota: ['Correo', 0] } },
  valor: { nombre: 'Valores', nuevo: 'Nuevo valor', pagina: 'Nosotros', ruta: '/nosotros', campos: {
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
  servicio: { nombre: 'Servicios', nuevo: 'Nuevo servicio', pagina: 'Productora', ruta: '/productora', campos: {
    titulo: ['Servicio *', 0], texto: ['Descripción', 3] } },
  produccion: { nombre: 'Producciones', nuevo: 'Nueva producción', pagina: 'Inicio y Productora', ruta: '/productora', foto: 'Miniatura (si no hay, se usa la de YouTube)', campos: {
    titulo: ['Título *', 0], subtitulo: ['Tipo (Trailer, Obra completa…)', 0], enlace: ['Enlace de YouTube *', 0] } },
};
const LARGOS = { titulo: 120, subtitulo: 160, texto: 3000, lista: 2000, nota: 500, enlace: 500 };

ui.tabSitio ??= 'textos';
const elementos = tipo => S.sitio.elementos.filter(e => e.tipo === tipo).sort((a, b) => (a.orden - b.orden) || a.titulo.localeCompare(b.titulo, 'es'));
const elemento = id => S.sitio?.elementos.find(e => e.id === id);

/* ---------- vista ---------- */
async function vistaSitio(el) {
  if (!puede.sitio()) { location.hash = 'panel'; return; }
  const cab = `
    <header class="cabecera">
      <div><p class="eyebrow">Dirección y equipo</p><h1>Sitio web</h1><p>Edita los textos y las listas de spectrumpro.cl. Lo que guardes se ve en el sitio al recargarlo.</p></div>
      <div class="controles"><a class="btn btn-sec" href="${SITIO_URL}" target="_blank" rel="noopener">Ver el sitio ↗</a></div>
    </header>`;
  if (!S.sitio) {
    el.innerHTML = cab + `<section class="tarjeta" aria-busy="true">
      <p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Cargando el contenido del sitio…</p>
      ${esqueletoLineas(4)}
    </section>`;
    try { S.sitio = await D.sitio(); }
    catch (e) {
      if (vistaActual() !== 'sitio') return;
      el.innerHTML = cab + `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`;
      return;
    }
    if (vistaActual() === 'sitio') render();
    return;
  }
  const tabs = { textos: ['Textos'], contacto: ['Contacto y redes'] };
  for (const [k, t] of Object.entries(TIPOS)) tabs[k] = [t.nombre, elementos(k).length];
  if (!tabs[ui.tabSitio]) ui.tabSitio = 'textos';
  el.innerHTML = cab + `
    <div class="pestanas pestanas-sitio" role="tablist" aria-label="Partes del sitio">
      ${Object.entries(tabs).map(([k, [n, c]]) => `<button type="button" role="tab" data-tab-sitio="${k}" aria-pressed="${ui.tabSitio === k}" aria-selected="${ui.tabSitio === k}">${esc(n)}${c != null ? ` <small>${c}</small>` : ''}</button>`).join('')}
    </div>
    <div class="pila">${ui.tabSitio === 'textos' ? panelTextos() : ui.tabSitio === 'contacto' ? panelContacto() : panelLista(ui.tabSitio)}</div>`;
}

function campoTexto(clave, etiqueta, filas, valor, placeholder = '', ayuda = '') {
  const v = esc(valor ?? '');
  const tipo = CLAVES_ENLACE.has(clave) ? 'url' : clave === 'correo' ? 'email' : clave === 'whatsapp' ? 'tel' : 'text';
  return `<label class="ancho">${esc(etiqueta)}${ayuda ? ` <small class="muted">· ${esc(ayuda)}</small>` : ''}
    ${filas ? `<textarea data-clave="${clave}" rows="${filas}" maxlength="3000" placeholder="${esc(placeholder)}">${v}</textarea>`
      : `<input data-clave="${clave}" type="${tipo}" maxlength="500" value="${v}" placeholder="${esc(placeholder)}" autocomplete="off"${tipo === 'tel' ? ' inputmode="numeric"' : ''}>`}
  </label>`;
}

function panelTextos() {
  const T = S.sitio.textos;
  return GRUPOS_TEXTOS.map(g => `
    <section class="tarjeta">
      <h2><span>${esc(g.pagina)}</span><small><a class="enlace-texto" href="${SITIO_URL}${g.ruta}" target="_blank" rel="noopener">Ver página ↗</a></small></h2>
      <form class="form-sitio" data-form-textos novalidate>
        <div class="campos">${g.campos.map(([k, n, f]) => campoTexto(k, n, f, T[k], CLAVES_ENLACE.has(k) ? 'https://…' : '')).join('')}</div>
        ${g.campos.some(c => c[2]) ? '<p class="nota-suave">En los cuadros grandes, cada salto de línea empieza un párrafo nuevo.</p>' : ''}
        <p class="aviso-error" role="alert" hidden></p>
        <div class="dlg-pie"><button type="submit" class="btn">Guardar ${esc(g.pagina)}</button></div>
      </form>
    </section>`).join('');
}

function panelContacto() {
  const T = S.sitio.textos;
  return `<section class="tarjeta">
    <h2><span>Contacto y redes</span><small><a class="enlace-texto" href="${SITIO_URL}/contacto" target="_blank" rel="noopener">Ver Contacto ↗</a></small></h2>
    <p class="nota-suave">Se usan en la página de Contacto, en el pie de todas las páginas y en los botones de WhatsApp. El WhatsApp y el Instagram de la tienda se editan aparte, en la sección Tienda.</p>
    <form class="form-sitio" data-form-textos novalidate>
      <div class="campos">${CAMPOS_CONTACTO.map(([k, n, ph, ay]) => campoTexto(k, n, 0, T[k], ph, ay)).join('')}</div>
      <p class="aviso-error" role="alert" hidden></p>
      <div class="dlg-pie"><button type="submit" class="btn">Guardar contacto y redes</button></div>
    </form>
  </section>`;
}

function panelLista(tipo) {
  const t = TIPOS[tipo];
  const lista = elementos(tipo);
  const visibles = lista.filter(e => e.visible).length;
  const foto = e => t.foto ? (e.imagen || (tipo === 'produccion' && miniaturaYt(e.enlace))) : '';
  return `<section class="tarjeta">
    <h2><span>${esc(t.nombre)}</span><small>${visibles} de ${lista.length} visibles · <a class="enlace-texto" href="${SITIO_URL}${t.ruta}" target="_blank" rel="noopener">Ver en ${esc(t.pagina)} ↗</a></small></h2>
    <div class="controles-lista">
      <p class="nota-suave">Toca un elemento para editarlo. Con las flechas cambias el orden en que aparece en el sitio.</p>
      <button type="button" class="btn" data-sitio-nuevo="${tipo}">+ ${esc(t.nuevo)}</button>
    </div>
    ${lista.length > 6 ? buscador('sitio-' + tipo, 'Buscar en ' + t.nombre.toLowerCase()) : ''}
    ${lista.length ? `<div data-filtrable="sitio-${tipo}"><ul class="lista productos">${lista.map((e, i) => `
      <li class="fila-click ${e.visible ? '' : 'oculto'}" data-sitio-elemento="${e.id}" ${qAttr(e.titulo, e.subtitulo, e.nota, e.visible ? '' : 'oculto')}>
        ${t.foto ? (foto(e) ? `<img class="miniatura" src="${esc(fotoSitio(foto(e)))}" alt="" loading="lazy">` : '<span class="miniatura vacia">Sin foto</span>') : ''}
        <div class="txt"><b>${esc(e.titulo)}</b>${e.subtitulo || e.texto ? `<small>${esc(e.subtitulo || e.texto.slice(0, 90) + (e.texto.length > 90 ? '…' : ''))}</small>` : ''}</div>
        <span class="chips">${e.visible ? '' : '<span class="chip chip-neutro">Oculto</span>'}</span>
        <span class="mover">
          <button type="button" data-mover-sitio="${e.id}" data-dir="-1" aria-label="Subir ${esc(e.titulo)}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-mover-sitio="${e.id}" data-dir="1" aria-label="Bajar ${esc(e.titulo)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>
        </span>
      </li>`).join('')}</ul>${sinResultados('Nada coincide con la búsqueda.')}</div>` : `<p class="vacio">Aún no hay elementos. Crea el primero con «${esc(t.nuevo)}».</p>`}
  </section>`;
}

/* ---------- guardar textos ---------- */
function validarTexto(k, v) {
  if (!v) return k === 'whatsapp' ? 'Escribe el WhatsApp: los botones del sitio lo necesitan.' : '';
  if (k === 'whatsapp' && !/^[0-9]{8,15}$/.test(v)) return 'Escribe el WhatsApp con código de país y solo números, por ejemplo 56912345678.';
  if (k === 'whatsapp' && v.length === 9 && v.startsWith('9')) return 'Agrega el código de Chile al comienzo del WhatsApp: 56' + v + '.';
  if (k === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Revisa el correo de contacto.';
  if (k === 'instagram' && !/^[A-Za-z0-9._]{1,30}$/.test(v)) return 'El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.';
  if (CLAVES_ENLACE.has(k) && !/^https:\/\/\S+$/.test(v)) return 'Los enlaces deben empezar con https://';
  if (k === 'inicio_video' && !ytId(v)) return 'El video principal debe ser un enlace de YouTube.';
  return '';
}
function limpiarTexto(k, v) {
  v = v.replace(/\r/g, '').trim();
  if (k === 'whatsapp') return v.replace(/\D/g, '');
  if (k === 'instagram') return v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '');
  return v;
}
document.addEventListener('submit', async ev => {
  const form = ev.target.closest('[data-form-textos]');
  if (!form) return;
  ev.preventDefault();
  const err = form.querySelector('.aviso-error');
  err.hidden = true;
  const cambios = {};
  for (const c of form.querySelectorAll('[data-clave]')) {
    const k = c.dataset.clave, v = limpiarTexto(k, c.value);
    const m = validarTexto(k, v);
    if (m) { err.textContent = m; err.hidden = false; c.focus(); return; }
    if (v !== (S.sitio.textos[k] ?? '')) cambios[k] = v;
  }
  if (!Object.keys(cambios).length) { toast('No hay cambios que guardar'); return; }
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await conCarga(() => D.guardarTextosSitio(cambios));
    Object.assign(S.sitio.textos, cambios);
    toast('Guardado en el sitio web');
    render();
  } catch (e) { err.textContent = e.message; err.hidden = false; }
  finally { botonOcupado(btn, false); }
});

/* ---------- editar un elemento ---------- */
let editando = null;   // { id, tipo, imagen, fotoNueva }
function verFoto(src) {
  const img = $('#se-foto-vista');
  if (!img) return;
  img.hidden = !src; $('#se-foto-vacia').hidden = !!src;
  if (src) img.src = fotoSitio(src); else img.removeAttribute('src');
  $('#se-foto-quitar').hidden = !src || !editando.imagen && !editando.fotoNueva;
}
function abrirElemento(tipo, id = null) {
  const t = TIPOS[tipo];
  const e = id ? elemento(id) : null;
  editando = { id, tipo, imagen: e?.imagen || '', fotoNueva: null };
  const campo = (c, [etq, f]) => {
    const v = e?.[c] ?? '';
    if (Array.isArray(f)) return `<label class="ancho">${esc(etq)}<select name="${c}">${f.map(o => `<option ${o === (v || f[0]) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
    return `<label class="ancho">${esc(etq)}${f ? `<textarea name="${c}" rows="${f}" maxlength="${LARGOS[c]}">${esc(v)}</textarea>`
      : `<input name="${c}" maxlength="${LARGOS[c]}" value="${esc(v)}" autocomplete="off"${c === 'enlace' ? ' type="url" placeholder="https://…"' : c === 'nota' && tipo === 'equipo' ? ' type="email"' : ''}${c === 'titulo' ? ' required' : ''}></label>`}`;
  };
  const dlg = $('#dlg-sitio');
  dlg.innerHTML = `<form id="form-sitio-elemento" novalidate>
    <header class="dlg-cab">
      <h2 id="sitio-titulo">${e ? 'Editar ' + esc(e.titulo) : esc(t.nuevo)}</h2>
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button>
    </header>
    <div class="dlg-cuerpo">
      ${t.foto ? `<div class="foto-producto">
        <div class="foto-marco"><img id="se-foto-vista" alt="" hidden><span id="se-foto-vacia">Sin foto</span></div>
        <div class="foto-acciones">
          <label class="btn btn-sec btn-peq">Elegir foto<input id="se-foto" type="file" accept="image/jpeg,image/png,image/webp" class="solo-lector"></label>
          <button type="button" class="btn btn-sec btn-peq" id="se-foto-quitar" hidden>Quitar foto</button>
          <p class="nota-suave">${esc(t.foto)}. JPG, PNG o WebP; se reduce sola antes de subirla.</p>
        </div>
      </div>` : ''}
      <div class="campos">${Object.entries(t.campos).map(([c, def]) => campo(c, def)).join('')}</div>
      <label class="check-suelto"><input type="checkbox" name="visible" ${!e || e.visible ? 'checked' : ''}> Mostrar en el sitio</label>
      <p id="sitio-error" class="aviso-error" role="alert" hidden></p>
    </div>
    <footer class="dlg-pie">
      ${e ? '<button type="button" class="btn btn-sec" id="se-eliminar">Eliminar</button>' : ''}
      <button type="button" class="btn btn-sec" data-cerrar>Cancelar</button>
      <button type="submit" class="btn">Guardar</button>
    </footer>
  </form>`;
  if (t.foto) verFoto(editando.imagen || (tipo === 'produccion' ? miniaturaYt(e?.enlace) : ''));
  dlg.showModal();
  dlg.querySelector('[name="titulo"]').focus();
}

document.addEventListener('change', async ev => {
  if (ev.target.id !== 'se-foto') return;
  const f = ev.target.files[0];
  if (!f || !editando) return;
  const err = $('#sitio-error'); err.hidden = true;
  try {
    editando.fotoNueva = await reducirFoto(f, editando.tipo === 'equipo' ? 600 : 1000);
    verFoto(URL.createObjectURL(editando.fotoNueva));
  } catch (e) { editando.fotoNueva = null; err.textContent = e.message; err.hidden = false; }
});

document.addEventListener('submit', async ev => {
  if (ev.target.id !== 'form-sitio-elemento') return;
  ev.preventDefault();
  const form = ev.target, t = TIPOS[editando.tipo];
  const previo = editando.id ? elemento(editando.id) : null;
  const e = { id: editando.id || undefined, tipo: editando.tipo, titulo: '', subtitulo: '', texto: '', lista: '', nota: '', enlace: '' };
  for (const c of Object.keys(t.campos)) e[c] = String(form.elements[c].value || '').replace(/\r/g, '').trim();
  e.visible = form.elements.visible.checked;
  e.imagen = editando.imagen;
  e.orden = previo ? previo.orden : Math.max(0, ...elementos(editando.tipo).map(x => x.orden || 0)) + 1;
  const err = $('#sitio-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  if (!e.titulo) return mostrar('Completa el campo «' + t.campos.titulo[0].replace(' *', '') + '».');
  if (e.enlace && !/^https:\/\/\S+$/.test(e.enlace)) return mostrar('El enlace debe empezar con https://');
  if (editando.tipo === 'produccion' && !ytId(e.enlace)) return mostrar('Pega el enlace del video de YouTube.');
  if (editando.tipo === 'taller' && e.enlace && !ytId(e.enlace)) return mostrar('El video del resultado debe ser un enlace de YouTube.');
  if (editando.tipo === 'equipo' && e.nota && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.nota)) return mostrar('Revisa el correo.');
  const btn = ev.submitter;
  const fotoNueva = editando.fotoNueva;
  botonOcupado(btn, true, fotoNueva ? 'Subiendo foto…' : 'Guardando…');
  try {
    await conCarga(async () => {
      if (fotoNueva) e.imagen = await D.subirFotoSitio(fotoNueva);
      await D.guardarElementoSitio(e);
      if (previo?.imagen && previo.imagen !== e.imagen) await D.borrarFotoSitio(previo.imagen).catch(() => { });
    });
    S.sitio = await D.sitio();
    $('#dlg-sitio').close();
    toast(previo ? 'Guardado en el sitio web' : 'Agregado al sitio web');
    render();
  } catch (x) { mostrar(x.message); }
  finally { botonOcupado(btn, false); }
});

async function eliminarElemento() {
  const e = elemento(editando.id);
  $('#dlg-sitio').close();
  if (!await confirmar(`¿Eliminar «${e.titulo}»?`, 'Desaparece del sitio y no se puede deshacer. Si solo quieres esconderlo por un tiempo, desmarca «Mostrar en el sitio».', 'Eliminar')) return;
  try {
    await intentar(() => D.eliminarElementoSitio(e.id), 'Eliminado del sitio');
    D.borrarFotoSitio(e.imagen).catch(() => { });
    S.sitio.elementos = S.sitio.elementos.filter(x => x.id !== e.id);
    render();
  } catch { /* ya avisado */ }
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

document.addEventListener('click', ev => {
  const t = ev.target;
  let x;
  if ((x = t.closest('[data-tab-sitio]'))) { ui.tabSitio = x.dataset.tabSitio; render(); return; }
  if ((x = t.closest('[data-mover-sitio]'))) { moverElemento(x.dataset.moverSitio, Number(x.dataset.dir)); return; }
  if ((x = t.closest('[data-sitio-nuevo]'))) { abrirElemento(x.dataset.sitioNuevo); return; }
  if ((x = t.closest('[data-sitio-elemento]'))) { const e = elemento(x.dataset.sitioElemento); if (e) abrirElemento(e.tipo, e.id); return; }
  if (t.closest('#se-eliminar')) { eliminarElemento(); return; }
  if (t.closest('#se-foto-quitar')) {
    editando.imagen = ''; editando.fotoNueva = null;
    const inp = $('#se-foto'); if (inp) inp.value = '';
    verFoto(editando.tipo === 'produccion' ? miniaturaYt($('#form-sitio-elemento').elements.enlace?.value) : '');
  }
});

VISTAS.sitio = vistaSitio;
})();
