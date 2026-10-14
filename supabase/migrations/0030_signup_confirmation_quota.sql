-- #56 (security review): the signup-confirmation resend caps (1/min, 5/day per pending
-- signup) were checked in the app and logged after the send, so parallel requests could
-- exceed them. Reserve atomically under a per-org advisory lock, recording the ledger row
-- ('signup.confirmation_sent') in the same transaction, before any link or email is made.
-- Returns 'ok', 'cooldown' or 'daily_limit'.

create or replace function public.reserve_signup_confirmation(
  p_org_id uuid,
  p_user_id uuid,
  p_daily_limit int,
  p_cooldown_seconds int
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sent int;
  v_last timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('signup_confirmation:' || p_org_id::text, 0));

  select count(*), max(created_at) into v_sent, v_last
  from public.activity_log
  where org_id = p_org_id
    and action = 'signup.confirmation_sent'
    and created_at > now() - interval '24 hours';

  if v_sent >= p_daily_limit then
    return 'daily_limit';
  end if;
  if v_last is not null and v_last > now() - make_interval(secs => p_cooldown_seconds) then
    return 'cooldown';
  end if;

  insert into public.activity_log (org_id, actor_id, actor_type, entity_type, entity_id, action, description)
  values (p_org_id, p_user_id, 'system', 'profile', p_user_id, 'signup.confirmation_sent', 'Signup confirmation email sent');
  return 'ok';
end;
$$;

revoke execute on function public.reserve_signup_confirmation(uuid, uuid, int, int) from public, anon, authenticated;
grant execute on function public.reserve_signup_confirmation(uuid, uuid, int, int) to service_role;
