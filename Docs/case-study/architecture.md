# Architecture and Technology Flow

This document shows how ProcureMaster is built: the overall architecture, how a request flows through it, how the AI pipeline processes vendor documents, the procurement workflow, and how data is kept secure. The diagrams are written in Mermaid, which GitHub renders automatically.

## 1. System architecture

```mermaid
flowchart TB
    subgraph Users["Users (web browser)"]
        PM["Procurement Manager"]
        DH["Department Head"]
        FA["Finance Approver"]
        V["Vendor (external)"]
    end

    subgraph Vercel["Vercel"]
        MW["Middleware<br/>session check and role routing"]
        UI["Next.js App Router<br/>React Server Components and client UI<br/>internal app and vendor portal"]
        API["Route Handlers (/api)<br/>authenticate, check role, validate with Zod,<br/>act, log activity, notify"]
        BG["Background work<br/>waitUntil(): document processing and scoring"]
        CRON["Vercel Cron<br/>renewal alerts, approval SLA reminders,<br/>nightly demo reset (demonstration mode only)"]
        PDF["PDF export<br/>Puppeteer and Chromium"]
    end

    subgraph Supabase["Supabase"]
        AUTH["Auth<br/>JWT with role and org claims<br/>(custom access token hook)"]
        DB[("Postgres<br/>row-level security on every table<br/>functions, triggers, full-text search")]
        ST[("Storage<br/>private buckets, signed URLs<br/>paths start with org id")]
    end

    GEM["Google Gemini<br/>extraction, compliance, criteria,<br/>scoring, report"]
    MAIL["Resend<br/>React Email templates"]

    Users -->|HTTPS| MW --> UI
    UI -->|fetch, TanStack Query| API
    UI -->|user session, RLS-scoped reads| DB
    API --> AUTH
    API -->|user client: RLS applies| DB
    API -->|service role: server only| DB
    API --> ST
    API --> BG
    BG -->|document text to JSON| GEM
    BG --> DB
    CRON -->|Bearer CRON_SECRET| API
    API --> MAIL
    API --> PDF
```

| Layer | Responsibility | Technology |
| --- | --- | --- |
| Presentation | Internal app for three roles, vendor portal, sign-in screens | Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui, Recharts, dnd-kit |
| Client state | Server data cached and refreshed; small UI state only | TanStack Query, Zustand |
| API | Every change goes through a Route Handler: authenticate → check role → validate → act → activity log → notifications | Next.js Route Handlers, Zod, `{ error, code }` error shape |
| Background processing | Long AI work runs after the response is sent; the UI polls for status | `@vercel/functions` `waitUntil()`, 5-second polling |
| AI | JSON-only prompts, answers validated before storage, retries and model fallback | Google Gemini via `@google/genai` |
| Data | Multi-tenant Postgres with row-level security, triggers and functions | Supabase Postgres, 35 versioned migrations |
| Identity | Accounts created server-side; role and organisation carried in the JWT | Supabase Auth, custom access token hook |
| Files | Proposals, contracts and attachments in private buckets | Supabase Storage, signed URLs |
| Scheduled jobs | Daily renewal alerts and approval reminders | Vercel Cron and protected API routes |
| Email | Invitations, approvals, decisions, reminders, renewals | Resend, React Email |
| Quality | End-to-end tests of every critical flow, including vendor isolation | Playwright, page-object model |

## 2. Request flow: one state change

Every write in ProcureMaster follows the same path. Here the Finance Approver approves a vendor selection.

```mermaid
sequenceDiagram
    autonumber
    actor FA as Finance Approver
    participant UI as Next.js UI
    participant API as /api/approvals/[id]/decide
    participant DB as Postgres (RLS)
    participant LOG as activity_log
    participant N as Notifications and email

    FA->>UI: Approve, with a comment
    UI->>API: POST decision
    API->>API: Verify session, require the Finance Approver role,<br/>validate the body with Zod
    API->>DB: Mark the approval approved
    API->>DB: Create the contract, mark the vendor contracted,<br/>other vendors not selected, RFP contracted
    API->>LOG: Before/after record (append-only)
    API->>N: In-app notification and email to the Procurement Manager
    API-->>UI: 200 OK
    UI->>UI: Refresh cached data (TanStack Query)
```

## 3. AI document pipeline

When a vendor submits a proposal, each document is processed in the background. The vendor sees "Submitted"; the Procurement Manager's screen updates as each document finishes.

```mermaid
sequenceDiagram
    autonumber
    actor V as Vendor
    participant API as Submission API
    participant ST as Storage (private)
    participant BG as Background job (waitUntil)
    participant X as Text extraction<br/>pdf-parse, mammoth, SheetJS
    participant G as Google Gemini
    participant Z as Zod validation
    participant DB as Postgres
    actor PM as Procurement Manager

    V->>API: Upload PDF / DOCX / XLSX
    API->>ST: Store under {org_id}/{rfp}/{vendor}/
    API->>DB: Document row: queued
    V->>API: Submit proposal
    API->>BG: Start processing (response returns immediately)
    BG->>DB: Claim the document: processing
    BG->>ST: Read the file
    BG->>X: Extract text on the server
    alt No text found (scanned image)
        BG->>DB: failed, "scanned document" message
    else Text extracted
        BG->>G: Key-term extraction prompt (JSON only)
        G-->>BG: JSON
        BG->>Z: Validate against the schema
        BG->>G: Compliance-risk prompt (JSON only)
        G-->>BG: JSON flags with clause text and severity
        BG->>Z: Validate
        BG->>DB: Save terms and flags: extracted
    end
    loop Every 5 seconds until extracted or failed
        PM->>DB: Poll status
    end
    Note over BG,DB: Errors become an inline message with Retry, never a silent failure
```

