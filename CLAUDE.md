# CLAUDE.md — ProcureMaster

## What this project is

ProcureMaster is a B2B SaaS platform for procurement teams at SMBs (10–200 employees). It helps teams manage vendors, run RFQ workflows (the docs use RFQ and RFP interchangeably; code uses `rfp`), route vendor selections for approval, and track contracts through renewal. AI (Google Gemini) extracts key terms from vendor documents, suggests and applies scoring criteria, flags compliance risks, and writes comparison reports.

There are four user types: **Procurement Manager** (PM — exactly one per org, also the org admin), **Department Head** (DH), **Finance Approver** (FA), and **Vendor** (external, invite-only, fully isolated).

The north-star metric is **cycle time from RFQ creation to contract signed**. When two valid implementations exist, prefer the one that shortens or de-risks that flow.

---

## Rule 0 — The reference docs are the spec

All reference documents live in `Docs/` at the repo root. **Read the relevant docs before starting any task.** Not skim — read the sections that cover the task, then plan.

| File | Owns (authoritative for) |
| --- | --- |
| `Docs/AI_Procurement_PRD.docx` | Product scope, personas, feature requirements, non-goals, NFRs |
| `Docs/AppFlow_AI_Procurement.docx` | Routes, screens, navigation, per-role access, empty/error states, notification matrix |
| `Docs/BackendSchema_ProcureMaster.docx` | Tables, enums, RLS policies, JWT claims, functions/triggers, API endpoints, storage buckets, migration order |
| `Docs/TechStack_AI_Procurement.docx` | Every dependency and exact version, client patterns, env vars, directory structure, cron, PDF export |
| `Docs/ContentGuidelines_ProcureMaster.docx` | Design system: tokens, typography, spacing, components, icons, charts, AI content marking, `tailwind.config.ts`, `globals.css` |
| `Docs/ImplementationPlan_ProcureMaster.docx` | Build phases, per-phase tasks and verification checklists, Windows notes, decision protocol |

**How to read them:** these are `.docx` files, which the Read tool can't open directly. Use Markdown copies in `Docs/md/` if they exist. Otherwise convert one: `pandoc "Docs/<file>.docx" -t gfm -o "Docs/md/<file>.md"`. If pandoc isn't installed, stop and tell the user. Never edit the source `.docx` files.

**At the start of every task**, state which doc sections you are working from. If no doc covers the task, say so — that is a decision point (below).

---

## Decision protocol — flag before proceeding

You must not make architectural decisions that contradict the docs. Stop and ask **before writing code** when:

- a task would require deviating from any doc;
- the docs are silent on something you need to decide;
- two docs contradict each other (see "Known conflicts" below — many already exist);
- you would need a library, table, column, enum value, endpoint, route, or RLS policy not in the docs.

Use this exact format:

```
DECISION REQUIRED
Task: [what you are implementing]
Docs say: [quote/section, or "not specified"]
Problem: [the gap, conflict, or reason to deviate]
Option A: [description + implication]
Option B: [description + implication]
Recommendation: [A or B, and why — one or two sentences]
Waiting for your answer before proceeding.
```

**Do not:** pick an option and proceed; invent features; install unlisted packages; modify the schema beyond the Backend Schema doc; skip a phase task without flagging it; "improve" a specified component.

**Which doc to check first:** for data/API/RLS questions start with Backend Schema; for packages and versions, Tech Stack; for anything visual, Content Guidelines; for screen behaviour, App Flow; for product intent, PRD. This tells you where to look — it does **not** let you silently resolve a conflict. Conflicts still get flagged.

---

## Stack at a glance

Exact versions live in Tech Stack §16 (`package.json`), **as amended by the decisions in `TODO.md`** — the repo's `package.json` is the source of truth once it exists. Versions are pinned — no `^` or `~`; `.npmrc` has `save-exact=true`; use `npm ci`.

