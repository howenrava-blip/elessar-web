/* ELESSÄR — Ficha de producto (?p=slug): galería, variantes, stock, carrito */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI, Cart = window.ElessarCart;
  var $ = E.$, $$ = E.$$, esc = E.esc;
  var CATS = window.ELESSAR_CATEGORIES || {};
  var SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

  function uniq(arr) { return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; }); }

  function render(p) {
    document.title = p.name + " — Tienda Elessär";
    var sizes = uniq(p.variants.map(function (v) { return v.size; })).sort(function (a, b) {
      var ia = SIZE_ORDER.indexOf(a), ib = SIZE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    var colors = uniq(p.variants.map(function (v) { return v.color; }));
    var firstAvail = p.variants.filter(function (v) { return v.stock > 0; })[0] || p.variants[0];
    var sel = { size: firstAvail ? firstAvail.size : null, color: firstAvail ? firstAvail.color : null, qty: 1 };

    var thumbs = p.images.map(function (src, i) {
      return '<button type="button" class="' + (i ? "" : "is-active") + '" data-img="' + esc(src) + '" aria-label="Ver imagen ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy"></button>';
    }).join("");

    $("#pdp").innerHTML =
      '<div class="pdp__gallery">' +
        '<div class="pdp__main" id="pdp-main"><img src="' + esc(p.images[0]) + '" alt="' + esc(p.name) + '"></div>' +
        (p.images.length > 1 ? '<div class="pdp__thumbs">' + thumbs + "</div>" : "") +
      "</div>" +
      '<div class="pdp__info">' +
        '<a class="kicker" href="tienda.html?cat=' + esc(p.category) + '">' + esc(CATS[p.category] || p.category) + "</a>" +
        '<h1 class="h2">' + esc(p.name) + "</h1>" +
        '<div class="pdp__price" id="pdp-price"></div>' +
        (colors.length ? '<div class="opt"><div class="opt__label"><span class="label">Color</span><span class="small muted" id="color-name"></span></div><div class="opt__values" id="opt-color">' +
          colors.map(function (c) {
            var v = p.variants.filter(function (x) { return x.color === c; })[0];
            return '<button type="button" class="opt-btn swatch" data-color="' + esc(c) + '" style="background:' + esc(v.color_hex || "#222") + ';--c:' + esc(v.color_hex || "#222") + '" aria-label="' + esc(c) + '" title="' + esc(c) + '"></button>';
          }).join("") + "</div></div>" : "") +
        (sizes.length ? '<div class="opt"><div class="opt__label"><span class="label">' + (p.category === "remeras" ? "Talle" : "Formato") + '</span>' +
          (p.category === "remeras" ? '<span class="small muted">Calce regular · ver medidas en la descripción</span>' : "") +
          '</div><div class="opt__values" id="opt-size">' +
          sizes.map(function (s) { return '<button type="button" class="opt-btn" data-size="' + esc(s) + '">' + esc(s) + "</button>"; }).join("") + "</div></div>" : "") +
        '<p class="stock-note" id="stock-note"></p>' +
        '<div class="pdp__buy">' +
          '<div class="qty"><button type="button" data-q="-1" aria-label="Restar">−</button><input type="number" id="pdp-qty" value="1" min="1" aria-label="Cantidad" readonly><button type="button" data-q="1" aria-label="Sumar">+</button></div>' +
          '<button class="btn btn--gold" type="button" id="add-btn">Agregar al carrito</button>' +
        "</div>" +
        '<div class="pdp__desc prose prose--plain">' + String(p.description || "").split(/\n+/).map(function (t) { return "<p>" + esc(t) + "</p>"; }).join("") + "</div>" +
        '<ul class="pdp__perks"><li>Envíos a todo el país</li><li>Retiro sin cargo en Neuquén capital</li><li>Pago seguro</li></ul>' +
      "</div>";

    function current() {
      return p.variants.filter(function (v) {
        return (sizes.length ? v.size === sel.size : true) && (colors.length ? v.color === sel.color : true);
      })[0] || null;
    }

    function update() {
      var v = current();
      var price = v && v.price_override ? v.price_override : p.price;
      $("#pdp-price").innerHTML = E.money(price) + (p.compare_at_price && !(v && v.price_override) ? ' <s class="small muted">' + E.money(p.compare_at_price) + "</s>" : "");
      $$("#opt-size [data-size]").forEach(function (b) {
        var s = b.getAttribute("data-size");
        var vv = p.variants.filter(function (x) { return x.size === s && (!colors.length || x.color === sel.color); })[0];
        b.classList.toggle("is-active", s === sel.size);
        b.classList.toggle("is-out", !vv || vv.stock <= 0);
      });
      $$("#opt-color [data-color]").forEach(function (b) { b.classList.toggle("is-active", b.getAttribute("data-color") === sel.color); });
      var cn = $("#color-name"); if (cn) cn.textContent = sel.color || "";
      var note = $("#stock-note"), add = $("#add-btn");
      var stock = v ? v.stock : 0;
      var inCart = v ? (Cart.getState().items.filter(function (i) { return i.variantId === v.id; })[0] || { qty: 0 }).qty : 0;
      note.className = "stock-note" + (stock <= 0 ? " is-out" : stock <= 3 ? " is-low" : "");
      note.textContent = stock <= 0 ? "Sin stock en esta variante" : stock <= 3 ? "¡Últimas " + stock + " unidades!" : "En stock (" + stock + " disponibles)";
      if (sel.qty > Math.max(1, stock - inCart)) sel.qty = Math.max(1, stock - inCart);
      $("#pdp-qty").value = sel.qty;
      add.disabled = stock <= 0 || inCart >= stock;
      add.textContent = stock <= 0 ? "Agotado" : inCart >= stock ? "Ya tenés todo el stock" : "Agregar al carrito";
    }

    $("#pdp").addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-size]"))) { sel.size = t.getAttribute("data-size"); sel.qty = 1; update(); }
      if ((t = e.target.closest("[data-color]"))) { sel.color = t.getAttribute("data-color"); sel.qty = 1; update(); }
      if ((t = e.target.closest("[data-q]"))) {
        var v = current(); var max = v ? v.stock : 1;
        sel.qty = Math.min(max, Math.max(1, sel.qty + Number(t.getAttribute("data-q")))); update();
      }
      if ((t = e.target.closest("[data-img]"))) {
        $("#pdp-main img").src = t.getAttribute("data-img");
        $$(".pdp__thumbs button").forEach(function (b) { b.classList.toggle("is-active", b === t); });
      }
    });

    // Zoom con mouse sobre la imagen principal
    var main = $("#pdp-main");
    if (!matchMedia("(hover: none)").matches) {
      main.addEventListener("click", function () { main.classList.toggle("is-zoom"); });
      main.addEventListener("mousemove", function (e) {
        var r = main.getBoundingClientRect();
        main.querySelector("img").style.transformOrigin = ((e.clientX - r.left) / r.width * 100) + "% " + ((e.clientY - r.top) / r.height * 100) + "%";
      });
      main.addEventListener("mouseout", function (e) { if (!main.contains(e.relatedTarget)) main.classList.remove("is-zoom"); });
    }

    $("#add-btn").addEventListener("click", function () {
      var v = current();
      if (!v || v.stock <= 0) return;
      var label = [v.color && colors.length > 1 ? v.color : null, v.size].filter(Boolean).join(" · ");
      Cart.add({
        productId: p.id, variantId: v.id, slug: p.slug, name: p.name, variantLabel: label,
        size: v.size, color: colors.length > 1 ? v.color : null, category: p.category,
        price: v.price_override || p.price, image: p.images[0], maxStock: v.stock
      }, sel.qty);
      sel.qty = 1; update();
      E.toast("Agregado: " + p.name + (label ? " (" + label + ")" : ""), "Ver carrito", E.openCart);
    });

    Cart.subscribe(update);
    update();
  }

  function renderRelated(list, p) {
    var box = $("#related");
    var rel = list.filter(function (x) { return x.id !== p.id && x.category === p.category; })
      .concat(list.filter(function (x) { return x.id !== p.id && x.category !== p.category; })).slice(0, 4);
    box.innerHTML = rel.map(E.productCard).join("");
    E.bindReveal(box); E.bindTilt(box);
  }

  var slug = E.param("p");
  API.getProducts().then(function (list) {
    var p = list.filter(function (x) { return x.slug === slug; })[0];
    if (!p) {
      $("#pdp").innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:4rem 0"><h1 class="h2">Producto no encontrado</h1><p class="muted">Puede que ya no esté disponible.</p><a class="btn btn--gold" href="tienda.html">Volver a la tienda</a></div>';
      renderRelated(list, { id: null, category: null });
      return;
    }
    render(p);
    renderRelated(list, p);
  });
})();
