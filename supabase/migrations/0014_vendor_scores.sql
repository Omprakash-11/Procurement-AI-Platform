-- Backend Schema §2.12 — AI score + PM override per criterion per vendor; both stored
create table public.vendor_scores (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organisations(id) on delete cascade,
  evaluation_id          uuid not null references public.evaluations(id) on delete cascade,
  criterion_id           uuid not null references public.evaluation_criteria(id) on delete cascade,
  vendor_account_id      uuid not null references public.vendor_accounts(id) on delete cascade,
  scoring_run            int not null default 1, -- matches evaluations.scoring_run_count
  -- AI score
  ai_score               numeric(4,2),           -- 0.00 to 10.00
  ai_reasoning           text,
  ai_scored_at           timestamptz,
  -- PM override
  override_score         numeric(4,2),           -- 0.00 to 10.00, null if not overridden
  override_justification text,
  overridden_by          uuid references public.profiles(id) on delete set null,
  overridden_at          timestamptz,
  -- Effective score
  effective_score        numeric(4,2) generated always as (coalesce(override_score, ai_score)) stored,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (evaluation_id, criterion_id, vendor_account_id, scoring_run)
);

create index vendor_scores_vendor_idx on public.vendor_scores (vendor_account_id);
