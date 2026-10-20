/* ELESSÄR — Tienda: catálogo con filtro por categoría (?cat=remeras) */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$, $$ = E.$$, esc = E.esc;
  var CATS = window.ELESSAR_CATEGORIES || {};
  var all = [];

  function render(cat) {
    var box = $("#products");
    var list = cat === "all" ? all : all.filter(function (p) { return p.category === cat; });
    box.innerHTML = list.length ? list.map(E.productCard).join("") : '<p class="muted" style="grid-column:1/-1">No hay productos en esta categoría por ahora.</p>';
    E.bindReveal(box); E.bindTilt(box);
    $$(".filter").forEach(function (b) {
      var on = b.getAttribute("data-cat") === cat;
      b.classList.toggle("is-active", on); b.setAttribute("aria-selected", String(on));
    });
  }

  API.getProducts().then(function (list) {
    all = list;
    var bar = $("#filters");
    var used = Object.keys(CATS).filter(function (k) { return list.some(function (p) { return p.category === k; }); });
    bar.innerHTML = '<button class="filter" type="button" data-cat="all" role="tab">Todo</button>' +
      used.map(function (k) { return '<button class="filter" type="button" data-cat="' + esc(k) + '" role="tab">' + esc(CATS[k]) + "</button>"; }).join("");
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      var cat = b.getAttribute("data-cat");
      render(cat);
      try { history.replaceState(null, "", cat === "all" ? "tienda.html" : "tienda.html?cat=" + cat); } catch (err) {}
    });
    var initial = E.param("cat");
    render(initial && CATS[initial] ? initial : "all");
  });
})();
