/* ==========================================================================
   ELESSÄR — UI compartida (window.Elessar)
   --------------------------------------------------------------------------
   Header, menú móvil, aviso destacado, carrito lateral, toasts, reveal,
   redes sociales, helpers de formato y componentes reutilizables
   (tarjeta de producto, fila de show, fachada de YouTube, lightbox).
   Cada init corre dentro de safe(): si uno falla, el resto sigue.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ELESSAR_CONFIG || {};
  var API = window.ElessarAPI;
  var Cart = window.ElessarCart;
  var TZ = "America/Argentina/Buenos_Aires";

  document.documentElement.classList.remove("no-js");

  /* ---------- helpers ---------- */
  function safe(fn, name) {
    try { var r = fn(); if (r && r.catch) r.catch(function (e) { console.error("[Elessär] " + name, e); }); }
    catch (e) { console.error("[Elessär] " + name, e); }
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var moneyFmt;
  function money(n) {
    try {
      moneyFmt = moneyFmt || new Intl.NumberFormat(CFG.LOCALE || "es-AR", { style: "currency", currency: CFG.CURRENCY || "ARS", maximumFractionDigits: 0 });
      return moneyFmt.format(n || 0);
    } catch (e) { return "$ " + Math.round(n || 0); }
  }
  function dateParts(iso) {
    var d = new Date(iso);
    function f(o) { return new Intl.DateTimeFormat("es-AR", Object.assign({ timeZone: TZ }, o)).format(d); }
    return {
      day: f({ day: "2-digit" }),
      month: f({ month: "short" }).replace(".", ""),
      year: f({ year: "numeric" }),
      weekday: f({ weekday: "long" }),
      time: f({ hour: "2-digit", minute: "2-digit", hour12: false }),
      long: f({ weekday: "long", day: "numeric", month: "long", year: "numeric" })
    };
  }
  function param(name) { try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; } }
  function isSafeUrl(u) { return !!u && /^(https?:|mailto:|tel:|#|[a-z0-9_\-./]+(\?|$|#))/i.test(u) && !/^javascript:/i.test(u); }

  /* ---------- íconos ---------- */
  var ICONS = {
    spotify: '<path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.4-2.1-10.6-1.2a.75.75 0 1 1-.33-1.46c4.6-1 8.6-.6 11.7 1.4.35.2.46.67.24 1zm1.5-3.3a.94.94 0 0 1-1.3.3c-3.2-2-8.1-2.6-11.9-1.4a.94.94 0 1 1-.55-1.8c4.3-1.3 9.7-.7 13.4 1.6.44.27.58.85.3 1.3zm.13-3.4C15.3 8.3 8.9 8.1 5.2 9.2a1.1 1.1 0 1 1-.65-2.15c4.3-1.3 11.3-1 15.7 1.6a1.1 1.1 0 0 1-1.13 1.95z"/>',
    youtube: '<path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>',
    bandcamp: '<path d="M0 18.75l7.44-13.5H24l-7.44 13.5z"/>',
    instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.8.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
    facebook: '<path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/>',
    tiktok: '<path d="M16.6 0h-4v16.3a3.4 3.4 0 1 1-2.4-3.3V8.9a7.5 7.5 0 1 0 6.4 7.4V8.1a9.3 9.3 0 0 0 5.4 1.7V5.8A5.4 5.4 0 0 1 16.6 0z"/>',
    play: '<path d="M6 4l14 8-14 8z"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>"; }
  var SOCIAL_LABELS = { spotify: "Spotify", youtube: "YouTube", bandcamp: "Bandcamp", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" };

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(msg, actionLabel, action) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.innerHTML = "<span>" + esc(msg) + "</span>" + (actionLabel ? "<button type='button'>" + esc(actionLabel) + "</button>" : "");
    if (actionLabel && action) toastEl.querySelector("button").onclick = function () { action(); toastEl.classList.remove("is-show"); };
    requestAnimationFrame(function () { toastEl.classList.add("is-show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("is-show"); }, 4200);
  }

  /* ---------- header + menú móvil ---------- */
  function initHeader() {
    var header = $(".header");
    if (!header) return;
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 30); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    var burger = $(".burger"), menu = $(".mobile-menu");
    if (!burger || !menu) return;
    function setOpen(open) {
      burger.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
      document.body.classList.toggle("is-locked", open);
      header.classList.toggle("header--solid", open);
    }
    burger.addEventListener("click", function () { setOpen(burger.getAttribute("aria-expanded") !== "true"); });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { setOpen(false); }); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setOpen(false); });
  }

  /* ---------- aviso destacado (CMS: tabla announcements) ---------- */
  function initAnnouncement() {
    var bar = $("#announce");
    if (!bar) return;
    return API.getAnnouncements().then(function (list) {
      var a = list[0];
      var dismissed = null;
      try { dismissed = sessionStorage.getItem("elessar_announce_closed"); } catch (e) {}
      if (!a || dismissed === String(a.id)) { bar.hidden = true; return; }
      bar.className = "announce" + (a.style && a.style !== "gold" ? " announce--" + a.style : "");
      bar.innerHTML = "<span>" + esc(a.text) + "</span>" +
        (a.link_url && isSafeUrl(a.link_url) ? '<a href="' + esc(a.link_url) + '">' + esc(a.link_label || "Ver más") + " →</a>" : "") +
        '<button class="announce__close" type="button" aria-label="Cerrar aviso">×</button>';
      bar.hidden = false;
      bar.querySelector(".announce__close").addEventListener("click", function () {
        bar.hidden = true;
        try { sessionStorage.setItem("elessar_announce_closed", String(a.id)); } catch (e) {}
      });
    });
  }

  /* ---------- carrito lateral ---------- */
  var drawer, backdrop;
  function openCart() { if (!drawer) return; drawer.classList.add("is-open"); backdrop.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false"); document.body.classList.add("is-locked"); var c = $(".drawer__close", drawer); if (c) c.focus(); }
  function closeCart() { if (!drawer) return; drawer.classList.remove("is-open"); backdrop.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-locked"); }

  function qtyControl(item) {
    return '<div class="qty" data-variant="' + esc(item.variantId) + '">' +
      '<button type="button" data-qty="-1" aria-label="Restar">−</button>' +
      '<input type="number" min="1" value="' + item.qty + '" aria-label="Cantidad" readonly>' +
      '<button type="button" data-qty="1" aria-label="Sumar">+</button></div>';
  }

  function renderCart(state) {
    $$(".cart-count").forEach(function (el) {
      var prev = Number(el.textContent) || 0;
      el.textContent = state.count;
      el.classList.toggle("has-items", state.count > 0);
      if (state.count > prev) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
    });
    if (!drawer) return;
    var body = $(".drawer__body", drawer), foot = $(".drawer__foot", drawer);
    if (!state.items.length) {
      body.innerHTML = '<div class="cart-empty"><p>Tu carrito está vacío.<br>El merch te está esperando.</p><a class="btn btn--ghost btn--sm" href="tienda.html">Ir a la tienda</a></div>';
      foot.hidden = true;
      return;
    }
    foot.hidden = false;
    body.innerHTML = state.items.map(function (i) {
      return '<div class="cart-line">' +
        '<a href="producto.html?p=' + encodeURIComponent(i.slug) + '"><img src="' + esc(i.image) + '" alt="" loading="lazy"></a>' +
        '<div><div class="cart-line__name">' + esc(i.name) + '</div>' +
        (i.variantLabel ? '<div class="cart-line__var">' + esc(i.variantLabel) + "</div>" : '<div class="cart-line__var"></div>') +
        qtyControl(i) +
        '<div><button class="cart-line__remove" type="button" data-remove="' + esc(i.variantId) + '">Quitar</button></div></div>' +
        '<div class="price">' + money(i.price * i.qty) + "</div></div>";
    }).join("");
    $(".js-subtotal", foot).textContent = money(state.subtotal);
  }

  function initCart() {
    drawer = $("#cart-drawer"); backdrop = $("#cart-backdrop");
    $$("[data-open-cart]").forEach(function (b) { b.addEventListener("click", function (e) { e.preventDefault(); openCart(); }); });
    if (drawer) {
      $$(".drawer__close", drawer).forEach(function (b) { b.addEventListener("click", closeCart); });
      backdrop.addEventListener("click", closeCart);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCart(); });
      drawer.addEventListener("click", function (e) {
        var q = e.target.closest("[data-qty]");
        if (q) {
          var vid = q.parentNode.getAttribute("data-variant");
          var item = Cart.getState().items.filter(function (i) { return i.variantId === vid; })[0];
          if (item) {
            var next = item.qty + Number(q.getAttribute("data-qty"));
            if (item.maxStock != null && next > item.maxStock) toast("No hay más stock de esta variante.");
            Cart.setQty(vid, next);
          }
        }
        var r = e.target.closest("[data-remove]");
        if (r) Cart.remove(r.getAttribute("data-remove"));
      });
    }
    renderCart(Cart.getState());
    Cart.subscribe(renderCart);
  }

  /* ---------- redes sociales + datos de contacto del footer ---------- */
  function socialLinks(socials) {
    return Object.keys(SOCIAL_LABELS).filter(function (k) { return socials[k] && isSafeUrl(socials[k]); }).map(function (k) {
      return '<a href="' + esc(socials[k]) + '" target="_blank" rel="noopener" aria-label="' + SOCIAL_LABELS[k] + '">' + icon(k) + "</a>";
    }).join("");
  }
  function initFooter() {
    return API.getSettings().then(function (s) {
      $$("[data-socials]").forEach(function (el) { var html = socialLinks(s.socials || {}); if (html) el.innerHTML = html; });
      $$("[data-setting]").forEach(function (el) {
        var path = el.getAttribute("data-setting").split("."), v = s;
        path.forEach(function (p) { v = v ? v[p] : undefined; });
        if (v) el.textContent = v;
      });
      var demo = $("#demo-badge");
      if (demo) demo.hidden = API.mode === "live";
      var year = $("#year"); if (year) year.textContent = new Date().getFullYear();
    });
  }

  /* ---------- reveal con IntersectionObserver + red de seguridad ---------- */
  var io;
  function bindReveal(root) {
    var els = $$(".reveal:not(.is-visible)", root);
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-visible"); }); return; }
    io = io || new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }
  function initReveal() {
    bindReveal(document);
    setTimeout(function () { $$(".reveal:not(.is-visible)").forEach(function (el) { el.classList.add("is-visible"); }); }, 6000);
  }

  /* ---------- splash (solo home) con doble red de seguridad ---------- */
  function initSplash() {
    var s = $(".splash");
    if (!s) return;
    var hide = function () { s.classList.add("is-hidden"); };
    try { if (sessionStorage.getItem("elessar_splash")) { s.remove(); return; } sessionStorage.setItem("elessar_splash", "1"); } catch (e) {}
    window.addEventListener("load", function () { setTimeout(hide, 900); });
    setTimeout(hide, 2600);
  }

  /* ---------- luz que sigue al mouse (hero) ---------- */
  function initHeroLight() {
    var hero = $(".hero");
    if (!hero || matchMedia("(hover: none)").matches) return;
    var raf;
    hero.addEventListener("mousemove", function (e) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var r = hero.getBoundingClientRect();
        hero.style.setProperty("--mx", (e.clientX - r.left) + "px");
        hero.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---------- tilt suave en tarjetas (solo con mouse) ---------- */
  function bindTilt(root) {
    if (matchMedia("(hover: none)").matches) return;
    $$("[data-tilt]", root).forEach(function (card) {
      if (card.dataset.tiltBound) return;
      card.dataset.tiltBound = "1";
      var target = card.querySelector(".tilt") || card;
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        target.style.transform = "perspective(900px) rotateY(" + (x * 7) + "deg) rotateX(" + (-y * 7) + "deg)";
      });
      card.addEventListener("mouseout", function (e) { if (!card.contains(e.relatedTarget)) target.style.transform = ""; });
    });
  }

  /* ---------- fachada de YouTube (carga el iframe recién al hacer clic) ---------- */
  function ytEmbedUrl(media) {
    if (media.youtube_featured_video) return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(media.youtube_featured_video) + "?autoplay=1&rel=0";
    if (media.youtube_channel_id && /^UC/.test(media.youtube_channel_id)) {
      return "https://www.youtube-nocookie.com/embed/videoseries?list=UU" + encodeURIComponent(media.youtube_channel_id.slice(2)) + "&autoplay=1&rel=0";
    }
    return "";
  }
  function bindYouTube(root, media) {
    $$("[data-yt]", root).forEach(function (el) {
      if (el.dataset.ytBound) return;
      el.dataset.ytBound = "1";
      el.addEventListener("click", function () {
        var src = ytEmbedUrl(media || {});
        if (!src) return;
        el.parentNode.innerHTML = '<iframe src="' + src + '" title="Videos de Elessär en YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
      });
    });
  }

  /* ---------- lightbox para galerías ---------- */
  var lb, lbItems = [], lbIndex = 0;
  function lbShow(i) {
    lbIndex = (i + lbItems.length) % lbItems.length;
    var it = lbItems[lbIndex];
    $("img", lb).src = it.src; $("img", lb).alt = it.caption || "";
    $(".lightbox__caption", lb).textContent = it.caption || "";
  }
  function bindLightbox(root) {
    var buttons = $$("[data-lightbox]", root);
    if (!buttons.length) return;
    if (!lb) {
      lb = document.createElement("div");
      lb.className = "lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Galería");
      lb.innerHTML = '<img alt=""><div class="lightbox__caption"></div>' +
        '<button class="lightbox__close" type="button" aria-label="Cerrar">×</button>' +
        '<button class="lightbox__nav lightbox__nav--prev" type="button" aria-label="Anterior">‹</button>' +
        '<button class="lightbox__nav lightbox__nav--next" type="button" aria-label="Siguiente">›</button>';
      document.body.appendChild(lb);
      var close = function () { lb.classList.remove("is-open"); document.body.classList.remove("is-locked"); };
      $(".lightbox__close", lb).onclick = close;
      $(".lightbox__nav--prev", lb).onclick = function () { lbShow(lbIndex - 1); };
      $(".lightbox__nav--next", lb).onclick = function () { lbShow(lbIndex + 1); };
      lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
      document.addEventListener("keydown", function (e) {
        if (!lb.classList.contains("is-open")) return;
        if (e.key === "Escape") close();
        if (e.key === "ArrowLeft") lbShow(lbIndex - 1);
        if (e.key === "ArrowRight") lbShow(lbIndex + 1);
      });
    }
    lbItems = buttons.map(function (b) { return { src: b.getAttribute("data-lightbox"), caption: b.getAttribute("data-caption") }; });
    buttons.forEach(function (b, i) {
      b.addEventListener("click", function () { lbShow(i); lb.classList.add("is-open"); document.body.classList.add("is-locked"); });
    });
  }

  /* ---------- componentes reutilizables ---------- */
  var CATS = window.ELESSAR_CATEGORIES || {};
  function totalStock(p) { return p.variants.reduce(function (n, v) { return n + v.stock; }, 0); }

  function productCard(p) {
    var stock = totalStock(p);
    var badge = stock === 0 ? '<span class="chip chip--red product-card__badge">Agotado</span>'
      : (p.compare_at_price ? '<span class="chip chip--gold product-card__badge">Oferta</span>'
      : (stock <= 5 ? '<span class="chip product-card__badge">Últimas unidades</span>' : ""));
    var imgs = p.images.slice(0, 2).map(function (src, i) {
      return '<img src="' + esc(src) + '" alt="' + (i ? "" : esc(p.name)) + '" loading="lazy" decoding="async">';
    }).join("");
    return '<a class="product-card reveal" href="producto.html?p=' + encodeURIComponent(p.slug) + '" data-tilt>' +
      '<div class="product-card__media tilt">' + badge + imgs + "</div>" +
      '<div class="product-card__body"><span class="product-card__cat">' + esc(CATS[p.category] || p.category) + "</span>" +
      '<h3 class="product-card__name">' + esc(p.name) + "</h3>" +
      '<span class="price">' + money(p.price) + (p.compare_at_price ? "<s>" + money(p.compare_at_price) + "</s>" : "") + "</span></div></a>";
  }

  var STATUS = {
    on_sale: { label: "Entradas", chip: "" },
    soon: { label: "Próximamente", chip: "chip" },
    sold_out: { label: "Agotado", chip: "chip chip--red" },
    free: { label: "Entrada libre", chip: "chip chip--teal" },
    cancelled: { label: "Cancelado", chip: "chip chip--red" }
  };
  function showRow(s, past) {
    var d = dateParts(s.date), st = STATUS[s.status] || STATUS.on_sale;
    var action;
    if (past) action = '<span class="chip">Realizado</span>';
    else if (s.status === "on_sale" && s.ticket_url && isSafeUrl(s.ticket_url)) action = '<a class="btn btn--gold btn--sm" href="' + esc(s.ticket_url) + '" target="_blank" rel="noopener">Entradas</a>';
    else action = '<span class="' + (st.chip || "chip") + '">' + st.label + "</span>";
    var ics = past ? "" : '<button class="btn btn--ghost btn--sm" type="button" data-ics="' + esc(s.id) + '" title="Agregar al calendario">+ Calendario</button>';
    return '<li class="show reveal' + (past ? " show--past" : "") + '">' +
      '<div class="show__date"><span class="show__day">' + d.day + '</span><span class="show__month">' + esc(d.month) + '</span><span class="show__year">' + d.year + "</span></div>" +
      '<div><div class="show__city">' + esc(s.city) + (s.country && s.country !== "AR" ? " · " + esc(s.country) : "") + "</div>" +
      '<div class="show__venue">' + esc(s.venue) + (past ? "" : " — " + esc(d.weekday) + " " + d.time + " h") + "</div>" +
      (s.notes ? '<div class="small muted">' + esc(s.notes) + "</div>" : "") + "</div>" +
      '<div class="show__actions">' + ics + action + "</div></li>";
  }

  /** Descarga un .ics para agendar el show */
  function downloadIcs(s) {
    function f(d) { return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
    var start = new Date(s.date), end = new Date(start.getTime() + 3 * 3600 * 1000);
    var txt = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Elessar//Shows//ES", "BEGIN:VEVENT",
      "UID:" + s.id + "@elessarband.com", "DTSTAMP:" + f(new Date()), "DTSTART:" + f(start), "DTEND:" + f(end),
      "SUMMARY:Elessär en vivo — " + s.city, "LOCATION:" + (s.venue || "") + ", " + s.city,
      "DESCRIPTION:" + (s.ticket_url || "https://elessarband.com/fechas.html"), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/calendar" }));
    a.download = "elessar-" + s.city.toLowerCase().replace(/\s+/g, "-") + ".ics";
    document.body.appendChild(a); a.click(); a.remove();
  }
  function bindIcs(root, shows) {
    $$("[data-ics]", root).forEach(function (b) {
      if (b.dataset.icsBound) return; b.dataset.icsBound = "1";
      b.addEventListener("click", function () {
        var s = shows.filter(function (x) { return String(x.id) === b.getAttribute("data-ics"); })[0];
        if (s) downloadIcs(s);
      });
    });
  }

  /* ---------- arranque ---------- */
  window.Elessar = {
    safe: safe, $: $, $$: $$, esc: esc, money: money, dateParts: dateParts, param: param, isSafeUrl: isSafeUrl,
    icon: icon, toast: toast, openCart: openCart, closeCart: closeCart,
    bindReveal: bindReveal, bindTilt: bindTilt, bindYouTube: bindYouTube, bindLightbox: bindLightbox, bindIcs: bindIcs,
    productCard: productCard, showRow: showRow, totalStock: totalStock, socialLinks: socialLinks
  };

  function boot() {
    safe(initSplash, "splash");
    safe(initHeader, "header");
    safe(initAnnouncement, "announcement");
    safe(initCart, "cart");
    safe(initFooter, "footer");
    safe(initReveal, "reveal");
    safe(initHeroLight, "heroLight");
    safe(function () { bindTilt(document); }, "tilt");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
