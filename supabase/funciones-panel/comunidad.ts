// @ts-nocheck
// GENERADO por herramientas/funciones-panel.mjs a partir de supabase/functions/comunidad/index.ts: no editar a mano.
// Para pegar en Supabase → Edge Functions, en una función llamada exactamente «comunidad».
// Edge Function: comunidad (pública, se publica con --no-verify-jwt)
// La llama el formulario de https://spectrumpro.cl/comunidad. Acciones (POST JSON):
//   { accion: "suscribir", email, nombre?, perfil?, web? } → guarda a la persona como «pendiente» y le manda
//      un correo para confirmar. Siempre responde lo mismo (no revela si el correo ya estaba suscrito).
//   { accion: "confirmar", token } → la deja «activa» y le manda la bienvenida.
//   { accion: "baja", token }      → deja de recibir correos.
// Además acepta la baja «con un clic» de Gmail y Outlook (cabecera List-Unsubscribe-Post):
//   POST /functions/v1/comunidad?baja=<token>
//
// Secretos: RESEND_API_KEY (el mismo del recordatorio de cumpleaños).
// Opcionales: COMUNIDAD_REMITENTE (por defecto «SpectrumPro <comunidad@spectrumpro.cl>»),
//             COMUNIDAD_RESPONDER_A (por defecto contacto@spectrumpro.cl).
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
// ---- Fin de la plantilla ----

// deno-lint-ignore no-explicit-any
const C = (globalThis as any).SPCorreoBoletin;
const SITIO = "https://spectrumpro.cl";
const REMITENTE = Deno.env.get("COMUNIDAD_REMITENTE") ?? "SpectrumPro <comunidad@spectrumpro.cl>";
const RESPONDER_A = Deno.env.get("COMUNIDAD_RESPONDER_A") ?? "contacto@spectrumpro.cl";
const PERFILES = ["", "familia", "neurodivergente", "educacion", "salud", "politicas", "otro"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Límites contra abusos del formulario.
const POR_IP = 5;            // intentos por IP cada 10 minutos
const POR_HORA = 300;        // correos de confirmación por hora en total
const REENVIO_MIN = 10;      // minutos antes de volver a mandar la confirmación al mismo correo

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function servicio() {
  let clave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    clave = nuevas.default ?? Object.values(nuevas)[0] ?? clave;
  } catch { /* se usa la anterior */ }
  return createClient(Deno.env.get("SUPABASE_URL")!, String(clave), { auth: { persistSession: false } });
}

async function enviar(correo: Record<string, unknown>) {
  const resend = Deno.env.get("COMUNIDAD_RESEND_API_KEY") ?? Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resend) throw new Error("Falta el secreto RESEND_API_KEY en la función.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, reply_to: RESPONDER_A, ...correo }),
  });
  if (!r.ok) throw new Error(`Resend respondió ${r.status}: ${await r.text()}`);
}

