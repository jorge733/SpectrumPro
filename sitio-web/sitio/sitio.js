'use strict';
/* Sitio público de SpectrumPro.
   El contenido viene de Supabase (se edita en la plataforma, sección «Sitio web»).
   Para que la página aparezca al instante, primero pinta la última copia guardada en este
   navegador (o el respaldo de contenido.js) y luego la reemplaza con lo que responde Supabase. */
(() => {
  const CLAVE = 'spectrumpro:sitio:v1';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parrafos = s => String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
  const COLORES = ['var(--c5)', 'var(--c4)', 'var(--c3)', 'var(--c2)', 'var(--c1)', 'var(--c6)'];
  const SUAVES = ['var(--p5)', 'var(--p4)', 'var(--p3)', 'var(--p2)', 'var(--p1)', 'var(--p6)'];
  const ICONO_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const ICONO_WA = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>';
  const ytId = u => (String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
  const ytMiniatura = u => ytId(u) ? `https://i.ytimg.com/vi/${ytId(u)}/hqdefault.jpg` : '';
  const telefono = n => { const m = String(n).match(/^56(9)(\d{4})(\d{4})$/); return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : '+' + n; };
  const waLink = (n, txt) => `https://wa.me/${n}${txt ? '?text=' + encodeURIComponent(txt) : ''}`;

  /* ---------- Plantillas por tipo ---------- */
  const PLANTILLAS = {
    valor: (x, i) => `<article class="valor revelar" style="--kc:${COLORES[i % COLORES.length]};--i:${i}"><span class="punto" aria-hidden="true"></span><div><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></div></article>`,
    equipo: (x, i) => `<article class="persona revelar" style="--i:${i % 4};--kc:${COLORES[i % COLORES.length]}">
        <div class="foto">${x.imagen ? `<img src="${esc(x.imagen)}" alt="Retrato de ${esc(x.titulo)}" loading="lazy" width="480" height="480">` : ''}</div>
        <h3>${esc(x.titulo)}</h3>${x.subtitulo ? `<span class="cargo">${esc(x.subtitulo)}</span>` : ''}
        ${x.texto ? `<details><summary>Conocer más</summary>${parrafos(x.texto)}${x.nota ? `<p class="correo">${esc(x.nota)}</p>` : ''}</details>` : ''}
      </article>`,
    taller: (x, i) => {
      const lista = String(x.lista || '').split('\n').map(s => s.trim()).filter(Boolean);
      const hayMas = lista.length || x.nota || x.enlace;
      return `<article class="taller revelar" style="--k:${SUAVES[i % SUAVES.length]};--i:${i % 3}">
        <div class="ilus">${x.imagen ? `<img src="${esc(x.imagen)}" alt="" loading="lazy">` : ''}</div>
        <div class="cuerpo"><h3>${esc(x.titulo)}</h3>${x.subtitulo ? `<span class="quien">Con ${esc(x.subtitulo)}</span>` : ''}
        ${parrafos(x.texto)}
        ${hayMas ? `<details><summary>Objetivos y resultado</summary>
          ${lista.length ? `<ul>${lista.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
          ${x.nota ? `<p class="resultado"><b>Resultado</b>${esc(x.nota)}</p>` : ''}
          ${x.enlace ? `<p class="resultado"><a class="enlace-flecha" href="${esc(x.enlace)}" target="_blank" rel="noopener">Ver video ▶</a></p>` : ''}
        </details>` : ''}</div></article>`;
    },
    mentoria: (x, i) => `<article class="tarjeta revelar" style="--i:${i}"><h3>${esc(x.titulo)}</h3>${x.subtitulo ? `<span class="quien">Con ${esc(x.subtitulo)}</span>` : ''}${parrafos(x.texto)}</article>`,
    modulo: (x, i) => `<article class="tarjeta revelar" style="--i:${i}"><h3>${esc(x.titulo)}</h3>${x.subtitulo ? `<span class="quien">Con ${esc(x.subtitulo)}</span>` : ''}${parrafos(x.texto)}</article>`,
    apoyo: (x, i) => `<article class="tarjeta revelar" style="--i:${i}">${x.subtitulo ? `<span class="quien">${esc(x.subtitulo)}</span>` : ''}<h3>${esc(x.titulo)}</h3>${x.nota ? `<span class="encargada">Con ${esc(x.nota)}</span>` : ''}${parrafos(x.texto)}</article>`,
    actividad: (x, i) => `<span class="chip revelar" style="--k:${SUAVES[i % SUAVES.length]};--i:${i}">${esc(x.titulo)}</span>`,
    servicio: (x, i) => `<article class="servicio revelar" style="--i:${i % 2}"><span class="n">${String(i + 1).padStart(2, '0')}</span><h3>${esc(x.titulo)}</h3><p>${esc(x.texto)}</p></article>`,
    produccion: (x, i) => `<a class="video revelar" style="--i:${i % 3}" href="${esc(x.enlace)}" target="_blank" rel="noopener">
        <img src="${esc(x.imagen || ytMiniatura(x.enlace))}" alt="" loading="lazy">
        <span class="play">${ICONO_PLAY}</span>
        <span class="pie"><b>${esc(x.titulo)}</b>${x.subtitulo ? `<span>${esc(x.subtitulo)}</span>` : ''}</span></a>`,
  };

  /* ---------- Pintar ---------- */
  function pintar(datos) {
    const T = datos.textos || {};
    const porTipo = {};
    for (const x of [...(datos.elementos || [])].sort((a, b) => (a.orden - b.orden))) (porTipo[x.tipo] ??= []).push(x);

    document.querySelectorAll('[data-texto]').forEach(el => {
      const v = T[el.dataset.texto];
      if (v == null) return;
      if (el.dataset.formato === 'linea') el.textContent = v;
      else el.innerHTML = parrafos(v);
    });
    document.querySelectorAll('[data-lista]').forEach(el => {
      const tipo = el.dataset.lista;
      let items = porTipo[tipo] || [];
      if (el.dataset.filtro) items = items.filter(x => x.subtitulo === el.dataset.filtro);
      if (el.dataset.max) items = items.slice(0, Number(el.dataset.max));
      const html = items.map((x, i) => PLANTILLAS[tipo](x, i)).join('');
      // Si Supabase trae lo mismo que ya está pintado, no se toca (así no vuelve a animarse).
      if (el._fuente !== html) { el._fuente = html; el.innerHTML = html; }
      const caja = el.closest('[data-si-hay]');
      if (caja) caja.hidden = !items.length;
    });
    // Enlaces y datos de contacto.
    const num = /^[0-9]{8,15}$/.test(T.whatsapp || '') ? T.whatsapp : '56996389673';
    document.querySelectorAll('[data-wa]').forEach(a => { a.href = waLink(num, a.dataset.wa); });
    document.querySelectorAll('[data-telefono]').forEach(el => { el.textContent = telefono(num); });
    if (T.correo) {
      document.querySelectorAll('[data-correo]').forEach(a => { a.href = 'mailto:' + T.correo; if (a.dataset.correo === 'texto') a.textContent = T.correo; });
      document.querySelectorAll('[data-correo-texto]').forEach(el => { el.innerHTML = esc(T.correo).replace('@', '@<wbr>'); });
    }
    document.querySelectorAll('[data-enlace]').forEach(a => { const v = T[a.dataset.enlace]; if (v) a.href = v; a.hidden = !v; });
    document.querySelectorAll('[data-instagram]').forEach(a => { const v = (T.instagram || '').trim(); a.hidden = !v; if (v) a.href = 'https://instagram.com/' + encodeURIComponent(v); });
    document.querySelectorAll('[data-mapa]').forEach(a => { if (T.direccion) a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(T.direccion); });
    document.querySelectorAll('[data-video]').forEach(a => {
      const v = T[a.dataset.video]; if (!v) return;
      a.href = v;
      const img = a.querySelector('img'); if (img && !img.dataset.fija) img.src = ytMiniatura(v);
    });
    observarRevelado();
  }

  /* ---------- Cargar ---------- */
  function guardado() { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } }
  async function desdeSupabase() {
    const cfg = window.SPECTRUMPRO_CONFIG || {};
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('sin configuración');
    const base = cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/';
    const h = { headers: { apikey: cfg.supabaseAnonKey } };
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
    try {
      const [rt, re] = await Promise.all([
        fetch(base + 'sitio_textos?select=clave,valor', { ...h, signal: ctrl.signal }),
        fetch(base + 'sitio_elementos?select=tipo,titulo,subtitulo,texto,lista,nota,imagen,enlace,orden&visible=eq.true&order=tipo.asc,orden.asc', { ...h, signal: ctrl.signal }),
      ]);
      if (!rt.ok || !re.ok) throw new Error('respuesta ' + rt.status + '/' + re.status);
      const textos = {};
      for (const f of await rt.json()) textos[f.clave] = f.valor;
      return { textos, elementos: await re.json() };
    } finally { clearTimeout(t); }
  }

  /* ---------- Vitrina de la tienda (portada) ---------- */
  async function vitrina() {
    const el = document.querySelector('[data-vitrina]');
    // Usa la conexión de la tienda (/tienda/supabase.js), no la del resto del sitio.
    const cfg = window.TIENDA_SUPABASE || window.SPECTRUMPRO_CONFIG || {};
    if (!el || !cfg.supabaseUrl) return;
    try {
      const r = await fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/tienda_productos?select=nombre,precio,imagen&visible=eq.true&agotado=eq.false&order=orden.asc&limit=4', { headers: { apikey: cfg.supabaseAnonKey } });
      if (!r.ok) return;
      const ps = await r.json();
      if (!ps.length) return;
      el.innerHTML = ps.map((p, i) => `<a class="revelar" style="--i:${i}" href="/tienda#productos"><img src="${esc(/^tienda\//.test(p.imagen || '') ? '/' + p.imagen : p.imagen)}" alt="" loading="lazy"><span>${esc(p.nombre)}${p.precio != null ? `<b>$${Number(p.precio).toLocaleString('es-CL')}</b>` : ''}</span></a>`).join('');
      observarRevelado();
    } catch { /* la vitrina es opcional */ }
  }

  /* ---------- Menú en celular ---------- */
  const boton = document.querySelector('.abrir-menu'), menu = document.getElementById('menu');
  if (boton && menu) {
    const rotulo = boton.querySelector('span') || boton;
    const cerrar = () => { menu.classList.remove('abierto'); boton.setAttribute('aria-expanded', 'false'); rotulo.textContent = 'Menú'; };
    boton.addEventListener('click', () => {
      const abierto = menu.classList.toggle('abierto');
      boton.setAttribute('aria-expanded', String(abierto));
      rotulo.textContent = abierto ? 'Cerrar' : 'Menú';
    });
    menu.addEventListener('click', e => { if (e.target.closest('a')) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrar(); });
  }
  // Enlace de la sección actual.
  const ruta = location.pathname.replace(/(index)?\.html$/, '').replace(/(.)\/$/, '$1');
  document.querySelectorAll('#menu a').forEach(a => { if (a.getAttribute('href') === ruta) a.setAttribute('aria-current', 'page'); });

  /* ---------- Videos de YouTube dentro del sitio ---------- */
  // Cualquier enlace a un video de YouTube se abre en una ventana sobre la página en vez de ir a YouTube.
  // El enlace normal queda como respaldo (sin JavaScript, o con Ctrl/Cmd + clic para abrir en otra pestaña).
  let visor = null;
  function abrirVideo(id, titulo) {
    if (!visor) {
      visor = document.createElement('dialog');
      visor.className = 'visor-video';
      visor.innerHTML = '<div class="visor-caja"><button type="button" class="visor-cerrar" aria-label="Cerrar video">✕</button><div class="visor-marco"></div></div>';
      visor.querySelector('.visor-cerrar').addEventListener('click', () => visor.close());
      visor.addEventListener('click', e => { if (e.target === visor) visor.close(); });
      visor.addEventListener('close', () => { visor.querySelector('.visor-marco').innerHTML = ''; document.documentElement.classList.remove('sin-scroll'); });
      document.body.append(visor);
    }
    visor.querySelector('.visor-marco').innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1" title="${esc(titulo || 'Video de SpectrumPro')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    document.documentElement.classList.add('sin-scroll');
    visor.showModal();
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!/(^|\.)(youtube\.com|youtu\.be)$/.test(a.hostname)) return;
    const id = ytId(a.href);
    if (!id || typeof HTMLDialogElement !== 'function') return;
    e.preventDefault();
    abrirVideo(id, a.querySelector('.pie b')?.textContent || a.closest('article')?.querySelector('h3')?.textContent);
  });

  /* ---------- Aparecer al hacer scroll ---------- */
  let io = null;
  function observarRevelado() {
    if (!('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('js');
    io ??= new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visto'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.revelar:not(.visto)').forEach(el => io.observe(el));
  }

  // Íconos de WhatsApp en los botones que lo piden.
  document.querySelectorAll('[data-icono-wa]').forEach(el => el.insertAdjacentHTML('afterbegin', ICONO_WA));

  pintar(guardado() || window.SITIO_RESPALDO || { textos: {}, elementos: [] });
  desdeSupabase().then(d => {
    if (!d.elementos.length && !Object.keys(d.textos).length) return; // migración sin ejecutar aún
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
    pintar(d);
  }).catch(() => { /* se queda con lo ya pintado */ });
  vitrina();
})();
