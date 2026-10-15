import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '../../src/types/database'
import { env, PASSWORD, SEED, USERS } from './env'

// Service-role access for test setup and assertions (local Supabase only). Specs use it to
// arrange state the UI would take minutes to reach and to verify what was stored.

let admin: SupabaseClient<Database> | null = null
export function db(): SupabaseClient<Database> {
  const url = env('NEXT_PUBLIC_SUPABASE_URL')
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error('E2E tests only run against the local Supabase instance.')
  admin ??= createClient<Database>(url, env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
  return admin
}

export async function userId(email: string): Promise<string> {
  const { data } = await db().rpc('find_auth_user_by_email', { p_email: email })
  const id = data?.[0]?.id
  if (!id) throw new Error(`No user ${email}`)
  return id
}

export async function orgId(): Promise<string> {
  const pm = await userId(USERS.pm)
  const { data } = await db().from('profiles').select('org_id').eq('id', pm).single()
  return data!.org_id
}

/** A new RFP owned by the seed PM (RFP Created), via the service role. */
export async function createRfp(title: string, extra: Partial<Database['public']['Tables']['rfps']['Insert']> = {}) {
  const pm = await userId(USERS.pm)
  const { data, error } = await db()
    .from('rfps')
    .insert({ org_id: await orgId(), created_by: pm, title, description: `${title} — test RFP`, department: 'Operations', ...extra })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/**
 * An RFP that has been evaluated and reported (decision P11-2 fixture): both seed vendors
 * submitted, two weighted criteria scored, report generated; vendor 1 shortlisted with one
 * escalated compliance flag. Used by the approvals / contracts / activity specs.
 */
export async function createReportedRfp(title: string): Promise<{ rfpId: string; evaluationId: string }> {
  const org = await orgId()
  const rfpId = await createRfp(title, { status: 'shortlisted' })
  const d = db()
  const { data: entries } = await d
    .from('rfp_vendor_entries')
    .insert([
      { org_id: org, rfp_id: rfpId, vendor_account_id: SEED.vendor1Id, status: 'shortlisted' },
      { org_id: org, rfp_id: rfpId, vendor_account_id: SEED.vendor2Id, status: 'under_review' },
    ])
    .select('id, vendor_account_id')
  const { data: subs } = await d
    .from('submissions')
    .insert(entries!.map((e) => ({ org_id: org, rfp_id: rfpId, vendor_account_id: e.vendor_account_id, rfp_vendor_entry_id: e.id, status: 'under_review' as const, submitted_at: new Date().toISOString() })))
    .select('id, vendor_account_id')
  const { data: evaluation } = await d.from('evaluations').select('id').eq('rfp_id', rfpId).single()
  const evaluationId = evaluation!.id
  const { data: criteria } = await d
    .from('evaluation_criteria')
    .insert([
      { org_id: org, evaluation_id: evaluationId, name: 'Commercial Value', weight: 60, sort_order: 0 },
      { org_id: org, evaluation_id: evaluationId, name: 'Service Levels & Reliability', weight: 40, sort_order: 1 },
    ])
    .select('id, sort_order')
  const scores = [
    [SEED.vendor1Id, 8.5, 8],
    [SEED.vendor2Id, 6, 6.5],
  ] as const
  await d.from('vendor_scores').insert(
    scores.flatMap(([vendor, a, b]) =>
      criteria!.map((c) => ({
        org_id: org,
        evaluation_id: evaluationId,
        criterion_id: c.id,
        vendor_account_id: vendor,
        scoring_run: 1,
        ai_score: c.sort_order === 0 ? a : b,
        ai_reasoning: 'Scored from the submitted proposal.',
        ai_scored_at: new Date().toISOString(),
      }))
    )
  )
  const sub1 = subs!.find((s) => s.vendor_account_id === SEED.vendor1Id)!
  const { data: doc } = await d
    .from('documents')
    .insert({ org_id: org, submission_id: sub1.id, file_name: 'Proposal.pdf', file_type: 'pdf', file_size_bytes: 1000, storage_path: `${org}/${rfpId}/${SEED.vendor1Id}/fixture-Proposal.pdf`, extraction_status: 'extracted' })
    .select('id')
    .single()
  await d.from('compliance_flags').insert({ org_id: org, document_id: doc!.id, flag_type: 'auto_renewal', severity: 'high', clause_text: 'Renews automatically for 3 years unless cancelled 7 days before renewal.', explanation: 'Short opt-out window.', status: 'escalated' })
  await d
    .from('evaluations')
    .update({
      status: 'report_generated',
      scoring_run_count: 1,
      criteria_confirmed_at: new Date().toISOString(),
      last_scored_at: new Date().toISOString(),
      report_executive_summary: 'Two proposals were evaluated; the first vendor offers the stronger overall value.',
      report_recommendation: JSON.stringify({ vendor_account_id: SEED.vendor1Id, rationale: 'Highest weighted score with negotiable risks.' }),
      report_generated_at: new Date().toISOString(),
    })
    .eq('id', evaluationId)
  return { rfpId, evaluationId }
}

/** The newest invite token for an email on an RFP (the link the vendor receives by email). */
export async function inviteToken(email: string, rfpId: string): Promise<string> {
  const { data } = await db()
    .from('vendor_invites')
    .select('token, vendor_accounts!inner(email)')
    .eq('rfp_id', rfpId)
    .ilike('vendor_accounts.email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data!.token
}

/** Put an existing seed vendor on an RFP as Invited (as if their invite had been accepted). */
export async function enrolVendor(rfpId: string, vendorAccountId: string) {
  const { error } = await db().from('rfp_vendor_entries').insert({ org_id: await orgId(), rfp_id: rfpId, vendor_account_id: vendorAccountId, status: 'invited' })
  if (error) throw error
}

/**
 * A throwaway internal user (created the supported way: admin API with role / org in
 * app_metadata — #46). Used where a test would otherwise disturb a shared seed account, e.g.
 * sign-out, which ends all of that user's sessions.
 */
export async function createThrowawayUser(role: 'department_head' | 'finance_approver', fullName: string): Promise<string> {
  const email = `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${Date.now().toString(36)}@procuremaster.test`
  const { error } = await db().auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
    app_metadata: { user_type: 'internal', role, org_id: await orgId(), full_name: fullName },
  })
  if (error) throw error
  return email
}
