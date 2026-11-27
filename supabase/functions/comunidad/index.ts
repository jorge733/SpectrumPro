// Edge Function: comunidad (pública, se publica con --no-verify-jwt)
// La llama el formulario de https://spectrumpro.cl/comunidad. Acciones (POST JSON):
//   { accion: "suscribir", email, nombre?, perfil?, web? } → guarda a la persona como «pendiente» y le manda
//      un correo para confirmar. Siempre responde lo mismo (no revela si el correo ya estaba suscrito).
//   { accion: "confirmar", token } → la deja «activa» y le manda la bienvenida.
//   { accion: "baja", token }      → deja de recibir correos.
//   { accion: "reaccionar", boletin, tipo, dispositivo } → pone o quita una reacción (❤️ 👏 💡 🤝) de ese
//      navegador en un boletín publicado; responde los totales del boletín.
//   { accion: "comentar", boletin, nombre, email, texto, web? } → guarda el comentario como «pendiente»
//      solo si el correo es de una persona suscrita y confirmada, y avisa al equipo por correo. Siempre
//      responde lo mismo (no revela si un correo está suscrito).
// Además acepta la baja «con un clic» de Gmail y Outlook (cabecera List-Unsubscribe-Post):
//   POST /functions/v1/comunidad?baja=<token>
//
// Secretos: RESEND_API_KEY (el mismo del recordatorio de cumpleaños).
// Opcionales: COMUNIDAD_REMITENTE (por defecto «SpectrumPro <comunidad@spectrumpro.cl>»),
//             COMUNIDAD_RESPONDER_A (por defecto contacto@spectrumpro.cl),
//             COMUNIDAD_AVISOS (a quién avisar de comentarios nuevos; por defecto COMUNIDAD_RESPONDER_A).
import { createClient } from "jsr:@supabase/supabase-js@2";
import "../_compartido/correo-boletin.js";

