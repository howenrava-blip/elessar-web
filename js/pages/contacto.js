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
    var epk = document.querySelector('#press-downloads a[href$=".pdf"]');
    if (epk && p.epk_url) epk.href = p.epk_url;
    if (p.photos_zip_url) {
      var li = document.createElement("li");
      li.innerHTML = '<a href="' + esc(p.photos_zip_url) + '" download>Pack de fotos en alta (ZIP) <span>↓</span></a>';
      $("#press-downloads").appendChild(li);
    }
  });

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
