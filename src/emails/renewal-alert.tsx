import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type RenewalAlertEmailProps = { contractTitle: string; vendorName: string; endDate: string; daysRemaining: number; contractUrl: string }

// Tech Stack §9.2 — renewal-alert.tsx: contract expiry threshold hit → PM.
export default function RenewalAlertEmail({ contractTitle, vendorName, endDate, daysRemaining, contractUrl }: RenewalAlertEmailProps) {
  const heading = daysRemaining > 0 ? `A contract expires in ${daysRemaining} days` : 'A contract has reached its end date'
  return (
    <EmailLayout preview={heading} heading={heading}>
      <EmailText>
        {contractTitle} with {vendorName} ends on {endDate}.
      </EmailText>
      <EmailButton href={contractUrl}>Review the contract</EmailButton>
    </EmailLayout>
  )
}
