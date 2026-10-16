# ProcureMaster

ProcureMaster is a production-grade, full-stack AI procurement platform for small and mid-sized companies (10–200 employees). It takes a purchase from the first internal request to a signed contract: requirements, requests for proposal (RFPs), vendor proposals, AI-assisted evaluation, finance approval and contract renewals. It is built to shorten that cycle and keep every decision documented.

The platform is complete in its own right: multi-tenant organisations, role-based access, row-level security, an AI document pipeline, approval workflow, scheduled jobs, email notifications, PDF reports and an end-to-end test suite. An optional **demonstration mode** sits on top of it, so the platform can be explored with sample data from each user's point of view: live at **[procurement-ai-platform.vercel.app](https://procurement-ai-platform.vercel.app)**. See [Demonstration mode](#demonstration-mode-optional).

## Documentation

- [Customer use case](Docs/case-study/customer-use-case.md): the business problem, the customer's requirements, and how ProcureMaster and its AI solve them
- [Architecture and technology flow](Docs/case-study/architecture.md): system architecture, request flow, AI document pipeline, procurement workflow, security model and deployment, with diagrams
- [Demo walkthrough](Docs/case-study/demo-walkthrough.md): a step-by-step guide for visitors that follows one purchase through the whole workflow, as every role (demonstration mode)

## Who uses it

| Role | What they do |
| --- | --- |
| Procurement Manager | Owns the organisation; runs RFPs, invites vendors, runs the AI evaluation, submits vendor selections for approval, manages contracts and the team |
| Department Head | Raises purchase requirements, reviews evaluations and adds recommendations |
| Finance Approver | Approves or rejects vendor selections with a reason |
| Vendor (external) | Invited per RFP; sees only its own RFPs and submits proposals. Never sees scores, flags, reports or other vendors. |

## Features

- **Requirements to RFP:** departments raise requirements; the Procurement Manager turns them into RFPs and tracks them on a pipeline board.
- **Vendor portal:** invite-only access with expiring single-use links, proposal upload (PDF, DOCX, XLSX) and submission.
- **AI document pipeline:** each proposal's text is extracted on the server and Google Gemini pulls out key terms and flags compliance risks. Processing runs in the background with automatic retries.
- **AI-assisted evaluation:** suggested weighted criteria, per-vendor scoring with justifications, and a comparison report with an advisory recommendation. People make every decision; AI output never moves the workflow on by itself.
- **Approval workflow:** Procurement Manager → Finance Approver, with SLA reminders. Approval creates the contract.
- **Contracts:** renewal alerts before the end date (daily scheduled job).
- **Across the app:** activity log with before/after history, in-app and email notifications, full-text search, PDF export of reports.

### Where AI is used

| Feature | What it does |
| --- | --- |
| Document extraction | Pulls price, payment terms, service levels, contract length and other key terms out of each proposal |
| Compliance flags | Marks risky clauses (auto-renewal, low liability caps, data outside the required region, slow breach notification…) as high, medium or low |
| Scoring criteria | Suggests weighted evaluation criteria from the RFP |
| Scoring | Scores each vendor against each criterion, with a short justification |
| Comparison report | Writes an executive summary and an advisory recommendation |

All AI calls run on the server and return JSON, which is validated with Zod before anything is stored. Text written by AI is always marked in the interface with a violet ✨ icon.

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router), React 19, TypeScript (strict) |
| Data and auth | Supabase: Postgres with row-level security on every table, Auth (JWT claims from a custom access token hook), private Storage with signed URLs |
| AI | Google Gemini (`@google/genai`), server-side only |
| Document parsing | pdf-parse, mammoth (DOCX), SheetJS (XLSX) |
| UI | Tailwind CSS, shadcn/ui, Lucide icons, Recharts, dnd-kit, Sonner |
| State and forms | TanStack Query and Table, Zustand (UI state only), React Hook Form with Zod |
| Email | Resend with React Email templates |
| PDF export | Puppeteer (`puppeteer-core` with `@sparticuz/chromium` on Vercel) |
| Scheduled jobs | Vercel Cron calling protected API routes |
| Testing | Playwright end-to-end tests (page-object model) |
| Hosting | Vercel and Supabase |

## Building and running the platform

### Prerequisites

- Node.js 20 or later
- Docker Desktop (for the local Supabase stack) and the Supabase CLI
- A Google Gemini API key (Google AI Studio)
- A Resend API key, for email

### Local setup

