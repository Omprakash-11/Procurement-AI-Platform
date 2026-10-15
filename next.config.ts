import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Server-only parsing / PDF libraries load from node_modules at runtime instead of being
  // bundled (pdf-parse and @sparticuz/chromium read files relative to their package).
  serverExternalPackages: ['pdf-parse', 'mammoth', 'xlsx', 'puppeteer-core', '@sparticuz/chromium'],
  // Decision P10-2: the 500 page's "Contact support" address — NEXT_PUBLIC_SUPPORT_EMAIL, else the
  // (non-secret) email sender address; empty hides the link.
  env: { NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || process.env.RESEND_FROM_EMAIL || '' },
}

export default nextConfig
