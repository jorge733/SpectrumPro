// Edge Function: enviar-boletin
// Solo dirección (cuentas activas). La llama la plataforma, sección «Comunidad».
//   { accion: "prueba", id } → manda el boletín solo a quien llama, marcado como prueba.
//   { accion: "enviar", id } → lo manda a todas las personas suscritas y confirmadas.
//      Envía por tandas de 100 (un correo por persona, con su propio enlace de baja) y anota a quién
//      ya le llegó. Si el envío es muy largo, responde con «restantes» > 0 y la plataforma vuelve a
//      llamar hasta terminar; un envío cortado se retoma sin repetir correos.
//
// Secretos: RESEND_API_KEY. Opcionales: COMUNIDAD_REMITENTE, COMUNIDAD_RESPONDER_A (ver «comunidad»).
import { createClient } from "jsr:@supabase/supabase-js@2";
import "../_compartido/correo-boletin.js";

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
  if (!perfil?.activo || perfil.rol !== "admin") return json({ error: "Solo dirección puede enviar boletines." }, 403);

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