// deno-lint-ignore no-explicit-any
const C = (globalThis as any).SPCorreoBoletin;
const SITIO = "https://spectrumpro.cl";
const REMITENTE = Deno.env.get("COMUNIDAD_REMITENTE") ?? "SpectrumPro <comunidad@spectrumpro.cl>";
const RESPONDER_A = Deno.env.get("COMUNIDAD_RESPONDER_A") ?? "contacto@spectrumpro.cl";
const AVISOS = (Deno.env.get("COMUNIDAD_AVISOS") ?? RESPONDER_A).split(",").map((x) => x.trim()).filter(Boolean);
const PLATAFORMA = "https://gestionspectrumpro.cl/#comunidad";
const REACCIONES = ["gusta", "aplauso", "aprendi", "identifica"];
const PERFILES = ["", "familia", "neurodivergente", "educacion", "salud", "politicas", "otro"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Límites contra abusos del formulario.
const POR_IP = 5;            // suscripciones por IP cada 10 minutos
const COMENTARIOS_IP = 5;    // comentarios por IP cada 10 minutos
const REACCIONES_IP = 60;    // reacciones por IP cada 10 minutos
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

// ¿Esta conexión ya hizo demasiados intentos de esta acción en 10 minutos? Si no, anota uno.
// deno-lint-ignore no-explicit-any
async function excede(sb: any, req: Request, accion: string, maximo: number) {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const h = await huella(ip);
  const hace10 = new Date(Date.now() - 10 * 60e3).toISOString();
  const { count } = await sb.from("comunidad_intentos").select("id", { count: "exact", head: true }).eq("ip", h).eq("accion", accion).gte("creado", hace10);
  if ((count ?? 0) >= maximo) return true;
  await sb.from("comunidad_intentos").insert({ ip: h, accion });
  return false;
}

// deno-lint-ignore no-explicit-any
async function boletinPublico(sb: any, id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await sb.from("boletines").select("id, titulo").eq("id", id).eq("publico", true).eq("estado", "enviado").maybeSingle();
  return data;
}

// deno-lint-ignore no-explicit-any
async function totales(sb: any, id: string) {
  // Se cuentan desde la tabla (la clave de servicio no lee la vista pública de totales).
  const { data, error } = await sb.from("boletin_reacciones").select("tipo").eq("boletin_id", id);
  if (error) console.error("totales:", error.message);
  const t: Record<string, number> = {};
  for (const x of data ?? []) t[x.tipo] = (t[x.tipo] ?? 0) + 1;
  return t;
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

      if (await excede(sb, req, "suscribir", POR_IP)) return json({ error: "Demasiados intentos. Espera unos minutos y vuelve a intentarlo." }, 429);
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

    if (accion === "reaccionar") {
      const tipo = String(cuerpo.tipo ?? "");
      const dispositivo = String(cuerpo.dispositivo ?? "");
      if (!REACCIONES.includes(tipo) || !/^[0-9a-z-]{16,64}$/i.test(dispositivo)) return json({ error: "Reacción inválida." }, 400);
      const b = await boletinPublico(sb, String(cuerpo.boletin ?? ""));
      if (!b) return json({ error: "Ese boletín no está publicado." }, 404);
      if (await excede(sb, req, "reaccionar", REACCIONES_IP)) return json({ error: "Demasiadas reacciones seguidas. Espera un poco." }, 429);
      const h = await huella("dispositivo:" + dispositivo);
      const fila = { boletin_id: b.id, tipo, huella: h };
      const { data: ya } = await sb.from("boletin_reacciones").select("tipo").match(fila).maybeSingle();
      if (ya) await sb.from("boletin_reacciones").delete().match(fila);
      else await sb.from("boletin_reacciones").upsert(fila, { onConflict: "boletin_id,tipo,huella", ignoreDuplicates: true });
      return json({ ok: true, activa: !ya, totales: await totales(sb, b.id) });
    }

    if (accion === "comentar") {
      const email = String(cuerpo.email ?? "").trim().toLowerCase();
      const nombre = String(cuerpo.nombre ?? "").trim().replace(/\s+/g, " ");
      const texto = String(cuerpo.texto ?? "").replace(/\r/g, "").trim();
      if (!nombre || nombre.length > 60) return json({ error: "Escribe tu nombre (hasta 60 caracteres)." }, 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: "Revisa tu correo: parece que le falta algo." }, 400);
      if (texto.length < 2 || texto.length > 2000) return json({ error: "El comentario debe tener entre 2 y 2000 caracteres." }, 400);
      const b = await boletinPublico(sb, String(cuerpo.boletin ?? ""));
      if (!b) return json({ error: "Ese boletín no está publicado." }, 404);
      if (String(cuerpo.web ?? "").trim()) return json({ ok: true });   // campo trampa
      if (await excede(sb, req, "comentar", COMENTARIOS_IP)) return json({ error: "Demasiados comentarios seguidos. Espera unos minutos." }, 429);

      // Solo personas suscritas y confirmadas. Si no lo está, se responde igual y no se guarda nada.
      const { data: s } = await sb.from("suscriptores").select("id").eq("email", email).eq("estado", "activo").maybeSingle();
      if (!s) return json({ ok: true });
      const { error } = await sb.from("boletin_comentarios").insert({ boletin_id: b.id, suscriptor_id: s.id, nombre, texto });
      if (error) throw error;
      if (AVISOS.length) {
        await enviar({
          to: AVISOS,
          subject: `Comentario nuevo para revisar: «${b.titulo}»`,
          html: `<p><b>${C.formato(nombre).replace(/<\/?p[^>]*>/g, "")}</b> comentó el boletín «${C.formato(b.titulo).replace(/<\/?p[^>]*>/g, "")}»:</p>${C.formato(texto)}<p><a href="${PLATAFORMA}">Revisarlo en la plataforma (Comunidad → Comentarios)</a></p><p style="color:#777;font-size:13px">No se publica hasta que alguien del equipo lo apruebe.</p>`,
          text: `${nombre} comentó «${b.titulo}»:\n\n${texto}\n\nRevisarlo: ${PLATAFORMA}`,
        }).catch((e) => console.error("aviso comentario:", e.message));
      }
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
