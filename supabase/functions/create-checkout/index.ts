// ============================================================================
// ELESSÄR — Edge Function: create-checkout
// ----------------------------------------------------------------------------
// Recibe el carrito desde checkout.html, VALIDA todo en el servidor
// (precios, stock, productos activos, costo de envío, método habilitado),
// crea la orden "pending" y devuelve a dónde mandar al cliente:
//   · mercadopago → Checkout Pro
//   · paypal      → aprobación en PayPal (cobra en USD con la cotización del panel)
//   · stripe      → Stripe Checkout
//   · whatsapp    → wa.me con el pedido escrito (sin cobro online)
// Además, con { action: "paypal-capture" } confirma un pago de PayPal al volver.
//
// Los métodos se activan en Panel → Pagos (settings.payments).
// Secretos (Supabase → Edge Functions → Secrets):
//   SITE_URL            https://elessar.site/   (con barra final)
//   MP_ACCESS_TOKEN     token de producción de MercadoPago (APP_USR-…)
//   PAYPAL_CLIENT_ID    \  credenciales de una app "Live" en developer.paypal.com
//   PAYPAL_SECRET       /
//   PAYPAL_ENV          live | sandbox   (por defecto: live)
//   STRIPE_SECRET_KEY   sk_live_… (opcional)
//   STORE_CURRENCY      ARS (por defecto)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase solo.
//
// Deploy (panel web o CLI). Desactivar "Verify JWT": la función valida todo sola.
//   supabase functions deploy create-checkout --no-verify-jwt
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

// Cabeceras CORS: permiten que el sitio llame a esta función desde el navegador
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PROVIDERS = ["mercadopago", "paypal", "stripe", "whatsapp"] as const;
type Provider = typeof PROVIDERS[number];
type CartItem = { variantId: string; qty: number };
// deno-lint-ignore no-explicit-any
type Json = Record<string, any>;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

/** ¿El método está activo en Panel → Pagos? (sin configurar: MP y Stripe, como antes) */
function isEnabled(pay: Json | null, p: Provider) {
  const configured = pay && Object.keys(pay).some((k) => k.endsWith("_enabled"));
  if (!configured) return p === "mercadopago" || p === "stripe";
  return pay![`${p}_enabled`] === true;
}

// ------------------------------------------------------------------ PayPal
const paypalBase = () =>
  (Deno.env.get("PAYPAL_ENV") || "live").toLowerCase() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

async function paypalToken() {
  const id = Deno.env.get("PAYPAL_CLIENT_ID"), secret = Deno.env.get("PAYPAL_SECRET");
  if (!id || !secret) throw new Error("PAYPAL_NOT_CONFIGURED");
  const r = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const d = await r.json();
  if (!r.ok) { console.error("PayPal token", d); throw new Error("PAYPAL_AUTH"); }
  return d.access_token as string;
}

/** Confirma (captura) un pago PayPal aprobado y descuenta stock */
async function capturePayPal(orderId: string, token: string) {
  if (!UUID.test(orderId) || !/^[A-Z0-9-]{5,40}$/i.test(token)) return json({ error: "Datos inválidos." }, 400);
  const { data: order } = await supabase.from("orders").select("id,status,provider,provider_ref,stock_applied").eq("id", orderId).maybeSingle();
  if (!order || order.provider !== "paypal" || order.provider_ref !== token) return json({ error: "Pedido no encontrado." }, 404);
  if (order.stock_applied) return json({ status: "approved", order_id: orderId });

  const access = await paypalToken();
  const headers = { Authorization: `Bearer ${access}`, "Content-Type": "application/json" };
  let r = await fetch(`${paypalBase()}/v2/checkout/orders/${token}/capture`, { method: "POST", headers });
  let d = await r.json();
  if (!r.ok && d?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED") {
    r = await fetch(`${paypalBase()}/v2/checkout/orders/${token}`, { headers });
    d = await r.json();
  }
  const unit = d?.purchase_units?.[0];
  const ref = unit?.reference_id || unit?.payments?.captures?.[0]?.custom_id;
  if (d?.status === "COMPLETED" && ref === orderId) {
    await supabase.rpc("apply_paid_order", { p_order_id: orderId, p_provider_ref: token });
    return json({ status: "approved", order_id: orderId });
  }
  console.error("PayPal capture", JSON.stringify(d).slice(0, 800));
  return json({ status: "failure", order_id: orderId });
}

