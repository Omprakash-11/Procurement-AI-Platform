-- Backend Schema §2.9 — uploaded files + AI extraction results
create table public.documents (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references public.organisations(id) on delete cascade,
  submission_id           uuid not null references public.submissions(id) on delete cascade,
  file_name               text not null,
  file_type               public.document_type not null,
  file_size_bytes         bigint not null,
  storage_path            text not null, -- Supabase Storage path
  extraction_status       public.extraction_status not null default 'queued',
  extraction_error        text,          -- error message if failed
  extraction_attempts     int not null default 0,
  last_extracted_at       timestamptz,
  -- Raw AI output
  raw_extraction          jsonb,         -- full Gemini JSON response
  -- Promoted key fields (queryable columns)
  extracted_vendor_name   text,
  extracted_pricing       text,
  extracted_payment_terms text,
  extracted_delivery      text,
  extracted_sla           text,
  extracted_warranty      text,
  extracted_termination   text,
  extracted_data_privacy  text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index documents_submission_idx on public.documents (submission_id);
create index documents_extraction_status_idx on public.documents (extraction_status);
