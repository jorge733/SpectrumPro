// Genera una versión de un solo archivo de las funciones de la Comunidad, para pegarla en el editor
// de Supabase (Edge Functions → Deploy a new function → Via Editor), que no lee archivos compartidos.
//
// Uso:  node herramientas/funciones-panel.mjs
//
// Lee supabase/functions/<función>/index.ts, reemplaza el import de ../_compartido/correo-boletin.js
// por su contenido y escribe supabase/funciones-panel/<función>.ts. Vuelve a ejecutarlo si cambias
// alguna función o la plantilla del correo. Con la CLI (supabase functions deploy) no hace falta.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const plantilla = fs.readFileSync(path.join(RAIZ, 'functions/_compartido/correo-boletin.js'), 'utf8');
const salida = path.join(RAIZ, 'funciones-panel');
fs.mkdirSync(salida, { recursive: true });

for (const nombre of ['comunidad', 'enviar-boletin']) {
  const fuente = fs.readFileSync(path.join(RAIZ, 'functions', nombre, 'index.ts'), 'utf8');
  const importacion = 'import "../_compartido/correo-boletin.js";';
  if (!fuente.includes(importacion)) throw new Error(`${nombre}: no encontré el import de la plantilla`);
  const unido = '// @ts-nocheck\n' +
    `// GENERADO por herramientas/funciones-panel.mjs a partir de supabase/functions/${nombre}/index.ts: no editar a mano.\n` +
    `// Para pegar en Supabase → Edge Functions, en una función llamada exactamente «${nombre}».\n` +
    fuente.replace(importacion, '// ---- Plantilla de los correos (supabase/functions/_compartido/correo-boletin.js) ----\n' + plantilla.trim() + '\n// ---- Fin de la plantilla ----');
  fs.writeFileSync(path.join(salida, nombre + '.ts'), unido);
  console.log(`supabase/funciones-panel/${nombre}.ts · ${unido.split('\n').length} líneas`);
}
