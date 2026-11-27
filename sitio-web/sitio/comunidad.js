'use strict';
/* Página Comunidad de spectrumpro.cl.
   · Formulario de suscripción a las noticias: lo recibe la función «comunidad» de Supabase, que guarda
     a la persona como pendiente y le manda un correo para confirmar (doble confirmación).
   · ?confirmar=… y ?baja=… llegan desde esos correos: se confirma o se da de baja aquí mismo.
   · Boletines anteriores: los que se enviaron con «Publicar en la página Comunidad» marcado, con
     reacciones (una por navegador) y comentarios de personas suscritas que el equipo aprueba.
   Se carga después de sitio.js. */
(() => {
  const cfg = window.SPECTRUMPRO_CONFIG || {};
  const base = String(cfg.supabaseUrl || '').replace(/\/$/, '');
  const FUNCION = base + '/functions/v1/comunidad';
  const enVistaPrevia = new URLSearchParams(location.search).has('vista-previa');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esCorreo = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  // Texto de un boletín → HTML. Mismas reglas que el correo (supabase/functions/_compartido/correo-boletin.js):
  // párrafos por línea, «- » al inicio = lista, **negrita** y enlaces https sueltos.
  function formato(texto) {
    const linea = s => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    const out = []; let lista = [];
    const cerrar = () => { if (lista.length) { out.push(`<ul>${lista.map(x => `<li>${linea(x)}</li>`).join('')}</ul>`); lista = []; } };
    for (const l of String(texto || '').split('\n').map(x => x.trim())) {
      if (!l) { cerrar(); continue; }
      if (/^[-•]\s+/.test(l)) { lista.push(l.replace(/^[-•]\s+/, '')); continue; }
      cerrar(); out.push(`<p>${linea(l)}</p>`);
    }
    cerrar();
    return out.join('');
  }
  const fecha = s => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Santiago' });

  async function llamar(cuerpo) {
    if (!base) throw new Error('El formulario aún no está conectado. Escríbenos a contacto@spectrumpro.cl.');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(FUNCION, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey || '' },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos.');
      return d;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TypeError) throw new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
      throw e;
    } finally { clearTimeout(t); }
  }

  /* ---------- Formulario ---------- */
  const form = document.querySelector('[data-suscripcion]');
  if (form) {
    const msj = form.querySelector('.mensaje');
    const btn = form.querySelector('button[type="submit"]');
    const decir = (txt, error = false) => { msj.textContent = txt; msj.classList.toggle('error', error); msj.hidden = !txt; };
    form.addEventListener('submit', async ev => {
      ev.preventDefault();
      const f = form.elements;
      const email = f.email.value.trim().toLowerCase();
      if (enVistaPrevia) return decir('Vista previa: el formulario no envía nada.');
      if (!esCorreo(email)) { f.email.focus(); return decir('Revisa tu correo: parece que le falta algo.', true); }
      if (!f.acepto.checked) { f.acepto.focus(); return decir('Marca la casilla para aceptar recibir los correos.', true); }
      btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Enviando…'; decir('');
      try {
        await llamar({ accion: 'suscribir', email, nombre: f.nombre.value.trim(), perfil: f.perfil.value, web: f.web.value });
        form.reset();
        decir(`¡Gracias! Te enviamos un correo a ${email}. Abre el enlace que trae para confirmar tu suscripción (si no llega en unos minutos, revisa la carpeta de spam o promociones).`);
      } catch (e) { decir(e.message, true); }
      finally { btn.disabled = false; btn.textContent = txt; }
    });
  }

  /* ---------- Llegando desde un correo: confirmar o darse de baja ---------- */
  function aviso(html, error = false) {
    let el = document.querySelector('.aviso-comunidad');
    if (!el) {
      el = document.createElement('div');
      el.className = 'aviso-comunidad';
      el.setAttribute('role', 'status');
      const caja = document.createElement('div'); caja.className = 'wrap'; caja.style.paddingTop = '24px';
      caja.append(el);
      document.querySelector('main').prepend(caja);
    }
    el.classList.toggle('error', error);
    el.innerHTML = html;
    el.scrollIntoView({ block: 'center' });
    return el;
  }
  const q = new URLSearchParams(location.search);
  const token = q.get('confirmar') || q.get('baja');
  if (token && !enVistaPrevia) {
    // Se limpia la dirección para que no quede el código en el historial ni al compartir.
    history.replaceState(null, '', location.pathname + location.hash);
    if (!/^[0-9a-f-]{36}$/i.test(token)) aviso('Ese enlace no es válido. Copia el enlace completo del correo.', true);
    else if (q.has('confirmar')) {
      aviso('Confirmando tu suscripción…');
      llamar({ accion: 'confirmar', token })
        .then(() => aviso('<span>✅ ¡Listo! Tu suscripción está confirmada. Te escribiremos cuando haya novedades.</span>'))
        .catch(e => aviso(esc(e.message), true));
    } else {
      // Pide un clic: algunos programas de correo abren los enlaces solos para revisarlos.
      const el = aviso('<span>¿Quieres dejar de recibir las noticias de SpectrumPro?</span><button type="button" class="btn oscuro">Sí, darme de baja</button>');
      el.querySelector('button').addEventListener('click', ev => {
        ev.target.disabled = true;
        llamar({ accion: 'baja', token })
          .then(() => aviso('<span>Listo, ya no recibirás más correos. Si cambias de opinión, puedes volver a suscribirte cuando quieras.</span>'))
          .catch(e => aviso(esc(e.message), true));
      });
    }
  }

  /* ---------- Boletines anteriores, con reacciones y comentarios ---------- */
  const REACCIONES = [['gusta', '❤️', 'Me gustó'], ['aplauso', '👏', 'Aplausos'], ['aprendi', '💡', 'Aprendí algo'], ['identifica', '🤝', 'Me identifica']];
  const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
  const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  // Identificador al azar de este navegador, para que cada reacción cuente una sola vez.
  let dispositivo = leer('spectrumpro:dispositivo', '');
  if (!/^[0-9a-z-]{16,64}$/i.test(dispositivo)) { dispositivo = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)); guardar('spectrumpro:dispositivo', dispositivo); }
  const mias = leer('spectrumpro:reacciones', {});
  const fechaCorta = s => new Date(s).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' });
  const parrafos = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');

  function barraReacciones(id, tot) {
    return REACCIONES.map(([k, ico, txt]) => {
      const n = tot[k] || 0, on = (mias[id] || []).includes(k);
      return `<button type="button" class="reaccion" data-reaccion="${k}" aria-pressed="${on}" aria-label="${txt}: ${n}" title="${txt}"><span aria-hidden="true">${ico}</span><b>${n}</b></button>`;
    }).join('');
  }
  // Con el boletín cerrado: «❤️ 3 · 💡 1 · 💬 2» (solo lo que tiene al menos uno).
  function resumenInteraccion(tot, nComentarios) {
    const partes = REACCIONES.filter(([k]) => tot[k]).map(([k, ico]) => `${ico} ${tot[k]}`);
    if (nComentarios) partes.push(`💬 ${nComentarios}`);
    return partes.length ? `<small class="conteo">${partes.join(' · ')}</small>` : '';
  }
  function listaComentarios(cs) {
    if (!cs.length) return '<p class="sin-comentarios">Aún no hay comentarios. ¡Sé la primera persona en comentar!</p>';
    return `<ol class="comentarios">${cs.map(c => `<li>
      <p class="quien"><b>${esc(c.nombre)}</b> <time datetime="${esc(c.creado)}">${esc(fechaCorta(c.creado))}</time></p>${parrafos(c.texto)}
      ${c.respuesta ? `<div class="respuesta"><p class="quien"><b>SpectrumPro</b> <span class="marca">Equipo</span></p>${parrafos(c.respuesta)}</div>` : ''}
    </li>`).join('')}</ol>`;
  }
  const yo = leer('spectrumpro:comentarista', {});
  const formComentario = id => `<form class="form-comentario" data-comentar="${esc(id)}" novalidate>
    <h4>Deja un comentario</h4>
    <div class="fila"><label><span>Tu nombre</span><input name="nombre" maxlength="60" autocomplete="name" value="${esc(yo.nombre || '')}" required></label>
    <label><span>Tu correo <small>(no se publica)</small></span><input name="email" type="email" maxlength="160" autocomplete="email" value="${esc(yo.email || '')}" required></label></div>
    <label>Comentario<textarea name="texto" rows="3" maxlength="2000" required></textarea></label>
    <label class="trampa" aria-hidden="true">No completar<input name="web" tabindex="-1" autocomplete="off"></label>
    <p class="nota">Pueden comentar las personas suscritas a las noticias, con el mismo correo. El equipo revisa cada comentario antes de publicarlo.</p>
    <button type="submit" class="btn oscuro">Enviar comentario</button>
    <p class="mensaje" role="status" aria-live="polite" hidden></p>
  </form>`;

  async function boletines() {
    const caja = document.querySelector('[data-boletines]');
    const sec = caja?.closest('section');
    if (!caja || !base) return;
    const h = { headers: { apikey: cfg.supabaseAnonKey } };
    try {
      const r = await fetch(base + '/rest/v1/boletines?select=id,titulo,texto,imagen,boton_texto,boton_enlace,enviado_en&order=enviado_en.desc&limit=24', h);
      if (!r.ok) return;
      const lista = await r.json();
      if (!lista.length) return;
      // Reacciones y comentarios son opcionales: si aún no existen en la base, el archivo se ve igual.
      const pedir = u => fetch(base + '/rest/v1/' + u, h).then(async x => x.ok ? await x.json() : null).catch(() => null);
      const [tot, coms] = await Promise.all([
        pedir('boletin_reacciones_totales?select=boletin_id,tipo,total'),
        pedir('boletin_comentarios_publicos?select=id,boletin_id,nombre,texto,creado,respuesta&order=creado.asc'),
      ]);
      const conInteraccion = !!(tot && coms);
      const totales = {}, comentarios = {};
      for (const x of tot || []) (totales[x.boletin_id] ??= {})[x.tipo] = x.total;
      for (const c of coms || []) (comentarios[c.boletin_id] ??= []).push(c);
      caja.innerHTML = lista.map(b => {
        const cs = comentarios[b.id] || [];
        return `<details class="boletin" id="boletin-${esc(b.id)}" data-boletin="${esc(b.id)}">
        <summary><time datetime="${esc(b.enviado_en)}">${esc(fecha(b.enviado_en))}</time><b>${esc(b.titulo)}</b>${conInteraccion ? resumenInteraccion(totales[b.id] || {}, cs.length) : ''}</summary>
        <div class="contenido">
          ${b.imagen ? `<img src="${esc(b.imagen)}" alt="" loading="lazy">` : ''}
          ${formato(b.texto)}
          ${b.boton_texto && /^https:\/\//.test(b.boton_enlace || '') ? `<a class="btn oscuro" href="${esc(b.boton_enlace)}" target="_blank" rel="noopener">${esc(b.boton_texto)}</a>` : ''}
          ${conInteraccion ? `<div class="interaccion">
            <div class="reacciones" role="group" aria-label="Reacciones">${barraReacciones(b.id, totales[b.id] || {})}</div>
            <h4 class="titulo-comentarios">Comentarios${cs.length ? ` (${cs.length})` : ''}</h4>
            ${listaComentarios(cs)}
            ${formComentario(b.id)}
          </div>` : ''}
        </div></details>`;
      }).join('');
      if (!sec.hasAttribute('data-oculta')) sec.hidden = false;
      const abierto = location.hash.match(/^#boletin-([0-9a-f-]{36})$/i);
      if (abierto) { const d = document.getElementById('boletin-' + abierto[1]); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }
    } catch { /* el archivo es opcional */ }
  }

  async function totalesDe(id) {
    const r = await fetch(`${base}/rest/v1/boletin_reacciones_totales?select=tipo,total&boletin_id=eq.${encodeURIComponent(id)}`, { headers: { apikey: cfg.supabaseAnonKey }, cache: 'no-store' });
    if (!r.ok) return null;
    return Object.fromEntries((await r.json()).map(x => [x.tipo, x.total]));
  }

  document.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-reaccion]');
    if (!btn) return;
    const id = btn.closest('[data-boletin]').dataset.boletin, tipo = btn.dataset.reaccion;
    if (enVistaPrevia) return;
    const barra = btn.parentElement;
    barra.querySelectorAll('button').forEach(b => { b.disabled = true; });
    try {
      const r = await llamar({ accion: 'reaccionar', boletin: id, tipo, dispositivo });
      const set = new Set(mias[id] || []);
      r.activa ? set.add(tipo) : set.delete(tipo);
      mias[id] = [...set]; guardar('spectrumpro:reacciones', mias);
      // Los totales se piden a la misma vista pública que usa la página al cargar (la fuente de verdad).
      const tot = await totalesDe(id).catch(() => null) ?? r.totales ?? {};
      barra.innerHTML = barraReacciones(id, tot);
      const det = barra.closest('details'), sum = det?.querySelector('summary');
      if (sum) { sum.querySelector('.conteo')?.remove(); sum.insertAdjacentHTML('beforeend', resumenInteraccion(tot, det.querySelectorAll('.comentarios > li').length)); }
    } catch (e) {
      barra.querySelectorAll('button').forEach(b => { b.disabled = false; });
      alert(e.message);
    }
  });

  document.addEventListener('submit', async ev => {
    const form = ev.target.closest('[data-comentar]');
    if (!form) return;
    ev.preventDefault();
    const f = form.elements, msj = form.querySelector('.mensaje'), btn = form.querySelector('button[type="submit"]');
    const decir = (txt, error = false) => { msj.textContent = txt; msj.classList.toggle('error', error); msj.hidden = !txt; };
    const datos = { nombre: f.nombre.value.trim(), email: f.email.value.trim().toLowerCase(), texto: f.texto.value.trim() };
    if (enVistaPrevia) return decir('Vista previa: el formulario no envía nada.');
    if (!datos.nombre) { f.nombre.focus(); return decir('Escribe tu nombre.', true); }
    if (!esCorreo(datos.email)) { f.email.focus(); return decir('Revisa tu correo: parece que le falta algo.', true); }
    if (datos.texto.length < 2) { f.texto.focus(); return decir('Escribe tu comentario.', true); }
    btn.disabled = true; decir('');
    try {
      await llamar({ accion: 'comentar', boletin: form.dataset.comentar, ...datos, web: f.web.value });
      guardar('spectrumpro:comentarista', { nombre: datos.nombre, email: datos.email });
      f.texto.value = '';
      decir('¡Gracias! Tu comentario aparecerá cuando el equipo lo revise. Recuerda que solo publicamos comentarios de personas suscritas: si aún no te suscribes, hazlo más abajo con este mismo correo.');
    } catch (e) { decir(e.message, true); }
    finally { btn.disabled = false; }
  });

  boletines();
})();
