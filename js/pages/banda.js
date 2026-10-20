/* ELESSÄR — Banda: historia, línea de tiempo, integrantes y galería */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$, esc = E.esc;

  API.getSettings().then(function (s) {
    var bio = s.bio || {};
    var long = Array.isArray(bio.long) ? bio.long : String(bio.long || "").split(/\n\s*\n/);
    var box = $("#bio-long");
    if (box && long.length && long[0]) box.innerHTML = long.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    var tl = $("#timeline");
    if (tl && bio.timeline) {
      tl.innerHTML = bio.timeline.map(function (t) {
        return '<li><div class="timeline__year">' + esc(t.year) + "</div><p>" + esc(t.text) + "</p></li>";
      }).join("");
    }
    var hero = document.querySelector(".page-hero__bg img");
    if (hero && bio.image) hero.src = bio.image;
  });

  API.getMembers().then(function (list) {
    var box = $("#members");
    if (!box) return;
    box.innerHTML = list.map(function (m, i) {
      return '<article class="member reveal reveal-d' + (i % 3) + '">' +
        '<div class="member__photo"><img src="' + esc(m.photo_url || "assets/img/logo-cathedral.webp") + '" alt="' + esc(m.name || m.role) + '" loading="lazy"></div>' +
        '<div class="member__role">' + esc(m.role) + "</div>" +
        (m.name ? '<h3 class="member__name">' + esc(m.name) + "</h3>" : "") +
        (m.bio ? '<p class="member__bio">' + esc(m.bio) + "</p>" : "") + "</article>";
    }).join("");
    E.bindReveal(box);
  });

  API.getGallery().then(function (list) {
    var box = $("#gallery");
    if (!box) return;
    box.innerHTML = list.map(function (g) {
      return '<button type="button" class="reveal" data-lightbox="' + esc(g.image_url) + '" data-caption="' + esc(g.caption || "") + '" aria-label="Ampliar foto">' +
        '<img src="' + esc(g.image_url) + '" alt="' + esc(g.caption || "Elessär") + '" loading="lazy" decoding="async"></button>';
    }).join("");
    E.bindReveal(box); E.bindLightbox(box);
  });
})();
