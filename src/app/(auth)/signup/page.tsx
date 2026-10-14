import type { Metadata } from 'next'

import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = { title: 'Create your workspace — ProcureMaster' }

// App Flow §1 /signup — decision P3-1: creates a new organisation and its PM.
export default function SignupPage() {
  return <SignupForm />
}
