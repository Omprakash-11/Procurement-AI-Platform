import { NextResponse } from 'next/server'

import { logActivity } from '@/lib/activity'
import { apiError, INTERNAL_ROLES, requireUser, validationError } from '@/lib/api'
import { accountProfileSchema } from '@/lib/schemas/auth'
import { LOGO_MAX_BYTES, LOGO_MIME_TYPES } from '@/lib/schemas/organisation'
import { createAdminClient } from '@/lib/supabase/server'

const IMAGE_EXT: Record<(typeof LOGO_MIME_TYPES)[number], string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

// PATCH /api/account — App Flow §9.1 "Save Profile": full name + optional profile photo.
// multipart/form-data. Photos: org-assets/{org_id}/avatars/{user_id}.{ext} (#55).
export async function PATCH(request: Request) {
  const auth = await requireUser(INTERNAL_ROLES)
  if (!auth.ok) return auth.response
  const orgId = auth.claims.org_id
  if (!orgId) return apiError(403, 'forbidden', 'You do not have permission to do that.')

  const form = await request.formData().catch(() => null)
  if (!form) return apiError(400, 'validation_error', 'Some fields are invalid.')
  const parsed = accountProfileSchema.safeParse({ fullName: form.get('fullName') })
  if (!parsed.success) return validationError(parsed.error)

  const { data: before } = await auth.supabase.from('profiles').select('full_name, avatar_url').eq('id', auth.userId).single()
  if (!before) return apiError(404, 'not_found', 'Profile not found.')

  let avatarPath = before.avatar_url
  const photo = form.get('photo')
  if (photo instanceof File && photo.size > 0) {
    const ext = IMAGE_EXT[photo.type as (typeof LOGO_MIME_TYPES)[number]]
    if (!ext) return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { photo: ['Photo must be a PNG, JPG or WebP image.'] } })
    if (photo.size > LOGO_MAX_BYTES) return apiError(400, 'validation_error', 'Some fields are invalid.', { fields: { photo: ['Photo must be 2MB or smaller.'] } })
    avatarPath = `${orgId}/avatars/${auth.userId}.${ext}`
    const { error: uploadError } = await createAdminClient()
      .storage.from('org-assets')
      .upload(avatarPath, photo, { contentType: photo.type, upsert: true })
    if (uploadError) return apiError(500, 'upload_failed', 'We could not upload the photo. Please try again.')
  }

  // Runs as the user: column privileges allow only full_name / avatar_url (#39).
  const after = { full_name: parsed.data.fullName, avatar_url: avatarPath }
  const { error } = await auth.supabase.from('profiles').update(after).eq('id', auth.userId)
  if (error) return apiError(500, 'update_failed', 'We could not save your profile. Please try again.')

  await logActivity({
    orgId,
    actorId: auth.userId,
    actorType: 'profile',
    entityType: 'profile',
    entityId: auth.userId,
    action: 'profile.updated',
    description: 'Profile updated',
    before,
    after,
  })
  return NextResponse.json({ status: 'saved' })
}
