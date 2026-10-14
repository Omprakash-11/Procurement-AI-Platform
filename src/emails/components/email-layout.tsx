import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { ReactNode } from 'react'

// Email clients don't support CSS variables, so emails can't use the app's tokens.
// These literals mirror Content Guidelines §2 (light mode) and are the only place
// raw colour values are allowed.
export const emailColors = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  foreground: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  primary: '#1D4ED8',
  primaryForeground: '#FFFFFF',
} as const

const font = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

type EmailLayoutProps = { preview: string; heading: string; children: ReactNode }

export function EmailLayout({ preview, heading, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: emailColors.background, fontFamily: font, margin: 0, padding: '32px 0' }}>
        <Container style={{ backgroundColor: emailColors.card, border: `1px solid ${emailColors.border}`, borderRadius: 4, maxWidth: 520, padding: 32 }}>
          <Text style={{ color: emailColors.primary, fontSize: 14, fontWeight: 600, margin: '0 0 24px' }}>ProcureMaster</Text>
          <Text style={{ color: emailColors.foreground, fontSize: 22, fontWeight: 600, lineHeight: '30px', margin: '0 0 16px' }}>{heading}</Text>
          {children}
          <Hr style={{ borderColor: emailColors.border, margin: '32px 0 16px' }} />
          <Text style={{ color: emailColors.muted, fontSize: 12, lineHeight: '18px', margin: 0 }}>
            You received this email because of activity on your ProcureMaster account. If this wasn&apos;t you, you can ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function EmailText({ children }: { children: ReactNode }) {
  return <Text style={{ color: emailColors.foreground, fontSize: 15, lineHeight: '24px', margin: '0 0 16px' }}>{children}</Text>
}

export function EmailButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: '24px 0' }}>
      <Button
        href={href}
        style={{ backgroundColor: emailColors.primary, borderRadius: 4, color: emailColors.primaryForeground, fontSize: 14, fontWeight: 500, padding: '12px 20px', textDecoration: 'none' }}
      >
        {children}
      </Button>
    </Section>
  )
}

export function EmailFinePrint({ children }: { children: ReactNode }) {
  return <Text style={{ color: emailColors.muted, fontSize: 13, lineHeight: '20px', margin: '0 0 8px' }}>{children}</Text>
}
