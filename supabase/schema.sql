-- ============================================================================
-- ELESSÄR — Esquema de base de datos (Supabase / PostgreSQL)
-- ----------------------------------------------------------------------------
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar TODO → Run.
-- Es idempotente: se puede volver a correr sin romper nada.
-- Después corré supabase/seed.sql para cargar el contenido inicial.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. ADMINISTRADORES
--    Solo los usuarios listados acá pueden editar contenido desde /admin.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Utilidad: mantener updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------------------
-- 2. CONTENIDO
-- ---------------------------------------------------------------------------

-- Ajustes generales clave → JSON (hero, bio, socials, media, contact, press, shop)
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Avisos destacados de la home ("¡Nuevo disco ya disponible!")
create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  text       text not null check (char_length(text) <= 220),
  link_url   text,
  link_label text,
  style      text not null default 'gold' check (style in ('gold','teal','blood')),
  active     boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id        uuid primary key default gen_random_uuid(),
  name      text not null default '',
  role      text not null,
  photo_url text,
  bio       text,
  sort      int not null default 0,
  active    boolean not null default true
);

create table if not exists public.releases (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  type              text not null default 'Álbum',
  year              int,
  cover_url         text,
  description       text,
  spotify_url       text,
  bandcamp_album_id text,
  bandcamp_url      text,
  youtube_url       text,
  tracks            jsonb not null default '[]'::jsonb,
  sort              int not null default 0,
  published         boolean not null default true
);

create table if not exists public.shows (
  id         uuid primary key default gen_random_uuid(),
  date       timestamptz not null,
  city       text not null,
  venue      text,
  country    text not null default 'AR',
  ticket_url text,
  status     text not null default 'on_sale' check (status in ('on_sale','soon','sold_out','free','cancelled')),
  notes      text,
  published  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id        uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption   text,
  sort      int not null default 0
);

-- ---------------------------------------------------------------------------
-- 3. TIENDA
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  category         text not null check (category in ('remeras','musica','accesorios')),
  description      text,
  price            numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  images           jsonb not null default '[]'::jsonb,   -- ["https://…/foto1.webp", …]
  featured         boolean not null default false,
  active           boolean not null default true,
  sort             int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- Cada producto tiene 1 o más variantes (talle/color). Un CD tiene una sola
-- variante sin talle ni color, que es la que guarda su stock.
create table if not exists public.product_variants (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  size           text,
  color          text,
  color_hex      text,
  sku            text,
  stock          int not null default 0 check (stock >= 0),
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  sort           int not null default 0
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'pending'
                check (status in ('pending','paid','shipped','delivered','cancelled','refunded')),
  customer      jsonb not null,               -- nombre, email, teléfono, dirección…
  items         jsonb not null,               -- [{variant_id, product_id, name, variant_label, qty, unit_price}]
  shipping      jsonb,                        -- {id, label, cost}
  subtotal      numeric(12,2) not null,
  shipping_cost numeric(12,2) not null default 0,
  total         numeric(12,2) not null,
  currency      text not null default 'ARS',
  provider      text,                         -- mercadopago | stripe
  provider_ref  text,                         -- id de preferencia / pago / sesión
  paid_at       timestamptz,
  stock_applied boolean not null default false,
  admin_notes   text
);
create index if not exists orders_created_idx on public.orders(created_at desc);

-- ---------------------------------------------------------------------------
-- 4. MENSAJES DEL FORMULARIO DE CONTACTO
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 120),
  email      text not null check (char_length(email) between 3 and 200 and email like '%@%'),
  subject    text check (char_length(subject) <= 60),
  body       text not null check (char_length(body) between 1 and 5000),
  read       boolean not null default false
);

-- ---------------------------------------------------------------------------
-- 5. PAGO CONFIRMADO → marcar orden pagada y descontar stock (atómico)
--    Solo la llama la Edge Function "payment-webhook" con la service_role.
-- ---------------------------------------------------------------------------
create or replace function public.apply_paid_order(p_order_id uuid, p_provider_ref text)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  o public.orders;
  it jsonb;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then return false; end if;
  if o.stock_applied then return true; end if;           -- idempotente (webhooks repetidos)

  for it in select * from jsonb_array_elements(o.items) loop
    update public.product_variants
       set stock = greatest(stock - (it->>'qty')::int, 0)
     where id = (it->>'variant_id')::uuid;
  end loop;

  update public.orders
     set status = case when status = 'pending' then 'paid' else status end,
         paid_at = coalesce(paid_at, now()),
         provider_ref = coalesce(p_provider_ref, provider_ref),
         stock_applied = true
   where id = p_order_id;
  return true;
end; $$;

revoke all on function public.apply_paid_order(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. SEGURIDAD: Row Level Security
--    Público: solo lectura de lo publicado. Admins: todo. Mensajes: insertar.
-- ---------------------------------------------------------------------------
alter table public.admins           enable row level security;
alter table public.settings         enable row level security;
alter table public.announcements    enable row level security;
alter table public.members          enable row level security;
alter table public.releases         enable row level security;
alter table public.shows            enable row level security;
alter table public.gallery          enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.messages         enable row level security;

do $$
declare t text;
begin
  -- borrar políticas previas para poder re-ejecutar el script
  for t in select unnest(array['admins','settings','announcements','members','releases','shows','gallery','products','product_variants','orders','messages']) loop
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
  end loop;
end $$;
drop policy if exists "anyone can send" on public.messages;
drop policy if exists "self read" on public.admins;

-- Lectura pública
create policy "public read" on public.settings         for select using (true);
create policy "public read" on public.announcements    for select using (active or public.is_admin());
create policy "public read" on public.members          for select using (active or public.is_admin());
create policy "public read" on public.releases         for select using (published or public.is_admin());
create policy "public read" on public.shows            for select using (published or public.is_admin());
create policy "public read" on public.gallery          for select using (true);
create policy "public read" on public.products         for select using (active or public.is_admin());
create policy "public read" on public.product_variants for select using (
  public.is_admin() or exists (select 1 from public.products p where p.id = product_id and p.active)
);

-- Escritura solo admins
create policy "admin all" on public.settings         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.announcements    for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.members          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.releases         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.shows            for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.gallery          for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.products         for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.product_variants for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.orders           for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all" on public.messages         for all using (public.is_admin()) with check (public.is_admin());

-- Formulario de contacto: cualquiera puede insertar (no leer)
create policy "anyone can send" on public.messages for insert to anon, authenticated with check (read = false);

-- Un usuario puede ver si él mismo es admin
create policy "self read" on public.admins for select using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. ALMACENAMIENTO DE IMÁGENES (bucket público "media")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media public read" on storage.objects;
drop policy if exists "media admin insert" on storage.objects;
drop policy if exists "media admin update" on storage.objects;
drop policy if exists "media admin delete" on storage.objects;

create policy "media public read"  on storage.objects for select using (bucket_id = 'media');
create policy "media admin insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media admin update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media admin delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());
