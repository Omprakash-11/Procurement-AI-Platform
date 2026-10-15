-- Phase 8 schema additions (TODO.md decisions P8-3, P8-4). Not in the Backend Schema.

-- ── P8-3 report_comments: DH recommendation comments on a comparison report (App Flow §5) ──
create table public.report_comments (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  rfp_id      uuid not null references public.rfps(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete no action,
  body        text not null check (length(trim(body)) between 1 and 5000),
  created_at  timestamptz not null default now()
);
create index report_comments_rfp_idx on public.report_comments (rfp_id, created_at);
alter table public.report_comments enable row level security;

-- Read: anyone internal who may read the RFP (PM; the requirement's DH; an FA with an approval).
create policy report_comments_read on public.report_comments
  for select using (org_id = public.get_org_id() and public.is_internal() and public.can_read_rfp(rfp_id));
-- Write: only the DH whose requirement the RFP answers (can_read_rfp scopes a DH to exactly that).
create policy report_comments_dh_insert on public.report_comments
  for insert with check (
    org_id = public.get_org_id()
    and public.get_user_role() = 'department_head'
    and author_id = auth.uid()
    and public.can_read_rfp(rfp_id)
  );
-- Append-only.
revoke update, delete on public.report_comments from anon, authenticated;

create trigger report_comments_same_org before insert or update on public.report_comments
  for each row execute function public.enforce_same_org('rfp_id', 'rfps', 'author_id', 'profiles');

-- ── P8-4 requirement_attachments: reference documents on a requirement (App Flow §5) ──
-- Files live in the private org-assets bucket at {org_id}/requirements/{requirement_id}/…;
-- that bucket has no storage policies, so files are reached only through API routes
-- (signed URLs after the access check). Rows are written by those routes (service role).
create table public.requirement_attachments (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organisations(id) on delete cascade,
  requirement_id  uuid not null references public.requirements(id) on delete cascade,
  uploaded_by     uuid not null references public.profiles(id) on delete no action,
  file_name       text not null,
  file_type       public.document_type not null,
  file_size_bytes bigint not null check (file_size_bytes between 1 and 20971520), -- 20MB
  storage_path    text unique not null,
  created_at      timestamptz not null default now()
);
create index requirement_attachments_req_idx on public.requirement_attachments (requirement_id);
alter table public.requirement_attachments enable row level security;

create policy requirement_attachments_read on public.requirement_attachments
  for select using (
    org_id = public.get_org_id()
    and (
      public.is_pm()
      or exists (
        select 1 from public.requirements q
        where q.id = requirement_id and q.raised_by = auth.uid() and q.is_deleted = false
      )
    )
  );
revoke insert, update, delete on public.requirement_attachments from anon, authenticated;

create trigger requirement_attachments_same_org before insert or update on public.requirement_attachments
  for each row execute function public.enforce_same_org('requirement_id', 'requirements', 'uploaded_by', 'profiles');
