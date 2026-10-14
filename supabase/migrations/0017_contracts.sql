-- Backend Schema §2.15 — created automatically on approval; one per vendor per RFP.
-- Decision P2-7: rfp_id / approval_request_id are NOT NULL with NO ACTION (was SET NULL).
create table public.contracts (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  rfp_id              uuid not null references public.rfps(id) on delete no action,
  vendor_account_id   uuid not null references public.vendor_accounts(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete no action,
  title               text not null,
  value               numeric(15,2),
  currency            text not null default 'USD',
  payment_terms       text,
  start_date          date not null,
  end_date            date not null,
  alert_days          int not null default 90, -- renewal alert threshold
  status              public.contract_status not null default 'active',
  document_path       text,                    -- Supabase Storage path for contract file
  terminated_at       timestamptz,
  terminated_by       uuid references public.profiles(id) on delete set null,
  termination_reason  text,
  is_deleted          boolean not null default false,
  -- Full-text search
  search_vector       tsvector generated always as (to_tsvector('english', coalesce(title, ''))) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (rfp_id, vendor_account_id)
);

create index contracts_search_idx on public.contracts using gin (search_vector);
create index contracts_end_date_idx on public.contracts (end_date, status) where is_deleted = false;