// ---------------------------------------------------------------- WhatsApp
// deno-lint-ignore no-explicit-any
function whatsappText(pay: Json, lines: any[], ship: Json, customer: Json, total: number, orderId: string) {
  const out = [String(pay.whatsapp_intro || "Hola Elessär, estoy en la página y quiero comprar los siguientes productos:")];
  for (const l of lines) {
    let s = l.name;
    if (l.size) s += (l.category === "remeras" ? " Talle " : " ") + l.size;
    if (l.color && l.multi_color) s += " " + l.color;
    if (l.qty > 1) s += ` (${l.qty} ${l.category === "musica" ? "ejemplares" : "unidades"})`;
    out.push(s);
  }
  if (pay.whatsapp_include_total !== false) {
    out.push("", `Entrega: ${ship.label}${ship.price ? ` (${money(ship.price)})` : ""}`, `Total: ${money(total)}`);
  }
  out.push("", `Nombre: ${customer.name}`);
  const addr = [customer.address, customer.city, customer.province, customer.zip].filter(Boolean).join(", ");
  if (addr) out.push(`Dirección: ${addr}`);
  if (customer.notes) out.push(`Notas: ${customer.notes}`);
  out.push(`Pedido N.º ${orderId.slice(0, 8).toUpperCase()}`);
  return out.join("\n");
}

