/* ==========================================================================
   ELESSÄR — Capa de datos (window.ElessarAPI)
   --------------------------------------------------------------------------
   - Si js/config.js tiene SUPABASE_URL → lee de Supabase (contenido del CMS).
   - Si no, o si Supabase falla → usa js/default-data.js (modo demo).
   Todas las funciones devuelven Promesas con la misma forma de datos.
   ========================================================================== */
(function () {
  "use strict";

  var CFG = window.ELESSAR_CONFIG || {};
  var DEF = window.ELESSAR_DEFAULTS || {};
  var client = null;
  var mode = "demo"; // "live" cuando Supabase responde
  var cache = {};

  /* ---------- utilidades ---------- */
  function isConfigured() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve; s.onerror = function () { reject(new Error("No se pudo cargar " + src)); };
      document.head.appendChild(s);
    });
  }

  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  // Mezcla profunda simple: los valores de la base pisan los por defecto
  function merge(base, over) {
    if (Array.isArray(over)) return over;
    if (!over || typeof over !== "object") return over === undefined || over === null || over === "" ? base : over;
    var out = Object.assign({}, base || {});
    Object.keys(over).forEach(function (k) { out[k] = merge(out[k], over[k]); });
    return out;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // Memoiza una consulta y cae al valor por defecto ante cualquier error
  function cached(key, liveFn, fallback) {
    if (cache[key]) return cache[key];
    cache[key] = ready.then(function () {
      if (mode !== "live") return clone(fallback);
      return liveFn().catch(function (err) {
        console.warn("[Elessär] " + key + ": usando contenido local →", err && err.message);
        return clone(fallback);
      });
    });
    return cache[key];
  }

  function q(promise) { // desempaqueta { data, error } de supabase-js
    return promise.then(function (r) { if (r.error) throw r.error; return r.data; });
  }

  /* ---------- inicialización ---------- */
  var ready = (function () {
    if (!isConfigured()) return Promise.resolve("demo");
    return loadScript(CFG.SUPABASE_JS_CDN)
      .then(function () {
        client = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
          auth: { persistSession: false } // el sitio público no necesita sesión
        });
        mode = "live";
        return mode;
      })
      .catch(function (err) {
        console.warn("[Elessär] Supabase no disponible, modo demo:", err.message);
        return "demo";
      });
  })();

  /* ---------- normalizadores ---------- */
  function normProduct(p) {
    var variants = (p.product_variants || p.variants || []).slice().sort(bySort);
    return {
      id: p.id, slug: p.slug, name: p.name, category: p.category,
      description: p.description || "", price: Number(p.price) || 0,
      compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
      featured: !!p.featured, active: p.active !== false, sort: p.sort || 0,
      images: (p.images && p.images.length) ? p.images : ["assets/img/logo-cathedral.webp"],
      variants: variants.map(function (v) {
        return {
          id: v.id, size: v.size || null, color: v.color || null, color_hex: v.color_hex || null,
          stock: Math.max(0, Number(v.stock) || 0),
          price_override: v.price_override ? Number(v.price_override) : null
        };
      })
    };
  }

  /* ---------- API pública ---------- */
  var API = {
    ready: ready,
    get mode() { return mode; },
    get client() { return client; },

    getSettings: function () {
      return cached("settings", function () {
        return q(client.from("settings").select("key,value")).then(function (rows) {
          var s = clone(DEF.settings || {});
          (rows || []).forEach(function (r) { s[r.key] = merge(s[r.key], r.value); });
          return s;
        });
      }, DEF.settings || {});
    },

    getAnnouncements: function () {
      return cached("announcements", function () {
        return q(client.from("announcements").select("*").eq("active", true).order("sort"));
      }, (DEF.announcements || []).filter(function (a) { return a.active; })).then(function (list) {
        var now = Date.now();
        return list.filter(function (a) {
          if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
          if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
          return true;
        });
      });
    },

    getMembers: function () {
      return cached("members", function () {
        return q(client.from("members").select("*").eq("active", true).order("sort"));
      }, (DEF.members || []).slice().sort(bySort));
    },

    getReleases: function () {
      return cached("releases", function () {
        return q(client.from("releases").select("*").eq("published", true).order("sort"));
      }, (DEF.releases || []).slice().sort(bySort));
    },

    /** Devuelve { upcoming: [...], past: [...] } */
    getShows: function () {
      return cached("shows", function () {
        return q(client.from("shows").select("*").eq("published", true).order("date"));
      }, DEF.shows || []).then(function (list) {
        var now = Date.now() - 1000 * 60 * 60 * 6; // un show "sigue" 6 h después de empezar
        var sorted = list.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        return {
          upcoming: sorted.filter(function (s) { return new Date(s.date).getTime() >= now; }),
          past: sorted.filter(function (s) { return new Date(s.date).getTime() < now; }).reverse()
        };
      });
    },

    getGallery: function () {
      return cached("gallery", function () {
        return q(client.from("gallery").select("*").order("sort"));
      }, (DEF.gallery || []).slice().sort(bySort));
    },

    getProducts: function () {
      return cached("products", function () {
        return q(client.from("products").select("*, product_variants(*)").eq("active", true).order("sort"));
      }, DEF.products || []).then(function (list) { return list.map(normProduct).sort(bySort); });
    },

    getProduct: function (slug) {
      return API.getProducts().then(function (list) {
        return list.filter(function (p) { return p.slug === slug; })[0] || null;
      });
    },

    /** Formulario de contacto → tabla messages */
    sendMessage: function (msg) {
      return ready.then(function () {
        if (mode !== "live") {
          return new Promise(function (r) { setTimeout(function () { r({ demo: true }); }, 700); });
        }
        return q(client.from("messages").insert({
          name: msg.name, email: msg.email, subject: msg.subject, body: msg.body
        }));
      });
    },

    /**
     * Crea el pago en la Edge Function "create-checkout".
     * El servidor recalcula precios y stock: el navegador nunca define montos.
     * Devuelve { url } para redirigir a MercadoPago / Stripe.
     */
    createCheckout: function (payload) { return API.invokeCheckout(payload); },

    /** PayPal: confirma (captura) el pago al volver del sitio de PayPal */
    capturePayPal: function (orderId, token) {
      return API.invokeCheckout({ action: "paypal-capture", order_id: orderId, token: token });
    },

    invokeCheckout: function (payload) {
      return ready.then(function () {
        if (mode !== "live") {
          var e = new Error("La tienda está en modo demo: conectá Supabase y la pasarela de pago (ver docs/DEPLOY.md).");
          e.code = "DEMO"; throw e;
        }
        return client.functions.invoke("create-checkout", { body: payload }).then(function (r) {
          if (r.error) {
            var ctx = r.error.context;
            if (ctx && typeof ctx.json === "function") {
              return ctx.json().then(function (j) { throw new Error(j.error || r.error.message); });
            }
            throw r.error;
          }
          return r.data;
        });
      });
    }
  };

  window.ElessarAPI = API;
})();
