import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Server-only parsing / PDF libraries load from node_modules at runtime instead of being
  // bundled (pdf-parse and @sparticuz/chromium read files relative to their package).
  serverExternalPackages: ['pdf-parse', 'mammoth', 'xlsx', 'puppeteer-core', '@sparticuz/chromium'],
}

export default nextConfig
