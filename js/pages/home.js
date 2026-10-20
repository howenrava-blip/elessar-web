/* ELESSÄR — Inicio: hero editable, lanzamiento destacado, shows, merch, bio */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$, esc = E.esc;

  /* Hero: textos, imagen y video desde Contenido → Hero */
  function initHero(s) {
    var h = s.hero || {};
    var set = function (sel, txt) { var el = $(sel); if (el && txt) el.textContent = txt; };
    set("[data-hero-tagline]", h.tagline);
    set("[data-hero-title]", h.title);
    var c1 = $("[data-hero-cta1]"), c2 = $("[data-hero-cta2]");
    if (c1 && h.cta_primary_label) { c1.textContent = h.cta_primary_label; if (E.isSafeUrl(h.cta_primary_url)) c1.href = h.cta_primary_url; }
    if (c2 && h.cta_secondary_label) { c2.textContent = h.cta_secondary_label; if (E.isSafeUrl(h.cta_secondary_url)) c2.href = h.cta_secondary_url; }
    var img = $("[data-hero-image]");
    if (img && h.image && img.getAttribute("src") !== h.image) img.src = h.image;

    // Video de fondo: solo en conexiones razonables y sin "ahorro de datos"
    var video = $("[data-hero-video]");
    var conn = navigator.connection || {};
    if (video && h.video && !conn.saveData && !/2g/.test(conn.effectiveType || "")) {
      video.src = h.video;
      if (h.image) video.poster = h.image;
      video.addEventListener("playing", function () { video.classList.add("is-playing"); });
      var p = video.play(); if (p && p.catch) p.catch(function () { /* autoplay bloqueado: queda la imagen */ });
    }
  }

  function initFeatured(s) {
    var slug = (s.media || {}).featured_release_slug;
    return API.getReleases().then(function (list) {
      var r = list.filter(function (x) { return x.slug === slug; })[0] || list[0];
      var box = $("#featured-release");
      if (!r || !box) return;
      var words = r.title.split(" ");
      var last = words.pop();
      var title = (words.length ? esc(words.join(" ")) + " " : "") + "<em>" + esc(last) + "</em>";
      box.innerHTML =
        '<div class="cover cover--vinyl reveal"><img src="' + esc(r.cover_url) + '" alt="Portada de ' + esc(r.title) + '" loading="lazy"></div>' +
        '<div class="reveal reveal-d1"><span class="kicker">Lanzamiento destacado</span>' +
        '<h2 class="display" style="margin-top:.8rem">' + title + "</h2>" +
        '<div class="release-meta"><span class="chip chip--gold">' + esc(r.type) + '</span><span class="chip">' + esc(r.year) + "</span></div>" +
        '<p class="lead">' + esc(r.description) + "</p>" +
        '<div class="platforms">' +
        (r.spotify_url ? '<a class="btn btn--gold" href="' + esc(r.spotify_url) + '" target="_blank" rel="noopener">' + E.icon("spotify") + "Spotify</a>" : "") +
        (r.youtube_url ? '<a class="btn btn--ghost" href="' + esc(r.youtube_url) + '" target="_blank" rel="noopener">' + E.icon("youtube") + "YouTube</a>" : "") +
        '<a class="btn btn--ghost" href="musica.html#' + esc(r.slug) + '">Más info</a></div></div>';
      E.bindReveal(box);
    });
  }

  function initShows() {
    return API.getShows().then(function (data) {
      var ul = $("#home-shows");
      if (!ul) return;
      var list = data.upcoming.slice(0, 3);
      if (!list.length) {
        ul.innerHTML = '<li class="shows-empty"><span class="kicker">Pronto</span><p>Estamos preparando nuevas fechas. Seguinos en redes para enterarte primero.</p><a class="btn btn--ghost btn--sm" href="fechas.html">Ver fechas anteriores</a></li>';
        return;
      }
      ul.innerHTML = list.map(function (s) { return E.showRow(s, false); }).join("");
      E.bindReveal(ul); E.bindIcs(ul, list);
    });
  }

  function initProducts() {
    return API.getProducts().then(function (list) {
      var box = $("#home-products");
      if (!box) return;
      var featured = list.filter(function (p) { return p.featured; });
      if (featured.length < 3) featured = list;
      box.innerHTML = featured.slice(0, 3).map(E.productCard).join("");
      E.bindReveal(box); E.bindTilt(box);
    });
  }

  function initBio(s) {
    var el = $("#home-bio");
    if (el && s.bio && s.bio.short) el.innerHTML = "<p>" + esc(s.bio.short) + "</p>";
  }

  API.getSettings().then(function (s) {
    E.safe(function () { initHero(s); }, "home.hero");
    E.safe(function () { return initFeatured(s); }, "home.featured");
    E.safe(function () { initBio(s); }, "home.bio");
    E.safe(function () { E.bindYouTube(document, s.media); }, "home.yt");
    var sp = $("#spotify-embed iframe"), id = (s.media || {}).spotify_artist_id;
    if (sp && id && sp.src.indexOf(id) < 0) sp.src = "https://open.spotify.com/embed/artist/" + encodeURIComponent(id) + "?utm_source=generator&theme=0";
  });
  E.safe(initShows, "home.shows");
  E.safe(initProducts, "home.products");
})();
