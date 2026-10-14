import { render } from '@react-email/components'
import type { ReactElement } from 'react'
import { Resend } from 'resend'

// Decision P3-3: our own React Email templates, sent via Resend. When Supabase runs locally,
// the same email goes to the local Mailpit inbox instead (Resend without a verified domain
// only delivers to the account owner, so test users could never receive mail).
const MAILPIT_SEND_URL = 'http://127.0.0.1:54324/api/v1/send'

function usesLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  return url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')
}

type SendEmailInput = { to: string; subject: string; react: ReactElement }

export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<void> {
  const html = await render(react)
  const text = await render(react, { plainText: true })
  const from = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  if (usesLocalSupabase()) {
    const res = await fetch(MAILPIT_SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ From: { Email: from, Name: 'ProcureMaster' }, To: [{ Email: to }], Subject: subject, HTML: html, Text: text }),
    })
    if (!res.ok) throw new Error(`Mailpit send failed: ${res.status}`)
    return
  }

  const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, subject, html, text })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
}
