'use strict';
/* SpectrumPro · Comunidad (dirección y rol Equipo)
   · Boletines: se escriben aquí, se ven tal como llegarán (la misma plantilla que usa el servidor,
     supabase/functions/_compartido/correo-boletin.js), se mandan de prueba a la propia cuenta y luego
     a todas las personas suscritas. Los enviados con «Publicar en la página» aparecen en
     https://spectrumpro.cl/comunidad.
   · Suscriptores: quienes se suscribieron en la página Comunidad (con su correo confirmado o no),
     para revisar, exportar a CSV, dar de baja o eliminar.
   El contenido de la página Comunidad (textos, recursos y podcasts) se edita en «Sitio web».
   Usa las utilidades globales de app.js ($, esc, toast, confirmar, conCarga…). */

(() => {

const SITIO_URL = 'https://spectrumpro.cl';
const PERFILES = { '': 'Sin indicar', familia: 'Familia', neurodivergente: 'Persona neurodivergente', educacion: 'Educación', salud: 'Salud', politicas: 'Políticas públicas', otro: 'Otro' };
const ESTADOS_S = { activo: ['Confirmado', 'chip-ok'], pendiente: ['Sin confirmar', 'chip-warn'], baja: ['De baja', 'chip-neutro'] };
const ESTADOS_B = { borrador: ['Borrador', 'chip-neutro'], enviando: ['Enviando…', 'chip-warn'], enviado: ['Enviado', 'chip-ok'] };
const LARGOS = { titulo: 150, resumen: 200, texto: 20000, boton_texto: 60, boton_enlace: 500 };
const urlImagen = u => /^\/(sitio|tienda|assets)\//.test(u || '') ? SITIO_URL + u : (u || '');
const fechaDe = s => { if (!s) return ''; const d = new Date(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const correoHtml = (b, prueba) => window.SPCorreoBoletin ? window.SPCorreoBoletin.boletin(b, { prueba }) : `<p>${esc(b.texto)}</p>`;

ui.tabComunidad ??= 'boletines';
ui.estadoSusc ??= 'activo';

const boletin = id => S.comunidad?.boletines.find(b => b.id === id);
const activos = () => S.comunidad.suscriptores.filter(s => s.estado === 'activo').length;

/* =====================================================================
   Vista
   ===================================================================== */
async function vistaComunidad(el) {
  if (!puede.comunidad()) { location.hash = 'panel'; return; }
  const cab = `
    <header class="cabecera">
      <div><p class="eyebrow">Dirección y equipo</p><h1>Comunidad</h1><p>Boletines por correo para quienes se suscriben en spectrumpro.cl/comunidad. Los textos, documentos y podcasts de esa página se editan en «Sitio web».</p></div>
      <div class="controles">
        <a class="btn btn-sec" href="${SITIO_URL}/comunidad" target="_blank" rel="noopener">Ver la página ↗</a>
        ${S.comunidad ? '<button type="button" class="btn" data-boletin-nuevo>+ Nuevo boletín</button>' : ''}
      </div>
    </header>`;
  if (!S.comunidad) {
    el.innerHTML = cab + `<section class="tarjeta" aria-busy="true">
      <p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Cargando boletines y suscriptores…</p>${esqueletoLineas(4)}</section>`;
    try { S.comunidad = await D.comunidad(); }
    catch (e) {
      if (vistaActual() !== 'comunidad') return;
      el.innerHTML = cab + `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`;
      return;
    }
    if (vistaActual() === 'comunidad') render();
    return;
  }
  const n = { activo: 0, pendiente: 0, baja: 0 };
  for (const s of S.comunidad.suscriptores) n[s.estado] = (n[s.estado] || 0) + 1;
  const tabs = { boletines: ['Boletines', S.comunidad.boletines.length], suscriptores: ['Suscriptores', n.activo] };
  el.innerHTML = cab + `
    <section class="kpis" aria-label="Indicadores">
      <div class="kpi"><span class="kpi-valor">${n.activo}</span><span class="kpi-etq">Personas suscritas</span></div>
      <div class="kpi"><span class="kpi-valor">${n.pendiente}</span><span class="kpi-etq">Sin confirmar su correo</span></div>
      <div class="kpi"><span class="kpi-valor">${S.comunidad.boletines.filter(b => b.estado === 'enviado').length}</span><span class="kpi-etq">Boletines enviados</span></div>
      <div class="kpi"><span class="kpi-valor">${n.baja}</span><span class="kpi-etq">Se dieron de baja</span></div>
    </section>
    <div class="pestanas" role="tablist" aria-label="Comunidad">
      ${Object.entries(tabs).map(([k, [t, c]]) => `<button type="button" role="tab" data-tab-comunidad="${k}" aria-pressed="${ui.tabComunidad === k}" aria-selected="${ui.tabComunidad === k}">${t} <small>${c}</small></button>`).join('')}
    </div>
    <div class="pila">${ui.tabComunidad === 'suscriptores' ? panelSuscriptores() : panelBoletines()}</div>`;
}

function panelBoletines() {
  const lista = [...S.comunidad.boletines].sort((a, b) => (b.enviado_en || b.actualizado || '').localeCompare(a.enviado_en || a.actualizado || ''));
  const orden = { enviando: 0, borrador: 1, enviado: 2 };
  lista.sort((a, b) => orden[a.estado] - orden[b.estado]);
  return `<section class="tarjeta">
    <h2><span>Boletines</span><small>${activos()} ${activos() === 1 ? 'persona recibe' : 'personas reciben'} los boletines</small></h2>
    <p class="nota-suave">Escribe el boletín, mándate una prueba y, cuando esté listo, envíalo a todas las personas suscritas. Cada correo lleva su enlace para darse de baja.</p>
    ${lista.length ? `<ul class="lista boletines">${lista.map(b => `
      <li class="fila-click" data-boletin="${b.id}">
        ${b.imagen ? `<img class="miniatura" src="${esc(urlImagen(b.imagen))}" alt="" loading="lazy">` : '<span class="miniatura vacia">✉</span>'}
        <div class="txt"><b>${esc(b.titulo)}</b><small>${b.estado === 'enviado' ? `Enviado el ${esc(fechaDe(b.enviado_en))} a ${b.destinatarios} ${b.destinatarios === 1 ? 'persona' : 'personas'}` : `Editado el ${esc(fechaDe(b.actualizado))}`}${b.estado === 'enviado' ? (b.publico ? ' · en la página' : ' · no se publica') : ''}</small></div>
        <span class="chips"><span class="chip ${ESTADOS_B[b.estado][1]}">${ESTADOS_B[b.estado][0]}</span></span>
      </li>`).join('')}</ul>` : '<p class="vacio">Aún no hay boletines. Crea el primero con «Nuevo boletín».</p>'}
  </section>`;
}

function filtrados() {
  const e = ui.estadoSusc;
  return S.comunidad.suscriptores.filter(s => e === 'todos' || s.estado === e).sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
}
function panelSuscriptores() {
  const lista = filtrados();
  const filtros = { activo: 'Confirmados', pendiente: 'Sin confirmar', baja: 'De baja', todos: 'Todos' };
  return `<section class="tarjeta">
    <h2><span>Suscriptores</span><button type="button" class="btn btn-sec btn-peq" data-susc-csv ${lista.length ? '' : 'disabled'}>Descargar CSV</button></h2>
    <p class="nota-suave">Solo reciben los boletines quienes confirmaron su correo. Las suscripciones sin confirmar se borran solas a los 30 días. Para volver a recibir correos, una persona dada de baja debe suscribirse otra vez en la página.</p>
    <div class="pestanas pestanas-chicas" role="group" aria-label="Filtrar por estado">
      ${Object.entries(filtros).map(([k, t]) => `<button type="button" data-estado-susc="${k}" aria-pressed="${ui.estadoSusc === k}">${t}</button>`).join('')}
    </div>
    ${lista.length > 6 ? buscador('suscriptores', 'Buscar por correo, nombre o perfil') : ''}
    ${lista.length ? `<div data-filtrable="suscriptores"><div class="tabla-scroll"><table class="tabla">
      <thead><tr><th>Correo</th><th>Nombre</th><th>Perfil</th><th>Estado</th><th>Desde</th><th><span class="solo-lector">Acciones</span></th></tr></thead>
      <tbody>${lista.map(s => `<tr ${qAttr(s.email, s.nombre, PERFILES[s.perfil])}>
        <td><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></td><td>${esc(s.nombre)}</td><td>${esc(PERFILES[s.perfil] || s.perfil)}</td>
        <td><span class="chip ${ESTADOS_S[s.estado][1]}">${ESTADOS_S[s.estado][0]}</span></td>
        <td>${esc(fechaDe(s.confirmado || s.creado))}</td>
        <td class="acciones-fila">${s.estado !== 'baja' ? `<button type="button" class="btn btn-sec btn-peq" data-susc-baja="${s.id}">Dar de baja</button>` : ''}<button type="button" class="btn btn-sec btn-peq" data-susc-eliminar="${s.id}" aria-label="Eliminar ${esc(s.email)}">Eliminar</button></td>
      </tr>`).join('')}</tbody></table></div>${sinResultados('Nadie coincide con la búsqueda.')}</div>` : `<p class="vacio">${ui.estadoSusc === 'activo' ? 'Aún no hay personas suscritas. Comparte spectrumpro.cl/comunidad para que se sumen.' : 'No hay nadie en este grupo.'}</p>`}
  </section>`;
}

/* =====================================================================
   Editor de boletines
   ===================================================================== */
let editando = null;   // copia del boletín que se edita (id null = nuevo)
function leerForm() {
  const f = $('#form-boletin').elements;
  const b = { ...editando };
  for (const c of ['titulo', 'resumen', 'texto', 'boton_texto', 'boton_enlace']) b[c] = String(f[c].value || '').replace(/\r/g, '').trim();
  b.publico = f.publico.checked;
  return b;
}
function pintarPrevia() {
  const fr = $('#bo-previa');
  if (!fr || !editando) return;
  const b = leerForm();
  fr.srcdoc = correoHtml({ ...b, imagen: urlImagen(b.imagen), titulo: b.titulo || 'Título del boletín', texto: b.texto || 'Aquí va el texto del boletín.' }, false);
  $('#bo-asunto').textContent = b.titulo || 'Título del boletín';
  $('#bo-resumen').textContent = b.resumen || b.texto.slice(0, 90);
}
function verImagen() {
  const tiene = !!editando.imagen;
  $('#bo-img').hidden = !tiene; $('#bo-img-vacia').hidden = tiene; $('#bo-img-quitar').hidden = !tiene;
  if (tiene) $('#bo-img').src = urlImagen(editando.imagen);
}

function abrirBoletin(id = null) {
  const b = id ? boletin(id) : null;
  editando = b ? { ...b } : { id: null, titulo: '', resumen: '', texto: '', imagen: '', boton_texto: '', boton_enlace: '', publico: true, estado: 'borrador' };
  const enviado = editando.estado === 'enviado', enviando = editando.estado === 'enviando';
  const n = activos();
  const dlg = $('#dlg-boletin');
  dlg.innerHTML = `<form id="form-boletin" novalidate>
    <header class="dlg-cab">
      <h2 id="boletin-titulo">${b ? esc(b.titulo) : 'Nuevo boletín'} <span class="chip ${ESTADOS_B[editando.estado][1]}">${ESTADOS_B[editando.estado][0]}</span></h2>
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button>
    </header>
    <div class="dlg-cuerpo editor-boletin">
      <div class="pila">
        ${enviado ? `<p class="aviso-info">Se envió el ${esc(fechaDe(editando.enviado_en))} a ${editando.destinatarios} ${editando.destinatarios === 1 ? 'persona' : 'personas'}. Lo que cambies ahora solo se ve en la página Comunidad.</p>` : ''}
        ${enviando ? '<p class="aviso-info">Este envío quedó a medias (se cortó la conexión o se cerró la página). Pulsa «Continuar envío»: solo se manda a quienes aún no lo recibieron.</p>' : ''}
        <div class="campos">
          <label class="ancho">Título (también es el asunto del correo) *<input name="titulo" maxlength="${LARGOS.titulo}" value="${esc(editando.titulo)}" required autocomplete="off" placeholder="Ej: Enfoque del mes: educación inclusiva"></label>
          <label class="ancho">Resumen <small class="muted">· opcional, se ve junto al asunto en la bandeja de entrada</small><input name="resumen" maxlength="${LARGOS.resumen}" value="${esc(editando.resumen)}" autocomplete="off"></label>
          <label class="ancho">Texto *<textarea name="texto" rows="12" maxlength="${LARGOS.texto}" placeholder="Escribe aquí. Cada línea es un párrafo.">${esc(editando.texto)}</textarea>
            <small class="muted">Cada línea es un párrafo · <b>- </b> al inicio de una línea hace una lista · <b>**así**</b> queda en negrita · los enlaces https:// se activan solos.</small></label>
        </div>
        <div class="foto-producto">
          <div class="foto-marco"><img id="bo-img" alt="" hidden><span id="bo-img-vacia">Sin imagen</span></div>
          <div class="foto-acciones">
            <label class="btn btn-sec btn-peq">Subir imagen<input id="bo-img-subir" type="file" accept="image/jpeg,image/png,image/webp" class="solo-lector"></label>
            <button type="button" class="btn btn-sec btn-peq" id="bo-img-quitar" hidden>Quitar imagen</button>
            <p class="nota-suave">Opcional. Va arriba del texto. Horizontal se ve mejor; se reduce sola antes de subirla.</p>
          </div>
        </div>
        <div class="campos">
          <label>Botón: texto <small class="muted">· opcional</small><input name="boton_texto" maxlength="${LARGOS.boton_texto}" value="${esc(editando.boton_texto)}" autocomplete="off" placeholder="Ej: Escuchar el episodio"></label>
          <label>Botón: enlace<input name="boton_enlace" type="url" maxlength="${LARGOS.boton_enlace}" value="${esc(editando.boton_enlace)}" autocomplete="off" placeholder="https://…"></label>
        </div>
        <label class="check-suelto"><input type="checkbox" name="publico" ${editando.publico ? 'checked' : ''}> Publicarlo en la página Comunidad (en «Boletines anteriores») una vez enviado</label>
        <p id="boletin-error" class="aviso-error" role="alert" hidden></p>
      </div>
      <div class="previa-correo" aria-label="Vista previa del correo">
        <div class="bandeja"><b id="bo-asunto"></b><small id="bo-resumen"></small></div>
        <iframe id="bo-previa" title="Vista previa del correo" sandbox=""></iframe>
      </div>
    </div>
    <footer class="dlg-pie">
      ${b ? '<button type="button" class="btn btn-sec" id="bo-eliminar">Eliminar</button>' : ''}
      <button type="button" class="btn btn-sec" data-cerrar>Cerrar</button>
      <button type="submit" class="btn btn-sec">${enviado ? 'Guardar cambios' : 'Guardar borrador'}</button>
      ${enviado ? '' : `<button type="button" class="btn btn-sec" id="bo-prueba">Enviarme una prueba</button>
      <button type="button" class="btn" id="bo-enviar" ${n || enviando ? '' : 'disabled title="Aún no hay personas suscritas"'}>${enviando ? 'Continuar envío' : `Enviar a ${n} ${n === 1 ? 'persona' : 'personas'}`}</button>`}
    </footer>
  </form>`;
  verImagen();
  pintarPrevia();
  dlg.showModal();
  dlg.querySelector('[name="titulo"]').focus();
}

function validar(b, paraEnviar) {
  if (!b.titulo) return 'Escribe el título del boletín.';
  if (paraEnviar && !b.texto) return 'Escribe el texto del boletín.';
  if (b.boton_texto && !/^https:\/\/\S+$/.test(b.boton_enlace)) return 'El enlace del botón debe empezar con https://';
  if (!b.boton_texto && b.boton_enlace) return 'Escribe el texto del botón (o borra el enlace).';
  if ((b.texto.match(/\*\*/g) || []).length % 2) return 'Hay un ** sin cerrar en el texto.';
  return '';
}
// Guarda lo que está en el formulario y devuelve el boletín guardado.
async function guardar(paraEnviar = false) {
  const b = leerForm();
  const err = $('#boletin-error');
  const m = validar(b, paraEnviar);
  err.hidden = !m; err.textContent = m;
  if (m) throw new Error(m);
  b.id = await conCarga(() => D.guardarBoletin(b));
  editando.id = b.id;
  S.comunidad = await D.comunidad();
  return b;
}

document.addEventListener('click', async ev => {
  const t = ev.target;
  let x;
  if ((x = t.closest('[data-tab-comunidad]'))) { ui.tabComunidad = x.dataset.tabComunidad; render(); return; }
  if ((x = t.closest('[data-estado-susc]'))) { ui.estadoSusc = x.dataset.estadoSusc; render(); return; }
  if (t.closest('[data-boletin-nuevo]')) { abrirBoletin(); return; }
  if ((x = t.closest('[data-boletin]'))) { abrirBoletin(x.dataset.boletin); return; }
  if (t.closest('[data-susc-csv]')) {
    const lista = filtrados();
    descargar(`spectrumpro-suscriptores-${ui.estadoSusc}.csv`, csv([['Correo', 'Nombre', 'Perfil', 'Estado', 'Suscripción', 'Confirmación', 'Baja'],
      ...lista.map(s => [s.email, s.nombre, PERFILES[s.perfil] || s.perfil, ESTADOS_S[s.estado][0], fechaDe(s.creado), fechaDe(s.confirmado), fechaDe(s.baja_en)])]), 'text/csv;charset=utf-8');
    toast(`${lista.length} ${lista.length === 1 ? 'persona descargada' : 'personas descargadas'}`);
    return;
  }
  if ((x = t.closest('[data-susc-baja]'))) {
    const s = S.comunidad.suscriptores.find(y => y.id === x.dataset.suscBaja);
    if (!s || !await confirmar(`¿Dar de baja a ${s.email}?`, 'Dejará de recibir los boletines. Solo podrá volver si se suscribe otra vez en la página.', 'Dar de baja')) return;
    try { await intentar(() => D.bajaSuscriptor(s.id), 'Dado de baja'); S.comunidad = await D.comunidad(); render(); } catch { /* ya avisado */ }
    return;
  }
  if ((x = t.closest('[data-susc-eliminar]'))) {
    const s = S.comunidad.suscriptores.find(y => y.id === x.dataset.suscEliminar);
    if (!s || !await confirmar(`¿Eliminar a ${s.email}?`, 'Se borran sus datos de la lista. Si solo quieres que no reciba más correos, usa «Dar de baja».', 'Eliminar')) return;
    try { await intentar(() => D.eliminarSuscriptor(s.id), 'Eliminado de la lista'); S.comunidad.suscriptores = S.comunidad.suscriptores.filter(y => y.id !== s.id); render(); } catch { /* ya avisado */ }
    return;
  }
  if (!t.closest('#dlg-boletin')) return;
  if (t.closest('[data-cerrar]')) { $('#dlg-boletin').close(); return; }
  if (t.id === 'bo-img-quitar') { editando.imagen = ''; verImagen(); pintarPrevia(); return; }
  if (t.id === 'bo-prueba') {
    botonOcupado(t, true, 'Enviando prueba…');
    try {
      const b = await guardar(true);
      const r = await conCarga(() => D.enviarBoletin(b.id, 'prueba'), 'Enviando la prueba…');
      toast(`Prueba enviada a ${r.para}. Revisa tu correo.`);
    } catch (e) { if (!$('#boletin-error').textContent || $('#boletin-error').hidden) toast(e.message, 'error'); }
    finally { botonOcupado(t, false); }
    return;
  }
  if (t.id === 'bo-enviar') {
    let b;
    try { b = await guardar(true); } catch (e) { if ($('#boletin-error').hidden) toast(e.message, 'error'); return; }
    const n = activos();
    const sigue = editando.estado === 'enviando';
    if (!sigue && !await confirmar(`¿Enviar «${b.titulo}» a ${n} ${n === 1 ? 'persona' : 'personas'}?`, 'Llega a todas las personas suscritas y confirmadas. Después de enviarlo no se puede deshacer. ¿Ya te mandaste una prueba?', 'Enviar ahora')) {
      render(); return;
    }
    const dlg = $('#dlg-boletin');
    dlg.close();
    try {
      let total = 0, r;
      do {
        r = await conCarga(() => D.enviarBoletin(b.id, 'enviar'), total ? `Enviando… ${total} de ${n}` : 'Enviando el boletín…');
        total += r.enviados || 0;
      } while (r.restantes > 0);
      toast(`Boletín enviado a ${r.destinatarios ?? total} ${(r.destinatarios ?? total) === 1 ? 'persona' : 'personas'}`);
    } catch (e) { toast(e.message + ' Puedes abrir el boletín y pulsar «Continuar envío».', 'error'); }
    S.comunidad = await D.comunidad().catch(() => S.comunidad);
    render();
    return;
  }
  if (t.id === 'bo-eliminar') {
    const b = boletin(editando.id);
    $('#dlg-boletin').close();
    if (!await confirmar(`¿Eliminar «${b.titulo}»?`, b.estado === 'enviado' ? 'Ya se envió: los correos no se borran, pero desaparece de la página Comunidad y de esta lista.' : 'Se borra el borrador y no se puede deshacer.', 'Eliminar')) return;
    try { await intentar(() => D.eliminarBoletin(b.id), 'Boletín eliminado'); S.comunidad.boletines = S.comunidad.boletines.filter(y => y.id !== b.id); render(); } catch { /* ya avisado */ }
  }
});

document.addEventListener('submit', async ev => {
  if (ev.target.id !== 'form-boletin') return;
  ev.preventDefault();
  const btn = ev.submitter;
  botonOcupado(btn, true, 'Guardando…');
  try {
    await guardar(false);
    $('#dlg-boletin').close();
    toast(editando?.estado === 'enviado' ? 'Cambios guardados en la página Comunidad' : 'Borrador guardado');
    render();
  } catch (e) { if ($('#boletin-error').hidden) toast(e.message, 'error'); }
  finally { botonOcupado(btn, false); }
});

let esperaPrevia = null;
document.addEventListener('input', ev => {
  if (!ev.target.closest?.('#form-boletin')) return;
  clearTimeout(esperaPrevia);
  esperaPrevia = setTimeout(pintarPrevia, 250);
});
document.addEventListener('change', async ev => {
  if (ev.target.closest?.('#form-boletin') && ev.target.name === 'publico') pintarPrevia();
  if (ev.target.id !== 'bo-img-subir') return;
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const blob = await reducirFoto(f, 1200);
    editando.imagen = await conCarga(() => D.subirFotoSitio(blob), 'Subiendo imagen…');
    verImagen(); pintarPrevia();
  } catch (e) { toast(e.message, 'error'); }
  ev.target.value = '';
});
$('#dlg-boletin').addEventListener('close', () => { editando = null; });

VISTAS.comunidad = vistaComunidad;
})();
