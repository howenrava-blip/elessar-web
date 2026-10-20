/* ELESSÄR — Página de retorno del pago
   MercadoPago vuelve con ?status=approved|pending|failure&external_reference=<orden>
   Stripe vuelve con ?status=approved&order=<orden> (o status=cancel) */
(function () {
  "use strict";
  var E = window.Elessar, Cart = window.ElessarCart;
  var status = E.param("status") || E.param("collection_status") || "approved";
  var ref = E.param("external_reference") || E.param("order") || "";
  var title = E.$("#thanks-title"), text = E.$("#thanks-text"), refEl = E.$("#thanks-ref");

  if (status === "approved") {
    Cart.clear();
  } else if (status === "pending" || status === "in_process") {
    Cart.clear();
    title.textContent = "Pago pendiente";
    text.textContent = "Tu pago está en proceso. Apenas se acredite te avisamos por mail y preparamos el pedido.";
  } else {
    title.textContent = "El pago no se completó";
    text.textContent = "No se realizó ningún cargo. Tu carrito sigue guardado: podés intentarlo de nuevo cuando quieras.";
    var a = document.querySelector("#thanks .btn--gold");
    if (a) { a.href = "checkout.html"; a.textContent = "Reintentar pago"; }
  }
  if (ref) refEl.textContent = "N.º de pedido: " + ref.slice(0, 8).toUpperCase();
})();
