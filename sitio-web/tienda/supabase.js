// Supabase solo para la tienda (productos y contacto, que se editan en la plataforma).
// Es la clave pública (publishable): la seguridad la dan las políticas RLS.
// Va aparte de /config.js para que el resto del sitio siga usando los textos de contenido.js.
window.TIENDA_SUPABASE = {
  supabaseUrl: 'https://wgmbtmakxipuvejfffmt.supabase.co',
  supabaseAnonKey: 'sb_publishable_4qHkAj3sKzgU24ps44AQPg_RnWE4_41',
};
