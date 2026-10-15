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
| 2026-10-14 | **P2-1 (#37)** Accounts created only server-side via the admin API; `handle_new_user` reads role/org from `raw_app_meta_data` (service-role only); public signup disabled; auth users without an internal role get no profile. |
| 2026-10-14 | **P2-2 (#33)** Auth hook registered in `supabase/config.toml`; `supabase_auth_admin` gets EXECUTE on the hook + SELECT/RLS read on `profiles`/`vendor_accounts`; hook revoked from anon/authenticated/public; app_metadata merged, and stale role/org claims stripped. |
| 2026-10-14 | **P2-3 (#13)** One `vendor_accounts` row per (org, email), reused across that org's RFPs; one auth user may have rows in several orgs. Vendor JWT: `user_type=vendor`, `role=vendor`, no `org_id`; vendor access keyed on `auth.uid()`. |
| 2026-10-14 | **P2-4 (#25, #38)** Vendors get RLS read only on their own `vendor_accounts`, `rfp_vendor_entries`, `submissions`. RFP/org details, document upload/list/delete and file downloads go through service-role API routes with whitelisted fields. No vendor storage policies. |
| 2026-10-14 | **P2-5 (#25)** requirements: DH own (read/create, edit while draft/submitted), PM read/update in org, FA none. rfp_vendor_entries: internal read, PM write. vendor_invites, scoring_templates: PM only. |
| 2026-10-14 | **P2-6 (#26)** `can_read_rfp(rfp_id)`: PM any RFP in org; DH RFPs linked to own requirements; FA RFPs with an approval request. Used by the read policies on rfps and all evaluation-side tables. |
| 2026-10-14 | **P2-7 (#12)** Keep NOT NULL; replace `ON DELETE SET NULL` with a restricting action on those FKs. Implemented as `NO ACTION` (checked at end of statement) rather than `RESTRICT`, so an org-level cascade delete still works. |
| 2026-10-14 | **P2-8 (#8–#11)** Filenames kept, 0021 = functions, 0022 = RLS; requirements→rfps FK added in 0007; seed only in `supabase/seed.sql`; `set_updated_at` on the 15 tables with `updated_at`; trigger total 19. |
| 2026-10-14 | **P2-9 (#16)** Local workflow: `supabase db reset` (migrations + seed); `supabase migration up` for increments. |
| 2026-10-14 | **P2-10** Seed users `pm@ / dh@ / fa@ / vendor1@ / vendor2@procuremaster.test`, password `Password123!` (local only). |
| 2026-10-14 | **#39 confirmed** — profile self-update limited to `full_name` / `avatar_url`. |
| 2026-10-14 | **P3-1 (#21)** Public `/signup` creates only a NEW org + its PM (role forced server-side). Fields: full name, work email, org name, password, confirm. No signup link on `/login`. |
| 2026-10-14 | **P3-2** Signup requires email verification: "check your email" → `/auth/confirm` link → signed in at `/onboarding`. |
| 2026-10-14 | **P3-3** Auth emails = our one-time links (Supabase admin API) + React Email templates via Resend; when Supabase is local, the same emails go to Mailpit's HTTP API instead. No new package. |
| 2026-10-14 | **P3-4** Forgot password = modal on `/login`; `/reset-password` (no token) → `/login`; `/reset-password/[token]` link valid 60 min. |
| 2026-10-14 | **P3-5** Team invites accepted at `/accept-invite/[token]` (full name + password), link valid 24 h, re-inviting re-sends. |
| 2026-10-14 | **P3-6** Passwords: at least 8 characters, letters + digits (Supabase config + Zod). |
| 2026-10-14 | **P3-7 (#40a)** Auth hook keeps only Supabase's provider fields plus our claims in `app_metadata`. |
| 2026-10-14 | **S-1 (#48)** Signup collects no password; the confirmation link → `/set-password` (service-only `needs_password` flag, cleared on set; onboarding blocked until then). An unconfirmed, un-onboarded signup is replaced by a repeat signup (60 s cooldown → 429). Supersedes the password part of P3-1. |
| 2026-10-14 | **S-2 (#49)** Invite emails capped at 20 per org per rolling 24 h (counted from `activity_log`); neutral subject "You've been invited to ProcureMaster"; user-supplied names only in the body. Phase 5 vendor invites must use the same limit. |
| 2026-10-14 | **S-1 refined (#52, #53, security review)** Repeat signup for a still-pending signup no longer deletes anything — it only re-sends the link to the same inbox (≤ 1/min, ≤ 5/day per signup); user lookups by email use a token-free DB function (0029); the confirmation email carries no user-supplied names. |
| 2026-10-14 | **S-2 refined (#51, security review)** Each invite email is reserved atomically in the DB (0029: per-org advisory lock + ledger row `invite.email_sent`) before sending; addresses that can't be invited are rejected before spending quota. |
| 2026-10-14 | **P4-1 (#17)** FA sidebar: Dashboard, Approvals, Activity (App Flow). |
| 2026-10-14 | **P4-2 (#18)** Sidebar always visible (256px); no collapse state. |
| 2026-10-14 | **P4-3 (#19)** Uppercase only where component specs say (table headers, kanban column titles, sidebar section labels). |
| 2026-10-14 | **P4-4 (#27)** Semantic status tokens (success / warning / danger / info / neutral / ai; bg + fg) with light + dark values; light values = documented colours. |
| 2026-10-14 | **P4-5 (#6)** `FileSignature` for contract records; Contracts nav stays `FileText`. |
| 2026-10-14 | **P4-6** Theme switch (Light / Dark / System) in the avatar dropdown. |
| 2026-10-14 | **P4-7** Sidebar keeps the ProcureMaster brand area; the org logo (if any) + name shown as a small row beneath it. |
| 2026-10-14 | **P4-8 (#44, #50)** Phase 4 builds `/account` (name, photo, change password; email preferences wait for #15) and `/settings/organisation` (profile + Team: members list, invite / resend; Delete Organisation deferred). Scoring templates move to Phase 7. |
| 2026-10-14 | **P4-9** Notification bell uses real `notifications` rows (GET + PATCH read-all) — no mock data. |
| 2026-10-14 | **Default** Vendor shell shows the company name from the vendor's most recent invite. |
| 2026-10-14 | **P5-1** Kanban: PM drags between working stages (Requirements Received → Shortlisted, either way). Approval Pending / Contracted refuse drops; Archived only via "Archive RFP" + confirmation; locked stages can't be dragged out. Events auto-advance (first invite → Vendors Invited). |
| 2026-10-14 | **P5-2** "Requirements Received" shows submitted requirements without an RFP as requirement cards → `/requirements/[id]` → PM "Create RFP" (modal prefilled) links them and sets the requirement In Progress. |
| 2026-10-14 | **P5-3** Department = text input with suggestions from departments already used in the org. |
| 2026-10-14 | **P5-4 (#15)** Sparklines = daily counts of related `activity_log` events, last 30 days. |
| 2026-10-14 | **P5-5** "Remove" vendor only while Invited: expires pending invites, entry → Not Selected (kept as history, labelled "Removed"). |
| 2026-10-14 | **P5-6** Shortlist toggle once submitted (Shortlisted ↔ Under Review). Vendors emailed only on Shortlisted / Not Selected / Contracted, at most once per status per RFP. |
| 2026-10-14 | **Defaults (P5)** Pipeline date filter = submission deadline; dashboard renewal + activity panels use real data now; vendor invites share the S-2 quota; 64-char tokens, 72 h. |
| 2026-10-14 | **P6-1** Vendor uploads go browser → Supabase Storage via a short-lived signed upload URL for an exact server-chosen path; the API then confirms (object exists, ≤ 50MB, PDF/DOCX/XLSX signature) before creating the `queued` document row. (Vercel's 4.5MB body limit rules out proxying.) |
| 2026-10-14 | **P6-2** Vendor "Remove" before submit permanently deletes the draft document row + stored file (logged). Nothing removable after submit. |
| 2026-10-14 | **P6-3** Uploads / Submit close after the RFP's submission deadline, or once the RFP is archived / approval-pending / contracted. No deadline = open. |
| 2026-10-14 | **P6-4** Invite acceptance creates the vendor auth user already confirmed (the emailed link proves the inbox). An email belonging to an internal account is refused. |
| 2026-10-14 | **P6-5** Expired-invite page shows the inviting PM's email as the contact. |
| 2026-10-14 | **P6-6** On submit: PM in-app notification + new `vendor-submitted.tsx` email; entry → Submitted; first submission → RFP "Submissions In". |
| 2026-10-14 | **Defaults (P6)** Vendor status refresh by 30 s polling; vendor-facing labels: internal Approved → Shortlisted, removed → Not Selected; vendor data only via server routes with whitelisted fields (P2-4). |
| 2026-10-14 | **P7-1 (#2)** `@google/genai` 2.29.1 (replaces `@google/generative-ai`); `gemini-2.5-pro` for extraction / compliance / scoring / report, `gemini-2.5-flash` for criteria suggestion and as fallback; SDK JSON mode + response schema, then Zod. |
| 2026-10-15 | **P7-1 revised (#2)** Live test: 2.5 Pro/Flash return 404 (retired for new keys), 3.x Flash 503 / Pro previews no quota on the free tier. Option A: enable billing on the AI Studio project (pending — user to confirm); model chain `gemini-3.8-flash` → `gemini-3.1-flash-lite` (`MODEL_CHAIN` in `src/lib/gemini/client.ts`), 3 attempts per model with backoff on 429/5xx, 240 s total budget. Until billing is on, calls fall through to flash-lite. |
| 2026-10-15 | **P7-1 revised again (Option B)** The app is a portfolio / demo project (no real customers or vendor documents), so it stays on the Gemini free tier with no billing. `MODEL_CHAIN` = `gemini-3.1-flash-lite` → `gemini-3.8-flash` (3.8-flash only answers with billing, so it is the backup). Supersedes the billing part of Option A. Demo idea for Phase 12: a demo org with pre-generated AI results so demos don't depend on the day's quota. |
| 2026-10-14 | **P7-2 (#4)** `@vercel/functions` 3.10.1 `waitUntil()` runs the pipeline in-process; `/api/process/document/[id]` is the PM Retry route; processing routes `maxDuration` 300 s; client polls every 5 s. |
| 2026-10-14 | **P7-3 (#36)** SheetJS `xlsx` 0.20.3 from cdn.sheetjs.com (pinned tarball + lockfile integrity) instead of npm 0.18.5. |
| 2026-10-14 | **P7-4** Documents are processed (extraction → compliance) when the vendor submits, not on upload; internal users see a vendor's documents only after submission (RLS + storage policy change). Compliance route kept for re-runs. |
| 2026-10-14 | **P7-5 (#15)** New `vendor_notes` table: PM-only, insert + read (append-only), per vendor per RFP. |
| 2026-10-14 | **P7-6 (#15)** New `report_share_links` table + public read-only `/share/report/[token]` (7 days, hashed token, revocable, noindex). |
| 2026-10-14 | **P7-7 (#29)** Flagged clauses shown as highlighted excerpts in the Compliance tab — no document viewer. |
| 2026-10-14 | **P7-8** PDF export: `puppeteer-core` everywhere — `@sparticuz/chromium` on Vercel, the installed Microsoft Edge locally. |
| 2026-10-14 | **Defaults (P7)** Start Evaluation → submitted vendors Under Review + RFP Under Evaluation; scoring async + "Scoring complete" notification; weighted total = Σ(score × weight%) on 0–10; Generate Report notifies the requirement's DH (in-app + new `evaluation-ready.tsx` email); failures inline with Retry; scanned-PDF message per Tech Stack §6; scoring templates page built here (P4-8). |
| 2026-10-14 | **CLAUDE.md over Tech Stack §8.2** Kanban optimistic updates live in the TanStack Query cache, not Zustand ("never put API data in Zustand"). |
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
37. `handle_new_user` trusted client-controlled `raw_user_meta_data` for role/org → resolved by P2-1.
38. Schema vendor storage read policy matched the whole org folder (other vendors' proposals); `documents_vendor_own` exposed AI extraction → resolved by P2-4.
39. `profiles_self_update` allowed changing own `role` / `org_id` / `is_active`. **Applied in Phase 2 pending user confirmation:** column privileges restrict self-updates to `full_name` and `avatar_url`.
40. ~~JWT `app_metadata` carries `org_name` / `full_name`~~ → resolved by P3-7 (0028). **Still open (decide by Phase 9):** `activity_log` stays readable by all internal users in the org (Schema §5.9), including before/after state of scores — wider than P2-6's DH/FA scoping.
41. Security review (after the Phase 2 commit): approval policies let a PM set status = 'approved' (self-approval → contract) and let an FA rewrite rfp/vendor/evaluation or decide requests not sent to them. **Fixed in 0027**: per-role WITH CHECK transitions, column-level UPDATE grants, and the contract trigger requires an active FA decider.
42. Security review: a DH could set linked_rfp_id on their own requirement to gain read access to any RFP. **Fixed in 0027**: can_read_rfp uses only the PM-controlled rfps.requirement_id; DH policies require linked_rfp_id IS NULL.
43. Security review: RLS checked a row's own org_id, not its parents'; a known foreign UUID could attach rows to another tenant. **Fixed in 0027**: enforce_same_org() trigger on 14 tables checks every parent reference (applies to the service role too).
44. **Open for Phase 4:** App Flow has no screen for inviting team members after onboarding (Settings covers only the org profile and scoring templates). `POST /api/auth/invite-team` already supports it.
45. `PATCH /api/organisation` (multipart: name, currency, optional logo ≤ 2MB PNG/JPG/WebP) added in Phase 3 — not in Backend Schema §8; it routes org-profile changes through the API with an activity-log entry. Reused by `/settings/organisation` later.
46. Supabase's admin API inserts auth.users, then writes `raw_app_meta_data` in a separate UPDATE, so the documented AFTER INSERT trigger never created profiles for API-created users. Fixed in 0028 (trigger also on app_metadata update, idempotent).
47. Lint: `no-console` relaxed to allow `console.error` / `console.warn` (server error logging); `console.log` still warns.
48. Security review (Phase 3 commit): account pre-hijacking — signup set a password before the email was proven. **Fixed by S-1.**
49. Security review (Phase 3 commit): invite emails usable as a spam / phishing relay. **Fixed by S-2.**
50. Implementation Plan gap: `/account`, `/settings/organisation`, `/settings/scoring-templates` (App Flow §9) are built in no phase (Phase 4 only makes placeholders) → scheduled by P4-8.
51. Security review (S-2 commit): invite cap could be overshot by parallel requests → **fixed** with atomic reservation (0029).
52. Security review (S-2 commit): looking users up via admin generateLink invalidated outstanding emailed links → **fixed** with token-free `find_auth_user_by_email` (0029).
53. Security review (S-1 commit): an unauthenticated repeat signup could delete someone's pending signup, and confirmation emails echoed attacker-chosen names → **fixed** (resend only, per-signup caps, neutral email).
54. **Open for Phase 12:** no per-IP rate limiting (no Redis / queue infra by design). Use the Vercel firewall / rate-limit rules on `/api/auth/*` at deploy time.
55. Profile photos have no bucket in Backend Schema §9 → stored in the private `org-assets` bucket at `{org_id}/avatars/{user_id}.{ext}` (org-scoped, per CLAUDE.md).
56. Security review: signup-confirmation resend caps could be raced by parallel requests → **fixed** with an atomic DB reservation (0030), fail-closed.
57. Found in Phase 4 testing: submitting a form before hydration did a native GET, putting the email and **password in the URL** (history, logs, Referer). **Fixed:** every form uses `method="post"`, and submit buttons stay disabled until hydrated.
58. Found in Phase 4 testing: Sign Out cleared the session but left the user on the (stale) page — the auth listener's refresh cancelled the redirect. **Fixed** with a full page load to `/login`.
59. Security review (Phase 4 commit): `avatar_url` was client-writable and signed with the service role → cross-tenant storage read. **Fixed:** stored paths must match the exact own-org shape before signing; column UPDATE revoked (0031).

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

- [x] Migrations 0001–0026 per Backend Schema §10 (0021 functions ↔ 0022 RLS swapped, P2-8)
- [x] Extensions, 18 enums, 18 tables, indexes, `vendor_accounts.search_vector`
- [x] Helper functions (+ `my_vendor_account_ids`, `can_read_rfp`, `can_read_evaluation`, `can_read_document`) + `custom_access_token_hook` with grants (0026)
- [x] RLS enabled + policies on every table (41 policies); profiles self-update limited to `full_name`/`avatar_url` (#39)
- [x] Triggers: 15× `set_updated_at`, `on_auth_user_created`, `rfp_evaluation_created`, `approval_creates_contract`, `criteria_weight_check` = 19
- [x] Storage buckets (all private; vendor-documents 50MB limit) + internal read policy only (P2-4)
- [x] pg_cron notification purge
- [x] Auth hook registered in `config.toml`; public signup disabled
- [x] `supabase/seed.sql`: 1 org, PM/DH/FA, 2 vendors (auth users + vendor_accounts), 1 requirement ↔ 1 RFP, entries, accepted invites
- [x] `src/lib/supabase/server.ts` (async cookies) and `client.ts`, typed with `Database`
- [x] `src/types/database.ts` generated (done early — originally a Phase 3 task)
- [x] Doc bug fixed: §6.5 `RAISE` format string had no placeholder for its argument

Verify (2026-10-14):
- [x] Migrations apply with 0 errors (`supabase start` / `supabase db reset`)
- [x] 18 tables (all RLS), 18 enums, **19** triggers (checklist amended from ≥ 20 by P2-8), 41 policies, 3 buckets, 1 cron job — checked by SQL against the catalog
- [x] Seed data: 1 org, 3 internal users, 2 vendors, 1 RFP (+ auto evaluation), 1 requirement
- [x] Auth hook works; JWT carries `user_type`, `role`, `org_id` (vendors: no org_id); provider fields kept; deactivated user's claims stripped
- [x] Supabase client files compile; tsc / lint / build clean
- [x] Unauthenticated `SELECT * FROM profiles` returns nothing (RLS)
- [x] Extra checks — 28 passed, 0 failed: public signup refused; per-role read scopes (PM/DH/FA/vendor); vendor sees only own entry; DH can't change own role; vendor/DH can't insert RFPs; renewals RPC not callable; no vendor storage access; approval → contract trigger as FA; one pending approval per RFP; weights > 100% rejected
- [x] Commit (31be1ca)
- [x] Post-commit security review fixes in `0027_security_hardening.sql` (#41–#43): 17 new checks pass, the earlier 28 still pass. Trigger total is now 33 (19 + 14 same-org triggers)

## Phase 3 — Authentication

⛔ Gates: #21 (how the first PM reaches `/signup`), #7, team-invite "pending profile" before the auth user exists, reset-password route shape vs Supabase's code flow.

- [x] `/login` (+ forgot-password modal, P3-4), `/signup` (P3-1), `/reset-password` → `/login`, `/reset-password/[token]`, `/accept-invite/[token]` (P3-5), `/auth/confirm` (P3-2)
- [x] `src/middleware.ts` — protects `(dashboard)` and `/vendor`; signed-in users sent home from `/login` / `/signup`; vendor ↔ internal separation; per-role route rules (App Flow §1, incl. DH report-only); deactivated → sign out + message; expired session → `?reason=expired`; `redirectTo` limited to same-origin paths
- [x] `POST /api/auth/signup`, `POST /api/auth/invite-team`, `POST /api/auth/accept-invite`, `POST /api/auth/reset-password` (+ `/confirm`), `PATCH /api/auth/onboarding/complete`, `PATCH /api/organisation` (#45)
- [x] Onboarding wizard `/onboarding?step=1..3` with guard (PM-only; locked after completion; dashboard redirects there until done)
- [x] Zustand stores `useAppStore` (modal, search — the sidebar flag waits for #18 in Phase 4), `useNotificationStore`
- [x] Providers: `query-provider.tsx`, `auth-provider.tsx`; root layout also mounts the Sonner `<Toaster>`
- [x] `src/types/database.ts` (regenerated) + `src/types/index.ts`
- [x] Email: `src/lib/email/send.ts` (Resend; Mailpit when Supabase is local, P3-3) + templates `password-reset.tsx`, `team-invite.tsx`, `signup-confirmation.tsx`
- [x] `src/lib/activity.ts` `logActivity()` created early (CLAUDE.md requires it on every state change; originally a Phase 9 task)
- [x] Migration `0028_auth_flow_fixes.sql` (#46 profile trigger on app_metadata update; P3-7 token whitelist)
- [x] Config: password rules (P3-6), `site_url` = `http://localhost:3000`
- [x] shadcn button / input / card aligned to Content Guidelines §6.1 / §6.2 / §6.4; shared `FormField` + `SubmitButton`

Verify (2026-10-14 — headless Chromium against the **production build**, emails read from Mailpit):
- [x] Unauthenticated `/dashboard` → `/login` (with `redirectTo`); `/` → `/login`
- [x] PM signup creates org + profile (after the #46 fix); email must be confirmed first
- [x] JWT `app_metadata` has `user_type`, `role`, `org_id` — and nothing else of ours (P3-7)
- [x] Onboarding sets `onboarding_complete = true`; `/onboarding` locked afterwards; dashboard redirects to onboarding until done
- [x] Password reset email sends (Mailpit); new password works; reused link → expired state; unknown email still 200
- [x] Invited team member receives email, sets name + password, lands on `/dashboard`; link single-use
- [x] Auth routes return correct status codes (401 / 403 / 400 / 409 / 410, `{ error, code }` shape)
- [x] Extra: role redirects (DH, FA, vendor, internal ↔ vendor) with toasts; wrong password; deactivated account; expired session; open-redirect payloads blocked
- [x] 54/54 browser checks + 18 redirect-guard cases; Phase 2's 45 security checks re-run green; tsc / lint / build clean
- [x] Fixed during verification: toasts fired on first page load were lost (Sonner subscribes after child effects); prefilled inputs rendered empty until hydration; `safeRedirectPath` hardened against tab/newline/backslash bypasses (security review)
- [x] Commit (550247e)
- [x] Post-commit security fixes S-1 / S-2 (#48, #49): 66/66 browser checks against the production build

## Phase 4 — Navigation shell

⛔ Gates: #6 (`FileContract` icon), #17 (FA Activity item), #18 (sidebar collapse state), #19 (uppercase labels), #27 (badge dark mode), #15 (sparkline history data).

- [x] `(dashboard)/layout.tsx` grid shell (256px sidebar + sticky top bar) + PM onboarding guard
- [x] `sidebar.tsx` (role nav P4-1, org row P4-7, never collapses P4-2), `top-bar.tsx`, `breadcrumb.tsx`, `page-header.tsx`, `vendor-shell.tsx`, `avatar-menu.tsx` (theme switch P4-6), `notification-bell.tsx`, `global-search.tsx`
- [x] `vendor/(portal)/layout.tsx` — route group so `/vendor/invite/*` stays shell-less; company name from the most recent invite
- [x] Placeholder pages: dashboard (role-aware), pipeline, requirements, approvals, contracts, activity, search, scoring templates, vendor home
- [x] Notification bell: real rows (P4-9) — `GET /api/notifications`, `PATCH /api/notifications/read-all`, per-item read on click, 30 s polling, deep links
- [x] Avatar dropdown: name, email, My Account, Theme, Sign Out (full page load to `/login`)
- [x] Global search overlay UI (300 ms debounce, categories, "See all results" → `/search?q=`)
- [x] `/settings/organisation` (profile + Team: list, invite, resend — fixes #44) and `/account` (name, photo, change password) per P4-8
- [x] Status tokens (P4-4) + `StatusBadge`; generic `DataTable` (TanStack + shadcn, uppercase headers P4-3, empty spacer row)
- [x] `src/lib/roles.ts` (client-safe role labels / initials)

Verify (2026-10-14 — headless Chromium against the production build):
- [x] PM sees Dashboard, Pipeline, Requirements, Contracts, Activity + Settings; DH hides Pipeline/Contracts; FA = Dashboard, Approvals, Activity (P4-1)
- [x] Vendor portal has no sidebar; company name shown; avatar menu = Sign Out only
- [x] Breadcrumb only on nested pages (`Settings > Organisation`; none on `/dashboard`)
- [x] Avatar shows name/email; sign out → `/login` with the session cleared
- [x] Bell renders badge (even at 0); real counts; deep link + mark read; mark all read; scoped to recipient
- [x] No hex values / raw `dark:` colours in components (emails excepted)
- [x] Dark mode switches the whole shell (sidebar + page) and persists
- [x] Extra: settings team invite / resend, org save → sidebar updates, account name/photo/password, search overlay, badge colours exact, FA blocked from settings, no-JS submit leaks nothing (#57), signup resend race (#56)
- [x] Commit

## Phase 5 — PM core: pipeline & RFPs

⛔ Gates: #13 (re-inviting a vendor across RFPs), kanban drag semantics (RFP status is per-RFP but vendor stages are per-vendor), dev email delivery only to the Resend owner address (how to test invites).

- [x] Zod schemas `rfp.ts`, `vendor-invite.ts`
- [x] `/api/rfps` (GET with filters + pending requirements, POST incl. from requirement), `/api/rfps/[id]` (GET, PATCH with P5-1 rules, DELETE soft), `/api/rfps/[id]/invite-vendor`, `/api/rfps/[id]/vendors/[entryId]` (remove / shortlist — not in Schema §8, added for App Flow actions)
- [x] Emails `vendor-invite.tsx`, `vendor-status-update.tsx` (+ once-per-outcome sender, P5-6)
- [x] PM dashboard: 4 stat cards with activity sparklines (P5-4), pipeline snapshot, renewal alerts + recent activity on real data
- [x] Kanban: 9 columns, dnd-kit (pointer + keyboard: Space drag, Enter opens), drop rules (P5-1), requirement cards (P5-2), filters, inline search
- [x] Create / Edit RFP modal (RHF + Zod, department suggestions P5-3, native date input), toast on success
- [x] RFP detail split view (35/65): inline title edit, edit modal, invite modal, archive confirm, Start Evaluation gating; vendor list (DataTable) with shortlist / remove
- [x] Vendor detail page placeholder with 4 tabs; requirement detail page with PM "Create RFP"
- [x] TanStack Query hooks in `src/lib/queries/rfps.ts` (optimistic kanban moves in the query cache)
- [x] `logActivity()` on every state change (rfp created/edited/status/archived/deleted, vendor invited/removed/shortlisted, requirement linked). No App Flow §8.3 notification is triggered by Phase 5 events.
- [x] Fix #59 (security review): avatar/logo paths validated before signing; `avatar_url` no longer client-writable (0031)

Verify (2026-10-14 — headless Chromium against the production build):
- [x] New RFP appears in the right column (RFP Created); evaluation auto-created; activity logged
- [x] Drag updates status in DB; drops on Approval Pending / Contracted / Archived refused (P5-1); backwards drags allowed
- [x] Split view shows metadata + vendor list; inline title edit; edit modal; archive with confirmation
- [x] Invite creates `vendor_accounts` + `vendor_invites` (64-char token, 72 h); email sends (Mailpit); row shows "Invited"; first invite → Vendors Invited; duplicate → inline error; existing vendor reused
- [x] Breadcrumb Pipeline > [RFP]
- [x] Forms block invalid submission (required fields, budget max < min)
- [x] Query cache avoids refetch on back-navigation (1 request total)
- [x] Extra: dashboard stats + sparklines + snapshot + activity; filters / search; remove (P5-5); shortlist + once-only vendor email (P5-6); requirement → RFP (P5-2); DH / FA / vendor access limits; #59 lockdown — 64/64 + cache check; Phase 4 53/53, Phase 3 73/73, Phase 2 45/45 regression green
- [x] Commit

## Phase 6 — Vendor portal

⛔ Gates: #13 (existing-account vendors / multiple orgs), #25 (vendor read access to RFP + org), #4 (`waitUntil` / `@vercel/functions`).

Gate #4 (`waitUntil`) moves to Phase 7 — Phase 6 creates `queued` documents only; processing is fired in Phase 7.

- [x] `/vendor/invite/[token]` (create / sign-in / internal-refused modes) + `/vendor/invite/expired` (inviting PM's email, P6-5); shared `AuthFrame` layout
- [x] `/api/vendor/invite/[token]` (GET validate, POST accept — atomic single use, confirmed account, sign-in)
- [x] Vendor home: greeting, My RFPs table (across orgs)
- [x] `/vendor/rfp/[id]`: info panel, countdown ≤ 7 days, drag-and-drop + browse (PDF/DOCX/XLSX ≤ 50MB), per-file progress / Uploaded / Failed + Retry, Remove (P6-2), submit + confirm modal, post-submit state, status banners, 30 s status polling
- [x] `/api/submissions` (GET, POST), `/api/submissions/[id]/documents` (POST sign / confirm — P6-1), `/[docId]` (GET internal, DELETE vendor draft), `/api/submissions/[id]/submit` (P6-6: notification + `vendor-submitted.tsx` email, RFP → Submissions In); `/api/vendor/rfps/[id]` for polling (not in Schema §8)
- [x] Vendor isolation: `src/lib/vendor/portal.ts` whitelists every field the vendor receives; ownership checked on every route

Verify (2026-10-14 — headless Chromium against the production build):
- [x] Valid token loads page (org, RFP, message); used or > 72 h → `/vendor/invite/expired`; unknown token 410
- [x] Vendor creates account and is signed in; existing vendor signs in to accept; internal email refused
- [x] Vendor home shows only their RFPs
- [x] Upload limits enforced client-side (type, 50MB) and server-side (signature check rejects a spoofed PDF and deletes it)
- [x] File stored under `{org_id}/{rfp_id}/{vendor_id}/{uuid}-{name}`; document row `queued`
- [x] Submit disabled until a document uploads; locked after submit (upload / remove / resubmit → 409)
- [x] Vendor on `/dashboard` / `/pipeline` is redirected to `/vendor`; `/api/rfps` → 403; internal document API → 403
- [x] Extra: other vendors can't read / upload / delete / sign URLs for the files; deadline closes uploads (P6-3); banners; Approved shows as Shortlisted; PM notification + email; RFP → Submissions In — 56/56
- [x] Commit

## Phase 7 — AI processing

⛔ Gates: #2 (resolved: P7-1 revised, 2026-10-15), #4, #15 (vendor notes table, share links), #29, local `puppeteer` vs `puppeteer-core` (not in package.json), when compliance runs (on upload vs on evaluation).

- [x] `src/lib/gemini/client.ts` (model chain + retries, P7-1 revised), `prompts.ts` (extraction, criteria, scoring, compliance, report — vendor text fenced as untrusted data), Zod schemas `src/lib/schemas/ai.ts`
- [x] Pipeline `src/lib/processing/`: download → text (pdf-parse / mammoth / SheetJS) → scanned-doc error → Gemini → Zod → raw JSONB + 8 columns → compliance flags → `extracted` / `failed` (+ PM notification, activity)
- [x] Fired with `waitUntil()` from the submit route (P7-4, not on upload); `/api/process/document/[id]` = PM Retry (failed, or stuck > 6 min)
- [x] Vendor detail tabs: Documents (5 s polling, extracted-data expander, failed banner + Retry, signed-URL download), Scores (override inline, colour-coded total, per-vendor Retry), Compliance (counts, severity filter, clause excerpts, Acknowledge / Escalate), Notes (append-only)
- [x] `/api/process/suggest-criteria/[rfpId]`; full-screen criteria modal (AI suggestions with Sparkles, templates, add / remove, running total = 100)
- [x] `PUT /api/evaluations/[rfpId]/criteria`; `/api/process/score/[evaluationId]` (async, run++, per-vendor retry); `PATCH /api/scores/[scoreId]/override`; `GET /api/evaluations/[rfpId]`
- [x] `/api/process/compliance/[submissionId]` (re-run; keeps acknowledged / escalated); `/api/process/report/[evaluationId]` (+ DH notification + `evaluation-ready.tsx` email)
- [x] Comparison report page: summary, scorecard bar chart + table, risk table + donut, key terms, recommendation, Export PDF, Copy Share Link; public `/share/report/[token]`
- [x] `/api/reports/[rfpId]` (GET), `/export` (puppeteer-core PDF), `/share` (POST create / DELETE revoke)
- [x] Scoring templates page + `/api/scoring-templates` CRUD (P4-8)
- [x] Sparkles prefix on every AI output
- Routes added beyond Backend Schema §8 (for App Flow §4 actions / P7-5 / P7-6 / P4-8): `/api/rfps/[id]/vendors/[entryId]/documents`, `…/notes`, `/api/compliance-flags/[id]`, `/api/submissions/[id]/documents/[docId]/download`, `/api/reports/[rfpId]/share`, `/api/scoring-templates` (+ `[id]`)
- Chart colour tokens `--chart-good / --chart-mid / --chart-risk-high / --chart-risk-low` added to `globals.css` (Content Guidelines §9 colours, read via getComputedStyle)
- Deferred: "Submit for Approval" on the report (Phase 8); escalated flag ↔ approval link (Phase 8, #15); per-vendor activity under the tabs (Phase 9 activity feed)

Verify:
- [x] Upload → queued → processing → extracted (processing starts on submit, P7-4; drafts invisible to internal users)
- [x] Extracted fields shown (AI Extracted expander); image-only PDF fails with the exact Tech Stack §6 message; Retry re-runs
- [x] Suggested criteria load (5–10, Sparkles, total 100); ≠ 100% blocks confirm (UI + API 400)
- [x] Scores + reasoning shown; override stores both (AI 3.50 / override 9.50 + justification + who/when)
- [x] Re-score increments `scoring_run_count` (run 1 rows kept)
- [x] Compliance flags with correct severities (upfront payment, auto-renewal, liability, escalation, unilateral change, breach notice → high); Acknowledge / Escalate
- [x] Report renders all sections + charts; PDF downloads (2 pages, ~100 KB); share link works, expires, revokes; DH read-only
- [x] All AI content has Sparkles
- [x] Extra: prompt-injection line in a vendor PDF ignored; vendor REST / API isolation on every new table and route; DH notification + email; extraction-failed + scoring-complete notifications — 103/103 against live Gemini (flash-lite fallback). Regression: P6 56/56 (two expectations updated for P7-4), P5 64/64, P4 53/53, P3 73/73
- [x] Commit

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
