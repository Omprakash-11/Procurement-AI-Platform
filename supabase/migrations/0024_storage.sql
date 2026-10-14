-- Backend Schema §9. All buckets private; file access via signed URLs created server-side.
-- Decision P2-4 (#38): no vendor storage policies — vendor uploads/downloads go through
-- service-role API routes. The documented vendor read policy matched the whole org folder,
-- which would have exposed other vendors' proposals.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('vendor-documents', 'vendor-documents', false, 52428800), -- 50MB per file (PRD §5.3.1)
  ('org-assets', 'org-assets', false, null),
  ('contract-documents', 'contract-documents', false, null)
on conflict (id) do nothing;

-- vendor-documents path: {org_id}/{rfp_id}/{vendor_id}/{filename}
-- Internal users read files for RFPs they may read (P2-6).
create policy vendor_docs_internal_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'vendor-documents'
    and public.is_internal()
    and (storage.foldername(name))[1] = public.get_org_id()::text
    and public.can_read_rfp(nullif((storage.foldername(name))[2], '')::uuid)
  );
