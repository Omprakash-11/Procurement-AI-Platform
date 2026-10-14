-- Backend Schema §4.4, §6. Decision P2-8: functions now come before RLS (0022).
-- The custom_access_token_hook lives in 0026 with its grants.

-- ── updated_at auto-timestamp (§6.1) ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── JWT helpers for RLS (§4.4) ───────────────────────────────────────────────
create or replace function public.get_org_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'org_id', '')::uuid;
$$;

create or replace function public.get_user_role()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
$$;

create or replace function public.get_user_type()
returns text
language sql
stable
set search_path = ''
as $$
  select auth.jwt() -> 'app_metadata' ->> 'user_type';
$$;

create or replace function public.is_pm()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.get_user_role() = 'procurement_manager', false);
$$;

create or replace function public.is_internal()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.get_user_type() = 'internal', false);
$$;

create or replace function public.is_vendor()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(public.get_user_type() = 'vendor', false);
$$;

-- ── Scoped-read helpers (decisions P2-3, P2-6) ──────────────────────────────
-- SECURITY DEFINER so policies can consult other tables without recursive RLS.
-- They only ever answer for the calling user (auth.uid() / JWT claims).

-- Vendor: the vendor_accounts rows owned by the signed-in auth user (may span orgs).
create or replace function public.my_vendor_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select va.id
  from public.vendor_accounts va
  where va.auth_user_id = auth.uid()
    and va.is_deleted = false
    and public.is_vendor();
$$;

-- Internal: PM → any RFP in the org; DH → RFPs linked to a requirement they raised;
-- FA → RFPs that have an approval request.
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
            where q.raised_by = auth.uid()
              and q.is_deleted = false
              and (q.id = r.requirement_id or q.linked_rfp_id = r.id)
          )
        )
        or (
          public.get_user_role() = 'finance_approver'
          and exists (select 1 from public.approval_requests a where a.rfp_id = r.id)
        )
      )
  );
$$;

create or replace function public.can_read_evaluation(p_evaluation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation_id and public.can_read_rfp(e.rfp_id)
  );
$$;

create or replace function public.can_read_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.documents d
    join public.submissions s on s.id = d.submission_id
    where d.id = p_document_id and public.can_read_rfp(s.rfp_id)
  );
$$;

-- ── Create org + profile after signup (§6.2) ─────────────────────────────────
-- Decision P2-1: trust only raw_app_meta_data (settable by the service role alone).
-- Auth users without an internal role (vendors) get no profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_text text := new.raw_app_meta_data ->> 'role';
  v_role      public.user_role;
  v_org_id    uuid := nullif(new.raw_app_meta_data ->> 'org_id', '')::uuid;
  v_org_name  text := new.raw_app_meta_data ->> 'org_name';
begin
  if v_role_text is null or v_role_text not in ('procurement_manager', 'department_head', 'finance_approver') then
    return new;
  end if;
  v_role := v_role_text::public.user_role;

  -- First PM with no org: create the organisation
  if v_role = 'procurement_manager' and v_org_id is null then
    if coalesce(trim(v_org_name), '') = '' then
      raise exception 'org_name is required to create an organisation';
    end if;
    v_org_id := gen_random_uuid();
    insert into public.organisations (id, name, slug, currency)
    values (
      v_org_id,
      v_org_name,
      -- slug suffix keeps two orgs with the same name from colliding on the unique slug
      trim(both '-' from lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')))
        || '-' || left(replace(v_org_id::text, '-', ''), 6),
      coalesce(new.raw_app_meta_data ->> 'currency', 'USD')
    );
  end if;

  if v_org_id is null then
    raise exception 'org_id is required for role %', v_role;
  end if;

  insert into public.profiles (id, org_id, full_name, role)
  values (
    new.id,
    v_org_id,
    coalesce(new.raw_app_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'full_name', new.email),
    v_role
  );

  return new;
end;
$$;

-- ── Auto-create evaluation on RFP creation (§6.3) ────────────────────────────
create or replace function public.create_evaluation_for_rfp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.evaluations (org_id, rfp_id) values (new.org_id, new.id);
  return new;
end;
$$;

-- ── Auto-create contract on approval (§6.4) ──────────────────────────────────
-- SECURITY DEFINER: fired by the FA's update, but FA has no write access to contracts
-- or rfp_vendor_entries under RLS.
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

-- ── Criteria weights must not exceed 100 (§6.5) ──────────────────────────────
create or replace function public.validate_criteria_weights()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_total numeric;
begin
  select coalesce(sum(weight), 0) into v_total
  from public.evaluation_criteria
  where evaluation_id = new.evaluation_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_total := v_total + new.weight;

  -- Partial weights are allowed during setup; the exact 100% check happens on confirm.
  if v_total > 100.01 then
    raise exception 'Criteria weights cannot exceed 100%%. Current total: %', v_total;
  end if;

  return new;
end;
$$;

-- ── Contract expiry status updater, called daily by Vercel Cron (§6.6) ────────
create or replace function public.process_contract_renewals()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r                public.contracts%rowtype;
  v_pm_id          uuid;
  v_days_remaining int;
begin
  for r in
    select * from public.contracts
    where status in ('active', 'expiring_soon') and is_deleted = false
  loop
    v_days_remaining := (r.end_date - current_date);

    if v_days_remaining <= r.alert_days and r.status = 'active' then
      update public.contracts set status = 'expiring_soon' where id = r.id;

      select id into v_pm_id from public.profiles
      where org_id = r.org_id and role = 'procurement_manager' and is_active = true
      limit 1;

      if v_pm_id is not null then
        insert into public.notifications (org_id, recipient_id, type, title, body, entity_type, entity_id)
        values (
          r.org_id, v_pm_id, 'renewal_alert',
          'Contract expiring in ' || v_days_remaining || ' days',
          r.title || ' expires on ' || r.end_date::text,
          'contract', r.id
        );
      end if;
    end if;

    if v_days_remaining <= 0 then
      update public.contracts set status = 'expired' where id = r.id;
    end if;
  end loop;
end;
$$;

-- SECURITY DEFINER functions are callable through the API unless revoked.
revoke execute on function public.process_contract_renewals() from public, anon, authenticated;
grant execute on function public.process_contract_renewals() to service_role;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_evaluation_for_rfp() from public, anon, authenticated;
revoke execute on function public.create_contract_on_approval() from public, anon, authenticated;
