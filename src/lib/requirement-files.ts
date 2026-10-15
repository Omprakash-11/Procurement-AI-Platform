import { createAdminClient } from '@/lib/supabase/server'

// Decision P8-4: requirement attachments in the private org-assets bucket (no storage policies:
// reachable only through API routes that check access first, then sign a short-lived URL).
export const ATTACHMENT_BUCKET = 'org-assets'

export const requirementDir = (orgId: string, requirementId: string) => `${orgId}/requirements/${requirementId}`

export async function removeAttachmentObject(path: string) {
  await createAdminClient().storage.from(ATTACHMENT_BUCKET).remove([path])
}
