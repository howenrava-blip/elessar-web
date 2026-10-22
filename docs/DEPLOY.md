# Puesta en marcha (≈ 30 minutos, todo gratis)

Orden recomendado: **1) Supabase → 2) publicar el sitio → 3) primer admin → 4) MercadoPago**.
Podés publicar el sitio antes de todo: funciona en modo demo hasta que lo conectes.

---

## 1. Base de datos en Supabase (10 min)

1. Entrá a <https://supabase.com> → **Start your project** → creá una cuenta (podés usar GitHub o Google).
2. **New project**:
   - Name: `elessar`
   - Database password: generá una y guardala.
   - Region: **South America (São Paulo)** (la más cercana a Argentina).
3. Cuando termine de crearse, andá a **SQL Editor → New query**:
   - Abrí `supabase/schema.sql`, copiá **todo**, pegalo y tocá **Run**. Tiene que decir *Success*.
   - Nueva query: pegá `supabase/seed.sql` → **Run**. Esto carga discografía, bio, productos, galería, etc.
4. Andá a **Project Settings → API** y copiá:
   - **Project URL** (ej. `https://abcdxyz.supabase.co`)
   - **anon public key** (o *Publishable key*)
5. Abrí `js/config.js` y pegalos:

   ```js
   SUPABASE_URL: "https://abcdxyz.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```

   ⚠ Nunca pegues la **service_role key** en ese archivo.

6. **Authentication → Providers → Email**: dejá Email habilitado y **desactivá "Allow new users to sign up"**. (Los admins se crean a mano; ver `docs/ADMIN.md`).
7. **Authentication → URL Configuration**:
   - Site URL: `https://tudominio.com` (o la URL de Netlify/Vercel)
   - Redirect URLs: agregá `https://tudominio.com/admin/` (para "olvidé mi contraseña").

> Las imágenes que subas desde el panel se guardan en **Storage → media** (lo crea `schema.sql`). El plan gratuito incluye 1 GB.

---

## 2. Publicar el sitio

Elegí **una** opción. En todas subís la carpeta completa (la que contiene `index.html`).

### Opción A — Netlify (la más simple)
1. <https://app.netlify.com/drop>
2. Arrastrá la carpeta del proyecto. Listo: te da una URL `https://algo.netlify.app`.
3. Para actualizar: **Deploys → arrastrar la carpeta de nuevo**.
4. Dominio propio: **Domain management → Add a domain**.

### Opción B — Vercel
1. Subí la carpeta a un repositorio de GitHub (o usá `npx vercel` si tenés Node).
2. <https://vercel.com/new> → importá el repo → *Framework: Other* → **Deploy**. No hay comando de build.

### Opción C — Hostinger / hosting con cPanel
1. **Administrador de archivos** → `public_html`.
2. Subí **el contenido** de la carpeta (no la carpeta en sí), incluido el archivo oculto `.htaccess`.
3. Activá el SSL gratuito del panel de Hostinger.

### Al actualizar archivos (evitar caché vieja)
En cada `.html`, los CSS/JS terminan en `?v=20261020`. Si modificás CSS o JS, cambiá ese número por la fecha del día (buscar y reemplazar en todos los `.html`). El contenido editado desde el panel **no** necesita esto: se ve al instante.

---

## 3. Primer administrador

Seguí [`docs/ADMIN.md`](ADMIN.md) (2 minutos).

---

## 4. Pagos con MercadoPago (10 min)

### 4.1 Credenciales
1. Entrá a <https://www.mercadopago.com.ar/developers/panel/app> con la cuenta de MercadoPago **donde querés cobrar**.
2. **Crear aplicación** → tipo de pago: *Pagos online* → *Checkout Pro* → nombre: `Elessar Tienda`.
3. En la app: **Credenciales de producción** → copiá el **Access Token** (`APP_USR-…`).
   - Para probar sin dinero real, usá primero las **credenciales de prueba** y los usuarios de prueba que ofrece MercadoPago.

### 4.2 Crear las funciones en Supabase (sin instalar nada)
En Supabase → **Edge Functions → Deploy a new function → Via Editor**:

1. Nombre: `create-checkout` → borrá el código de ejemplo → pegá el contenido de `supabase/functions/create-checkout/index.ts` → **Deploy**.
2. Repetí con el nombre `payment-webhook` y el archivo `supabase/functions/payment-webhook/index.ts`.
3. En **cada** función → **Details / Settings** → desactivá **"Enforce JWT verification" / "Verify JWT"** → Save.
   (Ambas validan todo por su cuenta; MercadoPago no envía sesión de Supabase.)

> ¿Preferís la terminal? Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):
> `supabase login && supabase link --project-ref TU_REF && supabase functions deploy create-checkout --no-verify-jwt && supabase functions deploy payment-webhook --no-verify-jwt`

### 4.3 Secretos
Supabase → **Edge Functions → Secrets** (o *Manage secrets*) → agregá:

| Nombre | Valor |
|---|---|
| `SITE_URL` | `https://tudominio.com/` (con barra final) |
| `MP_ACCESS_TOKEN` | el Access Token de MercadoPago |
| `STORE_CURRENCY` | `ARS` |
| `MP_WEBHOOK_SECRET` | *(opcional)* la clave secreta de webhooks de MP |

### 4.4 Webhook (avisos de pago)
La función ya le indica a MercadoPago a dónde avisar en cada compra (`notification_url`), así que **no es obligatorio** configurarlo en el panel de MP. Si querés reforzarlo:
- MercadoPago Developers → tu app → **Webhooks** → URL de producción:
  `https://TU-PROYECTO.supabase.co/functions/v1/payment-webhook?provider=mercadopago`
