'use strict';
/* SpectrumPro · Gestión de alumnado (prototipo)
   Todo vive en el navegador (localStorage). Ver README para el modelo de datos. */

const CLAVE = 'spectrumpro:alumnado:v1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const ESTADOS = {
  P: { label: 'Presente', chip: 'chip-ok' },
  R: { label: 'Retraso', chip: 'chip-warn' },
  A: { label: 'Ausente', chip: 'chip-bad' },
  J: { label: 'Justificada', chip: 'chip-info' },
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/* ---------- fechas ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const deISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fechaLarga = d => `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
const fechaCorta = s => { if (!s) return '—'; const d = deISO(s); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

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

/* ---------- utilidades ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const nombreVisible = a => a.apodo ? `${a.apodo} ${a.apellidos.split(' ')[0]}` : `${a.nombre} ${a.apellidos.split(' ')[0]}`;
const nombreCompleto = a => `${a.nombre} ${a.apellidos}`;
const iniciales = a => ((a.apodo || a.nombre)[0] + (a.apellidos[0] || '')).toUpperCase();
const tono = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = (a, extra = '') => `<span class="avatar ${extra}" style="--h:${tono(a.id)}" aria-hidden="true">${esc(iniciales(a))}</span>`;
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- datos de ejemplo ---------- */
const TALLERES_BASE = [
  { id: 'lab', nombre: 'Laboratorio Creativo', area: 'Arte y Apoyo', dias: [2], horario: '16:00 – 17:30', encargado: 'Equipo Arte y Apoyo', color: '#635CC7' },
  { id: 'anim', nombre: 'Animación Digital', area: 'Centro de Formación', dias: [1, 3], horario: '15:00 – 17:00', encargado: 'Encargado de Animación Digital', color: '#31B4E7' },
  { id: 'dibujo', nombre: 'Dibujo e Ilustración', area: 'Centro de Formación', dias: [2, 4], horario: '15:00 – 16:30', encargado: 'Encargada de Dibujo e Ilustración', color: '#E65EBE' },
  { id: 'teatro', nombre: 'Teatro', area: 'Centro de Formación', dias: [4], horario: '16:30 – 18:00', encargado: 'Encargado de Teatro', color: '#F8384B' },
  { id: 'titeres', nombre: 'Títeres y TV', area: 'Centro de Formación', dias: [5], horario: '15:00 – 17:00', encargado: 'Equipo de Títeres y TV', color: '#E0B800' },
  { id: 'video', nombre: 'Videojuegos', area: 'Centro de Formación', dias: [3], horario: '17:00 – 18:30', encargado: 'Encargado de Videojuegos', color: '#00BC70' },
  { id: 'cocina', nombre: 'Habilidades para la vida diaria con Cocina', area: 'Terapia Ocupacional', dias: [1], horario: '11:00 – 12:30', encargado: 'Terapeuta ocupacional', color: '#2a9d8f', general: true },
  { id: 'vellon', nombre: 'Cuentos con Vellón', area: 'Terapia Ocupacional', dias: [5], horario: '11:00 – 12:30', encargado: 'Terapeuta ocupacional', color: '#9b6ad6' },
];

