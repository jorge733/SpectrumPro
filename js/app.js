'use strict';
/* SpectrumPro · Plataforma del equipo
   Interfaz. Los datos llegan de window.SPDatos (Supabase o demostración). */

const D = window.SPDatos;
const { iso, hoy, sumarDias, tocaEl } = window.SPFechas;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESTADOS = {
  P: { label: 'Presente', chip: 'chip-ok' },
  R: { label: 'Retraso', chip: 'chip-warn' },
  A: { label: 'Ausente', chip: 'chip-bad' },
  J: { label: 'Justificada', chip: 'chip-info' },
};
const ESTADO_ALUMNO = { activo: 'Activo', pausa: 'En pausa', egresado: 'Egresado', retirado: 'Retirado' };
const ROLES = { admin: 'Dirección', terapeuta: 'Terapeuta', tallerista: 'Tallerista', equipo: 'Equipo' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_HISTORIA = 400;   // cuánta asistencia se carga al entrar

/* ---------- utilidades ---------- */
const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fechaLarga = d => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
const fechaCorta = s => { if (!s) return ''; const d = deISO(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
const fechaHora = s => { const d = new Date(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinTildes = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const color = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#635CC7';

function edad(fechaNac, ref = hoy()) {
  const b = deISO(fechaNac);
  let a = ref.getFullYear() - b.getFullYear();
  if (ref.getMonth() < b.getMonth() || (ref.getMonth() === b.getMonth() && ref.getDate() < b.getDate())) a--;
  return a;
}
function proximoCumple(fechaNac, ref = hoy()) {
  const b = deISO(fechaNac);
  let n = new Date(ref.getFullYear(), b.getMonth(), b.getDate());
  if (n < ref) n = new Date(ref.getFullYear() + 1, b.getMonth(), b.getDate());
  return { fecha: n, dias: Math.round((n - ref) / 864e5), cumple: n.getFullYear() - b.getFullYear() };
}
// Año 1904 = año de nacimiento desconocido: se muestra el día, no la edad.
const sinAnio = fechaNac => String(fechaNac || '').startsWith('1904-');
const cumpleTxt = x => sinAnio(x.a.fechaNac) ? '' : ` · cumple ${x.cumple}`;
const nombreVisible = a => `${a.apodo || a.nombre} ${(a.apellidos || '').split(' ')[0]}`;
const nombreCompleto = a => `${a.nombre} ${a.apellidos}`;
const iniciales = s => String(s || '').split(/[\s@._-]+/).filter(p => /^\p{L}/u.test(p)).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
const tono = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = (a, extra = '') => `<span class="avatar ${extra}" style="--h:${tono(a.id)}" aria-hidden="true">${esc(iniciales(`${a.apodo || a.nombre} ${a.apellidos || ''}`))}</span>`;
const horario = t => t.horaInicio ? `${t.horaInicio}${t.horaFin ? ' – ' + t.horaFin : ''}` : 'Sin horario';
// «lun 14, mié 16 y vie 18 de diciembre · lun 4 de enero de 2027»
const listaY = xs => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs.join('');
function fechasTxt(fechas) {
  const grupos = [];
  for (const f of [...fechas].sort()) {
    const d = deISO(f), clave = f.slice(0, 7);
    if (grupos.at(-1)?.clave !== clave) grupos.push({ clave, d, dias: [] });
    grupos.at(-1).dias.push(`${DIAS_CORTOS[d.getDay()].toLowerCase()} ${d.getDate()}`);
  }
  return grupos.map(g => `${listaY(g.dias)} de ${MESES[g.d.getMonth()]}${g.d.getFullYear() !== hoy().getFullYear() ? ' de ' + g.d.getFullYear() : ''}`).join(' · ');
}
const sesionesTxt = n => `${n} ${n === 1 ? 'sesión' : 'sesiones'}`;
const esOnline = t => t?.modalidad === 'online';
const enlaceValido = u => /^https:\/\/[^\s"'<>]+$/i.test(u || '');
const botonUnirse = t => esOnline(t) && enlaceValido(t.enlace) && t.activo
  ? `<a class="btn btn-peq" href="${esc(t.enlace)}" target="_blank" rel="noopener noreferrer">Unirse</a>` : '';
const chipOnline = t => esOnline(t) ? ' <span class="chip chip-online">Online</span>' : '';
const punto = t => `<span class="punto" style="--c:${color(t.color)}"></span>`;

/* ---------- estado ---------- */
const S = {
  perfil: null,
  talleres: [],
  alumnos: [],
  cumple: [],         // jóvenes vigentes
  cumpleEquipo: [],   // profesores y resto del equipo con fecha de nacimiento
  asistencia: {},     // { 'AAAA-MM-DD': { tallerId: { alumnoId: 'P'|'R'|'A'|'J' } } }
  usuarios: [],
  auditoria: null,
  tienda: null,       // { productos, ajustes } · se carga al abrir la sección Tienda
  sitio: null,        // { textos, elementos } · se carga al abrir la sección Sitio web (js/sitio.js)
  comunidad: null,    // { boletines, suscriptores } · se carga al abrir la sección Comunidad (js/comunidad.js)
};
const ui = {
  fecha: iso(hoy()), taller: null, modoAsis: 'lista', mes: iso(hoy()).slice(0, 7), tallerMes: null,
  tabCumple: 'jovenes', busqueda: '', filtroTaller: '', filtroPrograma: '', filtroEstado: 'activo', tabAdmin: 'usuarios',
  expDesde: iso(sumarDias(hoy(), -30)), expHasta: iso(hoy()),
  q: {},              // texto de cada buscador: { clave: 'texto' }
};

const rol = () => S.perfil?.rol;
const puede = {
  verTodo: () => ['admin', 'terapeuta'].includes(rol()),
  editarFichas: () => ['admin', 'terapeuta'].includes(rol()),
  eliminarFichas: () => rol() === 'admin',
  admin: () => rol() === 'admin',
  // La tienda la editan dirección y el rol Equipo.
  tienda: () => ['admin', 'equipo'].includes(rol()),
  // El sitio web público (spectrumpro.cl) lo edita solo dirección.
  sitio: () => rol() === 'admin',
  // Comunidad (boletines y suscriptores): también solo dirección.
  comunidad: () => rol() === 'admin',
  // Rol «equipo»: no ve fichas ni asistencia; solo cumpleaños y talleres.
  esEquipo: () => rol() === 'equipo',
  pasarLista: tid => puede.verTodo() || !!taller(tid)?.equipo.includes(S.perfil.id),
};
const taller = id => S.talleres.find(t => t.id === id);
const alumno = id => S.alumnos.find(a => a.id === id);
const ordenarAlumnos = arr => [...arr].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));
const vigentes = () => S.alumnos.filter(a => a.estado === 'activo' || a.estado === 'pausa');
// Talleres que esta persona trabaja (todos para dirección y terapeutas).
const misTalleres = () => S.talleres.filter(t => t.activo && puede.pasarLista(t.id));

function indexarAsistencia(registros) {
  const idx = {};
  for (const r of registros) ((idx[r.fecha] ??= {})[r.tallerId] ??= {})[r.alumnoId] = r.estado;
  return idx;
}
function registros(f = {}) {
  const out = [];
  for (const [fecha, porTaller] of Object.entries(S.asistencia)) {
    if (f.desde && fecha < f.desde) continue;
    if (f.hasta && fecha > f.hasta) continue;
    for (const [tid, reg] of Object.entries(porTaller)) {
      if (f.taller && tid !== f.taller) continue;
      for (const [aid, e] of Object.entries(reg)) {
        if (f.alumno && aid !== f.alumno) continue;
        out.push({ fecha, taller: tid, alumno: aid, e });
      }
    }
  }
  return out;
}
function resumen(regs) {
  const c = { P: 0, R: 0, A: 0, J: 0, total: regs.length };
  for (const r of regs) c[r.e]++;
  c.pct = c.total ? Math.round((c.P + c.R) / c.total * 100) : null;
  return c;
}
const chipPct = pct => pct == null ? '<span class="chip chip-neutro">Sin registros</span>'
  : `<span class="chip ${pct >= 85 ? 'chip-ok' : pct >= 70 ? 'chip-warn' : 'chip-bad'}">${pct}% asistencia</span>`;
const hace30 = () => iso(sumarDias(hoy(), -30));

/* ---------- interfaz general ---------- */
function toast(msg, tipo = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.textContent = msg;
  box.append(el);
  setTimeout(() => {
    if (sinMovimiento()) { el.remove(); return; }
    el.classList.add('saliendo');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, tipo === 'error' ? 6000 : 3200);
}

/* ---------- animaciones ---------- */
const sinMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Los diálogos se cierran con una animación corta antes del cierre real.
$$('dialog.dialogo').forEach(dlg => {
  const cerrar = dlg.close.bind(dlg), abrir = dlg.showModal.bind(dlg);
  let espera = null;
  dlg.close = v => {
    if (!dlg.open || espera) return;
    if (sinMovimiento()) { cerrar(v); return; }
    dlg.classList.add('cerrando');
    espera = setTimeout(() => { espera = null; dlg.classList.remove('cerrando'); cerrar(v); }, 180);
  };
  dlg.showModal = () => {
    if (espera) { clearTimeout(espera); espera = null; dlg.classList.remove('cerrando'); }
    if (!dlg.open) abrir();
  };
  dlg.addEventListener('close', () => { if (espera) { clearTimeout(espera); espera = null; } dlg.classList.remove('cerrando'); });
});

// Los números de las tarjetas KPI cuentan desde cero al entrar en el panel.
function contarKpis(raiz) {
  if (sinMovimiento()) return;
  $$('.kpi-valor', raiz).forEach(el => {
    const nodo = el.firstChild;
    if (!nodo || nodo.nodeType !== Node.TEXT_NODE) return;
    const fin = Number(nodo.textContent);
    if (!Number.isFinite(fin) || fin <= 0) return;
    const t0 = performance.now(), dur = 800;
    const paso = ahora => {
      const p = Math.min(1, (ahora - t0) / dur);
      nodo.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    };
    nodo.textContent = '0';
    requestAnimationFrame(paso);
  });
}
function confirmar(titulo, texto, etiqueta = 'Confirmar') {
  const dlg = $('#dlg-confirmar');
  $('#conf-titulo').textContent = titulo;
  $('#conf-texto').textContent = texto;
  $('#conf-si').textContent = etiqueta;
  dlg.showModal();
  return new Promise(res => {
    const fin = v => { dlg.close(); $('#conf-si').onclick = $('#conf-no').onclick = dlg.oncancel = null; res(v); };
    $('#conf-si').onclick = () => fin(true);
    $('#conf-no').onclick = () => fin(false);
    dlg.oncancel = () => fin(false);
  });
}
// Indicador de «trabajando» arriba a la derecha. Aparece solo si la tarea tarda más de
// 150 ms, para que las respuestas rápidas no parpadeen.
let cargas = 0, esperaCarga = null;
async function conCarga(tarea, texto = 'Guardando…') {
  if (cargas++ === 0) {
    $('#cargando-texto').textContent = texto;
    esperaCarga = setTimeout(() => { $('#cargando').hidden = false; }, 150);
  }
  try { return await tarea(); }
  finally { if (--cargas === 0) { clearTimeout(esperaCarga); $('#cargando').hidden = true; } }
}
// Pantalla de carga completa (la misma del arranque) para esperas largas.
let esperaLenta = null;
function pantallaCarga(texto) {
  if (texto === false) { clearTimeout(esperaLenta); $('#arranque').hidden = true; return; }
  textoArranque(texto);
  $('#arranque-reintentar').hidden = true;
  $('#arranque').hidden = false;
  clearTimeout(esperaLenta);
  // Si tarda demasiado (mala conexión), se ofrece recargar.
  esperaLenta = setTimeout(() => {
    if ($('#arranque').hidden) return;
    textoArranque('Está tardando más de lo normal. Revisa tu conexión o vuelve a intentarlo.');
    $('#arranque-reintentar').hidden = false;
  }, 15000);
}
async function intentar(tarea, okMsg) {
  try { const r = await conCarga(tarea); if (okMsg) toast(okMsg); return r; }
  catch (e) { toast(e.message || String(e), 'error'); throw e; }
}
function botonOcupado(btn, ocupado, texto) {
  if (!btn) return;
  if (ocupado) { btn.dataset.texto = btn.textContent; btn.textContent = texto || 'Guardando…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.texto || btn.textContent; btn.disabled = false; }
}
function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
/* ---------- buscadores ----------
   Un buscador filtra, sin volver a pintar, los elementos [data-q] que hay dentro de
   las zonas [data-filtrable="clave"]. Los [data-grupo] se ocultan si quedan vacíos y
   cada zona puede tener un .sin-resultados que aparece cuando nada coincide. */
const ICONO_LUPA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9"/></svg>';
function buscador(clave, placeholder, { id = '', valor = ui.q[clave] || '', clase = '' } = {}) {
  return `<div class="buscador ${clase}" role="search">
    ${ICONO_LUPA}
    <input type="search" ${id ? `id="${id}"` : ''} data-buscador="${clave}" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}" value="${esc(valor)}" autocomplete="off" spellcheck="false" enterkeyhint="search">
    <span class="buscador-cuenta" data-cuenta="${clave}" aria-live="polite"></span>
    <button type="button" class="buscador-limpiar" data-limpiar="${clave}" aria-label="Borrar búsqueda" title="Borrar búsqueda" ${valor ? '' : 'hidden'}>×</button>
  </div>`;
}
const qAttr = (...partes) => `data-q="${esc(sinTildes(partes.flat().filter(Boolean).join(' ')))}"`;
const sinResultados = (texto = 'Nada coincide con la búsqueda.') => `<p class="vacio sin-resultados" hidden>${esc(texto)}</p>`;
function aplicarBusqueda(clave, raiz = document) {
  const palabras = sinTildes((ui.q[clave] || '').trim()).split(/\s+/).filter(Boolean);
  let vis = 0, total = 0;
  for (const zona of $$(`[data-filtrable="${clave}"]`, raiz)) {
    let visZona = 0;
    const items = $$('[data-q]', zona);
    for (const it of items) {
      const ok = palabras.every(p => it.dataset.q.includes(p));
      it.hidden = !ok;
      if (ok) visZona++;
    }
    $$('[data-grupo]', zona).forEach(g => { g.hidden = palabras.length > 0 && !$$('[data-q]', g).some(i => !i.hidden); });
    const sr = $('.sin-resultados', zona);
    if (sr) sr.hidden = !(palabras.length && items.length && !visZona);
    vis += visZona; total += items.length;
  }
  $$(`[data-cuenta="${clave}"]`, raiz).forEach(c => { c.textContent = palabras.length ? `${vis} de ${total}` : ''; });
  $$(`[data-limpiar="${clave}"]`, raiz).forEach(b => { b.hidden = !ui.q[clave]; });
}
const aplicarBuscadores = raiz => $$('[data-buscador]', raiz).forEach(i => { if (i.id !== 'buscar') aplicarBusqueda(i.dataset.buscador, raiz); });
// Lista de casillas larga (talleres, equipo): se le pone un buscador encima si tiene muchas opciones.
function filtroChecks(caja, clave, placeholder, minimo = 8) {
  ui.q[clave] = '';
  caja.previousElementSibling?.classList.contains('buscador') && caja.previousElementSibling.remove();
  const labels = $$('label', caja);
  if (labels.length < minimo) { caja.removeAttribute('data-filtrable'); return; }
  labels.forEach(l => { l.dataset.q = sinTildes(l.textContent); });
  caja.dataset.filtrable = clave;
  caja.insertAdjacentHTML('beforeend', sinResultados('Ninguna opción coincide.'));
  caja.insertAdjacentHTML('beforebegin', buscador(clave, placeholder, { clase: 'buscador-peq' }));
}

/* ---------- esqueletos de carga ---------- */
const esqueletoLineas = (n = 3) => `<div class="esqueleto-grupo" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<span class="esqueleto" style="width:${[92, 74, 84, 60, 88][i % 5]}%"></span>`).join('')}</div>`;
const esqueletoTabla = (filas = 6, cols = 4) => `<div class="tabla-scroll" aria-hidden="true"><table class="tabla"><tbody>${Array.from({ length: filas }, () => `<tr>${Array.from({ length: cols }, (_, c) => `<td><span class="esqueleto" style="width:${[70, 60, 85, 95][c % 4]}%"></span></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

const csv = filas => '﻿' + filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');

/* =====================================================================
   Arranque y sesión
   ===================================================================== */
const textoArranque = t => { $('#arranque-texto').textContent = t; };
let necesitaClave = /type=(invite|recovery)/.test(location.hash);

function mostrarAcceso(panel = 'entrar', mensaje = '') {
  document.body.classList.remove('resolviendo');
  pantallaCarga(false);
  $('#app').hidden = true;
  $('#acceso').hidden = false;
  const demo = D.modo === 'demo';
  $('#form-entrar').hidden = demo || panel !== 'entrar';
  $('#form-recuperar').hidden = demo || panel !== 'recuperar';
  $('#form-clave').hidden = demo || panel !== 'clave';
  $('#acceso-demo').hidden = !demo;
  const err = $('#entrar-error');
  err.textContent = mensaje; err.hidden = !mensaje;
  const foco = demo ? $('.rol-demo') : $(`#form-${panel} input`);
  foco?.focus();
}

async function iniciarSesion() {
  pantallaCarga('Verificando tu cuenta…');
  const perfil = await D.perfil();
  if (!perfil || !perfil.activo || !perfil.rol) {
    await D.salir();
    mostrarAcceso('entrar', 'Tu cuenta todavía no tiene acceso. Pide a dirección que la active.');
    return;
  }
  S.perfil = perfil;
  if (necesitaClave) { mostrarAcceso('clave'); return; }
  await cargarTodo();
}

async function cargarTodo(texto = 'Cargando talleres, fichas y asistencia…') {
  pantallaCarga(texto);
  const desde = iso(sumarDias(hoy(), -DIAS_HISTORIA));
  let datos;
  try {
    datos = await Promise.all([
      D.talleres(), D.alumnos(), D.asistencia(desde), D.cumpleanos(), D.cumpleanosEquipo().catch(() => []), puede.admin() ? D.usuarios() : Promise.resolve([]),
    ]);
  } catch (e) {
    // Si ya se veía la plataforma (p. ej. al restablecer la demo), se vuelve a ella.
    if (!$('#app').hidden) pantallaCarga(false);
    throw e;
  }
  const [talleres, alumnos, asistencia, cumple, cumpleEquipo, usuarios] = datos;
  Object.assign(S, { talleres, alumnos, cumple, cumpleEquipo, usuarios, asistencia: indexarAsistencia(asistencia), auditoria: null, tienda: null, sitio: null, comunidad: null });
  mostrarApp();
}

function mostrarApp() {
  document.body.classList.remove('resolviendo');
  document.body.dataset.rol = rol();
  pantallaCarga(false);
  $('#acceso').hidden = true;
  $('#app').hidden = false;
  $('#aviso-demo').hidden = D.modo !== 'demo';
  const p = S.perfil;
  $('#usuario-avatar').textContent = iniciales(p.nombre || p.email);
  $('#usuario-avatar').style.setProperty('--h', tono(p.id));
  $('#usuario-nombre').textContent = p.nombre || p.email;
  $('#usuario-rol').textContent = ROLES[p.rol];
  $$('[data-solo="admin"]').forEach(el => { el.hidden = !puede.admin(); });
  $$('[data-solo="tienda"]').forEach(el => { el.hidden = !puede.tienda(); });
  $$('[data-solo="sitio"]').forEach(el => { el.hidden = !puede.sitio(); });
  $$('[data-solo="comunidad"]').forEach(el => { el.hidden = !puede.comunidad(); });
  $$('[data-no-equipo]').forEach(el => { el.hidden = puede.esEquipo(); });
  // Un grupo del menú se muestra solo si la persona puede abrir al menos una de sus secciones.
  $$('.nav-grupo').forEach(g => { g.hidden = !$$('.nav-sub a', g).some(a => !a.hidden); });
  render();
}

async function arrancar() {
  aplicarPlegado();
  const cfg = window.SPECTRUMPRO_CONFIG || {};
  if (cfg.supabaseUrl && D.modo === 'demo') {
    textoArranque('No se pudo cargar la conexión con Supabase. Revisa tu internet y vuelve a intentarlo.');
    $('#arranque-reintentar').hidden = false;
    return;
  }
  D.alCambiarSesion((evento) => {
    if (evento === 'PASSWORD_RECOVERY') { necesitaClave = true; mostrarAcceso('clave'); }
    if (evento === 'SIGNED_OUT' && S.perfil) { S.perfil = null; mostrarAcceso('entrar', 'Tu sesión terminó. Vuelve a entrar.'); }
  });
  try {
    pantallaCarga('Conectando…');
    const sesion = await D.sesion();
    if (!sesion) return mostrarAcceso();
    await iniciarSesion();
  } catch (e) {
    mostrarAcceso('entrar', e.message || 'No se pudo conectar.');
  }
}

/* ---------- formularios de acceso ---------- */
$('#form-entrar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('#entrar-email').value.trim(), clave = $('#entrar-clave').value;
  const err = $('#entrar-error'); err.hidden = true; $('#entrar-info').hidden = true;
  if (!email || !clave) { err.textContent = 'Escribe tu correo y tu contraseña.'; err.hidden = false; return; }
  const btn = ev.submitter || $('#form-entrar button[type=submit]');
  botonOcupado(btn, true, 'Entrando…');
  try { await D.entrar(email, clave); $('#entrar-clave').value = ''; await iniciarSesion(); }
  catch (e) { pantallaCarga(false); err.textContent = e.message; err.hidden = false; }
  finally { botonOcupado(btn, false); }
});
$('#form-recuperar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('#recuperar-email').value.trim();
  const info = $('#recuperar-info');
  if (!email) { info.textContent = 'Escribe tu correo.'; info.hidden = false; return; }
  const btn = ev.submitter || $('#form-recuperar button[type=submit]');
  botonOcupado(btn, true, 'Enviando…');
  try {
    await D.recuperar(email);
    info.textContent = `Si ${email} corresponde a una cuenta, en unos minutos llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`;
  } catch (e) { info.textContent = e.message; }
  finally { botonOcupado(btn, false); }
  info.hidden = false;
});
$('#form-clave').addEventListener('submit', async ev => {
  ev.preventDefault();
  const c1 = $('#clave-1').value, c2 = $('#clave-2').value, err = $('#clave-error');
  err.hidden = true;
  if (c1.length < 10) { err.textContent = 'La contraseña debe tener al menos 10 caracteres.'; err.hidden = false; return; }
  if (c1 !== c2) { err.textContent = 'Las contraseñas no coinciden.'; err.hidden = false; return; }
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await D.cambiarClave(c1);
    necesitaClave = false;
    history.replaceState(null, '', location.pathname + '#panel');
    toast('Contraseña guardada');
    await iniciarSesion();
  } catch (e) { pantallaCarga(false); err.textContent = e.message; err.hidden = false; }
  finally { botonOcupado(btn, false); }
});

/* ---------- menú plegable (escritorio) ---------- */
const CLAVE_PLEGADO = 'spectrumpro:menu-plegado';
function aplicarPlegado(valor) {
  let plegado = valor;
  if (plegado === undefined) { try { plegado = localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { plegado = false; } }
  document.body.classList.toggle('menu-plegado', plegado);
  const b = $('#plegar');
  b.setAttribute('aria-expanded', String(!plegado));
  b.setAttribute('aria-label', plegado ? 'Expandir menú' : 'Plegar menú');
  b.title = plegado ? 'Expandir menú' : 'Plegar menú';
  if (valor !== undefined) { try { localStorage.setItem(CLAVE_PLEGADO, plegado ? '1' : '0'); } catch { /* sin almacenamiento */ } }
}
$('#plegar').addEventListener('click', () => { cerrarGrupos(); aplicarPlegado(!document.body.classList.contains('menu-plegado')); });

/* ---------- submenús del menú lateral (Edición: Posts, Tienda, Sitio web y Comunidad) ----------
   En el menú abierto se despliegan hacia abajo y recuerdan si quedaron abiertos.
   Con el menú plegado y en la barra inferior del celular se abren como una ventanita flotante. */
const CLAVE_GRUPOS = 'spectrumpro:menu-grupos';
const flotante = () => document.body.classList.contains('menu-plegado') || matchMedia('(max-width: 860px)').matches;
function gruposAbiertos() { try { return JSON.parse(localStorage.getItem(CLAVE_GRUPOS)) || {}; } catch { return {}; } }
function abrirGrupo(g, abierto, recordar = true) {
  g.classList.toggle('abierto', abierto);
  $('.nav-grupo-btn', g).setAttribute('aria-expanded', String(abierto));
  // Menú plegado: el submenú flota junto al botón (fuera de la barra lateral, que tiene su propio scroll).
  if (abierto && document.body.classList.contains('menu-plegado')) {
    const r = $('.nav-grupo-btn', g).getBoundingClientRect();
    $('.nav-sub', g).style.setProperty('--arriba', Math.min(r.top, innerHeight - 200) + 'px');
  }
  if (recordar && !flotante()) {
    const a = gruposAbiertos(); a[g.dataset.grupo] = abierto;
    try { localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(a)); } catch { /* sin almacenamiento */ }
  }
}
function cerrarGrupos() { if (flotante()) $$('.nav-grupo.abierto').forEach(g => abrirGrupo(g, false, false)); }
// Al pintar: marca el grupo de la sección actual y, en el menú abierto, lo despliega.
function marcarGrupos(v) {
  const recordados = gruposAbiertos();
  $$('.nav-grupo').forEach(g => {
    const activo = $$('.nav-sub a', g).some(a => a.dataset.vista === v);
    g.classList.toggle('activo', activo);
    if (flotante()) abrirGrupo(g, false, false);
    else abrirGrupo(g, activo || recordados[g.dataset.grupo] === true, false);
  });
}
document.addEventListener('click', ev => {
  const b = ev.target.closest('.nav-grupo-btn');
  if (b) {
    const g = b.closest('.nav-grupo');
    const abrir = !g.classList.contains('abierto');
    if (flotante()) cerrarGrupos();
    abrirGrupo(g, abrir);
    if (abrir && flotante()) $('.nav-sub a:not([hidden])', g)?.focus({ preventScroll: true });
    return;
  }
  // En modo flotante, un clic fuera del submenú o en una de sus secciones lo cierra.
  if (flotante() && (!ev.target.closest('.nav-grupo') || ev.target.closest('.nav-sub a'))) cerrarGrupos();
});
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !flotante()) return;
  const g = $('.nav-grupo.abierto');
  if (g) { abrirGrupo(g, false, false); $('.nav-grupo-btn', g).focus(); }
});
matchMedia('(max-width: 860px)').addEventListener?.('change', () => marcarGrupos(vistaActual()));

