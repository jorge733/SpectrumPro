// Edge Function: recordatorio-cumpleanos
// Envía por correo (Resend) los cumpleaños de HOY y de los que vienen EN 3 DÍAS, de jóvenes
// vigentes (activos o en pausa) y del equipo. Lo reciben las cuentas activas con «aviso_cumple».
//
// La llaman:
//   · pg_cron cada mañana, con la cabecera «x-recordatorio» (clave guardada en Vault).
//     Si ese día no hay cumpleaños, no se envía nada.
//   · Dirección desde la plataforma (botón «Enviar prueba»), con su sesión: el correo le llega
//     solo a quien lo pidió, aunque no haya cumpleaños.
//
// Se publica SIN verificación de JWT (el reloj no tiene sesión): la función comprueba ella misma
// la clave o la sesión.   supabase functions deploy recordatorio-cumpleanos --no-verify-jwt
// Necesita el secreto RESEND_API_KEY (supabase secrets set RESEND_API_KEY=...).
import { createClient } from "jsr:@supabase/supabase-js@2";

const AVISO_DIAS = 3;
const REMITENTE = Deno.env.get("RECORDATORIO_REMITENTE") ?? "SpectrumPro <no-responder@gestionspectrumpro.cl>";
const PLATAFORMA = "https://gestionspectrumpro.cl/#cumpleanos";
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Fecha de hoy en Chile, como año/mes/día (sin horas).
function hoyChile() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
}
const sumar = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const bisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
// ¿Cumple años esa fecha? Quien nació un 29 de febrero lo celebra el 28 en años no bisiestos.
function cumpleEl(fechaNac: string, d: Date) {
  const [, m, dia] = fechaNac.split("-").map(Number);
  const y = d.getUTCFullYear();
  const [mm, dd] = m === 2 && dia === 29 && !bisiesto(y) ? [2, 28] : [m, dia];
  return d.getUTCMonth() + 1 === mm && d.getUTCDate() === dd;
}
const edadEn = (fechaNac: string, d: Date) => fechaNac.startsWith("1904-") ? null : d.getUTCFullYear() - Number(fechaNac.slice(0, 4));
const fechaTxt = (d: Date) => `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;

type Persona = { nombre: string; fecha_nac: string; tipo: "Joven" | "Equipo" };

function bloque(titulo: string, d: Date, lista: Persona[]) {
  if (!lista.length) return "";
  const filas = lista.map((p) => {
    const e = edadEn(p.fecha_nac, d);
    return `<tr><td style="padding:8px 0;border-bottom:1px solid #eee"><b>${esc(p.nombre)}</b>${e ? ` · cumple ${e} años` : ""}</td>
      <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;color:#6b6880">${p.tipo}</td></tr>`;
  }).join("");
  return `<h2 style="font-size:17px;margin:24px 0 4px">${esc(titulo)}</h2>
    <p style="margin:0 0 8px;color:#6b6880">${esc(fechaTxt(d))}</p>
    <table style="width:100%;border-collapse:collapse;font-size:15px">${filas}</table>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  let claveServicio = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  try {
    const nuevas = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    claveServicio = nuevas.default ?? Object.values(nuevas)[0] ?? claveServicio;
  } catch { /* se usa la anterior */ }
  if (!claveServicio) return json({ error: "La función no tiene acceso a la clave de servicio." }, 500);
  const resend = Deno.env.get("RESEND_API_KEY") ?? "";
  if (!resend) return json({ error: "Falta el secreto RESEND_API_KEY en la función (ver README)." }, 500);
  const servicio = createClient(url, String(claveServicio), { auth: { persistSession: false } });

  // 1. ¿Quién llama? El reloj (clave de Vault) o una persona de dirección (prueba).
  let prueba: string | null = null;
  const claveRecibida = req.headers.get("x-recordatorio") ?? "";
  if (claveRecibida) {
    const { data: clave } = await servicio.rpc("clave_recordatorio_cumpleanos");
    if (!clave || claveRecibida !== clave) return json({ error: "Clave no válida." }, 401);
  } else {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: quien } = await servicio.auth.getUser(token);
    if (!quien?.user) return json({ error: "Sesión no válida." }, 401);
    const { data: perfil } = await servicio.from("perfiles").select("rol, activo, email").eq("id", quien.user.id).single();
    if (!perfil?.activo || perfil.rol !== "admin") return json({ error: "Solo dirección puede enviar la prueba." }, 403);
    prueba = perfil.email || quien.user.email || null;
    if (!prueba) return json({ error: "Tu cuenta no tiene correo." }, 400);
  }

  // 2. Cumpleaños de hoy y de dentro de AVISO_DIAS días.
  const [{ data: alumnos, error: e1 }, { data: equipo, error: e2 }] = await Promise.all([
    servicio.from("alumnos").select("nombre, apodo, apellidos, fecha_nac").in("estado", ["activo", "pausa"]).not("fecha_nac", "is", null),
    servicio.from("perfiles").select("nombre, email, fecha_nac").eq("activo", true).not("rol", "is", null).not("fecha_nac", "is", null),
  ]);
  if (e1 || e2) return json({ error: (e1 ?? e2)!.message }, 500);
  const personas: Persona[] = [
    ...(alumnos ?? []).map((a) => ({ nombre: `${a.apodo || a.nombre} ${a.apellidos ?? ""}`.trim(), fecha_nac: String(a.fecha_nac), tipo: "Joven" as const })),
    ...(equipo ?? []).map((p) => ({ nombre: p.nombre || p.email, fecha_nac: String(p.fecha_nac), tipo: "Equipo" as const })),
  ];
  const hoy = hoyChile(), pronto = sumar(hoy, AVISO_DIAS);
  const orden = (a: Persona, b: Persona) => a.tipo.localeCompare(b.tipo) || a.nombre.localeCompare(b.nombre, "es");
  const deHoy = personas.filter((p) => cumpleEl(p.fecha_nac, hoy)).sort(orden);
  const dePronto = personas.filter((p) => cumpleEl(p.fecha_nac, pronto)).sort(orden);

  if (!prueba && !deHoy.length && !dePronto.length) return json({ ok: true, enviados: 0, motivo: "Sin cumpleaños" });

  // 3. Destinatarios.
  let para: string[];
  if (prueba) para = [prueba];
  else {
    const { data: dest, error: e3 } = await servicio.from("perfiles").select("email").eq("aviso_cumple", true).eq("activo", true).not("rol", "is", null);
    if (e3) return json({ error: e3.message }, 500);
    para = [...new Set((dest ?? []).map((d) => String(d.email || "").trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
    if (!para.length) return json({ ok: true, enviados: 0, motivo: "Nadie tiene activado el aviso" });
  }

  // 4. El correo.
  const partes: string[] = [];
  if (deHoy.length) partes.push(deHoy.length === 1 ? `Hoy está de cumpleaños ${deHoy[0].nombre}` : `Hoy hay ${deHoy.length} cumpleaños`);
  if (dePronto.length) partes.push(`${dePronto.length === 1 ? "1 cumpleaños" : dePronto.length + " cumpleaños"} en ${AVISO_DIAS} días`);
  const asunto = (prueba ? "[Prueba] " : "") + "🎂 " + (partes.join(" · ") || "Sin cumpleaños hoy ni en los próximos días");
  const cuerpo = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f4fb;font-family:Arial,Helvetica,sans-serif;color:#1e1b34">
    <div style="max-width:560px;margin:0 auto;padding:24px">
      <div style="background:#fff;border-radius:14px;padding:24px 28px">
        <h1 style="font-size:20px;margin:0 0 4px">Recordatorio de cumpleaños</h1>
        <p style="margin:0;color:#6b6880">SpectrumPro · plataforma del equipo</p>
        ${prueba ? `<p style="background:#fff6d6;border-radius:8px;padding:8px 12px">Este es un correo de prueba enviado desde la plataforma. Los avisos reales llegan cada mañana solo si hay cumpleaños hoy o en ${AVISO_DIAS} días.</p>` : ""}
        ${bloque("Hoy", hoy, deHoy)}
        ${bloque(`En ${AVISO_DIAS} días`, pronto, dePronto)}
        ${!deHoy.length && !dePronto.length ? `<p style="margin-top:20px">No hay cumpleaños hoy (${esc(fechaTxt(hoy))}) ni el ${esc(fechaTxt(pronto))}.</p>` : ""}
        <p style="margin:28px 0 0"><a href="${PLATAFORMA}" style="background:#635cc7;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;display:inline-block">Ver cumpleaños en la plataforma</a></p>
      </div>
      <p style="font-size:12px;color:#8a879c;text-align:center;margin-top:16px">Recibes este aviso porque tu cuenta lo tiene activado. Dirección puede desactivarlo en Administración → tu cuenta.</p>
    </div></body></html>`;

  // Un correo por persona, para no mostrar las direcciones de las demás.
  const r = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
    body: JSON.stringify(para.map((to) => ({ from: REMITENTE, to: [to], subject: asunto, html: cuerpo }))),
  });
  if (!r.ok) return json({ error: `Resend respondió ${r.status}: ${await r.text()}` }, 502);
  return json({ ok: true, enviados: para.length, hoy: deHoy.length, pronto: dePronto.length });
});
