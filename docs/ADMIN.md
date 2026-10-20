# Primer administrador y uso del panel

El panel está en **`https://tudominio.com/admin/`**.

## Crear el primer administrador (2 minutos)

**Paso 1 — Crear el usuario**
1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Email y contraseña (mínimo 8 caracteres). Marcá **Auto Confirm User**.
3. **Create user**.

**Paso 2 — Darle permisos de administrador**
Supabase → **SQL Editor → New query**, cambiá el email y tocá **Run**:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users
where email = 'tu-email@ejemplo.com'
on conflict do nothing;
```

**Paso 3 — Entrar**
Abrí `/admin/`, ingresá con ese email y contraseña. ¡Listo!

### Sumar más administradores
Repetí los pasos 1 y 2 con el email de cada persona.
Para quitar el acceso a alguien:

```sql
delete from public.admins where email = 'email@ejemplo.com';
```

### Olvidé mi contraseña
En la pantalla de ingreso escribí tu email y tocá **¿Olvidaste tu contraseña?**. Llega un mail con un link que abre el panel y te pide la nueva contraseña.
(Requiere haber agregado `https://tudominio.com/admin/` en *Authentication → URL Configuration → Redirect URLs*).

> Tip: también podés crear el usuario con **Invite user**: la persona recibe un mail, entra al panel y elige su contraseña. Después igual hay que hacer el paso 2.

---

## Qué se puede hacer desde el panel

| Sección | Para qué |
|---|---|
| **Resumen** | Pedidos por preparar, ventas del mes, mensajes sin leer, próximo show y **stock bajo**. |
| **Avisos** | La barra dorada de arriba del sitio ("¡Nuevo disco ya disponible!"). Activar/desactivar con un clic, elegir color y fechas de vigencia. |
| **Contenido** | Imagen y textos de la portada, video de fondo, bio corta y completa, línea de tiempo, redes, IDs de Spotify/YouTube, lanzamiento destacado, emails de contacto, PDF de prensa y **opciones/costos de envío**. |
| **Fechas** | Cargar shows: fecha y hora, ciudad, lugar, link de entradas y estado (a la venta, agotado, entrada libre…). Los shows pasados se mueven solos a "Fechas anteriores". |
| **Tienda** | Productos con nombre, precio, precio tachado, descripción, varias fotos (la primera es la portada) y **variantes**: talle, color y stock de cada una. Botón "Generar talles S a XXL". |
| **Pedidos** | Ver cada compra con los datos de envío, cambiar el estado (Pagado → Enviado → Entregado) y anotar el número de seguimiento. |
| **Mensajes** | Lo que llega del formulario de contacto. Responder por mail, marcar leído, eliminar. |
| **Discografía** | Discos y singles: portada, descripción, lista de temas, links e ID del reproductor de Bandcamp. |
| **Integrantes** | Nombre, rol, foto y mini bio de cada miembro. |
| **Galería** | Fotos de la página Banda (con epígrafe y orden). |

### Buenas prácticas
- **Fotos**: subilas sin miedo; el panel las achica y convierte a WebP automáticamente antes de subirlas.
- **Stock**: se descuenta solo cuando un pago se **aprueba**. Si vendés en un show o por WhatsApp, restalo a mano en *Tienda → Editar → Variantes*.
- **Ocultar sin borrar**: usá los interruptores *Visible* / *Activo* en vez de eliminar (por ejemplo, un producto agotado de temporada).
- **Orden**: el campo *Orden* define la posición (1 = primero).

### Pendientes de contenido (cargados como ejemplo)
- Nombres de los integrantes (hoy figuran solo los roles).
- Precios y stock reales de la tienda.
- Fechas de shows futuros.
- Emails de contacto / booking / prensa.
- Instagram, Facebook y TikTok (si los usan).
- Año exacto del single «Por una cabeza» (figura 2024).