/* =====================================================================
   Vistas
   ===================================================================== */
function vistaPanel(el) {
  if (puede.esEquipo()) return vistaPanelEquipo(el);
  const t = hoy(), f = iso(t);
  const vig = vigentes();
  const sesionesHoy = misTalleres().filter(x => tocaEl(x, t));
  const r30 = resumen(registros({ desde: hace30() }));
  const proximos = lista => lista.map(a => ({ a, ...proximoCumple(a.fechaNac, t) })).filter(x => x.dias <= 30).sort((x, y) => x.dias - y.dias);
  const proxJovenes = proximos(S.cumple), proxEquipo = proximos(S.cumpleEquipo);
  const listaProximos = (arr, vacio) => arr.length ? `<ul class="lista">${arr.slice(0, 6).map(x => `
          <li class="${alumno(x.a.id) ? 'fila-click' : ''}" ${alumno(x.a.id) ? `data-ficha="${x.a.id}"` : ''}>
            ${avatar(x.a)}
            <div class="txt"><b>${esc(nombreVisible(x.a))}</b><small>${x.fecha.getDate()} de ${MESES[x.fecha.getMonth()]}${cumpleTxt(x)}</small></div>
            <span class="dias">${x.dias === 0 ? '¡Hoy!' : x.dias}<small>${x.dias === 0 ? '' : x.dias === 1 ? 'día' : 'días'}</small></span>
          </li>`).join('')}</ul>` : `<p class="vacio">${vacio}</p>`;
  const cumpleMes = S.cumple.filter(a => deISO(a.fechaNac).getMonth() === t.getMonth()).length;
  const alerta = ordenarAlumnos(vig)
    .map(a => ({ a, r: resumen(registros({ alumno: a.id, desde: hace30() })) }))
    .filter(x => x.r.pct != null && x.r.pct < 75).sort((x, y) => x.r.pct - y.r.pct);
  const semanas = [];
  for (let w = 5; w >= 0; w--) {
    const fin = sumarDias(t, -w * 7), ini = sumarDias(fin, -6);
    const r = resumen(registros({ desde: iso(ini), hasta: iso(fin) }));
    semanas.push({ etq: `${ini.getDate()}/${ini.getMonth() + 1}`, pct: r.pct });
  }
  const saludo = (S.perfil.nombre || '').split(' ')[0];

  el.innerHTML = `
    <header class="cabecera">
      <div>
        <p class="eyebrow">${esc(fechaLarga(t))}</p>
        <h1>Hola${saludo ? ', ' + esc(saludo) : ''}</h1>
        <p>${rol() === 'tallerista' ? 'Tus talleres, cumpleaños y alertas de tu alumnado.' : 'Resumen de asistencia, cumpleaños y alertas del alumnado.'}</p>
      </div>
      ${sesionesHoy.length ? '<a class="btn" href="#asistencia">Pasar lista de hoy</a>' : ''}
    </header>

    <section class="kpis" aria-label="Indicadores">
      <div class="kpi"><span class="kpi-valor">${vig.length}</span><span class="kpi-etq">${rol() === 'tallerista' ? 'Jóvenes en tus talleres' : 'Jóvenes vigentes'}</span></div>
      <div class="kpi"><span class="kpi-valor">${sesionesHoy.length}</span><span class="kpi-etq">Sesiones de taller hoy</span></div>
      <div class="kpi"><span class="kpi-valor">${r30.pct ?? '—'}${r30.pct != null ? '<small>%</small>' : ''}</span><span class="kpi-etq">Asistencia últimos 30 días</span></div>
      <div class="kpi"><span class="kpi-valor">${cumpleMes}</span><span class="kpi-etq">Cumpleaños en ${MESES[t.getMonth()]}</span></div>
    </section>

    <div class="rejilla">
      <section class="tarjeta">
        <h2>Sesiones de hoy <small>${DIAS[t.getDay()]}</small></h2>
        ${sesionesHoy.length ? sesionesHoy.map(s => {
          const ins = vig.filter(a => a.estado === 'activo' && a.talleres.includes(s.id)).length;
          const reg = Object.keys(S.asistencia[f]?.[s.id] || {}).length;
          const pct = ins ? Math.min(100, Math.round(reg / ins * 100)) : 0;
          return `<div class="sesion">
            ${punto(s)}
            <div class="txt"><b>${esc(s.nombre)}${chipOnline(s)}</b><small>${esc(horario(s))} · ${ins} inscritos</small>
              <div class="barra" role="img" aria-label="${reg} de ${ins} con asistencia registrada"><span style="width:${pct}%"></span></div></div>
            <div class="sesion-acc">${botonUnirse(s)}${reg >= ins && ins ? '<span class="chip chip-ok">Lista pasada</span>' : `<button type="button" class="btn btn-sec btn-peq" data-ir-taller="${s.id}">Pasar lista</button>`}</div>
          </div>`;
        }).join('') : '<p class="vacio">Hoy no tienes talleres programados.</p>'}
      </section>

      <section class="tarjeta">
        <h2>Próximos cumpleaños <small>30 días</small></h2>
        <h3 class="subtitulo-lista">Jóvenes</h3>
        ${listaProximos(proxJovenes, 'Ningún joven cumple años en los próximos 30 días.')}
        <h3 class="subtitulo-lista">Equipo</h3>
        ${listaProximos(proxEquipo, 'Nadie del equipo cumple años en los próximos 30 días.')}
      </section>

      <section class="tarjeta">
        <h2>Asistencia semanal <small>presentes + retrasos</small></h2>
        <div class="grafico" role="img" aria-label="Porcentaje de asistencia de las últimas seis semanas">
          ${semanas.map(s => `<div class="col"><span class="val">${s.pct ?? '—'}${s.pct != null ? '%' : ''}</span><i style="height:${s.pct ?? 0}%"></i></div>`).join('')}
        </div>
        <div class="grafico-ejes">${semanas.map(s => `<span>${s.etq}</span>`).join('')}</div>
      </section>

      <section class="tarjeta">
        <h2>Requieren seguimiento <small>menos de 75% en 30 días</small></h2>
        ${alerta.length ? `<ul class="lista">${alerta.map(x => `
          <li class="fila-click" data-ficha="${x.a.id}">
            ${avatar(x.a)}
            <div class="txt"><b>${esc(nombreVisible(x.a))}</b><small>${x.r.A} ausencias · ${x.r.J} justificadas</small></div>
            ${chipPct(x.r.pct)}
          </li>`).join('')}</ul>` : '<p class="vacio">Todo el alumnado está sobre 75% de asistencia.</p>'}
      </section>
    </div>`;
}

// Panel del rol «equipo»: sin datos del alumnado ni asistencia.
function vistaPanelEquipo(el) {
  const t = hoy();
  const hoyTalleres = S.talleres.filter(x => x.activo && tocaEl(x, t))
    .sort((a, b) => (a.horaInicio || '99').localeCompare(b.horaInicio || '99'));
  const prox = lista => lista.map(a => ({ a, ...proximoCumple(a.fechaNac, t) })).filter(x => x.dias <= 30).sort((x, y) => x.dias - y.dias);
  const lista = (arr, vacio) => arr.length ? `<ul class="lista">${arr.slice(0, 6).map(x => `
    <li>${avatar(x.a)}
      <div class="txt"><b>${esc(x.a.apodo !== undefined ? nombreVisible(x.a) : x.a.nombre)}</b><small>${x.fecha.getDate()} de ${MESES[x.fecha.getMonth()]}${cumpleTxt(x)}</small></div>
      <span class="dias">${x.dias === 0 ? '¡Hoy!' : x.dias}<small>${x.dias === 0 ? '' : x.dias === 1 ? 'día' : 'días'}</small></span>
    </li>`).join('')}</ul>` : `<p class="vacio">${vacio}</p>`;
  const delMes = arr => arr.filter(a => deISO(a.fechaNac).getMonth() === t.getMonth()).length;
  const saludo = (S.perfil.nombre || '').split(' ')[0];
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${esc(fechaLarga(t))}</p><h1>Hola${saludo ? ', ' + esc(saludo) : ''}</h1><p>Cumpleaños y talleres de SpectrumPro.</p></div>
      ${S.perfil.fechaNac ? '' : '<button type="button" class="btn" data-accion="mi-cumple">Añadir mi cumpleaños</button>'}
    </header>
    <section class="kpis" aria-label="Indicadores">
      <div class="kpi"><span class="kpi-valor">${hoyTalleres.length}</span><span class="kpi-etq">Talleres hoy</span></div>
      <div class="kpi"><span class="kpi-valor">${delMes(S.cumpleEquipo)}</span><span class="kpi-etq">Cumpleaños del equipo en ${MESES[t.getMonth()]}</span></div>
      <div class="kpi"><span class="kpi-valor">${delMes(S.cumple)}</span><span class="kpi-etq">Cumpleaños de jóvenes en ${MESES[t.getMonth()]}</span></div>
    </section>
    <div class="rejilla">
      <section class="tarjeta">
        <h2>Talleres de hoy <small>${DIAS[t.getDay()]}</small></h2>
        ${hoyTalleres.length ? hoyTalleres.map(s => `<div class="sesion">${punto(s)}<div class="txt"><b>${esc(s.nombre)}${chipOnline(s)}</b><small>${esc(horario(s))}${s.encargado ? ' · ' + esc(s.encargado) : ''}</small></div>${botonUnirse(s)}</div>`).join('') : '<p class="vacio">Hoy no hay talleres programados.</p>'}
      </section>
      <section class="tarjeta">
        <h2>Próximos cumpleaños <small>30 días</small></h2>
        <h3 class="subtitulo-lista">Equipo</h3>
        ${lista(prox(S.cumpleEquipo), 'Nadie del equipo cumple años en los próximos 30 días.')}
        <h3 class="subtitulo-lista">Jóvenes</h3>
        ${lista(prox(S.cumple), 'Ningún joven cumple años en los próximos 30 días.')}
      </section>
    </div>`;
}

function vistaAsistencia(el) {
  const propios = misTalleres();
  const d = deISO(ui.fecha);
  const delDia = propios.filter(x => tocaEl(x, d));
  if (!ui.taller || !propios.some(t => t.id === ui.taller)) ui.taller = (delDia[0] || propios[0])?.id || null;
  if (!ui.tallerMes || !propios.some(t => t.id === ui.tallerMes)) ui.tallerMes = ui.taller;

  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">Registro por sesión de taller</p><h1>Asistencia</h1></div>
      <div class="pestanas" role="group" aria-label="Modo">
        <button type="button" data-modo="lista" aria-pressed="${ui.modoAsis === 'lista'}">Pasar lista</button>
        <button type="button" data-modo="mes" aria-pressed="${ui.modoAsis === 'mes'}">Resumen mensual</button>
      </div>
    </header>
    <div id="asis-cuerpo" class="pila"></div>`;
  const cuerpo = $('#asis-cuerpo', el);
  if (!propios.length) { cuerpo.innerHTML = '<section class="tarjeta"><p class="vacio">No tienes talleres asignados. Pide a dirección que te asigne uno.</p></section>'; return; }
  ui.modoAsis === 'lista' ? pasarLista(cuerpo) : resumenMensual(cuerpo);
}

