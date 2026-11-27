// @ts-nocheck
// GENERADO por herramientas/funciones-panel.mjs a partir de supabase/functions/enviar-boletin/index.ts: no editar a mano.
// Para pegar en Supabase → Edge Functions, en una función llamada exactamente «enviar-boletin».
// Edge Function: enviar-boletin
// Solo dirección y el rol Equipo (cuentas activas). La llama la plataforma, sección «Comunidad».
//   { accion: "prueba", id } → manda el boletín solo a quien llama, marcado como prueba.
//   { accion: "enviar", id } → lo manda a todas las personas suscritas y confirmadas.
//      Envía por tandas de 100 (un correo por persona, con su propio enlace de baja) y anota a quién
//      ya le llegó. Si el envío es muy largo, responde con «restantes» > 0 y la plataforma vuelve a
//      llamar hasta terminar; un envío cortado se retoma sin repetir correos.
//
// Secretos: RESEND_API_KEY. Opcionales: COMUNIDAD_REMITENTE, COMUNIDAD_RESPONDER_A (ver «comunidad»).
import { createClient } from "jsr:@supabase/supabase-js@2";
// ---- Plantilla de los correos (supabase/functions/_compartido/correo-boletin.js) ----
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
      // Los boletines publicados en la página se pueden comentar y reaccionar allí.
      cuerpo: imagen + formato(b.texto) + btn + (b.publico && b.id ? `<p style="margin:8px 0 4px;padding-top:16px;border-top:1px solid #eee;font-size:15px;color:${COLOR.suave}">¿Qué te pareció? <a href="${SITIO}/comunidad#boletin-${esc(b.id)}" style="color:${COLOR.enlace};font-weight:700">Comenta y reacciona en la página →</a></p>` : ''),
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
// ---- Fin de la plantilla ----

