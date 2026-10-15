import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type ApprovalDecisionEmailProps = { decision: 'approved' | 'rejected'; rfpTitle: string; vendorName: string; decidedBy: string; comment: string; reason: string | null; rfpUrl: string }

// Tech Stack §9.2 — approval-decision.tsx: FA decision → PM (App Flow §6: rejection includes the reason).
export default function ApprovalDecisionEmail({ decision, rfpTitle, vendorName, decidedBy, comment, reason, rfpUrl }: ApprovalDecisionEmailProps) {
  const heading = decision === 'approved' ? 'Vendor selection approved' : 'Vendor selection rejected'
  return (
    <EmailLayout preview={heading} heading={heading}>
      <EmailText>
        {decidedBy} {decision} {vendorName} for: {rfpTitle}
      </EmailText>
      {reason && <EmailText>Reason: {reason}</EmailText>}
      <EmailText>Comment: {comment}</EmailText>
      <EmailButton href={rfpUrl}>Open the RFP</EmailButton>
    </EmailLayout>
  )
}
