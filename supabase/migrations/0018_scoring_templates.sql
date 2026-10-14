-- Backend Schema §2.16 — org-level reusable criteria templates
create table public.scoring_templates (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  created_by   uuid not null references public.profiles(id) on delete no action,
  name         text not null,
  criteria     jsonb not null, -- array of {name, description, weight, sort_order}
  last_used_at timestamptz,
  is_deleted   boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index scoring_templates_org_idx on public.scoring_templates (org_id) where is_deleted = false;
