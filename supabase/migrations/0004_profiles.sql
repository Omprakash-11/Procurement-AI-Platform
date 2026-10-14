-- Backend Schema §2.2 — extends auth.users, internal users only
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  org_id              uuid not null references public.organisations(id) on delete cascade,
  full_name           text not null,
  role                public.user_role not null,
  avatar_url          text,
  is_active           boolean not null default true,
  onboarding_complete boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Exactly one active PM per org
create unique index one_pm_per_org
  on public.profiles (org_id)
  where role = 'procurement_manager' and is_active = true;

create index profiles_org_idx on public.profiles (org_id);
