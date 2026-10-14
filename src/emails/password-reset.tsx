import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type PasswordResetEmailProps = { resetUrl: string }

// Tech Stack §9.2 — user requests a password reset. App Flow §3: link valid for 60 minutes.
export default function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <EmailLayout preview="Reset your ProcureMaster password" heading="Reset your password">
      <EmailText>We received a request to reset the password for your ProcureMaster account.</EmailText>
      <EmailButton href={resetUrl}>Set a new password</EmailButton>
      <EmailFinePrint>This link expires in 60 minutes and can be used once.</EmailFinePrint>
      <EmailFinePrint>If you didn&apos;t ask for this, no action is needed — your password stays the same.</EmailFinePrint>
    </EmailLayout>
  )
}
