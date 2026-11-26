'use strict';
/* SpectrumPro · Estudio de posts (solo dirección)
   Arma posts de Instagram con la gráfica de la marca, tomada de la plantilla de Canva
   «Plantillas posteos (Post de Instagram 4:5)»: Montserrat Bold, fondo negro o foto,
   paleta de seis colores y etiquetas de color. Cada post tiene una o más láminas
   (carrusel); cada lámina usa una plantilla. Se dibuja en <canvas> a tamaño real y se
   descarga en PNG. Usa las utilidades globales de app.js ($, esc, toast, confirmar…). */

(() => {

/* ---------- marca ---------- */
const PC = {
  negro: '#000000', blanco: '#ffffff', amarillo: '#f8dd40', rosado: '#e55dbe', celeste: '#30b4e7',
  verde: '#11b351', rojo: '#f6364b', morado: '#8d5dc5', grafito: '#21221c', papel: '#dcdcda',
};
const PC_NOMBRE = {
  negro: 'Negro', blanco: 'Blanco', amarillo: 'Amarillo', rosado: 'Rosado', celeste: 'Celeste', verde: 'Verde',
  rojo: 'Rojo', morado: 'Morado', grafito: 'Grafito', papel: 'Gris papel', arcoiris: 'Arcoíris (una palabra de cada color)',
};
const ARCOIRIS = ['rosado', 'celeste', 'verde', 'rojo', 'amarillo', 'morado'];
const VIVOS = ['amarillo', 'rosado', 'celeste', 'verde', 'rojo', 'morado'];
const FONDOS = ['negro', 'blanco', ...VIVOS];
const FORMATOS_POST = {
  post: { w: 1080, h: 1350, nombre: 'Post vertical 4:5', zona: { arriba: 60, abajo: 60 } },
  cuadrado: { w: 1080, h: 1080, nombre: 'Post cuadrado 1:1', zona: { arriba: 50, abajo: 50 } },
  historia: { w: 1080, h: 1920, nombre: 'Historia o portada de reel 9:16', zona: { arriba: 250, abajo: 320 } },
};
const LOGO_OPC = { auto: 'Automático', color: 'A color', blanco: 'Blanco', negro: 'Negro', ninguno: 'Sin logo' };
const ALINEAR = { center: 'Centrado', left: 'A la izquierda' };
const TINTA = { negro: 'Negro', blanco: 'Blanco' };
const fuentePost = (px, peso = 700) => `${peso} ${Math.round(px)}px Montserrat, "Segoe UI", sans-serif`;

function luz(hex) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const hexDe = k => PC[k] || (/^#[0-9a-f]{6}$/i.test(k || '') ? k : PC.negro);
const tintaSobre = fondo => luz(hexDe(fondo)) > 0.45 ? PC.grafito : PC.blanco;
const esClaro = fondo => luz(hexDe(fondo)) > 0.45;

/* ---------- recursos: logo en tres versiones y fotos ---------- */
const logos = {};
async function cargarLogos() {
  if (logos.color) return;
  const svg = await (await fetch('assets/logo.svg')).text();
  const version = txt => new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
  });
  const mono = c => svg.replace(/fill="#[0-9a-f]{6}"/gi, `fill="${c}"`);
  [logos.color, logos.blanco, logos.negro] = await Promise.all([version(svg), version(mono('#ffffff')), version(mono('#1c1c1a'))]);
}
const imagenes = new Map();   // src → HTMLImageElement cargada (o null mientras carga)
function imagen(src) {
  if (!src) return null;
  if (imagenes.has(src)) return imagenes.get(src);
  imagenes.set(src, null);
  const img = new Image();
  img.onload = () => { imagenes.set(src, img); pedirPintado(); };
  img.onerror = () => imagenes.delete(src);
  img.src = src;
  return null;
}

/* ---------- dibujo: texto ---------- */
function maquetar(ctx, texto, ancho, px) {
  ctx.font = fuentePost(px);
  const lineas = [];
  for (const parrafo of String(texto || '').split('\n')) {
    const palabras = parrafo.split(/ +/).filter(Boolean);
    if (!palabras.length) { lineas.push([]); continue; }
    let actual = [], w = 0;
    const esp = ctx.measureText(' ').width;
    for (let p of palabras) {
      // Una palabra más ancha que la caja se corta en trozos.
      while (ctx.measureText(p).width > ancho && p.length > 1) {
        let i = p.length - 1;
        while (i > 1 && ctx.measureText(p.slice(0, i)).width > ancho) i--;
        if (actual.length) { lineas.push(actual); actual = []; w = 0; }
        lineas.push([p.slice(0, i)]);
        p = p.slice(i);
      }
      const pw = ctx.measureText(p).width;
      const nuevo = actual.length ? w + esp + pw : pw;
      if (nuevo > ancho && actual.length) { lineas.push(actual); actual = [p]; w = pw; }
      else { actual.push(p); w = nuevo; }
    }
    lineas.push(actual);
  }
  return lineas;
}
function ajustarTexto(ctx, texto, ancho, alto, max, min, interlineado = 1.4) {
  for (let px = max; px > min; px -= 2) {
    const l = maquetar(ctx, texto, ancho, px);
    if (l.length * px * interlineado <= alto) return { px, lineas: l };
  }
  return { px: min, lineas: maquetar(ctx, texto, ancho, min) };
}
// Escribe línea a línea; con «colores» cada palabra toma el siguiente color (estilo arcoíris).
function escribir(ctx, lineas, { x, y, ancho, px, interlineado = 1.4, alinear = 'left', color = PC.blanco, colores = null }) {
  ctx.font = fuentePost(px);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const alto = px * interlineado, esp = ctx.measureText(' ').width;
  let n = 0;
  lineas.forEach((ln, i) => {
    const ws = ln.map(p => ctx.measureText(p).width);
    const total = ws.reduce((a, b) => a + b, 0) + esp * Math.max(0, ln.length - 1);
    let cx = alinear === 'center' ? x + (ancho - total) / 2 : alinear === 'right' ? x + ancho - total : x;
    const cy = y + i * alto + alto / 2 + px * 0.04;
    ln.forEach((p, j) => {
      ctx.fillStyle = colores ? colores[n % colores.length] : color;
      ctx.fillText(p, cx, cy);
      cx += ws[j] + esp; n++;
    });
  });
  return lineas.length * alto;
}
// Etiqueta: rectángulo de color con texto (los «chips» de la marca).
function etiqueta(ctx, texto, x, y, { fondo, px, alto, minAncho = 0, maxAncho = 980, padX = 34, ancla = 'left', tinta }) {
  ctx.font = fuentePost(px);
  let tw = ctx.measureText(texto).width;
  while (tw + padX * 2 > maxAncho && px > 16) { px -= 2; ctx.font = fuentePost(px); tw = ctx.measureText(texto).width; }
  const w = Math.max(minAncho, tw + padX * 2), h = alto || px * 1.7;
  const izq = ancla === 'right' ? x - w : ancla === 'center' ? x - w / 2 : x;
  ctx.fillStyle = hexDe(fondo);
  ctx.fillRect(izq, y, w, h);
  ctx.fillStyle = tinta || tintaSobre(fondo);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(texto, izq + w / 2, y + h / 2 + px * 0.04);
  ctx.textAlign = 'left';
  return { x: izq, y, w, h };
}

/* ---------- dibujo: fotos y logo ---------- */
function foto(ctx, f, x, y, w, h, vacio = '#cfcbdc') {
  const img = imagen(f?.src);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (!img) {
    ctx.fillStyle = vacio; ctx.fillRect(x, y, w, h);
    if (vacio !== PC.papel) {
      ctx.fillStyle = 'rgba(30,27,52,.45)';
      ctx.font = fuentePost(Math.min(40, w / 8)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(f?.src ? 'Cargando foto…' : 'Sube una foto', x + w / 2, y + h / 2);
      ctx.textAlign = 'left';
    }
  } else {
    const zoom = Math.max(1, Number(f.zoom) || 1);
    const escala = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
    const iw = img.naturalWidth * escala, ih = img.naturalHeight * escala;
    const px = (Number(f.x ?? 50)) / 100, py = (Number(f.y ?? 50)) / 100;
    ctx.drawImage(img, x - (iw - w) * px, y - (ih - h) * py, iw, ih);
  }
  ctx.restore();
}
function papel(ctx, x, y, w, h) {
  const g = ctx.createRadialGradient(x + w * 0.5, y + h * 0.4, 50, x + w * 0.5, y + h * 0.5, Math.max(w, h));
  g.addColorStop(0, '#e6e6e4'); g.addColorStop(1, '#c9c9c6');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
function logo(ctx, variante, W, H, zona, fondoClaro) {
  if (variante === 'ninguno') return;
  const v = variante === 'auto' || !variante ? (fondoClaro ? 'negro' : 'color') : variante;
  const img = logos[v];
  if (!img) return;
  const w = 100, h = w * 73 / 75;
  ctx.drawImage(img, W - 78 - w, H - zona.abajo - h, w, h);
}
const comillas = s => /^[“"«']/.test(s) ? s : `“${s}”`;

/* ---------- plantillas ---------- */
// Cada campo: k (clave), tipo (texto | area | color | opcion | foto), etiqueta, y opciones según el tipo.
// «si» decide si el campo se muestra según los demás valores de la lámina.
const PLANTILLAS = {
  portada: {
    nombre: 'Título grande',
    desc: 'Fondo de color con un título en Montserrat. Ideal para portadas de carrusel.',
    base: { texto: '¿Qué es\nSpectrum Pro?', fondo: 'negro', colorTexto: 'amarillo', alinear: 'center', logo: 'auto' },
    campos: [
      { k: 'texto', tipo: 'area', etiqueta: 'Título', filas: 3 },
      { k: 'fondo', tipo: 'color', etiqueta: 'Fondo', opciones: FONDOS },
      { k: 'colorTexto', tipo: 'color', etiqueta: 'Color del texto', opciones: ['amarillo', 'blanco', 'negro', 'rosado', 'celeste', 'verde', 'rojo', 'morado', 'arcoiris'] },
      { k: 'alinear', tipo: 'opcion', etiqueta: 'Alineación', opciones: ALINEAR },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      ctx.fillStyle = hexDe(d.fondo); ctx.fillRect(0, 0, W, H);
      const x = 90, ancho = W - 180;
      const { px, lineas } = ajustarTexto(ctx, d.texto, ancho, H * 0.58, 104, 40);
      const alto = lineas.length * px * 1.4;
      const y = Math.max(Z.arriba + 40, H * 0.42 - alto / 2);
      const colores = d.colorTexto === 'arcoiris' ? ARCOIRIS.filter(c => c !== d.fondo).map(hexDe) : null;
      escribir(ctx, lineas, { x, y, ancho, px, alinear: d.alinear, color: hexDe(d.colorTexto), colores });
      logo(ctx, d.logo, W, H, Z, esClaro(d.fondo));
    },
  },

  fotoEtiquetas: {
    nombre: 'Foto con etiquetas',
    desc: 'Una, dos o tres fotos a todo el alto con dos etiquetas de color.',
    base: { nFotos: '1', etiqueta1: 'Spectrumpro', color1: 'amarillo', etiqueta2: 'Salidas', color2: 'celeste', posicion: 'abajo', logo: 'ninguno' },
    campos: [
      { k: 'nFotos', tipo: 'opcion', etiqueta: 'Fotos', opciones: { 1: 'Una foto', 2: 'Dos fotos', 3: 'Tres fotos' } },
      { k: 'foto1', tipo: 'foto', etiqueta: 'Foto 1' },
      { k: 'foto2', tipo: 'foto', etiqueta: 'Foto 2', si: d => d.nFotos >= 2 },
      { k: 'foto3', tipo: 'foto', etiqueta: 'Foto 3', si: d => d.nFotos >= 3 },
      { k: 'etiqueta1', tipo: 'texto', etiqueta: 'Etiqueta pequeña' },
      { k: 'color1', tipo: 'color', etiqueta: 'Color etiqueta pequeña', opciones: [...VIVOS, 'blanco', 'grafito'] },
      { k: 'etiqueta2', tipo: 'texto', etiqueta: 'Etiqueta grande' },
      { k: 'color2', tipo: 'color', etiqueta: 'Color etiqueta grande', opciones: [...VIVOS, 'blanco', 'grafito'] },
      { k: 'posicion', tipo: 'opcion', etiqueta: 'Posición de las etiquetas', opciones: { abajo: 'Abajo', centro: 'Al centro', arriba: 'Arriba' } },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      const n = Math.min(3, Math.max(1, Number(d.nFotos) || 1)), cw = W / n;
      for (let i = 0; i < n; i++) foto(ctx, d['foto' + (i + 1)], Math.round(i * cw), 0, Math.ceil(cw), H);
      const e1 = (d.etiqueta1 || '').trim(), e2 = (d.etiqueta2 || '').trim();
      ctx.font = fuentePost(55); const w1 = e1 ? Math.max(520, ctx.measureText(e1).width + 68) : 0;
      ctx.font = fuentePost(70); const w2 = e2 ? Math.max(520, ctx.measureText(e2).width + 68) : 0;
      const grupoW = Math.min(W - 80, Math.max(w1, e2 ? 84 + w2 : 0));
      const x0 = (W - grupoW) / 2, altoGrupo = (e1 ? 113 : 0) + (e2 ? 119 : 0);
      let y = d.posicion === 'arriba' ? Z.arriba + 80 : d.posicion === 'centro' ? (H - altoGrupo) / 2 : H - Z.abajo - 105 - altoGrupo;
      if (e1) { etiqueta(ctx, e1, x0, y, { fondo: d.color1, px: 55, alto: 113, minAncho: 520, maxAncho: W - 80 }); y += 113; }
      if (e2) etiqueta(ctx, e2, e1 ? x0 + 84 : x0, y, { fondo: d.color2, px: 70, alto: 119, minAncho: 520, maxAncho: W - 80 - (e1 ? 84 : 0) });
      logo(ctx, d.logo, W, H, Z, false);
    },
  },

  fichaTaller: {
    nombre: 'Foto con ficha',
    desc: 'Foto de fondo y una ficha blanca con barra de color. Para talleres, horarios e inscripciones.',
    base: {
      titulo: 'Spectrum PRO', subtitulo: 'Referentes', colorBarra: 'rojo', logo: 'negro',
      texto: 'II Semestre (agosto a diciembre)\nJueves de 9:00 a 12:45\nProfesores: Gabriela Banderas y Gonzalo Pavez\n\nINSCRIPCIONES EN LA BIO',
    },
    campos: [
      { k: 'foto1', tipo: 'foto', etiqueta: 'Foto de fondo' },
      { k: 'titulo', tipo: 'texto', etiqueta: 'Título de la barra (izquierda)' },
      { k: 'subtitulo', tipo: 'texto', etiqueta: 'Texto de la barra (derecha, opcional)' },
      { k: 'colorBarra', tipo: 'color', etiqueta: 'Color de la barra', opciones: [...VIVOS, 'grafito'] },
      { k: 'texto', tipo: 'area', etiqueta: 'Texto de la ficha', filas: 6 },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      foto(ctx, d.foto1, 0, 0, W, H);
      const x = 125, w = W - 250, barra = 76, pad = 18;
      const { px, lineas } = ajustarTexto(ctx, d.texto, w - pad * 2, H * 0.45, 30, 18);
      const altoTxt = (d.texto || '').trim() ? lineas.length * px * 1.4 : 0;
      const alto = barra + (altoTxt ? 24 + altoTxt + 26 : 0);
      const abajo = H - Z.abajo - 64, y = abajo - alto;
      ctx.fillStyle = PC.blanco; ctx.fillRect(x, y, w, alto);
      ctx.fillStyle = hexDe(d.colorBarra); ctx.fillRect(x, y, w, barra);
      const tinta = tintaSobre(d.colorBarra);
      ctx.font = fuentePost(37.6); ctx.textBaseline = 'middle'; ctx.fillStyle = tinta;
      const sub = (d.subtitulo || '').trim();
      const wSub = sub ? ctx.measureText(sub).width : 0;
      const tit = (d.titulo || '').trim();
      if (tit) {
        let t = tit; const maxT = w - pad * 2 - (sub ? wSub + 40 : 0);
        while (ctx.measureText(t).width > maxT && t.length > 1) t = t.slice(0, -2) + '…';
        ctx.textAlign = 'left'; ctx.fillText(t, x + pad, y + barra / 2 + 2);
      }
      if (sub) { ctx.textAlign = 'right'; ctx.fillText(sub, x + w - pad - 14, y + barra / 2 + 2); ctx.textAlign = 'left'; }
      if (altoTxt) escribir(ctx, lineas, { x: x + pad, y: y + barra + 24, ancho: w - pad * 2, px, color: PC.negro });
      logo(ctx, d.logo, W, H, Z, true);
    },
  },

  bloqueColor: {
    nombre: 'Foto arriba y bloque de color',
    desc: 'Foto en la mitad de arriba; abajo un bloque de color con dos etiquetas y un texto.',
    base: {
      etiqueta1: 'Taller de', color1: 'morado', etiqueta2: 'Cortometrajes', color2: 'grafito', fondo: 'celeste',
      texto: 'Forma parte de un espacio colaborativo donde vivirás el proceso cinematográfico completo: desde el guion y el rodaje hasta la postproducción.',
      alinear: 'center', colorTexto: 'negro', logo: 'negro',
    },
    campos: [
      { k: 'foto1', tipo: 'foto', etiqueta: 'Foto' },
      { k: 'etiqueta1', tipo: 'texto', etiqueta: 'Etiqueta 1' },
      { k: 'color1', tipo: 'color', etiqueta: 'Color etiqueta 1', opciones: [...VIVOS, 'grafito', 'blanco'] },
      { k: 'etiqueta2', tipo: 'texto', etiqueta: 'Etiqueta 2' },
      { k: 'color2', tipo: 'color', etiqueta: 'Color etiqueta 2', opciones: [...VIVOS, 'grafito', 'blanco'] },
      { k: 'fondo', tipo: 'color', etiqueta: 'Color del bloque', opciones: [...VIVOS, 'negro', 'blanco'] },
      { k: 'texto', tipo: 'area', etiqueta: 'Texto', filas: 6 },
      { k: 'alinear', tipo: 'opcion', etiqueta: 'Alineación', opciones: ALINEAR },
      { k: 'colorTexto', tipo: 'opcion', etiqueta: 'Color del texto', opciones: TINTA },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) { pintarBloque(ctx, d, W, H, Z, { corte: 0.5, lado: 'centro' }); },
  },

  perfil: {
    nombre: 'Presentación del equipo',
    desc: 'Retrato arriba, nombre y apellido en etiquetas y una biografía corta.',
    base: {
      etiqueta1: 'Nombre', color1: 'grafito', etiqueta2: 'Apellido', color2: 'morado', fondo: 'amarillo',
      texto: 'Docente y artista. En Spectrumpro lidera el área de… y acompaña a los jóvenes en…', alinear: 'left', colorTexto: 'negro', logo: 'negro',
    },
    campos: [
      { k: 'foto1', tipo: 'foto', etiqueta: 'Retrato (sin foto queda fondo de papel)' },
      { k: 'etiqueta1', tipo: 'texto', etiqueta: 'Nombre' },
      { k: 'color1', tipo: 'color', etiqueta: 'Color del nombre', opciones: ['grafito', ...VIVOS] },
      { k: 'etiqueta2', tipo: 'texto', etiqueta: 'Apellido' },
      { k: 'color2', tipo: 'color', etiqueta: 'Color del apellido', opciones: ['morado', ...VIVOS.filter(c => c !== 'morado'), 'grafito'] },
      { k: 'fondo', tipo: 'color', etiqueta: 'Color del bloque', opciones: [...VIVOS, 'blanco', 'negro'] },
      { k: 'texto', tipo: 'area', etiqueta: 'Biografía', filas: 5 },
      { k: 'colorTexto', tipo: 'opcion', etiqueta: 'Color del texto', opciones: TINTA },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) { pintarBloque(ctx, { ...d, alinear: 'left' }, W, H, Z, { corte: 0.6, lado: 'izquierda', papel: true }); },
  },

  testimonios: {
    nombre: 'Frases y testimonios',
    desc: 'Frases de colores sobre fondo negro. Escribe una frase por línea.',
    base: {
      frases: 'Me encanta porque me encuentro con mis amigos\nLo pasamos bien haciendo lo que nos gusta\nEs un espacio seguro, me siento super cómodo\nLo que más me gusta de Spectrum es que siempre pasan cosas entretenidas\nHay gente super talentosa y creativa',
      fondo: 'negro', comillas: 'si', logo: 'blanco',
    },
    campos: [
      { k: 'frases', tipo: 'area', etiqueta: 'Frases (una por línea)', filas: 7 },
      { k: 'fondo', tipo: 'color', etiqueta: 'Fondo', opciones: ['negro', 'blanco', 'grafito'] },
      { k: 'comillas', tipo: 'opcion', etiqueta: 'Comillas', opciones: { si: 'Agregar comillas', no: 'Sin comillas' } },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      ctx.fillStyle = hexDe(d.fondo); ctx.fillRect(0, 0, W, H);
      const frases = String(d.frases || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => d.comillas === 'no' ? s : comillas(s));
      const colores = ['celeste', 'verde', 'amarillo', 'rosado', 'morado', 'rojo'].filter(c => !(esClaro(d.fondo) && c === 'amarillo')).map(hexDe);
      const top = Z.arriba + 50, bottom = H - Z.abajo - 140, areaH = bottom - top;
      const unaCol = frases.length <= 2;
      const cols = unaCol ? [{ x: 70, w: W - 140 }] : [{ x: 60, w: 440 }, { x: 580, w: 440 }];
      let plan = null;
      for (let px = unaCol ? 84 : 60; px >= 22; px -= 2) {
        const alturas = cols.map((c, i) => (i ? px * 1.6 : 0)), items = [];
        for (const f of frases) {
          const ci = alturas.indexOf(Math.min(...alturas));
          const l = maquetar(ctx, f, cols[ci].w, px);
          items.push({ ci, y: alturas[ci], lineas: l });
          alturas[ci] += l.length * px * 1.4 + px * 1.1;
        }
        plan = { px, items, alto: Math.max(...alturas) - px * 1.1 };
        if (plan.alto <= areaH) break;
      }
      if (!plan) return logo(ctx, d.logo, W, H, Z, esClaro(d.fondo));
      const y0 = top + Math.max(0, (areaH - plan.alto) / 2);
      plan.items.forEach((it, i) => escribir(ctx, it.lineas, { x: cols[it.ci].x, y: y0 + it.y, ancho: cols[it.ci].w, px: plan.px, color: colores[i % colores.length] }));
      logo(ctx, d.logo, W, H, Z, esClaro(d.fondo));
    },
  },

  textoFoto: {
    nombre: 'Texto arriba y foto abajo',
    desc: 'Bloque de color con un texto largo y una foto abajo, con etiqueta opcional.',
    base: {
      texto: 'Escribe aquí el texto de la publicación. Puedes usar varios párrafos.', fondo: 'rosado', colorTexto: 'negro',
      etiqueta: '', colorEtiqueta: 'morado', logo: 'blanco',
    },
    campos: [
      { k: 'texto', tipo: 'area', etiqueta: 'Texto', filas: 6 },
      { k: 'fondo', tipo: 'color', etiqueta: 'Color del bloque', opciones: [...VIVOS, 'negro', 'blanco'] },
      { k: 'colorTexto', tipo: 'opcion', etiqueta: 'Color del texto', opciones: TINTA },
      { k: 'foto1', tipo: 'foto', etiqueta: 'Foto' },
      { k: 'etiqueta', tipo: 'texto', etiqueta: 'Etiqueta sobre la foto (opcional)' },
      { k: 'colorEtiqueta', tipo: 'color', etiqueta: 'Color de la etiqueta', opciones: [...VIVOS, 'grafito'] },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      const corte = Math.round(H * 0.55);
      ctx.fillStyle = hexDe(d.fondo); ctx.fillRect(0, 0, W, corte);
      foto(ctx, d.foto1, 0, corte, W, H - corte);
      const top = Z.arriba + 30, ancho = W - 100;
      const { px, lineas } = ajustarTexto(ctx, d.texto, ancho, corte - top - 120, 46, 20);
      escribir(ctx, lineas, { x: 50, y: top, ancho, px, color: d.colorTexto === 'blanco' ? PC.blanco : PC.negro });
      ctx.fillStyle = PC.grafito; ctx.fillRect(50, corte - 75, 80, 75);
      const et = (d.etiqueta || '').trim();
      if (et) etiqueta(ctx, et, 100, corte, { fondo: d.colorEtiqueta, px: 36, alto: 75, minAncho: 305 });
      else { ctx.fillStyle = hexDe(d.colorEtiqueta); ctx.fillRect(100, corte, 305, 75); }
      logo(ctx, d.logo, W, H, Z, false);
    },
  },

  titulares: {
    nombre: 'Foto con titulares',
    desc: 'Foto a pantalla completa con una o dos frases en etiquetas inclinadas.',
    base: { linea1: '¡Qué bien estuvo!', linea2: '¡Vamos nuevamente x más!', color: 'rosado', oscurecer: '20', logo: 'blanco' },
    campos: [
      { k: 'foto1', tipo: 'foto', etiqueta: 'Foto' },
      { k: 'linea1', tipo: 'texto', etiqueta: 'Frase 1' },
      { k: 'linea2', tipo: 'texto', etiqueta: 'Frase 2 (opcional)' },
      { k: 'color', tipo: 'color', etiqueta: 'Color de las etiquetas', opciones: [...VIVOS, 'blanco', 'grafito'] },
      { k: 'oscurecer', tipo: 'opcion', etiqueta: 'Oscurecer la foto', opciones: { 0: 'No', 20: 'Un poco', 40: 'Bastante' } },
      { k: 'logo', tipo: 'opcion', etiqueta: 'Logo', opciones: LOGO_OPC },
    ],
    pintar(ctx, d, W, H, Z) {
      foto(ctx, d.foto1, 0, 0, W, H);
      const os = Number(d.oscurecer) || 0;
      if (os) { ctx.fillStyle = `rgba(0,0,0,${os / 100})`; ctx.fillRect(0, 0, W, H); }
      const l1 = (d.linea1 || '').trim(), l2 = (d.linea2 || '').trim();
      ctx.save();
      ctx.translate(W / 2, H * 0.47);
      ctx.rotate(-2.5 * Math.PI / 180);
      if (l1) etiqueta(ctx, l1, 0, l2 ? -100 : -50, { fondo: d.color, px: 46, alto: 92, padX: 40, ancla: 'center', maxAncho: W - 140 });
      if (l2) etiqueta(ctx, l2, 30, l1 ? 14 : -50, { fondo: d.color, px: 46, alto: 92, padX: 40, ancla: 'center', maxAncho: W - 140 });
      ctx.restore();
      logo(ctx, d.logo, W, H, Z, false);
    },
  },
};

function pintarBloque(ctx, d, W, H, Z, { corte, lado, papel: conPapel }) {
  const y0 = Math.round(H * corte);
  if (conPapel && !d.foto1?.src) papel(ctx, 0, 0, W, y0);
  else foto(ctx, d.foto1, 0, 0, W, y0);
  ctx.fillStyle = hexDe(d.fondo); ctx.fillRect(0, y0, W, H - y0);
  const e1 = (d.etiqueta1 || '').trim(), e2 = (d.etiqueta2 || '').trim();
  const px = 45, alto = 84;
  if (lado === 'centro') {
    if (e1) etiqueta(ctx, e1, 513, y0 - alto, { fondo: d.color1, px, alto, minAncho: 230, maxAncho: W - 513 - 20 });
    if (e2) etiqueta(ctx, e2, 480, y0, { fondo: d.color2, px, alto, minAncho: 515, maxAncho: W - 480 - 20 });
  } else {
    if (e1) etiqueta(ctx, e1, 170, y0 - alto, { fondo: d.color1, px, alto, minAncho: 300, maxAncho: W - 190 });
    if (e2) etiqueta(ctx, e2, 310, y0, { fondo: d.color2, px, alto, minAncho: 345, maxAncho: W - 330 });
  }
  const x = lado === 'centro' ? 50 : 70, ancho = W - x * 2;
  const top = y0 + (e2 ? alto : 0) + 40, bottom = H - Z.abajo - 120;
  const { px: tpx, lineas } = ajustarTexto(ctx, d.texto, ancho, bottom - top, 34, 18);
  escribir(ctx, lineas, { x, y: top, ancho, px: tpx, alinear: d.alinear, color: d.colorTexto === 'blanco' ? PC.blanco : PC.negro });
  logo(ctx, d.logo, W, H, Z, esClaro(d.fondo));
}

/* ---------- estado del estudio ---------- */
const EP = {
  tab: 'crear',
  post: null,        // { id, titulo, formato, laminas: [{ uid, plantilla, ...campos }] }
  activa: 0,
  sucio: false,
  lista: null,       // posts guardados (sin «datos»)
};
const blobsNuevos = new Map();   // object URL → Blob (fotos subidas que aún no se guardan)
const refsFoto = new Map();      // object URL → referencia guardada («sb:ruta» o data URL)
const uid = () => Math.random().toString(36).slice(2, 10);
const nuevaLamina = (plantilla = 'portada', previa = {}) => {
  const lam = { uid: uid(), plantilla, ...JSON.parse(JSON.stringify(PLANTILLAS[plantilla].base)) };
  // Al cambiar de plantilla se conservan el texto y las fotos que encajen.
  for (const k of ['texto', 'foto1', 'foto2', 'foto3']) if (previa[k] && PLANTILLAS[plantilla].campos.some(c => c.k === k)) lam[k] = previa[k];
  return lam;
};
const nuevoPost = () => ({ id: null, titulo: 'Post sin título', formato: 'post', laminas: [nuevaLamina('portada')] });
const lamina = () => EP.post.laminas[EP.activa];

/* ---------- pintado ---------- */
function pintarLamina(canvas, lam, formato, ancho = null) {
  const F = FORMATOS_POST[formato] || FORMATOS_POST.post;
  const k = ancho ? ancho / F.w : 1;
  canvas.width = Math.round(F.w * k); canvas.height = Math.round(F.h * k);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, F.w, F.h);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, F.w, F.h);
  (PLANTILLAS[lam.plantilla] || PLANTILLAS.portada).pintar(ctx, lam, F.w, F.h, F.zona);
}
let pintadoPendiente = 0;
function pedirPintado() {
  if (pintadoPendiente) return;
  pintadoPendiente = requestAnimationFrame(() => {
    pintadoPendiente = 0;
    const lienzo = $('#ep-lienzo');
    if (!lienzo || !EP.post) return;
    pintarLamina(lienzo, lamina(), EP.post.formato);
    EP.post.laminas.forEach((l, i) => { const c = $(`#ep-mini-${l.uid}`); if (c) pintarLamina(c, l, EP.post.formato, 144); });
  });
}

/* ---------- vista ---------- */
let fuentesListas = false;
async function prepararRecursos() {
  if (fuentesListas) return;
  try { await Promise.all([document.fonts.load('700 40px Montserrat'), cargarLogos()]); } catch { /* se pinta con la fuente de respaldo */ }
  fuentesListas = true;
}

function vistaPosts(el) {
  if (!puede.admin()) { location.hash = 'panel'; return; }
  if (!EP.post) EP.post = nuevoPost();
  el.innerHTML = `
    <header class="cabecera">
      <div><p class="eyebrow">Solo dirección</p><h1>Posts</h1><p>Crea posts para Instagram con la gráfica de SpectrumPro y descárgalos listos para publicar.</p></div>
      <div class="pestanas" role="tablist" aria-label="Secciones de posts">
        <button type="button" role="tab" data-ep-tab="crear" aria-pressed="${EP.tab === 'crear'}" aria-selected="${EP.tab === 'crear'}">Crear</button>
        <button type="button" role="tab" data-ep-tab="guardados" aria-pressed="${EP.tab === 'guardados'}" aria-selected="${EP.tab === 'guardados'}">Guardados</button>
      </div>
    </header>
    <div id="ep-cuerpo"></div>`;
  const c = $('#ep-cuerpo', el);
  if (EP.tab === 'guardados') return pintarGuardados(c);
  pintarEstudio(c);
  // La primera vez se vuelve a pintar cuando llegan la fuente y el logo.
  if (!fuentesListas) prepararRecursos().then(() => { if (location.hash === '#posts' && EP.tab === 'crear') render(); });
}

function pintarEstudio(c) {
  const p = EP.post;
  c.innerHTML = `
    <div class="estudio">
      <section class="estudio-vista" aria-label="Vista previa">
        <div class="ep-lienzo-caja ep-${p.formato}"><canvas id="ep-lienzo" aria-label="Vista previa de la lámina ${EP.activa + 1}"></canvas></div>
        <div class="ep-acciones">
          <button type="button" class="btn" data-ep="descargar">Descargar lámina</button>
          ${p.laminas.length > 1 ? `<button type="button" class="btn btn-sec" data-ep="descargar-todo">Descargar las ${p.laminas.length} (ZIP)</button>` : ''}
          <button type="button" class="btn btn-sec" data-ep="compartir" hidden>Compartir…</button>
        </div>
        <p class="nota-suave">Se descarga en PNG a ${FORMATOS_POST[p.formato].w}×${FORMATOS_POST[p.formato].h} px, el tamaño que usa Instagram.</p>
      </section>

      <section class="tarjeta estudio-panel pila">
        <div class="campos">
          <label>Nombre del post<input id="ep-titulo" value="${esc(p.titulo)}" maxlength="140" autocomplete="off"></label>
          <label>Formato
            <select id="ep-formato">${Object.entries(FORMATOS_POST).map(([k, f]) => `<option value="${k}" ${k === p.formato ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select>
          </label>
        </div>

        <div>
          <p class="campo-titulo">Láminas <small class="muted">· un carrusel puede tener hasta 20</small></p>
          <div class="ep-laminas" role="list">
            ${p.laminas.map((l, i) => `
              <button type="button" role="listitem" class="ep-mini" data-ep-lamina="${i}" aria-current="${i === EP.activa}" aria-label="Lámina ${i + 1}: ${esc(PLANTILLAS[l.plantilla].nombre)}">
                <canvas id="ep-mini-${l.uid}" width="144" height="180"></canvas><span>${i + 1}</span>
              </button>`).join('')}
            ${p.laminas.length < 20 ? '<button type="button" class="ep-mini ep-mas" data-ep="agregar" aria-label="Agregar lámina"><span>+</span></button>' : ''}
          </div>
          <div class="controles ep-lamina-acc">
            <button type="button" class="btn btn-sec btn-peq" data-ep="mover" data-dir="-1" ${EP.activa === 0 ? 'disabled' : ''} aria-label="Mover lámina a la izquierda">←</button>
            <button type="button" class="btn btn-sec btn-peq" data-ep="mover" data-dir="1" ${EP.activa === p.laminas.length - 1 ? 'disabled' : ''} aria-label="Mover lámina a la derecha">→</button>
            <button type="button" class="btn btn-sec btn-peq" data-ep="duplicar" ${p.laminas.length >= 20 ? 'disabled' : ''}>Duplicar</button>
            <button type="button" class="btn btn-sec btn-peq" data-ep="quitar" ${p.laminas.length === 1 ? 'disabled' : ''}>Eliminar lámina</button>
          </div>
        </div>

        <details class="ep-plantillas" ${lamina().nueva ? 'open' : ''}>
          <summary>Plantilla de la lámina ${EP.activa + 1}: <b>${esc(PLANTILLAS[lamina().plantilla].nombre)}</b></summary>
          <div class="ep-plantillas-grid">
            ${Object.entries(PLANTILLAS).map(([k, t]) => `
              <button type="button" class="ep-plantilla" data-ep-plantilla="${k}" aria-pressed="${k === lamina().plantilla}" title="${esc(t.desc)}">
                <canvas data-ep-muestra="${k}" width="120" height="150"></canvas><span>${esc(t.nombre)}</span>
              </button>`).join('')}
          </div>
        </details>

        <div id="ep-campos" class="pila"></div>

        <div class="ep-pie">
          <button type="button" class="btn btn-sec" data-ep="nuevo">Nuevo post</button>
          <button type="button" class="btn" data-ep="guardar">${p.id ? 'Guardar cambios' : 'Guardar post'}</button>
        </div>
        <p class="nota-suave" id="ep-estado">${p.id ? (EP.sucio ? 'Hay cambios sin guardar.' : 'Guardado.') : 'Aún no se ha guardado.'}</p>
      </section>
    </div>`;
  delete lamina().nueva;
  pintarCampos();
  $$('[data-ep-muestra]', c).forEach(cv => {
    const k = cv.dataset.epMuestra;
    const muestra = { ...nuevaLamina(k) };
    pintarLamina(cv, muestra, 'post', 120);
  });
  const compartir = $('[data-ep="compartir"]', c);
  try { compartir.hidden = !(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })); } catch { compartir.hidden = true; }
  pedirPintado();
}

function pintarCampos() {
  const caja = $('#ep-campos');
  if (!caja) return;
  const lam = lamina(), t = PLANTILLAS[lam.plantilla];
  caja.innerHTML = `<div class="campos">${t.campos.filter(f => !f.si || f.si(lam)).map(f => campoHTML(f, lam)).join('')}</div>`;
}

function campoHTML(f, lam) {
  const v = lam[f.k];
  const id = `ep-c-${f.k}`;
  if (f.tipo === 'texto') return `<label class="ancho">${esc(f.etiqueta)}<input id="${id}" data-ep-campo="${f.k}" value="${esc(v || '')}" autocomplete="off" maxlength="120"></label>`;
  if (f.tipo === 'area') return `<label class="ancho">${esc(f.etiqueta)}<textarea id="${id}" data-ep-campo="${f.k}" rows="${f.filas || 3}" maxlength="2000">${esc(v || '')}</textarea></label>`;
  if (f.tipo === 'opcion') return `<label>${esc(f.etiqueta)}<select id="${id}" data-ep-campo="${f.k}">${Object.entries(f.opciones).map(([k, n]) => `<option value="${k}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
  if (f.tipo === 'color') return `
    <div class="ancho ep-color" role="group" aria-label="${esc(f.etiqueta)}">
      <span class="ep-lbl">${esc(f.etiqueta)}: <b>${esc(PC_NOMBRE[v] || v)}</b></span>
      <div class="ep-muestras">${f.opciones.map(o => `<button type="button" class="ep-muestra ${o === 'arcoiris' ? 'ep-arcoiris' : ''}" style="--c:${o === 'arcoiris' ? 'transparent' : hexDe(o)}" data-ep-color="${f.k}" data-valor="${o}" aria-pressed="${o === v}" title="${esc(PC_NOMBRE[o] || o)}" aria-label="${esc(PC_NOMBRE[o] || o)}"></button>`).join('')}</div>
    </div>`;
  if (f.tipo === 'foto') {
    const fv = v || {};
    return `
    <div class="ancho ep-foto" data-ep-foto="${f.k}">
      <span class="ep-lbl">${esc(f.etiqueta)}</span>
      <div class="ep-foto-fila">
        ${fv.src ? `<img src="${esc(fv.src)}" alt="" class="ep-foto-mini">` : '<span class="ep-foto-mini ep-foto-vacia" aria-hidden="true"></span>'}
        <label class="btn btn-sec btn-peq ep-subir">${fv.src ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" data-ep-archivo="${f.k}" hidden></label>
        ${fv.src ? `<button type="button" class="btn btn-sec btn-peq" data-ep-quitar-foto="${f.k}">Quitar</button>` : ''}
      </div>
      ${fv.src ? `
      <div class="ep-ajustes">
        <label>Zoom<input type="range" min="1" max="3" step="0.01" value="${fv.zoom || 1}" data-ep-ajuste="${f.k}" data-prop="zoom"></label>
        <label>Horizontal<input type="range" min="0" max="100" step="1" value="${fv.x ?? 50}" data-ep-ajuste="${f.k}" data-prop="x"></label>
        <label>Vertical<input type="range" min="0" max="100" step="1" value="${fv.y ?? 50}" data-ep-ajuste="${f.k}" data-prop="y"></label>
      </div>` : ''}
    </div>`;
  }
  return '';
}

function marcarSucio() {
  EP.sucio = true;
  const e = $('#ep-estado'); if (e) e.textContent = 'Hay cambios sin guardar.';
}

/* ---------- fotos ---------- */
// Se achica la foto a 2400 px por lado y se guarda en JPEG (PNG si tiene transparencia posible).
async function prepararFoto(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer esa imagen. Prueba con una foto JPG o PNG.')); i.src = url; });
    const max = 2400, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const png = archivo.type === 'image/png';
    const ctx = cv.getContext('2d');
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); }
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(res => cv.toBlob(res, png ? 'image/png' : 'image/jpeg', 0.9));
    if (!blob) throw new Error('No se pudo procesar la foto.');
    const src = URL.createObjectURL(blob);
    blobsNuevos.set(src, blob);
    return src;
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- exportar ---------- */
const slug = s => sinTildes(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'post';
const lienzoABlob = (cv, tipo = 'image/png', q) => new Promise(res => cv.toBlob(res, tipo, q));
async function renderizar(lam) {
  const cv = document.createElement('canvas');
  // Las fotos de esa lámina tienen que estar cargadas antes de dibujar.
  await Promise.all(['foto1', 'foto2', 'foto3'].map(k => lam[k]?.src && esperarImagen(lam[k].src)));
  pintarLamina(cv, lam, EP.post.formato);
  return cv;
}
function esperarImagen(src) {
  if (imagenes.get(src)) return Promise.resolve();
  imagen(src);
  return new Promise(res => {
    const t0 = Date.now();
    const mirar = () => (imagenes.get(src) || !imagenes.has(src) || Date.now() - t0 > 15000) ? res() : setTimeout(mirar, 80);
    mirar();
  });
}
const nombreArchivo = i => `${slug(EP.post.titulo)}${EP.post.laminas.length > 1 ? '-' + String(i + 1).padStart(2, '0') : ''}.png`;
async function descargarLamina() {
  await prepararRecursos();
  const blob = await lienzoABlob(await renderizar(lamina()));
  descargarBlob(nombreArchivo(EP.activa), blob);
}
function descargarBlob(nombre, blob) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
let jszip = null;
function cargarJSZip() {
  if (window.JSZip) return Promise.resolve(window.JSZip);
  if (jszip) return jszip;
  jszip = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => res(window.JSZip);
    s.onerror = () => { jszip = null; rej(new Error('No se pudo cargar el compresor ZIP. Revisa tu conexión.')); };
    document.head.append(s);
  });
  return jszip;
}
async function descargarTodo() {
  await prepararRecursos();
  const JSZip = await cargarJSZip();
  const zip = new JSZip();
  for (const [i, lam] of EP.post.laminas.entries()) zip.file(nombreArchivo(i), await lienzoABlob(await renderizar(lam)));
  descargarBlob(`${slug(EP.post.titulo)}.zip`, await zip.generateAsync({ type: 'blob' }));
}
async function compartir() {
  await prepararRecursos();
  const archivos = [];
  for (const [i, lam] of EP.post.laminas.entries()) archivos.push(new File([await lienzoABlob(await renderizar(lam))], nombreArchivo(i), { type: 'image/png' }));
  try { await navigator.share({ files: archivos, title: EP.post.titulo }); }
  catch (e) { if (e.name !== 'AbortError') throw new Error('Este dispositivo no pudo compartir las imágenes. Usa «Descargar».'); }
}

/* ---------- guardar y abrir ---------- */
async function guardarPost() {
  const p = EP.post;
  if (!p.id) p.id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  const refs = [];
  const laminas = [];
  for (const lam of p.laminas) {
    const copia = { ...lam };
    delete copia.uid; delete copia.nueva;
    for (const k of ['foto1', 'foto2', 'foto3']) {
      const f = lam[k];
      if (!f?.src) { delete copia[k]; continue; }
      let ref = refsFoto.get(f.src);
      if (!ref) {
        const blob = blobsNuevos.get(f.src) || await (await fetch(f.src)).blob();
        ref = await D.subirFotoPost(p.id, blob);
        refsFoto.set(f.src, ref);
        blobsNuevos.delete(f.src);
      }
      refs.push(ref);
      copia[k] = { src: ref, zoom: f.zoom || 1, x: f.x ?? 50, y: f.y ?? 50 };
    }
    laminas.push(copia);
  }
  await prepararRecursos();
  const mini = document.createElement('canvas');
  await renderizar(p.laminas[0]);
  pintarLamina(mini, p.laminas[0], p.formato, 270);
  const miniatura = mini.toDataURL('image/jpeg', 0.72);
  await D.guardarPost({ id: p.id, titulo: (p.titulo || '').trim() || 'Post sin título', formato: p.formato, datos: { version: 1, laminas }, miniatura });
  await D.limpiarFotosPost(p.id, refs);
  EP.sucio = false;
  EP.lista = null;
}

async function abrirPost(id) {
  const fila = await D.post(id);
  const laminas = [];
  for (const l of fila.datos?.laminas || []) {
    if (!PLANTILLAS[l.plantilla]) continue;
    const lam = { ...PLANTILLAS[l.plantilla].base, ...l, uid: uid() };
    for (const k of ['foto1', 'foto2', 'foto3']) {
      if (!l[k]?.src) continue;
      const url = await D.fotoPost(l[k].src);
      refsFoto.set(url, l[k].src);
      lam[k] = { ...l[k], src: url };
    }
    laminas.push(lam);
  }
  EP.post = { id: fila.id, titulo: fila.titulo, formato: fila.formato, laminas: laminas.length ? laminas : [nuevaLamina()] };
  EP.activa = 0; EP.sucio = false; EP.tab = 'crear';
}

async function pintarGuardados(c) {
  if (!EP.lista) {
    c.innerHTML = '<div class="vacio-grande">Cargando posts guardados…</div>';
    try { EP.lista = await D.posts(); }
    catch (e) { c.innerHTML = `<div class="vacio-grande">${esc(e.message)}</div>`; return; }
    if (EP.tab !== 'guardados' || !c.isConnected) return;
  }
  if (!EP.lista.length) { c.innerHTML = '<div class="vacio-grande">Aún no hay posts guardados. Crea uno en «Crear» y pulsa «Guardar post».</div>'; return; }
  c.innerHTML = `<div class="ep-guardados">${EP.lista.map(p => `
    <article class="ep-guardado tarjeta">
      <button type="button" class="ep-guardado-abrir" data-ep-abrir="${p.id}" aria-label="Abrir ${esc(p.titulo)}">
        ${p.miniatura ? `<img src="${esc(p.miniatura)}" alt="" loading="lazy">` : '<span class="ep-foto-vacia"></span>'}
      </button>
      <div class="ep-guardado-txt"><b>${esc(p.titulo)}</b><small>${esc(FORMATOS_POST[p.formato]?.nombre || '')} · ${esc(fechaHora(p.actualizado))}</small></div>
      <div class="controles">
        <button type="button" class="btn btn-peq" data-ep-abrir="${p.id}">Abrir</button>
        <button type="button" class="btn btn-sec btn-peq" data-ep-borrar="${p.id}">Eliminar</button>
      </div>
    </article>`).join('')}</div>`;
}

/* ---------- eventos ---------- */
document.addEventListener('click', async ev => {
  if (!location.hash.startsWith('#posts') || !EP.post) return;
  const t = ev.target;
  const el = s => t.closest(s);
  let x;

  if ((x = el('[data-ep-tab]'))) { EP.tab = x.dataset.epTab; render(); return; }
  if ((x = el('[data-ep-lamina]'))) { EP.activa = Number(x.dataset.epLamina); render(); return; }
  if ((x = el('[data-ep-plantilla]'))) {
    const k = x.dataset.epPlantilla;
    if (k === lamina().plantilla) return;
    EP.post.laminas[EP.activa] = { ...nuevaLamina(k, lamina()), uid: lamina().uid };
    marcarSucio(); render(); return;
  }
  if ((x = el('[data-ep-color]'))) {
    lamina()[x.dataset.epColor] = x.dataset.valor;
    marcarSucio(); pintarCampos(); pedirPintado(); return;
  }
  if ((x = el('[data-ep-quitar-foto]'))) {
    delete lamina()[x.dataset.epQuitarFoto];
    marcarSucio(); pintarCampos(); pedirPintado(); return;
  }
  if ((x = el('[data-ep-abrir]'))) {
    if (EP.sucio && !(await confirmar('¿Abrir otro post?', 'El post que estás editando tiene cambios sin guardar y se perderán.', 'Abrir sin guardar'))) return;
    try { await intentar(() => abrirPost(x.dataset.epAbrir)); } catch { return; }
    render(); return;
  }
  if ((x = el('[data-ep-borrar]'))) {
    const p = EP.lista?.find(q => q.id === x.dataset.epBorrar);
    if (!(await confirmar('¿Eliminar este post?', `Se borrará «${p?.titulo || ''}» y sus fotos. No se puede deshacer.`, 'Eliminar'))) return;
    try {
      await intentar(async () => {
        await D.eliminarPost(x.dataset.epBorrar);
        EP.lista = EP.lista.filter(q => q.id !== x.dataset.epBorrar);
        if (EP.post.id === x.dataset.epBorrar) { EP.post.id = null; EP.sucio = true; }
      }, 'Post eliminado');
    } catch { /* el aviso ya se mostró */ }
    render(); return;
  }

  if (!(x = el('[data-ep]'))) return;
  const L = EP.post.laminas;
  switch (x.dataset.ep) {
    case 'agregar':
      if (L.length >= 20) return;
      L.push({ ...nuevaLamina(lamina().plantilla), nueva: true });
      EP.activa = L.length - 1; marcarSucio(); render(); break;
    case 'duplicar':
      if (L.length >= 20) return;
      L.splice(EP.activa + 1, 0, { ...JSON.parse(JSON.stringify(lamina())), uid: uid() });
      EP.activa++; marcarSucio(); render(); break;
    case 'quitar':
      if (L.length === 1) return;
      L.splice(EP.activa, 1);
      EP.activa = Math.min(EP.activa, L.length - 1); marcarSucio(); render(); break;
    case 'mover': {
      const j = EP.activa + Number(x.dataset.dir);
      if (j < 0 || j >= L.length) return;
      [L[EP.activa], L[j]] = [L[j], L[EP.activa]];
      EP.activa = j; marcarSucio(); render(); break;
    }
    case 'nuevo':
      if (EP.sucio && !(await confirmar('¿Empezar un post nuevo?', 'El post actual tiene cambios sin guardar y se perderán.', 'Empezar de nuevo'))) return;
      EP.post = nuevoPost(); EP.activa = 0; EP.sucio = false; render(); break;
    case 'guardar':
      botonOcupado(x, true, 'Guardando…');
      try { await guardarPost(); toast('Post guardado'); render(); }
      catch (e) { toast(e.message, 'error'); botonOcupado(x, false); }
      break;
    case 'descargar':
      botonOcupado(x, true, 'Preparando…');
      try { await descargarLamina(); } catch (e) { toast(e.message, 'error'); } finally { botonOcupado(x, false); }
      break;
    case 'descargar-todo':
      botonOcupado(x, true, 'Preparando ZIP…');
      try { await descargarTodo(); } catch (e) { toast(e.message, 'error'); } finally { botonOcupado(x, false); }
      break;
    case 'compartir':
      botonOcupado(x, true, 'Preparando…');
      try { await compartir(); } catch (e) { toast(e.message, 'error'); } finally { botonOcupado(x, false); }
      break;
  }
});

document.addEventListener('input', ev => {
  if (!location.hash.startsWith('#posts') || !EP.post) return;
  const t = ev.target;
  if (t.id === 'ep-titulo') { EP.post.titulo = t.value; marcarSucio(); return; }
  if (t.dataset.epCampo) {
    lamina()[t.dataset.epCampo] = t.value;
    marcarSucio(); pedirPintado(); return;
  }
  if (t.dataset.epAjuste) {
    const f = lamina()[t.dataset.epAjuste];
    if (!f) return;
    f[t.dataset.prop] = Number(t.value);
    marcarSucio(); pedirPintado();
  }
});

document.addEventListener('change', async ev => {
  if (!location.hash.startsWith('#posts') || !EP.post) return;
  const t = ev.target;
  if (t.id === 'ep-formato') { EP.post.formato = t.value; marcarSucio(); render(); return; }
  // Los selectores pueden mostrar u ocultar campos (p. ej. número de fotos).
  if (t.dataset.epCampo && t.tagName === 'SELECT') { pintarCampos(); return; }
  if (t.dataset.epArchivo) {
    const archivo = t.files?.[0];
    if (!archivo) return;
    if (archivo.size > 40 * 1024 * 1024) { toast('La foto pesa demasiado (máximo 40 MB).', 'error'); return; }
    const k = t.dataset.epArchivo, lam = lamina();
    try {
      const src = await conCarga(() => prepararFoto(archivo));
      lam[k] = { src, zoom: 1, x: 50, y: 50 };
      marcarSucio();
      if (lam === lamina()) pintarCampos();
      pedirPintado();
    } catch (e) { toast(e.message, 'error'); }
  }
});

window.addEventListener('beforeunload', ev => {
  if (EP.sucio && location.hash.startsWith('#posts')) { ev.preventDefault(); ev.returnValue = ''; }
});

VISTAS.posts = vistaPosts;
})();