```bash
npm ci
cp .env.example .env.local     # then fill in the values below
supabase start                 # local Postgres, Auth, Storage and Mailpit (email inbox)
supabase db reset              # applies every migration in supabase/migrations and the base seed data
npm run dev                    # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project. Locally, use the values from `supabase status -o env`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only service key (account creation, background processing, activity log) |
| `GEMINI_API_KEY` | Server-only Gemini key |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email delivery. Locally, emails are caught by Mailpit at http://127.0.0.1:54324. |
| `NEXT_PUBLIC_APP_URL` | The app's public address, used in email links |
| `CRON_SECRET` | Protects the scheduled-job routes |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Optional "Contact support" address on the error page |
| `DEMO_MODE` | Optional; leave empty for normal use (see [Demonstration mode](#demonstration-mode-optional)) |

The first Procurement Manager creates an organisation at `/signup`. Everyone else joins by invitation: team members from **Settings → Organisation** (Team section), vendors from an RFP.

### Tests

```bash
npm run build
npx playwright test            # resets the local database, then runs the end-to-end suite
```

The suite covers authentication, the RFP lifecycle, the vendor portal, AI processing, approvals, contracts, activity, requirements and vendor isolation. Locally it uses a test stand-in for Gemini. Run `LIVE_AI=1 npx playwright test --grep @live-ai` to check the AI flow against the real API.

### Production deployment

1. **Supabase:** create a project, then run `supabase link` and `supabase db push` to apply the migrations. In **Authentication → Hooks**, enable the custom access token hook (`public.custom_access_token_hook`). Under **Authentication → URL configuration**, set the site URL and redirect URLs to the app's address. Turn off "Allow new users to sign up": the app creates every account itself through the admin API.
2. **Vercel:** import the repository and set the environment variables above. `vercel.json` registers the scheduled jobs (renewal alerts and approval SLA reminders, daily).
3. **Email:** verify a sending domain in Resend and set `RESEND_FROM_EMAIL`.

### Project structure

```
src/app/(auth)/        sign in, sign up, password reset, onboarding
src/app/(dashboard)/   internal screens (Procurement Manager, Department Head, Finance Approver)
src/app/vendor/        vendor portal
src/app/api/           route handlers: AI processing, reports, approvals, cron jobs, ...
src/components/        UI components by feature; shadcn/ui source in components/ui
src/lib/               Supabase clients, Gemini client and prompts, schemas, queries
supabase/migrations/   database schema, RLS policies, functions and triggers
tests/                 Playwright specs and page objects
scripts/demo/          demonstration data (optional; see below)
```

## Demonstration mode (optional)

ProcureMaster is not operated by real enterprise customers, so this deployment includes a demonstration layer. It lets anyone experience the platform from the customer's point of view, as each role, with realistic sample data. Demonstration mode is an add-on: it changes nothing in how the platform works, and setting `DEMO_MODE` to empty turns it off completely.

**Live demonstration:** [procurement-ai-platform.vercel.app](https://procurement-ai-platform.vercel.app)

### What demonstration mode adds

| With `DEMO_MODE=1` | Purpose |
| --- | --- |
| A sample company, **Northbridge Industries** (fictional), with accounts for every role and RFPs at every stage: a finished AI evaluation, a pending approval, contracts (one close to renewal), requirements and activity | Explore a realistic, populated workspace straight away |
| One-click demo logins on the sign-in page | No sign-up needed |
| Shared accounts protected: password, email and organisation changes, team invites and new sign-ups are turned off, and a database rule blocks password or email changes on demo accounts | One visitor can't lock out the others |
| Emails logged instead of sent | No real messages to the fictional addresses |
| Two sample vendor proposals ([Summit Data Systems](public/samples/Summit-Data-Systems-Backup-DR-Proposal.pdf), [Harborline Cloud Services](public/samples/Harborline-Backup-DR-Proposal.pdf)), linked on the vendor upload screen | Try the live AI pipeline without your own documents |
| A nightly reset of the sample company (`/api/cron/demo-reset`, 20:30 UTC) | Every visitor starts from the same state |

The sample company's pre-loaded AI results were produced once by the real AI pipeline and stored, so they are always available. Uploading a proposal runs the live pipeline.

### Demo accounts

All accounts use the password `Northbridge2026`. You can also click a role on the sign-in page.

| Role | Email |
| --- | --- |
| Procurement Manager | procurement.manager@northbridge.example |
| Department Head | department.head@northbridge.example |
| Finance Approver | finance.approver@northbridge.example |
| Vendor: Summit Data Systems | bids@summitdata.example |
| Vendor: Harborline Cloud Services | proposals@harborline.example |
| Vendor: ClearPath Security | sales@clearpath.example |

### A five-minute tour

For the complete step-by-step guide, which takes one purchase from a new requirement to a signed contract as every role, see the **[Demo walkthrough](Docs/case-study/demo-walkthrough.md)**.

1. **A finished AI evaluation:** as the Procurement Manager, open **Pipeline** → **Managed Cloud Storage Platform** → **View Report**. A vendor's **View Details** → **Compliance** shows the flagged clauses.
2. **Submit proposals as vendors:** as **Summit Data Systems**, open **Data Backup and Disaster Recovery**, upload the Summit sample and select **Submit Proposal**. Repeat as **Harborline Cloud Services** with the Harborline sample.
3. **Watch the AI read them:** as the Procurement Manager, open that RFP. Within about a minute, each document shows key terms and compliance flags.
4. **Evaluate:** select **Start Evaluation** → **Suggest with AI** → **Confirm and Start Scoring**, then **Generate Report**.
5. **Approve:** select **Submit for Approval**, then, as the Finance Approver, approve it from **Approvals**. The contract appears under **Contracts**.

Notes for visitors: the demonstration is shared and resets nightly, so upload sample documents only, never confidential files. The AI runs on a free usage tier; if its limit is reached, a **Retry** button appears.

### Running demonstration mode yourself

```bash
# local: set DEMO_MODE=1 in .env.local, then
npm run demo:seed              # load the sample company (once)
npm run demo:reset             # restore it to its starting state

# hosted Supabase (refuses without --production)
node --env-file=deploy.env scripts/demo/seed.mjs --reset --production
```

The scripts only ever touch the sample company. Running `npx playwright test` resets the local database, so run `npm run demo:seed` again afterwards.
