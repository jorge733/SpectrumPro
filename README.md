# SpectrumPro · Plataforma del equipo

Plataforma interna de [SpectrumPro](https://spectrumpro.cl/) para registrar la **asistencia** a los talleres, ver los **cumpleaños** y mantener la **ficha** de cada joven.

Sigue la estructura de la Plataforma II° Medio del Colegio Michelangelo: pantalla de carga, inicio de sesión, menú lateral plegable, barra inferior en el celular, roles, sección de Administración, auditoría e instalación como app (PWA). Usa **Supabase** en lugar de Firebase.

## Qué hace

| Sección | Contenido |
| --- | --- |
| **Panel** | Sesiones del día, próximos cumpleaños, asistencia semanal y jóvenes con menos de 75% de asistencia |
| **Asistencia** | Pasar lista por sesión de taller (Presente, Retraso, Ausente, Justificada) y resumen mensual por taller |
| **Cumpleaños** | Aviso por correo cada mañana con los cumpleaños de hoy y de dentro de 3 días (ver «Recordatorio de cumpleaños»). Separados en **Jóvenes** y **Profesores**: cumpleaños de hoy, de los próximos 30 días y calendario de 12 meses. Cada profesor añade su propia fecha (en la pestaña Profesores o pulsando su nombre en el menú); dirección también puede ponerla al editar una cuenta |
| **Fichas** | Datos personales, programa, talleres, beca, familia, apoyos, datos privados de salud e historial de asistencia |
| **Talleres semestrales** | Talleres del semestre agrupados por área (FormaPro arriba, luego Centro de Formación, Mentorías, SpectrumOnline, Terapia Ocupacional y al final Arte y Apoyo). Cada taller tiene horario, quién está a cargo y su correo, inscritos, y una ficha con pestañas **Información**, **Programa** (texto y PDF opcional) y **Afiches** (material promocional). Botón **Horario para imprimir**: grilla semanal que se arma sola y se imprime o guarda en PDF (o se descarga para Excel). Dirección crea y edita talleres, sube programa y afiches, y cambia el orden con flechas ↑ ↓ dentro de cada área |
| **Talleres de verano** | Lo mismo para los talleres de la temporada de verano; su horario imprimible va por fechas |
| **Talleres online** | Talleres por videollamada de cualquier temporada, con su enlace y un botón «Unirse». Se pasa lista igual que en los presenciales, que quedan en las dos secciones anteriores |
| **Sitio web** | Solo dirección. Edita todo https://spectrumpro.cl: cada título, párrafo, botón e imagen de las 8 páginas y del pie, títulos para Google, secciones visibles, aviso superior, contacto y las listas (equipo, talleres, producciones, clientes…), con vista previa en vivo. Ver «Editar el sitio desde la plataforma» más abajo |
| **Posts** | Solo dirección. Estudio para crear posts de Instagram con la gráfica de la marca (reemplaza a Canva). Ver «Estudio de posts» más abajo |
| **Comunidad** | Dirección y rol Equipo. Boletines por correo para quienes se suscriben en https://spectrumpro.cl/comunidad: escribirlos con vista previa, enviarse una prueba y mandarlos a todas las personas suscritas; lista de suscriptores con baja y CSV. Ver «Comunidad» más abajo |
| **Administración** | Invitar cuentas y asignar roles, auditoría de cambios y exportación a CSV |

En el menú, **Posts**, **Tienda**, **Sitio web** y **Comunidad** están juntos en el submenú **Edición** (se despliega en el menú lateral; con el menú plegado o en el celular se abre como una ventanita). Cada persona ve solo las secciones que su rol permite, y si no puede abrir ninguna, el submenú no aparece.

### Roles

| Rol | Qué ve y qué puede hacer |
| --- | --- |
| **Dirección** (`admin`) | Todo. Gestiona cuentas, talleres y fichas, y ve la auditoría |
| **Terapeuta** (`terapeuta`) | Todo el alumnado, incluidos los datos privados (medicación y observaciones). Crea y edita fichas. Pasa lista en cualquier taller |
| **Tallerista** (`tallerista`) | Solo a quienes están inscritos en sus talleres: datos de contacto, apoyos y alergias. Pasa lista solo en sus talleres. Ve los cumpleaños de todo el alumnado y del equipo (nombre y fecha) |
| **Equipo** (`equipo`) | Personas que no pasan lista ni ven fichas (gestión, asistentes, productora). Ven los talleres (horario y quién está a cargo) y los cumpleaños de jóvenes y equipo, ponen el suyo, editan la tienda y escriben y envían los boletines de la Comunidad. No editan el sitio web |

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
   | `20261126010000_talleres_temporada.sql` | Separa los talleres en semestrales y de verano |
   | `20261126020000_talleres_verano_2026.sql` | Fechas, objetivo, edad y nota de los talleres; carga los talleres de verano de diciembre 2026 y enero 2027 |
   | `20261126030000_talleres_online.sql` | Modalidad (presencial u online) y enlace de la videollamada; los talleres de SpectrumOnline pasan a online |
   | `20261127000000_talleres_afiches_programa_correo.sql` | Correo de quien está a cargo, programa escrito, afiches (bucket privado `afiches`) y orden inicial por área |
   | `20261127010000_recordatorio_cumpleanos.sql` | Aviso de cumpleaños por correo: quién lo recibe y el reloj diario (pg_cron) |
   | `20261127020000_sitio_web.sql` | Contenido del sitio público editable desde la plataforma (tablas `sitio_textos` y `sitio_elementos`, bucket público `sitio`) con el contenido actual ya cargado |
   | `20261128000000_sitio_web_completo.sql` | Listas «Cinta de la portada» y «Clientes» con su contenido actual |
   | `20261129000000_comunidad.sql` | Comunidad: listas «Recursos» y «Podcasts» del sitio, suscriptores, boletines y bucket público `documentos` (ver «Comunidad») |
   | `20261130000000_sitio_solo_direccion.sql` | El sitio web lo edita solo dirección; la Comunidad (boletines y suscriptores) sigue en manos de dirección y el rol Equipo |

3. En el mismo editor, ejecuta `supabase/seed.sql` para cargar los talleres iniciales. Los horarios son de ejemplo; después se ajustan desde la plataforma.
4. Ejecuta también, en orden, las demás migraciones de `supabase/migrations/`. La de `…_programa_taller.sql` crea el espacio de archivos privado `programas` (Storage) donde se guarda el PDF con el programa de cada taller: todo el equipo activo lo puede abrir y solo dirección lo sube o lo quita. Acepta solo PDF de hasta 10 MB.

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

### 4b. Recordatorio de cumpleaños por correo

1. Ejecuta `supabase/migrations/20261127010000_recordatorio_cumpleanos.sql` (activa `pg_cron` y `pg_net`, genera sola la clave del reloj en Vault y programa el envío diario a las 11:00 UTC, es decir 08:00 de Chile en verano y 07:00 en invierno).
2. Guarda la API key de Resend como secreto de las funciones (es la misma que se usa como contraseña en **SMTP Settings**; o crea una nueva en resend.com → API Keys):

   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   ```

   (Desde el panel: **Edge Functions → Secrets**.)
3. Publica la función **sin** verificación de JWT, porque el reloj no inicia sesión (la función comprueba ella misma la clave del reloj o que quien la llama sea de dirección):

   ```bash
   supabase functions deploy recordatorio-cumpleanos --no-verify-jwt
   ```

   Desde el panel: crea la función `recordatorio-cumpleanos` con el contenido de `supabase/functions/recordatorio-cumpleanos/index.ts` y desactiva **Enforce JWT verification** en sus ajustes.
4. En la plataforma, **Cumpleaños → Enviarme una prueba** envía un correo de prueba a tu cuenta.

Lo reciben las cuentas activas que tengan marcado **Recibir por correo el aviso de cumpleaños** (al ejecutar la migración se marca a toda dirección). Se cambia en **Administración → Cuentas del equipo → editar cuenta**. Si un día no hay cumpleaños hoy ni en 3 días, no llega nada.

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

Son archivos estáticos y se publican en Vercel. El dominio oficial es **https://gestionspectrumpro.cl**: en Vercel, *Project → Settings → Domains → Add*, escribe `gestionspectrumpro.cl` (y `www.gestionspectrumpro.cl`, que Vercel redirige al principal) y crea en el DNS del dominio los registros que Vercel indica (hoy: un `A` de `gestionspectrumpro.cl` hacia `216.150.1.1` y un `CNAME` de `www` hacia `gestionspectrumpro.cl`). Las etiquetas Open Graph de `index.html` y `encuesta.html` ya apuntan a este dominio. La encuesta queda en https://gestionspectrumpro.cl/encuesta.html. La tienda está en el sitio público (https://spectrumpro.cl/tienda); `tienda/index.html` de la plataforma solo redirige allá los enlaces antiguos.

## Sitio web público (spectrumpro.cl)

`sitio-web/` es el sitio público que reemplaza al WordPress de https://spectrumpro.cl: Inicio, Nosotros, Formación, Arte y Apoyo, Productora, Comunidad, Tienda, Colabora y Contacto. Son archivos estáticos, separados de la plataforma: se publican como un **segundo proyecto de Vercel** desde este mismo repositorio, así gestionspectrumpro.cl no cambia.

1. En Vercel: **Add New → Project**, importa este repositorio y en **Root Directory** elige `sitio-web`. Framework: *Other*, sin comando de build.
2. En ese proyecto nuevo: **Settings → Domains → Add**, escribe `spectrumpro.cl` y también `www.spectrumpro.cl` (Vercel redirige uno al otro).
3. En el panel DNS del dominio (donde está registrado spectrumpro.cl) cambia **solo** los registros web que indica Vercel: el `A` de `spectrumpro.cl` (hoy apunta al hosting de WordPress) y el `CNAME` de `www`. **No toques los registros `MX`, `TXT` (SPF, DKIM, DMARC) ni los de correo**, o dejará de funcionar administracion@spectrumpro.cl.
4. Espera a que Vercel marque el dominio como válido (minutos a unas horas) y revisa el sitio. El WordPress sigue existiendo en su hosting; si algo falla, basta con devolver el registro `A` a su valor anterior (anótalo antes de cambiarlo).

`sitio-web/vercel.json` activa direcciones limpias (`/nosotros` en vez de `/nosotros.html`) y redirige las direcciones antiguas de WordPress (`/quienes-somos`, `/nuestros-talleres`, `/arte-terapia`, `/formapro`…) a su página nueva, para no perder enlaces ni posicionamiento en Google.

### Google (SEO)

- `sitio-web/sitemap.xml` y `sitio-web/robots.txt` le indican a Google qué páginas indexar. Si se agrega una página, súmala al sitemap.
- Cada página tiene un título con palabras de búsqueda, descripción, Open Graph y datos estructurados (`application/ld+json`): la organización con dirección, teléfono, correo, horario y redes en Inicio y Contacto, y migas de pan en el resto.
- La plataforma (gestionspectrumpro.cl) lleva `noindex` para que no compita con el sitio en las búsquedas de «SpectrumPro».
- Tras publicar en spectrumpro.cl: en [Google Search Console](https://search.google.com/search-console) agrega la propiedad de dominio `spectrumpro.cl` (se verifica con un registro `TXT` en el DNS), envía `https://spectrumpro.cl/sitemap.xml` y pide indexar la portada.
- En [Google Business Profile](https://business.google.com) crea o reclama la ficha de SpectrumPro con la misma dirección, teléfono y sitio web: es lo que hace aparecer el negocio en Maps y en el recuadro de la derecha.

### Editar el sitio desde la plataforma

Todo el sitio se edita en https://gestionspectrumpro.cl, sección **Sitio web** (solo dirección):

| Pestaña | Qué se edita |
| --- | --- |
| **Páginas** | Una por página (Inicio, Nosotros, Formación, Arte y Apoyo, Productora, Tienda, Colabora, Contacto) más el **Pie de página**, ordenada por secciones: cada antetítulo, título, párrafo, botón, enlace del índice e imagen (con su descripción para lectores de pantalla), el **título y la descripción para Google** (con una muestra de cómo se ve el resultado) y el interruptor **Mostrar esta sección**. Un buscador encuentra cualquier texto en todo el sitio |
| **Contacto y enlaces** | Dirección, WhatsApp, correo, Instagram, YouTube, LinkedIn, Patreon y el formulario de inscripción (todos los botones «Inscríbete» llevan ahí). Un enlace vacío oculta su ícono o botón |
| **Aviso** | Franja de color arriba de todas las páginas (texto, enlace y color) para anunciar inscripciones, una muestra o un cambio de horario. Las visitas pueden cerrarla |
| **Listas** | Equipo, Valores, Talleres, Módulos FormaPro, Mentorías, Actividades, Arte y Apoyo, Servicios, Producciones, **Clientes** (logos) y **Cinta de la portada**. Cada elemento se crea, edita, duplica, oculta (ojo), elimina y ordena con flechas ↑ ↓ |
| **Copia de seguridad** | Descarga todo el contenido en JSON y lista los últimos textos editados |

- **Borrador y publicación**: los cambios de texto se juntan en un borrador (no se pierden al cambiar de pestaña o de página) y una barra abajo los **publica todos juntos** o los descarta. Cada campo muestra «Sin guardar» o «Editado» (con la fecha) y tiene **Restaurar original**, que lo devuelve al texto que trae el HTML. La plataforma avisa si se intenta cerrar con cambios sin guardar.
- **Vista previa en vivo**: abre spectrumpro.cl en un panel al lado (en tamaño computador o celular) y muestra cada cambio mientras se escribe, sin publicarlo; al entrar a un campo, la vista previa salta a ese texto y lo marca. Funciona con el sitio publicado con esta versión de `sitio-web/sitio/sitio.js`.
- **Imágenes**: se suben desde el computador o el celular (se reducen en el navegador y las PNG o WebP mantienen la transparencia) o se eligen de la **galería**, que reúne las imágenes del sitio y las ya subidas al bucket `sitio`.
- Se valida lo importante antes de publicar: WhatsApp con código de país, correo, enlaces con `https://` (o una página del sitio, como `/formacion`), videos de YouTube y asteriscos cerrados en las frases con resaltado (`*a tu medida*`).

Para activarlo, ejecuta en **SQL Editor**, en orden, `supabase/migrations/20261127020000_sitio_web.sql` (tablas, permisos, bucket y el contenido actual) y `supabase/migrations/20261128000000_sitio_web_completo.sql` (listas de clientes y cinta). Se pueden volver a ejecutar: no duplican nada ni pisan lo editado.

**Cómo funciona.** Cada texto, botón e imagen de los `.html` lleva una clave (`data-texto`, `data-imagen`, `data-seccion`); lo que trae el HTML es el texto «original». En Supabase solo se guarda lo que se edita (tabla `sitio_textos`), así que una página nueva o un texto sin editar se ve tal como está en el HTML. El sitio lee Supabase con `sitio-web/config.js` (la clave pública): al abrir una página muestra al instante la última copia guardada en ese navegador (o el respaldo `sitio-web/sitio/contenido.js`) y la reemplaza con lo de Supabase apenas responde. El público solo puede **leer** los textos y los elementos visibles; cada cambio queda en la auditoría. Los títulos para Google se aplican al cargar la página (Google los lee, pero puede tardar días en actualizarlos).

**Si cambias el HTML del sitio** (un texto nuevo, una sección nueva), ejecuta:

```bash
node herramientas/campos-sitio.mjs
```

Marca lo nuevo con su clave sin tocar lo ya marcado y regenera `sitio-web/sitio/campos.js`, el catálogo que usa la plataforma (etiquetas, secciones, texto original y galería de imágenes). Sube ambos cambios. El diseño y la estructura de las páginas siguen en cada `.html`.

## Comunidad

Reemplaza al Substack de Spectrum Medios sin depender de él. Tiene tres partes:

- **Página** https://spectrumpro.cl/comunidad (`sitio-web/comunidad.html`): bienvenida, invitación, «Enfoque del mes» con documentos para descargar, podcasts recomendados, boletines anteriores y el formulario para suscribirse. Se edita como el resto del sitio en **Sitio web** (página «Comunidad» y listas **Recursos** y **Podcasts**; en Recursos hay un botón **Subir PDF**, hasta 25 MB). Los PDF que venían en el post de Substack quedaron en `sitio-web/sitio/docs/`.
- **Suscripción con doble confirmación**: el formulario llama a la función `comunidad`, que guarda a la persona como «sin confirmar» y le manda un correo con un enlace. Solo al abrirlo queda suscrita (y recibe una bienvenida). Cada correo trae su enlace para darse de baja, y Gmail y Outlook muestran el botón «Anular suscripción». La función frena abusos (campo trampa, 5 intentos cada 10 minutos por conexión, no reenvía la confirmación antes de 10 minutos) y no revela si un correo ya estaba suscrito. Las suscripciones sin confirmar se borran solas a los 30 días.
- **Plataforma → Edición → Comunidad**: escribir boletines (título, resumen, texto, imagen y botón) viendo cómo llegarán, **Enviarme una prueba** y **Enviar a N personas**. El envío va en tandas de 100 con la función `enviar-boletin`, un correo por persona; si se corta, el boletín queda «Enviando…» y **Continuar envío** lo termina sin repetir correos. Con **Publicarlo en la página Comunidad** marcado, el boletín enviado aparece en «Boletines anteriores». En **Suscriptores**: confirmados, sin confirmar y de baja, **Dar de baja**, **Eliminar** y **Descargar CSV**. Desde la plataforma nadie puede reactivar a una persona que se dio de baja: tiene que suscribirse otra vez.

La plantilla del correo está en `supabase/functions/_compartido/correo-boletin.js` y la usan tanto las funciones como la vista previa de la plataforma, así lo que se ve antes de enviar es lo que llega.

### Activarla

1. En **SQL Editor** ejecuta `supabase/migrations/20261129000000_comunidad.sql`.
2. Publica las dos funciones con la CLI de Supabase (comparten `supabase/functions/_compartido/`, por eso conviene la CLI y no el editor del panel):

   ```bash
   supabase functions deploy comunidad --no-verify-jwt
   supabase functions deploy enviar-boletin
   ```

   `comunidad` va **sin** verificación de JWT porque la usa el público (el formulario no inicia sesión). `enviar-boletin` sí la verifica y además comprueba que quien llama sea dirección o Equipo.

   **Sin la CLI, desde el panel**: en **Edge Functions → Deploy a new function → Via Editor**, crea una función llamada exactamente `comunidad` y pega `supabase/funciones-panel/comunidad.ts`; luego otra llamada `enviar-boletin` con `supabase/funciones-panel/enviar-boletin.ts`. Esos archivos traen la plantilla del correo incluida (los genera `node herramientas/funciones-panel.mjs`; vuelve a ejecutarlo si cambias una función o la plantilla). En los ajustes de `comunidad` desactiva **Verify JWT with legacy secret** / **Enforce JWT verification**; en `enviar-boletin` déjalo activado.
3. Los correos salen desde **comunidad@spectrumpro.cl** (dominio `spectrumpro.cl` ya verificado en Resend). Usan el secreto `RESEND_API_KEY` del recordatorio de cumpleaños. Si esa API key está limitada al dominio `gestionspectrumpro.cl`, crea en Resend una con permiso para `spectrumpro.cl` y guárdala aparte:

   ```bash
   supabase secrets set COMUNIDAD_RESEND_API_KEY=re_xxxxxxxx
   ```

   Opcionales: `COMUNIDAD_REMITENTE` (por defecto `SpectrumPro <comunidad@spectrumpro.cl>`) y `COMUNIDAD_RESPONDER_A` (a dónde llegan las respuestas, por defecto `contacto@spectrumpro.cl`).
4. Publica el sitio y la plataforma. Prueba: suscríbete en https://spectrumpro.cl/comunidad con tu correo, confirma, y en la plataforma crea un boletín y pulsa **Enviarme una prueba**.

### Quitarla

Si el equipo decide no seguir, se quita en dos pasos:

1. **Código**: revertir el commit «Comunidad: página, suscripción y boletines por correo» (`git revert <commit>`). Desaparecen la página, el enlace del menú y del pie del sitio y la sección de la plataforma.
2. **Base de datos** (opcional, borra suscriptores y boletines; descarga antes el CSV): ejecutar `supabase/quitar-comunidad.sql` en el SQL Editor y borrar las funciones con `supabase functions delete comunidad` y `supabase functions delete enviar-boletin`.

## Encuesta de la Muestra Audiovisual

`encuesta.html` es una página pública, con la gráfica del afiche, para quienes asistirán a la Muestra Audiovisual (viernes 11 de diciembre, 11:00, Centro Cultural La Moneda). No pide iniciar sesión. Pregunta nombre, correo, teléfono (opcional), cuántas personas acompañan, la relación con SpectrumPro, cómo se enteraron, qué necesitan para estar cómodos (silla de ruedas, espacio de calma, protectores auditivos, subtítulos, Lengua de Señas Chilena…) y qué esperan de la muestra.

Para activarla:

1. Asegúrate de haber ejecutado `supabase/migrations/20261124050000_encuesta_muestra.sql` (crea la tabla `encuesta_evento`).
2. Publica el sitio y comparte el enlace `…/encuesta.html` (o un código QR que apunte a él).

El público solo puede **enviar** respuestas: no puede leer las de otras personas. Las ven dirección y terapeutas en **Table Editor → encuesta_evento**, desde donde se exportan a CSV. Si `config.js` no tiene datos de Supabase, la encuesta funciona en modo de prueba y no guarda nada.

## Tienda

`sitio-web/tienda/index.html` es la tienda pública de productos (https://spectrumpro.cl/tienda), con la misma cabecera, pie y estilo que el resto del sitio: portada, catálogo con filtros (Ropa, Accesorios, Papelería), pasos para pedir y botón de WhatsApp con el mensaje ya escrito para cada producto.

Los productos y el contacto se editan en la plataforma, sección **Tienda** (dirección y rol Equipo): nombre, foto, tipo, precio, tallas o colores, descripción, orden, «Agotado» y «Mostrar en la tienda»; además el WhatsApp, Instagram, forma de pago y entrega. Los cambios se ven al instante en la tienda.

Para activarla:

1. En **SQL Editor** de Supabase, ejecuta `supabase/migrations/20261124060000_tienda.sql`. Crea las tablas `tienda_productos` y `tienda_ajustes`, el bucket público de fotos `tienda` y carga los 8 productos actuales.
2. Listo: la tienda lee de Supabase. Mientras no se ejecute la migración, muestra la lista de respaldo que trae la página (sin precios).

Lee Supabase con `sitio-web/tienda/supabase.js` (la clave pública), aparte de `sitio-web/config.js`, para que el resto del sitio siga usando los textos de `contenido.js`. Las fotos de muestra (`/tienda/img/…`) están en `sitio-web/tienda/img/`; la plataforma las muestra desde spectrumpro.cl. La dirección antigua https://gestionspectrumpro.cl/tienda/ redirige a la nueva.

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
| `tienda/` | Redirige a la tienda, que ahora está en `sitio-web/tienda/` (spectrumpro.cl/tienda) |
| `assets/og/` | Imágenes de 1200×630 para la vista previa al compartir cada página (Open Graph) |
| `ficha-participante.html` | Ficha cualitativa del participante, para completar en la web |
| `styles.css` | Estilos con la paleta del logo, tema claro y oscuro y adaptación a celular |
| `config.js` | URL y clave pública de Supabase |
| `js/datos.js` | Capa de datos: Supabase o demostración, con la misma interfaz |
| `js/app.js` | Vistas, roles, formularios y lógica de asistencia y cumpleaños |
| `js/sitio.js` | Sección Sitio web: editor de todo spectrumpro.cl (páginas, listas, aviso, vista previa) |
| `js/comunidad.js` | Sección Comunidad: boletines (editor, vista previa, prueba y envío) y suscriptores |
| `supabase/functions/comunidad`, `enviar-boletin`, `_compartido` | Suscripción con doble confirmación, envío de boletines y plantilla común de los correos |
| `herramientas/campos-sitio.mjs` | Marca los textos e imágenes de `sitio-web/*.html` y genera el catálogo `sitio-web/sitio/campos.js` |
| `sw.js`, `manifest.webmanifest` | Instalación como app y uso básico sin conexión. Al publicar cambios, sube `VERSION` en `sw.js` |
| `assets/` | Logo, íconos de la app e imágenes de la Muestra (las de vista previa están en `assets/og/`) |
| `supabase/migrations/…sql` | Tablas, RLS, auditoría, cumpleaños, rol Equipo y encuesta (ver la tabla de arriba) |
| `supabase/seed.sql` | Talleres iniciales |
| `supabase/functions/gestionar-usuario` | Invitar y eliminar cuentas (solo dirección) |
| `supabase/functions/recordatorio-cumpleanos` | Correo diario con los cumpleaños de hoy y de dentro de 3 días |

### Modelo de datos

```
perfiles        (id = auth.users.id, email, nombre, rol, activo, fecha_nac, aviso_cumple)
talleres        (id, nombre, area, dias[], hora_inicio, hora_fin, encargado, encargado_email, color, activo, orden, modalidad, enlace,
                 programa_texto, programa_pdf, afiches[{ruta, nombre, tipo}])
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

- Notificaciones push (ausencias seguidas). Los cumpleaños ya avisan por correo.
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
