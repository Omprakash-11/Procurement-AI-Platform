-- Phase 3 fixes (TODO.md #46, P3-5, P3-7).

-- ── #46 The admin API inserts auth.users first and writes raw_app_meta_data in a
--        separate UPDATE, so an AFTER INSERT trigger alone never sees the role and
--        no profile is created. Run handle_new_user on that update too, idempotently.
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

  -- Already provisioned (e.g. a later app_metadata update): nothing to do.
  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_role := v_role_text::public.user_role;

  if v_role = 'procurement_manager' and v_org_id is null then
    if coalesce(trim(v_org_name), '') = '' then
      raise exception 'org_name is required to create an organisation';
    end if;
    v_org_id := gen_random_uuid();
    insert into public.organisations (id, name, slug, currency)
    values (
      v_org_id,
      v_org_name,
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

create trigger on_auth_user_app_meta_updated
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data is distinct from new.raw_app_meta_data)
  execute function public.handle_new_user();

-- ── P3-7 (#40a) / P3-5 Token contents: keep only Supabase's provider fields plus our
--        claims. Creation-time values (org_name, full_name, currency) and the team-invite
--        token hash stored in app_metadata never reach the JWT.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id  uuid := (event ->> 'user_id')::uuid;
  v_claims   jsonb := event -> 'claims';
  v_existing jsonb := coalesce(v_claims -> 'app_metadata', '{}'::jsonb);
  v_app_meta jsonb := '{}'::jsonb;
  v_profile  public.profiles%rowtype;
begin
  if v_existing ? 'provider' then
    v_app_meta := v_app_meta || jsonb_build_object('provider', v_existing -> 'provider');
  end if;
  if v_existing ? 'providers' then
    v_app_meta := v_app_meta || jsonb_build_object('providers', v_existing -> 'providers');
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id and is_active = true;

  if found then
    v_app_meta := v_app_meta || jsonb_build_object(
      'user_type', 'internal',
      'role', v_profile.role,
      'org_id', v_profile.org_id
    );
  elsif exists (
    select 1 from public.vendor_accounts
    where auth_user_id = v_user_id and is_active = true and is_deleted = false
  ) then
    v_app_meta := v_app_meta || jsonb_build_object('user_type', 'vendor', 'role', 'vendor');
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;
