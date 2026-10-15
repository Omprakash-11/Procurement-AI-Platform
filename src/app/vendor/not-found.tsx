import { NotFoundState } from '@/components/feedback/error-states'

// App Flow §10.1 "/404" in the vendor portal.
export default function VendorNotFound() {
  return <NotFoundState homeHref="/vendor" homeLabel="Back to My RFPs" />
}
