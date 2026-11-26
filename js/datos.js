'use strict';
/* Capa de datos de SpectrumPro.
   Expone window.SPDatos con la misma interfaz para dos backends:
   - Supabase (producción): la seguridad la aplican las políticas RLS en la base de datos.
   - Demostración: datos ficticios en localStorage que imitan esas mismas reglas por rol. */

(() => {
  /* ---------- fechas compartidas ---------- */
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  // ¿Hay sesión del taller ese día? Con fechas exactas (talleres de verano) manda la fecha; si no, el día de la semana.
  const tocaEl = (t, d) => (t.fechas?.length ? t.fechas.includes(iso(d)) : t.dias.includes(d.getDay()));
  window.SPFechas = { pad, iso, hoy, sumarDias, tocaEl };

  const urlBase = () => location.origin + location.pathname;

  /* ---------- conversión fila (snake_case) ⇄ objeto (camelCase) ---------- */
  const CAMPOS_ALUMNO = {
    nombre: 'nombre', apellidos: 'apellidos', apodo: 'apodo', pronombres: 'pronombres', fechaNac: 'fecha_nac', rut: 'rut',
    programa: 'programa', beca: 'beca', estado: 'estado', fechaIngreso: 'fecha_ingreso', entrevista: 'entrevista',
    tutorNombre: 'tutor_nombre', tutorRelacion: 'tutor_relacion', tutorTelefono: 'tutor_telefono', tutorEmail: 'tutor_email',
    emergencia: 'emergencia', emergencia2: 'emergencia2', direccion: 'direccion', intereses: 'intereses', apoyos: 'apoyos', alergias: 'alergias',
  };
  const FECHAS_OPCIONALES = new Set(['fecha_ingreso', 'entrevista']);
  const alumnoAFila = a => {
    const f = {};
    for (const [c, s] of Object.entries(CAMPOS_ALUMNO)) {
      const v = a[c] ?? '';
      f[s] = FECHAS_OPCIONALES.has(s) ? (v || null) : v;
    }
    return f;
  };
  const filaAAlumno = f => {
    const a = { id: f.id };
    for (const [c, s] of Object.entries(CAMPOS_ALUMNO)) a[c] = f[s] ?? '';
    a.talleres = (f.inscripciones || []).map(i => i.taller_id);
    return a;
  };
  const hora = t => (t || '').slice(0, 5);
  const filaATaller = (f, equipo) => ({
    id: f.id, nombre: f.nombre, area: f.area, dias: f.dias || [], horaInicio: hora(f.hora_inicio), horaFin: hora(f.hora_fin),
    encargado: f.encargado, color: f.color, activo: f.activo, orden: f.orden, temporada: f.temporada || 'semestral',
    modalidad: f.modalidad || 'presencial', enlace: f.enlace || '',
    fechas: (f.fechas || []).slice().sort(), objetivo: f.objetivo || '', edad: f.edad || '', nota: f.nota || '',
    programaPdf: f.programa_pdf || null, programaNombre: f.programa_nombre || '',
    equipo: equipo.filter(e => e.taller_id === f.id).map(e => e.perfil_id),
  });
  const tallerAFila = t => ({
    nombre: t.nombre, area: t.area || '', dias: t.dias, hora_inicio: t.horaInicio || null, hora_fin: t.horaFin || null,
    encargado: t.encargado || '', color: t.color || '#635CC7', activo: !!t.activo, orden: t.orden ?? 0,
    temporada: t.temporada === 'verano' ? 'verano' : 'semestral',
    modalidad: t.modalidad === 'online' ? 'online' : 'presencial', enlace: t.modalidad === 'online' ? t.enlace || '' : '',
    fechas: t.fechas || [], objetivo: t.objetivo || '', edad: t.edad || '', nota: t.nota || '',
  });

  const CAMPOS_PRODUCTO = ['nombre', 'descripcion', 'categoria', 'precio', 'variantes', 'imagen', 'visible', 'agotado', 'orden'];
  const productoAFila = p => {
    const f = {};
    for (const c of CAMPOS_PRODUCTO) f[c] = p[c];
    f.precio = p.precio === '' || p.precio == null ? null : Number(p.precio);
    return f;
  };
  const AJUSTES_TIENDA = ['whatsapp', 'instagram', 'pago', 'entrega'];

  /* ---------- errores legibles ---------- */
  function traducir(e) {
    const m = String(e?.message || e || '');
    if (/Invalid login credentials/i.test(m)) return new Error('Correo o contraseña incorrectos.');
    if (/Email not confirmed/i.test(m)) return new Error('Primero confirma tu correo con el enlace que te llegó.');
    if (/rate limit|too many/i.test(m)) return new Error('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.');
    if (/row-level security|permission denied|violates row-level/i.test(m)) return new Error('No tienes permiso para hacer este cambio.');
    if (/Failed to fetch|NetworkError|network/i.test(m)) return new Error('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
    if (/Password should be|weak password/i.test(m)) return new Error('La contraseña es muy débil. Usa al menos 10 caracteres.');
    if (/talleres_nombre_unico/i.test(m)) return new Error('Ya existe un taller con ese nombre.');
    if (/maximum allowed size|Payload too large|exceeded the maximum/i.test(m)) return new Error('El PDF es demasiado grande (máximo 10 MB).');
    if (/mime type|invalid_mime/i.test(m)) return new Error('El programa debe ser un archivo PDF.');
    if (/Bucket not found/i.test(m)) return new Error('Falta crear el espacio de archivos «programas» en Supabase (ver README).');
    if (/duplicate key/i.test(m)) return new Error('Ese registro ya existe.');
    if (/tienda_(productos|ajustes)|bucket not found/i.test(m) && /schema cache|does not exist|not found/i.test(m)) return new Error('Falta activar la tienda en Supabase: ejecuta supabase/migrations/20261124060000_tienda.sql en el SQL Editor.');
    if (/tienda_whatsapp_formato/i.test(m)) return new Error('El WhatsApp debe tener solo números, con el código de país (por ejemplo 56912345678).');
    if (/tienda_instagram_formato/i.test(m)) return new Error('El usuario de Instagram solo puede tener letras, números, puntos y guiones bajos.');
    if (/exceeded the maximum allowed size|Payload too large/i.test(m)) return new Error('La foto es muy pesada. Usa una de menos de 3 MB.');
    return new Error(m || 'Ocurrió un error inesperado.');
  }

  /* =====================================================================
     Backend Supabase
     ===================================================================== */
  function backendSupabase(cfg) {
    const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    const ok = ({ data, error }) => { if (error) throw traducir(error); return data; };
    // PostgREST devuelve como máximo 1000 filas por petición: se pagina.
    async function todo(consulta) {
      const out = [];
      for (let i = 0; ; i += 1000) {
        const data = ok(await consulta().range(i, i + 999));
        out.push(...data);
        if (data.length < 1000) return out;
      }
    }
    async function sincronizar(tabla, clave, id, otra, nuevos) {
      let borrar = sb.from(tabla).delete().eq(clave, id);
      if (nuevos.length) borrar = borrar.not(otra, 'in', `(${nuevos.join(',')})`);
      ok(await borrar);
      if (nuevos.length) ok(await sb.from(tabla).upsert(nuevos.map(v => ({ [clave]: id, [otra]: v })), { onConflict: `${clave},${otra}`, ignoreDuplicates: true }));
    }

    return {
      modo: 'supabase',
      async sesion() { return ok(await sb.auth.getSession()).session; },
      alCambiarSesion(cb) { sb.auth.onAuthStateChange((evento, sesion) => cb(evento, sesion)); },
      async entrar(email, clave) { ok(await sb.auth.signInWithPassword({ email, password: clave })); },
      async salir() { await sb.auth.signOut(); },
      async recuperar(email) {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: urlBase() });
        if (error && /rate limit|too many/i.test(error.message)) throw traducir(error);
        // Otros errores se ocultan para no revelar si la cuenta existe.
      },
      async cambiarClave(clave) { ok(await sb.auth.updateUser({ password: clave })); },
      async perfil() {
        const u = ok(await sb.auth.getUser()).user;
        const p = ok(await sb.from('perfiles').select('*').eq('id', u.id).maybeSingle());
        return p && { ...p, fechaNac: p.fecha_nac || '' };
      },
      async guardarMiFechaNac(fecha) { ok(await sb.rpc('guardar_mi_fecha_nac', { p_fecha: fecha || null })); },
      async talleres() {
        const [t, e] = await Promise.all([
          todo(() => sb.from('talleres').select('*').order('orden').order('nombre')),
          todo(() => sb.from('taller_equipo').select('*').order('taller_id').order('perfil_id')),
        ]);
        return t.map(f => filaATaller(f, e));
      },
      async guardarTaller(t) {
        let id = t.id;
        if (id) ok(await sb.from('talleres').update(tallerAFila(t)).eq('id', id));
        else id = ok(await sb.from('talleres').insert(tallerAFila(t)).select('id').single()).id;
        await sincronizar('taller_equipo', 'taller_id', id, 'perfil_id', t.equipo || []);
        return id;
      },
      async eliminarTaller(id) {
        const f = ok(await sb.from('talleres').select('programa_pdf').eq('id', id).maybeSingle());
        ok(await sb.from('talleres').delete().eq('id', id));
        if (f?.programa_pdf) await sb.storage.from('programas').remove([f.programa_pdf]);
      },
      // Programa del taller (PDF en el bucket privado "programas").
      async subirPrograma(tallerId, archivo) {
        const anterior = ok(await sb.from('talleres').select('programa_pdf').eq('id', tallerId).single()).programa_pdf;
        const ruta = `${tallerId}/${Date.now()}.pdf`;
        ok(await sb.storage.from('programas').upload(ruta, archivo, { contentType: 'application/pdf', upsert: false }));
        const r = await sb.from('talleres').update({ programa_pdf: ruta, programa_nombre: archivo.name }).eq('id', tallerId);
        if (r.error) { await sb.storage.from('programas').remove([ruta]); throw traducir(r.error); }
        if (anterior && anterior !== ruta) await sb.storage.from('programas').remove([anterior]);
      },
      async quitarPrograma(tallerId) {
        const anterior = ok(await sb.from('talleres').select('programa_pdf').eq('id', tallerId).single()).programa_pdf;
        ok(await sb.from('talleres').update({ programa_pdf: null, programa_nombre: '' }).eq('id', tallerId));
        if (anterior) await sb.storage.from('programas').remove([anterior]);
      },
      async urlPrograma(t) {
        if (!t.programaPdf) throw new Error('Este taller no tiene programa.');
        return ok(await sb.storage.from('programas').createSignedUrl(t.programaPdf, 600)).signedUrl;
      },

      /* Estudio de posts (solo dirección). Las fotos van al bucket privado «posts»;
         en «datos» se guarda su referencia como «sb:<ruta>». */
      async posts() {
        return ok(await sb.from('posts').select('id, titulo, formato, miniatura, actualizado').order('actualizado', { ascending: false }));
      },
      async post(id) { return ok(await sb.from('posts').select('*').eq('id', id).single()); },
      async guardarPost(p) {
        ok(await sb.from('posts').upsert({ id: p.id, titulo: p.titulo, formato: p.formato, datos: p.datos, miniatura: p.miniatura }));
      },
      async eliminarPost(id) {
        const archivos = ok(await sb.storage.from('posts').list(id, { limit: 1000 })) || [];
        if (archivos.length) ok(await sb.storage.from('posts').remove(archivos.map(f => `${id}/${f.name}`)));
        ok(await sb.from('posts').delete().eq('id', id));
      },
      async subirFotoPost(postId, blob) {
        const ext = blob.type === 'image/png' ? 'png' : 'jpg';
        const ruta = `${postId}/${crypto.randomUUID()}.${ext}`;
        ok(await sb.storage.from('posts').upload(ruta, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
        return 'sb:' + ruta;
      },
      async fotoPost(ref) {
        if (!String(ref).startsWith('sb:')) return ref;
        return URL.createObjectURL(ok(await sb.storage.from('posts').download(ref.slice(3))));
      },
      async limpiarFotosPost(postId, refs) {
        const usadas = new Set(refs.filter(r => String(r).startsWith('sb:')).map(r => r.slice(3)));
        const archivos = ok(await sb.storage.from('posts').list(postId, { limit: 1000 })) || [];
        const sobran = archivos.map(f => `${postId}/${f.name}`).filter(r => !usadas.has(r));
        if (sobran.length) ok(await sb.storage.from('posts').remove(sobran));
      },

      async alumnos() {
        const filas = await todo(() => sb.from('alumnos').select('*, inscripciones(taller_id)').order('apellidos').order('id'));
        return filas.map(filaAAlumno);
      },
      async guardarAlumno(a) {
        let id = a.id;
        if (id) ok(await sb.from('alumnos').update(alumnoAFila(a)).eq('id', id));
        else id = ok(await sb.from('alumnos').insert(alumnoAFila(a)).select('id').single()).id;
        await sincronizar('inscripciones', 'alumno_id', id, 'taller_id', a.talleres || []);
        return id;
      },
      async eliminarAlumno(id) { ok(await sb.from('alumnos').delete().eq('id', id)); },
      async privado(id) {
        const f = ok(await sb.from('alumnos_privado').select('*').eq('alumno_id', id).maybeSingle());
        return { medicacion: f?.medicacion || '', observaciones: f?.observaciones || '' };
      },
      async guardarPrivado(id, p) {
        ok(await sb.from('alumnos_privado').upsert({ alumno_id: id, medicacion: p.medicacion || '', observaciones: p.observaciones || '' }));
      },
      async asistencia(desde) {
        const filas = await todo(() => sb.from('asistencia').select('fecha, taller_id, alumno_id, estado').gte('fecha', desde).order('id'));
        return filas.map(f => ({ fecha: f.fecha, tallerId: f.taller_id, alumnoId: f.alumno_id, estado: f.estado }));
      },
      async marcar(fecha, tallerId, alumnos, estado) {
        if (!estado) ok(await sb.from('asistencia').delete().eq('fecha', fecha).eq('taller_id', tallerId).in('alumno_id', alumnos));
        else ok(await sb.from('asistencia').upsert(alumnos.map(a => ({ fecha, taller_id: tallerId, alumno_id: a, estado })), { onConflict: 'taller_id,fecha,alumno_id' }));
      },
      async cumpleanos() {
        return ok(await sb.rpc('cumpleanos')).map(f => ({ id: f.id, nombre: f.nombre, apodo: f.apodo, apellidos: f.apellidos, fechaNac: f.fecha_nac }));
      },
      async cumpleanosEquipo() {
        return ok(await sb.rpc('cumpleanos_equipo')).map(f => ({ id: f.id, nombre: f.nombre, apellidos: '', fechaNac: f.fecha_nac }));
      },
      async usuarios() {
        const [p, e] = await Promise.all([
          todo(() => sb.from('perfiles').select('*').order('nombre').order('id')),
          todo(() => sb.from('taller_equipo').select('*').order('taller_id').order('perfil_id')),
        ]);
        return p.map(u => ({ ...u, fechaNac: u.fecha_nac || '', talleres: e.filter(x => x.perfil_id === u.id).map(x => x.taller_id) }));
      },
      async invitar(datos) {
        // La función publicada puede ser anterior al rol «equipo»: se invita como tallerista sin
        // talleres (no ve a nadie) y enseguida se cambia el rol.
        const rolFuncion = datos.rol === 'equipo' ? 'tallerista' : datos.rol;
        const { data, error } = await sb.functions.invoke('gestionar-usuario', { body: { accion: 'invitar', ...datos, rol: rolFuncion, talleres: rolFuncion === 'tallerista' ? datos.talleres : [], redirectTo: urlBase() } });
        if (error) {
          let m = error.message;
          try { m = (await error.context.json()).error || m; } catch { /* sin cuerpo */ }
          throw traducir(m);
        }
        // La función de invitación no conoce la fecha de nacimiento: se guarda aparte.
        const extra = {};
        if (datos.fechaNac) extra.fecha_nac = datos.fechaNac;
        if (datos.rol === 'equipo') extra.rol = 'equipo';
        if (Object.keys(extra).length && data?.id) ok(await sb.from('perfiles').update(extra).eq('id', data.id));
        return data;
      },
      async actualizarUsuario(id, u) {
        ok(await sb.from('perfiles').update({ nombre: u.nombre, rol: u.rol, activo: u.activo, fecha_nac: u.fechaNac || null }).eq('id', id));
        await sincronizar('taller_equipo', 'perfil_id', id, 'taller_id', u.rol === 'tallerista' ? u.talleres : []);
      },
      async eliminarUsuario(id) {
        const { error } = await sb.functions.invoke('gestionar-usuario', { body: { accion: 'eliminar', id } });
        if (error) {
          let m = error.message;
          try { m = (await error.context.json()).error || m; } catch { /* sin cuerpo */ }
          throw traducir(m);
        }
      },
      /* ----- tienda ----- */
      async tienda() {
        const [productos, ajustes] = await Promise.all([
          todo(() => sb.from('tienda_productos').select('*').order('orden').order('nombre').order('id')),
          sb.from('tienda_ajustes').select('*').eq('id', 1).maybeSingle().then(ok),
        ]);
        return { productos, ajustes: ajustes || { whatsapp: '', instagram: '', pago: '', entrega: '' } };
      },
      async guardarProducto(p) {
        if (p.id) { ok(await sb.from('tienda_productos').update(productoAFila(p)).eq('id', p.id)); return p.id; }
        return ok(await sb.from('tienda_productos').insert(productoAFila(p)).select('id').single()).id;
      },
      async eliminarProducto(id) { ok(await sb.from('tienda_productos').delete().eq('id', id)); },
      async ordenarProductos(ids) {
        await Promise.all(ids.map((id, i) => sb.from('tienda_productos').update({ orden: i + 1 }).eq('id', id).then(ok)));
      },
      async guardarAjustesTienda(a) {
        const f = {};
        for (const c of AJUSTES_TIENDA) f[c] = a[c] ?? '';
        ok(await sb.from('tienda_ajustes').update(f).eq('id', 1));
      },
      async subirFotoProducto(blob) {
        const ruta = `productos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        ok(await sb.storage.from('tienda').upload(ruta, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
        return sb.storage.from('tienda').getPublicUrl(ruta).data.publicUrl;
      },
      async borrarFotoProducto(url) {
        // Solo se borran fotos subidas al bucket; las de /tienda/img/ son parte del sitio.
        const m = String(url || '').match(/\/storage\/v1\/object\/public\/tienda\/(.+)$/);
        if (m) await sb.storage.from('tienda').remove([decodeURIComponent(m[1])]);
      },
      async auditoria(limite = 200) {
        return ok(await sb.from('auditoria').select('*').order('creado', { ascending: false }).limit(limite));
      },
    };
  }

  /* =====================================================================
     Backend de demostración
     ===================================================================== */
  // Talleres de verano (diciembre 2026 y enero 2027). Lo mismo que carga supabase/migrations/20261126020000_talleres_verano_2026.sql.
  const TALLERES_VERANO = [
    { id: 'v1', nombre: 'Taller de Creación de Videojuegos · Grupo A', area: 'Centro de Formación', fechas: ['2026-12-14', '2026-12-16', '2026-12-18', '2026-12-21'], horaInicio: '11:00', horaFin: '13:00', color: '#00BC70', activo: true, orden: 103,
      objetivo: 'Diseñar y programar un nivel propio sobre una plantilla base en Construct 3, integrando arte y lógica al ritmo de cada participante para ensamblar un videojuego continuo jugado en grupo.', edad: '', nota: '' },
    { id: 'v2', nombre: 'Taller de Creación de Videojuegos · Grupo B', area: 'Centro de Formación', fechas: ['2026-12-14', '2026-12-16', '2026-12-18', '2026-12-21'], horaInicio: '15:00', horaFin: '16:45', color: '#2BA77A', activo: false, orden: 104,
      objetivo: 'Diseñar y programar un nivel propio sobre una plantilla base en Construct 3, integrando arte y lógica al ritmo de cada participante para ensamblar un videojuego continuo jugado en grupo.', edad: '', nota: 'Se abre al llenarse el Grupo A.' },
    { id: 'v3', nombre: 'Semana Intensiva: Universo Tolkien', area: '', fechas: ['2026-12-15', '2026-12-16', '2026-12-17', '2026-12-18'], horaInicio: '09:00', horaFin: '13:00', color: '#8C6D1F', activo: true, orden: 105,
      objetivo: 'Explorar la mitología de la Tierra Media mediante el diseño artístico y manual de un juego de aventuras colectivo (tablero, fichas, dados y cartas), culminando en una partida teatralizada sin competencia.', edad: '', nota: '' },
    { id: 'v4', nombre: 'Taller de Corto de Títeres de Navidad', area: 'Centro de Formación', fechas: ['2026-12-14', '2026-12-16', '2026-12-18'], horaInicio: '15:30', horaFin: '18:30', color: '#F8384B', activo: true, orden: 106,
      objetivo: 'Combinar el oficio teatral de confección y manipulación de títeres con el lenguaje audiovisual (cámara, iluminación y sonido) para rodar un cortometraje navideño en equipo.', edad: '', nota: '' },
    { id: 'v5', nombre: 'Taller de Creación de Máscaras', area: 'Arte y Apoyo', fechas: ['2026-12-14', '2026-12-21'], horaInicio: '11:00', horaFin: '12:45', color: '#7C4DCC', activo: true, orden: 107,
      objetivo: 'Fomentar la expresión personal, la comunicación y la regulación emocional a través del arteterapia, construyendo y pintando una máscara tridimensional en cartón y papel en un entorno libre de juicios.', edad: '', nota: '' },
    { id: 'v6', nombre: 'Taller de Preparación Física y Habilidades Sociales', area: '', fechas: ['2026-12-15'], horaInicio: '09:00', horaFin: '13:00', color: '#5A9E3A', activo: true, orden: 108,
      objetivo: 'Fortalecer el autocuidado físico y mental, reducir el tiempo frente a pantallas y potenciar el vínculo social presencial mediante una caminata activa, juegos cooperativos y picnic saludable en plazas cercanas a Spectrum.', edad: '', nota: 'Incluye colación.' },
    { id: 'v7', nombre: 'Taller Animación Digital (8 Horas)', area: 'Centro de Formación', fechas: ['2026-12-11', '2026-12-12', '2026-12-18', '2026-12-19'], horaInicio: '16:00', horaFin: '18:00', color: '#31B4E7', activo: true, orden: 101,
      objetivo: 'Programa práctico intensivo de 8 horas totales distribuidas en dos fines de semana (viernes y sábado).', edad: '14 años o más', nota: '' },
    { id: 'v8', nombre: 'Taller Animación Stopmotion (8 Horas)', area: 'Centro de Formación', fechas: ['2026-12-11', '2026-12-12', '2026-12-18', '2026-12-19'], horaInicio: '11:00', horaFin: '13:00', color: '#1F8FBF', activo: true, orden: 102,
      objetivo: 'Programa práctico intensivo de 8 horas totales distribuidas en dos fines de semana (viernes y sábado).', edad: '8 a 12 años', nota: '' },
    { id: 'v9', nombre: 'Taller de Creación de Videojuegos (Verano 2027)', area: 'Centro de Formación', fechas: ['2027-01-04', '2027-01-06', '2027-01-08', '2027-01-11'], horaInicio: '11:00', horaFin: '12:45', color: '#00BC70', activo: true, orden: 109,
      objetivo: 'Desarrollar habilidades de diseño visual en pixel art y programación lógica creando una sala propia con desafíos y sonido, para unir todas las creaciones en un único videojuego colectivo.', edad: '', nota: '' },
    { id: 'v10', nombre: 'Taller de Cortometraje de Verano 1', area: 'Centro de Formación', fechas: ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08'], horaInicio: '10:00', horaFin: '13:00', color: '#E0B800', activo: true, orden: 110,
      objetivo: 'Vivir el proceso real de producción cinematográfica asumiendo roles activos frente y detrás de cámara, fortaleciendo el trabajo colaborativo y la autonomía en set para estrenar una película original en familia.', edad: '', nota: 'Viernes: jornada extendida de 10:00 a 18:00.' },
    { id: 'v11', nombre: 'Taller de Cortometraje de Verano 2', area: 'Centro de Formación', fechas: ['2027-01-11', '2027-01-12', '2027-01-13', '2027-01-14', '2027-01-15'], horaInicio: '10:00', horaFin: '13:00', color: '#F28C28', activo: true, orden: 111,
      objetivo: 'Crear y filmar un cortometraje colectivo desde la lluvia de ideas hasta el rodaje en estudio, potenciando las habilidades sociales y la creatividad grupal en un ambiente estructurado.', edad: '', nota: 'Viernes: jornada extendida de 10:00 a 18:00.' },
  ];
  const CLAVE_DEMO = 'spectrumpro:demo:v9';
  const CLAVE_SESION = 'spectrumpro:demo:sesion';
  const CLAVE_PROGRAMA = id => `spectrumpro:demo:programa:${id}`;
  const LIMITE_DEMO = 3 * 1024 * 1024; // localStorage tiene poco espacio
  const leerArchivo = archivo => new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = () => mal(new Error('No se pudo leer el archivo.'));
    r.readAsDataURL(archivo);
  });
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const espera = (ms = 120) => new Promise(r => setTimeout(r, ms));
  const CLAVE_POSTS = 'spectrumpro:demo:posts';
  const leerPosts = () => { try { return JSON.parse(leer(CLAVE_POSTS)) || []; } catch { return []; } };
  const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function crearDemo() {
    const rnd = mulberry32(1710);
    const t = hoy();
    const perfiles = [
      { id: 'u-admin', email: 'direccion@ejemplo.cl', nombre: 'Dirección (demo)', rol: 'admin', activo: true, fechaNac: iso(new Date(t.getFullYear() - 44, (t.getMonth() + 2) % 12, 9)) },
      { id: 'u-tera', email: 'terapeuta@ejemplo.cl', nombre: 'Terapeuta (demo)', rol: 'terapeuta', activo: true, fechaNac: iso(new Date(t.getFullYear() - 36, sumarDias(t, 12).getMonth(), sumarDias(t, 12).getDate())) },
      { id: 'u-talle', email: 'tallerista@ejemplo.cl', nombre: 'Tallerista (demo)', rol: 'tallerista', activo: true, fechaNac: iso(new Date(t.getFullYear() - 31, (t.getMonth() + 5) % 12, 23)) },
      { id: 'u-equipo', email: 'equipo@ejemplo.cl', nombre: 'Equipo (demo)', rol: 'equipo', activo: true, fechaNac: iso(new Date(1904, sumarDias(t, 20).getMonth(), sumarDias(t, 20).getDate())) },
      { id: 'u-pend', email: 'nueva.persona@ejemplo.cl', nombre: 'Persona invitada', rol: null, activo: false, fechaNac: '' },
    ];
    // Lista y profesores según spectrumpro.cl; los horarios son de ejemplo (el sitio no los publica).
    const talleres = [
      ['lab', 'Laboratorio Creativo', 'Arte y Apoyo', [2], '16:00', '17:30', 'Vicente Bernal', '#635CC7', []],
      ['anim', 'Animación Digital', 'Centro de Formación', [1, 3], '15:00', '17:00', 'Carlos González', '#31B4E7', ['u-talle']],
      ['dibujo', 'Dibujo e Ilustración', 'Centro de Formación', [2, 4], '15:00', '16:30', 'Naru Torres', '#E65EBE', []],
      ['teatro', 'Teatro', 'Centro de Formación', [4], '16:30', '18:00', 'Pedro González', '#F8384B', []],
      ['titeres', 'Títeres y TV', 'Centro de Formación', [5], '15:00', '17:00', 'Paco Pasquette y Gonzalo Pavez', '#E0B800', []],
      ['video', 'Videojuegos', 'Centro de Formación', [3], '17:00', '18:30', 'Bruno Díaz', '#00BC70', ['u-talle']],
      ['cocina', 'Habilidades para la vida diaria con Cocina', 'Terapia Ocupacional', [1], '11:00', '12:30', 'Laura Quintana', '#2A9D8F', []],
      ['vellon', 'Cuentos con Vellón', 'Terapia Ocupacional', [5], '11:00', '12:30', 'Laura Quintana', '#9B6AD6', []],
      ['tonteras', 'Club de Tonteras', 'Centro de Formación', [], '', '', 'Benjamín Villalobos', '#F58A1F', []],
      ['rol', 'Juegos de Rol', 'Centro de Formación', [], '', '', 'Carlos González y Naru Torres', '#7A5C3E', []],
      ['dibdig', 'Dibujo e Ilustración Digital', 'Centro de Formación', [], '', '', 'Naru Torres', '#C2409E', []],
      ['stop', 'Animación Stop-Motion', 'Centro de Formación', [], '', '', 'Carlos González', '#1F8FBF', []],
      ['m3d', 'Modelado 3D', 'Centro de Formación', [], '', '', '', '#4B7BE5', []],
      ['refer', 'Referentes Culturales', 'Formación general', [], '', '', '', '#8C6D1F', []],
      ['corp', 'Expresión Corporal y Creación Escénica', 'Formación general', [], '', '', '', '#D94F70', []],
      ['vocal', 'Expresión Corporal y Creación Escénica: expresión vocal', 'Formación general', [], '', '', '', '#B03A5B', []],
      ['arteter', 'Arte Terapia', 'Arte y Apoyo', [], '', '', 'Vicente Bernal y Paula Jiménez', '#7C4DCC', []],
      ['m-dib', 'Mentoría de Dibujo Digital o Análogo', 'Mentorías', [], '', '', 'Naru Torres', '#E65EBE', []],
      ['m-vj', 'Mentoría de Creación de Videojuegos y Animación 3D', 'Mentorías', [], '', '', 'Bruno Díaz', '#00BC70', []],
      ['m-ed', 'Mentoría de Edición de Videos e Introducción a IA', 'Mentorías', [], '', '', 'Gonzalo Pavez', '#31B4E7', []],
      ['online', 'Proyecto animado colectivo', 'SpectrumOnline', [], '', '', 'Naru Torres', '#5A9E3A', [], 'https://meet.google.com/abc-defg-hij'],
      ['club', 'Club de Videojuegos Online', 'SpectrumOnline', [2], '18:00', '19:00', 'Bruno Díaz', '#4361EE', ['u-talle'], 'https://zoom.us/j/1234567890'],
    ].map(([id, nombre, area, dias, horaInicio, horaFin, encargado, color, equipo, enlace], i) =>
      ({ id, nombre, area, dias, horaInicio, horaFin, encargado, color, activo: true, orden: i + 1, equipo, temporada: 'semestral', modalidad: enlace ? 'online' : 'presencial', enlace: enlace || '' }))
      .concat(TALLERES_VERANO.map(t => ({ ...t, dias: [...new Set(t.fechas.map(f => new Date(f + 'T12:00').getDay()))], encargado: '', equipo: [], temporada: 'verano' })));

    // [nombre, apellidos, apodo, pronombres, programa, talleres, cumpleaños (días desde hoy | [meses, día]), edad, beca]
    const filas = [
      ['Matías', 'Rojas Fuentes', '', 'él', 'FormaPro', ['anim', 'video', 'dibujo'], 3, 19, 'Beca parcial'],
      ['Antonia', 'Silva Paredes', 'Anto', 'ella', 'FormaPro', ['dibujo', 'teatro'], 9, 22, ''],
      ['Benjamín', 'Muñoz Tapia', 'Benja', 'él', 'Talleres', ['video', 'anim', 'club'], 17, 17, ''],
      ['Josefa', 'Contreras Vidal', '', 'ella', 'Arte Terapia', ['lab', 'dibujo'], 26, 24, 'Arancel diferenciado'],
      ['Tomás', 'Herrera Lagos', '', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'titeres'], 0, 21, 'Beca completa'],
      ['Florencia', 'Soto Araya', 'Flo', 'ella', 'FormaPro', ['teatro', 'titeres'], [2, 14], 20, ''],
      ['Vicente', 'Pérez Morales', '', 'él', 'Talleres', ['anim', 'club'], [3, 3], 16, ''],
      ['Isidora', 'González Pinto', 'Isi', 'ella', 'Arte Terapia', ['lab'], [4, 21], 18, 'Beca parcial'],
      ['Agustín', 'Díaz Navarro', '', 'él', 'FormaPro', ['video', 'anim', 'teatro'], [5, 8], 23, ''],
      ['Martina', 'Castro Reyes', 'Marti', 'elle', 'Talleres', ['dibujo', 'lab'], [6, 28], 19, ''],
      ['Cristóbal', 'Vargas Espinoza', 'Cris', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'lab'], [7, 12], 25, 'Beca completa'],
      ['Emilia', 'Fernández Bravo', '', 'ella', 'FormaPro', ['titeres', 'teatro', 'dibujo'], [8, 5], 22, ''],
      ['Lucas', 'Torres Olivares', '', 'él', 'Talleres', ['video', 'club'], [9, 18], 15, ''],
      ['Catalina', 'Ramírez Lillo', 'Cata', 'ella', 'Arte Terapia', ['lab', 'titeres'], [1, 27], 20, 'Arancel diferenciado'],
    ];
    const intereses = ['Animación 2D y cómics', 'Dibujo de personajes, anime', 'Edición de video, videojuegos indie', 'Pintura, música', 'Cocina, títeres', 'Actuación y voz', 'Stop motion', 'Fotografía', 'Modelado 3D, Minecraft', 'Ilustración digital', 'Guion y escritura', 'Teatro, improvisación', 'Programación de juegos', 'Doblaje y locución'];
    const apoyos = ['Anticipar cambios de sala o de horario con un aviso previo.', 'Puede usar audífonos con cancelación de ruido durante el trabajo individual.', 'Prefiere instrucciones por escrito además de verbales.', 'Necesita pausas sensoriales cortas; usa la sala tranquila.', 'Funciona mejor en grupos pequeños y con un rol definido.', 'Agenda visual al inicio de cada sesión.'];
    const parentesco = ['Madre', 'Padre', 'Madre', 'Tutora legal', 'Padre', 'Madre', 'Abuela'];
    const comunas = ['Providencia', 'Ñuñoa', 'Las Condes', 'Santiago Centro', 'La Reina', 'Macul', 'San Miguel'];
    const responsables = ['Carolina', 'Rodrigo', 'Paula', 'Andrea', 'Felipe', 'Claudia', 'Marcela'];
    // RUT ficticio con dígito verificador correcto (módulo 11).
    const rutDemo = n => {
      let suma = 0, mult = 2;
      for (const c of String(n).split('').reverse()) { suma += Number(c) * mult; mult = mult === 7 ? 2 : mult + 1; }
      const r = 11 - (suma % 11);
      return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${r === 11 ? 0 : r === 10 ? 'K' : r}`;
    };
    const tel = () => `+56 9 ${Math.floor(1000 + rnd() * 8999)} ${Math.floor(1000 + rnd() * 8999)}`;

    const privado = {};
    const alumnos = filas.map((f, i) => {
      const [nombre, apellidos, apodo, pronombres, programa, tall, cumple, años, beca] = f;
      let mes, dia;
      if (Array.isArray(cumple)) { mes = (t.getMonth() + cumple[0]) % 12; dia = cumple[1]; }
      else { const c = sumarDias(t, cumple); mes = c.getMonth(); dia = c.getDate(); }
      const ap1 = apellidos.split(' ')[0];
      const resp = responsables[i % responsables.length];
      const ingreso = sumarDias(t, -Math.floor(60 + rnd() * 600));
      const id = 'a' + (i + 1);
      privado[id] = { medicacion: i % 4 === 1 ? 'Indicada por su médico tratante; la familia informa cambios.' : '', observaciones: i % 3 === 0 ? 'Avanza bien en el trabajo en equipo. Revisar objetivos en la próxima reunión con la familia.' : '' };
      return {
        id, nombre, apellidos, apodo, pronombres, programa, beca, talleres: tall,
        fechaNac: iso(new Date(t.getFullYear() - años, mes, dia)),
        rut: rutDemo(20000000 + Math.floor(rnd() * 6000000)),
        estado: i === 12 ? 'pausa' : 'activo',
        fechaIngreso: iso(ingreso), entrevista: iso(sumarDias(ingreso, -12)),
        tutorNombre: `${resp} ${ap1}`, tutorRelacion: parentesco[i % parentesco.length], tutorTelefono: tel(),
        tutorEmail: `${resp.toLowerCase()}.${ap1.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@ejemplo.cl`,
        emergencia: `${responsables[(i + 3) % responsables.length]} ${ap1} · ${tel()}`,
        emergencia2: i % 2 === 0 ? `${responsables[(i + 5) % responsables.length]} ${apellidos.split(' ')[1] || ap1} · ${tel()}` : '',
        direccion: comunas[i % comunas.length], intereses: intereses[i % intereses.length], apoyos: apoyos[i % apoyos.length],
        alergias: i % 5 === 0 ? 'Frutos secos' : (i % 7 === 3 ? 'Lactosa' : ''),
      };
    });

    const asistencia = [];
    const bajos = new Set(['a4', 'a13']);
    for (let k = 42; k >= 1; k--) {
      const d = sumarDias(t, -k), fecha = iso(d);
      for (const tal of talleres) {
        if (!tocaEl(tal, d)) continue;
        for (const a of alumnos) {
          if (!a.talleres.includes(tal.id) || a.fechaIngreso > fecha) continue;
          const r = rnd(), pa = bajos.has(a.id) ? 0.3 : 0.07;
          asistencia.push({ fecha, tallerId: tal.id, alumnoId: a.id, estado: r < pa ? 'A' : r < pa + 0.05 ? 'J' : r < pa + 0.12 ? 'R' : 'P' });
        }
      }
    }
    const auditoria = [{ id: 1, creado: new Date().toISOString(), actor_nombre: 'sistema', accion: 'insert', tabla: 'talleres', registro: '', detalle: { nota: 'Datos de ejemplo cargados' } }];
    return { perfiles, talleres, alumnos, privado, asistencia, auditoria, tienda: crearTiendaDemo() };
  }

  function crearTiendaDemo() {
    const p = (id, nombre, descripcion, categoria, variantes, orden) =>
      ({ id, nombre, descripcion, categoria, variantes, imagen: `tienda/img/${id}.jpg`, precio: null, visible: true, agotado: false, orden });
    return {
      productos: [
        p('poleras', 'Poleras unisex', 'Con el logo de SpectrumPro adelante y atrás.', 'ropa', 'Negra y roja', 1),
        p('poleron', 'Polerón unisex', 'Con el logo pequeño adelante y grande en la espalda.', 'ropa', 'Gris', 2),
        p('tazon', 'Tazón y chapita', 'Edición Muestra Audiovisual 2026.', 'accesorios', '', 3),
        p('calendarios', 'Calendarios', 'De escritorio.', 'papeleria', 'A color o en blanco y negro', 4),
        p('cuadernos', 'Cuadernos', 'Con el logo o con Pipripiolo para colorear.', 'papeleria', 'Logo o Pipripiolo', 5),
        p('chapitas', 'Chapitas', 'Con los logos de SpectrumPro.', 'accesorios', 'Negra o a color', 6),
        p('bolso', 'Bolso blanco', 'Tote bag con el logo de SpectrumPro en negro.', 'accesorios', '', 7),
        p('morral', 'Morral negro', 'Mochila de cuerdas con el logo en blanco.', 'accesorios', '', 8),
      ],
      ajustes: { whatsapp: '56996389673', instagram: '', pago: '', entrega: '' },
    };
  }

  function backendDemo() {
    let db;
    try { db = JSON.parse(leer(CLAVE_DEMO)); } catch { db = null; }
    if (!db?.alumnos) db = crearDemo();
    db.tienda ??= crearTiendaDemo();
    const guardar = () => escribir(CLAVE_DEMO, JSON.stringify(db));
    guardar();
    const yo = () => db.perfiles.find(p => p.id === leer(CLAVE_SESION));
    const veTodo = () => ['admin', 'terapeuta'].includes(yo()?.rol);
    const esAdmin = () => yo()?.rol === 'admin';
    const editaTienda = () => ['admin', 'equipo'].includes(yo()?.rol);
    const misTalleres = () => db.talleres.filter(t => t.equipo.includes(yo()?.id)).map(t => t.id);
    const puedeVer = a => veTodo() || a.talleres.some(t => misTalleres().includes(t));
    const prohibido = () => { throw new Error('No tienes permiso para hacer este cambio.'); };
    const copia = x => JSON.parse(JSON.stringify(x));
    const auditar = (accion, tabla, detalle) => {
      db.auditoria.unshift({ id: Date.now(), creado: new Date().toISOString(), actor_nombre: yo()?.nombre || 'sistema', accion, tabla, registro: '', detalle });
      db.auditoria = db.auditoria.slice(0, 500);
    };

    return {
      modo: 'demo',
      async sesion() { return yo() ? { user: { id: yo().id } } : null; },
      alCambiarSesion() { },
      async entrarDemo(rol) {
        const p = db.perfiles.find(x => x.rol === rol && x.activo);
        escribir(CLAVE_SESION, p.id);
        auditar('login', 'sesion', { rol });
        guardar();
      },
      async entrar() { throw new Error('En modo demostración elige un rol para entrar.'); },
      async salir() { escribir(CLAVE_SESION, null); },
      async recuperar() { },
      async cambiarClave() { },
      async perfil() { await espera(); return copia(yo() || null); },
      async guardarMiFechaNac(fecha) {
        if (!yo()?.rol || !yo().activo) prohibido();
        if (fecha && fecha > iso(hoy())) throw new Error('La fecha de nacimiento no puede ser futura.');
        await espera();
        yo().fechaNac = fecha || '';
        auditar('update', 'perfiles', { campos: ['fecha_nac'] });
        guardar();
      },
      async talleres() { await espera(); return copia(db.talleres).map(t => ({ fechas: [], objetivo: '', edad: '', nota: '', ...t, temporada: t.temporada || 'semestral', modalidad: t.modalidad || 'presencial', enlace: t.enlace || '' })); },

      async guardarTaller(t) {
        if (!esAdmin()) prohibido();
        await espera();
        const id = t.id || nuevoId();
        const i = db.talleres.findIndex(x => x.id === id);
        const fila = { programaPdf: null, programaNombre: '', ...(i >= 0 ? db.talleres[i] : {}), ...copia(t), id, equipo: t.equipo || [] };
        if (i >= 0) db.talleres[i] = fila; else db.talleres.push(fila);
        auditar(i >= 0 ? 'update' : 'insert', 'talleres', { taller: t.nombre });
        guardar(); return id;
      },
      async eliminarTaller(id) {
        if (!esAdmin()) prohibido();
        const t = db.talleres.find(x => x.id === id);
        db.talleres = db.talleres.filter(x => x.id !== id);
        db.alumnos.forEach(a => { a.talleres = a.talleres.filter(x => x !== id); });
        db.asistencia = db.asistencia.filter(r => r.tallerId !== id);
        escribir(CLAVE_PROGRAMA(id), null);
        auditar('delete', 'talleres', { taller: t?.nombre });
        guardar();
      },
      async subirPrograma(tallerId, archivo) {
        if (!esAdmin()) prohibido();
        if (archivo.size > LIMITE_DEMO) throw new Error('En modo demostración el PDF puede pesar hasta 3 MB.');
        const t = db.talleres.find(x => x.id === tallerId);
        const datos = await leerArchivo(archivo);
        try { localStorage.setItem(CLAVE_PROGRAMA(tallerId), datos); }
        catch { throw new Error('No queda espacio en este navegador para guardar el PDF de demostración.'); }
        Object.assign(t, { programaPdf: CLAVE_PROGRAMA(tallerId), programaNombre: archivo.name });
        auditar('update', 'talleres', { taller: t.nombre, campos: ['programa_pdf'] });
        guardar();
      },
      async quitarPrograma(tallerId) {
        if (!esAdmin()) prohibido();
        const t = db.talleres.find(x => x.id === tallerId);
        escribir(CLAVE_PROGRAMA(tallerId), null);
        Object.assign(t, { programaPdf: null, programaNombre: '' });
        auditar('update', 'talleres', { taller: t.nombre, campos: ['programa_pdf'] });
        guardar();
      },
      async urlPrograma(t) {
        const datos = leer(CLAVE_PROGRAMA(t.id));
        if (!datos) throw new Error('Este taller no tiene programa.');
        return URL.createObjectURL(await (await fetch(datos)).blob());
      },
      async alumnos() { await espera(); return copia(db.alumnos.filter(puedeVer)); },
      async guardarAlumno(a) {
        if (!veTodo()) prohibido();
        await espera();
        const id = a.id || nuevoId();
        const i = db.alumnos.findIndex(x => x.id === id);
        const fila = { ...copia(a), id };
        if (i >= 0) db.alumnos[i] = fila; else db.alumnos.push(fila);
        auditar(i >= 0 ? 'update' : 'insert', 'alumnos', { alumno: `${a.nombre} ${a.apellidos}` });
        guardar(); return id;
      },
      async eliminarAlumno(id) {
        if (!esAdmin()) prohibido();
        const a = db.alumnos.find(x => x.id === id);
        db.alumnos = db.alumnos.filter(x => x.id !== id);
        db.asistencia = db.asistencia.filter(r => r.alumnoId !== id);
        delete db.privado[id];
        auditar('delete', 'alumnos', { alumno: a ? `${a.nombre} ${a.apellidos}` : id });
        guardar();
      },
      async privado(id) { if (!veTodo()) prohibido(); await espera(60); return copia(db.privado[id] || { medicacion: '', observaciones: '' }); },
      async guardarPrivado(id, p) {
        if (!veTodo()) prohibido();
        db.privado[id] = { medicacion: p.medicacion || '', observaciones: p.observaciones || '' };
        auditar('update', 'alumnos_privado', {});
        guardar();
      },
      async asistencia(desde) {
        await espera();
        const mios = misTalleres();
        return copia(db.asistencia.filter(r => r.fecha >= desde && (veTodo() || mios.includes(r.tallerId))));
      },
      async marcar(fecha, tallerId, alumnos, estado) {
        if (!(veTodo() || misTalleres().includes(tallerId))) prohibido();
        if (fecha > iso(hoy())) throw new Error('No se puede registrar asistencia en una fecha futura.');
        db.asistencia = db.asistencia.filter(r => !(r.fecha === fecha && r.tallerId === tallerId && alumnos.includes(r.alumnoId)));
        if (estado) for (const a of alumnos) db.asistencia.push({ fecha, tallerId, alumnoId: a, estado });
        auditar(estado ? 'upsert' : 'delete', 'asistencia', { fecha, estado: estado || '—', registros: alumnos.length });
        guardar();
      },
      async cumpleanos() {
        await espera(60);
        return db.alumnos.filter(a => ['activo', 'pausa'].includes(a.estado)).map(a => ({ id: a.id, nombre: a.nombre, apodo: a.apodo, apellidos: a.apellidos, fechaNac: a.fechaNac }));
      },
      async cumpleanosEquipo() {
        await espera(60);
        return db.perfiles.filter(p => p.rol && p.activo && p.fechaNac).map(p => ({ id: p.id, nombre: p.nombre || p.email, apellidos: '', fechaNac: p.fechaNac }));
      },
      async usuarios() {
        if (!esAdmin()) prohibido();
        await espera();
        return copia(db.perfiles.map(u => ({ ...u, talleres: db.talleres.filter(t => t.equipo.includes(u.id)).map(t => t.id) })));
      },
      async invitar({ email, nombre, rol, talleres, fechaNac }) {
        if (!esAdmin()) prohibido();
        await espera(400);
        if (db.perfiles.some(p => p.email.toLowerCase() === email.toLowerCase())) throw new Error('Ya existe una cuenta con ese correo.');
        const id = nuevoId();
        db.perfiles.push({ id, email, nombre, rol, activo: true, fechaNac: fechaNac || '' });
        db.talleres.forEach(t => { if (talleres.includes(t.id)) t.equipo.push(id); });
        auditar('insert', 'perfiles', { email, rol });
        guardar();
        return { ok: true, id };
      },
      async actualizarUsuario(id, u) {
        if (!esAdmin()) prohibido();
        const p = db.perfiles.find(x => x.id === id);
        const quedan = db.perfiles.filter(x => x.rol === 'admin' && x.activo && x.id !== id).length;
        if (p.rol === 'admin' && p.activo && (u.rol !== 'admin' || !u.activo) && !quedan) throw new Error('Debe quedar al menos una persona con rol admin activa.');
        Object.assign(p, { nombre: u.nombre, rol: u.rol, activo: u.activo, fechaNac: u.fechaNac || '' });
        db.talleres.forEach(t => {
          t.equipo = t.equipo.filter(x => x !== id);
          if (u.rol === 'tallerista' && u.talleres.includes(t.id)) t.equipo.push(id);
        });
        auditar('update', 'perfiles', { email: p.email, rol: u.rol, activo: u.activo });
        guardar();
      },
      async eliminarUsuario(id) {
        if (!esAdmin()) prohibido();
        if (id === yo().id) throw new Error('No puedes eliminar tu propia cuenta.');
        const p = db.perfiles.find(x => x.id === id);
        if (p?.rol === 'admin' && p.activo && !db.perfiles.some(x => x.rol === 'admin' && x.activo && x.id !== id)) throw new Error('Debe quedar al menos un admin activo.');
        db.perfiles = db.perfiles.filter(x => x.id !== id);
        db.talleres.forEach(t => { t.equipo = t.equipo.filter(x => x !== id); });
        auditar('delete', 'perfiles', { email: p?.email });
        guardar();
      },
      async tienda() { if (!editaTienda()) prohibido(); await espera(); return copia(db.tienda); },
      async guardarProducto(p) {
        if (!editaTienda()) prohibido();
        await espera();
        const id = p.id || nuevoId();
        const i = db.tienda.productos.findIndex(x => x.id === id);
        const fila = { ...productoAFila(p), id };
        if (i >= 0) db.tienda.productos[i] = fila; else db.tienda.productos.push(fila);
        auditar(i >= 0 ? 'update' : 'insert', 'tienda_productos', { producto: p.nombre });
        guardar(); return id;
      },
      async eliminarProducto(id) {
        if (!editaTienda()) prohibido();
        const p = db.tienda.productos.find(x => x.id === id);
        db.tienda.productos = db.tienda.productos.filter(x => x.id !== id);
        auditar('delete', 'tienda_productos', { producto: p?.nombre });
        guardar();
      },
      async ordenarProductos(ids) {
        if (!editaTienda()) prohibido();
        ids.forEach((id, i) => { const p = db.tienda.productos.find(x => x.id === id); if (p) p.orden = i + 1; });
        guardar();
      },
      async guardarAjustesTienda(a) {
        if (!editaTienda()) prohibido();
        if (a.whatsapp && !/^[0-9]{8,15}$/.test(a.whatsapp)) throw new Error('El WhatsApp debe tener solo números, con el código de país (por ejemplo 56912345678).');
        await espera();
        for (const c of AJUSTES_TIENDA) db.tienda.ajustes[c] = a[c] ?? '';
        auditar('update', 'tienda_ajustes', {});
        guardar();
      },
      // En la demostración la foto queda en este navegador, como texto (ya viene reducida).
      async subirFotoProducto(blob) {
        if (!editaTienda()) prohibido();
        return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      },
      async borrarFotoProducto() { },
      async auditoria(limite = 200) { if (!esAdmin()) prohibido(); await espera(); return copia(db.auditoria.slice(0, limite)); },
      async restablecer() { db.talleres.forEach(t => escribir(CLAVE_PROGRAMA(t.id), null)); db = crearDemo(); guardar(); },

      /* Estudio de posts: en la demostración las fotos se guardan dentro del post como data URL. */
      async posts() {
        if (!esAdmin()) prohibido(); await espera();
        return leerPosts().map(({ datos, ...p }) => p).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
      },
      async post(id) {
        if (!esAdmin()) prohibido(); await espera();
        const p = leerPosts().find(x => x.id === id);
        if (!p) throw new Error('Ese post ya no existe.');
        return p;
      },
      async guardarPost(p) {
        if (!esAdmin()) prohibido(); await espera();
        const lista = leerPosts().filter(x => x.id !== p.id);
        lista.push({ ...copia(p), actualizado: new Date().toISOString() });
        try { localStorage.setItem(CLAVE_POSTS, JSON.stringify(lista)); }
        catch { throw new Error('El navegador no tiene espacio para guardar más posts de demostración. Borra alguno o usa fotos más livianas.'); }
      },
      async eliminarPost(id) {
        if (!esAdmin()) prohibido(); await espera();
        escribir(CLAVE_POSTS, JSON.stringify(leerPosts().filter(x => x.id !== id)));
      },
      async subirFotoPost(postId, blob) {
        if (!esAdmin()) prohibido();
        return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      },
      async fotoPost(ref) { return ref; },
      async limpiarFotosPost() { },
    };
  }

  const cfg = window.SPECTRUMPRO_CONFIG || {};
  const conSupabase = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient;
  window.SPDatos = conSupabase ? backendSupabase(cfg) : backendDemo();
})();
