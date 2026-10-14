import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type SignupConfirmationEmailProps = { fullName: string; orgName: string; confirmUrl: string }

// Decision P3-2 — confirm the email address before the new organisation is usable.
export default function SignupConfirmationEmail({ fullName, orgName, confirmUrl }: SignupConfirmationEmailProps) {
  return (
    <EmailLayout preview="Confirm your email to finish setting up ProcureMaster" heading="Confirm your email">
      <EmailText>
        Hi {fullName}, confirm your email address to finish creating the {orgName} workspace.
      </EmailText>
      <EmailButton href={confirmUrl}>Confirm email</EmailButton>
      <EmailFinePrint>This link expires in 60 minutes and can be used once.</EmailFinePrint>
    </EmailLayout>
  )
}
