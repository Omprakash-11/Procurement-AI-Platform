import type { Metadata } from 'next'
import Link from 'next/link'

import { SignupForm } from '@/components/auth/signup-form'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { isDemoMode } from '@/lib/demo'

export const metadata: Metadata = { title: 'Create your workspace — ProcureMaster' }
// Read DEMO_MODE per request (not baked in at build time).
export const dynamic = 'force-dynamic'

// App Flow §1 /signup — decision P3-1: creates a new organisation and its PM. Decision P12-2:
// closed in a demonstration deployment, which uses its prepared accounts.
export default function SignupPage() {
  if (isDemoMode()) {
    return (
      <Card data-testid="signup-closed">
        <CardHeader className="space-y-1.5">
          <h1 className="font-heading text-4xl text-card-foreground">Demonstration environment</h1>
          <CardDescription>New workspaces can&apos;t be created here. Sign in with one of the prepared demo accounts to explore every role.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" size="lg">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
  return <SignupForm />
}
