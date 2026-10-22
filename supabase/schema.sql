-- ============================================================================
-- Infinitum — Supabase database schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → paste → Run
-- ============================================================================

-- Make sure UUID generation is available.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- One row per restaurant/cafe using Infinitum.
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,            -- used in URLs, e.g. "green-leaf-cafe"
  name text not null,
  plan text not null default 'Free plan',
  logo_url text,
  theme jsonb,                          -- { hsl, vars, source } — see js/theme.js
  published_menu jsonb not null default '[]'::jsonb, -- what customers currently see
  created_at timestamptz not null default now()
);

-- Draft categories being edited (the "working copy"); customers never see
-- this directly — only what's been copied into restaurants.published_menu.
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Draft dishes within a category.
create table public.items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  price text,                           -- simple price, e.g. "199"
  sizes jsonb,                          -- { "S": "199", "M": "349", "L": "499" } or null
  image_url text,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Links a Supabase Auth user to a role and (if a restaurant) which one.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'restaurant')),
  restaurant_id uuid references public.restaurants(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- HELPER FUNCTIONS (security definer = bypass RLS so they don't recurse)
-- ----------------------------------------------------------------------------

create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_restaurant_id() returns uuid
language sql security definer stable as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.profiles enable row level security;

-- restaurants: published info is public (needed for the customer-facing
-- menu page); only admins or the owning restaurant can change it.
create policy "Public can read restaurants" on public.restaurants
  for select using (true);
create policy "Admins can create restaurants" on public.restaurants
  for insert with check (public.is_admin());
create policy "Admins or owner can update restaurant" on public.restaurants
  for update using (public.is_admin() or id = public.my_restaurant_id());
create policy "Admins can delete restaurants" on public.restaurants
  for delete using (public.is_admin());

-- categories: draft data — only admins or that restaurant's own account.
create policy "Admins or owner can read categories" on public.categories
  for select using (public.is_admin() or restaurant_id = public.my_restaurant_id());
create policy "Admins or owner can create categories" on public.categories
  for insert with check (public.is_admin() or restaurant_id = public.my_restaurant_id());
create policy "Admins or owner can update categories" on public.categories
  for update using (public.is_admin() or restaurant_id = public.my_restaurant_id());
create policy "Admins can delete categories" on public.categories
  for delete using (public.is_admin());

-- items: same rule, checked via the parent category's restaurant.
create policy "Admins or owner can read items" on public.items
  for select using (
    public.is_admin() or exists (
      select 1 from public.categories c
      where c.id = items.category_id and c.restaurant_id = public.my_restaurant_id()
    )
  );
create policy "Admins or owner can create items" on public.items
  for insert with check (
    public.is_admin() or exists (
      select 1 from public.categories c
      where c.id = items.category_id and c.restaurant_id = public.my_restaurant_id()
    )
  );
create policy "Admins or owner can update items" on public.items
  for update using (
    public.is_admin() or exists (
      select 1 from public.categories c
      where c.id = items.category_id and c.restaurant_id = public.my_restaurant_id()
    )
  );
create policy "Admins can delete items" on public.items
  for delete using (public.is_admin());

-- profiles: you can see your own; admins can see/manage everyone's.
create policy "Users can read their own profile" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "Admins can manage profiles" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- STORAGE (logo uploads + dish photos)
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true), ('dish-images', 'dish-images', true)
on conflict (id) do nothing;

create policy "Public can view logos" on storage.objects
  for select using (bucket_id = 'logos');
create policy "Authenticated can upload logos" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.role() = 'authenticated');
create policy "Authenticated can update logos" on storage.objects
  for update using (bucket_id = 'logos' and auth.role() = 'authenticated');

create policy "Public can view dish images" on storage.objects
  for select using (bucket_id = 'dish-images');
create policy "Authenticated can upload dish images" on storage.objects
  for insert with check (bucket_id = 'dish-images' and auth.role() = 'authenticated');
create policy "Authenticated can update dish images" on storage.objects
  for update using (bucket_id = 'dish-images' and auth.role() = 'authenticated');
