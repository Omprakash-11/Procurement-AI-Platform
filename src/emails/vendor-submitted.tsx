import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type VendorSubmittedEmailProps = { vendorName: string; rfpTitle: string; documentCount: number; rfpUrl: string }

// Decision P6-6 / App Flow §8.3 "Vendor submits proposal → PM email". Not in Tech Stack §9.2's
// template list; added with the decision.
export default function VendorSubmittedEmail({ vendorName, rfpTitle, documentCount, rfpUrl }: VendorSubmittedEmailProps) {
  return (
    <EmailLayout preview="A vendor submitted a proposal" heading="A vendor submitted a proposal">
      <EmailText>
        {vendorName} submitted {documentCount} {documentCount === 1 ? 'document' : 'documents'} for: {rfpTitle}
      </EmailText>
      <EmailButton href={rfpUrl}>Review the RFP</EmailButton>
    </EmailLayout>
  )
}