- **Framework:** Next.js 15.5 App Router, React 19.2 (upgraded from the docs' 14.2/18.3 for security — decision D1), TypeScript 5.8 strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`). Path alias `@/*` → `./src/*`.
- **Data:** Supabase (Postgres + Auth + Storage), `@supabase/ssr` with separate server and browser clients.
- **AI:** Google Gemini via `@google/generative-ai`, **server-side only**.
- **Docs parsing:** `pdf-parse`, `mammoth`, `xlsx`. No OCR in v1.
- **UI:** Tailwind 3.4 + shadcn/ui (owned source in `src/components/ui/`), Lucide icons, Sonner toasts, TanStack Table, dnd-kit (kanban), Recharts (charts).
- **State:** TanStack Query = server state. Zustand = UI state only (`useAppStore`, `useNotificationStore`). Never put API data in Zustand.
- **Forms:** React Hook Form + Zod. Schemas in `src/lib/schemas/`, exporting schema + inferred type together.
- **Dates:** `date-fns` only.
- **Email:** Resend + React Email, templates in `src/emails/`.
- **PDF export:** `puppeteer-core` + `@sparticuz/chromium` on Vercel; full `puppeteer` for local Windows dev.
- **Background work:** Vercel Cron + API routes only. No Redis, no queues.
- **Tests:** Playwright E2E only — no unit tests. Page-object model in `tests/pages/`.
- **Hosting:** Vercel. **Dev OS:** Windows, PowerShell.

---

## Non-negotiables

### Security and data
- **RLS on every table.** Never disable RLS to fix an access problem — write the correct policy. Tenancy boundary is `org_id`, read from JWT `app_metadata` via the helpers `get_org_id()`, `get_user_role()`, `get_user_type()`, `is_pm()`, `is_internal()`, `is_vendor()`.
- The `custom_access_token_hook` injects `user_type`, `role`, `org_id` into the JWT. RLS depends on it.
- **Vendor isolation is absolute.** Vendors never see scores, compliance flags, comparison reports, internal notes, or other vendors — not in UI, API responses, storage, or error messages. Check this on every vendor-facing change.
- `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET` are server-only. Never import them in client components or expose via `NEXT_PUBLIC_`.
- Schema changes only through migration files in `supabase/migrations/` (`supabase migration new <name>`). Never through the dashboard.
- **Soft delete** (`is_deleted`) on primary entities — never hard-delete rows.
- `activity_log` is append-only, written via service role from API routes using `logActivity()` in `src/lib/activity.ts`, with before/after JSONB.
- Cron routes must validate the `CRON_SECRET` header.
- Global search uses the `tsvector` columns — never `ILIKE`.
- Storage buckets are private; file access via signed URLs only. Path pattern starts with `{org_id}/`.
- Invite tokens: 64-char cryptographically random, expire after 72h, single-use (expiry enforced in app logic).

### API routes
- All Route Handlers under `src/app/api/`. Authenticate, check role, then act.
- Error response shape: `{ error: string, code: string }`.
- Every state change writes an activity log entry and creates the notifications listed in App Flow §8.3.

### AI pipeline
- All Gemini calls from server-side Route Handlers. Ask for JSON-only output, parse with `JSON.parse`, validate with Zod before writing to the DB.
- Extract text server-side first; do not use Gemini's file upload API.
- Wrap calls in try/catch; failures become inline document/score errors with **Retry** — never silent.
- Empty text extraction = scanned document → fail with the exact message in Tech Stack §6.
- Processing is async: upload sets `queued`, fires `/api/process/document/[id]` non-blocking, client polls every 5s until `extracted` or `failed`.
- Prompts live in `src/lib/gemini/prompts.ts`; client in `src/lib/gemini/client.ts`.
- The AI recommendation is **advisory** — never auto-advance workflow state from AI output.

### UI
- No hex values in components. Use semantic tokens (`bg-background`, `text-foreground`, `border-border`…). No `dark:` with raw colours.
- Every piece of AI-generated text gets the Lucide `Sparkles` prefix (`text-violet-500`), before the text. Human-entered data never does.
- Empty states are empty tables with headers — no illustrations or prompts.
- Form errors are inline, not toasts.
- Cal Sans for headings only; Inter for everything else. 4px radius. Outlined Lucide icons, named imports only.
- Every focusable element keeps its focus ring. Icon-only buttons get `aria-label`. Respect `prefers-reduced-motion`.
- Follow component specs in Content Guidelines §6 exactly.

---

## Directory structure (Tech Stack §15 — do not deviate)

```
src/app/(auth)/            login, signup, reset-password, onboarding
src/app/(dashboard)/       internal routes (PM, DH, FA)
src/app/vendor/            vendor portal (own shell, no sidebar)
src/app/api/               route handlers — cron/, process/, reports/, …
src/components/ui/         shadcn/ui source
src/components/layout/     sidebar, top bar, breadcrumb, page header, vendor shell
src/components/[feature]/  feature components
src/lib/supabase/          server.ts, client.ts
src/lib/schemas/           Zod schemas + types
src/lib/gemini/            Gemini client + prompts
src/lib/queries/           TanStack Query hooks
src/lib/utils.ts           cn() and shared helpers
src/emails/                React Email templates
src/stores/                Zustand stores
src/types/                 database.ts (generated) + app types
supabase/migrations/       numbered SQL migrations (Backend Schema §10)
supabase/seed.sql          local seed data
tests/                     Playwright specs; tests/pages/ page objects
```

---

## Commands (Windows — PowerShell, not cmd.exe)

```powershell
npm ci                        # install exact lockfile versions
npm run dev                   # http://localhost:3000
npm run build                 # must pass with 0 TypeScript errors
npm run lint
npx playwright test           # E2E against local Supabase + seed data

supabase start                # Docker Desktop (WSL 2) must be running
supabase stop                 # always run before shutting down
supabase migration new <name>
supabase db reset             # rebuild local DB: all migrations + supabase/seed.sql
# Types: use the installed CLI (not npx), and avoid PowerShell 5.1 redirects (they add a BOM):
#   bash: supabase gen types typescript --local > src/types/database.ts && npx prettier --write src/types/database.ts
#   (in Git Bash, put Docker Desktop's resources/bin on PATH first, or the CLI falls back to Podman)
```

Windows notes: use forward slashes in imports; `.gitattributes` has `* text=auto eol=lf`; never use `export VAR=…` — env vars come from `.env.local` (never committed; `.env.example` is).

Git: single `main` branch. Commit at the end of each verified phase.

---

## How we build

Work follows the phases in the Implementation Plan (0–12). Each phase is its own session.

1. Confirm which phase we're in. Read that phase's tasks, checklist, and every doc section its handoff prompt references.
2. Assume earlier phases are verified. If you find they aren't, say so before building on top.
3. Happy path first; the dedicated error-handling pass is Phase 10.
4. Finish by running the phase verification checklist and reporting each item as pass/fail. Don't call a phase done with failing items.

---

## Out of scope for v1 (PRD §3.2, §11)

Purchase orders · ERP integrations · Slack/Teams notifications · OCR · parallel, conditional, or configurable approval routing (v1 is strictly PM → single FA) · vendor self-registration · custom compliance rulesets · mobile apps / responsive sidebar · seat-limit enforcement. If a request touches any of these, flag it.

---

## Known conflicts and gaps in the docs

These were found while reading the docs. **Each one is a decision point** — when a task touches it, use the decision protocol. Do not resolve them silently. When the user answers, update this section.

**Resolved (2026-10-14)** — full log in `TODO.md` → "Decisions made"; further conflicts #24+ are tracked there too:
- **#3** → add `tailwindcss-animate` 1.0.7 and `recharts` 2.15.4 (pinned); JetBrains Mono via `next/font/google`.
- **#5** → Next 15.5.27 with `eslint` 9.26.0 + `eslint-config-next` 15.5.27, flat config via FlatCompat (`@eslint/eslintrc`).
- **#7** → `AUTH_SECRET`/`NEXTAUTH_SECRET` omitted from env files.
- **#8–#12, #16** → see P2-7 … P2-9 in `TODO.md`: functions migration before RLS; requirements→rfps FK added in 0007; seed only in `supabase/seed.sql`; `set_updated_at` on the 15 tables with `updated_at`; NOT NULL FKs use NO ACTION; local workflow is `supabase db reset`.
- **#13** → one `vendor_accounts` row per (org, email); vendor JWT has no `org_id`; vendor RLS keys on `auth.uid()` (P2-3).
- **#14** → follow the Schema's JWT helper functions.
- **#21** → public `/signup` creates only a new org + its PM, with email verification; internal users join via team invites at `/accept-invite/[token]` (P3-1, P3-2, P3-5).
- **Auth emails** → our links + React Email via Resend; when Supabase is local they go to Mailpit (http://127.0.0.1:54324) instead (P3-3). Server-side account creation must go through the admin API with role/org in `app_metadata` (see #46 in `TODO.md`).
- **Phase 2 security fixes** (P2-1, P2-2, P2-4, #39): admin-API-only account creation from `raw_app_meta_data`, public signup off; auth hook grants for `supabase_auth_admin`; vendors reach RFP/org/documents/storage only through service-role API routes; profile self-update limited to `full_name`/`avatar_url`.
- **#20** → `popover` / `popover-foreground` mapped in `tailwind.config.ts`.
- **New: Next.js version** → Next 15.5.27 + React 19.2.8, because every Next 14.2.x release has open critical/high advisories.

**AI and dependencies**
1. PRD §6 says Anthropic Claude API; Tech Stack, Schema, and Plan say Gemini. Treat Gemini as current, but confirm.
2. `gemini-1.5-pro-latest` / `gemini-1.5-flash-latest` were retired by Google in 2025 (requests return 404), and `@google/generative-ai` has been superseded by `@google/genai`. Model and SDK choice must be confirmed before Phase 7.
3. Recharts, `tailwindcss-animate`, and JetBrains Mono are required by Content Guidelines but missing from Tech Stack `package.json`.
4. `waitUntil()` needs `@vercel/functions`, which isn't listed. Tech Stack also mentions an "Edge Function" for Puppeteer, which can't run on the Edge runtime.
5. `eslint-config-next` 15.3.1 is paired with Next 14.2.29. Supabase CLI: Tech Stack says 2.x, Plan checks for 1.x.
6. Lucide has no `FileContract` icon (Content Guidelines §10.3).
7. `NEXTAUTH_SECRET`/`AUTH_SECRET` is listed but nothing in the stack uses it.

**Database**
8. Migration order: RLS policies (0021) call helper functions created in 0022 — policies will fail. Functions must come first.
9. `requirements` (0006) and `rfps` (0007) reference each other — needs a deferred `ALTER TABLE … ADD CONSTRAINT`.
10. `0027_seed.sql` as a migration would run in production. Seed belongs in `supabase/seed.sql` only.
11. `set_updated_at` is to be applied to "all 18 tables", but `activity_log`, `notifications`, and `vendor_invites` have no `updated_at`.
12. Several FKs are `NOT NULL … ON DELETE SET NULL` (e.g. `contracts.approval_request_id`, `contracts.rfp_id`, `vendor_invites.invited_by`, `rfps.created_by`) — contradictory.
13. Vendor model: "fresh vendor record per invite" vs unique index on `(org_id, lower(email))` — the same vendor can't be invited to a second RFP in the same org. The auth hook also picks one `vendor_accounts` row per auth user, which breaks vendors invited by multiple orgs.
14. Tech Stack §4.2 RLS example queries a `users` table; the Schema uses JWT helper functions and `profiles`. Follow the Schema.
15. No tables or columns exist for: report share links (7-day), DH recommendation comments, vendor internal notes, requirement attachments, per-user email notification preferences, escalated-flag ↔ approval linkage, or sparkline history.
16. `supabase db push` targets the linked remote project by default, and `supabase db seed` is not a standard CLI command. Confirm the local workflow (e.g. `supabase db reset`) before Phase 2.

**Behaviour and UI**
17. Plan Phase 4 says the FA sidebar shows only Dashboard + Approvals; App Flow §2.1 also gives FA Activity.
18. Plan uses a Zustand "sidebar collapsed" state; Content Guidelines says the sidebar never collapses on desktop.
19. Content Guidelines bans all-caps, but specifies `uppercase` for table headers, kanban column titles, and sidebar section labels.
20. `popover` colour token is defined in `globals.css` but not mapped in `tailwind.config.ts`.
21. App Flow lists `/signup` but says signup is invite-only; Schema has `POST /api/auth/signup` creating org + PM. How the first PM reaches signup is unspecified.
22. Contract APIs allow FA (`GET /api/contracts`), but App Flow gives FA no Contracts page.
23. Plan section references are off in places: Tailwind config and `globals.css` are in **Content Guidelines** §14–15 (not Tech Stack); the env var list is in **Tech Stack** §14 (not Backend Schema); the shadcn component list is in **Tech Stack** §3.1. The Plan also says "five planning documents" — there are six.
