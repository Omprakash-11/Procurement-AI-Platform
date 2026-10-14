-- Backend Schema §2 — all enum types

create type public.user_role as enum (
  'procurement_manager',
  'department_head',
  'finance_approver'
);

create type public.invite_status as enum ('pending', 'accepted', 'expired');

create type public.requirement_status as enum (
  'draft', 'submitted', 'in_progress', 'vendor_selected', 'closed'
);

create type public.requirement_priority as enum ('low', 'medium', 'high', 'critical');

create type public.rfp_status as enum (
  'requirements_received', 'rfp_created', 'vendors_invited',
  'submissions_in', 'under_evaluation', 'shortlisted',
  'approval_pending', 'contracted', 'archived'
);

create type public.vendor_pipeline_status as enum (
  'invited', 'submitted', 'under_review', 'shortlisted',
  'approved', 'not_selected', 'contracted'
);

create type public.submission_status as enum (
  'in_progress', -- vendor uploading, not yet submitted
  'submitted',   -- final submission locked
  'under_review' -- PM has started evaluation
);

create type public.document_type as enum ('pdf', 'docx', 'xlsx');

create type public.extraction_status as enum ('queued', 'processing', 'extracted', 'failed');

create type public.evaluation_status as enum (
  'not_started',
  'criteria_pending',    -- awaiting PM to confirm AI-suggested criteria
  'scoring_in_progress', -- AI scoring running
  'scored',              -- all vendors scored
  'report_generated'     -- comparison report available
);

create type public.flag_severity as enum ('high', 'medium', 'low');

create type public.flag_type as enum (
  'payment_terms', 'penalty_clause', 'fee_structure',
  'price_escalation', 'auto_renewal',
  'liability_limitation', 'unilateral_modification',
  'jurisdiction', 'ip_ownership', 'data_breach_notification'
);

create type public.flag_status as enum ('open', 'acknowledged', 'escalated');

create type public.approval_status as enum ('pending', 'approved', 'rejected', 'recalled');

create type public.rejection_reason as enum (
  'budget_concerns', 'compliance_risk',
  'insufficient_information', 'other'
);

create type public.contract_status as enum ('active', 'expiring_soon', 'expired', 'terminated');

create type public.activity_entity as enum (
  'organisation', 'profile', 'vendor_account', 'requirement',
  'rfp', 'rfp_vendor_entry', 'submission', 'document',
  'evaluation', 'vendor_score', 'compliance_flag',
  'approval_request', 'contract', 'scoring_template'
);

create type public.notification_type as enum (
  'vendor_submitted', 'scoring_complete', 'extraction_failed',
  'approval_requested', 'approval_sla_warning', 'approval_decided',
  'renewal_alert', 'vendor_status_updated', 'requirement_submitted',
  'evaluation_ready'
);
