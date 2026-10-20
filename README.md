# Elessär — Sitio oficial + Tienda + Panel de administración

Sitio de la banda de metal sinfónico **Elessär** (Neuquén, Patagonia argentina).

- **Frontend**: HTML + CSS + JavaScript puro. Sin compilación, sin `npm install`. Se sube tal cual a Netlify, Vercel, Hostinger o cualquier hosting.
- **Backend**: [Supabase](https://supabase.com) (plan gratuito): base de datos PostgreSQL, inicio de sesión del panel, almacenamiento de fotos y funciones de pago.
- **Pagos**: MercadoPago (Checkout Pro) listo; Stripe opcional.
- **Panel /admin**: productos, stock, talles, fotos, fechas, textos, bio, redes, avisos, pedidos y mensajes. Sin tocar código.

> **Funciona desde el minuto cero.** Mientras no conectes Supabase, el sitio corre en *modo demo* con el contenido de `js/default-data.js`, y el panel se puede recorrer en `admin/?demo=1`.

---

## Estructura

```
elessar/
├── index.html            Inicio: hero, lanzamiento destacado, reproductores, shows, merch, bio
├── banda.html            Historia, línea de tiempo, integrantes, galería con lightbox
├── musica.html           Discografía + Spotify / Bandcamp / YouTube integrados
├── fechas.html           Próximos shows, entradas, "agregar al calendario", historial
├── tienda.html           Catálogo con filtro por categoría (?cat=remeras)
├── producto.html         Ficha: galería con zoom, talles/colores, stock, carrito (?p=slug)
├── checkout.html         Datos, envío, pago → MercadoPago / Stripe
├── gracias.html          Retorno del pago (aprobado / pendiente / rechazado)
├── contacto.html         Formulario + kit de prensa (EPK)
├── 404.html
├── .htaccess             Caché y tipos MIME para Hostinger/Apache
├── robots.txt
│
├── css/styles.css        Todo el diseño (tokens de color/tipografía arriba de todo)
├── js/
│   ├── config.js         ← ÚNICO archivo a editar: claves de Supabase, moneda, pasarelas
│   ├── default-data.js   Contenido de respaldo / modo demo
│   ├── api.js            Capa de datos: Supabase con respaldo local
│   ├── store.js          Carrito (estado + suscripción, persistido en localStorage)
│   ├── ui.js             Header, menú, aviso, carrito lateral, reveal, componentes
│   └── pages/*.js        Lógica de cada página
│
├── admin/                Panel de administración (CMS)
│   ├── index.html
│   ├── admin.css
│   └── admin.js
│
├── assets/
│   ├── img/              Fotos y logos optimizados (WebP)
│   ├── video/            Video del logo (opcional para el hero)
│   └── epk/              Kit de prensa en PDF
│
├── supabase/
│   ├── schema.sql        Tablas, seguridad (RLS), bucket de imágenes
│   ├── seed.sql          Contenido inicial
│   ├── config.toml       (opcional, para la CLI)
│   └── functions/
│       ├── create-checkout/index.ts   Valida carrito y crea el pago
│       └── payment-webhook/index.ts   Confirma pagos y descuenta stock
│
└── docs/
    ├── DEPLOY.md         Puesta en marcha paso a paso
    └── ADMIN.md          Crear el primer administrador y usar el panel
```

## Cómo fluye una compra

1. El cliente arma el carrito (se guarda en su navegador).
2. En `checkout.html` completa sus datos y elige envío.
3. La función `create-checkout` **recalcula precios y stock en el servidor** (el navegador nunca decide montos), crea la orden *pendiente* y devuelve el link de MercadoPago.
4. El cliente paga en MercadoPago y vuelve a `gracias.html`.
5. MercadoPago avisa a `payment-webhook`, que consulta el pago real, verifica el monto y llama a `apply_paid_order`: la orden pasa a **Pagado** y se descuenta el stock (una sola vez, aunque el aviso llegue repetido).
6. En el panel, el pedido aparece en **Pedidos → Por preparar**.

## Seguridad

- La *anon key* en `config.js` es pública por diseño. Lo que protege los datos son las políticas **RLS** de `schema.sql`: el público solo puede leer contenido publicado y enviar mensajes; todo lo demás requiere ser administrador.
- Los administradores se habilitan uno por uno (tabla `admins`). Crear una cuenta no da acceso.
- La *service_role key* y los tokens de pago viven solo en los secretos de las Edge Functions, nunca en el sitio.

## Próximos pasos

1. [`docs/DEPLOY.md`](docs/DEPLOY.md): conectar Supabase, MercadoPago y publicar.
2. [`docs/ADMIN.md`](docs/ADMIN.md): crear el primer usuario administrador.
3. Desde el panel: completar nombres de integrantes, cargar fechas reales y ajustar precios y stock (los cargados son de ejemplo).
