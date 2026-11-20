# SpectrumPro · Gestión de alumnado (prototipo)

Prototipo de plataforma interna para [SpectrumPro](https://spectrumpro.cl/), productora audiovisual y centro de formación artística para jóvenes neurodivergentes en Providencia, Santiago.

Cubre tres necesidades:

- **Asistencia**: se pasa lista por sesión de taller (Presente, Retraso, Ausente, Justificada) y hay un resumen mensual por taller.
- **Cumpleaños**: muestra los cumpleaños de hoy, los de los próximos 30 días y un calendario de 12 meses con la edad que cumple cada joven.
- **Ficha de cada joven**: datos personales (nombre preferido y pronombres incluidos), programa (FormaPro, Terapia Ocupacional, Arte Terapia, Talleres, SpectrumOnline), talleres inscritos, beca o arancel diferenciado, familia y contacto de emergencia, salud, intereses, apoyos y ajustes, y su historial de asistencia.

Además incluye un **panel** con las sesiones del día, los próximos cumpleaños, la asistencia semanal y las alertas de quienes bajan del 75% de asistencia, y una vista de **talleres** con su horario semanal.

## Cómo usarlo

No necesita instalación ni servidor. Hay dos formas:

1. Abrir `index.html` directamente en el navegador.
2. Publicarlo con GitHub Pages: en *Settings → Pages*, elegir la rama y la carpeta raíz.

Al abrirlo por primera vez se cargan **datos de ejemplo con personas ficticias**. Con «Empezar en blanco» se borran las fichas y la asistencia y se conservan los talleres.

## Limitaciones del prototipo

- Los datos se guardan en el `localStorage` **del navegador**. No se comparten entre equipos ni entre personas. Usa «Descargar copia de seguridad» para respaldarlos y «Restaurar copia de seguridad» para recuperarlos.
- No hay inicio de sesión ni roles.
- Los talleres, horarios y responsables son ilustrativos y se basan en la información pública de spectrumpro.cl. Por ahora solo se editan en `app.js` (`TALLERES_BASE`).

## Próximos pasos sugeridos

1. Agregar una base de datos compartida y un inicio de sesión (por ejemplo Supabase o Firebase) con roles: dirección, talleristas y terapeutas.
2. Permitir crear y editar talleres, horarios y responsables desde la interfaz.
3. Proteger los datos sensibles de salud y apoyos según la Ley 19.628 sobre protección de la vida privada y su actualización, la Ley 21.719. Limitar quién ve cada sección y registrar los accesos.
4. Enviar avisos a las familias por ausencias y saludos de cumpleaños.
5. Generar reportes de asistencia para becas y colaboradores.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `index.html` | Estructura, navegación y formularios |
| `styles.css` | Estilos con la paleta del logo de SpectrumPro, tema claro y oscuro y adaptación a móvil |
| `app.js` | Datos de ejemplo, almacenamiento, vistas y lógica de asistencia y cumpleaños |
| `assets/logo.svg` | Logo de SpectrumPro |

### Modelo de datos

```js
{
  talleres: [{ id, nombre, area, dias: [1..6], horario, encargado, color }],
  alumnos:  [{ id, nombre, apellidos, apodo, pronombres, fechaNac, rut, programa,
               talleres: [idTaller], beca, fechaIngreso, entrevista,
               tutorNombre, tutorRelacion, tutorTelefono, tutorEmail, emergencia,
               direccion, intereses, apoyos, alergias, medicacion, observaciones }],
  asistencia: { 'AAAA-MM-DD': { idTaller: { idAlumno: 'P' | 'R' | 'A' | 'J' } } }
}
```

El porcentaje de asistencia cuenta Presente y Retraso como asistencia. Las ausencias justificadas se muestran aparte.
