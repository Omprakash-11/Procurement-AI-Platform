-- Backend Schema §2.13 — AI-detected risks, one row per flag per document
create table public.compliance_flags (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  document_id     uuid not null references public.documents(id) on delete cascade,
  flag_type       public.flag_type not null,
  severity        public.flag_severity not null,
  clause_text     text,          -- relevant excerpt from the document
  explanation     text not null, -- AI explanation of the risk
  status          public.flag_status not null default 'open',
  acknowledged_by uuid references public.profiles(id) on delete set null,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index compliance_flags_document_idx on public.compliance_flags (document_id);
create index compliance_flags_status_idx on public.compliance_flags (status, severity);
