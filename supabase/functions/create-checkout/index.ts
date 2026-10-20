// ============================================================================
// ELESSÄR — Edge Function: create-checkout
// ----------------------------------------------------------------------------
// Recibe el carrito desde checkout.html, VALIDA todo en el servidor
// (precios, stock, productos activos, costo de envío), crea la orden
// "pending" y devuelve la URL de pago de MercadoPago o Stripe.
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   SITE_URL            https://elessarband.com/   (con barra final)
//   MP_ACCESS_TOKEN     token de producción de MercadoPago (APP_USR-…)
//   STRIPE_SECRET_KEY   sk_live_… (opcional, solo si usás Stripe)
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

type CartItem = { variantId: string; qty: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const body = await req.json();
    const items: CartItem[] = Array.isArray(body.items) ? body.items : [];
    const customer = body.customer ?? {};
    const provider: string = body.provider === "stripe" ? "stripe" : "mercadopago";

    // ---- 1. Validaciones básicas de entrada ----
    if (!items.length || items.length > 30) return json({ error: "El carrito está vacío o es demasiado grande." }, 400);
    if (!customer.name || !EMAIL.test(String(customer.email || ""))) return json({ error: "Nombre y email válidos son obligatorios." }, 400);
    for (const it of items) {
      if (!UUID.test(String(it.variantId)) || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20) {
        return json({ error: "Hay productos del carrito que ya no están disponibles. Vaciá el carrito y volvé a agregarlos." }, 400);
      }
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });

    // ---- 2. Traer variantes + productos reales de la base ----
    const ids = items.map((i) => i.variantId);
    const { data: variants, error: vErr } = await supabase
      .from("product_variants")
      .select("id, size, color, stock, price_override, product:products(id, name, slug, price, active)")
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
      const unit = Number(v.price_override ?? v.product.price);
      lines.push({
        variant_id: v.id,
        product_id: v.product.id,
        name: v.product.name,
        variant_label: [v.color, v.size].filter(Boolean).join(" · "),
        qty: it.qty,
        unit_price: unit,
      });
    }

    // ---- 3. Envío (desde settings.shop, editable en el panel) ----
    const { data: shopRow } = await supabase.from("settings").select("value").eq("key", "shop").maybeSingle();
    const options = (shopRow?.value?.shipping_options ?? []) as Array<{ id: string; label: string; price: number }>;
    const ship = options.find((o) => o.id === body.shipping_id) ?? options[0] ?? { id: "pickup", label: "Retiro", price: 0 };
    if (ship.id !== "pickup" && !customer.address) return json({ error: "Falta la dirección de envío." }, 400);

    const subtotal = lines.reduce((n, l) => n + l.unit_price * l.qty, 0);
    const shippingCost = Number(ship.price) || 0;
    const total = subtotal + shippingCost;
    const currency = (Deno.env.get("STORE_CURRENCY") ?? "ARS").toUpperCase();

    // ---- 4. Crear la orden pendiente ----
    const cleanCustomer = Object.fromEntries(
      ["name", "email", "phone", "dni", "address", "city", "province", "zip", "notes"]
        .map((k) => [k, String(customer[k] ?? "").slice(0, 300)]),
    );
    const { data: order, error: oErr } = await supabase.from("orders").insert({
      customer: cleanCustomer,
      items: lines,
      shipping: { id: ship.id, label: ship.label, cost: shippingCost },
      subtotal, shipping_cost: shippingCost, total, currency, provider,
    }).select("id").single();
    if (oErr) throw oErr;

    const site = (Deno.env.get("SITE_URL") || String(body.return_base || "")).replace(/\/?$/, "/");
    if (!/^https?:\/\//.test(site)) return json({ error: "Falta configurar SITE_URL en la función." }, 500);
    const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;

    // ---- 5a. MercadoPago (Checkout Pro) ----
    if (provider === "mercadopago") {
      const token = Deno.env.get("MP_ACCESS_TOKEN");
      if (!token) return json({ error: "MercadoPago no está configurado (MP_ACCESS_TOKEN)." }, 500);
      const pref = {
        items: lines.map((l) => ({
          id: l.variant_id,
          title: l.name + (l.variant_label ? ` (${l.variant_label})` : ""),
          quantity: l.qty,
          unit_price: l.unit_price,
          currency_id: currency,
        })),
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

    // ---- 5b. Stripe Checkout ----
    const sk = Deno.env.get("STRIPE_SECRET_KEY");
    if (!sk) return json({ error: "Stripe no está configurado (STRIPE_SECRET_KEY)." }, 500);
    const f = new URLSearchParams();
    f.set("mode", "payment");
    f.set("success_url", `${site}gracias.html?status=approved&order=${order.id}`);
    f.set("cancel_url", `${site}gracias.html?status=cancel&order=${order.id}`);
    f.set("customer_email", cleanCustomer.email);
    f.set("client_reference_id", order.id);
    f.set("metadata[order_id]", order.id);
    const all = shippingCost ? [...lines, { name: `Envío — ${ship.label}`, variant_label: "", qty: 1, unit_price: shippingCost }] : lines;
    all.forEach((l, i) => {
      f.set(`line_items[${i}][quantity]`, String(l.qty));
      f.set(`line_items[${i}][price_data][currency]`, currency.toLowerCase());
      f.set(`line_items[${i}][price_data][unit_amount]`, String(Math.round(l.unit_price * 100)));
      f.set(`line_items[${i}][price_data][product_data][name]`, l.name + (l.variant_label ? ` (${l.variant_label})` : ""));
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
