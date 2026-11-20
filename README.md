# SpectrumPro · Gestión de alumnado

Plataforma interna de [SpectrumPro](https://spectrumpro.cl/) para registrar la **asistencia** a los talleres, ver los **cumpleaños** y mantener la **ficha** de cada joven.

Sigue la estructura de la Plataforma II° Medio del Colegio Michelangelo: pantalla de carga, inicio de sesión, menú lateral plegable, barra inferior en el celular, roles, sección de Administración, auditoría e instalación como app (PWA). Usa **Supabase** en lugar de Firebase.

## Qué hace

| Sección | Contenido |
| --- | --- |
| **Panel** | Sesiones del día, próximos cumpleaños, asistencia semanal y jóvenes con menos de 75% de asistencia |
| **Asistencia** | Pasar lista por sesión de taller (Presente, Retraso, Ausente, Justificada) y resumen mensual por taller |
| **Cumpleaños** | Cumpleaños de hoy, de los próximos 30 días y calendario de 12 meses |
| **Fichas** | Datos personales, programa, talleres, beca, familia, apoyos, datos privados de salud e historial de asistencia |
| **Talleres** | Horario semanal, equipo a cargo e inscritos. Dirección crea y edita talleres |
| **Administración** | Invitar cuentas y asignar roles, auditoría de cambios y exportación a CSV |

### Roles

| Rol | Qué ve y qué puede hacer |
| --- | --- |
| **Dirección** (`admin`) | Todo. Gestiona cuentas, talleres y fichas, y ve la auditoría |
| **Terapeuta** (`terapeuta`) | Todo el alumnado, incluidos los datos privados (medicación y observaciones). Crea y edita fichas. Pasa lista en cualquier taller |
| **Tallerista** (`tallerista`) | Solo a quienes están inscritos en sus talleres: datos de contacto, apoyos y alergias. Pasa lista solo en sus talleres. Ve los cumpleaños de todo el alumnado (nombre y fecha) |

Los permisos se aplican **en la base de datos** con políticas RLS. Aunque alguien modifique la página en su navegador, Supabase no le entrega datos que su rol no puede ver.

## Probarla sin configurar nada

Abre `index.html` en el navegador. Si `config.js` no tiene datos de Supabase, la plataforma entra en **modo demostración**: eliges un rol y recorres la plataforma con jóvenes ficticios guardados solo en ese navegador.

## Conectar Supabase

### 1. Crear el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com). Elige la región São Paulo (`sa-east-1`), que es la más cercana a Chile.
2. En **SQL Editor**, ejecuta completo el archivo `supabase/migrations/20261120000000_spectrumpro.sql`. Crea las tablas, los permisos por rol y la auditoría.
3. En el mismo editor, ejecuta `supabase/seed.sql` para cargar los talleres iniciales. Los horarios son de ejemplo; después se ajustan desde la plataforma.

### 2. Configurar el acceso

En **Authentication**:

1. **Sign In / Providers → Email**: desactiva **Allow new users to sign up**. Así solo entran personas invitadas por dirección. Aunque alguien lograra registrarse, su cuenta nace sin rol y no ve nada.
2. **URL Configuration**: en **Site URL** pon la dirección donde publicarás la plataforma (por ejemplo `https://alumnado.spectrumpro.cl`) y agrégala también en **Redirect URLs**.
3. **Emails** (opcional): traduce al español los correos de invitación y de recuperación de contraseña.

### 3. Crear la primera cuenta de dirección

1. **Authentication → Users → Add user → Create new user**: escribe tu correo y una contraseña y marca **Auto Confirm User**.
2. En **SQL Editor**, ejecuta:

   ```sql
   update public.perfiles
   set rol = 'admin', activo = true, nombre = 'Tu nombre'
   where email = 'tu-correo@spectrumpro.cl';
   ```

Las demás cuentas se invitan desde **Administración → Cuentas del equipo**.

### 4. Publicar la función para invitar cuentas

La invitación necesita la clave secreta de Supabase, así que se ejecuta en el servidor (una *Edge Function*) y nunca en el navegador.

Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):

```bash
supabase login
```

```bash
supabase link --project-ref TU_PROJECT_REF
```

```bash
supabase functions deploy gestionar-usuario
```

O desde el panel: **Edge Functions → Deploy a new function → Via Editor**, con el nombre `gestionar-usuario` y el contenido de `supabase/functions/gestionar-usuario/index.ts`.

### 5. Conectar la página

En `config.js` pega la **Project URL** y la clave **anon public** (Project Settings → API):

```js
window.SPECTRUMPRO_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'eyJ...',
};
```

La clave *anon* es pública por diseño: la seguridad la dan las políticas RLS. **Nunca** pongas la `service_role` key en este archivo.

### 6. Publicar la plataforma

Son archivos estáticos: sirve cualquier hosting. Con GitHub Pages, en *Settings → Pages* elige la rama y la carpeta raíz. Para un dominio propio como `alumnado.spectrumpro.cl`, agrega el registro DNS que indica GitHub.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html` | Pantalla de carga, acceso, estructura y diálogos |
| `styles.css` | Estilos con la paleta del logo, tema claro y oscuro y adaptación a celular |
| `config.js` | URL y clave pública de Supabase |
| `js/datos.js` | Capa de datos: Supabase o demostración, con la misma interfaz |
| `js/app.js` | Vistas, roles, formularios y lógica de asistencia y cumpleaños |
| `sw.js`, `manifest.webmanifest` | Instalación como app y uso básico sin conexión |
| `supabase/migrations/…sql` | Tablas, RLS, auditoría y función de cumpleaños |
| `supabase/seed.sql` | Talleres iniciales |
| `supabase/functions/gestionar-usuario` | Invitar y eliminar cuentas (solo dirección) |

### Modelo de datos

```
perfiles        (id = auth.users.id, email, nombre, rol, activo)
talleres        (id, nombre, area, dias[], hora_inicio, hora_fin, encargado, color, activo, orden)
taller_equipo   (taller_id, perfil_id)          → quién pasa lista en cada taller
alumnos         (id, datos personales, programa, estado, beca, familia, apoyos, alergias…)
alumnos_privado (alumno_id, medicacion, observaciones)   → solo dirección y terapeutas
inscripciones   (alumno_id, taller_id, desde)
asistencia      (taller_id, alumno_id, fecha, estado P|R|A|J, nota, registrado_por)
auditoria       (creado, actor, actor_nombre, accion, tabla, registro, detalle)  → la escriben triggers
```

El porcentaje de asistencia cuenta Presente y Retraso como asistencia. Las ausencias justificadas se muestran aparte.

## Mejoras respecto de la plataforma Michelangelo

- **Permisos en la base de datos.** Los roles los aplican las políticas RLS, no solo la interfaz. Una persona no puede cambiar su propio rol.
- **Auditoría que no se puede omitir.** La escriben triggers de Postgres, registra a todas las personas y no copia datos sensibles: solo qué campos cambiaron.
- **Ningún secreto en el navegador.** Crear y borrar cuentas pasa por una Edge Function con la clave de servicio.
- **Tablas reales en lugar de listas dentro de un documento**, así dos personas pueden editar a la vez sin pisarse.
- **Siempre queda una cuenta de dirección.** La base de datos impide desactivar o borrar al último admin.
- **Sin manejadores `onclick` en el HTML**, y el texto que viene de los datos siempre se escapa.

## Pendiente

- Notificaciones push (ausencias seguidas, cumpleaños).
- Calendario de feriados y sesiones canceladas.
- Adjuntar documentos a la ficha (Supabase Storage).
- Vista para familias.
