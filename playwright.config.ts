import { defineConfig, devices } from '@playwright/test'

// Plan Phase 11 / Tech Stack §12: Playwright E2E only, Chromium, against local Supabase with the
// seed data. Decisions P11-1 / P11-2:
//  - the app under test runs on port 3100 with the test-only Gemini stand-in (GEMINI_MOCK=1);
//    LIVE_AI=1 runs it with real Gemini instead (use with `--grep @live-ai`);
//  - global setup resets the database once; specs create their own data; one worker.
// Run `npm run build` first — the web server serves the production build.

const PORT = 3100
const live = process.env.LIVE_AI === '1'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/global-setup.ts',
  ...(live ? {} : { grepInvert: /@live-ai/ }),
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { GEMINI_MOCK: live ? '0' : '1', NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}` },
  },
})
