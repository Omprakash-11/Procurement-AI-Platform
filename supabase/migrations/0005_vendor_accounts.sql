-- Backend Schema §2.3 + §7 search vector.
-- Decision P2-3: one row per (org, email), reused across that org's RFPs.
-- One auth user may own rows in several orgs.
create table public.vendor_accounts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  auth_user_id  uuid references auth.users(id) on delete set null, -- null until invite accepted
  company_name  text not null,
  contact_name  text not null,
  email         text not null,
  is_active     boolean not null default false, -- true after invite accepted
  is_deleted    boolean not null default false,
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(company_name, '') || ' ' || coalesce(contact_name, ''))
  ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Prevent duplicate vendor email per org
create unique index vendor_email_per_org
  on public.vendor_accounts (org_id, lower(email))
  where is_deleted = false;

create index vendor_accounts_auth_user_idx on public.vendor_accounts (auth_user_id);
create index vendor_accounts_search_idx on public.vendor_accounts using gin (search_vector);