function inscritosActivos(tid) {
  return ordenarAlumnos(S.alumnos.filter(a => a.estado === 'activo' && a.talleres.includes(tid)));
}

function pasarLista(el) {
  const propios = misTalleres();
  const d = deISO(ui.fecha);
  const delDia = propios.filter(x => tocaEl(x, d));
  const otros = propios.filter(x => !tocaEl(x, d));
  const tal = taller(ui.taller);
  const inscritos = tal ? inscritosActivos(tal.id) : [];
  const reg = (tal && S.asistencia[ui.fecha]?.[tal.id]) || {};
  const futuro = ui.fecha > iso(hoy());

  el.innerHTML = `
    <section class="tarjeta pila">
      <div class="controles">
        <label class="campo-inline" for="asis-fecha">Fecha<input type="date" id="asis-fecha" value="${ui.fecha}" max="${iso(hoy())}"></label>
        ${otros.length ? `<label class="campo-inline" for="asis-otro">Otro taller
          <select id="asis-otro"><option value="">Elegir…</option>${otros.map(o => `<option value="${o.id}" ${o.id === ui.taller ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
        </label>` : ''}
      </div>
      <div>
        <p class="eyebrow" style="margin-bottom:8px">Talleres del ${esc(fechaLarga(d))}</p>
        <div class="tallerdia">${delDia.length ? delDia.map(x => `<button type="button" data-taller="${x.id}" aria-pressed="${x.id === ui.taller}">${punto(x)}${esc(x.nombre)} <small>${esc(horario(x))}</small></button>`).join('') : '<p class="vacio" style="padding:0">No hay talleres programados este día. Puedes elegir otro taller arriba.</p>'}</div>
      </div>
    </section>

    ${tal ? `<section class="tarjeta">
      <h2><span>${esc(tal.nombre)}</span><small>${esc(tal.encargado)}</small></h2>
      <div class="controles" style="justify-content:space-between;margin-bottom:8px">
        <div class="leyenda" id="asis-resumen"></div>
        <button type="button" class="btn btn-sec btn-peq" id="todos-presentes" ${futuro || !inscritos.length ? 'disabled' : ''}>Marcar pendientes como presentes</button>
      </div>
      ${futuro ? '<p class="nota-campo">Esta fecha es futura. Solo puedes registrar asistencia de hoy o días anteriores.</p>' : ''}
      ${inscritos.length >= 6 ? buscador('lista', 'Buscar joven en la lista', { clase: 'buscador-lista' }) : ''}
      ${inscritos.length ? `<div data-filtrable="lista"><ul class="lista pase">${inscritos.map(a => `
        <li ${qAttr(a.nombre, a.apellidos, a.apodo)}>
          ${avatar(a)}
          <div class="txt"><b class="fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</b><small>${esc(programasDe(a).join(', '))}${a.pronombres ? ' · ' + esc(a.pronombres) : ''}${a.alergias ? ' · <span class="txt-alerta">Alergia: ' + esc(a.alergias) + '</span>' : ''}</small></div>
          <div class="seg" role="group" aria-label="Asistencia de ${esc(nombreVisible(a))}" data-alumno="${a.id}">
            ${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" data-e="${k}" aria-pressed="${reg[a.id] === k}" title="${v.label}" ${futuro ? 'disabled' : ''}><span class="lbl-corto">${k}</span><span class="lbl-largo">${v.label}</span></button>`).join('')}
          </div>
        </li>`).join('')}</ul>${sinResultados('Nadie de la lista coincide con la búsqueda.')}</div>` : '<p class="vacio">No hay jóvenes activos inscritos en este taller.</p>'}
    </section>` : ''}`;
  pintarResumenLista();
}

function pintarResumenLista() {
  const box = $('#asis-resumen'); if (!box) return;
  const ins = inscritosActivos(ui.taller);
  const reg = S.asistencia[ui.fecha]?.[ui.taller] || {};
  const c = { P: 0, R: 0, A: 0, J: 0 };
  for (const a of ins) if (reg[a.id]) c[reg[a.id]]++;
  const pend = ins.length - c.P - c.R - c.A - c.J;
  box.innerHTML = Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${c[k]} ${v.label.toLowerCase()}</span>`).join('')
    + `<span class="chip chip-neutro">${pend} pendientes</span>`;
}

function fijarLocal(fecha, tid, ids, estado) {
  const dia = (S.asistencia[fecha] ??= {});
  const reg = (dia[tid] ??= {});
  for (const id of ids) { if (estado) reg[id] = estado; else delete reg[id]; }
  if (!Object.keys(reg).length) delete dia[tid];
  if (!Object.keys(dia).length) delete S.asistencia[fecha];
}

async function marcar(aid, e, seg) {
  const { fecha, taller: tid } = ui;
  const antes = S.asistencia[fecha]?.[tid]?.[aid] || null;
  const nuevo = antes === e ? null : e;
  fijarLocal(fecha, tid, [aid], nuevo);   // optimista: la pantalla responde al instante
  pintarSeg(seg, nuevo);
  pintarResumenLista();
  const fila = seg.closest('li');
  fila?.classList.add('guardando'); seg.setAttribute('aria-busy', 'true');
  try { await D.marcar(fecha, tid, [aid], nuevo); }
  catch (err) {
    fijarLocal(fecha, tid, [aid], antes);
    pintarSeg(seg, antes); pintarResumenLista();
    toast(`No se guardó la asistencia. ${err.message}`, 'error');
  } finally { fila?.classList.remove('guardando'); seg.removeAttribute('aria-busy'); }
}
const pintarSeg = (seg, actual) => $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.e === actual)));

function resumenMensual(el) {
  const [y, m] = ui.mes.split('-').map(Number);
  const tal = taller(ui.tallerMes);
  const limite = iso(hoy());
  const fechas = [];
  if (tal) for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = sumarDias(d, 1)) {
    const f = iso(d);
    if (f > limite) break;
    if (tocaEl(tal, d) || S.asistencia[f]?.[tal.id]) fechas.push(d);
  }
  const ins = tal ? ordenarAlumnos(S.alumnos.filter(a => a.talleres.includes(tal.id) && (a.estado === 'activo' || fechas.some(d => S.asistencia[iso(d)]?.[tal.id]?.[a.id])))) : [];
  el.innerHTML = `
    <section class="tarjeta pila" data-filtrable="mes">
      <div class="controles">
        <label class="campo-inline" for="mes-mes">Mes<input type="month" id="mes-mes" value="${ui.mes}"></label>
        <label class="campo-inline" for="mes-taller">Taller
          <select id="mes-taller">${misTalleres().map(o => `<option value="${o.id}" ${o.id === ui.tallerMes ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
        </label>
        ${fechas.length && ins.length >= 6 ? buscador('mes', 'Buscar joven', { clase: 'buscador-inline' }) : ''}
        <div class="leyenda" style="margin-left:auto">${Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${k} · ${v.label}</span>`).join('')}</div>
      </div>
      ${!fechas.length ? '<p class="vacio">No hay sesiones en este mes.</p>' : `
      <div class="tabla-scroll">
        <table class="matriz">
          <thead><tr><th class="nom" scope="col">Joven</th>${fechas.map(d => `<th scope="col">${DIAS_CORTOS[d.getDay()]}<br>${d.getDate()}</th>`).join('')}<th scope="col">Asist.</th></tr></thead>
          <tbody>${ins.map(a => {
            let p = 0, n = 0;
            const celdas = fechas.map(d => {
              const e = S.asistencia[iso(d)]?.[tal.id]?.[a.id];
              if (e) { n++; if (e === 'P' || e === 'R') p++; }
              return `<td class="c ${e ? 'c-' + e : ''}" title="${e ? ESTADOS[e].label : 'Sin registro'}">${e || '·'}</td>`;
            }).join('');
            return `<tr ${qAttr(a.nombre, a.apellidos, a.apodo)}><td class="nom fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</td>${celdas}<td class="pct">${n ? Math.round(p / n * 100) + '%' : '—'}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>${sinResultados('Nadie coincide con la búsqueda.')}`}
    </section>`;
}

function vistaCumpleanos(el) {
  const t = hoy();
  const esEquipo = ui.tabCumple === 'equipo';
  const fuente = esEquipo ? S.cumpleEquipo : S.cumple;
  const lista = fuente.map(a => ({ a, ...proximoCumple(a.fechaNac, t) }));
  const deHoy = lista.filter(x => x.dias === 0);
  const prox = lista.filter(x => x.dias > 0 && x.dias <= 30).sort((x, y) => x.dias - y.dias);
  const meses = Array.from({ length: 12 }, (_, i) => (t.getMonth() + i) % 12);
  const abrible = id => alumno(id) ? `data-ficha="${id}"` : '';
  const nombreLargo = a => esEquipo ? a.nombre : nombreCompleto(a);
  const nombreCorto = a => esEquipo ? a.nombre : nombreVisible(a);
  const vacioEquipo = puede.admin()
    ? 'Aún no hay fechas de nacimiento del equipo. Cada persona puede añadir la suya aquí, o tú desde Administración → Cuentas del equipo.'
    : 'Aún no hay fechas de nacimiento del equipo. Cada persona puede añadir la suya aquí.';

  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${esEquipo ? `${S.cumpleEquipo.length} ${S.cumpleEquipo.length === 1 ? 'persona del equipo' : 'personas del equipo'} con fecha` : `${S.cumple.length} jóvenes vigentes`}</p><h1>Cumpleaños</h1><p>Ordenados desde este mes.</p></div>
      <div class="pestanas" role="group" aria-label="Cumpleaños de">
        <button type="button" data-tab-cumple="jovenes" aria-pressed="${!esEquipo}">Jóvenes <small>${S.cumple.length}</small></button>
        <button type="button" data-tab-cumple="equipo" aria-pressed="${esEquipo}">Equipo <small>${S.cumpleEquipo.length}</small></button>
      </div>
    </header>
    ${puede.admin() ? (() => {
      const reciben = S.usuarios.filter(u => u.avisoCumple && u.activo && u.rol);
      return `<section class="tarjeta mi-cumple aviso-correo">
        <div class="txt"><b>Aviso por correo</b><br><small class="muted">${reciben.length ? `Cada mañana llega un correo con los cumpleaños de hoy y de dentro de 3 días a: ${esc(reciben.map(u => u.nombre || u.email).join(', '))}.` : 'Nadie recibe el aviso todavía. Actívalo en Administración → editar cuenta → «Recibir por correo el aviso de cumpleaños».'}</small></div>
        <button type="button" class="btn btn-sec btn-peq" data-accion="probar-recordatorio">Enviarme una prueba</button>
      </section>`;
    })() : ''}
    ${esEquipo ? `<section class="tarjeta mi-cumple">
      <div class="txt"><b>Tu cumpleaños</b><br><small class="muted">${S.perfil.fechaNac ? esc(fechaLarga(proximoCumple(S.perfil.fechaNac, t).fecha).replace(/^\S+ /, '')) : 'Aún no has puesto tu fecha de nacimiento.'}</small></div>
      <button type="button" class="btn ${S.perfil.fechaNac ? 'btn-sec ' : ''}btn-peq" data-accion="mi-cumple">${S.perfil.fechaNac ? 'Cambiar' : 'Añadir mi fecha'}</button>
    </section>` : ''}
    ${esEquipo && !fuente.length ? `<section class="tarjeta"><p class="vacio">${vacioEquipo}</p></section>` : `
    ${fuente.length > 4 ? `<div class="controles">${buscador('cumple', esEquipo ? 'Buscar persona del equipo' : 'Buscar joven o mes', { clase: 'buscador-ancho' })}</div>` : ''}
    ${deHoy.map(x => `<div class="hoy-cumple">${avatar(x.a, 'avatar-xl')}<div><p class="eyebrow">Hoy, ${esc(fechaLarga(t))}</p><b>${esc(nombreLargo(x.a))} ${sinAnio(x.a.fechaNac) ? 'está de cumpleaños' : `cumple ${x.cumple} años`}</b></div>${alumno(x.a.id) ? `<button type="button" class="btn btn-sec btn-peq" data-ficha="${x.a.id}" style="margin-left:auto">Ver ficha</button>` : ''}</div>`).join('')}
    <section class="tarjeta" data-filtrable="cumple">
      <h2>Próximos 30 días <small>${prox.length} cumpleaños</small></h2>
      ${prox.length ? `<ul class="lista">${prox.map(x => `
        <li class="${alumno(x.a.id) ? 'fila-click' : ''}" ${abrible(x.a.id)} ${qAttr(nombreLargo(x.a), x.a.apodo, MESES[x.fecha.getMonth()])}>
          ${avatar(x.a)}
          <div class="txt"><b>${esc(nombreLargo(x.a))}</b><small>${esc(fechaLarga(x.fecha))}${cumpleTxt(x)}</small></div>
          <span class="dias">${x.dias}<small>${x.dias === 1 ? 'día' : 'días'}</small></span>
        </li>`).join('')}</ul>${sinResultados('Nadie coincide en los próximos 30 días.')}` : '<p class="vacio">No hay cumpleaños en los próximos 30 días.</p>'}
    </section>
    <section class="meses" aria-label="Cumpleaños por mes" data-filtrable="cumple">
      ${meses.map((m, i) => {
        const delMes = fuente.filter(a => deISO(a.fechaNac).getMonth() === m).sort((a, b) => deISO(a.fechaNac).getDate() - deISO(b.fechaNac).getDate());
        return `<div class="mes ${i === 0 ? 'actual' : ''}" data-grupo>
          <h3>${MESES[m]} <small>${delMes.length || ''}</small></h3>
          ${delMes.length ? `<ul>${delMes.map(a => `<li ${abrible(a.id)} class="${alumno(a.id) ? 'clic' : ''}" ${qAttr(nombreLargo(a), a.apodo, MESES[m])}><span class="d">${deISO(a.fechaNac).getDate()}</span><span class="n">${esc(nombreCorto(a))}</span><span class="e">${sinAnio(a.fechaNac) ? '' : proximoCumple(a.fechaNac, t).cumple + ' años'}</span></li>`).join('')}</ul>` : '<p class="vacio" style="padding:0">Sin cumpleaños</p>'}
        </div>`;
      }).join('')}
      ${sinResultados('Nadie coincide con la búsqueda en el calendario.')}
    </section>`}`;
}

function filtrarFichas() {
  const q = sinTildes(ui.busqueda.trim());
  return ordenarAlumnos(S.alumnos).filter(a =>
    (!q || q.split(/\s+/).every(p => sinTildes(`${a.nombre} ${a.apellidos} ${a.apodo} ${a.tutorNombre} ${a.rut} ${a.rut?.replace(/\D/g, '')} ${a.programa} ${a.talleres.map(id => taller(id)?.nombre).join(' ')}`).includes(p))) &&
    (!ui.filtroTaller || a.talleres.includes(ui.filtroTaller)) &&
    (!ui.filtroPrograma || programasDe(a).includes(ui.filtroPrograma)) &&
    (!ui.filtroEstado || a.estado === ui.filtroEstado));
}
function vistaAlumnos(el) {
  const programas = [...new Set(S.alumnos.flatMap(programasDe))].sort();
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${S.alumnos.length} fichas${rol() === 'tallerista' ? ' de tus talleres' : ''}</p><h1>Fichas del alumnado</h1></div>
      ${puede.editarFichas() ? '<button type="button" class="btn" data-accion="nueva-ficha">+ Nueva ficha</button>' : ''}
    </header>
    <div class="controles">
      ${buscador('fichas', 'Buscar por nombre, RUT, responsable o taller', { id: 'buscar', valor: ui.busqueda, clase: 'buscador-ancho' })}
      <select id="filtro-estado" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${Object.entries(ESTADO_ALUMNO).map(([k, v]) => `<option value="${k}" ${k === ui.filtroEstado ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="filtro-programa" aria-label="Filtrar por programa"><option value="">Todos los programas</option>${programas.map(p => `<option ${p === ui.filtroPrograma ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select id="filtro-taller" aria-label="Filtrar por taller"><option value="">Todos los talleres</option>${S.talleres.map(t => `<option value="${t.id}" ${t.id === ui.filtroTaller ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
    </div>
    <div id="lista-fichas"></div>`;
  pintarFichas();
}
function pintarFichas() {
  const lista = filtrarFichas();
  const filtrando = ui.busqueda.trim() || ui.filtroTaller || ui.filtroPrograma || ui.filtroEstado;
  $$('[data-cuenta="fichas"]').forEach(c => { c.textContent = filtrando ? `${lista.length} de ${S.alumnos.length}` : ''; });
  $$('[data-limpiar="fichas"]').forEach(b => { b.hidden = !ui.busqueda; });
  $('#lista-fichas').innerHTML = lista.length ? `<div class="fichas">${lista.map(a => {
    const r = resumen(registros({ alumno: a.id, desde: hace30() }));
    return `<button type="button" class="ficha-card" data-ficha="${a.id}">
      <div class="top">${avatar(a)}<div><b>${esc(nombreCompleto(a))}</b><small>${edad(a.fechaNac)} años · ${esc(programasDe(a).join(', '))}</small></div></div>
      <div class="talleres-mini">${a.talleres.map(id => { const t = taller(id); return t ? `<span class="tag">${punto(t)}${esc(t.nombre)}</span>` : ''; }).join('')}</div>
      <div class="pie">${a.estado !== 'activo' ? `<span class="chip chip-neutro">${ESTADO_ALUMNO[a.estado]}</span>` : chipPct(r.pct)}${a.beca ? `<span class="chip chip-neutro">${esc(a.beca)}</span>` : ''}${a.alergias ? '<span class="chip chip-bad">Alergia</span>' : ''}</div>
    </button>`;
  }).join('')}</div>` : `<div class="vacio-grande">${S.alumnos.length ? 'No hay fichas que coincidan con la búsqueda.' : puede.editarFichas() ? 'Aún no hay fichas. Crea la primera con «Nueva ficha».' : 'Aún no hay jóvenes inscritos en tus talleres.'}</div>`;
}

const TEMPORADAS = {
  semestral: { titulo: 'Talleres semestrales', tuyos: 'Tus talleres semestrales', desc: 'Talleres del semestre' },
  verano: { titulo: 'Talleres de verano', tuyos: 'Tus talleres de verano', desc: 'Talleres de la temporada de verano' },
  online: { titulo: 'Talleres online', tuyos: 'Tus talleres online', desc: 'Talleres por videollamada' },
};
const vistaTalleres = el => vistaTemporada(el, 'semestral');
const vistaVerano = el => vistaTemporada(el, 'verano');
// «Talleres online» junta los talleres online de cualquier temporada; las otras dos secciones muestran solo los presenciales.
const vistaOnline = el => vistaTemporada(el, 'online');
// Talleres de una sección (semestral, verano u online) que ve la persona, ya ordenados:
// por área (FormaPro arriba, Arte y Apoyo al final) y, dentro de cada área, por su orden
// (los de verano, por su primera fecha).
function talleresDeSeccion(temporada) {
  const eq = puede.esEquipo();
  const online = temporada === 'online';
  const lista = (puede.verTodo() ? S.talleres : eq ? S.talleres.filter(t => t.activo) : misTalleres())
    .filter(t => online ? esOnline(t) : !esOnline(t) && (t.temporada || 'semestral') === temporada);
  SPTalleres.ordenarTalleres(lista);
  if (temporada === 'verano') lista.sort((a, b) => SPTalleres.rangoArea(a.area) - SPTalleres.rangoArea(b.area) || (a.fechas[0] || '9').localeCompare(b.fechas[0] || '9') || a.orden - b.orden);
  return lista;
}
const nombreArea = area => String(area || '').trim() === 'Formación general' ? 'FormaPro · Formación general' : (String(area || '').trim() || 'Sin área');
// Agrupa una lista ya ordenada en bloques consecutivos de la misma área.
function porArea(lista) {
  const grupos = [];
  for (const t of lista) {
    const k = nombreArea(t.area);
    if (grupos.at(-1)?.area !== k) grupos.push({ area: k, talleres: [] });
    grupos.at(-1).talleres.push(t);
  }
  return grupos;
}
const correos = txt => String(txt || '').split(/[,;]/).map(c => c.trim()).filter(Boolean);
const correoValido = c => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(c);
const enlacesCorreo = txt => correos(txt).map(c => `<a href="mailto:${esc(c)}">${esc(c)}</a>`).join('<br>');
function vistaTemporada(el, temporada) {
  const txt = TEMPORADAS[temporada];
  const eq = puede.esEquipo();
  const online = temporada === 'online';
  const lista = talleresDeSeccion(temporada);
  const grupos = porArea(lista);
  const mover = puede.admin() && temporada !== 'verano';
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${lista.length} talleres</p><h1>${puede.verTodo() || eq ? txt.titulo : txt.tuyos}</h1><p>${txt.desc}: ${temporada === 'verano' ? 'fechas, horario' : online ? 'horario, enlace' : 'horario semanal'}${eq ? ' y quién está a cargo.' : ' y asistencia de los últimos 30 días.'}</p></div>
      <div class="controles">
        ${lista.length ? `<button type="button" class="btn btn-sec" data-accion="horario" data-temporada="${temporada}">Horario para imprimir</button>` : ''}
        ${puede.admin() ? `<button type="button" class="btn" data-accion="nuevo-taller" ${online ? 'data-modalidad="online"' : `data-temporada="${temporada}"`}>+ Nuevo taller${temporada === 'verano' ? ' de verano' : online ? ' online' : ''}</button>` : ''}
      </div>
    </header>
    ${mover && lista.length > 1 ? '<p class="nota-suave">Los talleres se muestran por área: FormaPro arriba, luego los talleres y al final Arte y Apoyo. Con las flechas ↑ ↓ cambias el orden dentro de cada área.</p>' : ''}
    ${lista.length > 3 ? `<div class="controles">${buscador('talleres-' + temporada, 'Buscar taller, área, día o persona a cargo', { clase: 'buscador-ancho' })}</div>` : ''}
    ${lista.length ? `<div data-filtrable="talleres-${temporada}">${grupos.map(g => `<section class="grupo-area" data-grupo>
      ${grupos.length > 1 ? `<h2 class="titulo-grupo">${esc(g.area)} <small>${g.talleres.length}</small></h2>` : ''}
      <div class="talleres">${g.talleres.map((t, i) => {
      const ins = S.alumnos.filter(a => a.estado === 'activo' && a.talleres.includes(t.id));
      const r = resumen(registros({ taller: t.id, desde: hace30() }));
      const equipo = S.usuarios.filter(u => t.equipo.includes(u.id));
      const tienePrograma = t.programaTexto || t.programaPdf;
      return `<article class="taller ${t.activo ? '' : 'inactivo'}" style="--c:${color(t.color)}" ${qAttr(t.nombre, t.area, nombreArea(t.area), t.encargado, t.encargadoEmail, t.objetivo, t.dias.map(d => DIAS[d]), t.fechas.length ? fechasTxt(t.fechas) : '', t.edad, equipo.map(u => u.nombre || u.email), t.activo ? '' : 'inactivo', online ? 'online' : '')}>
        <div class="taller-cab">
          <h2><button type="button" class="enlace-titulo" data-ver-taller="${t.id}">${esc(t.nombre)}</button>${online && t.temporada === 'verano' ? ' <span class="chip chip-neutro">Verano</span>' : ''}${t.activo ? '' : ' <span class="chip chip-neutro">Inactivo</span>'}</h2>
          ${mover && g.talleres.length > 1 ? `<span class="mover">
            <button type="button" data-mover-taller="${t.id}" data-dir="-1" data-temporada="${temporada}" aria-label="Subir ${esc(t.nombre)}" title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-mover-taller="${t.id}" data-dir="1" data-temporada="${temporada}" aria-label="Bajar ${esc(t.nombre)}" title="Bajar" ${i === g.talleres.length - 1 ? 'disabled' : ''}>↓</button>
          </span>` : ''}
        </div>
        ${t.objetivo ? `<p class="objetivo">${esc(t.objetivo)}</p>` : ''}
        <dl>
          <dt>Área</dt><dd>${esc(t.area) || '—'}</dd>
          ${t.fechas.length ? `<dt>Fechas</dt><dd>${esc(fechasTxt(t.fechas))} <span class="muted">(${sesionesTxt(t.fechas.length)})</span></dd>`
            : `<dt>Días</dt><dd>${t.dias.length ? t.dias.map(d => DIAS[d]).join(', ') : '—'}</dd>`}
          <dt>Horario</dt><dd class="num">${esc(horario(t))}${t.nota ? `<br><span class="muted">${esc(t.nota)}</span>` : ''}</dd>
          ${t.edad ? `<dt>Edad</dt><dd>${esc(t.edad)}</dd>` : ''}
          <dt>A cargo</dt><dd>${esc(t.encargado) || '—'}</dd>
          ${t.encargadoEmail ? `<dt>Correo</dt><dd class="enlace">${enlacesCorreo(t.encargadoEmail)}</dd>` : puede.admin() ? `<dt>Correo</dt><dd><button type="button" class="enlace-texto" data-editar-taller="${t.id}" data-foco="t-encargado-email">+ Agregar correo</button></dd>` : ''}
          ${online ? `<dt>Enlace</dt><dd class="enlace">${enlaceValido(t.enlace) ? `<a href="${esc(t.enlace)}" target="_blank" rel="noopener noreferrer">${esc(t.enlace.replace(/^https:\/\//i, ''))}</a>` : '<span class="muted">Sin enlace</span>'}</dd>` : ''}
          ${puede.admin() ? `<dt>Pasan lista</dt><dd>${equipo.length ? equipo.map(u => esc(u.nombre || u.email)).join(', ') : '<span class="muted">Solo dirección y terapeutas</span>'}</dd>` : ''}
          ${eq ? '' : `<dt>Inscritos</dt><dd class="num">${ins.length}</dd>`}
          <dt>Programa</dt><dd>${tienePrograma ? `<button type="button" class="btn btn-sec btn-peq" data-ver-taller="${t.id}" data-pestana="programa">Ver programa</button>` : '<span class="muted">Sin programa</span>'}</dd>
          <dt>Afiches</dt><dd>${t.afiches.length ? `<button type="button" class="btn btn-sec btn-peq" data-ver-taller="${t.id}" data-pestana="afiches">Ver ${t.afiches.length === 1 ? 'afiche' : t.afiches.length + ' afiches'}</button>` : '<span class="muted">Sin material</span>'}</dd>
        </dl>
        <div class="acciones">${eq ? '' : chipPct(r.pct)}${botonUnirse(t)}
          ${puede.pasarLista(t.id) && t.activo ? `<button type="button" class="btn btn-sec btn-peq" data-ir-taller="${t.id}">Pasar lista</button>
          <button type="button" class="btn btn-sec btn-peq" data-ver-mes="${t.id}">Ver mes</button>` : ''}
          ${puede.admin() ? `<button type="button" class="btn btn-sec btn-peq" data-editar-taller="${t.id}">Editar</button>` : ''}
        </div>
      </article>`;
    }).join('')}</div></section>`).join('')}${sinResultados('Ningún taller coincide con la búsqueda.')}</div>` : `<div class="vacio-grande">${puede.verTodo() ? (temporada === 'verano' ? 'Aún no hay talleres de verano.' + (puede.admin() ? ' Crea el primero con «Nuevo taller de verano».' : '') : online ? 'Aún no hay talleres online.' + (puede.admin() ? ' Crea el primero con «Nuevo taller online».' : '') : 'Aún no hay talleres semestrales.') : `No tienes ${txt.titulo.toLowerCase()} asignados.`}</div>`}`;
}

/* ---------- Administración ---------- */
function vistaAdministracion(el) {
  if (!puede.admin()) { location.hash = 'panel'; return; }
  const tabs = { usuarios: 'Cuentas del equipo', auditoria: 'Auditoría', datos: 'Exportar datos' };
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">Solo dirección</p><h1>Administración</h1></div>
      <div class="pestanas" role="tablist" aria-label="Secciones de administración">
        ${Object.entries(tabs).map(([k, v]) => `<button type="button" role="tab" data-tab-admin="${k}" aria-pressed="${ui.tabAdmin === k}" aria-selected="${ui.tabAdmin === k}">${v}</button>`).join('')}
      </div>
    </header>
    <div id="admin-cuerpo" class="pila"></div>`;
  const c = $('#admin-cuerpo', el);
  if (ui.tabAdmin === 'usuarios') adminUsuarios(c);
  if (ui.tabAdmin === 'auditoria') adminAuditoria(c);
  if (ui.tabAdmin === 'datos') adminDatos(c);
}

function adminUsuarios(el) {
  const pendientes = S.usuarios.filter(u => !u.rol || !u.activo);
  const activos = S.usuarios.filter(u => u.rol && u.activo);
  const fila = u => `
    <li class="fila-click" data-usuario="${u.id}" ${qAttr(u.nombre, u.email, u.rol && u.activo ? ROLES[u.rol] : 'sin acceso', u.talleres.map(id => taller(id)?.nombre))}>
      <span class="avatar" style="--h:${tono(u.id)}" aria-hidden="true">${esc(iniciales(u.nombre || u.email))}</span>
      <div class="txt"><b>${esc(u.nombre || u.email)}${u.id === S.perfil.id ? ' <span class="muted">(tú)</span>' : ''}</b><small>${esc(u.email)}${u.rol === 'tallerista' ? ' · ' + (u.talleres.map(id => esc(taller(id)?.nombre || '')).join(', ') || 'sin talleres') : ''}</small></div>
      ${u.rol && u.activo ? `<span class="chip chip-rol-${u.rol}">${ROLES[u.rol]}</span>` : '<span class="chip chip-warn">Sin acceso</span>'}
    </li>`;
  el.innerHTML = `
    <section class="tarjeta">
      <h2><span>Cuentas del equipo</span><button type="button" class="btn btn-peq" data-accion="invitar">+ Invitar persona</button></h2>
      <p class="nota-suave">Cada persona recibe un correo para crear su contraseña. Los talleristas solo ven a quienes están inscritos en sus talleres y pasan lista en ellos. Las terapeutas ven todo el alumnado y sus datos de salud. El rol Equipo ve cumpleaños y talleres, sin fichas ni asistencia.</p>
      ${S.usuarios.length > 4 ? buscador('usuarios', 'Buscar por nombre, correo, rol o taller') : ''}
      <div data-filtrable="usuarios">
        ${pendientes.length ? `<div data-grupo><h3 class="sub">Esperando acceso</h3><ul class="lista">${pendientes.map(fila).join('')}</ul></div>` : ''}
        <div data-grupo><h3 class="sub">Con acceso</h3>
        <ul class="lista">${activos.map(fila).join('')}</ul></div>
        ${sinResultados('Ninguna cuenta coincide con la búsqueda.')}
      </div>
    </section>`;
}

/* ---------- Tienda ---------- */
const CATEGORIAS = { ropa: 'Ropa', accesorios: 'Accesorios', papeleria: 'Papelería' };
const pesos = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('es-CL');
const productosOrdenados = () => [...S.tienda.productos].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre, 'es'));
const producto = id => S.tienda?.productos.find(p => p.id === id);
// La tienda vive en spectrumpro.cl/tienda: las fotos de muestra (/tienda/img/…) están allá.
const TIENDA_URL = 'https://spectrumpro.cl/tienda';
const fotoTienda = u => /^\/?tienda\//.test(u || '') ? 'https://spectrumpro.cl/' + u.replace(/^\//, '') : (u || '');

async function vistaTienda(el) {
  if (!puede.tienda()) { location.hash = 'panel'; return; }
  const cab = `
    <header class="cabecera">
      <div><p class="eyebrow">Dirección y equipo</p><h1>Tienda</h1><p>Lo que guardes aquí aparece al instante en la tienda pública.</p></div>
      <div class="controles">
        <a class="btn btn-sec" href="${TIENDA_URL}" target="_blank" rel="noopener">Ver la tienda ↗</a>
        ${S.tienda ? '<button type="button" class="btn" data-accion="nuevo-producto">+ Nuevo producto</button>' : ''}
      </div>
    </header>`;
  if (!S.tienda) {
    el.innerHTML = cab + `<section class="tarjeta" aria-busy="true">
      <h2><span>Productos</span></h2>
      <p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Cargando la tienda…</p>
      <ul class="lista" aria-hidden="true">${Array.from({ length: 4 }, () => `<li><span class="esqueleto esqueleto-mini"></span><div class="txt">${esqueletoLineas(2)}</div></li>`).join('')}</ul>
    </section>`;
    try { S.tienda = await D.tienda(); }
    catch (e) {
      if (vistaActual() !== 'tienda') return;
      el.innerHTML = cab + `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`;
      return;
    }
    if (vistaActual() === 'tienda') render();
    return;
  }
  const lista = productosOrdenados();
  const a = S.tienda.ajustes;
  const visibles = lista.filter(p => p.visible).length;
  el.innerHTML = cab + `
    <section class="tarjeta">
      <h2><span>Productos</span><small>${visibles} de ${lista.length} visibles</small></h2>
      <p class="nota-suave">Toca un producto para editarlo. Con las flechas cambias el orden en que aparecen.</p>
      ${lista.length > 5 ? buscador('productos', 'Buscar producto, categoría o variante') : ''}
      ${lista.length ? `<div data-filtrable="productos"><ul class="lista productos">${lista.map((p, i) => `
        <li class="fila-click ${p.visible ? '' : 'oculto'}" data-producto="${p.id}" ${qAttr(p.nombre, CATEGORIAS[p.categoria], p.variantes, p.visible ? '' : 'oculto', p.agotado ? 'agotado' : '', p.precio == null ? 'sin precio' : '')}>
          ${p.imagen ? `<img class="miniatura" src="${esc(fotoTienda(p.imagen))}" alt="" loading="lazy">` : '<span class="miniatura vacia">Sin foto</span>'}
          <div class="txt"><b>${esc(p.nombre)}</b><small>${esc(CATEGORIAS[p.categoria] || '')}${p.precio != null ? ' · ' + esc(pesos(p.precio)) : ''}${p.variantes ? ' · ' + esc(p.variantes) : ''}</small></div>
          <span class="chips">${p.visible ? '' : '<span class="chip chip-neutro">Oculto</span>'}${p.agotado ? '<span class="chip chip-warn">Agotado</span>' : ''}${p.precio == null ? '<span class="chip chip-info">Sin precio</span>' : ''}</span>
          <span class="mover">
            <button type="button" data-mover-producto="${p.id}" data-dir="-1" aria-label="Subir ${esc(p.nombre)}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-mover-producto="${p.id}" data-dir="1" aria-label="Bajar ${esc(p.nombre)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
        </li>`).join('')}</ul>${sinResultados('Ningún producto coincide con la búsqueda.')}</div>` : '<p class="vacio">Aún no hay productos. Crea el primero con «Nuevo producto».</p>'}
    </section>
    <section class="tarjeta">
      <h2><span>Contacto y compra</span></h2>
      <form id="form-tienda" class="form-tienda" novalidate>
        <div class="campos">
          <label>WhatsApp para pedidos * <small class="muted">· solo números, con 56</small><input id="ti-whatsapp" name="whatsapp" type="tel" inputmode="numeric" value="${esc(a.whatsapp)}" placeholder="56912345678" autocomplete="off"></label>
          <label>Instagram <small class="muted">· usuario, sin @</small><input id="ti-instagram" name="instagram" value="${esc(a.instagram)}" placeholder="spectrumpro" autocomplete="off"></label>
          <label class="ancho">Forma de pago<input id="ti-pago" name="pago" maxlength="200" value="${esc(a.pago)}" placeholder="Ej: Transferencia bancaria o efectivo al retirar" autocomplete="off"></label>
          <label class="ancho">Entrega<input id="ti-entrega" name="entrega" maxlength="200" value="${esc(a.entrega)}" placeholder="Ej: Retiro en la sede de Providencia o envío por pagar" autocomplete="off"></label>
        </div>
        <p id="tienda-error" class="aviso-error" role="alert" hidden></p>
        <div class="dlg-pie"><button type="submit" class="btn">Guardar contacto y compra</button></div>
      </form>
    </section>`;
}

// Reduce la foto a máx. 1000 px y la pasa a JPEG con fondo blanco (las PNG transparentes quedan bien).
function reducirFoto(archivo, max = 1000) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d');
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la foto.')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('No se pudo leer la foto. Prueba con un JPG o PNG.')); };
    img.src = url;
  });
}

let editandoProducto = null, fotoNueva = null;
function verFotoProducto(src) {
  const img = $('#p-foto-vista');
  img.hidden = !src; $('#p-foto-vacia').hidden = !!src;
  if (src) img.src = fotoTienda(src); else img.removeAttribute('src');
}
function abrirProducto(id = null) {
  editandoProducto = id; fotoNueva = null;
  const p = id ? producto(id) : null;
  $('#form-producto').reset();
  $('#producto-error').hidden = true;
  $('#producto-titulo').textContent = p ? `Editar ${p.nombre}` : 'Nuevo producto';
  $('#p-nombre').value = p?.nombre || '';
  $('#p-categoria').value = p?.categoria || 'ropa';
  $('#p-precio').value = p?.precio ?? '';
  $('#p-variantes').value = p?.variantes || '';
  $('#p-descripcion').value = p?.descripcion || '';
  $('#p-visible').checked = p ? p.visible : true;
  $('#p-agotado').checked = !!p?.agotado;
  $('#p-eliminar').hidden = !p;
  verFotoProducto(p?.imagen || '');
  $('#dlg-producto').showModal();
  $('#p-nombre').focus();
}
$('#p-foto').addEventListener('change', async ev => {
  const f = ev.target.files[0];
  if (!f) return;
  const err = $('#producto-error'); err.hidden = true;
  try {
    fotoNueva = await reducirFoto(f);
    verFotoProducto(URL.createObjectURL(fotoNueva));
  } catch (e) { fotoNueva = null; err.textContent = e.message; err.hidden = false; }
});
$('#form-producto').addEventListener('submit', async ev => {
  ev.preventDefault();
  const previo = editandoProducto ? producto(editandoProducto) : null;
  const precioTxt = $('#p-precio').value.trim();
  const p = {
    id: editandoProducto || undefined,
    nombre: $('#p-nombre').value.trim(), categoria: $('#p-categoria').value,
    precio: precioTxt === '' ? null : Math.round(Number(precioTxt)),
    variantes: $('#p-variantes').value.trim(), descripcion: $('#p-descripcion').value.trim(),
    visible: $('#p-visible').checked, agotado: $('#p-agotado').checked,
    imagen: previo?.imagen || '',
    orden: previo ? previo.orden : Math.max(0, ...S.tienda.productos.map(x => x.orden || 0)) + 1,
  };
  const err = $('#producto-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (!p.nombre) return mostrar('Escribe el nombre del producto.');
  if (p.precio != null && (!Number.isFinite(p.precio) || p.precio < 0 || p.precio > 10000000)) return mostrar('Revisa el precio: escribe solo el número, sin puntos ni signo $.');
  const btn = ev.submitter;
  botonOcupado(btn, true, fotoNueva ? 'Subiendo foto…' : 'Guardando…');
  try {
    await conCarga(async () => {
      if (fotoNueva) p.imagen = await D.subirFotoProducto(fotoNueva);
      await D.guardarProducto(p);
      if (fotoNueva && previo?.imagen && previo.imagen !== p.imagen) await D.borrarFotoProducto(previo.imagen).catch(() => { });
    });
    S.tienda = await D.tienda();
    $('#dlg-producto').close();
    toast(previo ? 'Producto actualizado' : 'Producto creado');
    render();
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});
$('#p-eliminar').addEventListener('click', async () => {
  const p = producto(editandoProducto);
  $('#dlg-producto').close();
  if (!await confirmar(`¿Eliminar ${p.nombre}?`, 'Desaparece de la tienda y no se puede deshacer. Si solo no hay stock, mejor márcalo como «Agotado» o desmarca «Mostrar en la tienda».', 'Eliminar producto')) return;
  try {
    await intentar(() => D.eliminarProducto(p.id), 'Producto eliminado');
    D.borrarFotoProducto(p.imagen).catch(() => { });
    S.tienda.productos = S.tienda.productos.filter(x => x.id !== p.id);
    render();
  } catch { /* ya avisado */ }
});
async function moverProducto(id, dir) {
  const lista = productosOrdenados();
  const i = lista.findIndex(p => p.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  lista.forEach((p, k) => { p.orden = k + 1; });
  render();
  try { await D.ordenarProductos(lista.map(p => p.id)); }
  catch (e) { toast(e.message, 'error'); S.tienda = await D.tienda().catch(() => S.tienda); render(); }
}
document.addEventListener('submit', async ev => {
  if (ev.target.id !== 'form-tienda') return;
  ev.preventDefault();
  const a = {
    whatsapp: $('#ti-whatsapp').value.replace(/\D/g, ''),
    instagram: $('#ti-instagram').value.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/.*$/, ''),
    pago: $('#ti-pago').value.trim(), entrega: $('#ti-entrega').value.trim(),
  };
  const err = $('#tienda-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  err.hidden = true;
  if (!/^[0-9]{8,15}$/.test(a.whatsapp)) return mostrar('Escribe el WhatsApp con código de país y solo números, por ejemplo 56912345678.');
  if (a.whatsapp.length === 9 && a.whatsapp.startsWith('9')) return mostrar('Agrega el código de Chile al comienzo: 56' + a.whatsapp + '.');
  if (!/^[A-Za-z0-9._]{0,30}$/.test(a.instagram)) return mostrar('El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await conCarga(() => D.guardarAjustesTienda(a));
    S.tienda.ajustes = { ...S.tienda.ajustes, ...a };
    toast('Contacto y compra guardados');
    render();
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});

const ACCIONES = { insert: 'creó', update: 'editó', delete: 'eliminó', upsert: 'registró', login: 'entró' };
const TABLAS = { alumnos: 'ficha', alumnos_privado: 'datos privados de una ficha', inscripciones: 'inscripción', talleres: 'taller', taller_equipo: 'equipo de un taller', perfiles: 'cuenta', asistencia: 'asistencia', sesion: 'a la plataforma', tienda_productos: 'producto de la tienda', tienda_ajustes: 'contacto de la tienda', sitio_textos: 'texto del sitio web', sitio_elementos: 'elemento del sitio web', boletines: 'boletín de la comunidad' };
function detalleAuditoria(r) {
  const d = r.detalle || {};
  const partes = [];
  if (d.alumno) partes.push(d.alumno);
  if (d.taller) partes.push(d.taller);
  if (d.producto) partes.push(d.producto);
  if (d.elemento) partes.push(d.elemento);
  if (d.email) partes.push(d.email);
  if (d.fecha) partes.push(`${fechaCorta(d.fecha)} · ${d.estado}${d.registros > 1 ? ` · ${d.registros} jóvenes` : ''}`);
  if (d.rol && r.tabla !== 'sesion') partes.push(ROLES[d.rol] || d.rol);
  if (d.rol && r.tabla === 'sesion') partes.push(`como ${ROLES[d.rol]}`);
  if (d.campos) partes.push(`cambió: ${d.campos.join(', ')}`);
  if (d.nota) partes.push(d.nota);
  return partes.join(' · ');
}
async function adminAuditoria(el) {
  el.innerHTML = `<section class="tarjeta" aria-busy="true">
      <h2><span>Últimos 200 cambios</span></h2>
      <p class="nota-suave"><span class="giro giro-peq" aria-hidden="true"></span> Cargando auditoría…</p>
      ${esqueletoTabla(8, 4)}
    </section>`;
  try { S.auditoria = await D.auditoria(200); }
  catch (e) { el.innerHTML = `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`; return; }
  if (ui.tabAdmin !== 'auditoria') return;
  el.innerHTML = `
    <section class="tarjeta">
      <h2><span>Últimos 200 cambios</span><button type="button" class="btn btn-sec btn-peq" data-tab-admin="auditoria">Actualizar</button></h2>
      <p class="nota-suave">La base de datos registra cada cambio automáticamente. Nadie puede editar ni borrar este historial desde la plataforma.</p>
      ${S.auditoria.length ? `${buscador('auditoria', 'Buscar por persona, acción, joven, taller o fecha')}
      <div data-filtrable="auditoria"><div class="tabla-scroll"><table class="tabla">
        <thead><tr><th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Qué</th><th scope="col">Detalle</th></tr></thead>
        <tbody>${S.auditoria.map(r => `<tr ${qAttr(fechaHora(r.creado), r.actor_nombre, ACCIONES[r.accion] || r.accion, TABLAS[r.tabla] || r.tabla, detalleAuditoria(r))}><td class="num nowrap">${esc(fechaHora(r.creado))}</td><td>${esc(r.actor_nombre)}</td><td>${esc(ACCIONES[r.accion] || r.accion)} ${esc(TABLAS[r.tabla] || r.tabla)}</td><td class="muted">${esc(detalleAuditoria(r))}</td></tr>`).join('')}</tbody>
      </table></div>${sinResultados('Ningún cambio coincide con la búsqueda.')}</div>` : '<p class="vacio">Aún no hay cambios registrados.</p>'}
    </section>`;
  aplicarBusqueda('auditoria', el);
}

function adminDatos(el) {
  el.innerHTML = `
    <div class="rejilla">
      <section class="tarjeta pila">
        <h2>Fichas del alumnado</h2>
        <p class="nota-suave">Planilla CSV con todas las fichas (sin datos privados de salud). Se abre en Excel o Google Sheets.</p>
        <div><button type="button" class="btn btn-sec" data-accion="exportar-fichas">Descargar fichas (CSV)</button></div>
      </section>
      <section class="tarjeta pila">
        <h2>Asistencia</h2>
        <p class="nota-suave">Un registro por joven, taller y sesión, útil para reportes de becas y colaboradores.</p>
        <div class="controles">
          <label class="campo-inline" for="exp-desde">Desde<input type="date" id="exp-desde" value="${ui.expDesde}"></label>
          <label class="campo-inline" for="exp-hasta">Hasta<input type="date" id="exp-hasta" value="${ui.expHasta}"></label>
        </div>
        <div><button type="button" class="btn btn-sec" data-accion="exportar-asistencia">Descargar asistencia (CSV)</button></div>
      </section>
      ${D.modo === 'demo' ? `<section class="tarjeta pila">
        <h2>Datos de demostración</h2>
        <p class="nota-suave">Vuelve a cargar los datos ficticios iniciales en este navegador.</p>
        <div><button type="button" class="btn btn-sec" data-accion="restablecer-demo">Restablecer demostración</button></div>
      </section>` : ''}
    </div>`;
}

/* ---------- ficha ---------- */
async function abrirFicha(id) {
  const a = alumno(id); if (!a) return;
  const dlg = $('#dlg-ficha');
  const pc = proximoCumple(a.fechaNac);
  const total = resumen(registros({ alumno: id }));
  const r30 = resumen(registros({ alumno: id, desde: hace30() }));
  const ultimos = registros({ alumno: id }).sort((x, y) => x.fecha < y.fecha ? 1 : -1).slice(0, 16).reverse();
  const toCorto = programasDe(a).includes('Terapia Ocupacional') && a.talleres.length < 3;
  const fila = (k, v) => `<dt>${k}</dt><dd>${v || '<span class="muted">—</span>'}</dd>`;
  const copiable = v => v ? `<span class="copiable"><span>${esc(v)}</span><button type="button" class="copiar" data-copiar="${esc(v)}">Copiar</button></span>` : '';

  dlg.innerHTML = `
    <div class="ficha-cab">
      ${avatar(a, 'avatar-xl')}
      <div class="txt">
        <h2 id="ficha-titulo">${esc(nombreCompleto(a))}</h2>
        <div class="controles" style="gap:6px">
          <span class="chip chip-neutro">${edad(a.fechaNac)} años</span>
          ${programasDe(a).map(p => `<span class="chip chip-neutro">${esc(p)}</span>`).join('')}
          ${a.estado !== 'activo' ? `<span class="chip chip-warn">${ESTADO_ALUMNO[a.estado]}</span>` : ''}
          ${a.beca ? `<span class="chip chip-info">${esc(a.beca)}</span>` : ''}
          ${chipPct(r30.pct)}
        </div>
      </div>
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button>
    </div>
    <div class="dlg-cuerpo sin-relleno">
      <div class="ficha-cuerpo">
        <section>
          <h3>Datos personales</h3>
          <dl class="dato">
            ${fila('Prefiere que le llamen', esc(a.apodo))}
            ${fila('Pronombres', esc(a.pronombres))}
            ${fila('Nacimiento', esc(fechaCorta(a.fechaNac)))}
            ${fila('Próximo cumpleaños', `${esc(fechaLarga(pc.fecha))} (${pc.dias === 0 ? '¡hoy!' : 'en ' + pc.dias + ' días'})`)}
            ${fila('RUT', esc(a.rut))}
            ${fila('Comuna / dirección', esc(a.direccion))}
          </dl>
        </section>
        <section>
          <h3>Familia y contacto</h3>
          <dl class="dato">
            ${fila('Responsable', a.tutorNombre ? `${esc(a.tutorNombre)}${a.tutorRelacion ? ' · ' + esc(a.tutorRelacion) : ''}` : '')}
            ${fila('Teléfono', copiable(a.tutorTelefono))}
            ${fila('Correo', copiable(a.tutorEmail))}
            ${CONTACTOS_EMERG.filter(k => k === 'emergencia' || a[k]).map((k, n) => { const c = leerEmergencia(a[k]); const quien = c.nombre ? esc(c.nombre) + (c.parentesco ? ` · ${esc(c.parentesco)}` : '') : esc(c.parentesco); return fila(a.emergencia2 ? `Emergencia ${n + 1}` : 'Emergencia', [quien, copiable(c.telefono)].filter(Boolean).join('<br>')); }).join('')}
          </dl>
        </section>
        <section>
          <h3>Programa</h3>
          <dl class="dato">
            ${fila(programasDe(a).length > 1 ? 'Programas' : 'Programa', esc(programasDe(a).join(', ')))}
            ${fila('Estado', ESTADO_ALUMNO[a.estado])}
            ${fila('Ingreso', esc(fechaCorta(a.fechaIngreso)))}
            ${fila('Entrevista', esc(fechaCorta(a.entrevista)))}
            ${fila('Beca', esc(a.beca))}
          </dl>
          <div class="talleres-mini">${a.talleres.map(tid => { const t = taller(tid); return t ? `<span class="tag">${punto(t)}${esc(t.nombre)}${(() => { const c = t.fechas.length ? sesionesTxt(t.fechas.length) : t.dias.map(d => DIAS_CORTOS[d]).join('/'); return c ? ' · ' + c : ''; })()}</span>` : ''; }).join('')}</div>
          ${toCorto ? `<p class="nota-campo">Terapia Ocupacional pide al menos 3 módulos. Tiene ${a.talleres.length}.</p>` : ''}
        </section>
        <section>
          <h3>Perfil y apoyos</h3>
          <dl class="dato">
            ${fila('Alergias', a.alergias ? `<span class="chip chip-bad">${esc(a.alergias)}</span>` : '')}
            ${fila('Intereses', esc(a.intereses))}
            ${fila('Apoyos que le sirven', esc(a.apoyos))}
          </dl>
        </section>
        ${puede.verTodo() ? `<section class="ancho privado">
          <h3>Datos privados <small>· solo dirección y terapeutas</small></h3>
          <dl class="dato" id="ficha-privado" aria-busy="true"><dt>Medicación</dt><dd><span class="esqueleto" style="width:60%"></span></dd><dt>Observaciones</dt><dd>${esqueletoLineas(2)}</dd></dl>
        </section>` : ''}
        <section class="ancho">
          <h3>Asistencia</h3>
          <div class="leyenda">${Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${total[k]} ${v.label.toLowerCase()}</span>`).join('')}<span class="chip chip-neutro">${total.total} sesiones · ${total.pct ?? '—'}% total</span></div>
          ${ultimos.length ? `<p class="muted pequeno">Últimas ${ultimos.length} sesiones, de la más antigua a la más reciente:</p>
          <div class="historial">${ultimos.map(r => `<span class="${ESTADOS[r.e].chip}" title="${esc(fechaCorta(r.fecha))} · ${esc(taller(r.taller)?.nombre || '')} · ${ESTADOS[r.e].label}">${r.e}</span>`).join('')}</div>` : '<p class="vacio">Aún no hay asistencia registrada.</p>'}
        </section>
      </div>
    </div>
    ${puede.editarFichas() ? `<div class="dlg-pie" id="ficha-pie">
      ${puede.eliminarFichas() ? `<button type="button" class="btn btn-sec" data-eliminar="${a.id}">Eliminar ficha</button>` : ''}
      <button type="button" class="btn" data-editar="${a.id}">Editar ficha</button>
    </div>` : ''}`;
  dlg.showModal();
  dlg.scrollTop = 0;

  if (puede.verTodo()) {
    try {
      const p = await D.privado(id);
      const box = $('#ficha-privado');
      if (box) { box.innerHTML = fila('Medicación', esc(p.medicacion)) + fila('Observaciones', esc(p.observaciones)); box.removeAttribute('aria-busy'); }
    } catch (e) { const box = $('#ficha-privado'); if (box) { box.innerHTML = `<dt>Error</dt><dd>${esc(e.message)}</dd>`; box.removeAttribute('aria-busy'); } }
  }
}

/* ---------- formulario de ficha ---------- */
let editando = null;
let privadoCargado = false;   // evita borrar medicación y observaciones si se guarda antes de que lleguen
// Un alumno puede estar en varios programas: se guardan en el mismo campo de texto separados por coma.
function programasDe(a) { return String(a?.programa || '').split(',').map(p => p.trim()).filter(Boolean); }
const CAMPOS_FICHA = ['nombre', 'apellidos', 'apodo', 'pronombres', 'fechaNac', 'rut', 'estado', 'fechaIngreso', 'entrevista', 'beca', 'tutorNombre', 'tutorRelacion', 'tutorTelefono', 'tutorEmail', 'emergencia', 'emergencia2', 'direccion', 'intereses', 'apoyos', 'alergias'];
async function abrirFormulario(id = null) {
  editando = id;
  const a = id ? alumno(id) : null;
  const form = $('#form-alumno');
  form.reset();
  $('#form-titulo').textContent = a ? `Editar ficha de ${nombreVisible(a)}` : 'Nueva ficha';
  $('#form-error').hidden = true;
  $('#f-talleres').innerHTML = S.talleres.filter(t => t.activo || a?.talleres.includes(t.id)).map(t => `<label><input type="checkbox" name="talleres" value="${t.id}" ${a?.talleres.includes(t.id) ? 'checked' : ''}>${punto(t)}${esc(t.nombre)}</label>`).join('') || '<p class="vacio">Primero crea un taller en Talleres semestrales o Talleres de verano.</p>';
  filtroChecks($('#f-talleres'), 'f-talleres', 'Buscar taller');
  for (const c of CAMPOS_FICHA) { const inp = $('#f-' + c); if (inp) inp.value = a ? (a[c] ?? '') : ''; }
  $('#f-rut').value = formatearRut($('#f-rut').value);
  $('#f-tutorTelefono').value = formatearTel($('#f-tutorTelefono').value);
  for (const k of CONTACTOS_EMERG) {
    const c = leerEmergencia(a?.[k]);
    $(`#f-${k}-nombre`).value = c.nombre;
    $(`#f-${k}-parentesco`).value = c.parentesco;
    $(`#f-${k}-telefono`).value = c.telefono ? formatearTel(c.telefono) : '';
  }
  const progs = a ? programasDe(a) : ['FormaPro'];
  for (const c of $$('#f-programas input')) c.checked = progs.includes(c.value);
  if (!a) { $('#f-estado').value = 'activo'; $('#f-fechaIngreso').value = iso(hoy()); }
  $('#f-medicacion').value = ''; $('#f-observaciones').value = '';
  $('#f-privado').hidden = !puede.verTodo();
  privadoCargado = !a;
  const camposPrivados = [$('#f-medicacion'), $('#f-observaciones')];
  const esperandoPrivado = !!a && puede.verTodo();
  camposPrivados.forEach(c => { c.disabled = esperandoPrivado; c.placeholder = esperandoPrivado ? 'Cargando…' : ''; });
  $('#f-privado').classList.toggle('cargando-campos', esperandoPrivado);
  $('#f-fechaNac').max = iso(hoy());
  mostrarEdad();
  avisoTO();
  if ($('#dlg-ficha').open) $('#dlg-ficha').close();
  $('#dlg-form').showModal();
  $('#f-nombre').focus();
  if (esperandoPrivado) {
    try {
      const p = await D.privado(a.id);
      if (editando !== a.id) return;
      $('#f-medicacion').value = p.medicacion; $('#f-observaciones').value = p.observaciones;
      privadoCargado = true;
      camposPrivados.forEach(c => { c.disabled = false; c.placeholder = ''; });
    } catch (e) {
      toast(`No se cargaron los datos privados; no se modificarán al guardar. ${e.message}`, 'error');
      camposPrivados.forEach(c => { c.placeholder = 'No se pudieron cargar'; });
    } finally { if (editando === a.id) $('#f-privado').classList.remove('cargando-campos'); }
  }
}
// Edad al momento, mientras se escribe la fecha de nacimiento.
function mostrarEdad() {
  const v = $('#f-fechaNac').value, out = $('#f-edad');
  out.classList.remove('error');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v < '1900-01-02') { out.textContent = ''; return; }
  if (v > iso(hoy())) { out.textContent = 'La fecha no puede ser futura'; out.classList.add('error'); return; }
  const n = edad(v);
  out.textContent = n === 1 ? '1 año' : `${n} años`;
}
/* ---------- RUT: formato 12.345.678-9 mientras se escribe y validación del dígito verificador ---------- */
function limpiarRut(v) {
  const c = String(v || '').toUpperCase().replace(/[^0-9K]/g, '');
  // La K solo puede ser el dígito verificador (último carácter).
  return c.slice(0, -1).replace(/K/g, '') + c.slice(-1);
}
function formatearRut(v) {
  const c = limpiarRut(v).slice(0, 9);
  if (c.length < 2) return c;
  const cuerpo = c.slice(0, -1).replace(/^0+(?=\d)/, '');
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${c.slice(-1)}`;
}
function rutValido(v) {
  const c = limpiarRut(v);
  if (!/^\d{7,8}[0-9K]$/.test(c)) return false;
  let suma = 0, mult = 2;
  for (let i = c.length - 2; i >= 0; i--) { suma += Number(c[i]) * mult; mult = mult === 7 ? 2 : mult + 1; }
  const r = 11 - (suma % 11);
  return c.slice(-1) === (r === 11 ? '0' : r === 10 ? 'K' : String(r));
}
$('#f-rut').addEventListener('input', ev => {
  const inp = ev.target;
  // Conserva la posición del cursor contando los caracteres útiles a su izquierda.
  const utiles = limpiarRut(inp.value.slice(0, inp.selectionStart)).length;
  inp.value = formatearRut(inp.value);
  let pos = 0, vistos = 0;
  while (pos < inp.value.length && vistos < utiles) { if (/[0-9K]/.test(inp.value[pos])) vistos++; pos++; }
  inp.setSelectionRange(pos, pos);
});
/* ---------- Teléfono chileno: formato +56 9 1234 5678 mientras se escribe ---------- */
// Un número con otro código de país (empieza con + pero no con +56) se deja tal cual.
const prefijoTel = t => /^\+\s*5\s*6/.test(t);          // ya trae +56
const prefijoParcial = t => /^\+\s*5?\s*$/.test(t);      // «+» o «+5»: aún escribiendo el +56
function esTelExtranjero(v) { const t = String(v || '').trim(); return t.startsWith('+') && !prefijoTel(t) && !prefijoParcial(t); }
function digitosTel(v) {
  const t = String(v || '').trim();
  let d = (prefijoTel(t) ? t.replace(/^\+\s*5\s*6/, '') : t).replace(/\D/g, '').replace(/^0+/, '');
  if (d.length > 9 && d.startsWith('56')) d = d.slice(2);
  return d.slice(0, 9);
}
function formatearTel(v) {
  const t = String(v || '').trim();
  if (esTelExtranjero(t) || prefijoParcial(t)) return String(v || '');
  const d = digitosTel(t);
  return ['+56', d.slice(0, 1), d.slice(1, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}
const telValido = v => !v || esTelExtranjero(v) || digitosTel(v).length === 9;
/* ---------- Contactos de emergencia ----------
   Se guardan en la misma columna de texto como «Nombre · Parentesco · Teléfono».
   Las fichas antiguas escritas en texto libre se separan lo mejor posible: el teléfono se detecta solo. */
const SEP_EMERG = ' · ';
function leerEmergencia(v) {
  const t = String(v || '').trim();
  if (!t) return { nombre: '', parentesco: '', telefono: '' };
  const partes = t.split(/\s*·\s*/);
  if (partes.length >= 3) return { nombre: partes[0], parentesco: partes[1], telefono: partes.slice(2).join(' ') };
  const m = t.match(/\+?\(?\d[\d\s().-]{6,}\d/);
  const telefono = m ? m[0].trim() : '';
  let resto = (m ? t.replace(m[0], '') : t).replace(/\s*·\s*$|^\s*·\s*/g, '').replace(/[\s,;:-]+$/, '').trim();
  let parentesco = '';
  const par = resto.match(/^(.*?)\s*\(([^)]+)\)\s*$/) || (partes.length === 2 && !m ? [null, partes[0], partes[1]] : null);
  if (par) { resto = par[1].trim(); parentesco = par[2].trim(); }
  else if (/,/.test(resto)) { const i = resto.lastIndexOf(','); parentesco = resto.slice(i + 1).trim(); resto = resto.slice(0, i).trim(); }
  return { nombre: resto, parentesco, telefono };
}
const unirEmergencia = c => (c.nombre || c.parentesco || c.telefono) ? [c.nombre, c.parentesco, c.telefono].map(x => x.trim()).join(SEP_EMERG) : '';
const textoEmergencia = v => { const c = leerEmergencia(v); return [c.nombre && (c.parentesco ? `${c.nombre} (${c.parentesco})` : c.nombre) || c.parentesco, c.telefono].filter(Boolean).join(' · '); };
const CONTACTOS_EMERG = ['emergencia', 'emergencia2'];
document.addEventListener('input', ev => {
  const inp = ev.target;
  if (!inp.classList?.contains('tel-cl')) return;
  if (!inp.value.trim()) { inp.value = ''; return; }
  const alFinal = inp.selectionStart === inp.value.length;
  let utiles = digitosTel(inp.value.slice(0, inp.selectionStart)).length;
  inp.value = formatearTel(inp.value);
  if (alFinal || !inp.value.startsWith('+56')) return;
  // Devuelve el cursor detrás del mismo dígito en que estaba.
  let pos = 3;
  while (pos < inp.value.length && utiles > 0) { if (/\d/.test(inp.value[pos])) utiles--; pos++; }
  inp.setSelectionRange(pos, pos);
});
$('#f-fechaNac').addEventListener('input', mostrarEdad);
$('#f-fechaNac').addEventListener('change', mostrarEdad);
// Requisito publicado en spectrumpro.cl para FormaPro y Terapia Ocupacional:
// al menos 3 módulos, uno de ellos de formación general
// (Referentes artístico-culturales, Habilidades para la vida o Arte Terapéutico).
const esFormacionGeneral = t => t.area === 'Formación general' || /referentes|habilidades para la vida|arte terap/i.test(t.nombre);
function avisoTO() {
  const progs = $$('#f-programas input:checked').map(i => i.value).filter(p => ['FormaPro', 'Terapia Ocupacional'].includes(p));
  const prog = progs.join(' y ');
  const aviso = $('#f-aviso-to');
  const elegidos = $$('#f-talleres input:checked').map(i => taller(i.value)).filter(Boolean);
  const faltan = [];
  if (elegidos.length < 3) faltan.push('al menos 3 módulos');
  if (S.talleres.some(esFormacionGeneral) && !elegidos.some(esFormacionGeneral)) faltan.push('uno de formación general');
  aviso.hidden = !(progs.length && faltan.length);
  aviso.textContent = `${prog} pide ${faltan.join(' y ')} (Referentes culturales, Habilidades para la vida o Arte Terapia). También pide una entrevista previa.`;
}
$('#form-alumno').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const datos = {};
  for (const c of CAMPOS_FICHA) datos[c] = String(fd.get(c) ?? '').trim();
  datos.programa = fd.getAll('programa').join(', ');
  datos.talleres = fd.getAll('talleres');
  const faltan = [];
  if (!datos.nombre) faltan.push('nombre');
  if (!datos.apellidos) faltan.push('apellidos');
  if (!datos.fechaNac) faltan.push('fecha de nacimiento');
  if (!datos.programa) faltan.push('al menos un programa');
  if (!datos.talleres.length) faltan.push('al menos un taller');
  const err = $('#form-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (faltan.length) return mostrar(`Completa: ${faltan.join(', ')}.`);
  if (datos.fechaNac > iso(hoy())) return mostrar('La fecha de nacimiento no puede ser futura.');
  if (datos.rut) {
    datos.rut = formatearRut(datos.rut);
    if (!rutValido(datos.rut)) return mostrar('El RUT no es válido: revisa los números y el dígito verificador.');
  }
  for (const [n, k] of CONTACTOS_EMERG.entries()) {
    const c = { nombre: $(`#f-${k}-nombre`).value.replace(/·/g, '-'), parentesco: $(`#f-${k}-parentesco`).value.replace(/·/g, '-'), telefono: formatearTel($(`#f-${k}-telefono`).value).trim() };
    if (!telValido(c.telefono)) return mostrar(`El teléfono del contacto de emergencia ${n + 1} debe tener 9 dígitos (por ejemplo +56 9 1234 5678).`);
    if ((c.parentesco || c.telefono) && !c.nombre.trim()) return mostrar(`Falta el nombre del contacto de emergencia ${n + 1}.`);
    datos[k] = unirEmergencia(c);
  }
  if (datos.tutorTelefono) {
    datos.tutorTelefono = formatearTel(datos.tutorTelefono).trim();
    if (!telValido(datos.tutorTelefono)) return mostrar('El teléfono de la persona responsable debe tener 9 dígitos (por ejemplo +56 9 1234 5678).');
  }
  if (datos.tutorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.tutorEmail)) return mostrar('Revisa el correo de la persona responsable.');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    const id = await conCarga(async () => {
      const id = await D.guardarAlumno({ ...datos, id: editando });
      if (puede.verTodo() && privadoCargado) await D.guardarPrivado(id, { medicacion: fd.get('medicacion'), observaciones: fd.get('observaciones') });
      S.cumple = await D.cumpleanos();
      return id;
    });
    const fila = { ...datos, id };
    const i = S.alumnos.findIndex(x => x.id === id);
    if (i >= 0) S.alumnos[i] = fila; else S.alumnos.push(fila);
    $('#dlg-form').close();
    toast(editando ? 'Ficha actualizada' : 'Ficha creada');
    render();
    abrirFicha(id);
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});

