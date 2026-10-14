-- Backend Schema §6. Decision P2-8 (#11): set_updated_at only on the 15 tables that
-- have an updated_at column (vendor_invites, activity_log, notifications do not).

create trigger organisations_updated_at       before update on public.organisations       for each row execute function public.set_updated_at();
create trigger profiles_updated_at            before update on public.profiles            for each row execute function public.set_updated_at();
create trigger vendor_accounts_updated_at     before update on public.vendor_accounts     for each row execute function public.set_updated_at();
create trigger requirements_updated_at        before update on public.requirements        for each row execute function public.set_updated_at();
create trigger rfps_updated_at                before update on public.rfps                for each row execute function public.set_updated_at();
create trigger rfp_vendor_entries_updated_at  before update on public.rfp_vendor_entries  for each row execute function public.set_updated_at();
create trigger submissions_updated_at         before update on public.submissions         for each row execute function public.set_updated_at();
create trigger documents_updated_at           before update on public.documents           for each row execute function public.set_updated_at();
create trigger evaluations_updated_at         before update on public.evaluations         for each row execute function public.set_updated_at();
create trigger evaluation_criteria_updated_at before update on public.evaluation_criteria for each row execute function public.set_updated_at();
create trigger vendor_scores_updated_at       before update on public.vendor_scores       for each row execute function public.set_updated_at();
create trigger compliance_flags_updated_at    before update on public.compliance_flags    for each row execute function public.set_updated_at();
create trigger approval_requests_updated_at   before update on public.approval_requests   for each row execute function public.set_updated_at();
create trigger contracts_updated_at           before update on public.contracts           for each row execute function public.set_updated_at();
create trigger scoring_templates_updated_at   before update on public.scoring_templates   for each row execute function public.set_updated_at();

-- §6.2 create org + profile after signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- §6.3 auto-create evaluation on RFP creation
create trigger rfp_evaluation_created
  after insert on public.rfps
  for each row execute function public.create_evaluation_for_rfp();

-- §6.4 auto-create contract on approval
create trigger approval_creates_contract
  after update on public.approval_requests
  for each row execute function public.create_contract_on_approval();

-- §6.5 criteria weights ≤ 100
create trigger criteria_weight_check
  before insert or update on public.evaluation_criteria
  for each row execute function public.validate_criteria_weights();
