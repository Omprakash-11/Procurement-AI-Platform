-- Phase 9 (TODO.md decisions P9-1, P9-2).

-- ── P9-1 process_contract_renewals() reports what it flagged, so the cron route can email
-- the PM per contract. Same logic as Backend Schema §6.6: each contract is flagged once
-- (active → expiring_soon); contracts past their end date become expired.
drop function public.process_contract_renewals();

create function public.process_contract_renewals()
returns table (contract_id uuid, org_id uuid, title text, end_date date, days_remaining int, pm_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  r                public.contracts%rowtype;
  v_pm_id          uuid;
  v_days_remaining int;
begin
  for r in
    select * from public.contracts c
    where c.status in ('active', 'expiring_soon') and c.is_deleted = false
  loop
    v_days_remaining := (r.end_date - current_date);

    if v_days_remaining <= r.alert_days and r.status = 'active' then
      update public.contracts set status = 'expiring_soon' where id = r.id;

      select p.id into v_pm_id from public.profiles p
      where p.org_id = r.org_id and p.role = 'procurement_manager' and p.is_active = true
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

      contract_id := r.id;
      org_id := r.org_id;
      title := r.title;
      end_date := r.end_date;
      days_remaining := v_days_remaining;
      pm_id := v_pm_id;
      return next;
    end if;

    if v_days_remaining <= 0 then
      update public.contracts set status = 'expired' where id = r.id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.process_contract_renewals() from public, anon, authenticated;
grant execute on function public.process_contract_renewals() to service_role;

-- ── P9-2 activity_log visibility (#40): PM sees the whole org; DH / FA only what concerns
-- RFPs they can already read, their own actions, and their own requirements / approvals.
drop policy activity_internal_read on public.activity_log;

create policy activity_pm_read on public.activity_log
  for select using (org_id = public.get_org_id() and public.is_pm());

create policy activity_scoped_read on public.activity_log
  for select using (
    org_id = public.get_org_id()
    and public.is_internal()
    and (
      actor_id = auth.uid()
      or (entity_type = 'rfp' and public.can_read_rfp(entity_id))
      or (
        (metadata ->> 'rfp_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.can_read_rfp((metadata ->> 'rfp_id')::uuid)
      )
      or (
        entity_type = 'requirement'
        and exists (select 1 from public.requirements q where q.id = entity_id and q.raised_by = auth.uid())
      )
      or (
        entity_type = 'approval_request'
        and exists (select 1 from public.approval_requests a where a.id = entity_id and a.submitted_to = auth.uid())
      )
    )
  );