function crearEjemplo() {
  const rnd = mulberry32(1710);
  const t = hoy();
  // [nombre, apellidos, apodo, pronombres, programa, talleres, offsetCumple|[mes,dia], edad, beca]
  const filas = [
    ['Matías', 'Rojas Fuentes', '', 'él', 'FormaPro', ['anim', 'video', 'dibujo'], 3, 19, 'Beca parcial'],
    ['Antonia', 'Silva Paredes', 'Anto', 'ella', 'FormaPro', ['dibujo', 'teatro'], 9, 22, ''],
    ['Benjamín', 'Muñoz Tapia', 'Benja', 'él', 'Talleres', ['video', 'anim'], 17, 17, ''],
    ['Josefa', 'Contreras Vidal', '', 'ella', 'Arte Terapia', ['lab', 'dibujo'], 26, 24, 'Arancel diferenciado'],
    ['Tomás', 'Herrera Lagos', '', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'titeres'], 0, 21, 'Beca completa'],
    ['Florencia', 'Soto Araya', 'Flo', 'ella', 'FormaPro', ['teatro', 'titeres'], [2, 14], 20, ''],
    ['Vicente', 'Pérez Morales', '', 'él', 'Talleres', ['anim'], [3, 3], 16, ''],
    ['Isidora', 'González Pinto', 'Isi', 'ella', 'Arte Terapia', ['lab'], [4, 21], 18, 'Beca parcial'],
    ['Agustín', 'Díaz Navarro', '', 'él', 'FormaPro', ['video', 'anim', 'teatro'], [5, 8], 23, ''],
    ['Martina', 'Castro Reyes', 'Marti', 'elle', 'Talleres', ['dibujo', 'lab'], [6, 30], 19, ''],
    ['Cristóbal', 'Vargas Espinoza', 'Cris', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'lab'], [7, 12], 25, 'Beca completa'],
    ['Emilia', 'Fernández Bravo', '', 'ella', 'FormaPro', ['titeres', 'teatro', 'dibujo'], [8, 5], 22, ''],
    ['Lucas', 'Torres Olivares', '', 'él', 'Talleres', ['video'], [9, 18], 15, ''],
    ['Catalina', 'Ramírez Lillo', 'Cata', 'ella', 'Arte Terapia', ['lab', 'titeres'], [1, 27], 20, 'Arancel diferenciado'],
  ];
  const intereses = ['Animación 2D y cómics', 'Dibujo de personajes, anime', 'Edición de video, videojuegos indie', 'Pintura, música', 'Cocina, títeres', 'Actuación y voz', 'Stop motion', 'Fotografía', 'Modelado 3D, Minecraft', 'Ilustración digital', 'Guion y escritura', 'Teatro, improvisación', 'Programación de juegos', 'Doblaje y locución'];
  const apoyos = [
    'Anticipar cambios de sala o de horario con un aviso previo.',
    'Puede usar audífonos con cancelación de ruido durante el trabajo individual.',
    'Prefiere instrucciones por escrito además de verbales.',
    'Necesita pausas sensoriales cortas; usa la sala tranquila.',
    'Funciona mejor en grupos pequeños y con un rol definido.',
    'Agenda visual al inicio de cada sesión.',
  ];
  const parentesco = ['Madre', 'Padre', 'Madre', 'Tutora legal', 'Padre', 'Madre', 'Abuela'];
  const comunas = ['Providencia', 'Ñuñoa', 'Las Condes', 'Santiago Centro', 'La Reina', 'Macul', 'San Miguel'];
  const responsables = ['Carolina', 'Rodrigo', 'Paula', 'Andrea', 'Felipe', 'Claudia', 'Marcela'];

  const alumnos = filas.map((f, i) => {
    const [nombre, apellidos, apodo, pronombres, programa, talleres, cumple, años, beca] = f;
    let mes, dia;
    if (Array.isArray(cumple)) { mes = (t.getMonth() + cumple[0]) % 12; dia = cumple[1]; }
    else { const c = sumarDias(t, cumple); mes = c.getMonth(); dia = c.getDate(); }
    const nac = new Date(t.getFullYear() - años, mes, dia);
    const ap1 = apellidos.split(' ')[0];
    const resp = responsables[i % responsables.length];
    const ingreso = sumarDias(t, -Math.floor(60 + rnd() * 600));
    return {
      id: 'a' + (i + 1),
      nombre, apellidos, apodo, pronombres,
      fechaNac: iso(nac),
      rut: `${20 + Math.floor(rnd() * 6)}.${100 + Math.floor(rnd() * 899)}.${100 + Math.floor(rnd() * 899)}-${Math.floor(rnd() * 10)}`,
      programa, talleres, beca,
      fechaIngreso: iso(ingreso),
      entrevista: iso(sumarDias(ingreso, -12)),
      tutorNombre: `${resp} ${ap1}`,
      tutorRelacion: parentesco[i % parentesco.length],
      tutorTelefono: `+56 9 ${Math.floor(1000 + rnd() * 8999)} ${Math.floor(1000 + rnd() * 8999)}`,
      tutorEmail: `${resp.toLowerCase()}.${ap1.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@ejemplo.cl`,
      emergencia: `${responsables[(i + 3) % responsables.length]} ${ap1} · +56 9 ${Math.floor(1000 + rnd() * 8999)} ${Math.floor(1000 + rnd() * 8999)}`,
      direccion: comunas[i % comunas.length],
      intereses: intereses[i % intereses.length],
      apoyos: apoyos[i % apoyos.length],
      alergias: i % 5 === 0 ? 'Frutos secos' : (i % 7 === 3 ? 'Lactosa' : ''),
      medicacion: '',
      observaciones: '',
    };
  });

  // Asistencia de las últimas 6 semanas para cada sesión programada (sin incluir hoy)
  const asistencia = {};
  const bajos = new Set(['a4', 'a13']);
  for (let k = 42; k >= 1; k--) {
    const d = sumarDias(t, -k);
    const f = iso(d);
    for (const tal of TALLERES_BASE) {
      if (!tal.dias.includes(d.getDay())) continue;
      const reg = {};
      for (const a of alumnos) {
        if (!a.talleres.includes(tal.id) || a.fechaIngreso > f) continue;
        const r = rnd();
        const pa = bajos.has(a.id) ? 0.3 : 0.07;
        reg[a.id] = r < pa ? 'A' : r < pa + 0.05 ? 'J' : r < pa + 0.12 ? 'R' : 'P';
      }
      if (Object.keys(reg).length) (asistencia[f] ??= {})[tal.id] = reg;
    }
  }
  return { version: 1, demo: true, talleres: structuredClone(TALLERES_BASE), alumnos, asistencia };
}

/* ---------- almacenamiento ---------- */
let estado;
function cargar() {
  try { const raw = localStorage.getItem(CLAVE); if (raw) return JSON.parse(raw); } catch { /* sin almacenamiento */ }
  return null;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
}
estado = cargar() || crearEjemplo();

const taller = id => estado.talleres.find(t => t.id === id);
const alumno = id => estado.alumnos.find(a => a.id === id);
const ordenarAlumnos = arr => [...arr].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), 'es'));

