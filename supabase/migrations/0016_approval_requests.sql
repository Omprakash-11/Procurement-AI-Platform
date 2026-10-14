-- Backend Schema §2.14 — one record per submission cycle; new record on each re-submission
create table public.approval_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organisations(id) on delete cascade,
  rfp_id            uuid not null references public.rfps(id) on delete cascade,
  vendor_account_id uuid not null references public.vendor_accounts(id) on delete cascade,
  evaluation_id     uuid not null references public.evaluations(id) on delete cascade,
  submitted_by      uuid not null references public.profiles(id) on delete no action,
  submitted_to      uuid not null references public.profiles(id) on delete no action,
  status            public.approval_status not null default 'pending',
  sla_due_at        timestamptz not null, -- submitted_at + 3 business days
  decision_comment  text,
  rejection_reason  public.rejection_reason,
  decided_by        uuid references public.profiles(id) on delete set null,
  decided_at        timestamptz,
  recalled_at       timestamptz,
  recalled_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Only one pending approval per RFP at a time
create unique index one_pending_approval_per_rfp
  on public.approval_requests (rfp_id)
  where status = 'pending';

create index approval_requests_org_status_idx on public.approval_requests (org_id, status);
