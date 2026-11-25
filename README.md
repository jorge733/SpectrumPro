# SpectrumPro · Sitio web y gestión de alumnado

Este repositorio tiene el **sitio web público** de SpectrumPro (raíz, `spectrumpro.vercel.app/`), la **tienda** (`/tienda/`) y la **plataforma interna** del equipo (`/plataforma/`). Todo se publica en Vercel con cada cambio en `main`.

Plataforma interna de [SpectrumPro](https://spectrumpro.cl/) para registrar la **asistencia** a los talleres, ver los **cumpleaños** y mantener la **ficha** de cada joven.

Sigue la estructura de la Plataforma II° Medio del Colegio Michelangelo: pantalla de carga, inicio de sesión, menú lateral plegable, barra inferior en el celular, roles, sección de Administración, auditoría e instalación como app (PWA). Usa **Supabase** en lugar de Firebase.

## Qué hace

| Sección | Contenido |
| --- | --- |
| **Panel** | Sesiones del día, próximos cumpleaños, asistencia semanal y jóvenes con menos de 75% de asistencia |
| **Asistencia** | Pasar lista por sesión de taller (Presente, Retraso, Ausente, Justificada) y resumen mensual por taller |
| **Cumpleaños** | Separados en **Jóvenes** y **Profesores**: cumpleaños de hoy, de los próximos 30 días y calendario de 12 meses. Cada profesor añade su propia fecha (en la pestaña Profesores o pulsando su nombre en el menú); dirección también puede ponerla al editar una cuenta |
| **Fichas** | Datos personales, programa, talleres, beca, familia, apoyos, datos privados de salud e historial de asistencia |
| **Talleres** | Horario semanal, equipo a cargo e inscritos. Dirección crea y edita talleres |
| **Administración** | Invitar cuentas y asignar roles, auditoría de cambios y exportación a CSV |

### Roles

| Rol | Qué ve y qué puede hacer |
| --- | --- |
| **Dirección** (`admin`) | Todo. Gestiona cuentas, talleres y fichas, y ve la auditoría |
| **Terapeuta** (`terapeuta`) | Todo el alumnado, incluidos los datos privados (medicación y observaciones). Crea y edita fichas. Pasa lista en cualquier taller |
| **Tallerista** (`tallerista`) | Solo a quienes están inscritos en sus talleres: datos de contacto, apoyos y alergias. Pasa lista solo en sus talleres. Ve los cumpleaños de todo el alumnado y del equipo (nombre y fecha) |
| **Equipo** (`equipo`) | Personas que no pasan lista ni ven fichas (gestión, asistentes, productora). Ven los talleres (horario y quién está a cargo) y los cumpleaños de jóvenes y equipo, ponen el suyo y editan la tienda |

Los permisos se aplican **en la base de datos** con políticas RLS. Aunque alguien modifique la página en su navegador, Supabase no le entrega datos que su rol no puede ver.

## Probarla sin configurar nada

No hay que compilar nada: son archivos estáticos (HTML, CSS y JavaScript sin dependencias; `supabase-js` se carga desde jsDelivr). Sírvelos con cualquier servidor local, por ejemplo:

```bash
python3 -m http.server 8000
```

y abre <http://localhost:8000> (sitio) o <http://localhost:8000/plataforma/> (plataforma). El service worker de la plataforma solo se activa con `http://localhost` o `https://`.

Si `config.js` no tiene datos de Supabase, la plataforma entra en **modo demostración**: eliges un rol y recorres la plataforma con jóvenes ficticios guardados solo en ese navegador. Para probar así con este repositorio, deja vacíos `supabaseUrl` y `supabaseAnonKey` en una copia local (sin subir el cambio).

## Conectar Supabase

### 1. Crear el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com). Elige la región São Paulo (`sa-east-1`), que es la más cercana a Chile.
2. En **SQL Editor**, ejecuta **en orden** los archivos de `supabase/migrations/`. En un proyecto ya creado basta con ejecutar los que falten; todos se pueden volver a ejecutar sin romper nada.

   | Archivo | Qué hace |
   | --- | --- |
   | `20261120000000_spectrumpro.sql` | Tablas, permisos por rol (RLS) y auditoría |
   | `20261120010000_talleres_unicos.sql` | Quita talleres duplicados e impide que se repitan |
   | `20261124000000_cumpleanos_equipo.sql` | Fecha de nacimiento en las cuentas del equipo |
   | `20261124010000_mi_fecha_nac.sql` | Cada persona del equipo pone su propio cumpleaños |
   | `20261124020000_emergencia2.sql` | Segundo contacto de emergencia en la ficha |
   | `20261124030000_talleres_sitio_web.sql` | Talleres, módulos y mentorías publicados en spectrumpro.cl |
   | `20261124040000_rol_equipo.sql` | Rol **Equipo** |
   | `20261124050000_encuesta_muestra.sql` | Tabla de la encuesta de la Muestra Audiovisual |
   | `20261124060000_tienda.sql` | Tienda: productos, contacto y bucket de fotos |
   | `20261124070000_tienda_equipo.sql` | El rol Equipo también edita la tienda |
   | `20261125000000_ficha_cualitativa.sql` | Ficha cualitativa del participante (formulario web) |
   | `20261125010000_sitio.sql` | Sitio web: textos y listas editables, bucket de fotos y contenido inicial |

3. En el mismo editor, ejecuta `supabase/seed.sql` para cargar los talleres iniciales. Los horarios son de ejemplo; después se ajustan desde la plataforma.

### 2. Configurar el acceso

En **Authentication**:

1. **Sign In / Providers → Email**: desactiva **Allow new users to sign up**. Así solo entran personas invitadas por dirección. Aunque alguien lograra registrarse, su cuenta nace sin rol y no ve nada.
2. **URL Configuration**: en **Site URL** pon la dirección de la plataforma, `https://spectrumpro.vercel.app/plataforma/`, y agrégala también en **Redirect URLs**. Los enlaces de invitación y de cambio de contraseña llevan ahí. Si un correo antiguo apunta a la raíz, el sitio lo reenvía solo a `/plataforma/`.
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

En `config.js` pega la **Project URL** y la **Publishable key** (Project Settings → API Keys):

```js
window.SPECTRUMPRO_CONFIG = {
  supabaseUrl: 'https://xxxx.supabase.co',
  supabaseAnonKey: 'sb_publishable_...',
};
```

La publishable key es pública por diseño: la seguridad la dan las políticas RLS. **Nunca** pongas una *secret key* ni la `service_role` key en este archivo.

### 6. Publicar la plataforma

Son archivos estáticos. Hoy se publican en **Vercel** (`spectrumpro.vercel.app`): cada cambio que llega a `main` se publica solo. La plataforma queda en `/plataforma/`; el sitio público, en la raíz.

## Encuesta de la Muestra Audiovisual

`encuesta.html` es una página pública, con la gráfica del afiche, para quienes asistirán a la Muestra Audiovisual (viernes 11 de diciembre, 11:00, Centro Cultural La Moneda). No pide iniciar sesión. Pregunta nombre, correo, teléfono (opcional), cuántas personas acompañan, la relación con SpectrumPro, cómo se enteraron, qué necesitan para estar cómodos (silla de ruedas, espacio de calma, protectores auditivos, subtítulos, Lengua de Señas Chilena…) y qué esperan de la muestra.

Para activarla:

1. Asegúrate de haber ejecutado `supabase/migrations/20261124050000_encuesta_muestra.sql` (crea la tabla `encuesta_evento`).
2. Publica el sitio y comparte el enlace `…/encuesta.html` (o un código QR que apunte a él).

El público solo puede **enviar** respuestas: no puede leer las de otras personas. Las ven dirección y terapeutas en **Table Editor → encuesta_evento**, desde donde se exportan a CSV. Si `config.js` no tiene datos de Supabase, la encuesta funciona en modo de prueba y no guarda nada.

## Sitio web público

La raíz (`/`) es el sitio de SpectrumPro: Inicio, Nosotros, Formación, Arte y Apoyo, Productora, Colabora y Contacto. Reemplaza al sitio en WordPress de spectrumpro.cl, con el mismo contenido (equipo, talleres, mentorías, servicios, producciones) y las imágenes optimizadas (`sitio/img/`, unos 750 KB en total).

**Se edita en la plataforma, sección «Sitio web»** (dirección y rol Equipo): textos de cada página y las listas de equipo, talleres, mentorías, módulos de FormaPro, actividades, Arte y Apoyo, servicios, producciones y valores, con fotos, orden y opción de ocultar. Los cambios se ven al recargar el sitio.

Para activarlo, ejecuta en **SQL Editor** `supabase/migrations/20261125010000_sitio.sql`. Crea `sitio_textos` y `sitio_elementos`, el bucket de fotos `sitio` y carga el contenido inicial. Mientras no se ejecute, el sitio muestra la copia de respaldo `sitio/contenido.js`.

Cómo está hecho:

| Archivo | Contenido |
| --- | --- |
| `sitio/paginas/*.html` | El cuerpo de cada página, con su título y descripción |
| `sitio/construir.py` | Arma las páginas (`index.html`, `nosotros/`, `formacion/`…) con la misma cabecera, pie y metadatos. Después de cambiar una página o la cabecera: `python3 sitio/construir.py` |
| `sitio/sitio.css`, `sitio/sitio.js` | Estilos y lógica: pinta el contenido de Supabase (y guarda una copia en el navegador para que la próxima visita cargue al instante) |
| `sitio/contenido-inicial.py` | Contenido inicial; genera `sitio/contenido.js` y la carga inicial de la migración |
| `vercel.json` | Redirige las direcciones del sitio en WordPress (`/quienes-somos`, `/nuestros-talleres`…) a las nuevas, para cuando spectrumpro.cl apunte a Vercel |

**Para que spectrumpro.cl muestre este sitio:** en Vercel, *Project → Settings → Domains*, agrega `spectrumpro.cl` y `www.spectrumpro.cl` y cambia los registros DNS donde está registrado el dominio según lo que indique Vercel. El correo (`@spectrumpro.cl`) no se ve afectado si solo cambias los registros del sitio (A/CNAME), no los MX.

## Tienda

`tienda/index.html` es la tienda pública de productos (`/tienda/`): portada, catálogo con filtros (Ropa, Accesorios, Papelería), pasos para pedir y botón de WhatsApp con el mensaje ya escrito para cada producto.

Los productos y el contacto se editan en la plataforma, sección **Tienda** (dirección y rol Equipo): nombre, foto, tipo, precio, tallas o colores, descripción, orden, «Agotado» y «Mostrar en la tienda»; además el WhatsApp, Instagram, forma de pago y entrega. Los cambios se ven al instante en la tienda.

Para activarla:

1. En **SQL Editor** de Supabase, ejecuta `supabase/migrations/20261124060000_tienda.sql`. Crea las tablas `tienda_productos` y `tienda_ajustes`, el bucket público de fotos `tienda` y carga los 8 productos actuales.
2. Listo: la tienda lee de Supabase. Mientras no se ejecute la migración, muestra la lista de respaldo que trae la página (sin precios).

**Incrustarla en spectrumpro.cl (WordPress):** pega el contenido de `tienda/wordpress.html` en un widget **HTML** de Elementor, en una página con plantilla de ancho completo. Ese código carga `/tienda/?embed=1`, que oculta la cabecera y el pie propios de la tienda, ajusta el alto solo y hace scroll en la página de WordPress al tocar «Ver productos» o «Cómo pedir».

El público solo puede **leer** los productos visibles y el contacto. Crear, editar, borrar y subir fotos lo pueden hacer solo dirección y el rol Equipo (después de ejecutar `20261124070000_tienda_equipo.sql`), y cada cambio queda en la auditoría. Las fotos se reducen en el navegador (máx. 1000 px) antes de subirlas.

## Ficha cualitativa del participante

`ficha-participante.html` es la versión web de la *Ficha cualitativa del participante* (sin el logo de la UAI). No pide iniciar sesión: la completan familias, participantes o profesionales desde el celular o el computador.

- Una sección por pantalla (Identificación, Antecedentes, Fortalezas, Intereses, Comunicación, Perfil sensorial, Regulación emocional, Participación y Objetivos), con barra de avance y saltos directos a cada sección.
- Solo el nombre del participante y de quien completa son obligatorios. La edad se calcula sola con la fecha de nacimiento.
- Lo escrito se guarda como borrador en el dispositivo hasta enviar; al enviar se borra.
- Antes de enviar muestra un resumen por sección; se puede imprimir o guardar como PDF.

Para activarla, ejecuta en **SQL Editor** `supabase/migrations/20261125000000_ficha_cualitativa.sql`, que crea la tabla `ficha_cualitativa`. El público solo puede **enviar** fichas; las ven dirección y terapeutas en **Table Editor → ficha_cualitativa** (las respuestas detalladas están en la columna `datos`). Sin datos de Supabase en `config.js`, funciona en modo de prueba y no guarda nada.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html`, `nosotros/`, `formacion/`, `arte-y-apoyo/`, `productora/`, `colabora/`, `contacto/` | Sitio público (generado; se edita en `sitio/paginas/`) |
| `sitio/` | Estilos, lógica, imágenes y contenido del sitio público |
| `plataforma/index.html` | Plataforma interna: pantalla de carga, acceso, estructura y diálogos |
| `encuesta.html` | Encuesta pública para la Muestra Audiovisual |
| `tienda/` | Tienda pública de productos; se edita en la sección Tienda |
| `assets/og/` | Imágenes de 1200×630 para la vista previa al compartir cada página (Open Graph) |
| `ficha-participante.html` | Ficha cualitativa del participante, para completar en la web |
| `plataforma/styles.css` | Estilos de la plataforma, con tema claro y oscuro y adaptación a celular |
| `config.js` | URL y clave pública de Supabase |
| `plataforma/js/datos.js` | Capa de datos: Supabase o demostración, con la misma interfaz |
| `plataforma/js/app.js` | Vistas, roles, formularios y lógica de asistencia, cumpleaños, tienda y sitio web |
| `plataforma/sw.js`, `plataforma/manifest.webmanifest` | Instalación como app y uso básico sin conexión. Al publicar cambios, sube `VERSION` en `plataforma/sw.js` |
| `sw.js` (raíz) | Da de baja el service worker antiguo de la raíz en los teléfonos que tenían instalada la plataforma antes de la mudanza |
| `assets/` | Logo, íconos de la app e imágenes de la Muestra (las de vista previa están en `assets/og/`) |
| `supabase/migrations/…sql` | Tablas, RLS, auditoría, cumpleaños, rol Equipo y encuesta (ver la tabla de arriba) |
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
encuesta_evento (evento, nombre, email, acompanantes, relacion, accesibilidad[]…) → el público solo inserta
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
