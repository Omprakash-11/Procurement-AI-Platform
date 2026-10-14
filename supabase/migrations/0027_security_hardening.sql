-- Post-Phase-2 security review fixes (TODO.md #41–#43). Not in the Backend Schema;
-- these enforce rules the docs already state (PM recalls / FA decides, org_id tenancy).

-- ── #41 Approval transitions: PM may only submit or recall; only the FA a request
--        was sent to may approve or reject. Without this a PM could set
--        status = 'approved' on a pending request and trigger contract creation.
drop policy approvals_pm_insert on public.approval_requests;
drop policy approvals_pm_recall on public.approval_requests;
drop policy approvals_fa_decide on public.approval_requests;

create policy approvals_pm_insert on public.approval_requests
  for insert with check (
    org_id = public.get_org_id()
    and public.is_pm()
    and status = 'pending'
    and submitted_by = auth.uid()
  );

create policy approvals_pm_recall on public.approval_requests
  for update using (org_id = public.get_org_id() and public.is_pm() and status = 'pending')
  with check (
    org_id = public.get_org_id()
    and public.is_pm()
    and status = 'recalled'
    and recalled_by = auth.uid()
  );

create policy approvals_fa_decide on public.approval_requests
  for update using (
    org_id = public.get_org_id()
    and public.get_user_role() = 'finance_approver'
    and submitted_to = auth.uid()
    and status = 'pending'
  )
  with check (
    org_id = public.get_org_id()
    and public.get_user_role() = 'finance_approver'
    and submitted_to = auth.uid()
    and status in ('approved', 'rejected')
    and decided_by = auth.uid()
  );

-- A request's identity (rfp, vendor, evaluation, recipient, org) can't be rewritten by clients.
revoke update on public.approval_requests from anon, authenticated;
grant update (status, decision_comment, rejection_reason, decided_by, decided_at, recalled_at, recalled_by)
  on public.approval_requests to authenticated;

-- Contract creation also refuses approvals not decided by an active FA of the same org
-- (covers service-role paths that bypass RLS).
create or replace function public.create_contract_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rfp public.rfps%rowtype;
begin
  if new.status = 'approved' and old.status = 'pending' then
    if not exists (
      select 1 from public.profiles p
      where p.id = new.decided_by
        and p.org_id = new.org_id
        and p.role = 'finance_approver'
        and p.is_active = true
    ) then
      raise exception 'Approval must be decided by an active finance approver of this organisation';
    end if;

    select * into v_rfp from public.rfps where id = new.rfp_id;

    insert into public.contracts (
      org_id, rfp_id, vendor_account_id, approval_request_id,
      title, start_date, end_date, currency
    ) values (
      new.org_id,
      new.rfp_id,
      new.vendor_account_id,
      new.id,
      v_rfp.title || ' — Contract',
      current_date,
      (current_date + interval '1 year')::date, -- default 1 year; PM updates after creation
      coalesce((select currency from public.organisations where id = new.org_id), 'USD')
    );

    update public.rfp_vendor_entries
    set status = 'contracted'
    where rfp_id = new.rfp_id and vendor_account_id = new.vendor_account_id;
  end if;
  return new;
end;
$$;

-- ── #42 DH read scope must not be self-widenable. linked_rfp_id is set by the PM;
--        a DH could otherwise point their requirement at any RFP and gain read access.
create or replace function public.can_read_rfp(p_rfp_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rfps r
    where r.id = p_rfp_id
      and r.org_id = public.get_org_id()
      and public.is_internal()
      and (
        public.is_pm()
        or (
          public.get_user_role() = 'department_head'
          and exists (
            select 1 from public.requirements q
            where q.id = r.requirement_id -- PM-controlled link only
              and q.raised_by = auth.uid()
              and q.is_deleted = false
          )
        )
        or (
          public.get_user_role() = 'finance_approver'
          and exists (select 1 from public.approval_requests a where a.rfp_id = r.id)
        )
      )
  );
$$;

drop policy requirements_dh_insert on public.requirements;
drop policy requirements_dh_update on public.requirements;

create policy requirements_dh_insert on public.requirements
  for insert with check (
    org_id = public.get_org_id()
    and public.get_user_role() = 'department_head'
    and raised_by = auth.uid()
    and status in ('draft', 'submitted')
    and linked_rfp_id is null
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
    and linked_rfp_id is null
  );

-- ── #43 Tenant integrity: every parent reference must belong to the row's own org.
--        RLS checks the row's org_id, not its parents'; a known foreign UUID could
--        otherwise attach rows to another tenant's data. Runs for every writer,
--        including the service role.
-- TG_ARGV holds (column, parent_table) pairs, fixed in the DDL below.
create or replace function public.enforce_same_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row       jsonb := to_jsonb(new);
  v_col       text;
  v_table     text;
  v_parent_id uuid;
  v_parent_org uuid;
  i           int := 0;
begin
  while i < tg_nargs loop
    v_col := tg_argv[i];
    v_table := tg_argv[i + 1];
    v_parent_id := nullif(v_row ->> v_col, '')::uuid;

    if v_parent_id is not null then
      execute format('select org_id from public.%I where id = $1', v_table)
        into v_parent_org
        using v_parent_id;

      if v_parent_org is distinct from new.org_id then
        raise exception 'Cross-organisation reference rejected: %.% → %', tg_table_name, v_col, v_table
          using errcode = '42501';
      end if;
    end if;

    i := i + 2;
  end loop;
  return new;
end;
$$;

revoke execute on function public.enforce_same_org() from public, anon, authenticated;

create trigger vendor_invites_same_org before insert or update on public.vendor_invites
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'vendor_account_id', 'vendor_accounts', 'invited_by', 'profiles');

