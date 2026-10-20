/* ==========================================================================
   ELESSÄR — Checkout
   Envía { items: [{variantId, qty}], customer, shipping, provider } a la
   Edge Function "create-checkout", que valida stock, recalcula el total en
   el servidor y devuelve la URL de pago (MercadoPago / Stripe).
   Si la tienda está en modo demo, ofrece pedido por WhatsApp (si está configurado).
   ========================================================================== */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI, Cart = window.ElessarCart;
  var CFG = window.ELESSAR_CONFIG || {};
  var $ = E.$, esc = E.esc;
  var PROVIDERS = {
    mercadopago: { label: "MercadoPago", hint: "Tarjetas de crédito y débito, dinero en cuenta, efectivo." },
    stripe: { label: "Tarjeta internacional (Stripe)", hint: "Visa, Mastercard, Amex — pagos desde el exterior." }
  };
  var shippingOptions = [];

  function selectedShipping() {
    var r = document.querySelector('input[name="shipping"]:checked');
    return shippingOptions.filter(function (o) { return r && o.id === r.value; })[0] || shippingOptions[0] || { id: "pickup", price: 0 };
  }

  function renderSummary() {
    var st = Cart.getState();
    var form = $("#checkout-form");
    if (!st.items.length) {
      $(".checkout").innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:5rem 0"><h1 class="h2">Tu carrito está vacío</h1><p class="muted">Pasá por la tienda y elegí tu merch.</p><a class="btn btn--gold" href="tienda.html">Ir a la tienda</a></div>';
      return;
    }
    $("#summary-lines").innerHTML = st.items.map(function (i) {
      return '<div class="cart-line" style="grid-template-columns:56px 1fr auto"><img src="' + esc(i.image) + '" alt="" style="width:56px">' +
        '<div><div class="cart-line__name">' + esc(i.name) + '</div><div class="cart-line__var">' + esc(i.variantLabel) + " × " + i.qty + "</div></div>" +
        '<div class="price">' + E.money(i.price * i.qty) + "</div></div>";
    }).join("");
    var ship = selectedShipping();
    $("#sum-subtotal").textContent = E.money(st.subtotal);
    $("#sum-shipping").textContent = ship.price ? E.money(ship.price) : "Sin cargo";
    $("#sum-total").textContent = E.money(st.subtotal + (ship.price || 0));
    $("#address-fields").hidden = ship.id === "pickup";
    if (form) $("#c-address").required = ship.id !== "pickup";
  }

  function renderOptions(s) {
    shippingOptions = ((s.shop || {}).shipping_options || []);
    $("#shipping-options").innerHTML = shippingOptions.map(function (o, i) {
      return '<label class="radio-card"><input type="radio" name="shipping" value="' + esc(o.id) + '"' + (i ? "" : " checked") + '>' +
        "<span>" + esc(o.label) + "<small>" + esc(o.description || "") + '</small></span><span class="radio-card__price">' + (o.price ? E.money(o.price) : "Sin cargo") + "</span></label>";
    }).join("");
    var provs = (CFG.PAYMENT_PROVIDERS || ["mercadopago"]).filter(function (p) { return PROVIDERS[p]; });
    $("#payment-options").innerHTML = provs.map(function (p, i) {
      return '<label class="radio-card"><input type="radio" name="provider" value="' + p + '"' + (i ? "" : " checked") + ">" +
        "<span>" + PROVIDERS[p].label + "<small>" + PROVIDERS[p].hint + "</small></span></label>";
    }).join("");
    if (API.mode !== "live") {
      $("#checkout-notice").innerHTML = '<p class="notice"><strong>Modo demo.</strong> La pasarela de pago se activa al conectar Supabase y MercadoPago (ver <em>docs/DEPLOY.md</em>).' +
        (CFG.WHATSAPP_ORDERS ? " Mientras tanto, podés enviar tu pedido por WhatsApp y lo coordinamos." : "") + "</p>";
      if (CFG.WHATSAPP_ORDERS) $("#pay-btn").textContent = "Enviar pedido por WhatsApp";
    }
    $("#shipping-options").addEventListener("change", renderSummary);
    renderSummary();
  }

  function whatsappOrder(customer, ship) {
    var st = Cart.getState();
    var lines = st.items.map(function (i) { return "• " + i.name + (i.variantLabel ? " (" + i.variantLabel + ")" : "") + " × " + i.qty + " — " + E.money(i.price * i.qty); });
    var txt = "¡Hola Elessär! Quiero hacer este pedido:\n" + lines.join("\n") +
      "\nEnvío: " + ship.label + (ship.price ? " (" + E.money(ship.price) + ")" : "") +
      "\nTotal: " + E.money(st.subtotal + (ship.price || 0)) +
      "\n\nNombre: " + customer.name + "\nEmail: " + customer.email + (customer.phone ? "\nTel: " + customer.phone : "") +
      (customer.address ? "\nDirección: " + [customer.address, customer.city, customer.province, customer.zip].filter(Boolean).join(", ") : "");
    window.open("https://wa.me/" + CFG.WHATSAPP_ORDERS + "?text=" + encodeURIComponent(txt), "_blank", "noopener");
  }

  function initForm() {
    var form = $("#checkout-form"), status = $("#checkout-status"), btn = $("#pay-btn");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status"; status.textContent = "";
      if (!form.checkValidity()) {
        status.className = "form-status is-err"; status.textContent = "Revisá los campos obligatorios (nombre, email y dirección si elegiste envío).";
        var bad = form.querySelector(":invalid"); if (bad) bad.focus();
        return;
      }
      var fd = new FormData(form);
      var customer = {
        name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone"), dni: fd.get("dni"),
        address: fd.get("address"), city: fd.get("city"), province: fd.get("province"), zip: fd.get("zip"), notes: fd.get("notes")
      };
      var ship = selectedShipping();
      var provider = (document.querySelector('input[name="provider"]:checked') || {}).value || "mercadopago";

      if (API.mode !== "live") {
        if (CFG.WHATSAPP_ORDERS) { whatsappOrder(customer, ship); return; }
        status.className = "form-status is-err";
        status.textContent = "La tienda está en modo demo: todavía no se pueden procesar pagos.";
        return;
      }

      btn.disabled = true; btn.textContent = "Conectando con el pago…";
      API.createCheckout({
        items: Cart.getState().items.map(function (i) { return { variantId: i.variantId, qty: i.qty }; }),
        customer: customer, shipping_id: ship.id, provider: provider,
        return_base: location.href.replace(/checkout\.html.*$/, "")
      }).then(function (res) {
        if (!res || !res.url) throw new Error("Respuesta inválida de la pasarela.");
        try { sessionStorage.setItem("elessar_last_order", res.order_id || ""); } catch (err) {}
        location.href = res.url;
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = "Ir a pagar";
        status.className = "form-status is-err";
        status.textContent = err.message || "No pudimos iniciar el pago. Probá de nuevo en unos minutos.";
      });
    });
  }

  API.getSettings().then(renderOptions);
  initForm();
  Cart.subscribe(renderSummary);
})();
