-- Backend Schema §2.1 — top-level tenant
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,         -- URL-safe identifier
  logo_url    text,                         -- Supabase Storage path
  currency    text not null default 'USD',
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
