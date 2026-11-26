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
  window.SPFechas = { pad, iso, hoy, sumarDias };

  const urlBase = () => location.origin + location.pathname;

  /* ---------- conversión fila (snake_case) ⇄ objeto (camelCase) ---------- */
  const CAMPOS_ALUMNO = {
    nombre: 'nombre', apellidos: 'apellidos', apodo: 'apodo', pronombres: 'pronombres', fechaNac: 'fecha_nac', rut: 'rut',
    programa: 'programa', beca: 'beca', estado: 'estado', fechaIngreso: 'fecha_ingreso', entrevista: 'entrevista',
    tutorNombre: 'tutor_nombre', tutorRelacion: 'tutor_relacion', tutorTelefono: 'tutor_telefono', tutorEmail: 'tutor_email',
    emergencia: 'emergencia', direccion: 'direccion', intereses: 'intereses', apoyos: 'apoyos', alergias: 'alergias',
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
    equipo: equipo.filter(e => e.taller_id === f.id).map(e => e.perfil_id),
  });
  const tallerAFila = t => ({
    nombre: t.nombre, area: t.area || '', dias: t.dias, hora_inicio: t.horaInicio || null, hora_fin: t.horaFin || null,
    encargado: t.encargado || '', color: t.color || '#635CC7', activo: !!t.activo, orden: t.orden ?? 0,
    temporada: t.temporada === 'verano' ? 'verano' : 'semestral',
  });

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
    if (/duplicate key/i.test(m)) return new Error('Ese registro ya existe.');
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
        return ok(await sb.from('perfiles').select('*').eq('id', u.id).maybeSingle());
      },
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
      async eliminarTaller(id) { ok(await sb.from('talleres').delete().eq('id', id)); },
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
      async usuarios() {
        const [p, e] = await Promise.all([
          todo(() => sb.from('perfiles').select('*').order('nombre').order('id')),
          todo(() => sb.from('taller_equipo').select('*').order('taller_id').order('perfil_id')),
        ]);
        return p.map(u => ({ ...u, talleres: e.filter(x => x.perfil_id === u.id).map(x => x.taller_id) }));
      },
      async invitar(datos) {
        const { data, error } = await sb.functions.invoke('gestionar-usuario', { body: { accion: 'invitar', ...datos, redirectTo: urlBase() } });
        if (error) {
          let m = error.message;
          try { m = (await error.context.json()).error || m; } catch { /* sin cuerpo */ }
          throw traducir(m);
        }
        return data;
      },
      async actualizarUsuario(id, u) {
        ok(await sb.from('perfiles').update({ nombre: u.nombre, rol: u.rol, activo: u.activo }).eq('id', id));
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
      async auditoria(limite = 200) {
        return ok(await sb.from('auditoria').select('*').order('creado', { ascending: false }).limit(limite));
      },
    };
  }

  /* =====================================================================
     Backend de demostración
     ===================================================================== */
  const CLAVE_DEMO = 'spectrumpro:demo:v2';
  const CLAVE_SESION = 'spectrumpro:demo:sesion';
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const espera = (ms = 120) => new Promise(r => setTimeout(r, ms));
  const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

  function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function crearDemo() {
    const rnd = mulberry32(1710);
    const t = hoy();
    const perfiles = [
      { id: 'u-admin', email: 'direccion@ejemplo.cl', nombre: 'Dirección (demo)', rol: 'admin', activo: true },
      { id: 'u-tera', email: 'terapeuta@ejemplo.cl', nombre: 'Terapeuta (demo)', rol: 'terapeuta', activo: true },
      { id: 'u-talle', email: 'tallerista@ejemplo.cl', nombre: 'Tallerista (demo)', rol: 'tallerista', activo: true },
      { id: 'u-pend', email: 'nueva.persona@ejemplo.cl', nombre: 'Persona invitada', rol: null, activo: false },
    ];
    const talleres = [
      ['lab', 'Laboratorio Creativo', 'Arte y Apoyo', [2], '16:00', '17:30', 'Equipo Arte y Apoyo', '#635CC7', []],
      ['anim', 'Animación Digital', 'Centro de Formación', [1, 3], '15:00', '17:00', 'Encargado de Animación Digital', '#31B4E7', ['u-talle']],
      ['dibujo', 'Dibujo e Ilustración', 'Centro de Formación', [2, 4], '15:00', '16:30', 'Encargada de Dibujo e Ilustración', '#E65EBE', []],
      ['teatro', 'Teatro', 'Centro de Formación', [4], '16:30', '18:00', 'Encargado de Teatro', '#F8384B', []],
      ['titeres', 'Títeres y TV', 'Centro de Formación', [5], '15:00', '17:00', 'Equipo de Títeres y TV', '#E0B800', []],
      ['video', 'Videojuegos', 'Centro de Formación', [3], '17:00', '18:30', 'Encargado de Videojuegos', '#00BC70', ['u-talle']],
      ['cocina', 'Habilidades para la vida diaria con Cocina', 'Terapia Ocupacional', [1], '11:00', '12:30', 'Terapeuta ocupacional', '#2A9D8F', []],
      ['vellon', 'Cuentos con Vellón', 'Terapia Ocupacional', [5], '11:00', '12:30', 'Terapeuta ocupacional', '#9B6AD6', []],
      ['v-comic', 'Cómic de Verano', 'Centro de Formación', [1, 3, 5], '10:00', '12:00', 'Encargada de Dibujo e Ilustración', '#F28C28', [], 'verano'],
      ['v-cine', 'Cine al Aire Libre', 'Arte y Apoyo', [2, 4], '10:30', '12:30', 'Equipo Arte y Apoyo', '#1F8FD1', ['u-talle'], 'verano'],
    ].map(([id, nombre, area, dias, horaInicio, horaFin, encargado, color, equipo, temporada = 'semestral'], i) =>
      ({ id, nombre, area, dias, horaInicio, horaFin, encargado, color, activo: true, orden: i + 1, equipo, temporada }));

    // [nombre, apellidos, apodo, pronombres, programa, talleres, cumpleaños (días desde hoy | [meses, día]), edad, beca]
    const filas = [
      ['Matías', 'Rojas Fuentes', '', 'él', 'FormaPro', ['anim', 'video', 'dibujo'], 3, 19, 'Beca parcial'],
      ['Antonia', 'Silva Paredes', 'Anto', 'ella', 'FormaPro', ['dibujo', 'teatro'], 9, 22, ''],
      ['Benjamín', 'Muñoz Tapia', 'Benja', 'él', 'Talleres', ['video', 'anim'], 17, 17, ''],
      ['Josefa', 'Contreras Vidal', '', 'ella', 'Arte Terapia', ['lab', 'dibujo'], 26, 24, 'Arancel diferenciado'],
      ['Tomás', 'Herrera Lagos', '', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'titeres'], 0, 21, 'Beca completa'],
      ['Florencia', 'Soto Araya', 'Flo', 'ella', 'FormaPro', ['teatro', 'titeres'], [2, 14], 20, ''],
      ['Vicente', 'Pérez Morales', '', 'él', 'Talleres', ['anim'], [3, 3], 16, ''],
      ['Isidora', 'González Pinto', 'Isi', 'ella', 'Arte Terapia', ['lab'], [4, 21], 18, 'Beca parcial'],
      ['Agustín', 'Díaz Navarro', '', 'él', 'FormaPro', ['video', 'anim', 'teatro'], [5, 8], 23, ''],
      ['Martina', 'Castro Reyes', 'Marti', 'elle', 'Talleres', ['dibujo', 'lab'], [6, 28], 19, ''],
      ['Cristóbal', 'Vargas Espinoza', 'Cris', 'él', 'Terapia Ocupacional', ['cocina', 'vellon', 'lab'], [7, 12], 25, 'Beca completa'],
      ['Emilia', 'Fernández Bravo', '', 'ella', 'FormaPro', ['titeres', 'teatro', 'dibujo'], [8, 5], 22, ''],
      ['Lucas', 'Torres Olivares', '', 'él', 'Talleres', ['video'], [9, 18], 15, ''],
      ['Catalina', 'Ramírez Lillo', 'Cata', 'ella', 'Arte Terapia', ['lab', 'titeres'], [1, 27], 20, 'Arancel diferenciado'],
    ];
    const intereses = ['Animación 2D y cómics', 'Dibujo de personajes, anime', 'Edición de video, videojuegos indie', 'Pintura, música', 'Cocina, títeres', 'Actuación y voz', 'Stop motion', 'Fotografía', 'Modelado 3D, Minecraft', 'Ilustración digital', 'Guion y escritura', 'Teatro, improvisación', 'Programación de juegos', 'Doblaje y locución'];
    const apoyos = ['Anticipar cambios de sala o de horario con un aviso previo.', 'Puede usar audífonos con cancelación de ruido durante el trabajo individual.', 'Prefiere instrucciones por escrito además de verbales.', 'Necesita pausas sensoriales cortas; usa la sala tranquila.', 'Funciona mejor en grupos pequeños y con un rol definido.', 'Agenda visual al inicio de cada sesión.'];
    const parentesco = ['Madre', 'Padre', 'Madre', 'Tutora legal', 'Padre', 'Madre', 'Abuela'];
    const comunas = ['Providencia', 'Ñuñoa', 'Las Condes', 'Santiago Centro', 'La Reina', 'Macul', 'San Miguel'];
    const responsables = ['Carolina', 'Rodrigo', 'Paula', 'Andrea', 'Felipe', 'Claudia', 'Marcela'];
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
        rut: `${20 + Math.floor(rnd() * 6)}.${100 + Math.floor(rnd() * 899)}.${100 + Math.floor(rnd() * 899)}-${Math.floor(rnd() * 10)}`,
        estado: i === 12 ? 'pausa' : 'activo',
        fechaIngreso: iso(ingreso), entrevista: iso(sumarDias(ingreso, -12)),
        tutorNombre: `${resp} ${ap1}`, tutorRelacion: parentesco[i % parentesco.length], tutorTelefono: tel(),
        tutorEmail: `${resp.toLowerCase()}.${ap1.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}@ejemplo.cl`,
        emergencia: `${responsables[(i + 3) % responsables.length]} ${ap1} · ${tel()}`,
        direccion: comunas[i % comunas.length], intereses: intereses[i % intereses.length], apoyos: apoyos[i % apoyos.length],
        alergias: i % 5 === 0 ? 'Frutos secos' : (i % 7 === 3 ? 'Lactosa' : ''),
      };
    });

    const asistencia = [];
    const bajos = new Set(['a4', 'a13']);
    for (let k = 42; k >= 1; k--) {
      const d = sumarDias(t, -k), fecha = iso(d);
      for (const tal of talleres) {
        if (!tal.dias.includes(d.getDay())) continue;
        for (const a of alumnos) {
          if (!a.talleres.includes(tal.id) || a.fechaIngreso > fecha) continue;
          const r = rnd(), pa = bajos.has(a.id) ? 0.3 : 0.07;
          asistencia.push({ fecha, tallerId: tal.id, alumnoId: a.id, estado: r < pa ? 'A' : r < pa + 0.05 ? 'J' : r < pa + 0.12 ? 'R' : 'P' });
        }
      }
    }
    const auditoria = [{ id: 1, creado: new Date().toISOString(), actor_nombre: 'sistema', accion: 'insert', tabla: 'talleres', registro: '', detalle: { nota: 'Datos de ejemplo cargados' } }];
    return { perfiles, talleres, alumnos, privado, asistencia, auditoria };
  }

  function backendDemo() {
    let db;
    try { db = JSON.parse(leer(CLAVE_DEMO)); } catch { db = null; }
    if (!db?.alumnos) db = crearDemo();
    const guardar = () => escribir(CLAVE_DEMO, JSON.stringify(db));
    guardar();
    const yo = () => db.perfiles.find(p => p.id === leer(CLAVE_SESION));
    const veTodo = () => ['admin', 'terapeuta'].includes(yo()?.rol);
    const esAdmin = () => yo()?.rol === 'admin';
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
      async talleres() { await espera(); return copia(db.talleres).map(t => ({ ...t, temporada: t.temporada || 'semestral' })); },
      async guardarTaller(t) {
        if (!esAdmin()) prohibido();
        await espera();
        const id = t.id || nuevoId();
        const i = db.talleres.findIndex(x => x.id === id);
        const fila = { ...copia(t), id, equipo: t.equipo || [] };
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
        auditar('delete', 'talleres', { taller: t?.nombre });
        guardar();
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
      async usuarios() {
        if (!esAdmin()) prohibido();
        await espera();
        return copia(db.perfiles.map(u => ({ ...u, talleres: db.talleres.filter(t => t.equipo.includes(u.id)).map(t => t.id) })));
      },
      async invitar({ email, nombre, rol, talleres }) {
        if (!esAdmin()) prohibido();
        await espera(400);
        if (db.perfiles.some(p => p.email.toLowerCase() === email.toLowerCase())) throw new Error('Ya existe una cuenta con ese correo.');
        const id = nuevoId();
        db.perfiles.push({ id, email, nombre, rol, activo: true });
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
        Object.assign(p, { nombre: u.nombre, rol: u.rol, activo: u.activo });
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
      async auditoria(limite = 200) { if (!esAdmin()) prohibido(); await espera(); return copia(db.auditoria.slice(0, limite)); },
      async restablecer() { db = crearDemo(); guardar(); },
    };
  }

  const cfg = window.SPECTRUMPRO_CONFIG || {};
  const conSupabase = cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient;
  window.SPDatos = conSupabase ? backendSupabase(cfg) : backendDemo();
})();
