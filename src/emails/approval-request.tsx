import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type ApprovalRequestEmailProps = { rfpTitle: string; vendorName: string; submittedBy: string; slaDue: string; approvalUrl: string }

// Tech Stack §9.2 — approval-request.tsx: PM submits → Finance Approver. App Flow §6 deep link
// to /approvals/[id] (signed-out users go through login and come back).
export default function ApprovalRequestEmail({ rfpTitle, vendorName, submittedBy, slaDue, approvalUrl }: ApprovalRequestEmailProps) {
  return (
    <EmailLayout preview="A vendor selection needs your approval" heading="A vendor selection needs your approval">
      <EmailText>
        {submittedBy} submitted {vendorName} for approval on: {rfpTitle}
      </EmailText>
      <EmailText>Decision due by {slaDue}.</EmailText>
      <EmailButton href={approvalUrl}>Review the request</EmailButton>
    </EmailLayout>
  )
}
