/* ELESSÄR — Música: discografía con reproductores (Bandcamp / Spotify / YouTube) */
(function () {
  "use strict";
  var E = window.Elessar, API = window.ElessarAPI;
  var $ = E.$, esc = E.esc;

  function bandcampEmbed(r) {
    if (!r.bandcamp_album_id || !/^\d+$/.test(String(r.bandcamp_album_id))) return "";
    var src = "https://bandcamp.com/EmbeddedPlayer/album=" + r.bandcamp_album_id +
      "/size=large/bgcol=0c0f14/linkcol=c4a877/artwork=none/tracklist=true/transparent=true/";
    return '<div class="embed embed--auto" style="margin-top:1.8rem;background:transparent">' +
      '<iframe title="' + esc(r.title) + ' en Bandcamp" style="border:0;width:100%;height:' + (140 + Math.min((r.tracks || []).length, 12) * 33) + 'px" src="' + src + '" seamless loading="lazy"></iframe></div>';
  }

  function release(r) {
    var tracks = (r.tracks || []).filter(Boolean);
    var btn = function (url, label, ic, cls) {
      return url && E.isSafeUrl(url) ? '<a class="btn ' + cls + ' btn--sm" href="' + esc(url) + '" target="_blank" rel="noopener">' + E.icon(ic) + label + "</a>" : "";
    };
    return '<article class="release" id="' + esc(r.slug) + '">' +
      '<div class="release__cover reveal"><div class="cover"><img src="' + esc(r.cover_url) + '" alt="Portada de ' + esc(r.title) + '" loading="lazy"></div></div>' +
      '<div class="release__info reveal reveal-d1">' +
      '<div class="release-meta" style="margin:0"><span class="chip chip--gold">' + esc(r.type) + '</span><span class="chip">' + esc(r.year) + "</span>" +
      (tracks.length > 1 ? '<span class="chip">' + tracks.length + " temas</span>" : "") + "</div>" +
      '<h2 class="h2">' + esc(r.title) + "</h2>" +
      '<p class="lead" style="margin-top:1rem">' + esc(r.description) + "</p>" +
      '<div class="platforms">' +
      btn(r.spotify_url, "Spotify", "spotify", "btn--gold") +
      btn(r.bandcamp_url, "Bandcamp", "bandcamp", "btn--ghost") +
      btn(r.youtube_url, "YouTube", "youtube", "btn--ghost") + "</div>" +
      (tracks.length > 1 ? '<ol class="tracklist">' + tracks.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol>" : "") +
      bandcampEmbed(r) + "</div></article>";
  }

  API.getReleases().then(function (list) {
    var box = $("#releases");
    if (!box) return;
    box.innerHTML = list.map(release).join('<hr class="divider">');
    E.bindReveal(box);
    if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView(); }, 50); }
  });

  API.getSettings().then(function (s) { E.bindYouTube(document, s.media); });
})();
