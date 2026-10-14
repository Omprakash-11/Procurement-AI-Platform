-- Backend Schema §4.3, amended by decisions P2-2 (#33) and P2-3 (#13).
-- Registered in supabase/config.toml → [auth.hook.custom_access_token] (local);
-- in hosted projects register it under Dashboard → Authentication → Hooks.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user_id   uuid := (event ->> 'user_id')::uuid;
  v_claims    jsonb := event -> 'claims';
  -- Merge rather than overwrite (keeps Supabase's provider fields), but always strip our
  -- claims first so a deactivated user can't keep a role copied from raw_app_meta_data.
  v_app_meta  jsonb := coalesce(v_claims -> 'app_metadata', '{}'::jsonb) - 'user_type' - 'role' - 'org_id';
  v_profile   public.profiles%rowtype;
begin
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
    -- P2-3: a vendor may belong to several orgs, so no org_id; vendor RLS keys on auth.uid().
    v_app_meta := v_app_meta || jsonb_build_object('user_type', 'vendor', 'role', 'vendor');
  end if;

  v_claims := jsonb_set(v_claims, '{app_metadata}', v_app_meta);
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Only the Auth server may run the hook.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;

-- supabase_auth_admin does not bypass RLS (verified locally), so it needs explicit read access.
grant select on table public.profiles to supabase_auth_admin;
grant select on table public.vendor_accounts to supabase_auth_admin;

create policy auth_admin_read_profiles on public.profiles
  as permissive for select to supabase_auth_admin using (true);

create policy auth_admin_read_vendor_accounts on public.vendor_accounts
  as permissive for select to supabase_auth_admin using (true);
