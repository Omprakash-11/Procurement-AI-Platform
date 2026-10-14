'use client'

import { Building2, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { fetchJson } from '@/lib/fetch-json'

type CompleteStepProps = { orgName: string; invitesSent: number }

// App Flow §3.1 step 3: summary + single CTA. Completing locks /onboarding.
export function CompleteStep({ orgName, invitesSent }: CompleteStepProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const finish = async () => {
    setPending(true)
    try {
      const { redirectTo } = await fetchJson<{ redirectTo: string }>('/api/auth/onboarding/complete', { method: 'PATCH' })
      router.replace(redirectTo)
      router.refresh()
    } catch (err) {
      setPending(false)
      toast.error(err instanceof Error ? err.message : 'We could not finish setup.', { duration: 6000 })
    }
  }

  return (
    <div className="space-y-6">
      <dl className="space-y-3 rounded border border-border p-4 text-sm">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
          <dt className="text-muted-foreground">Organisation</dt>
          <dd className="ml-auto font-medium text-foreground">{orgName}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" aria-hidden="true" />
          <dt className="text-muted-foreground">Invites sent</dt>
          <dd className="ml-auto font-medium text-foreground">{invitesSent}</dd>
        </div>
      </dl>
      <Button size="lg" className="w-full" onClick={finish} disabled={pending} aria-busy={pending || undefined}>
        Go to Dashboard
      </Button>
    </div>
  )
}