/* ---------- cálculos de asistencia ---------- */
function registros(filtro = {}) {
  // devuelve [{fecha, taller, alumno, e}]
  const out = [];
  for (const [fecha, porTaller] of Object.entries(estado.asistencia)) {
    if (filtro.desde && fecha < filtro.desde) continue;
    if (filtro.hasta && fecha > filtro.hasta) continue;
    for (const [tid, reg] of Object.entries(porTaller)) {
      if (filtro.taller && tid !== filtro.taller) continue;
      for (const [aid, e] of Object.entries(reg)) {
        if (filtro.alumno && aid !== filtro.alumno) continue;
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

/* ---------- UI general ---------- */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2200);
}
function confirmar(texto, etiqueta = 'Confirmar') {
  const dlg = $('#dlg-confirmar');
  $('#conf-texto').textContent = texto;
  $('#conf-si').textContent = etiqueta;
  dlg.showModal();
  return new Promise(res => {
    const fin = v => { dlg.close(); $('#conf-si').onclick = $('#conf-no').onclick = null; res(v); };
    $('#conf-si').onclick = () => fin(true);
    $('#conf-no').onclick = () => fin(false);
    dlg.oncancel = () => fin(false);
  });
}
function descargar(nombre, contenido, tipo) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- vistas ---------- */
const ui = {
  fecha: iso(hoy()),
  taller: null,
  modoAsis: 'lista',
  mes: iso(hoy()).slice(0, 7),
  tallerMes: null,
  busqueda: '',
  filtroTaller: '',
  filtroPrograma: '',
};

function vistaPanel(el) {
  const t = hoy(), f = iso(t);
  const activos = estado.alumnos.length;
  const sesionesHoy = estado.talleres.filter(x => x.dias.includes(t.getDay()));
  const r30 = resumen(registros({ desde: hace30() }));
  const proximos = estado.alumnos.map(a => ({ a, ...proximoCumple(a.fechaNac, t) })).filter(x => x.dias <= 30).sort((x, y) => x.dias - y.dias);
  const cumpleMes = estado.alumnos.filter(a => deISO(a.fechaNac).getMonth() === t.getMonth()).length;
  const alerta = ordenarAlumnos(estado.alumnos)
    .map(a => ({ a, r: resumen(registros({ alumno: a.id, desde: hace30() })) }))
    .filter(x => x.r.pct != null && x.r.pct < 75).sort((x, y) => x.r.pct - y.r.pct);

  // asistencia por semana (últimas 6)
  const semanas = [];
  for (let w = 5; w >= 0; w--) {
    const fin = sumarDias(t, -w * 7), ini = sumarDias(fin, -6);
    const r = resumen(registros({ desde: iso(ini), hasta: iso(fin) }));
    semanas.push({ etq: `${ini.getDate()}/${ini.getMonth() + 1}`, pct: r.pct, total: r.total });
  }

  el.innerHTML = `
    <header class="cabecera">
      <div>
        <p class="eyebrow">${esc(fechaLarga(t))}</p>
        <h1>Hola, equipo SpectrumPro</h1>
        <p>Resumen de asistencia, cumpleaños y alertas del alumnado.</p>
      </div>
      <a class="btn" href="#asistencia">Pasar lista de hoy</a>
    </header>

    <section class="kpis" aria-label="Indicadores">
      <div class="kpi"><span class="kpi-valor">${activos}</span><span class="kpi-etq">Jóvenes inscritos</span></div>
      <div class="kpi"><span class="kpi-valor">${sesionesHoy.length}</span><span class="kpi-etq">Sesiones de taller hoy</span></div>
      <div class="kpi"><span class="kpi-valor">${r30.pct ?? '—'}${r30.pct != null ? '<small style="font-size:1rem">%</small>' : ''}</span><span class="kpi-etq">Asistencia últimos 30 días</span></div>
      <div class="kpi"><span class="kpi-valor">${cumpleMes}</span><span class="kpi-etq">Cumpleaños en ${MESES[t.getMonth()]}</span></div>
    </section>

    <div class="rejilla">
      <section class="tarjeta">
        <h2>Sesiones de hoy <small>${DIAS[t.getDay()]}</small></h2>
        ${sesionesHoy.length ? sesionesHoy.map(s => {
          const ins = estado.alumnos.filter(a => a.talleres.includes(s.id)).length;
          const reg = Object.keys(estado.asistencia[f]?.[s.id] || {}).length;
          const pct = ins ? Math.round(reg / ins * 100) : 0;
          return `<div class="sesion">
            <span class="punto" style="--c:${s.color}"></span>
            <div class="txt"><b>${esc(s.nombre)}</b><small>${esc(s.horario)} · ${ins} inscritos</small>
              <div class="barra" style="margin-top:6px" role="img" aria-label="${reg} de ${ins} con asistencia registrada"><span style="width:${pct}%"></span></div></div>
            ${reg >= ins && ins ? '<span class="chip chip-ok">Lista pasada</span>' : `<button class="btn btn-sec btn-peq" data-ir-taller="${s.id}">Pasar lista</button>`}
          </div>`;
        }).join('') : '<p class="vacio">Hoy no hay talleres programados.</p>'}
      </section>

      <section class="tarjeta">
        <h2>Próximos cumpleaños <small>30 días</small></h2>
        ${proximos.length ? `<ul class="lista">${proximos.slice(0, 6).map(x => `
          <li class="fila-click" data-ficha="${x.a.id}">
            ${avatar(x.a)}
            <div class="txt"><b>${esc(nombreVisible(x.a))}</b><small>${x.fecha.getDate()} de ${MESES[x.fecha.getMonth()]} · cumple ${x.cumple}</small></div>
            <span class="dias">${x.dias === 0 ? '¡Hoy!' : x.dias}<small>${x.dias === 0 ? '' : x.dias === 1 ? 'día' : 'días'}</small></span>
          </li>`).join('')}</ul>` : '<p class="vacio">Nadie cumple años en los próximos 30 días.</p>'}
      </section>

      <section class="tarjeta">
        <h2>Asistencia semanal <small>% presentes + retrasos</small></h2>
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

function vistaAsistencia(el) {
  const d = deISO(ui.fecha);
  const delDia = estado.talleres.filter(x => x.dias.includes(d.getDay()));
  if (!ui.taller || !taller(ui.taller)) ui.taller = (delDia[0] || estado.talleres[0])?.id || null;
  if (!ui.tallerMes || !taller(ui.tallerMes)) ui.tallerMes = ui.taller;

  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">Registro por sesión de taller</p><h1>Asistencia</h1></div>
      <div class="pestanas" role="group" aria-label="Modo">
        <button type="button" data-modo="lista" aria-pressed="${ui.modoAsis === 'lista'}">Pasar lista</button>
        <button type="button" data-modo="mes" aria-pressed="${ui.modoAsis === 'mes'}">Resumen mensual</button>
      </div>
    </header>
    <div id="asis-cuerpo" style="display:flex;flex-direction:column;gap:20px"></div>`;
  const cuerpo = $('#asis-cuerpo', el);
  ui.modoAsis === 'lista' ? pasarLista(cuerpo) : resumenMensual(cuerpo);
}

function pasarLista(el) {
  const d = deISO(ui.fecha);
  const delDia = estado.talleres.filter(x => x.dias.includes(d.getDay()));
  const otros = estado.talleres.filter(x => !x.dias.includes(d.getDay()));
  const tal = taller(ui.taller);
  const inscritos = tal ? ordenarAlumnos(estado.alumnos.filter(a => a.talleres.includes(tal.id))) : [];
  const reg = (tal && estado.asistencia[ui.fecha]?.[tal.id]) || {};
  const futuro = ui.fecha > iso(hoy());

  el.innerHTML = `
    <section class="tarjeta" style="display:flex;flex-direction:column;gap:14px">
      <div class="controles">
        <label class="campo-inline" for="asis-fecha">Fecha<input type="date" id="asis-fecha" value="${ui.fecha}"></label>
        <label class="campo-inline" for="asis-otro">Otro taller
          <select id="asis-otro"><option value="">Elegir…</option>${otros.map(o => `<option value="${o.id}" ${o.id === ui.taller ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
        </label>
      </div>
      <div>
        <p class="eyebrow" style="margin-bottom:8px">Talleres del ${esc(fechaLarga(d))}</p>
        <div class="tallerdia">${delDia.length ? delDia.map(x => `<button type="button" data-taller="${x.id}" aria-pressed="${x.id === ui.taller}"><span class="punto" style="--c:${x.color}"></span>${esc(x.nombre)} <small>${esc(x.horario)}</small></button>`).join('') : '<p class="vacio" style="padding:0">No hay talleres programados este día. Puedes elegir otro taller arriba.</p>'}</div>
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
          <div class="txt"><b class="fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</b><small>${esc(a.programa)}${a.pronombres ? ' · ' + esc(a.pronombres) : ''}</small></div>
          <div class="seg" role="group" aria-label="Asistencia de ${esc(nombreVisible(a))}" data-alumno="${a.id}">
            ${Object.entries(ESTADOS).map(([k, v]) => `<button type="button" data-e="${k}" aria-pressed="${reg[a.id] === k}" title="${v.label}" ${futuro ? 'disabled' : ''}><span class="lbl-corto">${k}</span><span class="lbl-largo">${v.label}</span></button>`).join('')}
          </div>
        </li>`).join('')}</ul>` : '<p class="vacio">Nadie está inscrito en este taller. Inscribe jóvenes desde su ficha.</p>'}
    </section>` : ''}`;
  pintarResumenLista();
}

function pintarResumenLista() {
  const box = $('#asis-resumen'); if (!box) return;
  const ins = estado.alumnos.filter(a => a.talleres.includes(ui.taller));
  const reg = estado.asistencia[ui.fecha]?.[ui.taller] || {};
  const c = { P: 0, R: 0, A: 0, J: 0 };
  for (const a of ins) if (reg[a.id]) c[reg[a.id]]++;
  const pend = ins.length - c.P - c.R - c.A - c.J;
  box.innerHTML = Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${c[k]} ${v.label.toLowerCase()}</span>`).join('')
    + `<span class="chip chip-neutro">${pend} pendientes</span>`;
}

function marcar(alumnoId, e) {
  const dia = (estado.asistencia[ui.fecha] ??= {});
  const reg = (dia[ui.taller] ??= {});
  if (reg[alumnoId] === e) delete reg[alumnoId]; else reg[alumnoId] = e;
  if (!Object.keys(reg).length) delete dia[ui.taller];
  if (!Object.keys(dia).length) delete estado.asistencia[ui.fecha];
  guardar();
}

function resumenMensual(el) {
  const [y, m] = ui.mes.split('-').map(Number);
  const tal = taller(ui.tallerMes);
  const limite = iso(hoy());
  const fechas = [];
  if (tal) for (let d = new Date(y, m - 1, 1); d.getMonth() === m - 1; d = sumarDias(d, 1)) {
    const f = iso(d);
    if (f > limite) break;
    if (tal.dias.includes(d.getDay()) || estado.asistencia[f]?.[tal.id]) fechas.push(d);
  }
  const ins = tal ? ordenarAlumnos(estado.alumnos.filter(a => a.talleres.includes(tal.id))) : [];
  el.innerHTML = `
    <section class="tarjeta" style="display:flex;flex-direction:column;gap:16px">
      <div class="controles">
        <label class="campo-inline" for="mes-mes">Mes<input type="month" id="mes-mes" value="${ui.mes}"></label>
        <label class="campo-inline" for="mes-taller">Taller
          <select id="mes-taller">${estado.talleres.map(o => `<option value="${o.id}" ${o.id === ui.tallerMes ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
        </label>
        <div class="leyenda" style="margin-left:auto">${Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${k} · ${v.label}</span>`).join('')}</div>
      </div>
      ${!tal ? '<p class="vacio">Aún no hay talleres.</p>' : !fechas.length ? '<p class="vacio">No hay sesiones registradas en este mes.</p>' : `
      <div class="tabla-scroll">
        <table class="matriz">
          <thead><tr><th class="nom" scope="col">Joven</th>${fechas.map(d => `<th scope="col">${DIAS_CORTOS[d.getDay()]}<br>${d.getDate()}</th>`).join('')}<th scope="col">Asist.</th></tr></thead>
          <tbody>${ins.map(a => {
            let p = 0, n = 0;
            const celdas = fechas.map(d => {
              const e = estado.asistencia[iso(d)]?.[tal.id]?.[a.id];
              if (e) { n++; if (e === 'P' || e === 'R') p++; }
              return `<td class="c ${e ? 'c-' + e : ''}" title="${e ? ESTADOS[e].label : 'Sin registro'}">${e || '·'}</td>`;
            }).join('');
            const pct = n ? Math.round(p / n * 100) : null;
            return `<tr><td class="nom fila-click" data-ficha="${a.id}">${esc(nombreVisible(a))}</td>${celdas}<td class="pct">${pct == null ? '—' : pct + '%'}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>`}
    </section>`;
}

function vistaCumpleanos(el) {
  const t = hoy();
  const lista = estado.alumnos.map(a => ({ a, ...proximoCumple(a.fechaNac, t) }));
  const deHoy = lista.filter(x => x.dias === 0);
  const prox = lista.filter(x => x.dias > 0 && x.dias <= 30).sort((x, y) => x.dias - y.dias);
  const meses = Array.from({ length: 12 }, (_, i) => (t.getMonth() + i) % 12);

  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${estado.alumnos.length} jóvenes</p><h1>Cumpleaños</h1><p>Ordenados desde este mes. Haz clic en un nombre para abrir su ficha.</p></div>
    </header>
    ${deHoy.map(x => `<div class="hoy-cumple">${avatar(x.a, 'avatar-xl')}<div><p class="eyebrow">Hoy, ${esc(fechaLarga(t))}</p><b>${esc(nombreCompleto(x.a))} cumple ${x.cumple} años</b></div><button class="btn btn-sec btn-peq" data-ficha="${x.a.id}" style="margin-left:auto">Ver ficha</button></div>`).join('')}
    <section class="tarjeta">
      <h2>Próximos 30 días <small>${prox.length} ${prox.length === 1 ? 'cumpleaños' : 'cumpleaños'}</small></h2>
      ${prox.length ? `<ul class="lista">${prox.map(x => `
        <li class="fila-click" data-ficha="${x.a.id}">
          ${avatar(x.a)}
          <div class="txt"><b>${esc(nombreCompleto(x.a))}</b><small>${esc(fechaLarga(x.fecha))} · cumple ${x.cumple} · ${x.a.talleres.map(id => esc(taller(id)?.nombre || '')).join(', ')}</small></div>
          <span class="dias">${x.dias}<small>${x.dias === 1 ? 'día' : 'días'}</small></span>
        </li>`).join('')}</ul>` : '<p class="vacio">No hay cumpleaños en los próximos 30 días.</p>'}
    </section>
    <section class="meses" aria-label="Cumpleaños por mes">
      ${meses.map((m, i) => {
        const delMes = estado.alumnos.filter(a => deISO(a.fechaNac).getMonth() === m).sort((a, b) => deISO(a.fechaNac).getDate() - deISO(b.fechaNac).getDate());
        return `<div class="mes ${i === 0 ? 'actual' : ''}">
          <h3>${MESES[m]} <small>${delMes.length || ''}</small></h3>
          ${delMes.length ? `<ul>${delMes.map(a => {
            const pc = proximoCumple(a.fechaNac, t);
            return `<li data-ficha="${a.id}"><span class="d">${deISO(a.fechaNac).getDate()}</span><span class="n">${esc(nombreVisible(a))}</span><span class="e">${pc.cumple} años</span></li>`;
          }).join('')}</ul>` : '<p class="vacio" style="padding:0">Sin cumpleaños</p>'}
        </div>`;
      }).join('')}
    </section>`;
}

function vistaAlumnos(el) {
  const q = ui.busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtrados = ordenarAlumnos(estado.alumnos).filter(a =>
    (!q || norm(`${a.nombre} ${a.apellidos} ${a.apodo} ${a.tutorNombre} ${a.rut}`).includes(q)) &&
    (!ui.filtroTaller || a.talleres.includes(ui.filtroTaller)) &&
    (!ui.filtroPrograma || a.programa === ui.filtroPrograma));
  const programas = [...new Set(estado.alumnos.map(a => a.programa))].sort();

  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">${estado.alumnos.length} fichas</p><h1>Fichas del alumnado</h1></div>
      <button type="button" class="btn" data-accion="nuevo">+ Nueva ficha</button>
    </header>
    <div class="controles">
      <input type="search" id="buscar" placeholder="Buscar por nombre, RUT o responsable" value="${esc(ui.busqueda)}" aria-label="Buscar" style="flex:1 1 240px">
      <select id="filtro-programa" aria-label="Filtrar por programa"><option value="">Todos los programas</option>${programas.map(p => `<option ${p === ui.filtroPrograma ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
      <select id="filtro-taller" aria-label="Filtrar por taller"><option value="">Todos los talleres</option>${estado.talleres.map(t => `<option value="${t.id}" ${t.id === ui.filtroTaller ? 'selected' : ''}>${esc(t.nombre)}</option>`).join('')}</select>
    </div>
    <div id="lista-fichas"></div>`;
  pintarFichas(filtrados);
}
function pintarFichas(lista) {
  const box = $('#lista-fichas');
  box.innerHTML = lista.length ? `<div class="fichas">${lista.map(a => {
    const r = resumen(registros({ alumno: a.id, desde: hace30() }));
    return `<button type="button" class="ficha-card" data-ficha="${a.id}">
      <div class="top">${avatar(a)}<div><b>${esc(nombreCompleto(a))}</b><small>${edad(a.fechaNac)} años · ${esc(a.programa)}</small></div></div>
      <div class="talleres-mini">${a.talleres.map(id => { const t = taller(id); return t ? `<span class="tag"><span class="punto" style="--c:${t.color}"></span>${esc(t.nombre)}</span>` : ''; }).join('')}</div>
      <div class="pie">${chipPct(r.pct)}${a.beca ? `<span class="chip chip-neutro">${esc(a.beca)}</span>` : ''}${a.alergias ? '<span class="chip chip-bad">Alergia</span>' : ''}</div>
    </button>`;
  }).join('')}</div>` : '<p class="vacio">No hay fichas que coincidan con la búsqueda.</p>';
}

function vistaTalleres(el) {
  el.innerHTML = `
    <header class="cabecera"><div><p class="eyebrow">${estado.talleres.length} talleres</p><h1>Talleres</h1><p>Horario semanal y asistencia de los últimos 30 días.</p></div></header>
    <div class="talleres">${estado.talleres.map(t => {
      const ins = estado.alumnos.filter(a => a.talleres.includes(t.id));
      const r = resumen(registros({ taller: t.id, desde: hace30() }));
      return `<article class="taller" style="--c:${t.color}">
        <h2>${esc(t.nombre)}</h2>
        <dl>
          <dt>Área</dt><dd>${esc(t.area)}</dd>
          <dt>Días</dt><dd>${t.dias.map(d => DIAS[d]).join(' y ')}</dd>
          <dt>Horario</dt><dd class="num">${esc(t.horario)}</dd>
          <dt>A cargo</dt><dd>${esc(t.encargado)}</dd>
          <dt>Inscritos</dt><dd class="num">${ins.length}</dd>
        </dl>
        <div class="pie" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${chipPct(r.pct)}
          <button type="button" class="btn btn-sec btn-peq" data-ir-taller="${t.id}">Pasar lista</button>
          <button type="button" class="btn btn-sec btn-peq" data-ver-mes="${t.id}">Ver mes</button>
        </div>
      </article>`;
    }).join('')}</div>`;
}

/* ---------- ficha ---------- */
function abrirFicha(id) {
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
          ${a.beca ? `<span class="chip chip-info">${esc(a.beca)}</span>` : ''}
          ${chipPct(r30.pct)}
        </div>
      </div>
      <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">×</button>
    </div>
    <div class="dlg-cuerpo" style="padding:0">
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
            ${fila('Emergencia', esc(a.emergencia))}
          </dl>
        </section>
        <section>
          <h3>Programa</h3>
          <dl class="dato">
            ${fila('Programa', esc(a.programa))}
            ${fila('Ingreso', esc(fechaCorta(a.fechaIngreso)))}
            ${fila('Entrevista', esc(fechaCorta(a.entrevista)))}
            ${fila('Beca', esc(a.beca))}
          </dl>
          <div class="talleres-mini">${a.talleres.map(tid => { const t = taller(tid); return t ? `<span class="tag"><span class="punto" style="--c:${t.color}"></span>${esc(t.nombre)} · ${t.dias.map(d => DIAS_CORTOS[d]).join('/')}</span>` : ''; }).join('')}</div>
          ${toCorto ? '<p class="nota-campo">Terapia Ocupacional pide al menos 3 módulos. Tiene ' + a.talleres.length + '.</p>' : ''}
        </section>
        <section>
          <h3>Salud</h3>
          <dl class="dato">
            ${fila('Alergias', a.alergias ? `<span class="chip chip-bad">${esc(a.alergias)}</span>` : '')}
            ${fila('Medicación', esc(a.medicacion))}
          </dl>
        </section>
        <section class="ancho">
          <h3>Perfil y apoyos</h3>
          <dl class="dato">
            ${fila('Intereses y talentos', esc(a.intereses))}
            ${fila('Apoyos que le sirven', esc(a.apoyos))}
            ${fila('Observaciones', esc(a.observaciones))}
          </dl>
        </section>
        <section class="ancho">
          <h3>Asistencia</h3>
          <div class="leyenda">${Object.entries(ESTADOS).map(([k, v]) => `<span class="chip ${v.chip}">${total[k]} ${v.label.toLowerCase()}</span>`).join('')}<span class="chip chip-neutro">${total.total} sesiones · ${total.pct ?? '—'}% total</span></div>
          ${ultimos.length ? `<p class="muted" style="font-size:.8rem">Últimas ${ultimos.length} sesiones, de la más antigua a la más reciente:</p>
          <div class="historial">${ultimos.map(r => `<span class="${ESTADOS[r.e].chip}" title="${esc(fechaCorta(r.fecha))} · ${esc(taller(r.taller)?.nombre || '')} · ${ESTADOS[r.e].label}">${r.e}</span>`).join('')}</div>` : '<p class="vacio">Aún no hay asistencia registrada.</p>'}
        </section>
      </div>
    </div>
    <div class="dlg-pie" id="ficha-pie">
      <button type="button" class="btn btn-sec" data-eliminar="${a.id}">Eliminar ficha</button>
      <button type="button" class="btn" data-editar="${a.id}">Editar ficha</button>
    </div>`;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}

/* ---------- formulario ---------- */
let editando = null;
function abrirFormulario(id = null) {
  editando = id;
  const a = id ? alumno(id) : null;
  const form = $('#form-alumno');
  form.reset();
  $('#form-titulo').textContent = a ? `Editar ficha de ${nombreVisible(a)}` : 'Nueva ficha';
  $('#form-error').hidden = true;
  $('#f-talleres').innerHTML = estado.talleres.map(t => `<label><input type="checkbox" name="talleres" value="${t.id}" ${a?.talleres.includes(t.id) ? 'checked' : ''}><span class="punto" style="--c:${t.color}"></span>${esc(t.nombre)}</label>`).join('');
  const campos = ['nombre', 'apellidos', 'apodo', 'pronombres', 'fechaNac', 'rut', 'programa', 'fechaIngreso', 'entrevista', 'beca', 'tutorNombre', 'tutorRelacion', 'tutorTelefono', 'tutorEmail', 'emergencia', 'direccion', 'intereses', 'apoyos', 'alergias', 'medicacion', 'observaciones'];
  for (const c of campos) { const inp = $('#f-' + c); if (inp) inp.value = a ? (a[c] ?? '') : ''; }
  if (!a) { $('#f-programa').value = 'FormaPro'; $('#f-fechaIngreso').value = iso(hoy()); }
  avisoTO();
  $('#dlg-ficha').open && $('#dlg-ficha').close();
  $('#dlg-form').showModal();
  $('#f-nombre').focus();
}
function avisoTO() {
  const n = $$('#f-talleres input:checked').length;
  $('#f-aviso-to').hidden = !($('#f-programa').value === 'Terapia Ocupacional' && n < 3);
}
function enviarFormulario(ev) {
  ev.preventDefault();
  const fd = new FormData(ev.target);
  const datos = Object.fromEntries([...fd.entries()].filter(([k]) => k !== 'talleres').map(([k, v]) => [k, String(v).trim()]));
  datos.talleres = fd.getAll('talleres');
  const faltan = [];
  if (!datos.nombre) faltan.push('nombre');
  if (!datos.apellidos) faltan.push('apellidos');
  if (!datos.fechaNac) faltan.push('fecha de nacimiento');
  if (!datos.talleres.length) faltan.push('al menos un taller');
  const err = $('#form-error');
  if (faltan.length) { err.textContent = `Completa: ${faltan.join(', ')}.`; err.hidden = false; return; }
  if (datos.fechaNac > iso(hoy())) { err.textContent = 'La fecha de nacimiento no puede ser futura.'; err.hidden = false; return; }
  let id = editando;
  if (id) Object.assign(alumno(id), datos);
  else { id = uid(); estado.alumnos.push({ id, ...datos }); }
  guardar();
  $('#dlg-form').close();
  toast(editando ? 'Ficha actualizada' : 'Ficha creada');
  render();
  abrirFicha(id);
}

/* ---------- datos: exportar / importar ---------- */
function exportarCSV() {
  const cols = [['Nombre', 'nombre'], ['Apellidos', 'apellidos'], ['Nombre preferido', 'apodo'], ['Pronombres', 'pronombres'], ['Fecha de nacimiento', 'fechaNac'], ['RUT', 'rut'], ['Programa', 'programa'], ['Talleres', a => a.talleres.map(id => taller(id)?.nombre).join(' | ')], ['Beca', 'beca'], ['Ingreso', 'fechaIngreso'], ['Responsable', 'tutorNombre'], ['Parentesco', 'tutorRelacion'], ['Teléfono', 'tutorTelefono'], ['Correo', 'tutorEmail'], ['Emergencia', 'emergencia'], ['Dirección', 'direccion'], ['Alergias', 'alergias'], ['Medicación', 'medicacion'], ['Intereses', 'intereses'], ['Apoyos', 'apoyos'], ['Observaciones', 'observaciones'], ['% asistencia total', a => resumen(registros({ alumno: a.id })).pct ?? '']];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [cols.map(c => q(c[0])).join(';')].concat(ordenarAlumnos(estado.alumnos).map(a => cols.map(([, k]) => q(typeof k === 'function' ? k(a) : a[k])).join(';')));
  descargar(`spectrumpro-fichas-${iso(hoy())}.csv`, '﻿' + lineas.join('\r\n'), 'text/csv;charset=utf-8');
  toast('Fichas exportadas');
}
function exportarJSON() {
  descargar(`spectrumpro-respaldo-${iso(hoy())}.json`, JSON.stringify(estado, null, 2), 'application/json');
  toast('Copia de seguridad descargada');
}
async function importarJSON(file) {
  try {
    const datos = JSON.parse(await file.text());
    if (!Array.isArray(datos.alumnos) || !Array.isArray(datos.talleres) || typeof datos.asistencia !== 'object') throw new Error('formato');
    if (!await confirmar(`Esto reemplaza los datos actuales por la copia "${file.name}" (${datos.alumnos.length} fichas).`, 'Restaurar')) return;
    estado = datos; guardar(); render(); toast('Copia restaurada');
  } catch { toast('El archivo no es una copia de seguridad válida de SpectrumPro'); }
}

/* ---------- enrutado y eventos ---------- */
const VISTAS = { panel: vistaPanel, asistencia: vistaAsistencia, cumpleanos: vistaCumpleanos, alumnos: vistaAlumnos, talleres: vistaTalleres };
function render() {
  const v = VISTAS[location.hash.slice(1)] ? location.hash.slice(1) : 'panel';
  $$('.nav a').forEach(a => a.dataset.vista === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  $('#aviso-demo').hidden = !estado.demo;
  VISTAS[v]($('#vista'));
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

document.addEventListener('click', async ev => {
  const t = ev.target;
  const el = sel => t.closest(sel);
  let x;

  if ((x = el('[data-copiar]'))) {
    const v = x.dataset.copiar;
    try { await navigator.clipboard.writeText(v); toast('Copiado'); }
    catch { const s = window.getSelection(); const r = document.createRange(); r.selectNodeContents(x.previousElementSibling); s.removeAllRanges(); s.addRange(r); toast('Selecciona y copia el texto'); }
    return;
  }
  if ((x = el('[data-cerrar]'))) { x.closest('dialog').close(); return; }
  if ((x = el('[data-editar]'))) { abrirFormulario(x.dataset.editar); return; }
  if ((x = el('[data-eliminar]'))) {
    const a = alumno(x.dataset.eliminar);
    const pie = $('#ficha-pie');
    pie.innerHTML = `<div class="confirmacion">¿Eliminar la ficha de ${esc(nombreCompleto(a))}? También se borra su historial de asistencia.</div>
      <button type="button" class="btn btn-sec" data-cancelar-eliminar="${a.id}">Cancelar</button>
      <button type="button" class="btn btn-peligro" data-confirmar-eliminar="${a.id}">Eliminar</button>`;
    return;
  }
  if ((x = el('[data-cancelar-eliminar]'))) { abrirFicha(x.dataset.cancelarEliminar); return; }
  if ((x = el('[data-confirmar-eliminar]'))) {
    const id = x.dataset.confirmarEliminar;
    estado.alumnos = estado.alumnos.filter(a => a.id !== id);
    for (const [f, porTaller] of Object.entries(estado.asistencia)) {
      for (const [tid, reg] of Object.entries(porTaller)) { delete reg[id]; if (!Object.keys(reg).length) delete porTaller[tid]; }
      if (!Object.keys(porTaller).length) delete estado.asistencia[f];
    }
    guardar(); $('#dlg-ficha').close(); render(); toast('Ficha eliminada');
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
  if ((x = el('[data-modo]'))) { ui.modoAsis = x.dataset.modo; render(); return; }
  if ((x = el('[data-taller]'))) { ui.taller = x.dataset.taller; render(); return; }
  if ((x = el('.seg button'))) {
    const aid = x.closest('.seg').dataset.alumno;
    marcar(aid, x.dataset.e);
    const actual = estado.asistencia[ui.fecha]?.[ui.taller]?.[aid];
    $$('button', x.closest('.seg')).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.e === actual)));
    pintarResumenLista();
    return;
  }
  if (t.id === 'todos-presentes') {
    const ins = estado.alumnos.filter(a => a.talleres.includes(ui.taller));
    const reg = ((estado.asistencia[ui.fecha] ??= {})[ui.taller] ??= {});
    let n = 0;
    for (const a of ins) if (!reg[a.id]) { reg[a.id] = 'P'; n++; }
    if (!Object.keys(reg).length) { delete estado.asistencia[ui.fecha][ui.taller]; }
    guardar(); render(); toast(n ? `${n} marcados como presentes` : 'No había pendientes');
    return;
  }
  if ((x = el('[data-accion]'))) {
    const acc = x.dataset.accion;
    if (acc === 'nuevo') abrirFormulario();
    if (acc === 'exportar-csv') exportarCSV();
    if (acc === 'exportar-json') exportarJSON();
    if (acc === 'restablecer' && await confirmar('Esto reemplaza todos los datos actuales por los datos de ejemplo.', 'Cargar ejemplo')) {
      estado = crearEjemplo(); guardar(); render(); toast('Datos de ejemplo cargados');
    }
    if (acc === 'vaciar' && await confirmar('Esto borra todas las fichas y la asistencia guardadas en este navegador. Los talleres se mantienen. Descarga una copia de seguridad antes si quieres conservarlas.', 'Borrar todo')) {
      estado = { version: 1, demo: false, talleres: estado.talleres, alumnos: [], asistencia: {} };
      guardar(); location.hash = 'alumnos'; render(); toast('Listo. Crea la primera ficha con «Nueva ficha».');
    }
  }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'asis-fecha' && t.value) { ui.fecha = t.value; ui.taller = null; render(); }
  if (t.id === 'asis-otro' && t.value) { ui.taller = t.value; render(); }
  if (t.id === 'mes-mes' && t.value) { ui.mes = t.value; render(); }
  if (t.id === 'mes-taller') { ui.tallerMes = t.value; render(); }
  if (t.id === 'filtro-taller') { ui.filtroTaller = t.value; render(); }
  if (t.id === 'filtro-programa') { ui.filtroPrograma = t.value; render(); }
  if (t.id === 'importar' && t.files[0]) { importarJSON(t.files[0]); t.value = ''; }
  if (t.closest('#form-alumno')) avisoTO();
});
document.addEventListener('input', ev => {
  if (ev.target.id === 'buscar') {
    ui.busqueda = ev.target.value;
    const pos = ev.target.selectionStart;
    render();
    const b = $('#buscar'); b.focus(); b.setSelectionRange(pos, pos);
  }
});
$('#form-alumno').addEventListener('submit', enviarFormulario);

render();
