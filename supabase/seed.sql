-- Local development seed ONLY (decision P2-8 #10 / P2-10). Applied by `supabase db reset`.
-- Never run against production. Every account's password: Password123!
--
--   pm@procuremaster.test       Procurement Manager (org admin)
--   dh@procuremaster.test       Department Head
--   fa@procuremaster.test       Finance Approver
--   vendor1@procuremaster.test  Vendor — Northwind Supplies
--   vendor2@procuremaster.test  Vendor — Globex Services
--
-- Users are inserted with role/org in raw_app_meta_data, exactly as the admin API will,
-- so the on_auth_user_created trigger creates the org and profiles.

create function pg_temp.seed_auth_user(p_id uuid, p_email text, p_app_meta jsonb, p_full_name text)
returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb || p_app_meta,
    jsonb_build_object('full_name', p_full_name), now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), p_id, p_id::text, 'email',
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    now(), now(), now()
  );
end;
$$;

do $$
declare
  v_pm      uuid := 'a0000000-0000-4000-8000-000000000001';
  v_dh      uuid := 'a0000000-0000-4000-8000-000000000002';
  v_fa      uuid := 'a0000000-0000-4000-8000-000000000003';
  v_vu1     uuid := 'a0000000-0000-4000-8000-000000000011';
  v_vu2     uuid := 'a0000000-0000-4000-8000-000000000012';
  v_va1     uuid := 'b0000000-0000-4000-8000-000000000011';
  v_va2     uuid := 'b0000000-0000-4000-8000-000000000012';
  v_req     uuid := 'c0000000-0000-4000-8000-000000000001';
  v_rfp     uuid := 'd0000000-0000-4000-8000-000000000001';
  v_org     uuid;
  v_entry1  uuid;
  v_entry2  uuid;
begin
  -- PM first: no org_id, so the trigger creates the organisation
  perform pg_temp.seed_auth_user(v_pm, 'pm@procuremaster.test',
    jsonb_build_object('role', 'procurement_manager', 'org_name', 'Acme Manufacturing', 'full_name', 'Priya Sharma'),
    'Priya Sharma');
  select org_id into v_org from public.profiles where id = v_pm;

  perform pg_temp.seed_auth_user(v_dh, 'dh@procuremaster.test',
    jsonb_build_object('role', 'department_head', 'org_id', v_org, 'full_name', 'Daniel Okafor'),
    'Daniel Okafor');
  perform pg_temp.seed_auth_user(v_fa, 'fa@procuremaster.test',
    jsonb_build_object('role', 'finance_approver', 'org_id', v_org, 'full_name', 'Fatima Khan'),
    'Fatima Khan');

  -- Vendors: auth users with no internal role → no profile (P2-1)
  perform pg_temp.seed_auth_user(v_vu1, 'vendor1@procuremaster.test', '{}'::jsonb, 'Nina Patel');
  perform pg_temp.seed_auth_user(v_vu2, 'vendor2@procuremaster.test', '{}'::jsonb, 'Gary Chen');

  update public.profiles set onboarding_complete = true where org_id = v_org;

  insert into public.vendor_accounts (id, org_id, auth_user_id, company_name, contact_name, email, is_active)
  values
    (v_va1, v_org, v_vu1, 'Northwind Supplies', 'Nina Patel', 'vendor1@procuremaster.test', true),
    (v_va2, v_org, v_vu2, 'Globex Services', 'Gary Chen', 'vendor2@procuremaster.test', true);

  insert into public.requirements (id, org_id, raised_by, title, description, department, budget_estimate, required_by, priority, status)
  values (
    v_req, v_org, v_dh,
    'Cloud storage for engineering',
    'Engineering needs 50TB of managed cloud storage with daily backups and 99.9% availability.',
    'Engineering', 120000.00, current_date + 60, 'high', 'in_progress'
  );

  -- The rfp_evaluation_created trigger adds the evaluation row
  insert into public.rfps (id, org_id, created_by, requirement_id, title, description, department, budget_min, budget_max, submission_deadline, status)
  values (
    v_rfp, v_org, v_pm, v_req,
    'Cloud Storage Vendor RFP',
    'Managed cloud storage (50TB) for the engineering department, including backup, SLA and data-residency commitments.',
    'Engineering', 80000.00, 120000.00, now() + interval '21 days', 'vendors_invited'
  );
  update public.requirements set linked_rfp_id = v_rfp where id = v_req;

  insert into public.rfp_vendor_entries (org_id, rfp_id, vendor_account_id, status)
  values (v_org, v_rfp, v_va1, 'invited') returning id into v_entry1;
  insert into public.rfp_vendor_entries (org_id, rfp_id, vendor_account_id, status)
  values (v_org, v_rfp, v_va2, 'invited') returning id into v_entry2;

  insert into public.vendor_invites (org_id, rfp_id, vendor_account_id, invited_by, token, status, expires_at, accepted_at)
  values
    (v_org, v_rfp, v_va1, v_pm, encode(extensions.gen_random_bytes(32), 'hex'), 'accepted', now() + interval '72 hours', now()),
    (v_org, v_rfp, v_va2, v_pm, encode(extensions.gen_random_bytes(32), 'hex'), 'accepted', now() + interval '72 hours', now());
end;
$$;
