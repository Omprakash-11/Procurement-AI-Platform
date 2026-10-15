import { NotFoundState } from '@/components/feedback/error-states'

// App Flow §10.1 "/404" for deleted or unknown entities inside the app (notFound() in pages) —
// rendered within the shell.
export default function DashboardNotFound() {
  return <NotFoundState />
}
