// Edge Function: gestionar-usuario
// Solo admins activos. Acciones:
//   { accion: "invitar", email, nombre, rol, talleres: [uuid] } → envía la invitación por correo,
//      asigna rol, activa la cuenta y la vincula a sus talleres.
//   { accion: "eliminar", id } → borra la cuenta de Auth (el perfil cae en cascada).
// Usa la service role key, que solo existe en el servidor de Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ROLES = ["admin", "terapeuta", "tallerista"];
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // 1. ¿Quién llama? Se valida el token de la sesión y su rol en la base de datos.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: quien, error: errQuien } = await servicio.auth.getUser(token);
  if (errQuien || !quien?.user) return json({ error: "Sesión no válida." }, 401);
  const { data: perfil } = await servicio.from("perfiles").select("rol, activo").eq("id", quien.user.id).single();
  if (!perfil?.activo || perfil.rol !== "admin") return json({ error: "Solo un admin puede gestionar cuentas." }, 403);

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: "Cuerpo inválido." }, 400); }

  if (cuerpo.accion === "invitar") {
    const email = String(cuerpo.email ?? "").trim().toLowerCase();
    const nombre = String(cuerpo.nombre ?? "").trim();
    const rol = String(cuerpo.rol ?? "");
    const talleres = Array.isArray(cuerpo.talleres) ? cuerpo.talleres.map(String) : [];
    const redirectTo = typeof cuerpo.redirectTo === "string" ? cuerpo.redirectTo : undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo válido." }, 400);
    if (!nombre) return json({ error: "Escribe el nombre de la persona." }, 400);
    if (!ROLES.includes(rol)) return json({ error: "Elige un rol válido." }, 400);

    const { data: inv, error: errInv } = await servicio.auth.admin.inviteUserByEmail(email, { data: { nombre }, redirectTo });
    if (errInv || !inv?.user) {
      const ya = /already|registered|exists/i.test(errInv?.message ?? "");
      return json({ error: ya ? "Ya existe una cuenta con ese correo." : `No se pudo enviar la invitación: ${errInv?.message}` }, ya ? 409 : 500);
    }
    const id = inv.user.id;
    const { error: errPerfil } = await servicio.from("perfiles").update({ nombre, rol, activo: true }).eq("id", id);
    if (errPerfil) return json({ error: `Se invitó, pero no se pudo asignar el rol: ${errPerfil.message}` }, 500);
    if (talleres.length) {
      const { error: errEq } = await servicio.from("taller_equipo").insert(talleres.map((t) => ({ taller_id: t, perfil_id: id })));
      if (errEq) return json({ error: `Se invitó, pero no se pudieron asignar los talleres: ${errEq.message}` }, 500);
    }
    return json({ ok: true, id });
  }

  if (cuerpo.accion === "eliminar") {
    const id = String(cuerpo.id ?? "");
    if (!id) return json({ error: "Falta la cuenta a eliminar." }, 400);
    if (id === quien.user.id) return json({ error: "No puedes eliminar tu propia cuenta." }, 400);
    const { error } = await servicio.auth.admin.deleteUser(id);
    if (error) return json({ error: /admin activa/.test(error.message) ? "Debe quedar al menos un admin activo." : error.message }, 400);
    return json({ ok: true });
  }

  return json({ error: "Acción desconocida." }, 400);
});
