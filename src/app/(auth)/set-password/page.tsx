import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { SetPasswordForm } from '@/components/auth/set-password-form'
import { userNeedsPassword } from '@/lib/auth/needs-password'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Choose a password — ProcureMaster' }

// Decision S-1: after confirming their email, a new PM chooses the password here.
export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')
  if (!(await userNeedsPassword(data.user.id))) redirect('/onboarding')

  return <SetPasswordForm email={data.user.email ?? ''} />
}
