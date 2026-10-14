-- Backend Schema §5, amended by decisions P2-3 … P2-6 (see TODO.md).
-- Never disable RLS to fix an access problem — write the correct policy.
-- The service role bypasses RLS and is used only from server-side API routes.

alter table public.organisations       enable row level security;
alter table public.profiles            enable row level security;
alter table public.vendor_accounts     enable row level security;
alter table public.vendor_invites      enable row level security;
alter table public.requirements        enable row level security;
alter table public.rfps                enable row level security;
alter table public.rfp_vendor_entries  enable row level security;
alter table public.submissions         enable row level security;
alter table public.documents           enable row level security;
alter table public.evaluations         enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.vendor_scores       enable row level security;
alter table public.compliance_flags    enable row level security;
alter table public.approval_requests   enable row level security;
alter table public.contracts           enable row level security;
alter table public.scoring_templates   enable row level security;
alter table public.activity_log        enable row level security;
alter table public.notifications       enable row level security;

-- ── organisations (§5.1) — vendors read org details via API only (P2-4) ─────
create policy org_read on public.organisations
  for select using (id = public.get_org_id() and public.is_internal());

create policy org_update on public.organisations
  for update using (id = public.get_org_id() and public.is_pm())
  with check (id = public.get_org_id() and public.is_pm());

-- ── profiles (§5.2) ──────────────────────────────────────────────────────────
create policy profiles_read on public.profiles
  for select using (org_id = public.get_org_id() and public.is_internal());

create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- #39: the self-update policy alone would let users change their own role / org_id / is_active.
-- Column privileges limit self-service edits to personal fields; role and status changes
-- go through service-role API routes.
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

create policy profiles_insert on public.profiles
  for insert with check (org_id = public.get_org_id() and public.is_pm());

-- ── vendor_accounts (§5.3) ───────────────────────────────────────────────────
create policy vendor_accounts_internal_read on public.vendor_accounts
  for select using (org_id = public.get_org_id() and public.is_internal());

create policy vendor_accounts_self_read on public.vendor_accounts
  for select using (auth_user_id = auth.uid() and public.is_vendor());

create policy vendor_accounts_pm_write on public.vendor_accounts
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── vendor_invites (P2-5) — PM only; token lookups happen server-side ────────
create policy vendor_invites_pm on public.vendor_invites
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── requirements (P2-5) ──────────────────────────────────────────────────────
create policy requirements_dh_read on public.requirements
  for select using (
    org_id = public.get_org_id()
    and public.get_user_role() = 'department_head'
    and raised_by = auth.uid()
  );

create policy requirements_dh_insert on public.requirements
  for insert with check (
    org_id = public.get_org_id()
    and public.get_user_role() = 'department_head'
    and raised_by = auth.uid()
    and status in ('draft', 'submitted')
  );

create policy requirements_dh_update on public.requirements
  for update using (
    org_id = public.get_org_id()
    and public.get_user_role() = 'department_head'
    and raised_by = auth.uid()
    and status in ('draft', 'submitted')
  )
  with check (
    org_id = public.get_org_id()
    and raised_by = auth.uid()
    and status in ('draft', 'submitted')
  );

create policy requirements_pm_read on public.requirements
  for select using (org_id = public.get_org_id() and public.is_pm());

create policy requirements_pm_update on public.requirements
  for update using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── rfps (§5.4 + P2-6) — vendors cannot access rfps directly ─────────────────
create policy rfps_internal_read on public.rfps
  for select using (is_deleted = false and public.can_read_rfp(id));

create policy rfps_pm_write on public.rfps
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── rfp_vendor_entries (P2-5, P2-3) ──────────────────────────────────────────
create policy rfp_vendor_entries_internal_read on public.rfp_vendor_entries
  for select using (public.can_read_rfp(rfp_id));

create policy rfp_vendor_entries_vendor_read on public.rfp_vendor_entries
  for select using (public.is_vendor() and vendor_account_id in (select public.my_vendor_account_ids()));

create policy rfp_vendor_entries_pm_write on public.rfp_vendor_entries
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── submissions (§5.5 + P2-4) — vendor writes go through API routes ──────────
create policy submissions_internal_read on public.submissions
  for select using (public.can_read_rfp(rfp_id));

create policy submissions_vendor_read on public.submissions
  for select using (public.is_vendor() and vendor_account_id in (select public.my_vendor_account_ids()));

-- ── documents (§5.5 + P2-4) — no vendor policy: extraction data stays internal ─
create policy documents_internal_read on public.documents
  for select using (
    public.is_internal()
    and exists (
      select 1 from public.submissions s
      where s.id = submission_id and public.can_read_rfp(s.rfp_id)
    )
  );

-- ── evaluations, criteria, scores (§5.6 + P2-6) — vendors never see scores ───
create policy evaluations_read on public.evaluations
  for select using (public.can_read_rfp(rfp_id));

create policy evaluations_pm_write on public.evaluations
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

create policy criteria_read on public.evaluation_criteria
  for select using (public.can_read_evaluation(evaluation_id));

create policy criteria_pm_write on public.evaluation_criteria
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

create policy scores_read on public.vendor_scores
  for select using (public.can_read_evaluation(evaluation_id));

create policy scores_pm_write on public.vendor_scores
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── compliance_flags (§5.9 + P2-6) ───────────────────────────────────────────
create policy flags_internal_read on public.compliance_flags
  for select using (public.can_read_document(document_id));

create policy flags_pm_write on public.compliance_flags
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── approval_requests (§5.7) ─────────────────────────────────────────────────
create policy approvals_read on public.approval_requests
  for select using (
    org_id = public.get_org_id()
    and public.get_user_role() in ('procurement_manager', 'finance_approver')
  );

create policy approvals_pm_insert on public.approval_requests
  for insert with check (org_id = public.get_org_id() and public.is_pm());

create policy approvals_pm_recall on public.approval_requests
  for update using (org_id = public.get_org_id() and public.is_pm() and status = 'pending')
  with check (org_id = public.get_org_id() and public.is_pm());

create policy approvals_fa_decide on public.approval_requests
  for update using (
    org_id = public.get_org_id()
    and public.get_user_role() = 'finance_approver'
    and status = 'pending'
  )
  with check (org_id = public.get_org_id() and public.get_user_role() = 'finance_approver');

-- ── contracts (§5.8) ─────────────────────────────────────────────────────────
-- WITH CHECK omits is_deleted so the PM can soft-delete (set is_deleted = true).
create policy contracts_pm on public.contracts
  for all using (org_id = public.get_org_id() and public.is_pm() and is_deleted = false)
  with check (org_id = public.get_org_id() and public.is_pm());

create policy contracts_fa_read on public.contracts
  for select using (
    org_id = public.get_org_id()
    and public.get_user_role() = 'finance_approver'
    and is_deleted = false
  );

-- ── scoring_templates (P2-5) ─────────────────────────────────────────────────
create policy scoring_templates_pm on public.scoring_templates
  for all using (org_id = public.get_org_id() and public.is_pm())
  with check (org_id = public.get_org_id() and public.is_pm());

-- ── activity_log (§5.9) — read by internal users; INSERT only via service role ─
create policy activity_internal_read on public.activity_log
  for select using (org_id = public.get_org_id() and public.is_internal());

-- ── notifications (§5.9) — scoped to recipient ───────────────────────────────
create policy notifications_recipient on public.notifications
  for all using (recipient_id = auth.uid() and public.is_internal())
  with check (recipient_id = auth.uid() and public.is_internal());
