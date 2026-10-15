import { EmailButton, EmailLayout, EmailText } from './components/email-layout'

type EvaluationReadyEmailProps = { rfpTitle: string; reportUrl: string }

// Decision P7 defaults: Generate Report notifies the Department Head who raised the
// requirement (notification type evaluation_ready). Not in Tech Stack §9.2's template list;
// added with the decision. No scores or vendor details in the email — they stay in the app.
export default function EvaluationReadyEmail({ rfpTitle, reportUrl }: EvaluationReadyEmailProps) {
  return (
    <EmailLayout preview="A vendor evaluation is ready" heading="A vendor evaluation is ready">
      <EmailText>The comparison report for your requirement is ready to review: {rfpTitle}</EmailText>
      <EmailButton href={reportUrl}>View the report</EmailButton>
    </EmailLayout>
  )
}
