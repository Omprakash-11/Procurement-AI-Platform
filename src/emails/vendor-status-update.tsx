import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

export type VendorOutcome = 'shortlisted' | 'not_selected' | 'contracted'

// App Flow §7 banners, reused as the email copy (decision P5-6: outcomes only).
const COPY: Record<VendorOutcome, { heading: string; body: string }> = {
  shortlisted: { heading: 'Your proposal has been shortlisted', body: 'Your proposal has been shortlisted for this RFP.' },
  not_selected: {
    heading: 'Update on your proposal',
    body: 'Thank you for your proposal. Another vendor has been selected for this RFP.',
  },
  contracted: {
    heading: 'Your proposal has been approved',
    body: 'Congratulations — your proposal has been approved. The procurement team will be in touch.',
  },
}

type VendorStatusUpdateEmailProps = { outcome: VendorOutcome; rfpTitle: string; portalUrl: string }

// Tech Stack §9.2 — vendor-status-update.tsx. Never mentions scores, other vendors or flags.
export default function VendorStatusUpdateEmail({ outcome, rfpTitle, portalUrl }: VendorStatusUpdateEmailProps) {
  const copy = COPY[outcome]
  return (
    <EmailLayout preview={copy.heading} heading={copy.heading}>
      <EmailText>RFP: {rfpTitle}</EmailText>
      <EmailText>{copy.body}</EmailText>
      <EmailButton href={portalUrl}>Open the vendor portal</EmailButton>
    </EmailLayout>
  )
}
