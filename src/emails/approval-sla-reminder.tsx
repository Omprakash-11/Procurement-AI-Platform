import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type ApprovalSlaReminderEmailProps = { rfpTitle: string; vendorName: string; slaDue: string; overdue: boolean; approvalUrl: string }

// Tech Stack §9.2 — approval-sla-reminder.tsx: SLA approaching (24h) → Finance Approver.
export default function ApprovalSlaReminderEmail({ rfpTitle, vendorName, slaDue, overdue, approvalUrl }: ApprovalSlaReminderEmailProps) {
  const heading = overdue ? 'An approval is overdue' : 'An approval is due within 24 hours'
  return (
    <EmailLayout preview={heading} heading={heading}>
      <EmailText>
        {vendorName} for {rfpTitle} — decision due by {slaDue}.
      </EmailText>
      <EmailButton href={approvalUrl}>Review the request</EmailButton>
    </EmailLayout>
  )
}
