import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser } from '@/lib/api'
import { createAdminClient } from '@/lib/supabase/server'

// PATCH /api/auth/onboarding/complete — Implementation Plan Phase 3. Marks the PM's
// onboarding done; /onboarding is no longer accessible afterwards (App Flow §3.1 step 3).
// Service role: onboarding_complete is not client-writable (#39 column privileges).
export async function PATCH() {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response

  const { data, error } = await createAdminClient()
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', auth.userId)
    .eq('onboarding_complete', false)
    .select('org_id')
    .maybeSingle()
  if (error) return apiError(500, 'update_failed', 'We could not finish setup. Please try again.')

  if (data) {
    await logActivity({
      orgId: data.org_id,
      actorId: auth.userId,
      actorType: 'profile',
      entityType: 'profile',
      entityId: auth.userId,
      action: 'profile.onboarding_completed',
      description: 'Workspace setup completed',
      before: { onboarding_complete: false },
      after: { onboarding_complete: true },
    })
  }
  return NextResponse.json({ redirectTo: '/dashboard' })
}
