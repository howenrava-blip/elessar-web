/* ==========================================================================
   ELESSÄR — Carrito de compras (window.ElessarCart)
   --------------------------------------------------------------------------
   Store mínimo estilo Zustand: estado + acciones + suscripción.
   Persiste en localStorage (con try/catch: modo incógnito, previews, etc.).

   Uso:
     ElessarCart.add({ productId, variantId, slug, name, variantLabel, price, image, maxStock }, qty)
     ElessarCart.subscribe(function (state) { ... })  → devuelve "unsubscribe"
   ========================================================================== */
(function () {
  "use strict";

  // Carrito separado para demo y producción: así, al conectar Supabase,
  // no quedan en el carrito productos de ejemplo con IDs inexistentes.
  var C = window.ELESSAR_CONFIG || {};
  var KEY = "elessar_cart_v1_" + (C.SUPABASE_URL ? "live" : "demo");
  var listeners = [];
  var state = { items: [] };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.items)) state.items = parsed.items;
      }
    } catch (e) { /* almacenamiento no disponible: el carrito vive en memoria */ }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ items: state.items })); } catch (e) {}
  }

  function emit() {
    save();
    var snap = Cart.getState();
    listeners.forEach(function (fn) { try { fn(snap); } catch (e) { console.error(e); } });
  }

  function find(variantId) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].variantId === variantId) return i;
    return -1;
  }

  function clampQty(qty, max) {
    qty = Math.max(1, Math.floor(Number(qty) || 1));
    if (typeof max === "number" && max >= 0) qty = Math.min(qty, max);
    return qty;
  }

  var Cart = {
    getState: function () {
      var items = state.items.map(function (i) { return Object.assign({}, i); });
      return {
        items: items,
        count: items.reduce(function (n, i) { return n + i.qty; }, 0),
        subtotal: items.reduce(function (n, i) { return n + i.qty * i.price; }, 0)
      };
    },

    /** Agrega (o suma) un ítem. Devuelve la cantidad final en el carrito. */
    add: function (item, qty) {
      qty = Math.max(1, Number(qty) || 1);
      var idx = find(item.variantId);
      if (idx > -1) {
        var cur = state.items[idx];
        cur.maxStock = item.maxStock;
        cur.qty = clampQty(cur.qty + qty, item.maxStock);
      } else {
        state.items.push({
          productId: item.productId, variantId: item.variantId, slug: item.slug,
          name: item.name, variantLabel: item.variantLabel || "",
          size: item.size || null, color: item.color || null, category: item.category || null,
          price: Number(item.price) || 0, image: item.image || "",
          maxStock: item.maxStock, qty: clampQty(qty, item.maxStock)
        });
      }
      emit();
      return state.items[find(item.variantId)].qty;
    },

    setQty: function (variantId, qty) {
      var idx = find(variantId);
      if (idx < 0) return;
      if (Number(qty) <= 0) return Cart.remove(variantId);
      state.items[idx].qty = clampQty(qty, state.items[idx].maxStock);
      emit();
    },

    remove: function (variantId) {
      var idx = find(variantId);
      if (idx > -1) { state.items.splice(idx, 1); emit(); }
    },

    clear: function () { state.items = []; emit(); },

    subscribe: function (fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
    }
  };

  load();
  // Sincroniza entre pestañas abiertas
  window.addEventListener("storage", function (e) { if (e.key === KEY) { load(); emit(); } });

  window.ElessarCart = Cart;
})();
