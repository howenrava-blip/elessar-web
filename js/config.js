/* ==========================================================================
   ELESSÄR — Configuración del sitio
   --------------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE TENÉS QUE EDITAR PARA CONECTAR LA BASE DE DATOS.

   1. Creá un proyecto gratis en https://supabase.com
   2. En Supabase: Project Settings → API → copiá "Project URL" y "anon public key".
   3. Pegalos abajo. Listo: el sitio y el panel /admin leen y guardan ahí.

   Mientras SUPABASE_URL esté vacío, el sitio funciona en "modo demo"
   con el contenido de js/default-data.js (ideal para previsualizar).

   La "anon key" es pública por diseño: la seguridad la dan las políticas
   RLS definidas en supabase/schema.sql. NUNCA pegues acá la "service_role key".
   ========================================================================== */
(function () {
  "use strict";

  window.ELESSAR_CONFIG = {
    SUPABASE_URL: "",       // ej: "https://abcdxyz.supabase.co"
    SUPABASE_ANON_KEY: "",  // ej: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."

    // Librería de Supabase (se carga solo si hay URL configurada)
    SUPABASE_JS_CDN: "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",

    // Tienda
    CURRENCY: "ARS",
    LOCALE: "es-AR",

    // Pasarelas habilitadas en el checkout (deben estar configuradas en la
    // Edge Function "create-checkout"; ver docs/DEPLOY.md)
    PAYMENT_PROVIDERS: ["mercadopago"], // opciones: "mercadopago", "stripe"

    // Plan B si la pasarela no está lista: pedido por WhatsApp.
    // Número en formato internacional sin "+" ni espacios. Vacío = oculto.
    WHATSAPP_ORDERS: ""     // ej: "5492991234567"
  };
})();
