/* ==========================================================================
   ELESSÄR — Checkout
   Los métodos de pago visibles se eligen en Panel → Pagos.
   - MercadoPago / PayPal / Stripe: se envía { items, customer, shipping_id,
     provider } a la Edge Function "create-checkout", que valida stock,
     recalcula el total en el servidor y devuelve la URL de pago.
   - WhatsApp: se registra el pedido (si la función está disponible) y se
     abre WhatsApp con el mensaje armado. Si la función no responde, el
     mensaje se arma igual en el navegador: el cliente nunca queda trabado.
   ========================================================================== */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI, Cart = window.ElessarCart;
  var $ = E.$, esc = E.esc;
  var settings = {};
  var shippingOptions = [];

  function selectedShipping() {
    var r = document.querySelector('input[name="shipping"]:checked');
    return shippingOptions.filter(function (o) { return r && o.id === r.value; })[0] || shippingOptions[0] || { id: "pickup", label: "Retiro", price: 0 };
  }
  function selectedProvider() { return (document.querySelector('input[name="provider"]:checked') || {}).value || ""; }

  function renderSummary() {
    var st = Cart.getState();
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
    updateRequirements();
  }

  /** WhatsApp pide menos datos (se coordina por chat); los pagos online, todo */
  function updateRequirements() {
    var wa = selectedProvider() === "whatsapp", ship = selectedShipping();
    $("#address-fields").hidden = ship.id === "pickup";
    $("#c-address").required = ship.id !== "pickup" && !wa;
    $("#c-email").required = !wa;
    var lbl = document.querySelector('label[for="c-email"]');
    if (lbl) lbl.textContent = wa ? "Email (opcional)" : "Email";
    var btn = $("#pay-btn");
    if (!btn.disabled) btn.innerHTML = wa ? E.icon("whatsapp") + "Enviar pedido por WhatsApp" : "Ir a pagar";
    var note = $("#provider-note");
    if (note) {
      var p = selectedProvider();
      note.innerHTML = p === "paypal" && settings.payments && settings.payments.paypal_usd_rate
        ? '<p class="notice">PayPal cobra en dólares: el total se convierte a <strong>USD ' + (Math.ceil(totalNow() / settings.payments.paypal_usd_rate * 100) / 100).toFixed(2) + "</strong> (1 USD = " + E.money(settings.payments.paypal_usd_rate) + ").</p>"
        : wa ? '<p class="notice">Al confirmar se abre <strong>WhatsApp</strong> con tu pedido ya escrito. Solo tenés que enviarlo y coordinamos el pago y la entrega por ahí.</p>' : "";
    }
  }
  function totalNow() { return Cart.getState().subtotal + (selectedShipping().price || 0); }

  function renderOptions(s) {
    settings = s;
    shippingOptions = ((s.shop || {}).shipping_options || []);
    $("#shipping-options").innerHTML = shippingOptions.map(function (o, i) {
      return '<label class="radio-card"><input type="radio" name="shipping" value="' + esc(o.id) + '"' + (i ? "" : " checked") + ">" +
        "<span>" + esc(o.label) + "<small>" + esc(o.description || "") + '</small></span><span class="radio-card__price">' + (o.price ? E.money(o.price) : "Sin cargo") + "</span></label>";
    }).join("");

    var methods = E.paymentMethods(s);
    var box = $("#payment-options");
    if (!methods.length) {
      box.innerHTML = '<p class="notice"><strong>La tienda no tiene métodos de pago activos.</strong> Escribinos desde <a href="contacto.html?motivo=tienda">contacto</a> y coordinamos tu compra.</p>';
      $("#pay-btn").disabled = true;
    } else {
      box.innerHTML = methods.map(function (m, i) {
        return '<label class="radio-card"><input type="radio" name="provider" value="' + esc(m.id) + '"' + (i ? "" : " checked") + ">" +
          (m.id === "whatsapp" ? '<span style="display:flex;gap:.6rem;align-items:flex-start"><span style="width:20px;color:#25d366;flex:0 0 auto">' + E.icon("whatsapp") + "</span>" : "<span>") +
          "<span>" + esc(m.label) + "<small>" + esc(m.description) + "</small></span></span></label>";
      }).join("");
      // si hay un solo método, no hace falta elegir
      if (methods.length === 1) box.querySelector(".radio-card").style.cursor = "default";
    }
    if (!$("#provider-note")) { var n = document.createElement("div"); n.id = "provider-note"; box.after(n); }
    if (API.mode !== "live" && methods.some(function (m) { return m.id !== "whatsapp"; })) {
      $("#checkout-notice").innerHTML = '<p class="notice"><strong>Modo demo.</strong> Los pagos online se activan al conectar Supabase y la pasarela (ver <em>docs/DEPLOY.md</em>).</p>';
    }
    $("#shipping-options").addEventListener("change", renderSummary);
    box.addEventListener("change", updateRequirements);
    renderSummary();
  }

  function readCustomer(form) {
    var fd = new FormData(form);
    var c = {};
    ["name", "email", "phone", "dni", "address", "city", "province", "zip", "notes"].forEach(function (k) { c[k] = String(fd.get(k) || "").trim(); });
    return c;
  }

  /** Abre WhatsApp en una pestaña reservada en el clic (evita el bloqueo de popups) */
  function goWhatsApp(win, url) {
    try { sessionStorage.setItem("elessar_wa_url", url); } catch (e) {}
    if (win) { win.location.href = url; Cart.clear(); location.href = "gracias.html?status=whatsapp"; }
    else { Cart.clear(); location.href = url; }
  }

  function initForm() {
    var form = $("#checkout-form"), status = $("#checkout-status"), btn = $("#pay-btn");
    if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status"; status.textContent = "";
      updateRequirements();
      if (!form.checkValidity()) {
        status.className = "form-status is-err";
        status.textContent = "Revisá los campos obligatorios.";
        var bad = form.querySelector(":invalid"); if (bad) bad.focus();
        return;
      }
      var customer = readCustomer(form), ship = selectedShipping(), provider = selectedProvider();
      if (!provider) return;
      var items = Cart.getState().items;
      var payload = {
        items: items.map(function (i) { return { variantId: i.variantId, qty: i.qty }; }),
        customer: customer, shipping_id: ship.id, provider: provider,
        return_base: location.href.replace(/checkout\.html.*$/, "")
      };

      // ---------- WhatsApp ----------
      if (provider === "whatsapp") {
        var win = null;
        try { win = window.open("about:blank", "_blank"); } catch (err) {}
        btn.disabled = true; btn.textContent = "Abriendo WhatsApp…";
        var fallback = function () { return E.waUrl(settings, E.waMessage(settings, items, { shipping: ship, customer: customer })); };
        API.createCheckout(payload)
          // sin función (o versión vieja que no conoce WhatsApp) → mensaje armado acá
          .then(function (res) { return res && /^https:\/\/wa\.me\//.test(res.url || "") ? res.url : fallback(); }, function () { return fallback(); })
          .then(function (url) { goWhatsApp(win, url); });
        return;
      }

      // ---------- Pagos online ----------
      if (API.mode !== "live") {
        status.className = "form-status is-err";
        status.textContent = "La tienda está en modo demo: todavía no se pueden procesar pagos online.";
        return;
      }
      btn.disabled = true; btn.textContent = "Conectando con el pago…";
      API.createCheckout(payload).then(function (res) {
        if (!res || !res.url) throw new Error("Respuesta inválida de la pasarela.");
        try { sessionStorage.setItem("elessar_last_order", res.order_id || ""); } catch (err) {}
        location.href = res.url;
      }).catch(function (err) {
        btn.disabled = false; updateRequirements();
        status.className = "form-status is-err";
        status.textContent = err.message || "No pudimos iniciar el pago. Probá de nuevo en unos minutos.";
      });
    });
  }

  API.getSettings().then(renderOptions);
  initForm();
  Cart.subscribe(renderSummary);
})();