// deno-lint-ignore no-explicit-any
const C = (globalThis as any).SPCorreoBoletin;
const SITIO = "https://spectrumpro.cl";
const REMITENTE = Deno.env.get("COMUNIDAD_REMITENTE") ?? "SpectrumPro <comunidad@spectrumpro.cl>";
const RESPONDER_A = Deno.env.get("COMUNIDAD_RESPONDER_A") ?? "contacto@spectrumpro.cl";
const TANDA = 100;            // máximo de Resend por llamada a /emails/batch
const PAUSA_MS = 600;         // Resend admite unas 2 llamadas por segundo
const PRESUPUESTO_MS = 100e3; // se corta antes del límite de tiempo de la función

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const inicio = Date.now();

  const resend = Deno.env.get("COMUNIDAD_RESEND_API_KEY") ?? Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resend) return json({ error: "Falta el secreto RESEND_API_KEY en la función (ver README)." }, 500);
  let clave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    clave = nuevas.default ?? Object.values(nuevas)[0] ?? clave;
  } catch { /* se usa la anterior */ }
  const url = Deno.env.get("SUPABASE_URL")!;
  const sb = createClient(url, String(clave), { auth: { persistSession: false } });

  // 1. ¿Quién llama?
  const tokenSesion = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien } = await sb.auth.getUser(tokenSesion);
  if (!quien?.user) return json({ error: "Sesión no válida. Vuelve a entrar a la plataforma." }, 401);
  const { data: perfil } = await sb.from("perfiles").select("rol, activo, email").eq("id", quien.user.id).single();
  if (!perfil?.activo || !["admin", "equipo"].includes(perfil.rol)) return json({ error: "Solo dirección y el equipo pueden enviar boletines." }, 403);

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: "Cuerpo inválido." }, 400); }
  const id = String(cuerpo.id ?? "");
  const { data: b, error: eB } = await sb.from("boletines").select("*").eq("id", id).maybeSingle();
  if (eB) return json({ error: eB.message }, 500);
  if (!b) return json({ error: "Ese boletín ya no existe." }, 404);
  if (!String(b.titulo).trim() || !String(b.texto).trim()) return json({ error: "El boletín necesita un título y un texto." }, 400);

  const llamarResend = async (correos: unknown[], idem?: string) => {
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json", ...(idem ? { "Idempotency-Key": idem } : {}) },
      body: JSON.stringify(correos),
    });
    if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
  };
  const correo = (to: string, token: string | null, prueba = false) => {
    const baja = token ? `${SITIO}/comunidad?baja=${token}` : `${SITIO}/comunidad`;
    return {
      from: REMITENTE, reply_to: RESPONDER_A, to: [to],
      subject: (prueba ? "[Prueba] " : "") + b.titulo,
      html: C.boletin(b, { enlaceBaja: baja, prueba }),
      text: C.textoPlano(b, baja),
      ...(token ? { headers: {
        "List-Unsubscribe": `<${url}/functions/v1/comunidad?baja=${token}>, <mailto:${RESPONDER_A}?subject=Baja%20noticias>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      } } : {}),
    };
  };

  try {
    // 2. Prueba: solo a quien la pide.
    if (cuerpo.accion === "prueba") {
      const para = String(perfil.email || quien.user.email || "").trim();
      if (!para) return json({ error: "Tu cuenta no tiene correo." }, 400);
      await llamarResend([correo(para, null, true)]);
      return json({ ok: true, para });
    }

    if (cuerpo.accion !== "enviar") return json({ error: "Acción desconocida." }, 400);
    if (b.estado === "enviado") return json({ error: "Este boletín ya se envió." }, 409);

    // 3. Envío real. Se marca «enviando» para que nadie lo edite como borrador mientras tanto.
    if (b.estado === "borrador") {
      const { data: tomado } = await sb.from("boletines").update({ estado: "enviando" }).eq("id", id).eq("estado", "borrador").select("id");
      if (!tomado?.length) return json({ error: "Otra persona acaba de empezar este envío. Recarga la página." }, 409);
    }

    let enviados = 0;
    for (;;) {
      // Activos a los que aún no les llega este boletín.
      const { data: ya } = await sb.from("boletin_envios").select("suscriptor_id").eq("boletin_id", id);
      const listos = new Set((ya ?? []).map((x) => x.suscriptor_id));
      const pendientes: { id: string; email: string; token: string }[] = [];
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await sb.from("suscriptores").select("id, email, token").eq("estado", "activo").order("creado").range(desde, desde + 999);
        if (error) throw error;
        pendientes.push(...(data ?? []).filter((s) => !listos.has(s.id)));
        if (!data || data.length < 1000) break;
      }
      if (!pendientes.length) break;

      for (let i = 0; i < pendientes.length; i += TANDA) {
        if (Date.now() - inicio > PRESUPUESTO_MS) {
          return json({ ok: true, enviados, restantes: pendientes.length - i });
        }
        const tanda = pendientes.slice(i, i + TANDA);
        // Misma clave si se reintenta la misma tanda: Resend no la manda dos veces.
        await llamarResend(tanda.map((s) => correo(s.email, s.token)), `boletin-${id}-${tanda[0].id}-${tanda.length}`);
        const { error } = await sb.from("boletin_envios").upsert(tanda.map((s) => ({ boletin_id: id, suscriptor_id: s.id })), { onConflict: "boletin_id,suscriptor_id", ignoreDuplicates: true });
        if (error) throw error;
        enviados += tanda.length;
        await dormir(PAUSA_MS);
      }
    }

    const { count } = await sb.from("boletin_envios").select("suscriptor_id", { count: "exact", head: true }).eq("boletin_id", id);
    const { error: eFin } = await sb.from("boletines").update({ estado: "enviado", enviado_en: new Date().toISOString(), destinatarios: count ?? enviados }).eq("id", id);
    if (eFin) throw eFin;
    return json({ ok: true, enviados, restantes: 0, destinatarios: count ?? enviados });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "No se pudo enviar." }, 500);
  }
});
