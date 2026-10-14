import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type SignupConfirmationEmailProps = { fullName: string; orgName: string; confirmUrl: string }

// Decision P3-2 — confirm the email address before the new organisation is usable.
export default function SignupConfirmationEmail({ fullName, orgName, confirmUrl }: SignupConfirmationEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up ProcureMaster" heading="Confirm your email">
      <EmailText>
        Hi {fullName}, confirm your email address and choose a password to finish creating the {orgName} workspace.
      </EmailText>
      <EmailButton href={confirmUrl}>Confirm email</EmailButton>
      <EmailFinePrint>This link expires in 60 minutes and can be used once.</EmailFinePrint>
      <EmailFinePrint>If you didn&apos;t sign up for ProcureMaster, you can ignore this email — nobody can sign in with this address until a password is chosen through this link.</EmailFinePrint>
    </EmailLayout>
  )
}
