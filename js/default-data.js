/* ==========================================================================
   ELESSÄR — Contenido por defecto (modo demo / respaldo)
   --------------------------------------------------------------------------
   Se usa cuando Supabase no está configurado o no responde.
   Tiene la MISMA forma que las tablas de supabase/schema.sql, así el código
   de las páginas no distingue de dónde vienen los datos.

   ⚠ Precios, stock, nombres de integrantes y fechas futuras son de EJEMPLO.
     Una vez conectada la base, todo se edita desde /admin.
   ========================================================================== */
(function () {
  "use strict";

  var IMG = "assets/img/";

  window.ELESSAR_DEFAULTS = {
    /* ---------- Ajustes generales (tabla settings) ---------- */
    settings: {
      hero: {
        tagline: "Metal sinfónico · Patagonia",
        title: "Desde Neuquén, al borde del Kósmos.",
        image: IMG + "live-stage-blue.webp",
        video: "",                         // opcional: "assets/video/hero-kosmos.mp4" (el video ya trae el logo)
        cta_primary_label: "Escuchar",
        cta_primary_url: "musica.html",
        cta_secondary_label: "Tienda oficial",
        cta_secondary_url: "tienda.html"
      },
      bio: {
        short: "Elessär nace en julio de 2007 en Neuquén, en la Patagonia argentina. Metal sinfónico de composición propia, con arreglos orquestales y melodías que miran a la gran tradición europea del género sin dejar de sonar a este lado del mundo.",
        long: [
          "Elessär nace en julio de 2007 en Neuquén, en la Patagonia argentina, con una idea clara: hacer metal sinfónico de composición propia, con arreglos orquestales y melódicos que dialogan con la escuela europea del género.",
          "En 2013 la banda edita Dark Desires, su primer disco. El trabajo recibe reseñas muy positivas en medios especializados de Bélgica, Inglaterra y Estados Unidos, entre otros países, y lleva el nombre de Elessär más allá de la Patagonia.",
          "En 2019 llega Kósmos, su primer álbum conceptual. Si el cosmos suele pensarse como el universo exterior, aquí la mirada se vuelve hacia adentro: el autoconocimiento y la introspección como otra forma de orden y armonía, hasta el punto en que se disuelve la distinción entre el mundo y el yo.",
          "Con reconocimientos a nivel nacional e internacional, la banda sigue explorando territorios propios, como su reinterpretación de «Por una cabeza», el clásico de Carlos Gardel, llevado al lenguaje del metal sinfónico."
        ],
        timeline: [
          { year: "2007", text: "Formación de la banda en Neuquén, Patagonia argentina." },
          { year: "2013", text: "Dark Desires, primer disco. Reseñas en medios de Bélgica, Inglaterra y EE. UU." },
          { year: "2019", text: "Kósmos, primer álbum conceptual: doce piezas sobre el universo interior." },
          { year: "2023", text: "Décimo aniversario del ciclo Capital Acústica, Museo Nacional de Bellas Artes de Neuquén." },
          { year: "Hoy", text: "«Por una cabeza» (C. Gardel) en versión Elessär, y nuevas canciones en camino." }
        ],
        image: IMG + "band-promo.webp"
      },
      socials: {
        spotify: "https://open.spotify.com/artist/3Q89babzF4j6t0kP7gfUL6",
        youtube: "https://www.youtube.com/channel/UCDrV_jh5gi7aL-ciIQqId9w",
        bandcamp: "https://elessarband.bandcamp.com/",
        instagram: "",
        facebook: "",
        tiktok: ""
      },
      media: {
        spotify_artist_id: "3Q89babzF4j6t0kP7gfUL6",
        youtube_channel_id: "UCDrV_jh5gi7aL-ciIQqId9w",
        youtube_featured_video: "",          // ID de un video puntual (opcional)
        featured_release_slug: "por-una-cabeza"
      },
      contact: {
        email: "",              // contacto general
        booking_email: "",
        press_email: "",
        location: "Neuquén, Patagonia, Argentina"
      },
      press: {
        epk_url: "assets/epk/elessar-epk.pdf",
        photos_zip_url: ""
      },
      shop: {
        shipping_options: [
          { id: "pickup", label: "Retiro en Neuquén capital", description: "Coordinamos por mail o WhatsApp", price: 0 },
          { id: "national", label: "Envío a todo el país", description: "Correo Argentino / Andreani · 3 a 7 días hábiles", price: 6500 }
        ],
        note: "Los pedidos se despachan dentro de las 72 h hábiles de acreditado el pago."
      }
    },

    /* ---------- Avisos destacados (tabla announcements) ---------- */
    announcements: [
      { id: "a1", text: "«Por una cabeza» (C. Gardel) en versión Elessär — ya disponible", link_url: "musica.html", link_label: "Escuchar", style: "gold", active: true, sort: 1 }
    ],

    /* ---------- Integrantes (tabla members) ---------- */
    members: [
      { id: "m1", name: "", role: "Voz", photo_url: IMG + "live-bw-vocal.webp", bio: "", sort: 1, active: true },
      { id: "m2", name: "", role: "Guitarra", photo_url: IMG + "live-guitar-blue.webp", bio: "", sort: 2, active: true },
      { id: "m3", name: "", role: "Guitarra", photo_url: IMG + "live-bw-duo.webp", bio: "", sort: 3, active: true },
      { id: "m4", name: "", role: "Bajo", photo_url: IMG + "live-full-red.webp", bio: "", sort: 4, active: true },
      { id: "m5", name: "", role: "Teclados", photo_url: IMG + "live-keys.webp", bio: "", sort: 5, active: true },
      { id: "m6", name: "", role: "Batería", photo_url: IMG + "live-drums.webp", bio: "", sort: 6, active: true }
    ],

    /* ---------- Discografía (tabla releases) ---------- */
    releases: [
      {
        id: "r3", slug: "por-una-cabeza", title: "Por una cabeza", type: "Single", year: 2024,
        cover_url: IMG + "cover-por-una-cabeza.webp",
        description: "El tango de Carlos Gardel y Alfredo Le Pera, reimaginado con orquesta, guitarras y la voz de Elessär. Un puente entre el Río de la Plata y la tradición sinfónica.",
        spotify_url: "https://open.spotify.com/artist/3Q89babzF4j6t0kP7gfUL6",
        bandcamp_album_id: "", bandcamp_url: "",
        youtube_url: "https://www.youtube.com/channel/UCDrV_jh5gi7aL-ciIQqId9w",
        tracks: ["Por una cabeza (C. Gardel)"], sort: 1, published: true
      },
      {
        id: "r2", slug: "kosmos", title: "Kósmos", type: "Álbum", year: 2019,
        cover_url: IMG + "cover-kosmos.webp",
        description: "El primer álbum conceptual de la banda. Para los antiguos griegos, κόσμος nombraba la armonía y el orden del universo. Kósmos propone el viaje inverso: hacia adentro, hacia el autoconocimiento, hasta que se borra la frontera entre el mundo y el yo.",
        spotify_url: "https://open.spotify.com/artist/3Q89babzF4j6t0kP7gfUL6",
        bandcamp_album_id: "2029945776", bandcamp_url: "https://elessarband.bandcamp.com/album/k-smos",
        youtube_url: "https://www.youtube.com/channel/UCDrV_jh5gi7aL-ciIQqId9w",
        tracks: ["Ultimate Escape", "Impetus", "Introducing the Majestic", "Afraid", "Eternity", "Kósmos", "Inside", "The Way", "What precedes us", "Be Still", "Truth", "Inside the Kósmos"],
        sort: 2, published: true
      },
      {
        id: "r1", slug: "dark-desires", title: "Dark Desires", type: "Álbum", year: 2013,
        cover_url: IMG + "cover-dark-desires.webp",
        description: "El disco debut. Gótico, melódico y orquestal, recibió reseñas muy positivas en medios especializados de Bélgica, Inglaterra y Estados Unidos.",
        spotify_url: "https://open.spotify.com/artist/3Q89babzF4j6t0kP7gfUL6",
        bandcamp_album_id: "", bandcamp_url: "https://elessarband.bandcamp.com/",
        youtube_url: "https://www.youtube.com/channel/UCDrV_jh5gi7aL-ciIQqId9w",
        tracks: [], sort: 3, published: true
      }
    ],

    /* ---------- Fechas (tabla shows) ---------- */
    shows: [
      { id: "s1", date: "2026-12-05T21:00:00-03:00", city: "Neuquén", venue: "Fecha de ejemplo · editar desde el panel", country: "AR", ticket_url: "#", status: "on_sale", notes: "", published: true },
      { id: "s2", date: "2027-02-20T21:30:00-03:00", city: "General Roca", venue: "Fecha de ejemplo · editar desde el panel", country: "AR", ticket_url: "", status: "soon", notes: "", published: true },
      { id: "s0", date: "2023-07-21T20:00:00-03:00", city: "Neuquén", venue: "Museo Nacional de Bellas Artes · Ciclo Capital Acústica (10 años) — junto a Dorsal", country: "AR", ticket_url: "", status: "free", notes: "Entrada libre y gratuita", published: true }
    ],

    /* ---------- Galería (tabla gallery) ---------- */
    gallery: [
      { id: "g1", image_url: IMG + "live-vocal-logo.webp", caption: "En vivo", sort: 1 },
      { id: "g2", image_url: IMG + "live-bw-duo.webp", caption: "En vivo", sort: 2 },
      { id: "g3", image_url: IMG + "live-stage-blue.webp", caption: "En vivo", sort: 3 },
      { id: "g4", image_url: IMG + "band-backstage.webp", caption: "Backstage", sort: 4 },
      { id: "g5", image_url: IMG + "live-red-smoke.webp", caption: "En vivo", sort: 5 },
      { id: "g6", image_url: IMG + "live-drums.webp", caption: "En vivo", sort: 6 },
      { id: "g7", image_url: IMG + "live-stage-wide.webp", caption: "En vivo", sort: 7 },
      { id: "g8", image_url: IMG + "live-vocal-red.webp", caption: "En vivo", sort: 8 },
      { id: "g9", image_url: IMG + "band-crowd.webp", caption: "Con el público", sort: 9 },
      { id: "g10", image_url: IMG + "live-bw-vocal.webp", caption: "En vivo", sort: 10 },
      { id: "g11", image_url: IMG + "live-keys.webp", caption: "En vivo", sort: 11 },
      { id: "g12", image_url: IMG + "por-una-cabeza-studio.webp", caption: "Grabando «Por una cabeza»", sort: 12 }
    ],

    /* ---------- Productos (tablas products + product_variants) ---------- */
    products: [
      {
        id: "p1", slug: "remera-dark-desires", name: "Remera Dark Desires", category: "remeras",
        description: "Remera negra de algodón peinado 24/1 con el arte de Dark Desires: la escalinata gótica y el logo en tonos hueso y oro viejo. Estampa frontal en serigrafía de alta definición.",
        price: 25000, compare_at_price: null, featured: true, active: true, sort: 1,
        images: [IMG + "tee-dark-desires.webp", IMG + "art-dark-desires.webp"],
        variants: [
          { id: "p1-s", size: "S", color: "Negro", color_hex: "#0b0b0c", stock: 4 },
          { id: "p1-m", size: "M", color: "Negro", color_hex: "#0b0b0c", stock: 8 },
          { id: "p1-l", size: "L", color: "Negro", color_hex: "#0b0b0c", stock: 6 },
          { id: "p1-xl", size: "XL", color: "Negro", color_hex: "#0b0b0c", stock: 2 },
          { id: "p1-xxl", size: "XXL", color: "Negro", color_hex: "#0b0b0c", stock: 0 }
        ]
      },
      {
        id: "p2", slug: "remera-kosmos", name: "Remera Kósmos", category: "remeras",
        description: "El universo interior de Kósmos en una remera negra de algodón peinado. Arte en cian y plata, logo plateado y la leyenda KÓSMOS al pie.",
        price: 25000, compare_at_price: null, featured: true, active: true, sort: 2,
        images: [IMG + "art-kosmos.webp", IMG + "cover-kosmos.webp"],
        variants: [
          { id: "p2-s", size: "S", color: "Negro", color_hex: "#0b0b0c", stock: 5 },
          { id: "p2-m", size: "M", color: "Negro", color_hex: "#0b0b0c", stock: 10 },
          { id: "p2-l", size: "L", color: "Negro", color_hex: "#0b0b0c", stock: 7 },
          { id: "p2-xl", size: "XL", color: "Negro", color_hex: "#0b0b0c", stock: 3 }
        ]
      },
      {
        id: "p3", slug: "cd-kosmos", name: "CD Kósmos", category: "musica",
        description: "Edición física del álbum conceptual Kósmos (2019). Doce temas, de «Ultimate Escape» a «Inside the Kósmos».",
        price: 15000, compare_at_price: null, featured: true, active: true, sort: 3,
        images: [IMG + "cover-kosmos.webp", IMG + "hero-kosmos.webp"],
        variants: [{ id: "p3-u", size: null, color: null, color_hex: null, stock: 20 }]
      },
      {
        id: "p4", slug: "cd-dark-desires", name: "CD Dark Desires", category: "musica",
        description: "El disco debut de Elessär (2013), en formato físico. Últimas unidades de la tirada original.",
        price: 12000, compare_at_price: 14000, featured: false, active: true, sort: 4,
        images: [IMG + "cover-dark-desires.webp", IMG + "art-dark-desires.webp"],
        variants: [{ id: "p4-u", size: null, color: null, color_hex: null, stock: 3 }]
      },
      {
        id: "p5", slug: "lamina-dark-desires", name: "Lámina Dark Desires", category: "accesorios",
        description: "Impresión giclée sobre papel de algodón con el arte completo de Dark Desires. Se envía enrollada en tubo rígido.",
        price: 9000, compare_at_price: null, featured: false, active: true, sort: 5,
        images: [IMG + "art-dark-desires.webp", IMG + "cover-dark-desires.webp"],
        variants: [
          { id: "p5-a3", size: "A3", color: null, color_hex: null, stock: 10, price_override: null },
          { id: "p5-a2", size: "A2", color: null, color_hex: null, stock: 5, price_override: 14000 }
        ]
      },
      {
        id: "p6", slug: "parche-logo", name: "Parche bordado · Logo", category: "accesorios",
        description: "Parche bordado con el logo de Elessär en hilo plateado sobre fondo negro. Para coser en campera, mochila o chaleco.",
        price: 6000, compare_at_price: null, featured: false, active: true, sort: 6,
        images: [IMG + "logo-cathedral.webp", IMG + "logo.webp"],
        variants: [{ id: "p6-u", size: null, color: null, color_hex: null, stock: 25 }]
      }
    ]
  };

  /* Categorías de la tienda (clave → etiqueta visible) */
  window.ELESSAR_CATEGORIES = {
    remeras: "Remeras",
    musica: "CDs y vinilos",
    accesorios: "Accesorios"
  };
})();
