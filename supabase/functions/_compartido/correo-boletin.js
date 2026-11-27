// Plantilla de los correos de la Comunidad (boletines, confirmación y bienvenida).
// La usan las funciones «enviar-boletin» y «comunidad» (Deno, con import) y la plataforma para la
// vista previa (index.html la carga con <script>), así lo que se ve antes de enviar es exactamente
// lo que llega. No usa nada de Deno ni del navegador: solo define globalThis.SPCorreoBoletin.
(() => {
  const SITIO = 'https://spectrumpro.cl';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLOR = { tinta: '#17151f', suave: '#5d5a68', papel: '#fbf7ef', violeta: '#635cc7', enlace: '#4f48b5' };
  const ARCOIRIS = ['#635cc7', '#31b4e7', '#00bc70', '#fadd41', '#f8384b', '#e65ebe'];
  const P = `margin:0 0 16px;font-size:17px;line-height:1.6;color:${COLOR.tinta}`;

  // Texto → HTML con estilos en línea (los programas de correo ignoran las hojas de estilo).
  // Reglas: cada línea es un párrafo, «- » al inicio es una lista, **negrita** y enlaces https sueltos.
  function formato(texto) {
    const linea = s => esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, `<a href="$1" style="color:${COLOR.enlace}">$1</a>`);
    const out = []; let lista = [];
    const cerrar = () => {
      if (!lista.length) return;
      out.push(`<ul style="margin:0 0 16px;padding-left:22px">${lista.map(x => `<li style="${P};margin-bottom:6px">${linea(x)}</li>`).join('')}</ul>`);
      lista = [];
    };
    for (const l of String(texto || '').split('\n').map(x => x.trim())) {
      if (!l) { cerrar(); continue; }
      if (/^[-•]\s+/.test(l)) { lista.push(l.replace(/^[-•]\s+/, '')); continue; }
      cerrar(); out.push(`<p style="${P}">${linea(l)}</p>`);
    }
    cerrar();
    return out.join('');
  }

  const boton = (texto, enlace) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:${COLOR.tinta};border-radius:999px">
    <a href="${esc(enlace)}" style="display:inline-block;padding:14px 26px;font:700 16px/1 Arial,Helvetica,sans-serif;color:#ffffff;text-decoration:none">${esc(texto)}</a></td></tr></table>`;

  // Marco común: logo, franja arcoíris, contenido y pie.
  function marco({ titulo, resumen = '', cuerpo, pie = '', aviso = '' }) {
    const franja = ARCOIRIS.map(c => `<td style="background:${c};height:6px;font-size:0;line-height:0">&nbsp;</td>`).join('');
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:${COLOR.papel};font-family:Arial,Helvetica,sans-serif;color:${COLOR.tinta}">
${resumen ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(resumen)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.papel}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:0 4px 16px"><a href="${SITIO}/comunidad" style="text-decoration:none;color:${COLOR.tinta}">
      <img src="${SITIO}/assets/icono-192.png" width="44" height="44" alt="SpectrumPro" style="vertical-align:middle;border:0;border-radius:10px">
      <span style="font:700 15px/1 Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;vertical-align:middle;margin-left:10px">Comunidad SpectrumPro</span></a></td></tr>
    <tr><td style="background:#ffffff;border-radius:22px;overflow:hidden">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${franja}</tr></table>
      <div style="padding:28px 30px 12px">
        ${aviso ? `<p style="margin:0 0 18px;padding:10px 14px;border-radius:10px;background:#fdf3c4;font-size:14px;color:${COLOR.tinta}">${aviso}</p>` : ''}
        <h1 style="margin:0 0 18px;font:900 28px/1.15 'Arial Black',Arial,Helvetica,sans-serif;letter-spacing:-.5px;color:${COLOR.tinta}">${esc(titulo)}</h1>
        ${cuerpo}
      </div>
    </td></tr>
    <tr><td style="padding:18px 8px 0;font-size:13px;line-height:1.6;color:${COLOR.suave};text-align:center">
      ${pie}
      <p style="margin:8px 0 0">SpectrumPro · Doctor Roberto del Río 1137, Providencia, Santiago de Chile · <a href="${SITIO}" style="color:${COLOR.suave}">spectrumpro.cl</a></p>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  }

  /* Boletín. b = { id, titulo, resumen, texto, imagen, boton_texto, boton_enlace, publico }
     enlaceBaja: dirección para darse de baja de esa persona. prueba: añade el aviso de prueba. */
  function boletin(b, { enlaceBaja = SITIO + '/comunidad', prueba = false } = {}) {
    // Las imágenes propias del sitio (/sitio/img/…) se piden a spectrumpro.cl.
    const src = /^\/(sitio|tienda|assets)\//.test(b.imagen || '') ? SITIO + b.imagen : b.imagen || '';
    const imagen = /^https:\/\//.test(src) ? `<img src="${esc(src)}" width="540" alt="" style="display:block;width:100%;max-width:540px;height:auto;border:0;border-radius:14px;margin:0 0 20px">` : '';
    const btn = b.boton_texto && /^https:\/\//.test(b.boton_enlace || '') ? boton(b.boton_texto, b.boton_enlace) : '';
    const web = b.publico && b.id ? `<a href="${SITIO}/comunidad#boletin-${esc(b.id)}" style="color:${COLOR.suave}">Ver este boletín en la web</a> · ` : '';
    return marco({
      titulo: b.titulo || 'Sin título',
      resumen: b.resumen,
      aviso: prueba ? 'Correo de prueba: así lo recibirá la comunidad. El enlace para darse de baja no funciona en las pruebas.' : '',
      cuerpo: imagen + formato(b.texto) + btn,
      pie: `<p style="margin:0">Recibes este correo porque te suscribiste a las noticias de SpectrumPro.<br>${web}<a href="${esc(enlaceBaja)}" style="color:${COLOR.suave}">Darme de baja</a></p>`,
    });
  }

  function confirmacion({ nombre = '', enlace }) {
    return marco({
      titulo: 'Confirma tu suscripción',
      resumen: 'Un clic y empiezas a recibir las noticias de SpectrumPro.',
      cuerpo: `<p style="${P}">Hola${nombre ? ' ' + esc(nombre) : ''}:</p>
        <p style="${P}">Gracias por sumarte a la comunidad de SpectrumPro. Para empezar a recibir nuestras noticias, confirma tu correo:</p>
        ${boton('Confirmar mi suscripción', enlace)}
        <p style="${P};font-size:14px;color:${COLOR.suave}">Si no fuiste tú, ignora este mensaje: no te enviaremos nada más.</p>`,
    });
  }

  function bienvenida({ nombre = '', enlaceBaja }) {
    return marco({
      titulo: '¡Bienvenida, bienvenido!',
      resumen: 'Ya eres parte de la comunidad de SpectrumPro.',
      cuerpo: `<p style="${P}">Hola${nombre ? ' ' + esc(nombre) : ''}:</p>
        <p style="${P}">Tu suscripción está confirmada. Te escribiremos cuando tengamos nuevas entrevistas, podcasts, recursos y noticias sobre neurodivergencia e inclusión.</p>
        <p style="${P}">Mientras tanto, en la página de la comunidad hay documentos para descargar y podcasts que recomendamos.</p>
        ${boton('Ir a la comunidad', SITIO + '/comunidad')}`,
      pie: `<p style="margin:0"><a href="${esc(enlaceBaja)}" style="color:${COLOR.suave}">Darme de baja</a></p>`,
    });
  }

  // Versión en texto plano (mejora la entrega y la leen los lectores de pantalla más simples).
  function textoPlano(b, enlaceBaja) {
    return [b.titulo, '', String(b.texto || '').replace(/\*\*/g, ''), b.boton_texto && b.boton_enlace ? `\n${b.boton_texto}: ${b.boton_enlace}` : '',
      '', '—', 'SpectrumPro · https://spectrumpro.cl/comunidad', `Darme de baja: ${enlaceBaja}`].join('\n');
  }

  globalThis.SPCorreoBoletin = { boletin, confirmacion, bienvenida, textoPlano, formato };
})();
