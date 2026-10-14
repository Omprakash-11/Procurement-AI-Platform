-- Backend Schema §2.11 — weights must sum to 100 per evaluation (trigger in 0023 + app check)
create table public.evaluation_criteria (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  evaluation_id   uuid not null references public.evaluations(id) on delete cascade,
  name            text not null,
  description     text,
  weight          numeric(5,2) not null, -- percentage
  sort_order      int not null default 0,
  is_ai_suggested boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index evaluation_criteria_evaluation_idx on public.evaluation_criteria (evaluation_id);