/* ---------- programa del taller (PDF) ---------- */
async function verPrograma(id) {
  const t = taller(id);
  if (!t?.programaPdf) return;
  // La ventana se abre antes de pedir el enlace para que el navegador no la bloquee.
  const ventana = window.open('', '_blank');
  try {
    const url = await conCarga(() => D.urlPrograma(t), 'Abriendo programa…');
    if (ventana) ventana.location.href = url; else location.href = url;
  } catch (e) {
    ventana?.close();
    toast(e.message, 'error');
  }
}

/* ---------- detalle del taller: pestañas Información, Programa y Afiches ---------- */
let urlsAfiches = [];
const soltarUrlsAfiches = () => { urlsAfiches.forEach(u => u.startsWith('blob:') && URL.revokeObjectURL(u)); urlsAfiches = []; };
$('#dlg-taller-ver').addEventListener('close', soltarUrlsAfiches);
function abrirTallerVer(id, pestana = 'info') {
  const t = taller(id); if (!t) return;
  const dlg = $('#dlg-taller-ver');
  soltarUrlsAfiches();
  const fila = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  const pestanas = [['info', 'Información'], ['programa', 'Programa'], ['afiches', `Afiches${t.afiches.length ? ` <small>${t.afiches.length}</small>` : ''}`]];
  let cuerpo = '';
  if (pestana === 'info') {
    cuerpo = `<dl class="dato">
      ${fila('Área', esc(nombreArea(t.area)))}
      ${t.fechas.length ? fila('Fechas', `${esc(fechasTxt(t.fechas))} <span class="muted">(${sesionesTxt(t.fechas.length)})</span>`) : fila('Días', t.dias.length ? t.dias.map(d => DIAS[d]).join(', ') : '—')}
      ${fila('Horario', esc(horario(t)) + (t.nota ? `<br><span class="muted">${esc(t.nota)}</span>` : ''))}
      ${fila('Edad', esc(t.edad))}
      ${fila('A cargo', esc(t.encargado) || '—')}
      ${fila('Correo', t.encargadoEmail ? `<span class="enlace">${enlacesCorreo(t.encargadoEmail)}</span>` : '<span class="muted">Sin correo</span>')}
      ${esOnline(t) ? fila('Enlace', enlaceValido(t.enlace) ? `<a href="${esc(t.enlace)}" target="_blank" rel="noopener noreferrer">${esc(t.enlace.replace(/^https:\/\//i, ''))}</a>` : '<span class="muted">Sin enlace</span>') : ''}
    </dl>
    ${t.objetivo ? `<section><h3>Objetivo</h3><p class="texto-largo">${esc(t.objetivo)}</p></section>` : ''}`;
  } else if (pestana === 'programa') {
    cuerpo = `${t.programaTexto ? `<div class="texto-largo programa-escrito">${esc(t.programaTexto)}</div>` : `<p class="vacio">Este taller aún no tiene el programa escrito.${puede.admin() ? ' Agrégalo con «Editar taller».' : ''}</p>`}
      ${t.programaPdf ? `<p class="no-imprimir"><button type="button" class="btn btn-sec btn-peq" data-ver-programa="${t.id}">Abrir programa en PDF</button> <span class="muted">${esc(t.programaNombre)}</span></p>` : ''}`;
  } else {
    cuerpo = t.afiches.length
      ? `<div class="afiches">${t.afiches.map((a, i) => `<figure class="afiche">
          <button type="button" class="afiche-vista" data-afiche-abrir="${i}" aria-label="Abrir ${esc(a.nombre)}">${a.tipo === 'application/pdf' ? '<span class="afiche-pdf">PDF</span>' : `<span class="giro giro-peq" aria-hidden="true"></span><img alt="" data-afiche-img="${i}" hidden>`}</button>
          <figcaption><span title="${esc(a.nombre)}">${esc(a.nombre)}</span><button type="button" class="enlace-texto" data-afiche-bajar="${i}">Descargar</button></figcaption>
        </figure>`).join('')}</div>`
      : `<p class="vacio">Aún no hay afiches ni publicidad para este taller.${puede.admin() ? ' Súbelos con «Editar taller».' : ''}</p>`;
  }
  dlg.dataset.tallerId = t.id;
  dlg.innerHTML = `
    <div class="ficha-cab" style="border-top:5px solid ${color(t.color)}">
      <div class="txt">
        <p class="eyebrow">${esc(nombreArea(t.area))}</p>
        <h2 id="taller-ver-titulo">${esc(t.nombre)}</h2>
        <div class="pestanas no-imprimir" role="group" aria-label="Secciones del taller">${pestanas.map(([k, v]) => `<button type="button" data-pestana-taller="${k}" aria-pressed="${k === pestana}">${v}</button>`).join('')}</div>
      </div>
      <button type="button" class="cerrar no-imprimir" data-cerrar aria-label="Cerrar">×</button>
    </div>
    <div class="dlg-cuerpo">${cuerpo}</div>
    <footer class="dlg-pie no-imprimir">
      ${pestana === 'programa' && t.programaTexto ? '<button type="button" class="btn btn-sec" data-imprimir>Imprimir programa</button>' : ''}
      ${puede.admin() ? `<button type="button" class="btn btn-sec" data-editar-taller="${t.id}">Editar taller</button>` : ''}
      <button type="button" class="btn" data-cerrar>Cerrar</button>
    </footer>`;
  if (!dlg.open) dlg.showModal();
  if (pestana === 'afiches') cargarMiniaturas(t);
}
async function cargarMiniaturas(t) {
  for (const [i, a] of t.afiches.entries()) {
    if (a.tipo === 'application/pdf') continue;
    try {
      const url = await D.urlAfiche(a.ruta);
      urlsAfiches.push(url);
      const img = $(`#dlg-taller-ver [data-afiche-img="${i}"]`);
      if (!img || $('#dlg-taller-ver').dataset.tallerId !== t.id) { if (url.startsWith('blob:')) URL.revokeObjectURL(url); return; }
      img.onload = () => { img.hidden = false; img.previousElementSibling?.remove(); };
      img.src = url;
    } catch { $(`#dlg-taller-ver [data-afiche-img="${i}"]`)?.previousElementSibling?.remove(); }
  }
}
async function abrirAfiche(i, bajar) {
  const t = taller($('#dlg-taller-ver').dataset.tallerId);
  const a = t?.afiches[Number(i)]; if (!a) return;
  const ventana = bajar ? null : window.open('', '_blank');
  try {
    const url = await conCarga(() => D.urlAfiche(a.ruta, bajar), bajar ? 'Preparando descarga…' : 'Abriendo…');
    if (bajar) {
      const enlace = Object.assign(document.createElement('a'), { href: url, download: a.nombre, rel: 'noopener' });
      document.body.append(enlace); enlace.click(); enlace.remove();
      if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else if (ventana) ventana.location.href = url; else location.href = url;
  } catch (e) { ventana?.close(); toast(e.message, 'error'); }
}
// Imprime solo el diálogo abierto (el navegador ofrece «Guardar como PDF»).
function imprimirDialogo(dlg) {
  document.body.classList.add('imprimiendo-dialogo');
  dlg.classList.add('a-imprimir');
  const fin = () => { document.body.classList.remove('imprimiendo-dialogo'); dlg.classList.remove('a-imprimir'); };
  window.addEventListener('afterprint', fin, { once: true });
  window.print();
  setTimeout(() => { if (!matchMedia('print').matches) fin(); }, 1500);
}

/* ---------- horario imprimible ---------- */
const minutos = h => { const [a, b] = String(h || '').split(':').map(Number); return a * 60 + (b || 0); };
function abrirHorario(temporada) {
  ui.horarioTemporada = temporada;
  const dlg = $('#dlg-horario');
  const incluirInactivos = !!ui.horarioInactivos;
  const lista = talleresDeSeccion(temporada).filter(t => incluirInactivos || t.activo);
  const titulo = `Horario · ${TEMPORADAS[temporada].titulo}`;
  const celda = t => `<div class="h-taller" style="--c:${color(t.color)}"><b>${esc(t.nombre)}</b>${t.encargado ? `<small>${esc(t.encargado)}</small>` : ''}${esOnline(t) && temporada !== 'online' ? '<small>Online</small>' : ''}</div>`;
  const conHora = lista.filter(t => t.horaInicio), sinHora = lista.filter(t => !t.horaInicio);
  let tabla = '';
  if (temporada === 'verano') {
    const fechas = [...new Set(conHora.concat(sinHora).flatMap(t => t.fechas))].sort();
    tabla = fechas.length ? `<table class="horario horario-fechas">
      <thead><tr><th>Fecha</th><th>Horario</th><th>Taller</th></tr></thead>
      <tbody>${fechas.map(f => {
        const del = lista.filter(t => t.fechas.includes(f)).sort((a, b) => minutos(a.horaInicio || '99') - minutos(b.horaInicio || '99'));
        return del.map((t, k) => `<tr>${k === 0 ? `<th scope="row" rowspan="${del.length}">${esc(fechaLarga(deISO(f)))}</th>` : ''}<td class="num">${esc(horario(t))}</td><td>${celda(t)}</td></tr>`).join('');
      }).join('')}</tbody></table>` : '<p class="vacio">Los talleres de verano aún no tienen fechas.</p>';
  } else {
    // Columnas: lunes a sábado (y domingo si algún taller lo usa). Filas: cada tramo de horario distinto.
    const dias = [1, 2, 3, 4, 5, 6].concat(lista.some(t => t.dias.includes(0)) ? [0] : []);
    const tramos = [...new Set(conHora.map(t => `${t.horaInicio}|${t.horaFin || ''}`))].sort((a, b) => minutos(a.split('|')[0]) - minutos(b.split('|')[0]) || minutos(a.split('|')[1] || '99') - minutos(b.split('|')[1] || '99'));
    tabla = tramos.length ? `<table class="horario">
      <thead><tr><th>Horario</th>${dias.map(d => `<th>${DIAS[d]}</th>`).join('')}</tr></thead>
      <tbody>${tramos.map(tr => {
        const [ini, fin] = tr.split('|');
        return `<tr><th scope="row" class="num">${esc(ini)}${fin ? `<br>${esc(fin)}` : ''}</th>${dias.map(d => `<td>${conHora.filter(t => t.horaInicio === ini && (t.horaFin || '') === fin && t.dias.includes(d)).map(celda).join('')}</td>`).join('')}</tr>`;
      }).join('')}</tbody></table>` : '<p class="vacio">Ningún taller tiene horario todavía.</p>';
  }
  dlg.innerHTML = `
    <header class="dlg-cab">
      <div><h2 id="horario-titulo">${esc(titulo)}</h2><p class="muted solo-imprimir">SpectrumPro · actualizado el ${esc(fechaLarga(hoy()))}</p></div>
      <button type="button" class="cerrar no-imprimir" data-cerrar aria-label="Cerrar">×</button>
    </header>
    <div class="dlg-cuerpo">
      <p class="nota-suave no-imprimir">Se arma solo con los días y horas de cada taller: cuando cambias un horario en «Editar», este horario se actualiza. Para descargarlo, presiona «Imprimir o guardar PDF» y elige «Guardar como PDF».</p>
      ${puede.verTodo() && talleresDeSeccion(temporada).some(t => !t.activo) ? `<label class="check-suelto no-imprimir"><input type="checkbox" id="horario-inactivos" ${incluirInactivos ? 'checked' : ''}> Incluir talleres inactivos</label>` : ''}
      <div class="horario-caja">${tabla}</div>
      ${sinHora.length && temporada !== 'verano' ? `<section><h3>Sin horario definido</h3><p>${sinHora.map(t => esc(t.nombre)).join(' · ')}</p></section>` : ''}
    </div>
    <footer class="dlg-pie no-imprimir">
      <button type="button" class="btn btn-sec" data-accion="horario-csv">Descargar para Excel</button>
      <button type="button" class="btn btn-sec" data-cerrar>Cerrar</button>
      <button type="button" class="btn" data-imprimir>Imprimir o guardar PDF</button>
    </footer>`;
  if (!dlg.open) dlg.showModal();
}
function horarioCsv() {
  const temporada = ui.horarioTemporada;
  const lista = talleresDeSeccion(temporada).filter(t => ui.horarioInactivos || t.activo);
  const filas = [['Área', 'Taller', temporada === 'verano' ? 'Fechas' : 'Días', 'Inicio', 'Término', 'A cargo', 'Correo', 'Modalidad']]
    .concat(lista.map(t => [nombreArea(t.area), t.nombre, t.fechas.length ? t.fechas.join(' | ') : t.dias.map(d => DIAS[d]).join(', '), t.horaInicio, t.horaFin, t.encargado, t.encargadoEmail, esOnline(t) ? 'Online' : 'Presencial']));
  descargar(`spectrumpro-horario-${temporada}-${iso(hoy())}.csv`, csv(filas), 'text/csv;charset=utf-8');
}

/* ---------- orden de los talleres (flechas, dentro de cada área) ---------- */
async function moverTaller(id, dir, temporada) {
  const lista = talleresDeSeccion(temporada);
  const i = lista.findIndex(t => t.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length || nombreArea(lista[i].area) !== nombreArea(lista[j].area)) return;
  // Se intercambian en la lista completa y se renumera todo; solo se guardan los que cambian.
  const todos = SPTalleres.ordenarTalleres([...S.talleres]);
  const a = todos.indexOf(lista[i]), b = todos.indexOf(lista[j]);
  [todos[a], todos[b]] = [todos[b], todos[a]];
  const antes = new Map(S.talleres.map(t => [t.id, t.orden]));
  todos.forEach((t, k) => { t.orden = k + 1; });
  S.talleres = todos;
  render();
  const cambios = todos.filter(t => antes.get(t.id) !== t.orden).map(t => ({ id: t.id, orden: t.orden }));
  try { await D.ordenarTalleres(cambios); }
  catch (e) { toast(e.message, 'error'); try { S.talleres = await D.talleres(); } catch { /* sin conexión */ } render(); }
}

/* ---------- formulario de taller ---------- */
let editandoTaller = null;
let fechasTaller = [];
// Los talleres de verano se programan por fechas exactas; los semestrales, por días de la semana.
const mostrarCamposTemporada = () => {
  const verano = $('#t-temporada').value === 'verano';
  $('#t-fechas-box').hidden = !verano;
  $('#t-dias-box').hidden = verano;
};
function pintarFechasTaller() {
  fechasTaller.sort();
  $('#t-fechas').innerHTML = fechasTaller.length
    ? fechasTaller.map(f => { const d = deISO(f); return `<span class="tag">${DIAS_CORTOS[d.getDay()]} ${esc(fechaCorta(f))}<button type="button" data-quitar-fecha="${f}" aria-label="Quitar ${esc(fechaCorta(f))}">×</button></span>`; }).join('')
    : '<p class="nota-suave">Aún no hay fechas. Elige una y presiona «Agregar fecha».</p>';
}
$('#t-temporada').addEventListener('change', mostrarCamposTemporada);
const mostrarEnlace = () => { $('#t-enlace-box').hidden = $('#t-modalidad').value !== 'online'; };
$('#t-modalidad').addEventListener('change', mostrarEnlace);
$('#t-fecha-agregar').addEventListener('click', () => {
  const f = $('#t-fecha-nueva').value;
  if (!f) { $('#t-fecha-nueva').focus(); return; }
  if (!fechasTaller.includes(f)) fechasTaller.push(f);
  $('#t-fecha-nueva').value = '';
  pintarFechasTaller();
  $('#t-fecha-nueva').focus();
});
$('#t-fechas').addEventListener('click', ev => {
  const b = ev.target.closest('[data-quitar-fecha]');
  if (!b) return;
  fechasTaller = fechasTaller.filter(f => f !== b.dataset.quitarFecha);
  pintarFechasTaller();
});
function abrirTaller(id = null, temporada = 'semestral', modalidad = 'presencial', foco = 't-nombre') {
  $('#dlg-taller-ver').open && $('#dlg-taller-ver').close();
  editandoTaller = id;
  const t = id ? taller(id) : null;
  $('#form-taller').reset();
  $('#taller-titulo').textContent = t ? `Editar ${t.nombre}` : 'Nuevo taller';
  $('#taller-error').hidden = true;
  $('#t-nombre').value = t?.nombre || '';
  $('#t-temporada').value = t?.temporada || temporada;
  $('#t-modalidad').value = t ? (esOnline(t) ? 'online' : 'presencial') : modalidad;
  $('#t-enlace').value = t?.enlace || '';
  mostrarEnlace();
  $('#t-area').value = t?.area || '';
  $('#t-color').value = color(t?.color);
  $('#t-horaInicio').value = t?.horaInicio || '';
  $('#t-horaFin').value = t?.horaFin || '';
  $('#t-encargado').value = t?.encargado || '';
  $('#t-encargado-email').value = t?.encargadoEmail || '';
  $('#t-programa-texto').value = t?.programaTexto || '';
  $('#t-afiches-actuales').innerHTML = t?.afiches.length
    ? `<p class="nota-suave">Marca los que quieras quitar. Para agregar más, elígelos abajo (puedes elegir varios a la vez).</p>${t.afiches.map(a => `<label class="check-suelto"><input type="checkbox" name="quitarAfiche" value="${esc(a.ruta)}"> Quitar «${esc(a.nombre)}»</label>`).join('')}`
    : '<p class="nota-suave">Aún no hay afiches. Elige uno o varios archivos.</p>';
  $('#t-activo').checked = t ? t.activo : true;
  $('#t-edad').value = t?.edad || '';
  $('#t-nota').value = t?.nota || '';
  $('#t-objetivo').value = t?.objetivo || '';
  fechasTaller = [...(t?.fechas || [])];
  pintarFechasTaller();
  mostrarCamposTemporada();
  $('#t-dias').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="dias" value="${d}" ${t?.dias.includes(d) ? 'checked' : ''}>${DIAS_CORTOS[d]}</label>`).join('');
  const equipo = S.usuarios.filter(u => u.rol === 'tallerista');
  $('#t-equipo').innerHTML = equipo.length ? equipo.map(u => `<label><input type="checkbox" name="equipo" value="${u.id}" ${t?.equipo.includes(u.id) ? 'checked' : ''}>${esc(u.nombre || u.email)}${u.activo ? '' : ' <span class="muted">(inactiva)</span>'}</label>`).join('') : '<p class="nota-suave">Aún no hay talleristas. Invítalas desde Administración. Dirección y terapeutas pueden pasar lista en todos los talleres.</p>';
  filtroChecks($('#t-equipo'), 't-equipo', 'Buscar tallerista');
  $('#t-programa-actual').hidden = !t?.programaPdf;
  $('#t-programa-actual').textContent = t?.programaPdf ? `Programa actual: ${t.programaNombre || 'programa.pdf'}. Elige otro archivo para reemplazarlo.` : '';
  $('#t-programa-quitar-box').hidden = !t?.programaPdf;
  $('#t-eliminar').hidden = !t;
  $('#dlg-taller').showModal();
  ($(`#${foco}`) || $('#t-nombre')).focus();
}
$('#form-taller').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const t = {
    id: editandoTaller, nombre: String(fd.get('nombre')).trim(), area: String(fd.get('area')).trim(), color: fd.get('color'),
    horaInicio: fd.get('horaInicio'), horaFin: fd.get('horaFin'), encargado: String(fd.get('encargado')).trim(),
    encargadoEmail: correos(fd.get('encargadoEmail')).join(', '), programaTexto: String(fd.get('programaTexto') || '').trim(),
    activo: $('#t-activo').checked, dias: fd.getAll('dias').map(Number), equipo: fd.getAll('equipo'), temporada: fd.get('temporada'),
    orden: editandoTaller ? taller(editandoTaller).orden : S.talleres.length + 1,
    edad: String(fd.get('edad')).trim(), nota: String(fd.get('nota')).trim(), objetivo: String(fd.get('objetivo')).trim(),
    modalidad: fd.get('modalidad') === 'online' ? 'online' : 'presencial', enlace: String(fd.get('enlace') || '').trim(),
    fechas: fd.get('temporada') === 'verano' ? [...fechasTaller].sort() : [],
  };
  // Con fechas exactas, los días de la semana salen de esas fechas.
  if (t.fechas.length) t.dias = [...new Set(t.fechas.map(f => deISO(f).getDay()))].sort();
  const err = $('#taller-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (!t.nombre) return mostrar('Escribe el nombre del taller.');
  if (t.temporada === 'verano' && !t.fechas.length) return mostrar('Agrega al menos una fecha de sesión.');
  if (!t.dias.length) return mostrar('Elige al menos un día de la semana.');
  if (t.horaInicio && t.horaFin && t.horaFin <= t.horaInicio) return mostrar('La hora de término debe ser posterior a la de inicio.');
  const pdf = $('#t-programa').files[0] || null;
  const quitarPdf = !pdf && $('#t-programa-quitar').checked;
  if (pdf && pdf.type !== 'application/pdf' && !/\.pdf$/i.test(pdf.name)) return mostrar('El programa debe ser un archivo PDF.');
  if (pdf && pdf.size > 10 * 1024 * 1024) return mostrar('El PDF es demasiado grande (máximo 10 MB).');
  const malo = correos(t.encargadoEmail).find(c => !correoValido(c));
  if (malo) return mostrar(`Revisa el correo «${malo}». Si son varios, sepáralos con coma.`);
  const afichesNuevos = [...$('#t-afiches').files];
  const afichesQuitar = fd.getAll('quitarAfiche').map(String);
  const afMalo = afichesNuevos.find(a => !/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/.test(a.type));
  if (afMalo) return mostrar(`«${afMalo.name}» no es una imagen (JPG, PNG, WebP, GIF) ni un PDF.`);
  const afGrande = afichesNuevos.find(a => a.size > 10 * 1024 * 1024);
  if (afGrande) return mostrar(`«${afGrande.name}» es demasiado grande (máximo 10 MB).`);
  if (t.modalidad !== 'online') t.enlace = '';
  else if (t.enlace && !enlaceValido(t.enlace)) return mostrar('El enlace debe ser una dirección completa que empiece con https://');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await conCarga(async () => {
      const id = await D.guardarTaller(t);
      editandoTaller = id;
      if (pdf) await D.subirPrograma(id, pdf);
      else if (quitarPdf) await D.quitarPrograma(id);
      if (afichesQuitar.length) await D.quitarAfiches(id, afichesQuitar);
      if (afichesNuevos.length) await D.subirAfiches(id, afichesNuevos);
    }, afichesNuevos.length || pdf ? 'Subiendo archivos…' : 'Guardando…');
    S.talleres = await D.talleres();
    $('#dlg-taller').close();
    toast(t.id ? 'Taller actualizado' : 'Taller creado');
    render();
  } catch (e) {
    mostrar(e.message);
    // Si el taller se creó pero falló el PDF, se recarga para que el reintento lo actualice en vez de duplicarlo.
    // Si el taller se guardó pero falló un archivo, se recarga para que el reintento lo actualice en vez de duplicarlo.
    if (editandoTaller) { try { S.talleres = await D.talleres(); render(); } catch { /* sin conexión */ } }
  }
  finally { botonOcupado(btn, false); }
});
$('#t-eliminar').addEventListener('click', async () => {
  const t = taller(editandoTaller);
  const n = registros({ taller: t.id }).length;
  $('#dlg-taller').close();
  if (!await confirmar(`¿Eliminar ${t.nombre}?`, `Se borran también sus inscripciones y ${n} registros de asistencia. Si solo dejará de dictarse, mejor desmarca «Taller activo».`, 'Eliminar taller')) return;
  try {
    await intentar(() => D.eliminarTaller(t.id), 'Taller eliminado');
    S.talleres = S.talleres.filter(x => x.id !== t.id);
    S.alumnos.forEach(a => { a.talleres = a.talleres.filter(x => x !== t.id); });
    for (const dia of Object.values(S.asistencia)) delete dia[t.id];
    render();
  } catch { /* ya avisado */ }
});

/* ---------- formulario de cuenta ---------- */
let editandoUsuario = null;
function abrirUsuario(id = null) {
  editandoUsuario = id;
  const u = id ? S.usuarios.find(x => x.id === id) : null;
  $('#form-usuario').reset();
  $('#usuario-error').hidden = true;
  $('#usuario-titulo').textContent = u ? (u.rol && u.activo ? `Editar cuenta de ${u.nombre || u.email}` : `Dar acceso a ${u.nombre || u.email}`) : 'Invitar persona';
  $('#u-nombre').value = u?.nombre || '';
  $('#u-email').value = u?.email || '';
  $('#u-email').disabled = !!u;
  $('#u-rol').value = u?.rol || 'tallerista';
  $('#u-fechaNac').value = u?.fechaNac || '';
  $('#u-fechaNac').max = iso(hoy());
  $('#u-aviso-cumple').checked = u ? !!u.avisoCumple : false;
  $('#u-activo').checked = u ? (u.rol ? u.activo : true) : true;
  $('#u-activo-box').hidden = !u;
  $('#u-nota').hidden = !!u;
  $('#u-guardar').textContent = u ? 'Guardar cambios' : 'Enviar invitación';
  $('#u-eliminar').hidden = !u || u.id === S.perfil.id;
  $('#u-talleres').innerHTML = S.talleres.filter(t => t.activo).map(t => `<label><input type="checkbox" name="talleres" value="${t.id}" ${u?.talleres.includes(t.id) ? 'checked' : ''}>${punto(t)}${esc(t.nombre)}</label>`).join('');
  filtroChecks($('#u-talleres'), 'u-talleres', 'Buscar taller');
  mostrarTalleresUsuario();
  $('#dlg-usuario').showModal();
  $('#u-nombre').focus();
}
const mostrarTalleresUsuario = () => { $('#u-talleres-box').hidden = $('#u-rol').value !== 'tallerista'; };
$('#u-rol').addEventListener('change', mostrarTalleresUsuario);
$('#form-usuario').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const datos = { nombre: String(fd.get('nombre')).trim(), email: $('#u-email').value.trim().toLowerCase(), rol: fd.get('rol'), activo: $('#u-activo').checked, talleres: fd.getAll('talleres'), fechaNac: String(fd.get('fechaNac') || ''), avisoCumple: $('#u-aviso-cumple').checked };
  if (datos.rol !== 'tallerista') datos.talleres = [];
  const err = $('#usuario-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (!datos.nombre) return mostrar('Escribe el nombre.');
  if (!editandoUsuario && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) return mostrar('Escribe un correo válido.');
  if (datos.fechaNac && datos.fechaNac > iso(hoy())) return mostrar('La fecha de nacimiento no puede ser futura.');
  if (editandoUsuario === S.perfil.id && (datos.rol !== 'admin' || !datos.activo)) return mostrar('No puedes quitarte tu propio acceso de dirección. Pide a otra persona de dirección que lo haga.');
  const btn = ev.submitter;
  botonOcupado(btn, true, editandoUsuario ? 'Guardando…' : 'Enviando…');
  try {
    await conCarga(async () => {
      await (editandoUsuario ? D.actualizarUsuario(editandoUsuario, datos) : D.invitar(datos));
      [S.usuarios, S.talleres, S.cumpleEquipo] = await Promise.all([D.usuarios(), D.talleres(), D.cumpleanosEquipo()]);
    }, editandoUsuario ? 'Guardando…' : 'Enviando invitación…');
    $('#dlg-usuario').close();
    toast(editandoUsuario ? 'Cuenta actualizada' : `Invitación enviada a ${datos.email}`);
    render();
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});
$('#u-eliminar').addEventListener('click', async () => {
  const u = S.usuarios.find(x => x.id === editandoUsuario);
  $('#dlg-usuario').close();
  if (!await confirmar(`¿Eliminar la cuenta de ${u.nombre || u.email}?`, 'La persona ya no podrá entrar. La asistencia que registró se conserva.', 'Eliminar cuenta')) return;
  try {
    await intentar(async () => {
      await D.eliminarUsuario(u.id);
      [S.usuarios, S.talleres, S.cumpleEquipo] = await Promise.all([D.usuarios(), D.talleres(), D.cumpleanosEquipo()]);
    }, 'Cuenta eliminada');
    render();
  } catch { /* ya avisado */ }
});

/* ---------- mi fecha de nacimiento ---------- */
function abrirMiCumple() {
  $('#mi-cumple-error').hidden = true;
  $('#mi-fechaNac').value = S.perfil.fechaNac || '';
  $('#mi-fechaNac').max = iso(hoy());
  $('#dlg-mi-cumple').showModal();
  $('#mi-fechaNac').focus();
}
$('#form-mi-cumple').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fecha = $('#mi-fechaNac').value;
  const err = $('#mi-cumple-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (fecha && fecha > iso(hoy())) return mostrar('La fecha de nacimiento no puede ser futura.');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await conCarga(async () => {
      await D.guardarMiFechaNac(fecha);
      S.perfil.fechaNac = fecha;
      [S.cumpleEquipo, S.usuarios] = await Promise.all([D.cumpleanosEquipo(), puede.admin() ? D.usuarios() : Promise.resolve([])]);
    });
    $('#dlg-mi-cumple').close();
    toast(fecha ? 'Fecha de nacimiento guardada' : 'Fecha de nacimiento borrada');
    render();
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});

