-- Backend Schema §2.17 — immutable audit trail. APPEND-ONLY: no updates or deletes ever.
-- Written only by the service role from API routes (logActivity in src/lib/activity.ts).
create table public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  actor_id     uuid,          -- profiles.id or vendor_accounts.id, null for system events
  actor_type   text,          -- 'profile' / 'vendor' / 'system'
  entity_type  public.activity_entity not null,
  entity_id    uuid not null,
  action       text not null, -- e.g. 'rfp.status_changed', 'score.overridden'
  description  text not null, -- human-readable summary
  before_state jsonb,
  after_state  jsonb,
  metadata     jsonb,         -- extra context (e.g. rfp id when vendor status changes)
  created_at   timestamptz not null default now()
);

create index activity_log_org_idx on public.activity_log (org_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity_type, entity_id);
create index activity_log_actor_idx on public.activity_log (actor_id);
