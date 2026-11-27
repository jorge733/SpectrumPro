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
import "../_compartido/correo-boletin.js";

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
