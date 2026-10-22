/* ELESSÄR — Contacto: formulario → tabla messages (visible en /admin) + EPK */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$, esc = E.esc;

  var motivo = E.param("motivo");
  if (motivo && $("#f-subject")) $("#f-subject").value = motivo;

  API.getSettings().then(function (s) {
    var c = s.contact || {}, p = s.press || {};
    var lines = [];
    if (c.booking_email) lines.push('<div><span class="label">Booking</span><br><a href="mailto:' + esc(c.booking_email) + '">' + esc(c.booking_email) + "</a></div>");
    if (c.press_email) lines.push('<div><span class="label">Prensa</span><br><a href="mailto:' + esc(c.press_email) + '">' + esc(c.press_email) + "</a></div>");
    if (c.email) lines.push('<div><span class="label">General</span><br><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></div>");
    if (c.location) lines.push('<div><span class="label">Base</span><br>' + esc(c.location) + "</div>");
    $("#contact-lines").innerHTML = lines.join("");
    renderPress(p);
  });

  /* Recuadro "Kit de prensa": todo se edita en Panel → Prensa */
  function renderPress(p) {
    if (p.title) $("#press-title").textContent = p.title;
    if (p.text != null) { $("#press-text").textContent = p.text; $("#press-text").hidden = !p.text; }
    var list = (p.downloads || []).filter(function (d) { return d && d.url && E.isSafeUrl(d.url); });
    // compatibilidad con la versión anterior (solo PDF + ZIP)
    if (!p.downloads && p.epk_url) list = [{ label: "EPK completo (PDF)", url: p.epk_url }];
    var ul = $("#press-downloads");
    ul.innerHTML = list.map(function (d) {
      var ext = (String(d.url).split("?")[0].match(/\.(\w{2,5})$/) || [, ""])[1].toUpperCase();
      var file = "elessar-" + String(d.label || "archivo").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (ext ? "." + ext.toLowerCase() : "");
      return '<li><a href="' + esc(d.url) + '" download="' + esc(file) + '" target="_blank" rel="noopener">' + esc(d.label || "Descargar") +
        ' <span>' + (ext ? esc(ext) + " " : "") + "↓</span></a></li>";
    }).join("");
    ul.hidden = !list.length;
    // si no queda nada para mostrar, se oculta el recuadro entero
    $("#prensa").hidden = !list.length && !p.text;
  }

  var form = $("#contact-form"), status = $("#contact-status");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var f = form.elements; // ojo: form.name sería el atributo del <form>, no el input
    if (f.website.value) return; // honeypot: bot
    if (!form.checkValidity()) {
      status.className = "form-status is-err"; status.textContent = "Completá nombre, un email válido y tu mensaje.";
      return;
    }
    var btn = form.querySelector("button[type=submit]");
    btn.disabled = true;
    API.sendMessage({ name: f.name.value.trim(), email: f.email.value.trim(), subject: f.subject.value, body: f.body.value.trim() })
      .then(function (r) {
        form.reset();
        status.className = "form-status is-ok";
        status.textContent = r && r.demo ? "Modo demo: el mensaje no se guardó, pero el formulario funciona." : "¡Gracias! Recibimos tu mensaje y te respondemos a la brevedad.";
      })
      .catch(function () {
        status.className = "form-status is-err"; status.textContent = "No se pudo enviar. Probá de nuevo en unos minutos.";
      })
      .then(function () { btn.disabled = false; });
  });
})();
