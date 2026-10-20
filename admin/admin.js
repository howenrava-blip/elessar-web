/* ==========================================================================
   ELESSÄR — Panel de administración (CMS)
   --------------------------------------------------------------------------
   Secciones: Resumen · Avisos · Contenido · Fechas · Tienda · Pedidos ·
              Mensajes · Discografía · Integrantes · Galería

   Arquitectura:
   - DB: capa de datos con dos implementaciones
       · SupabaseDB → producción (auth + tablas + storage)
       · DemoDB     → demostración en memoria (no guarda nada)
   - ENTITIES: describe cada tabla (columnas + campos del formulario).
     El CRUD genérico arma listas y formularios a partir de eso, así que
     agregar un campo nuevo = agregar una línea acá + la columna en SQL.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ELESSAR_CONFIG || {};
  var DEF = window.ELESSAR_DEFAULTS || {};
  var CATS = window.ELESSAR_CATEGORIES || {};
  var CONFIGURED = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

  /* =======================================================================
     HELPERS
     ======================================================================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function money(n) { try { return new Intl.NumberFormat("es-AR", { style: "currency", currency: CFG.CURRENCY || "ARS", maximumFractionDigits: 0 }).format(n || 0); } catch (e) { return "$" + n; } }
  function fmtDate(iso, withTime) {
    if (!iso) return "—";
    var o = { day: "2-digit", month: "short", year: "numeric" };
    if (withTime) { o.hour = "2-digit"; o.minute = "2-digit"; }
    return new Intl.DateTimeFormat("es-AR", o).format(new Date(iso));
  }
  function toLocalInput(iso) {
    if (!iso) return "";
    var d = new Date(iso), p = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function slugify(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  }
  /** Las rutas relativas de imágenes son relativas al sitio, no a /admin */
  function resolveUrl(u) { if (!u) return ""; return /^(https?:|blob:|data:|\/)/.test(u) ? u : "../" + u; }

  var toastEl, toastT;
  function toast(msg, isErr) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.toggle("is-err", !!isErr);
    requestAnimationFrame(function () { toastEl.classList.add("is-show"); });
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("is-show"); }, isErr ? 6000 : 2800);
  }
  function errMsg(e) {
    var m = (e && (e.message || e.error_description)) || String(e);
    if (/row-level security|permission denied/i.test(m)) return "Sin permiso: tu usuario no es administrador.";
    if (/duplicate key.*slug/i.test(m)) return "Ya existe otro elemento con ese identificador (slug).";
    if (/Invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
    return m;
  }

  /** Modal genérico. Devuelve { el, close } */
  function modal(title, bodyHTML, footHTML, size) {
    var back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = '<div class="modal' + (size ? " modal--" + size : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal__head"><h2>' + esc(title) + '</h2><button class="x" type="button" aria-label="Cerrar">×</button></div>' +
      '<div class="modal__body">' + bodyHTML + "</div>" + (footHTML ? '<div class="modal__foot">' + footHTML + "</div>" : "") + "</div>";
    document.body.appendChild(back);
    document.body.style.overflow = "hidden";
    function close() { back.remove(); document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    $(".x", back).onclick = close;
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
    return { el: back, close: close };
  }
  function confirmBox(text, okLabel) {
    return new Promise(function (resolve) {
      var m = modal("Confirmar", "<p>" + esc(text) + "</p>",
        '<button class="btn btn--ghost" data-no>Cancelar</button><button class="btn btn--danger" data-yes>' + esc(okLabel || "Eliminar") + "</button>", "sm");
      $("[data-no]", m.el).onclick = function () { m.close(); resolve(false); };
      $("[data-yes]", m.el).onclick = function () { m.close(); resolve(true); };
    });
  }

  /** Reduce fotos pesadas antes de subirlas (máx 2000px, WebP) */
  function compressImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpe?g|png|webp)$/.test(file.type) || file.size < 350 * 1024) return resolve(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (blob) {
          URL.revokeObjectURL(url);
          if (!blob || blob.size >= file.size) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" }));
        }, "image/webp", 0.86);
      };
      img.onerror = function () { resolve(file); };
      img.src = url;
    });
  }

  /* =======================================================================
     CAPA DE DATOS
     ======================================================================= */
  function SupabaseDB() {
    var c = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    function q(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
    return {
      demo: false,
      list: function (t, o) {
        o = o || {};
        var b = c.from(t).select(o.select || "*");
        if (o.eq) Object.keys(o.eq).forEach(function (k) { b = b.eq(k, o.eq[k]); });
        if (o.order) b = b.order(o.order, { ascending: o.asc !== false });
        if (o.limit) b = b.limit(o.limit);
        return q(b);
      },
      insert: function (t, row) { return q(c.from(t).insert(row).select().single()); },
      update: function (t, id, patch, key) { return q(c.from(t).update(patch).eq(key || "id", id).select().single()); },
      remove: function (t, id) { return q(c.from(t).delete().eq("id", id)); },
      upsert: function (t, row, onConflict) { return q(c.from(t).upsert(row, { onConflict: onConflict }).select()); },
      upload: function (file, folder) {
        return compressImage(file).then(function (f) {
          var ext = (f.name.match(/\.(\w+)$/) || [, "bin"])[1].toLowerCase();
          var path = (folder || "uploads") + "/" + Date.now() + "-" + slugify(f.name.replace(/\.\w+$/, "")).slice(0, 40) + "." + ext;
          return c.storage.from("media").upload(path, f, { cacheControl: "31536000", upsert: false, contentType: f.type })
            .then(function (r) { if (r.error) throw r.error; return c.storage.from("media").getPublicUrl(path).data.publicUrl; });
        });
      },
      auth: {
        session: function () { return c.auth.getSession().then(function (r) { return r.data.session; }); },
        signIn: function (email, password) { return c.auth.signInWithPassword({ email: email, password: password }).then(function (r) { if (r.error) throw r.error; return r.data.session; }); },
        signOut: function () { return c.auth.signOut(); },
        reset: function (email) { return c.auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] }).then(function (r) { if (r.error) throw r.error; }); },
        updatePassword: function (pw) { return c.auth.updateUser({ password: pw }).then(function (r) { if (r.error) throw r.error; }); },
        isAdmin: function () { return q(c.rpc("is_admin")); },
        onChange: function (fn) { c.auth.onAuthStateChange(function (ev, session) { fn(ev, session); }); }
      }
    };
  }

  /** Base de datos de demostración en memoria, con la misma API */
  function DemoDB() {
    var T = {
      settings: Object.keys(DEF.settings || {}).map(function (k) { return { key: k, value: clone(DEF.settings[k]) }; }),
      announcements: clone(DEF.announcements || []),
      members: clone(DEF.members || []),
      releases: clone(DEF.releases || []),
      shows: clone(DEF.shows || []),
      gallery: clone(DEF.gallery || []),
      products: [], product_variants: [],
      orders: [
        { id: "demo-o1", created_at: new Date(Date.now() - 864e5).toISOString(), status: "paid", provider: "mercadopago", provider_ref: "123456789", currency: "ARS",
          customer: { name: "Cliente de ejemplo", email: "cliente@ejemplo.com", phone: "299 555-0000", address: "Av. Argentina 100", city: "Neuquén", province: "Neuquén", zip: "8300" },
          items: [{ name: "Remera Kósmos", variant_label: "Negro · M", qty: 1, unit_price: 25000 }, { name: "CD Kósmos", variant_label: "", qty: 1, unit_price: 15000 }],
          shipping: { id: "national", label: "Envío a todo el país", cost: 6500 }, subtotal: 40000, shipping_cost: 6500, total: 46500 },
        { id: "demo-o2", created_at: new Date(Date.now() - 36e5).toISOString(), status: "pending", provider: "mercadopago", currency: "ARS",
          customer: { name: "Otra persona", email: "otra@ejemplo.com" },
          items: [{ name: "Remera Dark Desires", variant_label: "Negro · L", qty: 2, unit_price: 25000 }],
          shipping: { id: "pickup", label: "Retiro en Neuquén capital", cost: 0 }, subtotal: 50000, shipping_cost: 0, total: 50000 }
      ],
      messages: [
        { id: "demo-m1", created_at: new Date(Date.now() - 72e5).toISOString(), name: "Productora Patagonia Metal", email: "booking@ejemplo.com", subject: "booking", body: "Hola! Queremos invitarlos a tocar en un festival en marzo. ¿Nos pasan condiciones?", read: false }
      ]
    };
    (DEF.products || []).forEach(function (p) {
      var row = clone(p); delete row.variants; T.products.push(row);
      (p.variants || []).forEach(function (v, i) { var vv = clone(v); vv.product_id = p.id; vv.sort = i; T.product_variants.push(vv); });
    });
    function rid() { return "demo-" + Math.random().toString(36).slice(2, 10); }
    function delay(v) { return new Promise(function (r) { setTimeout(function () { r(clone(v)); }, 120); }); }
    return {
      demo: true,
      list: function (t, o) {
        o = o || {};
        var rows = (T[t] || []).slice();
        if (o.eq) rows = rows.filter(function (r) { return Object.keys(o.eq).every(function (k) { return r[k] === o.eq[k]; }); });
        if (o.select && o.select.indexOf("product_variants") > -1) {
          rows = rows.map(function (p) { var x = Object.assign({}, p); x.product_variants = T.product_variants.filter(function (v) { return v.product_id === p.id; }); return x; });
        }
        if (o.order) rows.sort(function (a, b) { var x = a[o.order], y = b[o.order]; var r = x > y ? 1 : x < y ? -1 : 0; return o.asc === false ? -r : r; });
        if (o.limit) rows = rows.slice(0, o.limit);
        return delay(rows);
      },
      insert: function (t, row) { var r = Object.assign({ id: rid(), created_at: new Date().toISOString() }, row); (T[t] = T[t] || []).push(r); return delay(r); },
      update: function (t, id, patch, key) { var r = (T[t] || []).filter(function (x) { return x[key || "id"] === id; })[0]; Object.assign(r, patch); return delay(r); },
      remove: function (t, id) { T[t] = (T[t] || []).filter(function (x) { return x.id !== id; }); return delay(null); },
      upsert: function (t, row, k) {
        (Array.isArray(row) ? row : [row]).forEach(function (r) {
          var cur = (T[t] || []).filter(function (x) { return x[k] === r[k]; })[0];
          if (cur) Object.assign(cur, r); else T[t].push(r);
        });
        return delay(row);
      },
      upload: function (file) { return delay(URL.createObjectURL(file)); },
      auth: {
        session: function () { return Promise.resolve({ user: { email: "demo@elessar" } }); },
        signIn: function () { return Promise.resolve({ user: { email: "demo@elessar" } }); },
        signOut: function () { location.href = "../index.html"; return Promise.resolve(); },
        reset: function () { return Promise.resolve(); },
        updatePassword: function () { return Promise.resolve(); },
        isAdmin: function () { return Promise.resolve(true); },
        onChange: function () {}
      }
    };
  }

  var DB;

  /* =======================================================================
     DEFINICIÓN DE ENTIDADES (tablas editables)
     ======================================================================= */
  var STATUS_SHOW = { on_sale: "Entradas a la venta", soon: "Próximamente", sold_out: "Agotado", free: "Entrada libre", cancelled: "Cancelado" };
  var STYLE_ANN = { gold: "Dorado", teal: "Cian (Kósmos)", blood: "Rojo" };

  var ENTITIES = {
    announcements: {
      title: "Avisos", subtitle: "Barra destacada arriba de todo el sitio.", table: "announcements", order: "sort", singular: "aviso",
      help: "Se muestra el primer aviso <b>activo</b> (el de menor «orden») y dentro de sus fechas de vigencia. Ej.: «¡Nuevo disco ya disponible!».",
      columns: [
        { k: "text", label: "Texto" },
        { k: "style", label: "Color", render: function (r) { return '<span class="pill pill--' + (r.style === "teal" ? "teal" : r.style === "blood" ? "red" : "gold") + '">' + esc(STYLE_ANN[r.style] || r.style) + "</span>"; } },
        { k: "starts_at", label: "Vigencia", render: function (r) { return r.starts_at || r.ends_at ? fmtDate(r.starts_at) + " → " + fmtDate(r.ends_at) : '<span class="muted">Siempre</span>'; } },
        { k: "active", label: "Activo", toggle: true }
      ],
      fields: [
        { k: "text", label: "Texto del aviso", type: "text", required: true, max: 220 },
        { k: "link_url", label: "Enlace (opcional)", type: "text", help: "Ej.: musica.html, tienda.html o una URL completa" },
        { k: "link_label", label: "Texto del enlace", type: "text", placeholder: "Escuchar" },
        { k: "style", label: "Color", type: "select", options: STYLE_ANN, def: "gold" },
        { k: "starts_at", label: "Mostrar desde (opcional)", type: "datetime" },
        { k: "ends_at", label: "Mostrar hasta (opcional)", type: "datetime" },
        { k: "sort", label: "Orden", type: "int", def: 0 },
        { k: "active", label: "Activo", type: "bool", def: true }
      ]
    },

    shows: {
      title: "Fechas", subtitle: "Conciertos y entradas.", table: "shows", order: "date", asc: false, singular: "fecha",
      columns: [
        { k: "date", label: "Fecha", render: function (r) { var past = new Date(r.date) < new Date(); return fmtDate(r.date, true) + (past ? ' <span class="pill">Pasada</span>' : ""); } },
        { k: "city", label: "Ciudad" },
        { k: "venue", label: "Lugar" },
        { k: "status", label: "Estado", render: function (r) { return '<span class="pill' + (r.status === "on_sale" ? " pill--green" : r.status === "sold_out" || r.status === "cancelled" ? " pill--red" : "") + '">' + esc(STATUS_SHOW[r.status] || r.status) + "</span>"; } },
        { k: "published", label: "Visible", toggle: true }
      ],
      fields: [
        { k: "date", label: "Fecha y hora", type: "datetime", required: true },
        { k: "city", label: "Ciudad", type: "text", required: true },
        { k: "venue", label: "Lugar / sala", type: "text" },
        { k: "country", label: "País (código)", type: "text", def: "AR", help: "AR, CL, UY… (no se muestra si es AR)" },
        { k: "status", label: "Estado", type: "select", options: STATUS_SHOW, def: "on_sale" },
        { k: "ticket_url", label: "Link de entradas", type: "text", placeholder: "https://…" },
        { k: "notes", label: "Notas (opcional)", type: "text", placeholder: "Junto a…, entrada libre, +18…" },
        { k: "published", label: "Visible en el sitio", type: "bool", def: true }
      ]
    },

    releases: {
      title: "Discografía", subtitle: "Discos y singles con sus reproductores.", table: "releases", order: "sort", singular: "lanzamiento",
      columns: [
        { k: "cover_url", label: "", img: true },
        { k: "title", label: "Título" },
        { k: "type", label: "Tipo" },
        { k: "year", label: "Año" },
        { k: "published", label: "Visible", toggle: true }
      ],
      fields: [
        { k: "title", label: "Título", type: "text", required: true },
        { k: "slug", label: "Identificador (slug)", type: "slug", from: "title", help: "Se usa en la URL. Se completa solo." },
        { k: "type", label: "Tipo", type: "select", options: { "Álbum": "Álbum", "EP": "EP", "Single": "Single", "En vivo": "En vivo", "Compilado": "Compilado" }, def: "Álbum" },
        { k: "year", label: "Año", type: "int" },
        { k: "cover_url", label: "Portada (cuadrada)", type: "image", folder: "covers" },
        { k: "description", label: "Descripción", type: "textarea" },
        { k: "tracks", label: "Lista de temas", type: "list", help: "Un tema por línea" },
        { k: "spotify_url", label: "Link de Spotify", type: "text" },
        { k: "bandcamp_url", label: "Link de Bandcamp", type: "text" },
        { k: "bandcamp_album_id", label: "ID de álbum de Bandcamp (para el reproductor)", type: "text", help: "En Bandcamp: Share/Embed → el número que aparece en «album=XXXXXXXX»" },
        { k: "youtube_url", label: "Link de YouTube", type: "text" },
        { k: "sort", label: "Orden (1 = primero)", type: "int", def: 0 },
        { k: "published", label: "Visible", type: "bool", def: true }
      ]
    },

    members: {
      title: "Integrantes", subtitle: "Formación actual de la banda.", table: "members", order: "sort", singular: "integrante",
      columns: [
        { k: "photo_url", label: "", img: true },
        { k: "role", label: "Rol" },
        { k: "name", label: "Nombre", render: function (r) { return r.name ? esc(r.name) : '<span class="muted">— completar —</span>'; } },
        { k: "active", label: "Visible", toggle: true }
      ],
      fields: [
        { k: "name", label: "Nombre", type: "text" },
        { k: "role", label: "Rol / instrumento", type: "text", required: true },
        { k: "photo_url", label: "Foto (vertical)", type: "image", folder: "members" },
        { k: "bio", label: "Mini bio (opcional)", type: "textarea" },
        { k: "sort", label: "Orden", type: "int", def: 0 },
        { k: "active", label: "Visible", type: "bool", def: true }
      ]
    },

    gallery: {
      title: "Galería", subtitle: "Fotos oficiales de la página Banda.", table: "gallery", order: "sort", singular: "foto",
      columns: [
        { k: "image_url", label: "", img: true },
        { k: "caption", label: "Epígrafe" },
        { k: "sort", label: "Orden" }
      ],
      fields: [
        { k: "image_url", label: "Foto", type: "image", required: true, folder: "gallery" },
        { k: "caption", label: "Epígrafe", type: "text" },
        { k: "sort", label: "Orden", type: "int", def: 0 }
      ]
    },

    products: {
      title: "Tienda", subtitle: "Productos, precios, fotos, talles y stock.", table: "products", order: "sort", singular: "producto",
      select: "*, product_variants(*)",
      help: "Cada producto tiene <b>variantes</b> (talle/color) con su propio stock. Un CD o un parche tiene una sola variante sin talle. El stock se descuenta solo cuando un pago se aprueba.",
      columns: [
        { k: "images", label: "", img: true, render: function (r) { var src = (r.images || [])[0]; return src ? '<img class="thumb" src="' + esc(resolveUrl(src)) + '" alt="">' : ""; } },
        { k: "name", label: "Producto", render: function (r) { return "<b>" + esc(r.name) + '</b><br><span class="small muted">' + esc(CATS[r.category] || r.category) + "</span>"; } },
        { k: "price", label: "Precio", render: function (r) { return money(r.price); } },
        { k: "stock", label: "Stock", render: function (r) {
          var vs = r.product_variants || [], total = vs.reduce(function (n, v) { return n + (v.stock || 0); }, 0);
          var low = vs.filter(function (v) { return v.stock <= 3; }).length;
          return '<span class="pill ' + (total === 0 ? "pill--red" : low ? "pill--gold" : "pill--green") + '">' + total + " u.</span>" + (vs.length > 1 ? ' <span class="small muted">' + vs.length + " var.</span>" : "");
        } },
        { k: "featured", label: "Destacado", toggle: true },
        { k: "active", label: "Visible", toggle: true }
      ],
      fields: [
        { k: "name", label: "Nombre", type: "text", required: true },
        { k: "slug", label: "Identificador (slug)", type: "slug", from: "name", help: "Se usa en la URL del producto. Se completa solo." },
        { k: "category", label: "Categoría", type: "select", options: CATS, def: "remeras" },
        { k: "price", label: "Precio", type: "money", required: true },
        { k: "compare_at_price", label: "Precio anterior (tachado, opcional)", type: "money" },
        { k: "description", label: "Descripción", type: "textarea" },
        { k: "images", label: "Fotos (la primera es la principal)", type: "images", folder: "products" },
        { k: "variants", label: "Variantes y stock", type: "variants" },
        { k: "featured", label: "Destacado en la Home", type: "bool", def: false },
        { k: "active", label: "Visible en la tienda", type: "bool", def: true },
        { k: "sort", label: "Orden", type: "int", def: 0 }
      ]
    }
  };

  /* =======================================================================
     CAMPOS DE FORMULARIO
     ======================================================================= */
  function fieldHTML(f, val) {
    var id = "f_" + f.k, req = f.required ? " required" : "", ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";
    var help = f.help ? "<small>" + f.help + "</small>" : "";
    var lab = '<label for="' + id + '">' + esc(f.label) + (f.required ? " *" : "") + "</label>";
    var inner;
    switch (f.type) {
      case "textarea": inner = lab + '<textarea class="textarea" id="' + id + '"' + req + ph + ">" + esc(val || "") + "</textarea>"; break;
      case "list": inner = lab + '<textarea class="textarea" id="' + id + '">' + esc((val || []).join("\n")) + "</textarea>"; break;
      case "paragraphs": inner = lab + '<textarea class="textarea" id="' + id + '" style="min-height:220px">' + esc(Array.isArray(val) ? val.join("\n\n") : (val || "")) + "</textarea>"; help = help || "<small>Separá los párrafos con una línea en blanco.</small>"; break;
      case "timeline": inner = lab + '<textarea class="textarea" id="' + id + '">' + esc((val || []).map(function (t) { return t.year + " | " + t.text; }).join("\n")) + "</textarea>"; help = help || "<small>Una línea por hito, con el formato: <code>2013 | Texto del hito</code></small>"; break;
      case "int": case "money": inner = lab + '<input class="input" id="' + id + '" type="number" step="' + (f.type === "money" ? "0.01" : "1") + '" min="0" value="' + (val == null ? "" : esc(val)) + '"' + req + ph + ">"; break;
      case "datetime": inner = lab + '<input class="input" id="' + id + '" type="datetime-local" value="' + esc(toLocalInput(val)) + '"' + req + ">"; break;
      case "select": inner = lab + '<select class="select" id="' + id + '">' + Object.keys(f.options).map(function (k) { return '<option value="' + esc(k) + '"' + (String(val) === k ? " selected" : "") + ">" + esc(f.options[k]) + "</option>"; }).join("") + "</select>"; break;
      case "bool": inner = '<label class="switch"><input type="checkbox" id="' + id + '"' + (val ? " checked" : "") + "> " + esc(f.label) + "</label>"; break;
      case "image": case "file":
        inner = lab + '<div class="img-field">' + (f.type === "image" ? '<div class="img-field__preview" data-prev></div>' : "") +
          '<div class="img-field__side"><div class="drop" data-drop tabindex="0">Arrastrá un archivo o hacé clic para subir</div>' +
          '<input class="input" data-url placeholder="o pegá una URL / ruta" value="' + esc(val || "") + '">' +
          '<input type="file" hidden accept="' + esc(f.accept || (f.type === "image" ? "image/*" : "*/*")) + '"></div></div>';
        break;
      case "images":
        inner = '<span class="label">' + esc(f.label) + '</span><div class="gallery-edit" data-gal></div>' +
          '<div class="drop" data-drop tabindex="0">Arrastrá fotos o hacé clic para subir (podés elegir varias)</div>' +
          '<input type="file" hidden accept="image/*" multiple>' +
          '<div style="display:flex;gap:8px;margin-top:8px"><input class="input" data-addurl placeholder="o pegá la URL de una imagen"><button type="button" class="btn btn--sm" data-addbtn>Agregar</button></div>';
        break;
      case "variants":
        inner = '<span class="label">' + esc(f.label) + '</span><div class="rows" data-rows></div>' +
          '<div class="btn-row"><button type="button" class="btn btn--sm" data-addrow>+ Agregar variante</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-sizes>Generar talles S a XXL</button></div>';
        help = "<small>Talle y color son opcionales. «Precio especial» reemplaza al precio base solo para esa variante (ej.: lámina A2).</small>";
        break;
      case "shipping":
        inner = '<span class="label">' + esc(f.label) + '</span><div class="rows" data-rows></div><div class="btn-row"><button type="button" class="btn btn--sm" data-addrow>+ Agregar opción de envío</button></div>';
        help = "<small>Usá el ID <code>pickup</code> para «retiro» (no pide dirección).</small>";
        break;
      case "slug": inner = lab + '<input class="input" id="' + id + '" value="' + esc(val || "") + '" pattern="[a-z0-9-]+">'; break;
      default: inner = lab + '<input class="input" id="' + id + '" value="' + esc(val == null ? "" : val) + '"' + req + ph + (f.max ? ' maxlength="' + f.max + '"' : "") + ">";
    }
    return '<div class="field" data-k="' + f.k + '" data-type="' + (f.type || "text") + '">' + inner + help + "</div>";
  }

  /** Activa los campos interactivos (subidas, galerías, filas) */
  function bindField(f, wrap, val) {
    var t = f.type;
    if (t === "image" || t === "file") {
      var urlIn = $("[data-url]", wrap), fileIn = $("input[type=file]", wrap), drop = $("[data-drop]", wrap), prev = $("[data-prev]", wrap);
      var paint = function () { if (prev) { prev.style.backgroundImage = urlIn.value ? "url('" + resolveUrl(urlIn.value).replace(/'/g, "%27") + "')" : ""; prev.textContent = urlIn.value ? "" : "Sin imagen"; } };
      var up = function (file) {
        if (!file) return;
        drop.classList.add("uploading"); drop.textContent = "Subiendo…";
        DB.upload(file, f.folder).then(function (u) { urlIn.value = u; paint(); toast("Archivo subido"); })
          .catch(function (e) { toast("No se pudo subir: " + errMsg(e), true); })
          .then(function () { drop.classList.remove("uploading"); drop.textContent = "Arrastrá un archivo o hacé clic para subir"; });
      };
      drop.onclick = function () { fileIn.click(); };
      drop.onkeydown = function (e) { if (e.key === "Enter") fileIn.click(); };
      fileIn.onchange = function () { up(fileIn.files[0]); fileIn.value = ""; };
      dnd(drop, function (files) { up(files[0]); });
      urlIn.oninput = paint; paint();
    }
    if (t === "images") {
      wrap._value = (val || []).slice();
      var gal = $("[data-gal]", wrap), fileM = $("input[type=file]", wrap), dropM = $("[data-drop]", wrap);
      var render = function () {
        gal.innerHTML = wrap._value.map(function (u, i) {
          return '<figure><img src="' + esc(resolveUrl(u)) + '" alt=""><div class="tools">' +
            '<button type="button" data-mv="' + i + '|-1" title="Mover a la izquierda">←</button>' +
            '<button type="button" data-rm="' + i + '" title="Quitar">×</button>' +
            '<button type="button" data-mv="' + i + '|1" title="Mover a la derecha">→</button></div></figure>';
        }).join("") || '<p class="small muted">Todavía no hay fotos.</p>';
      };
      gal.onclick = function (e) {
        var b = e.target.closest("button"); if (!b) return;
        if (b.dataset.rm != null) wrap._value.splice(+b.dataset.rm, 1);
        if (b.dataset.mv) { var p = b.dataset.mv.split("|"), i = +p[0], j = i + (+p[1]); if (j >= 0 && j < wrap._value.length) { var x = wrap._value[i]; wrap._value[i] = wrap._value[j]; wrap._value[j] = x; } }
        render();
      };
      var upMany = function (files) {
        dropM.classList.add("uploading"); dropM.textContent = "Subiendo " + files.length + " archivo(s)…";
        Promise.all(Array.prototype.map.call(files, function (fl) { return DB.upload(fl, f.folder); }))
          .then(function (urls) { wrap._value = wrap._value.concat(urls); render(); toast("Fotos subidas"); })
          .catch(function (e) { toast("No se pudo subir: " + errMsg(e), true); })
          .then(function () { dropM.classList.remove("uploading"); dropM.textContent = "Arrastrá fotos o hacé clic para subir (podés elegir varias)"; });
      };
      dropM.onclick = function () { fileM.click(); };
      fileM.onchange = function () { if (fileM.files.length) upMany(fileM.files); fileM.value = ""; };
      dnd(dropM, upMany);
      $("[data-addbtn]", wrap).onclick = function () { var u = $("[data-addurl]", wrap); if (u.value.trim()) { wrap._value.push(u.value.trim()); u.value = ""; render(); } };
      render();
    }
    if (t === "variants" || t === "shipping") {
      wrap._value = clone(val || []);
      var rows = $("[data-rows]", wrap);
      var defs = t === "variants"
        ? [["size", "Talle / formato", "text"], ["color", "Color", "text"], ["color_hex", "Hex", "color"], ["stock", "Stock", "number"], ["price_override", "Precio especial", "number"], ["sku", "SKU", "text"]]
        : [["id", "ID", "text"], ["label", "Nombre", "text"], ["description", "Detalle", "text"], ["price", "Costo", "number"]];
      var renderRows = function () {
        rows.innerHTML = wrap._value.map(function (r, i) {
          return '<div class="row-edit row-edit--' + (t === "variants" ? "variant" : "ship") + '">' + defs.map(function (d) {
            var v = r[d[0]];
            if (d[2] === "color") v = v || "#0b0b0c";
            return "<label>" + d[1] + '<input class="input" data-i="' + i + '" data-f="' + d[0] + '" type="' + d[2] + '" value="' + esc(v == null ? "" : v) + '"' + (d[2] === "number" ? ' min="0"' : "") + "></label>";
          }).join("") + '<button type="button" class="btn btn--sm btn--danger del" data-del="' + i + '" title="Quitar">×</button></div>';
        }).join("") || '<p class="small muted">Sin ' + (t === "variants" ? "variantes: agregá al menos una para poder vender." : "opciones.") + "</p>";
      };
      rows.oninput = function (e) {
        var inp = e.target.closest("[data-f]"); if (!inp) return;
        var row = wrap._value[+inp.dataset.i], key = inp.dataset.f;
        row[key] = inp.type === "number" ? (inp.value === "" ? null : Number(inp.value)) : inp.value;
      };
      rows.onclick = function (e) { var b = e.target.closest("[data-del]"); if (b) { wrap._value.splice(+b.dataset.del, 1); renderRows(); } };
      $("[data-addrow]", wrap).onclick = function () {
        wrap._value.push(t === "variants" ? { size: "", color: "", color_hex: "#0b0b0c", stock: 0, price_override: null, sku: "" } : { id: "", label: "", description: "", price: 0 });
        renderRows();
      };
      var gen = $("[data-sizes]", wrap);
      if (gen) gen.onclick = function () {
        var color = (wrap._value[0] && wrap._value[0].color) || "Negro", hex = (wrap._value[0] && wrap._value[0].color_hex) || "#0b0b0c";
        ["S", "M", "L", "XL", "XXL"].forEach(function (s) {
          if (!wrap._value.some(function (v) { return v.size === s && v.color === color; })) wrap._value.push({ size: s, color: color, color_hex: hex, stock: 0, price_override: null, sku: "" });
        });
        wrap._value = wrap._value.filter(function (v) { return v.size || v.color || v.id; });
        renderRows();
      };
      renderRows();
    }
    if (t === "slug" && f.from) {
      var src = $("#f_" + f.from), slugIn = $("input", wrap), touched = !!slugIn.value;
      slugIn.addEventListener("input", function () { touched = true; });
      if (src) src.addEventListener("input", function () { if (!touched) slugIn.value = slugify(src.value); });
    }
  }

  function dnd(el, onFiles) {
    ["dragenter", "dragover"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { el.addEventListener(ev, function (e) { e.preventDefault(); el.classList.remove("is-over"); }); });
    el.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files); });
  }

  function readField(f, wrap) {
    var el = $("#f_" + f.k, wrap) || $("input,textarea,select", wrap);
    switch (f.type) {
      case "bool": return el.checked;
      case "int": return el.value === "" ? (f.def != null ? f.def : null) : parseInt(el.value, 10);
      case "money": return el.value === "" ? null : Number(el.value);
      case "datetime": return el.value ? new Date(el.value).toISOString() : null;
      case "list": return el.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
      case "paragraphs": return el.value.split(/\n\s*\n/).map(function (s) { return s.replace(/\s*\n\s*/g, " ").trim(); }).filter(Boolean);
      case "timeline": return el.value.split("\n").map(function (l) { var i = l.indexOf("|"); return i < 0 ? null : { year: l.slice(0, i).trim(), text: l.slice(i + 1).trim() }; }).filter(Boolean);
      case "image": case "file": return $("[data-url]", wrap).value.trim() || null;
      case "images": case "variants": case "shipping": return wrap._value;
      case "slug": return slugify(el.value);
      default: return el.value.trim() === "" ? (f.required ? "" : null) : el.value.trim();
    }
  }

  function renderForm(container, fields, values) {
    container.innerHTML = fields.map(function (f) {
      var v = values[f.k];
      if (v === undefined && f.def !== undefined) v = f.def;
      return fieldHTML(f, v);
    }).join("");
    fields.forEach(function (f) { bindField(f, $('[data-k="' + f.k + '"]', container), values[f.k] !== undefined ? values[f.k] : f.def); });
  }

  function collectForm(container, fields) {
    var out = {}, missing = [];
    fields.forEach(function (f) {
      var v = readField(f, $('[data-k="' + f.k + '"]', container));
      if (f.required && (v === "" || v == null)) missing.push(f.label);
      out[f.k] = v;
    });
    if (missing.length) throw new Error("Completá: " + missing.join(", "));
    return out;
  }

  /* =======================================================================
     VISTAS
     ======================================================================= */
  var main, counts = { messages: 0, orders: 0 };

  function setHeader(title, subtitle, actionsHTML) {
    return '<div class="topbar"><div><h1>' + esc(title) + "</h1>" + (subtitle ? "<p>" + subtitle + "</p>" : "") + "</div>" +
      (actionsHTML ? '<div class="btn-row">' + actionsHTML + "</div>" : "") + "</div>" +
      (DB.demo ? '<div class="demo-banner">Modo demostración: podés probar todo, pero los cambios no se guardan. Conectá Supabase en <code>js/config.js</code> para usarlo de verdad.</div>' : "");
  }
  function loading() { main.innerHTML = '<div class="spinner"></div>'; }

  /* ---------- CRUD genérico ---------- */
  function viewCrud(key) {
    var E = ENTITIES[key];
    loading();
    DB.list(E.table, { select: E.select, order: E.order, asc: E.asc }).then(function (rows) {
      main.innerHTML = setHeader(E.title, E.subtitle, '<button class="btn btn--primary" data-new>+ Nuevo ' + esc(E.singular) + "</button>") +
        (E.help ? '<div class="help">' + E.help + "</div>" : "") +
        '<div class="table-wrap"><table><thead><tr>' + E.columns.map(function (c) { return "<th>" + esc(c.label) + "</th>"; }).join("") + '<th></th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) {
          return '<tr data-id="' + esc(r.id) + '">' + E.columns.map(function (c) {
            if (c.toggle) return '<td><label class="switch"><input type="checkbox" data-toggle="' + c.k + '"' + (r[c.k] ? " checked" : "") + "></label></td>";
            if (c.render) return "<td>" + c.render(r) + "</td>";
            if (c.img) return "<td>" + (r[c.k] ? '<img class="thumb" src="' + esc(resolveUrl(r[c.k])) + '" alt="">' : "") + "</td>";
            return "<td>" + esc(r[c.k] == null ? "" : r[c.k]) + "</td>";
          }).join("") + '<td class="actions"><button class="btn btn--sm" data-edit>Editar</button> <button class="btn btn--sm btn--danger" data-del>Eliminar</button></td></tr>';
        }).join("") : '<tr><td colspan="' + (E.columns.length + 1) + '" class="empty">Todavía no hay nada cargado.</td></tr>') +
        "</tbody></table></div>";

      $("[data-new]", main).onclick = function () { editItem(key, null); };
      main.querySelector("tbody").addEventListener("click", function (e) {
        var tr = e.target.closest("tr[data-id]"); if (!tr) return;
        var row = rows.filter(function (r) { return String(r.id) === tr.dataset.id; })[0];
        if (e.target.closest("[data-edit]")) editItem(key, row);
        if (e.target.closest("[data-del]")) {
          confirmBox("¿Eliminar este " + E.singular + "? No se puede deshacer.").then(function (ok) {
            if (!ok) return;
            DB.remove(E.table, row.id).then(function () { toast("Eliminado"); viewCrud(key); }).catch(function (er) { toast(errMsg(er), true); });
          });
        }
      });
      main.querySelector("tbody").addEventListener("change", function (e) {
        var tg = e.target.closest("[data-toggle]"); if (!tg) return;
        var id = tg.closest("tr").dataset.id, patch = {}; patch[tg.dataset.toggle] = tg.checked;
        DB.update(E.table, id, patch).then(function () { toast("Guardado"); }).catch(function (er) { tg.checked = !tg.checked; toast(errMsg(er), true); });
      });
    }).catch(function (e) { main.innerHTML = setHeader(E.title) + '<p class="err">' + esc(errMsg(e)) + "</p>"; });
  }

  function editItem(key, row) {
    var E = ENTITIES[key];
    var values = row ? clone(row) : {};
    if (key === "products") values.variants = row ? (row.product_variants || []).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); }) : [{ size: null, color: null, color_hex: null, stock: 0, price_override: null, sku: "" }];
    var m = modal((row ? "Editar " : "Nuevo ") + E.singular, '<form novalidate data-form></form><p class="err" data-err></p>',
      '<button class="btn btn--ghost" type="button" data-cancel>Cancelar</button><button class="btn btn--primary" type="button" data-save>Guardar</button>');
    var form = $("[data-form]", m.el);
    renderForm(form, E.fields, values);
    $("[data-cancel]", m.el).onclick = m.close;
    $("[data-save]", m.el).onclick = function () {
      var btn = this, errEl = $("[data-err]", m.el);
      var data;
      try { data = collectForm(form, E.fields); } catch (er) { errEl.textContent = er.message; return; }
      var variants = data.variants; delete data.variants;
      if ("slug" in data && !data.slug) data.slug = slugify(data.title || data.name || ("item-" + Date.now()));
      if (key === "products") {
        if (!variants || !variants.length) { errEl.textContent = "Agregá al menos una variante (aunque sea sin talle) para cargar el stock."; return; }
        data.images = data.images || [];
      }
      btn.disabled = true; errEl.textContent = "";
      var save = row ? DB.update(E.table, row.id, data) : DB.insert(E.table, data);
      save.then(function (saved) {
        if (key === "products") return syncVariants(saved.id, row ? row.product_variants || [] : [], variants);
      }).then(function () { m.close(); toast("Guardado"); viewCrud(key); })
        .catch(function (er) { btn.disabled = false; errEl.textContent = errMsg(er); });
    };
  }

  /** Inserta / actualiza / borra variantes para que coincidan con el formulario */
  function syncVariants(productId, before, after) {
    var keep = after.filter(function (v) { return v.id; }).map(function (v) { return v.id; });
    var ops = [];
    before.forEach(function (v) { if (keep.indexOf(v.id) < 0) ops.push(DB.remove("product_variants", v.id)); });
    after.forEach(function (v, i) {
      var row = { product_id: productId, size: v.size || null, color: v.color || null, color_hex: v.color ? (v.color_hex || null) : null, stock: Math.max(0, parseInt(v.stock, 10) || 0), price_override: v.price_override || null, sku: v.sku || null, sort: i };
      ops.push(v.id ? DB.update("product_variants", v.id, row) : DB.insert("product_variants", row));
    });
    return Promise.all(ops);
  }

  /* ---------- Contenido (tabla settings) ---------- */
  var SETTINGS = [
    { key: "hero", title: "Portada de la Home (Hero)", fields: [
      { k: "tagline", label: "Frase chica (arriba)", type: "text" },
      { k: "title", label: "Frase principal", type: "text" },
      { k: "image", label: "Imagen de fondo", type: "image", folder: "hero", help: "Horizontal, mínimo 1600 px de ancho. Se oscurece automáticamente para que el logo resalte." },
      { k: "video", label: "Video de fondo (opcional, MP4 liviano)", type: "file", accept: "video/mp4", folder: "hero", help: "Si cargás un video, se reproduce en silencio sobre la imagen. Ideal: menos de 5 MB. Ejemplo incluido: assets/video/hero-kosmos.mp4" },
      { k: "cta_primary_label", label: "Botón 1 · texto", type: "text" },
      { k: "cta_primary_url", label: "Botón 1 · enlace", type: "text" },
      { k: "cta_secondary_label", label: "Botón 2 · texto", type: "text" },
      { k: "cta_secondary_url", label: "Botón 2 · enlace", type: "text" }
    ] },
    { key: "bio", title: "Biografía", fields: [
      { k: "short", label: "Bio corta (Home)", type: "textarea" },
      { k: "long", label: "Historia completa (página Banda)", type: "paragraphs" },
      { k: "timeline", label: "Línea de tiempo", type: "timeline" },
      { k: "image", label: "Imagen de portada de la página Banda", type: "image", folder: "bio" }
    ] },
    { key: "socials", title: "Redes y plataformas", fields: [
      { k: "spotify", label: "Spotify", type: "text" }, { k: "youtube", label: "YouTube", type: "text" },
      { k: "bandcamp", label: "Bandcamp", type: "text" }, { k: "instagram", label: "Instagram", type: "text" },
      { k: "facebook", label: "Facebook", type: "text" }, { k: "tiktok", label: "TikTok", type: "text" }
    ] },
    { key: "media", title: "Reproductores", fields: [
      { k: "spotify_artist_id", label: "ID de artista de Spotify", type: "text", help: "La parte final del link de artista: open.spotify.com/artist/<b>ESTE-ID</b>" },
      { k: "youtube_channel_id", label: "ID del canal de YouTube (empieza con UC)", type: "text", help: "Se muestra la lista de últimos videos del canal." },
      { k: "youtube_featured_video", label: "Video destacado de YouTube (opcional)", type: "text", help: "Si lo completás, se muestra ese video en vez de la lista. Es lo que va después de <code>watch?v=</code>" },
      { k: "featured_release_slug", label: "Lanzamiento destacado en la Home", type: "select", options: {} }
    ] },
    { key: "contact", title: "Contacto", fields: [
      { k: "email", label: "Email general", type: "text" }, { k: "booking_email", label: "Email de booking", type: "text" },
      { k: "press_email", label: "Email de prensa", type: "text" }, { k: "location", label: "Ubicación", type: "text" }
    ] },
    { key: "press", title: "Prensa (EPK)", fields: [
      { k: "epk_url", label: "Kit de prensa (PDF)", type: "file", accept: "application/pdf", folder: "press" },
      { k: "photos_zip_url", label: "Pack de fotos (ZIP, opcional)", type: "file", accept: ".zip,application/zip", folder: "press" }
    ] },
    { key: "shop", title: "Tienda · envíos", fields: [
      { k: "shipping_options", label: "Opciones de envío", type: "shipping" },
      { k: "note", label: "Nota para clientes", type: "textarea" }
    ] }
  ];

  function viewSettings() {
    loading();
    Promise.all([DB.list("settings"), DB.list("releases", { order: "sort" })]).then(function (res) {
      var map = {}; res[0].forEach(function (r) { map[r.key] = r.value || {}; });
      var opts = {}; res[1].forEach(function (r) { opts[r.slug] = r.title + " (" + (r.year || "") + ")"; });
      SETTINGS.filter(function (s) { return s.key === "media"; })[0].fields[3].options = opts;
      main.innerHTML = setHeader("Contenido", "Textos, imágenes de portada, bio, redes y envíos.") +
        SETTINGS.map(function (s) {
          return '<section class="card" data-skey="' + s.key + '"><h2>' + esc(s.title) + '</h2><div data-sform></div>' +
            '<div class="btn-row" style="justify-content:flex-end"><button class="btn btn--primary" data-ssave>Guardar ' + esc(s.title.split(" ")[0].toLowerCase()) + "</button></div></section>";
        }).join("");
      SETTINGS.forEach(function (s) {
        var card = $('[data-skey="' + s.key + '"]', main), form = $("[data-sform]", card);
        var base = Object.assign({}, (DEF.settings || {})[s.key] || {}, map[s.key] || {});
        renderForm(form, s.fields, base);
        $("[data-ssave]", card).onclick = function () {
          var btn = this, data;
          try { data = collectForm(form, s.fields); } catch (er) { toast(er.message, true); return; }
          btn.disabled = true;
          DB.upsert("settings", { key: s.key, value: Object.assign({}, map[s.key] || {}, data) }, "key")
            .then(function () { map[s.key] = Object.assign({}, map[s.key] || {}, data); toast("Guardado: " + s.title); })
            .catch(function (er) { toast(errMsg(er), true); })
            .then(function () { btn.disabled = false; });
        };
      });
    }).catch(function (e) { main.innerHTML = setHeader("Contenido") + '<p class="err">' + esc(errMsg(e)) + "</p>"; });
  }

  /* ---------- Pedidos ---------- */
  var ORDER_STATUS = { pending: "Pendiente de pago", paid: "Pagado · preparar", shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reintegrado" };
  var ORDER_PILL = { pending: "", paid: "pill--gold", shipped: "pill--teal", delivered: "pill--green", cancelled: "pill--red", refunded: "pill--red" };
  var orderFilter = "all";

  function viewOrders() {
    loading();
    DB.list("orders", { order: "created_at", asc: false, limit: 300 }).then(function (rows) {
      var list = orderFilter === "all" ? rows : rows.filter(function (o) { return o.status === orderFilter; });
      main.innerHTML = setHeader("Pedidos", "Compras de la tienda. Los pagos aprobados descuentan stock automáticamente.") +
        '<div class="toolbar"><div class="tabs">' +
        [["all", "Todos"], ["paid", "Por preparar"], ["pending", "Pendientes"], ["shipped", "Enviados"], ["delivered", "Entregados"], ["cancelled", "Cancelados"]].map(function (t) {
          var n = t[0] === "all" ? rows.length : rows.filter(function (o) { return o.status === t[0]; }).length;
          return '<button data-f="' + t[0] + '" class="' + (orderFilter === t[0] ? "is-active" : "") + '">' + t[1] + " (" + n + ")</button>";
        }).join("") + "</div></div>" +
        '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>N.º</th><th>Cliente</th><th>Productos</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(function (o) {
          var n = (o.items || []).reduce(function (s, i) { return s + i.qty; }, 0);
          return '<tr data-id="' + esc(o.id) + '"><td>' + fmtDate(o.created_at, true) + "</td><td><code>" + esc(String(o.id).slice(0, 8).toUpperCase()) + "</code></td>" +
            "<td>" + esc((o.customer || {}).name) + '<br><span class="small muted">' + esc((o.customer || {}).email) + "</span></td>" +
            "<td>" + n + " u. · " + esc((o.shipping || {}).id === "pickup" ? "Retiro" : "Envío") + "</td><td><b>" + money(o.total) + "</b></td>" +
            '<td><select class="select" data-status style="min-height:34px;padding:4px 8px">' + Object.keys(ORDER_STATUS).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + ">" + ORDER_STATUS[k] + "</option>"; }).join("") + "</select></td>" +
            '<td class="actions"><button class="btn btn--sm" data-view>Ver</button></td></tr>';
        }).join("") : '<tr><td colspan="7" class="empty">No hay pedidos en esta vista.</td></tr>') + "</tbody></table></div>";

      $(".tabs", main).onclick = function (e) { var b = e.target.closest("[data-f]"); if (b) { orderFilter = b.dataset.f; viewOrders(); } };
      var tbody = main.querySelector("tbody");
      tbody.addEventListener("change", function (e) {
        var s = e.target.closest("[data-status]"); if (!s) return;
        DB.update("orders", s.closest("tr").dataset.id, { status: s.value }).then(function () { toast("Estado actualizado"); refreshCounts(); }).catch(function (er) { toast(errMsg(er), true); });
      });
      tbody.addEventListener("click", function (e) {
        if (!e.target.closest("[data-view]")) return;
        var o = rows.filter(function (x) { return String(x.id) === e.target.closest("tr").dataset.id; })[0];
        orderDetail(o);
      });
    }).catch(function (e) { main.innerHTML = setHeader("Pedidos") + '<p class="err">' + esc(errMsg(e)) + "</p>"; });
  }

  function orderDetail(o) {
    var c = o.customer || {};
    var addr = [c.address, c.city, c.province, c.zip].filter(Boolean).join(", ");
    var body = '<dl class="kv">' +
      "<dt>Pedido</dt><dd><code>" + esc(o.id) + "</code></dd>" +
      "<dt>Fecha</dt><dd>" + fmtDate(o.created_at, true) + "</dd>" +
      '<dt>Estado</dt><dd><span class="pill ' + (ORDER_PILL[o.status] || "") + '">' + esc(ORDER_STATUS[o.status] || o.status) + "</span></dd>" +
      "<dt>Pago</dt><dd>" + esc(o.provider || "—") + (o.provider_ref ? ' · <span class="small muted">' + esc(o.provider_ref) + "</span>" : "") + (o.paid_at ? " · " + fmtDate(o.paid_at, true) : "") + "</dd>" +
      "<dt>Cliente</dt><dd>" + esc(c.name) + "</dd>" +
      '<dt>Email</dt><dd><a href="mailto:' + esc(c.email) + '">' + esc(c.email) + "</a></dd>" +
      (c.phone ? "<dt>Teléfono</dt><dd>" + esc(c.phone) + (c.dni ? " · DNI " + esc(c.dni) : "") + "</dd>" : "") +
      "<dt>Entrega</dt><dd>" + esc((o.shipping || {}).label || "—") + (addr ? "<br>" + esc(addr) : "") + "</dd>" +
      (c.notes ? "<dt>Notas</dt><dd>" + esc(c.notes) + "</dd>" : "") + "</dl>" +
      '<div class="table-wrap" style="margin:18px 0"><table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>' +
      (o.items || []).map(function (i) { return "<tr><td>" + esc(i.name) + (i.variant_label ? ' <span class="muted">(' + esc(i.variant_label) + ")</span>" : "") + "</td><td>" + i.qty + "</td><td>" + money(i.unit_price) + "</td><td>" + money(i.unit_price * i.qty) + "</td></tr>"; }).join("") +
      '<tr><td colspan="3" class="muted">Envío</td><td>' + money(o.shipping_cost) + '</td></tr><tr><td colspan="3"><b>Total</b></td><td><b>' + money(o.total) + "</b></td></tr></tbody></table></div>" +
      '<div class="field"><label for="o-notes">Notas internas (seguimiento, n.º de envío…)</label><textarea class="textarea" id="o-notes">' + esc(o.admin_notes || "") + "</textarea></div>";
    var m = modal("Pedido " + String(o.id).slice(0, 8).toUpperCase(), body,
      '<a class="btn btn--ghost" href="mailto:' + esc(c.email) + "?subject=" + encodeURIComponent("Tu pedido Elessär " + String(o.id).slice(0, 8).toUpperCase()) + '">Escribir al cliente</a><button class="btn btn--primary" data-save>Guardar notas</button>');
    $("[data-save]", m.el).onclick = function () {
      DB.update("orders", o.id, { admin_notes: $("#o-notes", m.el).value }).then(function () { toast("Notas guardadas"); m.close(); viewOrders(); }).catch(function (er) { toast(errMsg(er), true); });
    };
  }

  /* ---------- Mensajes ---------- */
  var SUBJECTS = { booking: "Booking / shows", prensa: "Prensa", tienda: "Tienda", otro: "Otro" };
  function viewMessages() {
    loading();
    DB.list("messages", { order: "created_at", asc: false, limit: 300 }).then(function (rows) {
      main.innerHTML = setHeader("Mensajes", "Lo que llega desde el formulario de contacto.") +
        (rows.length ? rows.map(function (m) {
          return '<article class="msg' + (m.read ? "" : " is-unread") + '" data-id="' + esc(m.id) + '"><div class="msg__head"><div><b>' + esc(m.name) + '</b> · <a href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a></div>" +
            '<div class="small muted">' + fmtDate(m.created_at, true) + ' · <span class="pill' + (m.read ? "" : " pill--gold") + '">' + esc(SUBJECTS[m.subject] || m.subject || "—") + "</span></div></div>" +
            '<div class="msg__body">' + esc(m.body) + "</div>" +
            '<div class="btn-row"><a class="btn btn--sm btn--primary" href="mailto:' + esc(m.email) + "?subject=" + encodeURIComponent("Re: tu mensaje a Elessär") + '">Responder por email</a>' +
            '<button class="btn btn--sm" data-read>' + (m.read ? "Marcar como no leído" : "Marcar como leído") + '</button><button class="btn btn--sm btn--danger" data-del>Eliminar</button></div></article>';
        }).join("") : '<div class="card empty">No hay mensajes todavía.</div>');
      main.onclick = function (e) {
        var art = e.target.closest(".msg"); if (!art) return;
        var m = rows.filter(function (x) { return String(x.id) === art.dataset.id; })[0];
        if (e.target.closest("[data-read]")) DB.update("messages", m.id, { read: !m.read }).then(function () { refreshCounts(); viewMessages(); });
        if (e.target.closest("[data-del]")) confirmBox("¿Eliminar este mensaje?").then(function (ok) { if (ok) DB.remove("messages", m.id).then(function () { refreshCounts(); viewMessages(); }); });
      };
    }).catch(function (e) { main.innerHTML = setHeader("Mensajes") + '<p class="err">' + esc(errMsg(e)) + "</p>"; });
  }

  /* ---------- Resumen ---------- */
  function viewDashboard() {
    loading();
    Promise.all([
      DB.list("orders", { order: "created_at", asc: false, limit: 200 }),
      DB.list("messages", { eq: { read: false } }),
      DB.list("shows", { order: "date" }),
      DB.list("products", { select: "*, product_variants(*)", order: "sort" }),
      DB.list("announcements", { order: "sort" })
    ]).then(function (r) {
      var orders = r[0], unread = r[1], shows = r[2], products = r[3], anns = r[4];
      var toShip = orders.filter(function (o) { return o.status === "paid"; });
      var month = orders.filter(function (o) { return ["paid", "shipped", "delivered"].indexOf(o.status) > -1 && new Date(o.created_at).getMonth() === new Date().getMonth() && new Date(o.created_at).getFullYear() === new Date().getFullYear(); });
      var revenue = month.reduce(function (n, o) { return n + Number(o.total); }, 0);
      var next = shows.filter(function (s) { return new Date(s.date) > new Date() && s.published; })[0];
      var low = [];
      products.forEach(function (p) { (p.product_variants || []).forEach(function (v) { if (v.stock <= 3 && p.active) low.push({ p: p, v: v }); }); });
      var ann = anns.filter(function (a) { return a.active; })[0];
      main.innerHTML = setHeader("Resumen", "Hola 👋 Esto es lo que está pasando en el sitio.", '<a class="btn" href="../index.html" target="_blank">Ver sitio ↗</a>') +
        '<div class="grid grid--4" style="margin-bottom:16px">' +
        '<div class="stat"><b>' + toShip.length + "</b><span>Pedidos por preparar</span></div>" +
        '<div class="stat"><b>' + money(revenue) + "</b><span>Ventas del mes</span></div>" +
        '<div class="stat"><b>' + unread.length + "</b><span>Mensajes sin leer</span></div>" +
        '<div class="stat"><b>' + (next ? fmtDate(next.date).replace(/ de /g, " ") : "—") + "</b><span>" + (next ? "Próximo show · " + esc(next.city) : "Sin shows próximos") + "</span></div></div>" +
        '<div class="grid grid--2">' +
        '<section class="card"><h2>Stock bajo (≤ 3 u.)</h2>' + (low.length ? '<div class="table-wrap"><table><tbody>' + low.map(function (x) {
          return "<tr><td>" + esc(x.p.name) + ' <span class="muted">' + esc([x.v.color, x.v.size].filter(Boolean).join(" · ")) + '</span></td><td><span class="pill ' + (x.v.stock ? "pill--gold" : "pill--red") + '">' + x.v.stock + " u.</span></td></tr>";
        }).join("") + '</tbody></table></div><div class="btn-row" style="margin-top:12px"><button class="btn btn--sm" data-go="products">Ir a la tienda</button></div>' : '<p class="muted">Todo en orden.</p>') + "</section>" +
        '<section class="card"><h2>Aviso destacado</h2>' + (ann ? '<p>«' + esc(ann.text) + '»</p><span class="pill pill--green">Activo</span>' : '<p class="muted">No hay ningún aviso activo.</p>') +
        '<div class="btn-row" style="margin-top:12px"><button class="btn btn--sm" data-go="announcements">Gestionar avisos</button></div>' +
        '<h2 style="margin-top:22px">Atajos</h2><div class="btn-row"><button class="btn btn--sm" data-go="shows">+ Nueva fecha</button><button class="btn btn--sm" data-go="products">+ Nuevo producto</button><button class="btn btn--sm" data-go="content">Editar portada</button></div></section></div>' +
        '<section class="card" style="margin-top:16px"><h2>Últimos pedidos</h2>' + (orders.length ? '<div class="table-wrap"><table><tbody>' + orders.slice(0, 6).map(function (o) {
          return "<tr><td>" + fmtDate(o.created_at, true) + "</td><td>" + esc((o.customer || {}).name) + "</td><td>" + money(o.total) + '</td><td><span class="pill ' + (ORDER_PILL[o.status] || "") + '">' + esc(ORDER_STATUS[o.status]) + "</span></td></tr>";
        }).join("") + "</tbody></table></div>" : '<p class="muted">Todavía no hay pedidos.</p>') + "</section>";
      main.onclick = function (e) { var b = e.target.closest("[data-go]"); if (b) location.hash = "#/" + b.dataset.go; };
    }).catch(function (e) { main.innerHTML = setHeader("Resumen") + '<p class="err">' + esc(errMsg(e)) + "</p>"; });
  }

  /* =======================================================================
     NAVEGACIÓN
     ======================================================================= */
  var ROUTES = {
    dashboard: { label: "Resumen", icon: "◈", view: viewDashboard },
    announcements: { label: "Avisos", icon: "✦", view: function () { viewCrud("announcements"); } },
    content: { label: "Contenido", icon: "✎", view: viewSettings },
    shows: { label: "Fechas", icon: "◷", view: function () { viewCrud("shows"); } },
    products: { label: "Tienda", icon: "◇", view: function () { viewCrud("products"); } },
    orders: { label: "Pedidos", icon: "▤", view: viewOrders, badge: "orders" },
    messages: { label: "Mensajes", icon: "✉", view: viewMessages, badge: "messages" },
    releases: { label: "Discografía", icon: "◉", view: function () { viewCrud("releases"); } },
    members: { label: "Integrantes", icon: "♆", view: function () { viewCrud("members"); } },
    gallery: { label: "Galería", icon: "▣", view: function () { viewCrud("gallery"); } }
  };

  function currentRoute() {
    var h = location.hash.replace(/^#\/?/, "");
    return ROUTES[h] ? h : "dashboard";
  }
  function renderNav() {
    var cur = currentRoute();
    $("#nav").innerHTML = Object.keys(ROUTES).map(function (k) {
      var r = ROUTES[k], n = r.badge ? counts[r.badge] : 0;
      return '<button type="button" data-route="' + k + '" class="' + (k === cur ? "is-active" : "") + '"><span aria-hidden="true">' + r.icon + "</span>" + r.label + (n ? '<span class="badge">' + n + "</span>" : "") + "</button>";
    }).join("");
  }
  function route() {
    if (/access_token|type=recovery|error_description/.test(location.hash)) return; // tokens de Supabase en la URL
    $$(".modal-back").forEach(function (el) { el.remove(); }); // cerrar modales al cambiar de sección
    document.body.style.overflow = "";
    renderNav();
    main.onclick = null;
    ROUTES[currentRoute()].view();
    window.scrollTo(0, 0);
  }
  function refreshCounts() {
    return Promise.all([DB.list("messages", { eq: { read: false } }), DB.list("orders", { eq: { status: "paid" } })]).then(function (r) {
      counts.messages = r[0].length; counts.orders = r[1].length; renderNav();
    }).catch(function () {});
  }

  /* =======================================================================
     AUTENTICACIÓN Y ARRANQUE
     ======================================================================= */
  function showLogin(msg) {
    $("#app").hidden = true; $("#login").hidden = false;
    var e = $("#login-err"); e.textContent = msg || "";
  }
  function showApp(email) {
    $("#login").hidden = true; $("#app").hidden = false;
    $("#user-email").textContent = email || "";
    main = $("#main");
    refreshCounts();
    route();
  }
  function enter(session) {
    return DB.auth.isAdmin().then(function (ok) {
      if (!ok) { DB.auth.signOut(); showLogin("Tu usuario no tiene permisos de administrador. Seguí la guía docs/ADMIN.md para darte acceso."); return; }
      showApp(session && session.user && session.user.email);
    });
  }

  function askNewPassword() {
    var m = modal("Elegí tu nueva contraseña", '<div class="field"><label for="np">Nueva contraseña (mínimo 8 caracteres)</label><input class="input" id="np" type="password" autocomplete="new-password" minlength="8"></div><p class="err" data-err></p>',
      '<button class="btn btn--primary" data-ok>Guardar contraseña</button>', "sm");
    $("[data-ok]", m.el).onclick = function () {
      var pw = $("#np", m.el).value;
      if (pw.length < 8) { $("[data-err]", m.el).textContent = "Usá al menos 8 caracteres."; return; }
      DB.auth.updatePassword(pw).then(function () { m.close(); toast("Contraseña actualizada"); history.replaceState(null, "", location.pathname); DB.auth.session().then(enter); })
        .catch(function (e) { $("[data-err]", m.el).textContent = errMsg(e); });
    };
  }

  function boot() {
    var demoRequested = /[?&]demo=1/.test(location.search);
    if (!CONFIGURED && !demoRequested) {
      $("#setup-notice").hidden = false;
      $("#login-form").hidden = true;
      showLogin();
      return;
    }
    if (!CONFIGURED || demoRequested && !CONFIGURED) {
      DB = DemoDB();
      showApp("modo demostración");
    } else {
      if (!window.supabase) { showLogin("No se pudo cargar la librería de Supabase. Revisá tu conexión."); return; }
      DB = SupabaseDB();
      DB.auth.onChange(function (ev, session) {
        if (ev === "PASSWORD_RECOVERY") askNewPassword();
        if (ev === "SIGNED_OUT") showLogin();
      });
      DB.auth.session().then(function (s) { if (s) enter(s); else showLogin(); });
    }

    $("#nav").addEventListener("click", function (e) { var b = e.target.closest("[data-route]"); if (b) location.hash = "#/" + b.dataset.route; });
    window.addEventListener("hashchange", route);
    $$("[data-logout]").forEach(function (b) { b.onclick = function () { DB.auth.signOut(); }; });
  }

  // Formulario de login
  document.addEventListener("DOMContentLoaded", function () {
    var form = $("#login-form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("button[type=submit]", form), err = $("#login-err");
      btn.disabled = true; err.textContent = "";
      DB.auth.signIn(form.elements.email.value.trim(), form.elements.password.value)
        .then(enter).catch(function (er) { err.textContent = errMsg(er); })
        .then(function () { btn.disabled = false; });
    });
    $("#forgot").onclick = function () {
      var email = form.elements.email.value.trim();
      if (!email) { $("#login-err").textContent = "Escribí tu email y volvé a tocar «¿Olvidaste tu contraseña?»."; return; }
      DB.auth.reset(email).then(function () { $("#login-err").textContent = ""; toast("Te enviamos un email para elegir una contraseña nueva."); })
        .catch(function (er) { $("#login-err").textContent = errMsg(er); });
    };
    boot();
  });
})();
