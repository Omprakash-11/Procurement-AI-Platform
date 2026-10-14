-- Backend Schema §2.5. Decision P2-7: NOT NULL author FK restricts deletes (NO ACTION).
-- Decision P2-8: the linked_rfp_id FK is added in 0007 once public.rfps exists.
create table public.requirements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  raised_by       uuid not null references public.profiles(id) on delete no action,
  title           text not null,
  description     text not null,
  department      text not null,
  budget_estimate numeric(15,2),
  required_by     date,
  priority        public.requirement_priority not null default 'medium',
  status          public.requirement_status not null default 'draft',
  linked_rfp_id   uuid,
  is_deleted      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index requirements_org_status_idx on public.requirements (org_id, status) where is_deleted = false;
create index requirements_raised_by_idx on public.requirements (raised_by);
