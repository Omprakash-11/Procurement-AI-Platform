import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type TeamInviteEmailProps = { orgName: string; inviterName: string; roleLabel: string; acceptUrl: string }

// Tech Stack §9.2 — PM invites an internal user (Department Head / Finance Approver).
export default function TeamInviteEmail({ orgName, inviterName, roleLabel, acceptUrl }: TeamInviteEmailProps) {
  return (
    <EmailLayout preview={`Join ${orgName} on ProcureMaster`} heading={`Join ${orgName} on ProcureMaster`}>
      <EmailText>
        {inviterName} has invited you to join {orgName} as a {roleLabel}.
      </EmailText>
      <EmailButton href={acceptUrl}>Accept invite</EmailButton>
      <EmailFinePrint>This link expires in 24 hours and can be used once.</EmailFinePrint>
    </EmailLayout>
  )
}