/* ---------- exportar ---------- */
function exportarFichas() {
  const cols = [['Nombre', 'nombre'], ['Apellidos', 'apellidos'], ['Nombre preferido', 'apodo'], ['Pronombres', 'pronombres'], ['Fecha de nacimiento', 'fechaNac'], ['RUT', 'rut'], ['Programas', 'programa'], ['Estado', a => ESTADO_ALUMNO[a.estado]], ['Talleres', a => a.talleres.map(id => taller(id)?.nombre).join(' | ')], ['Beca', 'beca'], ['Ingreso', 'fechaIngreso'], ['Responsable', 'tutorNombre'], ['Parentesco', 'tutorRelacion'], ['Teléfono', 'tutorTelefono'], ['Correo', 'tutorEmail'], ...CONTACTOS_EMERG.flatMap((k, n) => [[`Emergencia ${n + 1}: nombre`, a => leerEmergencia(a[k]).nombre], [`Emergencia ${n + 1}: parentesco`, a => leerEmergencia(a[k]).parentesco], [`Emergencia ${n + 1}: teléfono`, a => leerEmergencia(a[k]).telefono]]), ['Dirección', 'direccion'], ['Alergias', 'alergias'], ['Intereses', 'intereses'], ['Apoyos', 'apoyos'], ['% asistencia (historial cargado)', a => resumen(registros({ alumno: a.id })).pct ?? '']];
  const filas = [cols.map(c => c[0])].concat(ordenarAlumnos(S.alumnos).map(a => cols.map(([, k]) => typeof k === 'function' ? k(a) : a[k])));
  descargar(`spectrumpro-fichas-${iso(hoy())}.csv`, csv(filas), 'text/csv;charset=utf-8');
  toast('Fichas descargadas');
}
function exportarAsistencia() {
  const desde = $('#exp-desde').value, hasta = $('#exp-hasta').value;
  ui.expDesde = desde; ui.expHasta = hasta;
  if (!desde || !hasta || desde > hasta) { toast('Revisa el rango de fechas.', 'error'); return; }
  if (desde < iso(sumarDias(hoy(), -DIAS_HISTORIA))) toast(`La plataforma carga los últimos ${DIAS_HISTORIA} días de asistencia; lo anterior no se incluye.`, 'warn');
  const regs = registros({ desde, hasta }).sort((x, y) => x.fecha.localeCompare(y.fecha));
  const filas = [['Fecha', 'Taller', 'Joven', 'Programa', 'Estado']].concat(regs.map(r => {
    const a = alumno(r.alumno);
    return [r.fecha, taller(r.taller)?.nombre || '', a ? nombreCompleto(a) : '', a?.programa || '', ESTADOS[r.e].label];
  }));
  descargar(`spectrumpro-asistencia-${desde}-a-${hasta}.csv`, csv(filas), 'text/csv;charset=utf-8');
  toast(`${regs.length} registros descargados`);
}

