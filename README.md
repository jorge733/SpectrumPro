# SpectrumPro · Plataforma del equipo

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
| **Posts** | Solo dirección. Estudio para crear posts de Instagram con la gráfica de la marca (reemplaza a Canva). Ver «Estudio de posts» más abajo |
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

y abre <http://localhost:8000>. (Abrir `index.html` directamente también funciona, pero el service worker solo se activa con `http://localhost` o `https://`.)

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

3. En el mismo editor, ejecuta `supabase/seed.sql` para cargar los talleres iniciales. Los horarios son de ejemplo; después se ajustan desde la plataforma.

### 2. Configurar el acceso

En **Authentication**:

1. **Sign In / Providers → Email**: desactiva **Allow new users to sign up**. Así solo entran personas invitadas por dirección. Aunque alguien lograra registrarse, su cuenta nace sin rol y no ve nada.
2. **URL Configuration**: en **Site URL** pon `https://gestionspectrumpro.cl` y agrega `https://gestionspectrumpro.cl/**` en **Redirect URLs** (así funcionan los enlaces de invitación y de recuperación de contraseña).
3. **Emails** (opcional): traduce al español los correos de invitación y de recuperación de contraseña.
4. **Emails → SMTP Settings**: activa **Enable custom SMTP** para que los correos salgan por Resend desde el dominio propio (el servicio de correo incluido en Supabase solo envía unos pocos por hora):
   - **Sender email**: `no-responder@gestionspectrumpro.cl` · **Sender name**: `SpectrumPro`
   - **Host**: `smtp.resend.com` · **Port**: `465` · **Username**: `resend`
   - **Password**: una API key de Resend con permiso *Sending access* limitado al dominio `gestionspectrumpro.cl` (verificado en Resend, región São Paulo).
   Después, en **Rate Limits**, sube el límite de correos por hora (por ejemplo a 100).
5. **Emails → Templates**: pega las plantillas con la gráfica de la marca que están en `supabase/templates/` (en cada una, el *Subject* y el contenido HTML completo del archivo):

   | Plantilla en Supabase | Archivo | Subject |
   |---|---|---|
   | Invite user | `invitacion.html` | `Te invitaron a la plataforma de SpectrumPro` |
   | Reset password | `recuperar.html` | `Restablece tu contraseña de SpectrumPro` |
   | Change email address | `cambio-correo.html` | `Confirma tu nuevo correo en SpectrumPro` |
   | Magic link | `enlace-acceso.html` | `Tu enlace para entrar a SpectrumPro` |

   El logo de los correos es `assets/correo/logo.png` (PNG, porque Gmail y Outlook no muestran SVG) y se carga desde `https://gestionspectrumpro.cl`.

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

Son archivos estáticos y se publican en Vercel. El dominio oficial es **https://gestionspectrumpro.cl**: en Vercel, *Project → Settings → Domains → Add*, escribe `gestionspectrumpro.cl` (y `www.gestionspectrumpro.cl`, que Vercel redirige al principal) y crea en el DNS del dominio los registros que Vercel indica (hoy: un `A` de `gestionspectrumpro.cl` hacia `216.150.1.1` y un `CNAME` de `www` hacia `gestionspectrumpro.cl`). Las etiquetas Open Graph de `index.html`, `encuesta.html` y `tienda/` ya apuntan a este dominio. La encuesta queda en https://gestionspectrumpro.cl/encuesta.html y la tienda en https://gestionspectrumpro.cl/tienda/.

## Encuesta de la Muestra Audiovisual

`encuesta.html` es una página pública, con la gráfica del afiche, para quienes asistirán a la Muestra Audiovisual (viernes 11 de diciembre, 11:00, Centro Cultural La Moneda). No pide iniciar sesión. Pregunta nombre, correo, teléfono (opcional), cuántas personas acompañan, la relación con SpectrumPro, cómo se enteraron, qué necesitan para estar cómodos (silla de ruedas, espacio de calma, protectores auditivos, subtítulos, Lengua de Señas Chilena…) y qué esperan de la muestra.

Para activarla:

1. Asegúrate de haber ejecutado `supabase/migrations/20261124050000_encuesta_muestra.sql` (crea la tabla `encuesta_evento`).
2. Publica el sitio y comparte el enlace `…/encuesta.html` (o un código QR que apunte a él).

El público solo puede **enviar** respuestas: no puede leer las de otras personas. Las ven dirección y terapeutas en **Table Editor → encuesta_evento**, desde donde se exportan a CSV. Si `config.js` no tiene datos de Supabase, la encuesta funciona en modo de prueba y no guarda nada.

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
| `index.html` | Pantalla de carga, acceso, estructura y diálogos |
| `encuesta.html` | Encuesta pública para la Muestra Audiovisual |
| `tienda/` | Tienda pública de productos; se edita en la sección Tienda |
| `assets/og/` | Imágenes de 1200×630 para la vista previa al compartir cada página (Open Graph) |
| `ficha-participante.html` | Ficha cualitativa del participante, para completar en la web |
| `styles.css` | Estilos con la paleta del logo, tema claro y oscuro y adaptación a celular |
| `config.js` | URL y clave pública de Supabase |
| `js/datos.js` | Capa de datos: Supabase o demostración, con la misma interfaz |
| `js/app.js` | Vistas, roles, formularios y lógica de asistencia y cumpleaños |
| `sw.js`, `manifest.webmanifest` | Instalación como app y uso básico sin conexión. Al publicar cambios, sube `VERSION` en `sw.js` |
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

## Estudio de posts

Sección **Posts** del menú, visible solo para dirección. Arma posts de Instagram con la gráfica tomada de la plantilla de Canva «Plantillas posteos (Post de Instagram 4:5)»: tipografía **Montserrat Bold**, el logo SPEC TRUM PRO (a color, blanco o negro) y la paleta de la marca:

| Color | Hex |
| --- | --- |
| Amarillo | `#f8dd40` |
| Rosado | `#e55dbe` |
| Celeste | `#30b4e7` |
| Verde | `#11b351` |
| Rojo | `#f6364b` |
| Morado | `#8d5dc5` |
| Grafito (etiquetas oscuras) | `#21221c` |

**Plantillas:** Título grande · Foto con etiquetas (1 a 3 fotos) · Foto con ficha (talleres, horarios) · Foto arriba y bloque de color · Presentación del equipo · Frases y testimonios · Texto arriba y foto abajo · Foto con titulares.

- Cada post tiene de 1 a 20 **láminas** (carrusel) y cada lámina usa la plantilla que se elija.
- **Formatos:** vertical 4:5 (1080×1350), cuadrado (1080×1080) e historia o portada de reel (1080×1920).
- Las fotos se suben desde el computador o el celular y se ajustan con zoom y posición.
- **Descargar** baja la lámina en PNG a tamaño real; con varias láminas también se baja todo en ZIP. En el celular aparece **Compartir…** para mandarlas directo a Instagram.
- **Guardar** deja el post en la pestaña **Guardados** para editarlo o reutilizarlo después.

### Activarlo en Supabase

En **SQL Editor**, ejecuta `supabase/migrations/20261126000000_estudio_posts.sql`. Crea la tabla `posts` y el bucket privado `posts` de Storage para las fotos, ambos accesibles solo para dirección (políticas RLS con `es_admin()`).