const enlaceBaja = (token: string) => `${SITIO}/comunidad?baja=${token}`;
const cabecerasBaja = (token: string) => ({
  "List-Unsubscribe": `<${Deno.env.get("SUPABASE_URL")}/functions/v1/comunidad?baja=${token}>, <mailto:${RESPONDER_A}?subject=Baja%20noticias>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

async function huella(ip: string) {
  const datos = new TextEncoder().encode("comunidad:" + ip);
  const h = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(h)).slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function darDeBaja(sb: any, token: string) {
  const { error } = await sb.from("suscriptores").update({ estado: "baja", baja_en: new Date().toISOString() })
    .eq("token", token).neq("estado", "baja");
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);
  const sb = servicio();

  // Baja con un clic desde Gmail / Outlook.
  const tokenUrl = new URL(req.url).searchParams.get("baja") ?? "";
  if (tokenUrl) {
    if (UUID.test(tokenUrl)) await darDeBaja(sb, tokenUrl).catch(() => {});
    return new Response("ok", { headers: cors });
  }

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const accion = String(cuerpo.accion ?? "");

  try {
    if (accion === "suscribir") {
      const email = String(cuerpo.email ?? "").trim().toLowerCase();
      const nombre = String(cuerpo.nombre ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
      const perfil = PERFILES.includes(String(cuerpo.perfil ?? "")) ? String(cuerpo.perfil ?? "") : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 160) return json({ error: "Revisa tu correo: parece que le falta algo." }, 400);
      // Campo trampa: las personas no lo ven; los robots lo llenan. Se responde como si nada.
      if (String(cuerpo.web ?? "").trim()) return json({ ok: true });

      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
      const h = await huella(ip);
      const hace10 = new Date(Date.now() - 10 * 60e3).toISOString();
      const { count: intentos } = await sb.from("comunidad_intentos").select("id", { count: "exact", head: true }).eq("ip", h).gte("creado", hace10);
      if ((intentos ?? 0) >= POR_IP) return json({ error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." }, 429);
      await sb.from("comunidad_intentos").insert({ ip: h });
      // Limpieza: intentos de más de un día y suscripciones nunca confirmadas de más de 30 días.
      await sb.from("comunidad_intentos").delete().lt("creado", new Date(Date.now() - 864e5).toISOString());
      await sb.from("suscriptores").delete().eq("estado", "pendiente").lt("creado", new Date(Date.now() - 30 * 864e5).toISOString());

      const { data: previo } = await sb.from("suscriptores").select("id, estado, token, ultimo_aviso").eq("email", email).maybeSingle();
      if (previo?.estado === "activo") return json({ ok: true });   // ya está: no se le escribe de nuevo
      if (previo?.estado === "pendiente" && previo.ultimo_aviso && Date.parse(previo.ultimo_aviso) > Date.now() - REENVIO_MIN * 60e3) return json({ ok: true });

      const { count: hora } = await sb.from("suscriptores").select("id", { count: "exact", head: true })
        .gte("ultimo_aviso", new Date(Date.now() - 3600e3).toISOString());
      if ((hora ?? 0) >= POR_HORA) return json({ error: "Estamos recibiendo muchas suscripciones. Inténtalo de nuevo en una hora." }, 429);

      const ahora = new Date().toISOString();
      let token: string;
      if (previo) {
        // Pendiente (se reenvía) o dada de baja (vuelve a suscribirse con un enlace nuevo).
        token = previo.estado === "baja" ? crypto.randomUUID() : previo.token;
        const { error } = await sb.from("suscriptores").update({
          estado: "pendiente", token, nombre: nombre || undefined, perfil: perfil || undefined, ultimo_aviso: ahora, baja_en: null,
        }).eq("id", previo.id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("suscriptores").insert({ email, nombre, perfil, ultimo_aviso: ahora }).select("token").single();
        if (error) {
          if (/duplicate key/i.test(error.message)) return json({ ok: true });   // dos envíos casi a la vez
          throw error;
        }
        token = data.token;
      }
      const enlace = `${SITIO}/comunidad?confirmar=${token}`;
      await enviar({
        to: [email],
        subject: "Confirma tu suscripción a las noticias de SpectrumPro",
        html: C.confirmacion({ nombre, enlace }),
        text: `Hola${nombre ? " " + nombre : ""}:\n\nPara empezar a recibir las noticias de SpectrumPro, confirma tu correo abriendo este enlace:\n${enlace}\n\nSi no fuiste tú, ignora este mensaje.`,
      });
      return json({ ok: true });
    }

    if (accion === "confirmar") {
      const token = String(cuerpo.token ?? "");
      if (!UUID.test(token)) return json({ error: "Ese enlace no es válido. Copia el enlace completo del correo." }, 400);
      const { data: s } = await sb.from("suscriptores").select("id, email, nombre, estado").eq("token", token).maybeSingle();
      if (!s || s.estado === "baja") return json({ error: "Ese enlace ya no es válido. Puedes suscribirte de nuevo con el formulario." }, 404);
      if (s.estado === "activo") return json({ ok: true, ya: true });
      const { error } = await sb.from("suscriptores").update({ estado: "activo", confirmado: new Date().toISOString() }).eq("id", s.id);
      if (error) throw error;
      // La bienvenida no es imprescindible: si falla, la suscripción igual queda confirmada.
      await enviar({
        to: [s.email], subject: "¡Ya eres parte de la comunidad de SpectrumPro!",
        html: C.bienvenida({ nombre: s.nombre, enlaceBaja: enlaceBaja(token) }),
        headers: cabecerasBaja(token),
      }).catch((e) => console.error("bienvenida:", e.message));
      return json({ ok: true });
    }

    if (accion === "baja") {
      const token = String(cuerpo.token ?? "");
      if (!UUID.test(token)) return json({ error: "Ese enlace no es válido. Copia el enlace completo del correo." }, 400);
      await darDeBaja(sb, token);
      return json({ ok: true });   // también si ya estaba de baja o el enlace no existe
    }

    return json({ error: "Acción desconocida." }, 400);
  } catch (e) {
    console.error(accion, e);
    return json({ error: "No pudimos procesar tu solicitud. Inténtalo de nuevo en unos minutos." }, 500);
  }
});