/* =====================================================================
   Enrutado y eventos
   ===================================================================== */
const VISTAS = { panel: vistaPanel, asistencia: vistaAsistencia, cumpleanos: vistaCumpleanos, alumnos: vistaAlumnos, talleres: vistaTalleres, verano: vistaVerano, online: vistaOnline, tienda: vistaTienda, administracion: vistaAdministracion };
// js/posts.js agrega VISTAS.posts (Estudio de posts, solo dirección), js/sitio.js agrega VISTAS.sitio (Sitio web)
// y js/comunidad.js agrega VISTAS.comunidad (boletines y suscriptores).
function vistaActual() {
  const v = location.hash.slice(1);
  if (!VISTAS[v]) return 'panel';
  if ((v === 'administracion' || v === 'posts') && !puede.admin()) return 'panel';
  if (v === 'tienda' && !puede.tienda()) return 'panel';
  if (v === 'sitio' && !puede.sitio()) return 'panel';
  if (v === 'comunidad' && !puede.comunidad()) return 'panel';
  if (puede.esEquipo() && (v === 'asistencia' || v === 'alumnos')) return 'panel';
  return v;
}
let vistaPintada = null;
function render() {
  if (!S.perfil) return;
  const v = vistaActual();
  $$('.nav a').forEach(a => a.dataset.vista === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  if (v !== vistaPintada) marcarGrupos(v);
  const caja = $('#vista');
  VISTAS[v](caja);
  aplicarBuscadores(caja);
  // Solo se anima al cambiar de sección: render() también corre en cada clic (p. ej. al pasar lista).
  if (v !== vistaPintada) {
    vistaPintada = v;
    caja.classList.remove('entrando');
    void caja.offsetWidth;
    caja.classList.add('entrando');
    clearTimeout(render.t);
    render.t = setTimeout(() => caja.classList.remove('entrando'), 1400);
    contarKpis(caja);
  }
}
window.addEventListener('hashchange', () => {
  if (/access_token|type=/.test(location.hash)) return;
  render(); window.scrollTo(0, 0);
});

document.addEventListener('click', async ev => {
  const t = ev.target;
  const el = sel => t.closest(sel);
  let x;

  if ((x = el('[data-ver-clave]'))) {
    const inp = document.getElementById(x.dataset.verClave);
    const ver = inp.type === 'password';
    inp.type = ver ? 'text' : 'password';
    x.textContent = ver ? 'Ocultar' : 'Mostrar';
    x.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña');
    return;
  }
  if ((x = el('[data-demo-rol]'))) {
    $$('[data-demo-rol]').forEach(b => { b.disabled = true; });
    x.setAttribute('aria-busy', 'true');
    try { await D.entrarDemo(x.dataset.demoRol); if (!location.hash) location.hash = 'panel'; await iniciarSesion(); }
    catch (e) { pantallaCarga(false); toast(e.message, 'error'); }
    finally { $$('[data-demo-rol]').forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); }); }
    return;
  }
  if ((x = el('[data-limpiar]'))) {
    const inp = $('input[type=search]', x.closest('.buscador'));
    inp.value = '';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.focus();
    return;
  }
  if ((x = el('[data-copiar]'))) {
    try { await navigator.clipboard.writeText(x.dataset.copiar); toast('Copiado'); }
    catch {
      const r = document.createRange(); r.selectNodeContents(x.previousElementSibling);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Texto seleccionado: cópialo con Ctrl+C', 'warn');
    }
    return;
  }
  if ((x = el('[data-cerrar]'))) { x.closest('dialog').close(); return; }
  if ((x = el('[data-editar]'))) { abrirFormulario(x.dataset.editar); return; }
  if ((x = el('[data-eliminar]'))) {
    const a = alumno(x.dataset.eliminar);
    $('#dlg-ficha').close();
    if (!await confirmar(`¿Eliminar la ficha de ${nombreCompleto(a)}?`, 'También se borra su historial de asistencia y sus datos privados. Si dejó de venir, mejor cambia su estado a «Retirado» o «Egresado».', 'Eliminar ficha')) { abrirFicha(a.id); return; }
    try {
      await intentar(() => D.eliminarAlumno(a.id), 'Ficha eliminada');
      S.alumnos = S.alumnos.filter(y => y.id !== a.id);
      S.cumple = S.cumple.filter(y => y.id !== a.id);
      for (const dia of Object.values(S.asistencia)) for (const reg of Object.values(dia)) delete reg[a.id];
      render();
    } catch { /* ya avisado */ }
    return;
  }
  if ((x = el('[data-ficha]'))) { abrirFicha(x.dataset.ficha); return; }
  if ((x = el('[data-ir-taller]'))) {
    ui.fecha = iso(hoy()); ui.taller = x.dataset.irTaller; ui.modoAsis = 'lista';
    location.hash === '#asistencia' ? render() : (location.hash = 'asistencia');
    return;
  }
  if ((x = el('[data-ver-mes]'))) {
    ui.tallerMes = x.dataset.verMes; ui.modoAsis = 'mes';
    location.hash === '#asistencia' ? render() : (location.hash = 'asistencia');
    return;
  }
  if ((x = el('[data-editar-taller]'))) { abrirTaller(x.dataset.editarTaller, undefined, undefined, x.dataset.foco); return; }
  if ((x = el('[data-ver-taller]'))) { abrirTallerVer(x.dataset.verTaller, x.dataset.pestana); return; }
  if ((x = el('[data-pestana-taller]'))) { abrirTallerVer($('#dlg-taller-ver').dataset.tallerId, x.dataset.pestanaTaller); return; }
  if ((x = el('[data-afiche-abrir]'))) { abrirAfiche(x.dataset.aficheAbrir, false); return; }
  if ((x = el('[data-afiche-bajar]'))) { abrirAfiche(x.dataset.aficheBajar, true); return; }
  if ((x = el('[data-imprimir]'))) { imprimirDialogo(x.closest('dialog')); return; }
  if ((x = el('[data-mover-taller]'))) { moverTaller(x.dataset.moverTaller, Number(x.dataset.dir), x.dataset.temporada); return; }
  if (t.id === 'horario-inactivos') { ui.horarioInactivos = t.checked; abrirHorario(ui.horarioTemporada); return; }
  if ((x = el('[data-ver-programa]'))) { verPrograma(x.dataset.verPrograma); return; }
  if ((x = el('[data-mover-producto]'))) { moverProducto(x.dataset.moverProducto, Number(x.dataset.dir)); return; }
  if ((x = el('[data-producto]'))) { abrirProducto(x.dataset.producto); return; }
  if ((x = el('[data-usuario]'))) { abrirUsuario(x.dataset.usuario); return; }
  if ((x = el('[data-tab-admin]'))) { ui.tabAdmin = x.dataset.tabAdmin; render(); return; }
  if ((x = el('[data-tab-cumple]'))) { ui.tabCumple = x.dataset.tabCumple; render(); return; }
  if ((x = el('[data-modo]'))) { ui.modoAsis = x.dataset.modo; render(); return; }
  if ((x = el('[data-taller]'))) { ui.taller = x.dataset.taller; ui.q.lista = ''; render(); return; }
  if ((x = el('.seg button'))) { marcar(x.closest('.seg').dataset.alumno, x.dataset.e, x.closest('.seg')); return; }
  if (t.id === 'todos-presentes') {
    const { fecha, taller: tid } = ui;
    const reg = S.asistencia[fecha]?.[tid] || {};
    const pend = inscritosActivos(tid).filter(a => !reg[a.id]).map(a => a.id);
    if (!pend.length) { toast('No había pendientes'); return; }
    botonOcupado(t, true, 'Marcando…');
    try {
      await intentar(() => D.marcar(fecha, tid, pend, 'P'), `${pend.length} marcados como presentes`);
      fijarLocal(fecha, tid, pend, 'P'); render();
    } catch { botonOcupado(t, false); }
    return;
  }
  if ((x = el('[data-accion]'))) {
    const acc = x.dataset.accion;
    if (acc === 'olvide') { $('#recuperar-email').value = $('#entrar-email').value; $('#recuperar-info').hidden = true; mostrarAcceso('recuperar'); }
    if (acc === 'volver-entrar') mostrarAcceso('entrar');
    if (acc === 'salir') {
      try { await conCarga(() => D.salir(), 'Cerrando sesión…'); } catch { /* se sale igual */ }
      S.perfil = null; S.tienda = null; S.sitio = null; S.comunidad = null;
      mostrarAcceso('entrar');
    }
    if (acc === 'mi-cumple') abrirMiCumple();
    if (acc === 'nueva-ficha') abrirFormulario();
    if (acc === 'nuevo-taller') abrirTaller(null, x.dataset.temporada, x.dataset.modalidad);
    if (acc === 'horario') abrirHorario(x.dataset.temporada);
    if (acc === 'horario-csv') horarioCsv();
    if (acc === 'probar-recordatorio') {
      try {
        const r = await conCarga(() => D.probarRecordatorio(), 'Enviando correo de prueba…');
        toast(`Correo de prueba enviado a ${S.perfil.email || 'tu correo'}${r?.hoy || r?.pronto ? '' : ' (hoy no hay cumpleaños, así que llega sin nombres)'}`);
      } catch (e) { toast(e.message, 'error'); }
    }
    if (acc === 'invitar') abrirUsuario();
    if (acc === 'nuevo-producto') abrirProducto();
    if (acc === 'exportar-fichas') exportarFichas();
    if (acc === 'exportar-asistencia') exportarAsistencia();
    if (acc === 'restablecer-demo' && await confirmar('¿Restablecer la demostración?', 'Se borran los cambios hechos en este navegador y se cargan de nuevo los datos ficticios.', 'Restablecer')) {
      try { await D.restablecer(); await cargarTodo('Restableciendo la demostración…'); toast('Demostración restablecida'); }
      catch (e) { toast(e.message || String(e), 'error'); }
    }
  }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'asis-fecha' && t.value) { ui.fecha = t.value; ui.taller = null; ui.q.lista = ''; render(); }
  if (t.id === 'asis-otro' && t.value) { ui.taller = t.value; ui.q.lista = ''; render(); }
  if (t.id === 'mes-mes' && t.value) { ui.mes = t.value; render(); }
  if (t.id === 'mes-taller') { ui.tallerMes = t.value; render(); }
  if (t.id === 'filtro-taller') { ui.filtroTaller = t.value; pintarFichas(); }
  if (t.id === 'filtro-programa') { ui.filtroPrograma = t.value; pintarFichas(); }
  if (t.id === 'filtro-estado') { ui.filtroEstado = t.value; pintarFichas(); }
  if (t.id === 'exp-desde') ui.expDesde = t.value;
  if (t.id === 'exp-hasta') ui.expHasta = t.value;
  if (t.closest('#form-alumno')) avisoTO();
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'buscar') { ui.busqueda = t.value; pintarFichas(); return; }
  if (t.matches('[data-buscador]')) {
    ui.q[t.dataset.buscador] = t.value;
    aplicarBusqueda(t.dataset.buscador, t.closest('dialog') || document);
  }
});
document.addEventListener('keydown', ev => {
  const t = ev.target;
  // Enter en un buscador dentro de un formulario no debe enviarlo.
  if (ev.key === 'Enter' && t.matches?.('input[type=search]') && t.form) { ev.preventDefault(); return; }
  // Escape en un buscador con texto lo vacía (y no cierra el diálogo).
  if (ev.key === 'Escape' && t.matches?.('input[type=search]') && t.value) {
    ev.preventDefault(); ev.stopPropagation();
    t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // «/» lleva al buscador de la sección (como en Gmail o GitHub).
  if (ev.key === '/' && !ev.ctrlKey && !ev.metaKey && !ev.altKey && !t.closest?.('input, textarea, select, [contenteditable]') && !$('dialog[open]')) {
    const b = $$('#vista input[type=search]').find(i => i.offsetParent);
    if (b) { ev.preventDefault(); b.focus(); b.select(); }
  }
});

/* ---------- conexión y PWA ---------- */
const actualizarConexion = () => { $('#sin-conexion').hidden = navigator.onLine; };
window.addEventListener('online', actualizarConexion);
window.addEventListener('offline', actualizarConexion);
actualizarConexion();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => { /* la app funciona sin él */ });
}

arrancar();
