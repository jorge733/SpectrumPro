'use strict';
/* SpectrumPro · Gestión de alumnado
   Interfaz. Los datos llegan de window.SPDatos (Supabase o demostración). */

const D = window.SPDatos;
const { iso, hoy, sumarDias } = window.SPFechas;
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
};
const ui = {
  fecha: iso(hoy()), taller: null, modoAsis: 'lista', mes: iso(hoy()).slice(0, 7), tallerMes: null,
  tabCumple: 'jovenes', busqueda: '', filtroTaller: '', filtroPrograma: '', filtroEstado: 'activo', tabAdmin: 'usuarios',
  expDesde: iso(sumarDias(hoy(), -30)), expHasta: iso(hoy()),
};

const rol = () => S.perfil?.rol;
const puede = {
  verTodo: () => ['admin', 'terapeuta'].includes(rol()),
  editarFichas: () => ['admin', 'terapeuta'].includes(rol()),
  eliminarFichas: () => rol() === 'admin',
  admin: () => rol() === 'admin',
  // La tienda la editan dirección y el rol Equipo.
  tienda: () => ['admin', 'equipo'].includes(rol()),
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
let cargas = 0;
async function conCarga(tarea) {
  cargas++; $('#cargando').hidden = false;
  try { return await tarea(); } finally { if (--cargas === 0) $('#cargando').hidden = true; }
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
const csv = filas => '﻿' + filas.map(f => f.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');

/* =====================================================================
   Arranque y sesión
   ===================================================================== */
const textoArranque = t => { $('#arranque-texto').textContent = t; };
let necesitaClave = /type=(invite|recovery)/.test(location.hash);

function mostrarAcceso(panel = 'entrar', mensaje = '') {
  document.body.classList.remove('resolviendo');
  $('#arranque').hidden = true;
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
  textoArranque('Verificando tu cuenta…');
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

async function cargarTodo() {
  textoArranque('Cargando talleres, fichas y asistencia…');
  const desde = iso(sumarDias(hoy(), -DIAS_HISTORIA));
  const [talleres, alumnos, asistencia, cumple, cumpleEquipo, usuarios] = await Promise.all([
    D.talleres(), D.alumnos(), D.asistencia(desde), D.cumpleanos(), D.cumpleanosEquipo().catch(() => []), puede.admin() ? D.usuarios() : Promise.resolve([]),
  ]);
  Object.assign(S, { talleres, alumnos, cumple, cumpleEquipo, usuarios, asistencia: indexarAsistencia(asistencia), auditoria: null, tienda: null });
  mostrarApp();
}

function mostrarApp() {
  document.body.classList.remove('resolviendo');
  document.body.dataset.rol = rol();
  $('#arranque').hidden = true;
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
  $$('[data-no-equipo]').forEach(el => { el.hidden = puede.esEquipo(); });
  render();
}

async function arrancar() {
  aplicarPlegado();
  const cfg = window.SPECTRUMPRO_CONFIG || {};
  if (cfg.supabaseUrl && D.modo === 'demo') {
    textoArranque('No se pudo cargar la conexión con Supabase. Revisa tu internet y recarga la página.');
    return;
  }
  D.alCambiarSesion((evento) => {
    if (evento === 'PASSWORD_RECOVERY') { necesitaClave = true; mostrarAcceso('clave'); }
    if (evento === 'SIGNED_OUT' && S.perfil) { S.perfil = null; mostrarAcceso('entrar', 'Tu sesión terminó. Vuelve a entrar.'); }
  });
  try {
    textoArranque('Conectando…');
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
  catch (e) { err.textContent = e.message; err.hidden = false; }
  finally { botonOcupado(btn, false); }
});
$('#form-recuperar').addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = $('#recuperar-email').value.trim();
  const info = $('#recuperar-info');
  if (!email) { info.textContent = 'Escribe tu correo.'; info.hidden = false; return; }
  try {
    await D.recuperar(email);
    info.textContent = `Si ${email} corresponde a una cuenta, en unos minutos llegará un enlace para crear una contraseña nueva. Revisa también la carpeta de spam.`;
  } catch (e) { info.textContent = e.message; }
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
  } catch (e) { err.textContent = e.message; err.hidden = false; }
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
$('#plegar').addEventListener('click', () => aplicarPlegado(!document.body.classList.contains('menu-plegado')));

/* =====================================================================
   Vistas
   ===================================================================== */
function vistaPanel(el) {
  if (puede.esEquipo()) return vistaPanelEquipo(el);
  const t = hoy(), f = iso(t);
  const vig = vigentes();
  const sesionesHoy = misTalleres().filter(x => x.dias.includes(t.getDay()));
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
            <div class="txt"><b>${esc(s.nombre)}</b><small>${esc(horario(s))} · ${ins} inscritos</small>
              <div class="barra" role="img" aria-label="${reg} de ${ins} con asistencia registrada"><span style="width:${pct}%"></span></div></div>
            ${reg >= ins && ins ? '<span class="chip chip-ok">Lista pasada</span>' : `<button type="button" class="btn btn-sec btn-peq" data-ir-taller="${s.id}">Pasar lista</button>`}
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
  const hoyTalleres = S.talleres.filter(x => x.activo && x.dias.includes(t.getDay()))
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
        ${hoyTalleres.length ? hoyTalleres.map(s => `<div class="sesion">${punto(s)}<div class="txt"><b>${esc(s.nombre)}</b><small>${esc(horario(s))}${s.encargado ? ' · ' + esc(s.encargado) : ''}</small></div></div>`).join('') : '<p class="vacio">Hoy no hay talleres programados.</p>'}
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
  const delDia = propios.filter(x => x.dias.includes(d.getDay()));
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
  const delDia = propios.filter(x => x.dias.includes(d.getDay()));
  const otros = propios.filter(x => !x.dias.includes(d.getDay()));
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
      ${inscritos.length ? `<ul class="lista pase">${inscritos.map(a => `
        <li>
          ${avatar(a)}
          <div class="txt"><b class="fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</b><small>${esc(a.programa)}${a.pronombres ? ' · ' + esc(a.pronombres) : ''}${a.alergias ? ' · <span class="txt-alerta">Alergia: ' + esc(a.alergias) + '</span>' : ''}</small></div>
          <div class="seg" role="group" aria-label="Asistencia de ${esc(nombreVisible(a))}" data-alumno="${a.id}">
            ${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" data-e="${k}" aria-pressed="${reg[a.id] === k}" title="${v.label}" ${futuro ? 'disabled' : ''}><span class="lbl-corto">${k}</span><span class="lbl-largo">${v.label}</span></button>`).join('')}
          </div>
        </li>`).join('')}</ul>` : '<p class="vacio">No hay jóvenes activos inscritos en este taller.</p>'}
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
  try { await D.marcar(fecha, tid, [aid], nuevo); }
  catch (err) {
    fijarLocal(fecha, tid, [aid], antes);
    pintarSeg(seg, antes); pintarResumenLista();
    toast(`No se guardó la asistencia. ${err.message}`, 'error');
  }
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
    if (tal.dias.includes(d.getDay()) || S.asistencia[f]?.[tal.id]) fechas.push(d);
  }
  const ins = tal ? ordenarAlumnos(S.alumnos.filter(a => a.talleres.includes(tal.id) && (a.estado === 'activo' || fechas.some(d => S.asistencia[iso(d)]?.[tal.id]?.[a.id])))) : [];
  el.innerHTML = `
    <section class="tarjeta pila">
      <div class="controles">
        <label class="campo-inline" for="mes-mes">Mes<input type="month" id="mes-mes" value="${ui.mes}"></label>
        <label class="campo-inline" for="mes-taller">Taller
          <select id="mes-taller">${misTalleres().map(o => `<option value="${o.id}" ${o.id === ui.tallerMes ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
        </label>
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
            return `<tr><td class="nom fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</td>${celdas}<td class="pct">${n ? Math.round(p / n * 100) + '%' : '—'}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>`}
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
    ${esEquipo ? `<section class="tarjeta mi-cumple">
      <div class="txt"><b>Tu cumpleaños</b><br><small class="muted">${S.perfil.fechaNac ? esc(fechaLarga(proximoCumple(S.perfil.fechaNac, t).fecha).replace(/^\S+ /, '')) : 'Aún no has puesto tu fecha de nacimiento.'}</small></div>
      <button type="button" class="btn ${S.perfil.fechaNac ? 'btn-sec ' : ''}btn-peq" data-accion="mi-cumple">${S.perfil.fechaNac ? 'Cambiar' : 'Añadir mi fecha'}</button>
    </section>` : ''}
    ${esEquipo && !fuente.length ? `<section class="tarjeta"><p class="vacio">${vacioEquipo}</p></section>` : `
    ${deHoy.map(x => `<div class="hoy-cumple">${avatar(x.a, 'avatar-xl')}<div><p class="eyebrow">Hoy, ${esc(fechaLarga(t))}</p><b>${esc(nombreLargo(x.a))} ${sinAnio(x.a.fechaNac) ? 'está de cumpleaños' : `cumple ${x.cumple} años`}</b></div>${alumno(x.a.id) ? `<button type="button" class="btn btn-sec btn-peq" data-ficha="${x.a.id}" style="margin-left:auto">Ver ficha</button>` : ''}</div>`).join('')}
    <section class="tarjeta">
      <h2>Próximos 30 días <small>${prox.length} cumpleaños</small></h2>
      ${prox.length ? `<ul class="lista">${prox.map(x => `
        <li class="${alumno(x.a.id) ? 'fila-click' : ''}" ${abrible(x.a.id)}>
          ${avatar(x.a)}
          <div class="txt"><b>${esc(nombreLargo(x.a))}</b><small>${esc(fechaLarga(x.fecha))}${cumpleTxt(x)}</small></div>
          <span class="dias">${x.dias}<small>${x.dias === 1 ? 'día' : 'días'}</small></span>
        </li>`).join('')}</ul>` : '<p class="vacio">No hay cumpleaños en los próximos 30 días.</p>'}
    </section>
    <section class="meses" aria-label="Cumpleaños por mes">
      ${meses.map((m, i) => {
        const delMes = fuente.filter(a => deISO(a.fechaNac).getMonth() === m).sort((a, b) => deISO(a.fechaNac).getDate() - deISO(b.fechaNac).getDate());
        return `<div class="mes ${i === 0 ? 'actual' : ''}">
          <h3>${MESES[m]} <small>${delMes.length || ''}</small></h3>
          ${delMes.length ? `<ul>${delMes.map(a => `<li ${abrible(a.id)} class="${alumno(a.id) ? 'clic' : ''}"><span class="d">${deISO(a.fechaNac).getDate()}</span><span class="n">${esc(nombreCorto(a))}</span><span class="e">${sinAnio(a.fechaNac) ? '' : proximoCumple(a.fechaNac, t).cumple + ' años'}</span></li>`).join('')}</ul>` : '<p class="vacio" style="padding:0">Sin cumpleaños</p>'}
        </div>`;
      }).join('')}
    </section>`}`;
}

function filtrarFichas() {
  const q = sinTildes(ui.busqueda.trim());
  return ordenarAlumnos(S.alumnos).filter(a =>
    (!q || sinTildes(`${a.nombre} ${a.apellidos} ${a.apodo} ${a.tutorNombre} ${a.rut}`).includes(q)) &&
    (!ui.filtroTaller || a.talleres.includes(ui.filtroTaller)) &&
    (!ui.filtroPrograma || a.programa === ui.filtroPrograma) &&
    (!ui.filtroEstado || a.estado === ui.filtroEstado));
}
function vistaAlumnos(el) {
  const programas = [...new Set(S.alumnos.map(a => a.programa))].sort();
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${S.alumnos.length} fichas${rol() === 'tallerista' ? ' de tus talleres' : ''}</p><h1>Fichas del alumnado</h1></div>
      ${puede.editarFichas() ? '<button type="button" class="btn" data-accion="nueva-ficha">+ Nueva ficha</button>' : ''}
    </header>
    <div class="controles">
      <input type="search" id="buscar" placeholder="Buscar por nombre, RUT o responsable" value="${esc(ui.busqueda)}" aria-label="Buscar" style="flex:1 1 240px">
      <select id="filtro-estado" aria-label="Filtrar por estado"><option value="">Todos los estados</option>${Object.entries(ESTADO_ALUMNO).map(([k, v]) => `<option value="${k}" ${k === ui.filtroEstado ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <select id="filtro-programa" aria-label="Filtrar por programa"><option value="">Todos los programas</option>${programas.map(p => `<option ${p === ui.filtroPrograma ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select id="filtro-taller" aria-label="Filtrar por taller"><option value="">Todos los talleres</option>${S.talleres.map(t => `<option value="${t.id}" ${t.id === ui.filtroTaller ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
    </div>
    <div id="lista-fichas"></div>`;
  pintarFichas();
}
function pintarFichas() {
  const lista = filtrarFichas();
  $('#lista-fichas').innerHTML = lista.length ? `<div class="fichas">${lista.map(a => {
    const r = resumen(registros({ alumno: a.id, desde: hace30() }));
    return `<button type="button" class="ficha-card" data-ficha="${a.id}">
      <div class="top">${avatar(a)}<div><b>${esc(nombreCompleto(a))}</b><small>${edad(a.fechaNac)} años · ${esc(a.programa)}</small></div></div>
      <div class="talleres-mini">${a.talleres.map(id => { const t = taller(id); return t ? `<span class="tag">${punto(t)}${esc(t.nombre)}</span>` : ''; }).join('')}</div>
      <div class="pie">${a.estado !== 'activo' ? `<span class="chip chip-neutro">${ESTADO_ALUMNO[a.estado]}</span>` : chipPct(r.pct)}${a.beca ? `<span class="chip chip-neutro">${esc(a.beca)}</span>` : ''}${a.alergias ? '<span class="chip chip-bad">Alergia</span>' : ''}</div>
    </button>`;
  }).join('')}</div>` : `<div class="vacio-grande">${S.alumnos.length ? 'No hay fichas que coincidan con la búsqueda.' : puede.editarFichas() ? 'Aún no hay fichas. Crea la primera con «Nueva ficha».' : 'Aún no hay jóvenes inscritos en tus talleres.'}</div>`;
}

function vistaTalleres(el) {
  const eq = puede.esEquipo();
  const lista = puede.verTodo() ? S.talleres : eq ? S.talleres.filter(t => t.activo) : misTalleres();
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${lista.length} talleres</p><h1>${puede.verTodo() || eq ? 'Talleres' : 'Tus talleres'}</h1><p>${eq ? 'Horario semanal y quién está a cargo.' : 'Horario semanal y asistencia de los últimos 30 días.'}</p></div>
      ${puede.admin() ? '<button type="button" class="btn" data-accion="nuevo-taller">+ Nuevo taller</button>' : ''}
    </header>
    ${lista.length ? `<div class="talleres">${lista.map(t => {
      const ins = S.alumnos.filter(a => a.estado === 'activo' && a.talleres.includes(t.id));
      const r = resumen(registros({ taller: t.id, desde: hace30() }));
      const equipo = S.usuarios.filter(u => t.equipo.includes(u.id));
      return `<article class="taller ${t.activo ? '' : 'inactivo'}" style="--c:${color(t.color)}">
        <h2>${esc(t.nombre)}${t.activo ? '' : ' <span class="chip chip-neutro">Inactivo</span>'}</h2>
        <dl>
          <dt>Área</dt><dd>${esc(t.area) || '—'}</dd>
          <dt>Días</dt><dd>${t.dias.length ? t.dias.map(d => DIAS[d]).join(', ') : '—'}</dd>
          <dt>Horario</dt><dd class="num">${esc(horario(t))}</dd>
          <dt>A cargo</dt><dd>${esc(t.encargado) || '—'}</dd>
          ${puede.admin() ? `<dt>Pasan lista</dt><dd>${equipo.length ? equipo.map(u => esc(u.nombre || u.email)).join(', ') : '<span class="muted">Solo dirección y terapeutas</span>'}</dd>` : ''}
          ${eq ? '' : `<dt>Inscritos</dt><dd class="num">${ins.length}</dd>`}
        </dl>
        <div class="acciones">${eq ? '' : chipPct(r.pct)}
          ${puede.pasarLista(t.id) && t.activo ? `<button type="button" class="btn btn-sec btn-peq" data-ir-taller="${t.id}">Pasar lista</button>
          <button type="button" class="btn btn-sec btn-peq" data-ver-mes="${t.id}">Ver mes</button>` : ''}
          ${puede.admin() ? `<button type="button" class="btn btn-sec btn-peq" data-editar-taller="${t.id}">Editar</button>` : ''}
        </div>
      </article>`;
    }).join('')}</div>` : '<div class="vacio-grande">No tienes talleres asignados.</div>'}`;
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
    <li class="fila-click" data-usuario="${u.id}">
      <span class="avatar" style="--h:${tono(u.id)}" aria-hidden="true">${esc(iniciales(u.nombre || u.email))}</span>
      <div class="txt"><b>${esc(u.nombre || u.email)}${u.id === S.perfil.id ? ' <span class="muted">(tú)</span>' : ''}</b><small>${esc(u.email)}${u.rol === 'tallerista' ? ' · ' + (u.talleres.map(id => esc(taller(id)?.nombre || '')).join(', ') || 'sin talleres') : ''}</small></div>
      ${u.rol && u.activo ? `<span class="chip chip-rol-${u.rol}">${ROLES[u.rol]}</span>` : '<span class="chip chip-warn">Sin acceso</span>'}
    </li>`;
  el.innerHTML = `
    <section class="tarjeta">
      <h2><span>Cuentas del equipo</span><button type="button" class="btn btn-peq" data-accion="invitar">+ Invitar persona</button></h2>
      <p class="nota-suave">Cada persona recibe un correo para crear su contraseña. Los talleristas solo ven a quienes están inscritos en sus talleres y pasan lista en ellos. Las terapeutas ven todo el alumnado y sus datos de salud. El rol Equipo ve cumpleaños y talleres, sin fichas ni asistencia.</p>
      ${pendientes.length ? `<h3 class="sub">Esperando acceso</h3><ul class="lista">${pendientes.map(fila).join('')}</ul>` : ''}
      <h3 class="sub">Con acceso</h3>
      <ul class="lista">${activos.map(fila).join('')}</ul>
    </section>`;
}

/* ---------- Tienda ---------- */
const CATEGORIAS = { ropa: 'Ropa', accesorios: 'Accesorios', papeleria: 'Papelería' };
const pesos = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('es-CL');
const productosOrdenados = () => [...S.tienda.productos].sort((a, b) => (a.orden - b.orden) || a.nombre.localeCompare(b.nombre, 'es'));
const producto = id => S.tienda?.productos.find(p => p.id === id);

async function vistaTienda(el) {
  if (!puede.tienda()) { location.hash = 'panel'; return; }
  const cab = `
    <header class="cabecera">
      <div><p class="eyebrow">Dirección y equipo</p><h1>Tienda</h1><p>Lo que guardes aquí aparece al instante en la tienda pública.</p></div>
      <div class="controles">
        <a class="btn btn-sec" href="tienda/" target="_blank" rel="noopener">Ver la tienda ↗</a>
        ${S.tienda ? '<button type="button" class="btn" data-accion="nuevo-producto">+ Nuevo producto</button>' : ''}
      </div>
    </header>`;
  if (!S.tienda) {
    el.innerHTML = cab + '<section class="tarjeta"><p class="vacio">Cargando la tienda…</p></section>';
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
      ${lista.length ? `<ul class="lista productos">${lista.map((p, i) => `
        <li class="fila-click ${p.visible ? '' : 'oculto'}" data-producto="${p.id}">
          ${p.imagen ? `<img class="miniatura" src="${esc(p.imagen)}" alt="" loading="lazy">` : '<span class="miniatura vacia">Sin foto</span>'}
          <div class="txt"><b>${esc(p.nombre)}</b><small>${esc(CATEGORIAS[p.categoria] || '')}${p.precio != null ? ' · ' + esc(pesos(p.precio)) : ''}${p.variantes ? ' · ' + esc(p.variantes) : ''}</small></div>
          <span class="chips">${p.visible ? '' : '<span class="chip chip-neutro">Oculto</span>'}${p.agotado ? '<span class="chip chip-warn">Agotado</span>' : ''}${p.precio == null ? '<span class="chip chip-info">Sin precio</span>' : ''}</span>
          <span class="mover">
            <button type="button" data-mover-producto="${p.id}" data-dir="-1" aria-label="Subir ${esc(p.nombre)}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" data-mover-producto="${p.id}" data-dir="1" aria-label="Bajar ${esc(p.nombre)}" ${i === lista.length - 1 ? 'disabled' : ''}>↓</button>
          </span>
        </li>`).join('')}</ul>` : '<p class="vacio">Aún no hay productos. Crea el primero con «Nuevo producto».</p>'}
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
  if (src) img.src = src; else img.removeAttribute('src');
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
const TABLAS = { alumnos: 'ficha', alumnos_privado: 'datos privados de una ficha', inscripciones: 'inscripción', talleres: 'taller', taller_equipo: 'equipo de un taller', perfiles: 'cuenta', asistencia: 'asistencia', sesion: 'a la plataforma', tienda_productos: 'producto de la tienda', tienda_ajustes: 'contacto de la tienda' };
function detalleAuditoria(r) {
  const d = r.detalle || {};
  const partes = [];
  if (d.alumno) partes.push(d.alumno);
  if (d.taller) partes.push(d.taller);
  if (d.producto) partes.push(d.producto);
  if (d.email) partes.push(d.email);
  if (d.fecha) partes.push(`${fechaCorta(d.fecha)} · ${d.estado}${d.registros > 1 ? ` · ${d.registros} jóvenes` : ''}`);
  if (d.rol && r.tabla !== 'sesion') partes.push(ROLES[d.rol] || d.rol);
  if (d.rol && r.tabla === 'sesion') partes.push(`como ${ROLES[d.rol]}`);
  if (d.campos) partes.push(`cambió: ${d.campos.join(', ')}`);
  if (d.nota) partes.push(d.nota);
  return partes.join(' · ');
}
async function adminAuditoria(el) {
  el.innerHTML = '<section class="tarjeta"><p class="vacio">Cargando auditoría…</p></section>';
  try { S.auditoria = await D.auditoria(200); }
  catch (e) { el.innerHTML = `<section class="tarjeta"><p class="aviso-error">${esc(e.message)}</p></section>`; return; }
  if (ui.tabAdmin !== 'auditoria') return;
  el.innerHTML = `
    <section class="tarjeta">
      <h2><span>Últimos 200 cambios</span><button type="button" class="btn btn-sec btn-peq" data-tab-admin="auditoria">Actualizar</button></h2>
      <p class="nota-suave">La base de datos registra cada cambio automáticamente. Nadie puede editar ni borrar este historial desde la plataforma.</p>
      ${S.auditoria.length ? `<div class="tabla-scroll"><table class="tabla">
        <thead><tr><th scope="col">Cuándo</th><th scope="col">Quién</th><th scope="col">Qué</th><th scope="col">Detalle</th></tr></thead>
        <tbody>${S.auditoria.map(r => `<tr><td class="num nowrap">${esc(fechaHora(r.creado))}</td><td>${esc(r.actor_nombre)}</td><td>${esc(ACCIONES[r.accion] || r.accion)} ${esc(TABLAS[r.tabla] || r.tabla)}</td><td class="muted">${esc(detalleAuditoria(r))}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="vacio">Aún no hay cambios registrados.</p>'}
    </section>`;
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
  const toCorto = a.programa === 'Terapia Ocupacional' && a.talleres.length < 3;
  const fila = (k, v) => `<dt>${k}</dt><dd>${v || '<span class="muted">—</span>'}</dd>`;
  const copiable = v => v ? `<span class="copiable"><span>${esc(v)}</span><button type="button" class="copiar" data-copiar="${esc(v)}">Copiar</button></span>` : '';

  dlg.innerHTML = `
    <div class="ficha-cab">
      ${avatar(a, 'avatar-xl')}
      <div class="txt">
        <h2 id="ficha-titulo">${esc(nombreCompleto(a))}</h2>
        <div class="controles" style="gap:6px">
          <span class="chip chip-neutro">${edad(a.fechaNac)} años</span>
          <span class="chip chip-neutro">${esc(a.programa)}</span>
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
            ${fila(a.emergencia2 ? 'Emergencia 1' : 'Emergencia', esc(a.emergencia))}
            ${fila('Emergencia 2', esc(a.emergencia2))}
          </dl>
        </section>
        <section>
          <h3>Programa</h3>
          <dl class="dato">
            ${fila('Programa', esc(a.programa))}
            ${fila('Estado', ESTADO_ALUMNO[a.estado])}
            ${fila('Ingreso', esc(fechaCorta(a.fechaIngreso)))}
            ${fila('Entrevista', esc(fechaCorta(a.entrevista)))}
            ${fila('Beca', esc(a.beca))}
          </dl>
          <div class="talleres-mini">${a.talleres.map(tid => { const t = taller(tid); return t ? `<span class="tag">${punto(t)}${esc(t.nombre)} · ${t.dias.map(d => DIAS_CORTOS[d]).join('/')}</span>` : ''; }).join('')}</div>
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
          <dl class="dato" id="ficha-privado"><dt>Cargando…</dt><dd></dd></dl>
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
      if (box) box.innerHTML = fila('Medicación', esc(p.medicacion)) + fila('Observaciones', esc(p.observaciones));
    } catch (e) { const box = $('#ficha-privado'); if (box) box.innerHTML = `<dt>Error</dt><dd>${esc(e.message)}</dd>`; }
  }
}

/* ---------- formulario de ficha ---------- */
let editando = null;
const CAMPOS_FICHA = ['nombre', 'apellidos', 'apodo', 'pronombres', 'fechaNac', 'rut', 'programa', 'estado', 'fechaIngreso', 'entrevista', 'beca', 'tutorNombre', 'tutorRelacion', 'tutorTelefono', 'tutorEmail', 'emergencia', 'emergencia2', 'direccion', 'intereses', 'apoyos', 'alergias'];
async function abrirFormulario(id = null) {
  editando = id;
  const a = id ? alumno(id) : null;
  const form = $('#form-alumno');
  form.reset();
  $('#form-titulo').textContent = a ? `Editar ficha de ${nombreVisible(a)}` : 'Nueva ficha';
  $('#form-error').hidden = true;
  $('#f-talleres').innerHTML = S.talleres.filter(t => t.activo || a?.talleres.includes(t.id)).map(t => `<label><input type="checkbox" name="talleres" value="${t.id}" ${a?.talleres.includes(t.id) ? 'checked' : ''}>${punto(t)}${esc(t.nombre)}</label>`).join('') || '<p class="vacio">Primero crea un taller en la sección Talleres.</p>';
  for (const c of CAMPOS_FICHA) { const inp = $('#f-' + c); if (inp) inp.value = a ? (a[c] ?? '') : ''; }
  if (!a) { $('#f-programa').value = 'FormaPro'; $('#f-estado').value = 'activo'; $('#f-fechaIngreso').value = iso(hoy()); }
  $('#f-medicacion').value = ''; $('#f-observaciones').value = '';
  $('#f-privado').hidden = !puede.verTodo();
  $('#f-fechaNac').max = iso(hoy());
  mostrarEdad();
  avisoTO();
  if ($('#dlg-ficha').open) $('#dlg-ficha').close();
  $('#dlg-form').showModal();
  $('#f-nombre').focus();
  if (a && puede.verTodo()) {
    try { const p = await D.privado(a.id); $('#f-medicacion').value = p.medicacion; $('#f-observaciones').value = p.observaciones; }
    catch (e) { toast(`No se cargaron los datos privados. ${e.message}`, 'error'); }
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
$('#f-fechaNac').addEventListener('input', mostrarEdad);
$('#f-fechaNac').addEventListener('change', mostrarEdad);
// Requisito publicado en spectrumpro.cl para FormaPro y Terapia Ocupacional:
// al menos 3 módulos, uno de ellos de formación general
// (Referentes artístico-culturales, Habilidades para la vida o Arte Terapéutico).
const esFormacionGeneral = t => t.area === 'Formación general' || /referentes|habilidades para la vida|arte terap/i.test(t.nombre);
function avisoTO() {
  const prog = $('#f-programa').value;
  const aviso = $('#f-aviso-to');
  const elegidos = $$('#f-talleres input:checked').map(i => taller(i.value)).filter(Boolean);
  const faltan = [];
  if (elegidos.length < 3) faltan.push('al menos 3 módulos');
  if (S.talleres.some(esFormacionGeneral) && !elegidos.some(esFormacionGeneral)) faltan.push('uno de formación general');
  aviso.hidden = !(['FormaPro', 'Terapia Ocupacional'].includes(prog) && faltan.length);
  aviso.textContent = `${prog} pide ${faltan.join(' y ')} (Referentes culturales, Habilidades para la vida o Arte Terapia). También pide una entrevista previa.`;
}
$('#form-alumno').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const datos = {};
  for (const c of CAMPOS_FICHA) datos[c] = String(fd.get(c) ?? '').trim();
  datos.talleres = fd.getAll('talleres');
  const faltan = [];
  if (!datos.nombre) faltan.push('nombre');
  if (!datos.apellidos) faltan.push('apellidos');
  if (!datos.fechaNac) faltan.push('fecha de nacimiento');
  if (!datos.talleres.length) faltan.push('al menos un taller');
  const err = $('#form-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (faltan.length) return mostrar(`Completa: ${faltan.join(', ')}.`);
  if (datos.fechaNac > iso(hoy())) return mostrar('La fecha de nacimiento no puede ser futura.');
  if (datos.tutorEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.tutorEmail)) return mostrar('Revisa el correo de la persona responsable.');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    const id = await conCarga(async () => {
      const id = await D.guardarAlumno({ ...datos, id: editando });
      if (puede.verTodo()) await D.guardarPrivado(id, { medicacion: fd.get('medicacion'), observaciones: fd.get('observaciones') });
      return id;
    });
    const fila = { ...datos, id };
    const i = S.alumnos.findIndex(x => x.id === id);
    if (i >= 0) S.alumnos[i] = fila; else S.alumnos.push(fila);
    S.cumple = await D.cumpleanos();
    $('#dlg-form').close();
    toast(editando ? 'Ficha actualizada' : 'Ficha creada');
    render();
    abrirFicha(id);
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});

/* ---------- formulario de taller ---------- */
let editandoTaller = null;
function abrirTaller(id = null) {
  editandoTaller = id;
  const t = id ? taller(id) : null;
  $('#form-taller').reset();
  $('#taller-titulo').textContent = t ? `Editar ${t.nombre}` : 'Nuevo taller';
  $('#taller-error').hidden = true;
  $('#t-nombre').value = t?.nombre || '';
  $('#t-area').value = t?.area || '';
  $('#t-color').value = color(t?.color);
  $('#t-horaInicio').value = t?.horaInicio || '';
  $('#t-horaFin').value = t?.horaFin || '';
  $('#t-encargado').value = t?.encargado || '';
  $('#t-activo').checked = t ? t.activo : true;
  $('#t-dias').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" name="dias" value="${d}" ${t?.dias.includes(d) ? 'checked' : ''}>${DIAS_CORTOS[d]}</label>`).join('');
  const equipo = S.usuarios.filter(u => u.rol === 'tallerista');
  $('#t-equipo').innerHTML = equipo.length ? equipo.map(u => `<label><input type="checkbox" name="equipo" value="${u.id}" ${t?.equipo.includes(u.id) ? 'checked' : ''}>${esc(u.nombre || u.email)}${u.activo ? '' : ' <span class="muted">(inactiva)</span>'}</label>`).join('') : '<p class="nota-suave">Aún no hay talleristas. Invítalas desde Administración. Dirección y terapeutas pueden pasar lista en todos los talleres.</p>';
  $('#t-eliminar').hidden = !t;
  $('#dlg-taller').showModal();
  $('#t-nombre').focus();
}
$('#form-taller').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const t = {
    id: editandoTaller, nombre: String(fd.get('nombre')).trim(), area: String(fd.get('area')).trim(), color: fd.get('color'),
    horaInicio: fd.get('horaInicio'), horaFin: fd.get('horaFin'), encargado: String(fd.get('encargado')).trim(),
    activo: $('#t-activo').checked, dias: fd.getAll('dias').map(Number), equipo: fd.getAll('equipo'),
    orden: editandoTaller ? taller(editandoTaller).orden : S.talleres.length + 1,
  };
  const err = $('#taller-error');
  const mostrar = m => { err.textContent = m; err.hidden = false; };
  if (!t.nombre) return mostrar('Escribe el nombre del taller.');
  if (!t.dias.length) return mostrar('Elige al menos un día de la semana.');
  if (t.horaInicio && t.horaFin && t.horaFin <= t.horaInicio) return mostrar('La hora de término debe ser posterior a la de inicio.');
  const btn = ev.submitter;
  botonOcupado(btn, true);
  try {
    await conCarga(() => D.guardarTaller(t));
    S.talleres = await D.talleres();
    $('#dlg-taller').close();
    toast(editandoTaller ? 'Taller actualizado' : 'Taller creado');
    render();
  } catch (e) { mostrar(e.message); }
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
  $('#u-activo').checked = u ? (u.rol ? u.activo : true) : true;
  $('#u-activo-box').hidden = !u;
  $('#u-nota').hidden = !!u;
  $('#u-guardar').textContent = u ? 'Guardar cambios' : 'Enviar invitación';
  $('#u-eliminar').hidden = !u || u.id === S.perfil.id;
  $('#u-talleres').innerHTML = S.talleres.filter(t => t.activo).map(t => `<label><input type="checkbox" name="talleres" value="${t.id}" ${u?.talleres.includes(t.id) ? 'checked' : ''}>${punto(t)}${esc(t.nombre)}</label>`).join('');
  mostrarTalleresUsuario();
  $('#dlg-usuario').showModal();
  $('#u-nombre').focus();
}
const mostrarTalleresUsuario = () => { $('#u-talleres-box').hidden = $('#u-rol').value !== 'tallerista'; };
$('#u-rol').addEventListener('change', mostrarTalleresUsuario);
$('#form-usuario').addEventListener('submit', async ev => {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const datos = { nombre: String(fd.get('nombre')).trim(), email: $('#u-email').value.trim().toLowerCase(), rol: fd.get('rol'), activo: $('#u-activo').checked, talleres: fd.getAll('talleres'), fechaNac: String(fd.get('fechaNac') || '') };
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
    await conCarga(() => editandoUsuario ? D.actualizarUsuario(editandoUsuario, datos) : D.invitar(datos));
    [S.usuarios, S.talleres, S.cumpleEquipo] = await Promise.all([D.usuarios(), D.talleres(), D.cumpleanosEquipo()]);
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
    await intentar(() => D.eliminarUsuario(u.id), 'Cuenta eliminada');
    [S.usuarios, S.talleres, S.cumpleEquipo] = await Promise.all([D.usuarios(), D.talleres(), D.cumpleanosEquipo()]);
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
    await conCarga(() => D.guardarMiFechaNac(fecha));
    S.perfil.fechaNac = fecha;
    [S.cumpleEquipo, S.usuarios] = await Promise.all([D.cumpleanosEquipo(), puede.admin() ? D.usuarios() : Promise.resolve([])]);
    $('#dlg-mi-cumple').close();
    toast(fecha ? 'Fecha de nacimiento guardada' : 'Fecha de nacimiento borrada');
    render();
  } catch (e) { mostrar(e.message); }
  finally { botonOcupado(btn, false); }
});

/* ---------- exportar ---------- */
function exportarFichas() {
  const cols = [['Nombre', 'nombre'], ['Apellidos', 'apellidos'], ['Nombre preferido', 'apodo'], ['Pronombres', 'pronombres'], ['Fecha de nacimiento', 'fechaNac'], ['RUT', 'rut'], ['Programa', 'programa'], ['Estado', a => ESTADO_ALUMNO[a.estado]], ['Talleres', a => a.talleres.map(id => taller(id)?.nombre).join(' | ')], ['Beca', 'beca'], ['Ingreso', 'fechaIngreso'], ['Responsable', 'tutorNombre'], ['Parentesco', 'tutorRelacion'], ['Teléfono', 'tutorTelefono'], ['Correo', 'tutorEmail'], ['Emergencia 1', 'emergencia'], ['Emergencia 2', 'emergencia2'], ['Dirección', 'direccion'], ['Alergias', 'alergias'], ['Intereses', 'intereses'], ['Apoyos', 'apoyos'], ['% asistencia (historial cargado)', a => resumen(registros({ alumno: a.id })).pct ?? '']];
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
const VISTAS = { panel: vistaPanel, asistencia: vistaAsistencia, cumpleanos: vistaCumpleanos, alumnos: vistaAlumnos, talleres: vistaTalleres, tienda: vistaTienda, administracion: vistaAdministracion };
// js/posts.js agrega VISTAS.posts (Estudio de posts, solo dirección).
function vistaActual() {
  const v = location.hash.slice(1);
  if (!VISTAS[v]) return 'panel';
  if ((v === 'administracion' || v === 'posts') && !puede.admin()) return 'panel';
  if (v === 'tienda' && !puede.tienda()) return 'panel';
  if (puede.esEquipo() && (v === 'asistencia' || v === 'alumnos')) return 'panel';
  return v;
}
let vistaPintada = null;
function render() {
  if (!S.perfil) return;
  const v = vistaActual();
  $$('.nav a').forEach(a => a.dataset.vista === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  const caja = $('#vista');
  VISTAS[v](caja);
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
    try { await D.entrarDemo(x.dataset.demoRol); if (!location.hash) location.hash = 'panel'; await iniciarSesion(); }
    catch (e) { toast(e.message, 'error'); }
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
  if ((x = el('[data-editar-taller]'))) { abrirTaller(x.dataset.editarTaller); return; }
  if ((x = el('[data-mover-producto]'))) { moverProducto(x.dataset.moverProducto, Number(x.dataset.dir)); return; }
  if ((x = el('[data-producto]'))) { abrirProducto(x.dataset.producto); return; }
  if ((x = el('[data-usuario]'))) { abrirUsuario(x.dataset.usuario); return; }
  if ((x = el('[data-tab-admin]'))) { ui.tabAdmin = x.dataset.tabAdmin; render(); return; }
  if ((x = el('[data-tab-cumple]'))) { ui.tabCumple = x.dataset.tabCumple; render(); return; }
  if ((x = el('[data-modo]'))) { ui.modoAsis = x.dataset.modo; render(); return; }
  if ((x = el('[data-taller]'))) { ui.taller = x.dataset.taller; render(); return; }
  if ((x = el('.seg button'))) { marcar(x.closest('.seg').dataset.alumno, x.dataset.e, x.closest('.seg')); return; }
  if (t.id === 'todos-presentes') {
    const { fecha, taller: tid } = ui;
    const reg = S.asistencia[fecha]?.[tid] || {};
    const pend = inscritosActivos(tid).filter(a => !reg[a.id]).map(a => a.id);
    if (!pend.length) { toast('No había pendientes'); return; }
    try {
      await intentar(() => D.marcar(fecha, tid, pend, 'P'), `${pend.length} marcados como presentes`);
      fijarLocal(fecha, tid, pend, 'P'); render();
    } catch { /* ya avisado */ }
    return;
  }
  if ((x = el('[data-accion]'))) {
    const acc = x.dataset.accion;
    if (acc === 'olvide') { $('#recuperar-email').value = $('#entrar-email').value; $('#recuperar-info').hidden = true; mostrarAcceso('recuperar'); }
    if (acc === 'volver-entrar') mostrarAcceso('entrar');
    if (acc === 'salir') {
      await D.salir();
      S.perfil = null; S.tienda = null;
      mostrarAcceso('entrar');
    }
    if (acc === 'mi-cumple') abrirMiCumple();
    if (acc === 'nueva-ficha') abrirFormulario();
    if (acc === 'nuevo-taller') abrirTaller();
    if (acc === 'invitar') abrirUsuario();
    if (acc === 'nuevo-producto') abrirProducto();
    if (acc === 'exportar-fichas') exportarFichas();
    if (acc === 'exportar-asistencia') exportarAsistencia();
    if (acc === 'restablecer-demo' && await confirmar('¿Restablecer la demostración?', 'Se borran los cambios hechos en este navegador y se cargan de nuevo los datos ficticios.', 'Restablecer')) {
      await D.restablecer(); await cargarTodo(); toast('Demostración restablecida');
    }
  }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'asis-fecha' && t.value) { ui.fecha = t.value; ui.taller = null; render(); }
  if (t.id === 'asis-otro' && t.value) { ui.taller = t.value; render(); }
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
  if (ev.target.id === 'buscar') { ui.busqueda = ev.target.value; pintarFichas(); }
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
