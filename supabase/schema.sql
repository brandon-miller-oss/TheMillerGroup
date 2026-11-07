-- =====================================================================
-- The Miller Group: database setup
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Who is an admin ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

drop policy if exists "admins read self" on public.admins;
create policy "admins read self" on public.admins for select to authenticated using (user_id = auth.uid());

-- ---------- Leads (the CRM) ----------
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  email text not null check (char_length(email) between 3 and 320),
  phone text check (phone is null or char_length(phone) <= 40),
  interest text check (interest is null or char_length(interest) <= 120),
  message text check (message is null or char_length(message) <= 5000),
  address text check (address is null or char_length(address) <= 300),
  extra jsonb,
  source text,
  landing_slug text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referrer text,
  stage text not null default 'new'
    check (stage in ('new','contacted','nurturing','meeting','under_contract','closed','lost')),
  budget text,
  deal_value numeric,
  next_follow_up date,
  tags text[] not null default '{}'
);
create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_stage_idx on public.leads (stage);
alter table public.leads enable row level security;

-- Anyone can submit a lead, but only as a brand new lead with no admin-only fields.
drop policy if exists "public can submit leads" on public.leads;
create policy "public can submit leads" on public.leads for insert to anon, authenticated
  with check (stage = 'new' and deal_value is null and next_follow_up is null and tags = '{}');
-- Only admins can read, change or delete leads.
drop policy if exists "admins manage leads" on public.leads;
create policy "admins manage leads" on public.leads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null default 'note',
  body text not null
);
create index if not exists lead_notes_lead_idx on public.lead_notes (lead_id, created_at desc);
alter table public.lead_notes enable row level security;
drop policy if exists "admins manage notes" on public.lead_notes;
create policy "admins manage notes" on public.lead_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  due_date date,
  done boolean not null default false,
  lead_id uuid references public.leads(id) on delete set null
);
alter table public.tasks enable row level security;
drop policy if exists "admins manage tasks" on public.tasks;
create policy "admins manage tasks" on public.tasks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Landing pages (ads, events, open houses) ----------
create table if not exists public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  title text not null,
  headline text not null,
  subheadline text,
  body_md text,
  cta_text text not null default 'Send',
  interest text,
  event_date text,
  event_location text,
  hero_image_url text,
  theme text not null default 'light' check (theme in ('light','dark')),
  thank_you_message text,
  redirect_url text,
  seo_title text,
  seo_description text,
  noindex boolean not null default true,
  published boolean not null default false
);
alter table public.landing_pages enable row level security;
drop policy if exists "public reads live landing pages" on public.landing_pages;
create policy "public reads live landing pages" on public.landing_pages for select to anon, authenticated
  using (published = true);
drop policy if exists "admins manage landing pages" on public.landing_pages;
create policy "admins manage landing pages" on public.landing_pages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Listings ----------
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','coming_soon','sold')),
  title text not null,
  address text,
  city text,
  price numeric,
  beds numeric,
  baths numeric,
  sqft integer,
  photo_url text,
  link_url text,
  featured boolean not null default false,
  published boolean not null default false
);
alter table public.listings enable row level security;
drop policy if exists "public reads live listings" on public.listings;
create policy "public reads live listings" on public.listings for select to anon, authenticated
  using (published = true);
drop policy if exists "admins manage listings" on public.listings;
create policy "admins manage listings" on public.listings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Blog ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,100}$'),
  title text not null,
  excerpt text,
  category text not null default 'Buying and selling tips'
    check (category in ('Buying and selling tips','Neighborhood news')),
  cover_url text,
  body text not null default '',
  seo_title text,
  seo_description text,
  published boolean not null default false,
  published_at timestamptz
);
alter table public.posts enable row level security;
drop policy if exists "public reads live posts" on public.posts;
create policy "public reads live posts" on public.posts for select to anon, authenticated
  using (published = true);
drop policy if exists "admins manage posts" on public.posts;
create policy "admins manage posts" on public.posts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- Testimonials ----------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  quote text not null,
  author text not null,
  location text,
  published boolean not null default false
);
alter table public.testimonials enable row level security;
drop policy if exists "public reads live testimonials" on public.testimonials;
create policy "public reads live testimonials" on public.testimonials for select to anon, authenticated
  using (published = true);
drop policy if exists "admins manage testimonials" on public.testimonials;
create policy "admins manage testimonials" on public.testimonials for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- AFTER running this file, make yourself an admin:
--   1. Supabase > Authentication > Users > Add user (your email + a strong password)
--   2. Run this, using that same email:
--        insert into public.admins (user_id)
--        select id from auth.users where email = 'you@yourdomain.com';
--   3. Supabase > Authentication > Sign In / Providers: turn OFF "Allow new users to sign up".
-- =====================================================================
