'use client'

import { CheckCircle2 } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CURRENCIES } from '@/lib/schemas/organisation'

import { CompleteStep } from './complete-step'
import { InviteTeamStep } from './invite-team-step'
import { OrgProfileStep } from './org-profile-step'

const STEPS = ['Organisation profile', 'Invite your team', 'Complete'] as const

type OnboardingWizardProps = {
  step: 1 | 2 | 3
  orgName: string
  currency: (typeof CURRENCIES)[number]
  invitesSent: number
}

// App Flow §3.1 — three steps with a progress indicator at the top.
export function OnboardingWizard({ step, orgName, currency, invitesSent }: OnboardingWizardProps) {
  return (
    <Card>
      <CardHeader className="space-y-6">
        <ol className="flex items-center gap-2" aria-label="Setup progress">
          {STEPS.map((label, index) => {
            const number = index + 1
            const state = number < step ? 'done' : number === step ? 'current' : 'upcoming'
            return (
              <li key={label} className="flex flex-1 flex-col gap-2" aria-current={state === 'current' ? 'step' : undefined}>
                <span className={cn('h-1 rounded-full', state === 'upcoming' ? 'bg-muted' : 'bg-primary')} aria-hidden="true" />
                <span className={cn('flex items-center gap-1 text-xs', state === 'current' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {state === 'done' && <CheckCircle2 className="size-3 text-primary" aria-hidden="true" />}
                  <span className="sr-only">Step {number}: </span>
                  {label}
                </span>
              </li>
            )
          })}
        </ol>
        <div className="space-y-1.5">
          <h1 className="font-heading text-4xl text-card-foreground">
            {step === 1 && 'Set up your organisation'}
            {step === 2 && 'Invite your team'}
            {step === 3 && 'Your workspace is ready'}
          </h1>
          <CardDescription>
            {step === 1 && 'These details appear in the app and on exported reports. You can change them later in Settings.'}
            {step === 2 && 'Invite Department Heads and Finance Approvers. They get an email link to set up their account.'}
            {step === 3 && 'Here’s what was set up.'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {step === 1 && <OrgProfileStep defaultName={orgName} defaultCurrency={currency} />}
        {step === 2 && <InviteTeamStep />}
        {step === 3 && <CompleteStep orgName={orgName} invitesSent={invitesSent} />}
      </CardContent>
    </Card>
  )
}