create trigger requirements_same_org before insert or update on public.requirements
  for each row execute function public.enforce_same_org(
    'raised_by', 'profiles', 'linked_rfp_id', 'rfps');

create trigger rfps_same_org before insert or update on public.rfps
  for each row execute function public.enforce_same_org(
    'created_by', 'profiles', 'requirement_id', 'requirements');

create trigger rfp_vendor_entries_same_org before insert or update on public.rfp_vendor_entries
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'vendor_account_id', 'vendor_accounts');

create trigger submissions_same_org before insert or update on public.submissions
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'vendor_account_id', 'vendor_accounts', 'rfp_vendor_entry_id', 'rfp_vendor_entries');

create trigger documents_same_org before insert or update on public.documents
  for each row execute function public.enforce_same_org('submission_id', 'submissions');

create trigger evaluations_same_org before insert or update on public.evaluations
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'criteria_confirmed_by', 'profiles');

create trigger evaluation_criteria_same_org before insert or update on public.evaluation_criteria
  for each row execute function public.enforce_same_org('evaluation_id', 'evaluations');

create trigger vendor_scores_same_org before insert or update on public.vendor_scores
  for each row execute function public.enforce_same_org(
    'evaluation_id', 'evaluations', 'criterion_id', 'evaluation_criteria',
    'vendor_account_id', 'vendor_accounts', 'overridden_by', 'profiles');

create trigger compliance_flags_same_org before insert or update on public.compliance_flags
  for each row execute function public.enforce_same_org(
    'document_id', 'documents', 'acknowledged_by', 'profiles');

create trigger approval_requests_same_org before insert or update on public.approval_requests
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'vendor_account_id', 'vendor_accounts', 'evaluation_id', 'evaluations',
    'submitted_by', 'profiles', 'submitted_to', 'profiles',
    'decided_by', 'profiles', 'recalled_by', 'profiles');

create trigger contracts_same_org before insert or update on public.contracts
  for each row execute function public.enforce_same_org(
    'rfp_id', 'rfps', 'vendor_account_id', 'vendor_accounts',
    'approval_request_id', 'approval_requests', 'terminated_by', 'profiles');

create trigger scoring_templates_same_org before insert or update on public.scoring_templates
  for each row execute function public.enforce_same_org('created_by', 'profiles');

create trigger notifications_same_org before insert or update on public.notifications
  for each row execute function public.enforce_same_org('recipient_id', 'profiles');
