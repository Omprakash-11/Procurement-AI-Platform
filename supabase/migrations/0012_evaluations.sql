-- Backend Schema §2.10 — one per RFP; criteria state and report output
create table public.evaluations (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references public.organisations(id) on delete cascade,
  rfp_id                   uuid unique not null references public.rfps(id) on delete cascade,
  status                   public.evaluation_status not null default 'not_started',
  criteria_confirmed_at    timestamptz,
  criteria_confirmed_by    uuid references public.profiles(id) on delete set null,
  scoring_run_count        int not null default 0, -- increments on each re-score
  last_scored_at           timestamptz,
  -- Report output (AI generated)
  report_executive_summary text,
  report_recommendation    text,
  report_generated_at      timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
