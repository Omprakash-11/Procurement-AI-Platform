import { EmailButton, EmailFinePrint, EmailLayout, EmailText } from './components/email-layout'

type VendorInviteEmailProps = { orgName: string; rfpTitle: string; personalMessage: string | null; acceptUrl: string; expiresInHours: number }

// Tech Stack §9.2 — PM invites a vendor to an RFP. Subject is neutral (S-2); the
// organisation-supplied names and message appear only in the body, as plain text.
export default function VendorInviteEmail({ orgName, rfpTitle, personalMessage, acceptUrl, expiresInHours }: VendorInviteEmailProps) {
  return (
    <EmailLayout preview="You've been invited to submit a proposal on ProcureMaster" heading="You've been invited to submit a proposal">
      <EmailText>
        {orgName} has invited you to respond to: {rfpTitle}
      </EmailText>
      {personalMessage && <EmailText>Message from the procurement team: {personalMessage}</EmailText>}
      <EmailButton href={acceptUrl}>View invitation</EmailButton>
      <EmailFinePrint>This link expires in {expiresInHours} hours and can be used once.</EmailFinePrint>
    </EmailLayout>
  )
}
