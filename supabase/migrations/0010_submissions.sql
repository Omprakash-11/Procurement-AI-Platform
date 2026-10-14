-- Backend Schema §2.8 — one per vendor per RFP
create table public.submissions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  rfp_id              uuid not null references public.rfps(id) on delete cascade,
  vendor_account_id   uuid not null references public.vendor_accounts(id) on delete cascade,
  rfp_vendor_entry_id uuid not null references public.rfp_vendor_entries(id) on delete cascade,
  status              public.submission_status not null default 'in_progress',
  submitted_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (rfp_id, vendor_account_id) -- one submission per vendor per RFP
);

create index submissions_vendor_idx on public.submissions (vendor_account_id);