// =================================================================== handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await req.json();

    // ---- Confirmación de PayPal al volver del pago ----
    if (body.action === "paypal-capture") return await capturePayPal(String(body.order_id || ""), String(body.token || ""));

    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer ?? {};
    const provider = (PROVIDERS as readonly string[]).includes(body.provider) ? body.provider as Provider : "mercadopago";
    const isWA = provider === "whatsapp";

    // ---- 1. Validaciones básicas de entrada ----
    if (!items.length || items.length > 30) return json({ error: "El carrito está vacío o es demasiado grande." }, 400);
    if (!customer.name) return json({ error: "El nombre es obligatorio." }, 400);
    if (!isWA && !EMAIL.test(String(customer.email || ""))) return json({ error: "Ingresá un email válido." }, 400);
    for (const it of items) {
      if (!UUID.test(String(it.variantId)) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) {
        return json({ error: "Hay productos del carrito que ya no están disponibles. Vaciá el carrito y volvé a agregarlos." }, 400);
      }
    }

    // ---- 2. Ajustes: envíos y métodos de pago (Panel) ----
    const { data: rows } = await supabase.from("settings").select("key,value").in("key", ["shop", "payments"]);
    const cfg: Json = Object.fromEntries((rows ?? []).map((r: { key: string; value: Json }) => [r.key, r.value]));
    const pay: Json | null = cfg.payments ?? null;
    if (!isEnabled(pay, provider)) return json({ error: "Ese método de pago no está disponible." }, 400);

    // ---- 3. Traer variantes + productos reales de la base ----
    const ids = items.map((i) => i.variantId);
    const { data: variants, error: vErr } = await supabase
      .from("product_variants")
      .select("id, size, color, stock, price_override, product:products(id, name, slug, price, active, category, product_variants(color))")
      .in("id", ids);
    if (vErr) throw vErr;

    const lines = [];
    for (const it of items) {
      // deno-lint-ignore no-explicit-any
      const v: any = variants?.find((x: { id: string }) => x.id === it.variantId);
      if (!v || !v.product || !v.product.active) {
        return json({ error: "Un producto del carrito ya no está disponible. Quitalo y probá de nuevo." }, 409);
      }
      if (v.stock < it.qty) {
        return json({ error: `Stock insuficiente de "${v.product.name}${v.size ? " " + v.size : ""}". Quedan ${v.stock}.` }, 409);
      }
      const colors = new Set((v.product.product_variants ?? []).map((x: { color: string | null }) => x.color).filter(Boolean));
      lines.push({
        variant_id: v.id,
        product_id: v.product.id,
        name: v.product.name,
        variant_label: [v.color, v.size].filter(Boolean).join(" · "),
        size: v.size, color: v.color, category: v.product.category, multi_color: colors.size > 1,
        qty: it.qty,
        unit_price: Number(v.price_override ?? v.product.price),
      });
    }

    // ---- 4. Envío ----
    const options = (cfg.shop?.shipping_options ?? []) as Array<{ id: string; label: string; price: number }>;
    const ship = options.find((o) => o.id === body.shipping_id) ?? options[0] ?? { id: "pickup", label: "Retiro", price: 0 };
    if (ship.id !== "pickup" && !customer.address && !isWA) return json({ error: "Falta la dirección de envío." }, 400);

    const subtotal = lines.reduce((n, l) => n + l.unit_price * l.qty, 0);
    const shippingCost = Number(ship.price) || 0;
    const total = subtotal + shippingCost;
    const currency = (Deno.env.get("STORE_CURRENCY") ?? "ARS").toUpperCase();

    // PayPal: conversión a USD con la cotización del panel
    let usdTotal = 0;
    if (provider === "paypal") {
      const rate = Number(pay?.paypal_usd_rate);
      if (!rate || rate <= 0) return json({ error: "PayPal no está disponible: falta la cotización del dólar en el panel." }, 500);
      usdTotal = Math.ceil((total / rate) * 100) / 100;
      if (usdTotal < 1) return json({ error: "El monto es demasiado bajo para PayPal." }, 400);
    }
    if (isWA && !String(pay?.whatsapp_number || "").replace(/\D/g, "")) return json({ error: "Falta el número de WhatsApp en el panel." }, 500);

    // ---- 5. Crear la orden pendiente ----
    const cleanCustomer = Object.fromEntries(
      ["name", "email", "phone", "dni", "address", "city", "province", "zip", "notes"]
        .map((k) => [k, String(customer[k] ?? "").slice(0, 300)]),
    );
    const { data: order, error: oErr } = await supabase.from("orders").insert({
      customer: cleanCustomer,
      items: lines.map(({ size: _s, color: _c, category: _cat, multi_color: _m, ...l }) => l),
      shipping: { id: ship.id, label: ship.label, cost: shippingCost },
      subtotal, shipping_cost: shippingCost, total, currency, provider,
      admin_notes: provider === "paypal" ? `PayPal: USD ${usdTotal.toFixed(2)} (1 USD = ${money(Number(pay?.paypal_usd_rate))})`
        : isWA ? "Pedido por WhatsApp: coordinar pago y entrega. Al marcarlo como «Pagado» se descuenta el stock." : null,
    }).select("id").single();
    if (oErr) throw oErr;

    // ---- 6a. WhatsApp: sin cobro online ----
    if (isWA) {
      const number = String(pay!.whatsapp_number).replace(/\D/g, "");
      const text = whatsappText(pay!, lines, ship, cleanCustomer, total, order.id);
      return json({ url: `https://wa.me/${number}?text=${encodeURIComponent(text)}`, order_id: order.id });
    }

    const site = (Deno.env.get("SITE_URL") || String(body.return_base || "")).replace(/\/?$/, "/");
    if (!/^https?:\/\//.test(site)) return json({ error: "Falta configurar SITE_URL en la función." }, 500);
    const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
    const title = (l: { name: string; variant_label: string }) => l.name + (l.variant_label ? ` (${l.variant_label})` : "");

    // ---- 6b. MercadoPago (Checkout Pro) ----
    if (provider === "mercadopago") {
      const token = Deno.env.get("MP_ACCESS_TOKEN");
      if (!token) return json({ error: "MercadoPago no está configurado (MP_ACCESS_TOKEN)." }, 500);
      const pref = {
        items: lines.map((l) => ({ id: l.variant_id, title: title(l), quantity: l.qty, unit_price: l.unit_price, currency_id: currency })),
        shipments: shippingCost ? { cost: shippingCost, mode: "not_specified" } : undefined,
        payer: { name: cleanCustomer.name, email: cleanCustomer.email },
        external_reference: order.id,
        back_urls: {
          success: `${site}gracias.html?status=approved`,
          pending: `${site}gracias.html?status=pending`,
          failure: `${site}gracias.html?status=failure`,
        },
        auto_return: "approved",
        notification_url: `${fnBase}/payment-webhook?provider=mercadopago`,
        statement_descriptor: "ELESSAR",
      };
      const r = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(pref),
      });
      const data = await r.json();
      if (!r.ok) { console.error("MP error", data); return json({ error: "MercadoPago rechazó la operación." }, 502); }
      await supabase.from("orders").update({ provider_ref: data.id }).eq("id", order.id);
      return json({ url: data.init_point, order_id: order.id });
    }

    // ---- 6c. PayPal (Orders v2) ----
    if (provider === "paypal") {
      let access: string;
      try { access = await paypalToken(); } catch { return json({ error: "PayPal no está configurado (PAYPAL_CLIENT_ID / PAYPAL_SECRET)." }, 500); }
      const r = await fetch(`${paypalBase()}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json", "PayPal-Request-Id": order.id },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: order.id,
            custom_id: order.id,
            description: `Tienda Elessär — pedido ${order.id.slice(0, 8).toUpperCase()}`,
            amount: { currency_code: "USD", value: usdTotal.toFixed(2) },
          }],
          application_context: {
            brand_name: "Elessär",
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
            return_url: `${site}gracias.html?provider=paypal&order=${order.id}`,
            cancel_url: `${site}gracias.html?status=cancel&order=${order.id}`,
          },
        }),
      });
      const data = await r.json();
      const approve = (data.links ?? []).find((l: { rel: string; href: string }) => l.rel === "approve" || l.rel === "payer-action");
      if (!r.ok || !approve) { console.error("PayPal error", data); return json({ error: "PayPal rechazó la operación." }, 502); }
      await supabase.from("orders").update({ provider_ref: data.id }).eq("id", order.id);
      return json({ url: approve.href, order_id: order.id });
    }

    // ---- 6d. Stripe Checkout ----
    const sk = Deno.env.get("STRIPE_SECRET_KEY");
    if (!sk) return json({ error: "Stripe no está configurado (STRIPE_SECRET_KEY)." }, 500);
    const f = new URLSearchParams();
    f.set("mode", "payment");
    f.set("success_url", `${site}gracias.html?status=approved&order=${order.id}`);
    f.set("cancel_url", `${site}gracias.html?status=cancel&order=${order.id}`);
    if (cleanCustomer.email) f.set("customer_email", cleanCustomer.email);
    f.set("client_reference_id", order.id);
    f.set("metadata[order_id]", order.id);
    const all = shippingCost ? [...lines, { name: `Envío — ${ship.label}`, variant_label: "", qty: 1, unit_price: shippingCost }] : lines;
    all.forEach((l, i) => {
      f.set(`line_items[${i}][quantity]`, String(l.qty));
      f.set(`line_items[${i}][price_data][currency]`, currency.toLowerCase());
      f.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.unit_price * 100)));
      f.set(`line_items[${i}][price_data][product_data][name]`, title(l));
    });
    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${sk}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: f,
    });
    const data = await r.json();
    if (!r.ok) { console.error("Stripe error", data); return json({ error: "Stripe rechazó la operación." }, 502); }
    await supabase.from("orders").update({ provider_ref: data.id }).eq("id", order.id);
    return json({ url: data.url, order_id: order.id });
  } catch (err) {
    console.error(err);
    return json({ error: "Error inesperado al crear el pago." }, 500);
  }
});
