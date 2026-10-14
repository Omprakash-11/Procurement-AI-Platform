-- Backend Schema §2.6 — core procurement event
create table public.rfps (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  created_by          uuid not null references public.profiles(id) on delete no action,
  requirement_id      uuid references public.requirements(id) on delete set null,
  title               text not null,
  description         text not null,
  department          text not null,
  budget_min          numeric(15,2),
  budget_max          numeric(15,2),
  submission_deadline timestamptz,
  status              public.rfp_status not null default 'rfp_created',
  is_deleted          boolean not null default false,
  -- Full-text search
  search_vector       tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(department, ''))
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index rfps_search_idx on public.rfps using gin (search_vector);
create index rfps_org_status_idx on public.rfps (org_id, status) where is_deleted = false;
create index rfps_requirement_idx on public.rfps (requirement_id);

-- Decision P2-8 (#9): requirements ↔ rfps reference each other; close the loop now.
alter table public.requirements
  add constraint requirements_linked_rfp_id_fkey
  foreign key (linked_rfp_id) references public.rfps(id) on delete set null;
