# ProcureMaster — Build To-Do

Source: `Docs/ImplementationPlan_ProcureMaster.docx` (phases 0–12), checked against the other five docs.
Each phase is its own session. A phase is done only when every checklist item passes.

Legend: `[ ]` todo · `[x]` done · **⛔ Gate** = decision needed before coding (CLAUDE.md "Known conflicts" #n, or new items #24+ below).

## Decisions made

| Date | Decision |
| --- | --- |
| 2026-10-14 | **Option B — local Supabase via Docker** for Phases 2–11. Hosted project `gromqdafteemyvcguyrl` kept for later (staging/prod, decided in Phase 12). |
| 2026-10-14 | No email domain yet. Dev uses `RESEND_FROM_EMAIL=onboarding@resend.dev` (delivers only to the Resend account owner's address). Real domain swapped in later via env only. |
| 2026-10-14 | **D1 (#35)** Next.js **15.5.27** + React/React DOM **19.2.8** (+ `@types/react` 19.2.18, `@types/react-dom` 19.2.7) instead of 14.2.29/18.3.1. Reason: npm audit — every 14.2.x has open critical (unauthenticated RCE) + high advisories; fixes exist only in ≥ 15.5.24. Impact: `cookies()`/`headers()`/`params` are async. |
| 2026-10-14 | **D2 (#5)** `eslint` 9.26.0 + `eslint-config-next` 15.5.27; flat `eslint.config.mjs` via FlatCompat; adds dev dep `@eslint/eslintrc` 3.3.7. |
| 2026-10-14 | **D3 (#3)** Add `tailwindcss-animate` 1.0.7 and `recharts` 2.15.4 (pinned). JetBrains Mono via `next/font/google` (no package); the Tailwind `mono` family therefore uses `var(--font-mono)`. |
| 2026-10-14 | **D4 (#31, #32)** shadcn CLI pinned to `shadcn@2.3.0` (the version for Tailwind 3). The Radix packages that the Tech Stack §3.1 components need are allowed, installed with exact pins; list recorded under Phase 1. |
| 2026-10-14 | **D5 (#20, #24)** Content Guidelines §15 HSL values are authoritative over the §2.2 hex table. `popover` / `popover-foreground` mapped in `tailwind.config.ts`. |
| 2026-10-14 | **D6 (#7)** `AUTH_SECRET` / `NEXTAUTH_SECRET` omitted (unused). |
| 2026-10-14 | **D7 → Option B** The woff2 wasn't available, so Cal Sans loads via `next/font/google` (`Cal_Sans`, single weight 400 — the same face; no self-hosted SemiBold file). `adjustFontFallback: false` with a system-ui fallback (next/font has no metrics for it). |
| 2026-10-14 | **#34** Repo already exists — no `git init`; scaffold in a temp dir and copy in; single commit at the end of the verified phase. |

## Open items found beyond CLAUDE.md #1–23

24. Content Guidelines §2.2 hex values ≠ §15 HSL values (e.g. dark `--background`).
25. RLS gaps: no policies for `requirements`, `rfp_vendor_entries`, `vendor_invites`, `scoring_templates`; vendors can't read `rfps`/`organisations` though the portal shows them; no vendor INSERT on `submissions`.
26. RLS lets every internal user read all evaluations/scores/flags; product says DH sees only their own requirements' reports.
27. Status badges use raw Tailwind colours with no dark-mode variants.
28. PRD "Approved" stage is skipped — approval goes straight to `contracted`.
29. PRD wants flags highlighted inline in a document view; App Flow says no viewer.
30. Plan Phase 9 cites Content Guidelines §6.8 for notifications; it's App Flow §8.3.
31. `npx shadcn@latest init` now targets Tailwind v4; the stack is Tailwind 3.4.17. Needs a pinned shadcn CLI version compatible with Tailwind 3.
32. shadcn components pull in Radix packages not in Tech Stack §16 (popover, tooltip, checkbox, radio-group, label, separator, progress, avatar, slot…).
33. Local Supabase registers auth hooks in `supabase/config.toml`, not Studio → Auth → Hooks; the Schema's hook function also lacks the grants `supabase_auth_admin` needs to read `profiles`/`vendor_accounts`.
34. Repo is already a Git repo — Plan Phase 1 says `git init`.
35. Every Next 14.2.x has open critical/high advisories → resolved by D1 (Next 15.5.27).
36. `npm audit` after the Phase 1 install (2026-10-14): 30 advisories (0 critical, 18 high) in doc-pinned packages. Non-major fixes exist for `@playwright/test` (→1.64.0), `@supabase/supabase-js` (→2.117.3), `eslint` (→9.39.5), `mammoth` (→1.13.0), `react-email` (→4.3.2). Major-only fixes: `puppeteer-core` (→25.x), `postcss`/`next` (→16.x). No fix: `tailwindcss` 3.4.17 (transitive dep), `tailwindcss-animate`, **`xlsx` 0.18.5 — parses untrusted vendor uploads; npm has no patched release (SheetJS only publishes fixes on its own CDN)**. Decide before Phase 7 (xlsx) and before Phase 12 (the rest).

---

## Phase 0 — Environment setup (manual) ✅

- [x] Node.js ≥ 20 (v22.17.0), npm ≥ 10 (10.9.2)
- [x] Git 2.x (2.56.0), global identity set
- [x] Supabase CLI (2.120.0 via scoop)
- [x] Docker Desktop with WSL 2 (29.8.2, engine running)
- [x] API keys collected (Gemini, Supabase hosted, Resend) and validated; `keydetails.txt` git-ignored
- [ ] Optional: enable Windows long paths (admin)
- [ ] `supabase init` + `supabase start` + Studio loads at http://127.0.0.1:54323 (do at the start of Phase 1/2)
- [ ] Vercel CLI — deferred to Phase 12

## Phase 1 — Foundation

⛔ Gates: #3 (Recharts, `tailwindcss-animate`, JetBrains Mono not in package.json — Tailwind config requires the plugin), #5 (`eslint-config-next` 15 with Next 14), #7 (`AUTH_SECRET` unused), #20 (`popover` not mapped in Tailwind), #24 (hex vs HSL), #31 (shadcn CLI version), #32 (extra Radix deps), #34 (`git init`). Cal Sans font file source.

- [x] Scaffold Next.js 15.5.27 (D1) in a temp dir, copied in (no Tailwind v4 from the template)
- [x] `package.json` = Tech Stack §16 + D1–D4 amendments, exact pins; `.npmrc` `save-exact=true`; installed (lockfile created)
- [x] `.env.local` (local Supabase + Gemini/Resend from keydetails + generated CRON_SECRET) and `.env.example`; `.env.local` ignored, `.env.example` tracked
- [x] `.gitattributes` with `* text=auto eol=lf`; `.gitignore` merged with Next/test rules
- [x] `tsconfig.json` strict options (Tech Stack §2.1)
- [x] `tailwind.config.ts` (Content Guidelines §14 + D3/D5) + `postcss.config.mjs`; `globals.css` tokens (§15)
- [x] `src/lib/utils.ts` with `cn()`
- [x] Fonts via `next/font/google`: Cal Sans (D7 Option B) / Inter / JetBrains Mono as `--font-heading` / `--font-body` / `--font-mono`
- [x] Fix: `safelist: ['dark']` in `tailwind.config.ts` — Tailwind was purging the §15 `.dark {}` token block (found during verification)
- [x] `next-themes` ThemeProvider (class, system default)
- [x] `.prettierrc` (Tech Stack §13.1), `eslint.config.mjs` flat config with `no-console: warn`
- [x] shadcn/ui: `components.json` written by hand (`init` would overwrite §14/§15), `shadcn@2.3.0 add` for all 21 components. Extra pinned Radix (D4): avatar 1.1.10, checkbox 1.3.3, label 2.1.7, popover 1.1.15, progress 1.1.7, radio-group 1.3.8, separator 1.1.7, slot 1.2.3, tooltip 1.2.8. Two components fixed for `exactOptionalPropertyTypes` (dropdown-menu, sonner)
- [x] Full folder structure (Tech Stack §15) with `.gitkeep` placeholders
- [x] `supabase init` + `supabase start` (Studio :54323, Mailpit :54324)
- [x] `tsc --noEmit` 0 errors; `npm run lint` clean
- [x] Playwright Chromium installed (chromium-1169, matching @playwright/test 1.52.0)
- [x] `npm run dev` and `npm run build` clean

Verify (2026-10-14, checked headless with Playwright Chromium):
- [x] Dev server starts with no errors; blank page at localhost:3000 (HTTP 200, 0 console errors)
- [x] `npm run build` — 0 errors, 0 TS errors; `tsc --noEmit` 0; lint clean
- [x] Tailwind tokens apply (`bg-primary` = rgb(32, 76, 207) ≙ `225 73% 47%`)
- [x] Cal Sans, Inter and JetBrains Mono load (all three faces load via their CSS variables)
- [x] Light/dark toggle works via `<html>` class (background `0 0% 100%` → `222 47% 5%`; primary → `217 91% 60%`)
- [x] All 21 shadcn components present in `src/components/ui/`
- [x] Folder structure matches Tech Stack §15
- [x] Commit: "Phase 1: Foundation"

## Phase 2 — Database

⛔ Gates: #8 (RLS before helper functions), #9 (`requirements` ↔ `rfps` circular FK), #10 (seed as migration), #11 (`set_updated_at` on tables without `updated_at`), #12 (`NOT NULL … ON DELETE SET NULL`), #13 (vendor uniqueness / multi-org vendors), #14 (Tech Stack RLS example), #16 (`db push`/`db seed` vs `supabase db reset` locally), #25, #26, #33.

- [ ] Migrations 0001–0026 per Backend Schema §10 (order corrected per gate answers)
- [ ] Extensions, enums, 18 tables, indexes, `vendor_accounts.search_vector`
- [ ] Helper functions + `custom_access_token_hook` (+ required grants)
- [ ] RLS enabled + policies on every table
- [ ] Triggers: `set_updated_at`, `rfp_evaluation_created`, `approval_creates_contract`, `criteria_weight_check`
- [ ] Storage buckets (`vendor-documents`, `org-assets`, `contract-documents`) + storage policies
- [ ] pg_cron notification purge
- [ ] Register auth hook (local: `config.toml`)
- [ ] `supabase/seed.sql`: 1 org, PM/DH/FA users, 2 vendors, 1 RFP, 1 requirement
- [ ] `src/lib/supabase/server.ts` and `client.ts`

Verify:
- [ ] Migrations apply with 0 errors
- [ ] 18 tables, all enums, ≥ 20 triggers, all policies visible in Studio
- [ ] Seed data visible (1 org, 3 internal users, 2 vendors, 1 RFP)
- [ ] Auth hook registered; JWT carries `user_type`, `role`, `org_id`
- [ ] Supabase client files compile
- [ ] Unauthenticated `SELECT * FROM profiles` returns nothing (RLS)
- [ ] Commit

## Phase 3 — Authentication

⛔ Gates: #21 (how the first PM reaches `/signup`), #7, team-invite "pending profile" before the auth user exists, reset-password route shape vs Supabase's code flow.

- [ ] `/login`, `/reset-password`, `/reset-password/[token]` pages (App Flow §3)
- [ ] `src/middleware.ts` — protect `(dashboard)` and `/vendor`, role-based redirects
- [ ] `POST /api/auth/signup`, `POST /api/auth/invite-team`, `PATCH /api/auth/onboarding/complete`
- [ ] Onboarding wizard `/onboarding?step=1..3` with guard
- [ ] Zustand stores `useAppStore`, `useNotificationStore`
- [ ] Providers: `query-provider.tsx`, `auth-provider.tsx`; wrap root layout
- [ ] `src/types/database.ts` (generated) + `src/types/index.ts`

Verify:
- [ ] Unauthenticated `/dashboard` → `/login`
- [ ] PM signup creates org + profile
- [ ] JWT `app_metadata` has `user_type`, `role`, `org_id`
- [ ] Onboarding sets `onboarding_complete = true`
- [ ] Password reset email sends (local mail catcher)
- [ ] Invited team member receives email and sets password
- [ ] Auth routes return correct status codes
- [ ] Commit

## Phase 4 — Navigation shell

⛔ Gates: #6 (`FileContract` icon), #17 (FA Activity item), #18 (sidebar collapse state), #19 (uppercase labels), #27 (badge dark mode), #15 (sparkline history data).

- [ ] `(dashboard)/layout.tsx` grid shell (256px sidebar + sticky top bar)
- [ ] `sidebar.tsx`, `top-bar.tsx`, `breadcrumb.tsx`, `page-header.tsx`, `vendor-shell.tsx`
- [ ] `vendor/layout.tsx`
- [ ] Placeholder pages: dashboard (role-aware), pipeline, requirements, approvals, contracts, activity, settings ×2, vendor home
- [ ] Notification bell dropdown (`GET /api/notifications` mock), mark all read
- [ ] Avatar dropdown with sign out
- [ ] Global search overlay UI (no API yet)

Verify:
- [ ] PM sees all sidebar items; DH hides Pipeline/Contracts; FA per gate #17
- [ ] Vendor portal has no sidebar
- [ ] Breadcrumb only on nested pages
- [ ] Avatar shows name/email; sign out → `/login`
- [ ] Bell renders badge (even at 0)
- [ ] No hex values in components
- [ ] Dark mode switches the whole shell
- [ ] Commit

## Phase 5 — PM core: pipeline & RFPs

⛔ Gates: #13 (re-inviting a vendor across RFPs), kanban drag semantics (RFP status is per-RFP but vendor stages are per-vendor), dev email delivery only to the Resend owner address (how to test invites).

- [ ] Zod schemas `rfp.ts`, `vendor-invite.ts`
- [ ] `/api/rfps` (GET, POST), `/api/rfps/[id]` (GET, PATCH, DELETE soft), `/api/rfps/[id]/invite-vendor`
- [ ] `src/emails/vendor-invite.tsx`
- [ ] PM dashboard: 4 stat cards, pipeline snapshot, renewal & activity panels (empty for now)
- [ ] Kanban: 9 columns, dnd-kit, cards, drag → PATCH status, filters, search
- [ ] Create RFP modal (RHF + Zod), toast on success
- [ ] RFP detail split view (35/65), vendor list table, invite modal
- [ ] Vendor detail page placeholder with 4 tabs
- [ ] TanStack Query hooks in `src/lib/queries/`
- [ ] `logActivity()` + notifications on state changes (per CLAUDE.md)

Verify:
- [ ] New RFP appears in the right column
- [ ] Drag updates status in DB
- [ ] Split view shows metadata + vendor list
- [ ] Invite creates `vendor_accounts` + `vendor_invites`; email sends; row shows "Invited"
- [ ] Breadcrumb Pipeline > [RFP]
- [ ] Forms block invalid submission
- [ ] Query cache avoids refetch on back-navigation
- [ ] Commit

## Phase 6 — Vendor portal

⛔ Gates: #13 (existing-account vendors / multiple orgs), #25 (vendor read access to RFP + org), #4 (`waitUntil` / `@vercel/functions`).

- [ ] `/vendor/invite/[token]` + `/vendor/invite/expired`
- [ ] `/api/vendor/invite/[token]` (GET validate, POST accept)
- [ ] Vendor home: greeting, My RFPs table
- [ ] `/vendor/rfp/[id]`: info panel, countdown, upload zone (PDF/DOCX/XLSX ≤ 50MB), file list, submit + confirm modal, post-submit state, status banners
- [ ] `/api/submissions` (GET, POST), `/api/submissions/[id]/documents` (POST), `/[docId]` (GET, DELETE), `/api/submissions/[id]/submit`
- [ ] Vendor isolation review on every response

Verify:
- [ ] Valid token loads page; expired → `/vendor/invite/expired`
- [ ] Vendor creates account and logs in
- [ ] Vendor home shows only their RFPs
- [ ] Upload limits enforced client-side
- [ ] File stored under `{org_id}/…`; document row `queued`
- [ ] Submit disabled until a document uploads; locked after submit
- [ ] Vendor gets 401/403 on `/dashboard` and `/api/rfps`
- [ ] Commit

## Phase 7 — AI processing

⛔ Gates: #2 (Gemini model + SDK — 1.5 models unavailable on this key; 2.5 Pro/Flash available), #4, #15 (vendor notes table, share links), #29, local `puppeteer` vs `puppeteer-core` (not in package.json), when compliance runs (on upload vs on evaluation).

- [ ] `src/lib/gemini/client.ts`, `prompts.ts` (extraction, criteria, scoring, compliance, report)
- [ ] `/api/process/document/[id]`: download, extract text, scanned-doc error, Gemini, Zod-validate, store JSONB + 8 columns, status
- [ ] Fire processing non-blocking from upload route
- [ ] Vendor detail tabs: Documents (poll 5s, retry), Scores (override), Compliance (ack/escalate), Notes
- [ ] `/api/process/suggest-criteria/[rfpId]`; evaluation criteria modal (running total = 100)
- [ ] `PUT /api/evaluations/[rfpId]/criteria`; `/api/process/score/[evaluationId]`
- [ ] `/api/process/compliance/[submissionId]`; `/api/process/report/[evaluationId]`
- [ ] Comparison report page: summary, scorecard bar chart, risk table + donut, key terms, recommendation, export, share link
- [ ] `/api/reports/[rfpId]/export` (Puppeteer PDF)
- [ ] Sparkles prefix on every AI output

Verify:
- [ ] Upload → queued → processing → extracted
- [ ] Extracted fields shown; scanned PDF fails with exact message
- [ ] Suggested criteria load; ≠ 100% blocks confirm
- [ ] Scores + reasoning shown; override stores both
- [ ] Re-score increments `scoring_run_count`
- [ ] Compliance flags with correct severities
- [ ] Report renders all sections + charts; PDF downloads
- [ ] All AI content has Sparkles
- [ ] Commit

## Phase 8 — Dept Head, Finance & approvals

⛔ Gates: #15 (DH recommendation comments, requirement attachments, escalated-flag ↔ approval link), #26, #28, #12, which FA receives a request when an org has several, business-day SLA calculation.

- [ ] Zod schemas `requirement.ts`, `approval.ts`
- [ ] `/api/requirements` (+ `[id]`), `/api/approvals` (+ `[id]`, `decide`, `recall`)
- [ ] DH dashboard, requirements list, new requirement (draft/submit), requirement detail (+ comment)
- [ ] FA dashboard (SLA colours), approval queue, approval detail (embedded report, escalations, approve/reject modals)
- [ ] Emails `approval-request.tsx`, `approval-decision.tsx`

Verify:
- [ ] DH requirement reaches PM pipeline; DH sees only own
- [ ] FA SLA colours correct; email deep link works logged-in and logged-out
- [ ] Approval shows full report
- [ ] Approve creates contract + vendor `contracted`
- [ ] Reject emails PM; recall sets `recalled`
- [ ] Second pending approval per RFP blocked
- [ ] Commit

## Phase 9 — Contracts, notifications & activity

⛔ Gates: #22 (FA contract access), #15 (email notification preferences), #30, renewal-alert email recipients and dedup.

- [ ] `/api/contracts` (+ `[id]`, `terminate`); contracts list + detail (alert days inline edit, document, activity, terminate, initiate renewal)
- [ ] Wire renewal panel on PM dashboard
- [ ] Cron routes `renewal-alerts`, `approval-sla` (CRON_SECRET) + `vercel.json`
- [ ] Emails: SLA reminder, vendor status update, renewal alert, team invite, password reset
- [ ] Notifications API (GET, read-all), bell polling 30s, deep links
- [ ] Activity API (global, per-RFP), `/activity` infinite scroll + filters, per-RFP tab, per-vendor section
- [ ] Notifications for every App Flow §8.3 event

Verify:
- [ ] Contract auto-created on approval; alert days editable; terminate records reason
- [ ] Cron routes 401 without secret; renewal cron updates status + notifies
- [ ] Dashboard renewal panel shows real data
- [ ] Bell shows real counts; clicks navigate correctly
- [ ] Activity log shows events with before/after
- [ ] All email templates render
- [ ] Commit

## Phase 10 — Error handling & polish

- [ ] `not-found.tsx`, `error.tsx`, per-segment `error.tsx` and `loading.tsx`
- [ ] All API handlers try/catch → `{ error, code }`
- [ ] Inline errors: extraction/scoring retry, file type/size, weights, overrides, duplicate invite, session expired, unauthorised
- [ ] Skeleton loading states; empty tables everywhere
- [ ] Toasts per Content Guidelines §6.8
- [ ] Focus rings, `aria-label`s, `sr-only` spinner text, reduced motion
- [ ] `npm run build` and `npm run lint` clean

Verify: the 10 Plan Phase 10 checklist items (404, inline upload error, retry, skeletons, empty tables, keyboard nav, focus rings, error shape, build, lint). Commit.

## Phase 11 — E2E testing

- [ ] `playwright.config.ts` (chromium, baseURL, 30s timeout)
- [ ] Page objects in `tests/pages/`; auth fixtures for each role
- [ ] Specs: auth, rfp, vendor-portal, ai-processing, approvals, contracts, activity
- [ ] Full suite green; HTML report

Verify: 0 failures, all 5 critical flows, POM only, independent specs, < 3 min. Commit.

## Phase 12 — Production deployment

⛔ Gates: #16 (`db push --linked`), whether hosted project `gromqdafteemyvcguyrl` becomes prod or staging, custom domain + Resend domain, rotating keys shared during dev, Puppeteer on Vercel (#4).

- [ ] Prod Supabase project; link; push migrations; register auth hook; verify buckets + pg_cron
- [ ] Prod env vars; types from linked DB; production build
- [ ] Vercel project, env vars, `vercel --prod`, custom domain, crons active
- [ ] Resend production domain; send each template once
- [ ] Smoke test the full flow on the live domain

Verify: the 10 Plan Phase 12 checklist items. Commit.
