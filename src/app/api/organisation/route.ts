import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, requireUser, validationError } from '@/lib/api'
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES, orgProfileSchema } from '@/lib/schemas/organisation'
import { createAdminClient } from '@/lib/supabase/server'

const LOGO_EXT: Record<(typeof LOGO_MIME_TYPES)[number], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// PATCH /api/organisation — org profile (name, currency, optional logo) for onboarding
// step 1 and later /settings/organisation. Not in Backend Schema §8 (TODO.md #45); added
// so the change goes through the API with an activity-log entry. multipart/form-data.
export async function PATCH(request: Request) {
  const auth = await requireUser(['procurement_manager'])
  if (!auth.ok) return auth.response
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')

  const form = await request.formData().catch(() => null)
  if (!form) return apiError(400, 'validation_error', 'Some fields are invalid.')

  const parsed = orgProfileSchema.safeParse({ name: form.get('name'), currency: form.get('currency') })
  if (!parsed.success) return validationError(parsed.error)

  const admin = createAdminClient()
  const { data: before } = await admin.from('organisations').select('name, currency, logo_url').eq('id', orgId).single()
  if (!before) return apiError(404, 'not_found', 'Organisation not found.')

  let logoPath = before.logo_url
  const logo = form.get('logo')
  if (logo instanceof File && logo.size > 0) {
    const ext = LOGO_EXT[logo.type as (typeof LOGO_MIME_TYPES)[number]]
    if (!ext) return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { logo: ['Logo must be a PNG, JPG or WebP image.'] } })
    if (logo.size > LOGO_MAX_BYTES) return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { logo: ['Logo must be 2MB or smaller.'] } })

    // Backend Schema §9: org-assets/{org_id}/logo.{ext}
    logoPath = `${orgId}/logo.${ext}`
    const { error: uploadError } = await admin.storage
      .from('org-assets')
      .upload(logoPath, logo, { contentType: logo.type, upsert: true })
    if (uploadError) return apiError(500, 'upload_failed', 'We could not upload the logo. Please try again.')
  }

  const after = { name: parsed.data.name, currency: parsed.data.currency, logo_url: logoPath }
  const { error } = await admin.from('organisations').update(after).eq('id', orgId)
  if (error) return apiError(500, 'update_failed', 'We could not save your changes. Please try again.')

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'organisation',
    entityId: orgId,
    action: 'organisation.updated',
    description: `Organisation profile updated`,
    before,
    after,
  })
  return NextResponse.json({ organisation: after })
}
