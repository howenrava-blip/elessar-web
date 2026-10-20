/* ELESSÄR — Fechas: próximos shows + historial */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$;

  API.getShows().then(function (data) {
    var up = $("#shows-upcoming"), past = $("#shows-past"), wrap = $("#past-wrap");
    if (up) {
      up.innerHTML = data.upcoming.length
        ? data.upcoming.map(function (s) { return E.showRow(s, false); }).join("")
        : '<li class="shows-empty"><span class="kicker">Pronto</span><p>Estamos preparando nuevas fechas. Seguinos en redes para enterarte primero.</p></li>';
      E.bindReveal(up); E.bindIcs(up, data.upcoming);
    }
    if (past && data.past.length) {
      past.innerHTML = data.past.map(function (s) { return E.showRow(s, true); }).join("");
      wrap.hidden = false;
      if (!data.upcoming.length) wrap.open = true;
      E.bindReveal(past);
    }
  });
})();
