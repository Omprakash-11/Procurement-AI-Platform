-- Phase 12 (TODO.md decision P12-5): shared demo accounts can't change their password, email
-- or phone through any path (our API routes already refuse in DEMO_MODE; this also covers direct
-- calls to Supabase Auth with a visitor's session). Only accounts created by the demo seed script
-- carry app_metadata.demo_account = true, so normal organisations are unaffected.
-- To change a demo account deliberately, remove the flag first (admin API), then update it.

create function public.protect_demo_accounts()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(old.raw_app_meta_data ->> 'demo_account', 'false') = 'true' and (
    new.encrypted_password is distinct from old.encrypted_password
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or coalesce(new.email_change, '') not in ('', coalesce(old.email_change, ''))
    or coalesce(new.phone_change, '') not in ('', coalesce(old.phone_change, ''))
  ) then
    raise exception 'Demo accounts can''t change their password, email or phone.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger protect_demo_accounts
  before update on auth.users
  for each row execute function public.protect_demo_accounts();