**AI safeguards**
- Document text is extracted on the server; files are never sent to the AI as attachments.
- Vendor text is fenced inside randomised delimiters, and the prompt tells the model to treat it as data, so instructions hidden in a proposal can't redirect the AI.
- The model must answer in JSON. Each answer is validated with Zod before anything is written, and invalid answers are rejected and can be retried.
- Calls go through a model chain with retries on rate limits and server errors.
- AI output is advisory: no workflow state ever moves forward because of an AI answer alone.

The same pattern is used for **criteria suggestion**, **scoring** (each vendor against each confirmed criterion, with a justification; the Procurement Manager can override any score) and the **comparison report** (executive summary and advisory recommendation).

## 4. Procurement workflow

```mermaid
stateDiagram-v2
    direction TB
    [*] --> RequirementsReceived: Department Head submits a requirement
    RequirementsReceived --> RFPCreated: Procurement Manager creates the RFP
    RFPCreated --> VendorsInvited: Vendors invited (single-use 72 h links)
    VendorsInvited --> SubmissionsIn: First proposal submitted, AI extraction runs
    SubmissionsIn --> UnderEvaluation: Criteria confirmed, AI scoring runs
    UnderEvaluation --> Shortlisted: Vendors shortlisted, report generated
    Shortlisted --> ApprovalPending: Submitted to the Finance Approver
    ApprovalPending --> Shortlisted: Rejected (reason required) or recalled
    ApprovalPending --> Contracted: Approved, contract created
    Contracted --> [*]: Renewal alerts until the end date
```

The early stages can also be moved by dragging cards on the pipeline board. Approval Pending and Contracted can only be reached through the approval workflow. Any RFP before Approval Pending can be archived; archiving is final.

## 5. Security and multi-tenancy

```mermaid
flowchart TB
    REQ["Request with session cookie"] --> JWT["JWT claims from the custom access token hook<br/>user_type, role, org_id"]
    JWT --> RLS{"Row-level security<br/>get_org_id(), get_user_role(), is_pm(),<br/>is_internal(), is_vendor()"}
    RLS -->|internal user| ORG["Only rows of the user's organisation,<br/>filtered further by role"]
    RLS -->|vendor| VEN["Only the vendor's own invitations,<br/>submissions and documents"]
    VEN -.->|never| HIDDEN["Scores, compliance flags, reports,<br/>internal notes, other vendors"]
```

- **Tenancy:** every table carries `org_id` and has row-level security policies. Same-organisation triggers stop cross-tenant references.
- **Accounts:** created only on the server, through the admin API, with role and organisation in `app_metadata`. Public self sign-up is off. Users can change only their own name and avatar.
- **Vendor isolation:** vendors reach RFP and document data only through dedicated server routes that return the vendor's own data. This is covered by end-to-end tests.
- **Secrets:** the service-role, Gemini, Resend and cron keys exist only on the server.
- **Files:** private buckets; downloads use short-lived signed URLs.
- **Audit:** `activity_log` is append-only and records before/after values for every change.
- **Data lifecycle:** primary records are soft-deleted (`is_deleted`), never removed.

## 6. Deployment

```mermaid
flowchart LR
    DEV["Developer (Windows)<br/>Next.js dev server<br/>local Supabase in Docker"] -->|git push| GH["GitHub repository"]
    GH -->|build and deploy| VC["Vercel<br/>Next.js functions and Cron"]
    DEV -->|supabase db push| SB["Supabase project<br/>Postgres, Auth, Storage"]
    VC <--> SB
    VC --> GEMINI["Google Gemini API"]
    VC --> RESEND["Resend"]
```

| Environment | Database | AI | Email |
| --- | --- | --- | --- |
| Local development | Supabase in Docker (`supabase start`, `supabase db reset`) | Gemini API | Caught by Mailpit |
| End-to-end tests | Local Supabase, reset before each run | Test stand-in (real Gemini with `LIVE_AI=1`) | Mailpit, checked by the tests |
| Production | Hosted Supabase, migrations applied with `supabase db push` | Gemini API | Resend |

**Demonstration mode (optional).** A deployment can set `DEMO_MODE=1` to add a fictional sample company, one-click demo logins, protection for the shared accounts and a nightly reset. This lets visitors experience the platform as each role. It sits on top of the architecture above and changes nothing when switched off. See the main [README](../../README.md#demonstration-mode-optional).

---

*See [Customer Use Case](customer-use-case.md) for the business story behind the platform.*