- Evento: **Pagos**. Copiá la "clave secreta" a `MP_WEBHOOK_SECRET`.

### 4.5 Probar
1. Hacé una compra de prueba en el sitio.
2. Al volver deberías ver *¡Gracias por tu compra!*.
3. En `/admin` → **Pedidos**: la orden aparece como *Pagado · preparar* y el stock bajó.
   Si queda *Pendiente*, revisá **Edge Functions → payment-webhook → Logs**.

---

## 5. Elegir los métodos de pago desde el panel

En **/admin → Pagos** activás o desactivás cada método con un interruptor, y le cambiás el nombre y la descripción que ve el cliente:

| Método | Qué necesita además |
|---|---|
| **MercadoPago** | Secretos `MP_ACCESS_TOKEN` y `SITE_URL` (punto 4). |
| **PayPal** | Secretos de PayPal (punto 6) + cargar la **cotización del dólar** en el panel. |
| **Stripe** | Secretos de Stripe (punto 7). |
| **WhatsApp** | Solo el número en el panel. No cobra online: te llega el pedido por WhatsApp. |

Si dejás activo **solo WhatsApp**, todas las compras se coordinan por chat y el carrito muestra directamente el botón «Pedir por WhatsApp».

> Cada vez que se actualiza `supabase/functions/create-checkout/index.ts`, hay que volver a pegarlo en Supabase → Edge Functions → create-checkout → **Deploy**.

---

## 6. (Opcional) PayPal

1. Entrá a <https://developer.paypal.com> con la cuenta PayPal **Business** donde querés cobrar → **Apps & Credentials** → pestaña **Live** → **Create App**.
2. Copiá el **Client ID** y el **Secret**.
3. Supabase → Edge Functions → Secrets:

   | Nombre | Valor |
   |---|---|
   | `PAYPAL_CLIENT_ID` | el Client ID |
   | `PAYPAL_SECRET` | el Secret |
   | `PAYPAL_ENV` | `live` (o `sandbox` para probar con cuentas de prueba) |

4. Panel → Pagos → PayPal: cargá la cotización (cuántos pesos vale 1 USD) y activalo.

PayPal no opera en pesos argentinos: el total se convierte a dólares con esa cotización y el cliente ve el monto en USD antes de pagar. El cobro se confirma cuando el cliente vuelve a `gracias.html`; recién ahí el pedido pasa a *Pagado* y se descuenta stock.

---

## 7. (Opcional) Stripe para pagos internacionales

1. Panel → Pagos → Stripe: activalo.
2. Secretos: `STRIPE_SECRET_KEY` (sk_live_…) y `STRIPE_WEBHOOK_SECRET`.
3. Stripe Dashboard → Developers → Webhooks → endpoint:
   `https://TU-PROYECTO.supabase.co/functions/v1/payment-webhook?provider=stripe` con el evento `checkout.session.completed`.

> Stripe no abre cuentas a comercios radicados en Argentina; sirve si la banda tiene una entidad en otro país. PayPal se puede sumar con el mismo patrón (otro bloque en `create-checkout`).

---

## 8. Pedidos por WhatsApp

Panel → **Pagos → Pedido por WhatsApp**: activalo, cargá el número (formato `5492991234567`) y, si querés, cambiá el saludo. Con «Probar mensaje» ves cómo llega. El cliente envía un mensaje así:

```
Hola Elessär, estoy en la página y quiero comprar los siguientes productos:
Remera Dark Desires Talle L
CD Kósmos (2 ejemplares)

Entrega: Envío a todo el país ($ 6.500)
Total: $ 61.500

Nombre: Ana
Pedido N.º 3F9A1C2B
```

El pedido también queda en **Pedidos** como *Pendiente*. Cuando te paguen, cambialo a **Pagado** y el stock se descuenta solo (requiere la actualización SQL del punto 9).

---

## 9. Actualizaciones de la base de datos

Si instalaste la base antes del 22/10/2026, corré una vez en SQL Editor:

- `supabase/migrations/2026-10-22-pagos-y-whatsapp.sql` (permite descontar stock al marcar como pagado un pedido de WhatsApp).

---

## Solución de problemas

| Síntoma | Causa probable |
|---|---|
| El sitio sigue mostrando "Modo demo" | `config.js` sin URL/clave, o el navegador tiene la versión vieja (Ctrl+F5). |
| El panel dice "no tiene permisos" | Falta el paso 2 de `docs/ADMIN.md` (insertar en `admins`). |
| "No se pudo subir" una imagen | No corriste `schema.sql` completo (crea el bucket `media`) o el usuario no es admin. |
| El checkout dice "MercadoPago no está configurado" | Falta el secreto `MP_ACCESS_TOKEN`. |
| WhatsApp abre MercadoPago o no registra el pedido | La función `create-checkout` publicada es la versión vieja: volvé a pegar el código actual y Deploy. |
| PayPal dice "falta la cotización" | Panel → Pagos → PayPal → cargá cuántos pesos vale 1 USD. |
| Al marcar un pedido de WhatsApp como Pagado no baja el stock | Falta correr la migración del punto 9. |
| El pago se aprueba pero el pedido queda Pendiente | `payment-webhook` con "Verify JWT" activado, o `MP_ACCESS_TOKEN` de prueba vs. producción mezclados. Ver Logs. |
| Cambié CSS y no se ve | Subí el número `?v=` en los `.html` (ver punto 2). |
