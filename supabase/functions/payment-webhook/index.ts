// ============================================================================
// ELESSÄR — Edge Function: payment-webhook
// ----------------------------------------------------------------------------
// MercadoPago / Stripe avisan acá cuando un pago cambia de estado.
// Si el pago está aprobado: marca la orden como "paid" y descuenta stock
// (función SQL apply_paid_order: atómica e idempotente).
//
// Seguridad:
//  - MercadoPago: NO confiamos en el cuerpo del aviso; consultamos el pago a
//    la API de MP con nuestro token y verificamos monto y referencia.
//    Opcional: MP_WEBHOOK_SECRET valida la firma x-signature.
//  - Stripe: verificamos la firma Stripe-Signature con STRIPE_WEBHOOK_SECRET.
//
// Deploy (sin verificación JWT, porque MP/Stripe no envían token de Supabase):
//   supabase functions deploy payment-webhook --no-verify-jwt
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const ok = (msg = "ok") => new Response(msg, { status: 200 });

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------------------------------------------------------------- MercadoPago
async function handleMercadoPago(req: Request, url: URL) {
  const raw = await req.text();
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { /* aviso vacío o en query */ }

  const type = url.searchParams.get("type") || url.searchParams.get("topic") || body.type || body.topic;
  const paymentId = url.searchParams.get("data.id") || body?.data?.id || url.searchParams.get("id");
  if (type !== "payment" || !paymentId) return ok("ignored");

  // Firma opcional (Panel MP → Webhooks → clave secreta)
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (secret) {
    const sig = req.headers.get("x-signature") || "";
    const reqId = req.headers.get("x-request-id") || "";
    const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=")));
    const manifest = `id:${String(paymentId).toLowerCase()};request-id:${reqId};ts:${parts.ts};`;
    const expected = await hmacHex(secret, manifest);
    if (!parts.v1 || !safeEqual(expected, parts.v1)) return new Response("bad signature", { status: 401 });
  }

  // Consultar el pago real a MercadoPago
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` },
  });
  if (!r.ok) return new Response("payment lookup failed", { status: 502 }); // MP reintenta
  const pay = await r.json();
  const orderId = pay.external_reference;
  if (!orderId) return ok("no reference");

  const { data: order } = await supabase.from("orders").select("id,total,status").eq("id", orderId).maybeSingle();
  if (!order) return ok("unknown order");

  if (pay.status === "approved") {
    if (Number(pay.transaction_amount) + 1 < Number(order.total)) {
      console.error("Monto pagado menor al total", orderId, pay.transaction_amount, order.total);
      await supabase.from("orders").update({ admin_notes: `⚠ Monto pagado (${pay.transaction_amount}) menor al total. Revisar.` }).eq("id", orderId);
      return ok("amount mismatch");
    }
    await supabase.rpc("apply_paid_order", { p_order_id: orderId, p_provider_ref: String(pay.id) });
  } else if (["rejected", "cancelled"].includes(pay.status) && order.status === "pending") {
    await supabase.from("orders").update({ status: "cancelled", provider_ref: String(pay.id) }).eq("id", orderId);
  }
  return ok();
}

// --------------------------------------------------------------------- Stripe
async function handleStripe(req: Request) {
  const raw = await req.text();
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("stripe not configured", { status: 500 });

  const header = req.headers.get("stripe-signature") || "";
  const items = header.split(",").map((p) => p.split("="));
  const t = items.find(([k]) => k === "t")?.[1];
  const v1s = items.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t) return new Response("bad signature", { status: 400 });
  const expected = await hmacHex(secret, `${t}.${raw}`);
  if (!v1s.some((v) => safeEqual(v, expected))) return new Response("bad signature", { status: 400 });
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return new Response("too old", { status: 400 });

  const event = JSON.parse(raw);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    if (s.payment_status === "paid" && s.metadata?.order_id) {
      await supabase.rpc("apply_paid_order", { p_order_id: s.metadata.order_id, p_provider_ref: s.id });
    }
  }
  return ok();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok("alive");
  const url = new URL(req.url);
  try {
    if (url.searchParams.get("provider") === "stripe") return await handleStripe(req);
    return await handleMercadoPago(req, url);
  } catch (err) {
    console.error(err);
    return new Response("error", { status: 500 }); // el proveedor reintentará
  }
});
