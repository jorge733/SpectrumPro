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
    cinta: x => `<li>${esc(x.titulo)}</li>`,
    cliente: x => {
      const img = `<img src="${esc(x.imagen)}" alt="${esc(x.titulo)}" loading="lazy">`;
      return `<li>${x.enlace ? `<a href="${esc(x.enlace)}" target="_blank" rel="noopener" title="${esc(x.titulo)}">${img}</a>` : img}</li>`;
    },
    produccion: (x, i) => `<a class="video revelar" style="--i:${i % 3}" href="${esc(x.enlace)}" target="_blank" rel="noopener">
        <img src="${esc(x.imagen || ytMiniatura(x.enlace))}" alt="" loading="lazy">
        <span class="play">${ICONO_PLAY}</span>
        <span class="pie"><b>${esc(x.titulo)}</b>${x.subtitulo ? `<span>${esc(x.subtitulo)}</span>` : ''}</span></a>`,
    // Comunidad: documentos y artículos («nota» = texto del botón) y episodios de podcast.
    recurso: (x, i) => {
      const pdf = /\.pdf(\?|#|$)/i.test(x.enlace || '');
      const ir = x.enlace ? ` href="${esc(x.enlace)}" target="_blank" rel="noopener"${pdf ? ' type="application/pdf"' : ''}` : '';
      return `<article class="recurso revelar" style="--k:${SUAVES[i % SUAVES.length]};--kc:${COLORES[i % COLORES.length]};--i:${i % 3}">
        ${x.imagen ? `<a class="portada-doc"${ir} tabindex="-1" aria-hidden="true"><img src="${esc(x.imagen)}" alt="" loading="lazy"></a>` : '<span class="portada-doc" aria-hidden="true"></span>'}
        <div class="cuerpo">${x.subtitulo ? `<span class="tipo">${esc(x.subtitulo)}</span>` : ''}<h3>${esc(x.titulo)}</h3>${parrafos(x.texto)}
        ${x.enlace ? `<a class="enlace-flecha"${ir}>${esc(x.nota || (pdf ? 'Descargar PDF' : 'Abrir'))} <span aria-hidden="true">→</span></a>` : ''}</div></article>`;
    },
    episodio: (x, i) => {
      const spotify = /spotify\.com/.test(x.enlace || ''), yt = /youtu\.?be/.test(x.enlace || '');
      return `<article class="episodio revelar" style="--i:${i % 3}">
        ${x.imagen ? `<div class="portada-ep"><img src="${esc(x.imagen)}" alt="" loading="lazy"></div>` : ''}
        <div class="cuerpo">${x.subtitulo ? `<span class="quien">${esc(x.subtitulo)}</span>` : ''}<h3>${esc(x.titulo)}</h3>${parrafos(x.texto)}
        ${x.enlace ? `<a class="btn ${spotify ? 'spotify' : 'claro'}" href="${esc(x.enlace)}" target="_blank" rel="noopener">${esc(x.nota || (spotify ? 'Escuchar en Spotify' : yt ? 'Ver en YouTube' : 'Escuchar'))}</a>` : ''}</div></article>`;
    },
  };

  /* ---------- Pintar ---------- */
  // Lo que trae el HTML es el «original»: se vuelve a él cuando un texto no tiene valor guardado
  // (por ejemplo, al restaurar un campo en la vista previa de la plataforma).
  const originales = new WeakMap();
  const original = (el, f) => { if (!originales.has(el)) originales.set(el, f()); return originales.get(el); };
  const MARCAS = ['', 'var(--p4)', 'var(--p3)', 'var(--p2)', 'var(--p1)', 'var(--p5)'];
  // «*texto*» → resaltado con la etiqueta que usa ese elemento (mark, em o span).
  function resaltado(v, tag) {
    let i = 0;
    return esc(v).replace(/\*([^*]+)\*/g, (_, t) => {
      const st = tag === 'mark' && MARCAS[i % MARCAS.length] ? ` style="--m:${MARCAS[i % MARCAS.length]}"` : '';
      i++;
      return `<${tag}${st}>${t}</${tag}>`;
    });
  }
  function pintar(datos) {
    const T = datos.textos || {};
    const porTipo = {};
    for (const x of [...(datos.elementos || [])].sort((a, b) => (a.orden - b.orden))) (porTipo[x.tipo] ??= []).push(x);

    document.querySelectorAll('[data-texto]').forEach(el => {
      const html0 = original(el, () => el.innerHTML);
      const v = T[el.dataset.texto];
      // Un botón cuyo texto se dejó vacío desaparece entero.
      const caja = el.parentElement?.matches('a.btn, nav.indice a') ? el.parentElement : el;
      if (v == null) { if (el.innerHTML !== html0) el.innerHTML = html0; caja.hidden = false; return; }
      caja.hidden = !String(v).trim();
      if (el.dataset.formato === 'linea') el.textContent = v;
      else if (el.dataset.formato === 'resaltado') el.innerHTML = resaltado(v, el.dataset.resaltar || 'mark');
      else el.innerHTML = parrafos(v);
    });
    document.querySelectorAll('img[data-imagen]').forEach(img => {
      const [src0, alt0] = original(img, () => [img.getAttribute('src'), img.getAttribute('alt')]);
      const k = img.dataset.imagen;
      const src = T[k] || src0;
      if (img.getAttribute('src') !== src) { img.removeAttribute('srcset'); img.src = src; }
      const alt = T[k + '_alt'] ?? alt0;
      if (alt != null) img.alt = alt;
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
    // Secciones ocultadas desde la plataforma.
    document.querySelectorAll('[data-seccion]').forEach(sec => {
      const oculta = T['seccion_' + sec.dataset.seccion] === 'oculta';
      sec.toggleAttribute('data-oculta', oculta);   // comunidad.js lo respeta al mostrar los boletines
      if (oculta) sec.hidden = true;
      else if (!sec.matches('[data-si-hay]')) sec.hidden = false;
    });
    seo(T);
    aviso(T);
    // Enlaces y datos de contacto.
    const num = /^[0-9]{8,15}$/.test(T.whatsapp || '') ? T.whatsapp : '56996389673';
    document.querySelectorAll('[data-wa]').forEach(a => { a.href = waLink(num, a.dataset.wa); });
    document.querySelectorAll('[data-telefono]').forEach(el => { el.textContent = telefono(num); });
    if (T.correo) {
      document.querySelectorAll('[data-correo]').forEach(a => { a.href = 'mailto:' + T.correo; if (a.dataset.correo === 'texto') a.textContent = T.correo; });
      document.querySelectorAll('[data-correo-texto]').forEach(el => { el.innerHTML = esc(T.correo).replace('@', '@<wbr>'); });
    }
    // Enlaces editables: sin valor guardado se queda el del HTML; vacío oculta el botón o el ícono.
    document.querySelectorAll('[data-enlace]').forEach(a => {
      const h0 = original(a, () => a.getAttribute('href'));
      const v = T[a.dataset.enlace];
      if (v == null) { a.href = h0; if (!a.querySelector('[data-texto]')) a.hidden = false; return; }
      if (!String(v).trim()) { a.hidden = true; return; }
      a.href = v;
      if (!a.querySelector('[data-texto]')) a.hidden = false;
    });
    document.querySelectorAll('[data-instagram]').forEach(a => { const v = (T.instagram || '').trim(); a.hidden = !v; if (v) a.href = 'https://instagram.com/' + encodeURIComponent(v); });
    document.querySelectorAll('[data-mapa]').forEach(a => { if (T.direccion) a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(T.direccion); });
    document.querySelectorAll('[data-video]').forEach(a => {
      const v = T[a.dataset.video]; if (!v) return;
      a.href = v;
      const img = a.querySelector('img'); if (img && !img.dataset.fija) img.src = ytMiniatura(v);
    });
    observarRevelado();
  }

  /* ---------- Google y redes sociales ---------- */
  function seo(T) {
    const pag = document.body.dataset.pagina;
    if (!pag) return;
    const meta = (sel, v) => { const m = document.querySelector(sel); if (m && v) m.setAttribute('content', v); };
    const t = (T[`seo_${pag}_titulo`] || '').trim(), d = (T[`seo_${pag}_descripcion`] || '').trim();
    if (t) { document.title = t; meta('meta[property="og:title"]', t); meta('meta[name="twitter:title"]', t); }
    if (d) { meta('meta[name="description"]', d); meta('meta[property="og:description"]', d); meta('meta[name="twitter:description"]', d); }
  }

  /* ---------- Aviso arriba de todas las páginas ---------- */
  const COLORES_AVISO = { amarillo: 'var(--c2)', rosado: 'var(--c6)', celeste: 'var(--c4)', verde: 'var(--c3)', rojo: 'var(--c1)', morado: 'var(--c5)', negro: 'var(--tinta)' };
  function aviso(T) {
    let bar = document.querySelector('.aviso-sitio');
    const txt = (T.aviso_texto || '').trim();
    let cerrado = '';
    try { cerrado = sessionStorage.getItem('spectrumpro:aviso-cerrado') || ''; } catch { /* sin almacenamiento */ }
    if (!txt || T.aviso_activo === 'no' || (cerrado === txt && !enVistaPrevia)) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'aviso-sitio';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Aviso');
      document.body.prepend(bar);
    }
    const color = COLORES_AVISO[T.aviso_color] || COLORES_AVISO.amarillo;
    bar.style.setProperty('--aviso', color);
    bar.classList.toggle('oscuro', T.aviso_color === 'negro' || T.aviso_color === 'morado' || T.aviso_color === 'rojo');
    const enlace = (T.aviso_enlace || '').trim();
    bar.innerHTML = `<div class="wrap"><p>${esc(txt)}${enlace ? ` <a href="${esc(enlace)}"${/^https?:/.test(enlace) ? ' target="_blank" rel="noopener"' : ''}>${esc(T.aviso_boton || 'Ver más')} →</a>` : ''}</p>
      <button type="button" aria-label="Cerrar aviso">✕</button></div>`;
    bar.querySelector('button').onclick = () => { try { sessionStorage.setItem('spectrumpro:aviso-cerrado', txt); } catch { /* sin almacenamiento */ } bar.remove(); };
  }

  /* ---------- Vista previa desde la plataforma ----------
     La sección «Sitio web» de gestionspectrumpro.cl abre esta página en un marco con ?vista-previa
     y le envía el borrador: se pinta sin guardar nada. Solo se aceptan mensajes de la plataforma. */
  const ORIGENES = /^https:\/\/(www\.)?gestionspectrumpro\.cl$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  let enVistaPrevia = false;
  if (window.parent !== window && new URLSearchParams(location.search).has('vista-previa')) {
    window.addEventListener('message', e => {
      if (!ORIGENES.test(e.origin) || !e.data || typeof e.data !== 'object') return;
      if (e.data.tipo === 'sitio-vista-previa' && e.data.datos) { enVistaPrevia = true; pintar(e.data.datos); }
      if (e.data.tipo === 'sitio-resaltar' && typeof e.data.clave === 'string') {
        const el = document.querySelector(`[data-texto="${CSS.escape(e.data.clave)}"], [data-imagen="${CSS.escape(e.data.clave)}"], [data-seccion="${CSS.escape(e.data.clave)}"], [data-enlace="${CSS.escape(e.data.clave)}"]`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('resaltado-previa'); void el.offsetWidth; el.classList.add('resaltado-previa');
      }
    });
    // Los enlaces dentro de la vista previa siguen en modo vista previa.
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="/"]');
      if (a && !a.target) { e.preventDefault(); const u = new URL(a.href); u.searchParams.set('vista-previa', '1'); location.href = u; }
    });
    window.parent.postMessage({ tipo: 'sitio-lista', pagina: document.body.dataset.pagina || '' }, '*');
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

  const RESPALDO = window.SITIO_RESPALDO || { textos: {}, elementos: [] };
  pintar(guardado() || RESPALDO);
  desdeSupabase().then(d => {
    if (!d.elementos.length && !Object.keys(d.textos).length) return; // migración sin ejecutar aún
    // Listas nuevas (cinta, clientes, recursos, episodios) mientras no se ejecute la migración que las carga: se usa el respaldo.
    // (versión 3: recursos y episodios de la página Comunidad).
    if (Number(d.textos.version_contenido || 0) < 3) {
      const hay = new Set(d.elementos.map(x => x.tipo));
      d.elementos.push(...RESPALDO.elementos.filter(x => !hay.has(x.tipo)));
    }
    try { localStorage.setItem(CLAVE, JSON.stringify(d)); } catch { /* sin almacenamiento */ }
    if (!enVistaPrevia) pintar(d);
  }).catch(() => { /* se queda con lo ya pintado */ });
  vitrina();
})();
