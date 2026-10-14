-- Decision S-2 hardening (TODO.md #51): atomic per-org invite-email quota.
-- Counting in the app and logging after the send let parallel requests overshoot the cap.
-- This reserves one send under a per-org advisory lock and records it in the same
-- transaction, BEFORE the email goes out. No new table: the ledger is activity_log
-- rows with action 'invite.email_sent'.

create or replace function public.reserve_invite_email(p_org_id uuid, p_actor_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent int;
begin
  perform pg_advisory_xact_lock(hashtextextended('invite_quota:' || p_org_id::text, 0));

  select count(*) into v_sent
  from public.activity_log
  where org_id = p_org_id
    and action = 'invite.email_sent'
    and created_at > now() - interval '24 hours';

  if v_sent >= p_limit then
    return false;
  end if;

  insert into public.activity_log (org_id, actor_id, actor_type, entity_type, entity_id, action, description)
  values (p_org_id, p_actor_id, 'profile', 'organisation', p_org_id, 'invite.email_sent', 'Invite email sent');
  return true;
end;
$$;

revoke execute on function public.reserve_invite_email(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.reserve_invite_email(uuid, uuid, int) to service_role;

-- #52: look a user up by email WITHOUT issuing a token. The admin generateLink call used
-- for lookups invalidated any outstanding emailed link for that user.
create or replace function public.find_auth_user_by_email(p_email text)
returns table (id uuid, email_confirmed boolean, created_at timestamptz, app_metadata jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email_confirmed_at is not null, u.created_at, coalesce(u.raw_app_meta_data, '{}'::jsonb)
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke execute on function public.find_auth_user_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_by_email(text) to service_role;
