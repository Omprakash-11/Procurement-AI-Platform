import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type SignupConfirmationEmailProps = { confirmUrl: string }

// Decisions P3-2 / S-1 — confirm the email, then choose a password. Deliberately contains
// no user-supplied names (#53): whoever started the signup chose them.
export default function SignupConfirmationEmail({ confirmUrl }: SignupConfirmationEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up ProcureMaster" heading="Confirm your email">
      <EmailText>Confirm your email address and choose a password to finish creating your ProcureMaster workspace.</EmailText>
      <EmailButton href={confirmUrl}>Confirm email</EmailButton>
      <EmailFinePrint>This link expires in 60 minutes and can be used once.</EmailFinePrint>
      <EmailFinePrint>
        If you didn&apos;t sign up for ProcureMaster, you can ignore this email — nobody can sign in with this address until a password is chosen
        through this link.
      </EmailFinePrint>
    </EmailLayout>
  )
}
