import { NextResponse } from 'next/server'

import PasswordResetEmail from '@/emails/password-reset'
import { appUrl, withErrors } from '@/lib/api'
import { sendEmail } from '@/lib/email/send'
import { resetRequestSchema } from '@/lib/schemas/auth'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/auth/reset-password — App Flow §3: always answers with success whether or not
// the email exists (no account enumeration). Link valid 60 minutes (Supabase otp_expiry).
export const POST = withErrors(async function POST(request: Request) {
  const parsed = resetRequestSchema.safeParse(await request.json().catch(() => ({})))
  if (parsed.success) {
    const { email } = parsed.data
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'recovery', email })
    // generateLink fails for unknown emails — deliberately indistinguishable to the caller.
    if (!error && data.properties?.hashed_token) {
      const resetUrl = appUrl(`/reset-password/${encodeURIComponent(data.properties.hashed_token)}`)
      try {
        await sendEmail({ to: email, subject: 'Reset your ProcureMaster password', react: PasswordResetEmail({ resetUrl }) })
      } catch (err) {
        console.error('reset-password: email failed', err)
      }
    }
  }
  return NextResponse.json({ status: 'sent' })
})
