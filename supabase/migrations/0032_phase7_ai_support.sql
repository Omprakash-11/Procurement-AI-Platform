-- Phase 7 schema additions (TODO.md decisions P7-4, P7-5, P7-6). Not in the Backend Schema.

-- ── P7-5 vendor_notes: internal, append-only notes per vendor per RFP (App Flow §4 Tab 4) ──
create table public.vendor_notes (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organisations(id) on delete cascade,
  rfp_vendor_entry_id uuid not null references public.rfp_vendor_entries(id) on delete cascade,
  author_id           uuid not null references public.profiles(id) on delete no action,
  body                text not null check (length(trim(body)) between 1 and 5000),
  created_at          timestamptz not null default now()
);
create index vendor_notes_entry_idx on public.vendor_notes (rfp_vendor_entry_id, created_at);
alter table public.vendor_notes enable row level security;

-- PM only; insert + read, never update/delete (append-only audit trail). Vendors: no access.
create policy vendor_notes_pm_read on public.vendor_notes
  for select using (org_id = public.get_org_id() and public.is_pm());
create policy vendor_notes_pm_insert on public.vendor_notes
  for insert with check (org_id = public.get_org_id() and public.is_pm() and author_id = auth.uid());
revoke update, delete on public.vendor_notes from anon, authenticated;

create trigger vendor_notes_same_org before insert or update on public.vendor_notes
  for each row execute function public.enforce_same_org('rfp_vendor_entry_id', 'rfp_vendor_entries', 'author_id', 'profiles');

-- ── P7-6 report_share_links: 7-day read-only report links (App Flow §4, PRD §5.5.2) ──
create table public.report_share_links (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organisations(id) on delete cascade,
  rfp_id      uuid not null references public.rfps(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete no action,
  token_hash  text unique not null, -- SHA-256 of the 64-char token; the token itself is never stored
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index report_share_links_rfp_idx on public.report_share_links (rfp_id);
alter table public.report_share_links enable row level security;

create policy report_share_links_pm on public.report_share_links
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

create trigger report_share_links_same_org before insert or update on public.report_share_links
  for each row execute function public.enforce_same_org('rfp_id', 'rfps', 'created_by', 'profiles');

-- ── P7-4 Internal users see a vendor's documents only after the vendor submits ──
drop policy documents_internal_read on public.documents;
create policy documents_internal_read on public.documents
  for select using (
    public.is_internal()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id
        and s.status <> 'in_progress'
        and public.can_read_rfp(s.rfp_id)
    )
  );

drop policy vendor_docs_internal_read on storage.objects;
create policy vendor_docs_internal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and public.is_internal()
    and (storage.foldername(name))[1] = public.get_org_id()::text
    and public.can_read_rfp(nullif((storage.foldername(name))[2], '')::uuid)
    and exists (
      select 1
      from public.documents d
      join public.submissions s on s.id = d.submission_id
      where d.storage_path = name and s.status <> 'in_progress'
    )
  );
