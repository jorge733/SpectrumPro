'use strict';
/* Página Comunidad de spectrumpro.cl.
   · Formulario de suscripción a las noticias: lo recibe la función «comunidad» de Supabase, que guarda
     a la persona como pendiente y le manda un correo para confirmar (doble confirmación).
   · ?confirmar=… y ?baja=… llegan desde esos correos: se confirma o se da de baja aquí mismo.
   · Boletines anteriores: los que se enviaron con «Publicar en la página Comunidad» marcado.
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

  /* ---------- Boletines anteriores ---------- */
  async function boletines() {
    const caja = document.querySelector('[data-boletines]');
    const sec = caja?.closest('section');
    if (!caja || !base) return;
    try {
      const r = await fetch(base + '/rest/v1/boletines?select=id,titulo,texto,imagen,boton_texto,boton_enlace,enviado_en&order=enviado_en.desc&limit=24', { headers: { apikey: cfg.supabaseAnonKey } });
      if (!r.ok) return;
      const lista = await r.json();
      if (!lista.length) return;
      caja.innerHTML = lista.map(b => `<details class="boletin" id="boletin-${esc(b.id)}">
        <summary><time datetime="${esc(b.enviado_en)}">${esc(fecha(b.enviado_en))}</time><b>${esc(b.titulo)}</b></summary>
        <div class="contenido">
          ${b.imagen ? `<img src="${esc(b.imagen)}" alt="" loading="lazy">` : ''}
          ${formato(b.texto)}
          ${b.boton_texto && /^https:\/\//.test(b.boton_enlace || '') ? `<a class="btn oscuro" href="${esc(b.boton_enlace)}" target="_blank" rel="noopener">${esc(b.boton_texto)}</a>` : ''}
        </div></details>`).join('');
      if (!sec.hasAttribute('data-oculta')) sec.hidden = false;
      const abierto = location.hash.match(/^#boletin-([0-9a-f-]{36})$/i);
      if (abierto) { const d = document.getElementById('boletin-' + abierto[1]); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }
    } catch { /* el archivo es opcional */ }
  }
  boletines();
})();
