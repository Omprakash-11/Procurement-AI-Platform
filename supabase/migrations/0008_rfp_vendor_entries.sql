-- Backend Schema §2.7 — one row per vendor per RFP, tracks pipeline stage
create table public.rfp_vendor_entries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organisations(id) on delete cascade,
  rfp_id            uuid not null references public.rfps(id) on delete cascade,
  vendor_account_id uuid not null references public.vendor_accounts(id) on delete cascade,
  status            public.vendor_pipeline_status not null default 'invited',
  is_shortlisted    boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (rfp_id, vendor_account_id)
);

create index rfp_vendor_entries_vendor_idx on public.rfp_vendor_entries (vendor_account_id);
