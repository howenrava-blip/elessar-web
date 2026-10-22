/* ELESSÄR — Página de retorno del pago
   MercadoPago: ?status=approved|pending|failure&external_reference=<orden>
   Stripe:      ?status=approved|cancel&order=<orden>
   PayPal:      ?provider=paypal&order=<orden>&token=<id PayPal>  → se confirma (captura) acá
   WhatsApp:    ?status=whatsapp                                  → link por si no se abrió */
(function () {
  "use strict";
  var E = window.Elessar, Cart = window.ElessarCart, API = window.ElessarAPI;
  var title = E.$("#thanks-title"), text = E.$("#thanks-text"), refEl = E.$("#thanks-ref");
  var mainBtn = document.querySelector("#thanks .btn--gold");
  var ref = E.param("external_reference") || E.param("order") || "";

  function show(status) {
    if (status === "approved") {
      Cart.clear();
      title.textContent = "¡Gracias por tu compra!";
      text.textContent = "Te enviamos un mail con el detalle del pedido. Lo preparamos y te avisamos cuando salga.";
    } else if (status === "pending" || status === "in_process") {
      Cart.clear();
      title.textContent = "Pago pendiente";
      text.textContent = "Tu pago está en proceso. Apenas se acredite te avisamos por mail y preparamos el pedido.";
    } else if (status === "whatsapp") {
      title.textContent = "¡Pedido enviado a WhatsApp!";
      text.textContent = "Abrimos WhatsApp con tu pedido ya escrito: solo tenés que tocar «Enviar». Ahí coordinamos el pago y la entrega.";
      var url = null;
      try { url = sessionStorage.getItem("elessar_wa_url"); } catch (e) {}
      if (url && mainBtn) { mainBtn.href = url; mainBtn.target = "_blank"; mainBtn.rel = "noopener"; mainBtn.innerHTML = E.icon("whatsapp") + "Abrir WhatsApp de nuevo"; }
    } else {
      title.textContent = "El pago no se completó";
      text.textContent = "No se realizó ningún cargo. Tu carrito sigue guardado: podés intentarlo de nuevo cuando quieras.";
      if (mainBtn) { mainBtn.href = "checkout.html"; mainBtn.textContent = "Reintentar pago"; }
    }
    if (ref) refEl.textContent = "N.º de pedido: " + ref.slice(0, 8).toUpperCase();
  }

  // PayPal: el cobro se confirma recién cuando el servidor "captura" la orden
  if (E.param("provider") === "paypal" && E.param("token") && ref) {
    title.textContent = "Confirmando tu pago…";
    text.textContent = "Esto tarda unos segundos. No cierres esta página.";
    API.capturePayPal(ref, E.param("token"))
      .then(function (r) { show(r && r.status === "approved" ? "approved" : "failure"); })
      .catch(function () { show("failure"); });
  } else {
    show(E.param("status") || E.param("collection_status") || "approved");
  }
})();
