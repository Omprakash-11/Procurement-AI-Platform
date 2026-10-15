# Demo Walkthrough: The Full Workflow, Role by Role

This guide takes you through ProcureMaster in the order a real purchase happens: a department asks for something, procurement runs the RFP, vendors respond, AI helps evaluate, Finance approves, and the contract is tracked. You'll switch between the four user roles, so you see the platform from each person's side.

It uses the platform's optional demonstration mode, which adds a fictional sample company, **Northbridge Industries**. For the business story behind it, see the [Customer Use Case](customer-use-case.md). For how it's built, see [Architecture and Technology Flow](architecture.md).

## Before you start

**Accounts.** On the sign-in page, click a role under **Demo accounts**, then select **Sign In**. The password for every account is `Northbridge2026`.

| Role | Email | In this story |
| --- | --- | --- |
| Department Head | department.head@northbridge.example | Alex Rivera, Engineering: asks for what the team needs |
| Procurement Manager | procurement.manager@northbridge.example | Morgan Hayes: runs the purchase from RFP to contract |
| Finance Approver | finance.approver@northbridge.example | Jordan Lee: approves the spend |
| Vendor | bids@summitdata.example | Summit Data Systems |
| Vendor | proposals@harborline.example | Harborline Cloud Services |
| Vendor | sales@clearpath.example | ClearPath Security |

**Tips**
- Use a separate private or incognito window for each role. That way you can stay signed in as several people at once and watch changes appear on the other side.
- You'll need sample proposals for the vendor steps. Download the [Summit](../../public/samples/Summit-Data-Systems-Backup-DR-Proposal.pdf) and [Harborline](../../public/samples/Harborline-Backup-DR-Proposal.pdf) samples here, or from the links on the vendor upload screen. Please upload sample documents only, never confidential files.
- The demonstration is shared and resets every night. Someone may have moved things along before you; everything returns to its starting state the next day.
- Emails are not sent in demonstration mode. Watch the bell icon (top right) for notifications instead.
- Text marked with a violet ✨ icon was written by AI. Everything else was entered by people.

## Choose your path

| Path | Time | What you do |
| --- | --- | --- |
| **A. Quick tour** | 10 minutes | Look around a finished AI evaluation, then run the live AI on an RFP that is already waiting for proposals |
| **B. Full workflow** | 20–25 minutes | Start from a brand-new requirement and take it all the way to a signed contract, as every role |

---

## Path A: Quick tour

**1. See a finished evaluation (Procurement Manager).**
- Sign in as the **Procurement Manager**. The dashboard shows active RFPs, the approval waiting with Finance and a contract coming up for renewal.
- Open **Pipeline**. Every purchase is a card in a stage, from Requirements Received to Contracted.
- Open **Managed Cloud Storage Platform** → **View Report**. You'll see the AI executive summary and recommendation, the vendor scorecard and chart, the key-terms comparison and the compliance risk summary.
- Go back to the RFP and open **View Details** on Harborline Cloud Services → **Compliance** tab. Each risky clause is flagged with its severity and the source text. One is already escalated to Finance.

**2. Run the live AI (Vendors, then Procurement Manager).**
- Sign in as **Summit Data Systems**. Under **My RFPs**, open **Data Backup and Disaster Recovery**. Upload the Summit sample and select **Submit Proposal**.
- Do the same as **Harborline Cloud Services** with the Harborline sample.
- As the **Procurement Manager**, open **Data Backup and Disaster Recovery**. Within about a minute, each proposal shows its extracted key terms and compliance flags.
- Continue from step 6 of Path B to evaluate, approve and contract.

---

## Path B: The full workflow, start to finish

### Step 1: A department raises a need (Department Head)
1. Sign in as the **Department Head**. The dashboard shows Alex's open requirements and any evaluations ready for review.
2. Go to **Requirements** → **New Requirement**. For example: *"Data warehouse for sales reporting"*, department **Engineering**, a budget estimate, a required-by date and a short description. You can attach a file.
3. Select **Submit Requirement**. The Procurement Manager is notified.

### Step 2: Procurement turns it into an RFP (Procurement Manager)
1. Sign in as the **Procurement Manager**. The bell shows the new requirement, and **Pipeline** shows it in **Requirements Received**.
2. Open the requirement and select **Create RFP**. The form is pre-filled from the requirement. Optionally set a submission deadline, then select **Create RFP**.

### Step 3: Invite vendors (Procurement Manager)
1. On the new RFP, select **Invite Vendor**.
2. Enter a demo vendor's email and company name, for example `bids@summitdata.example` / *Summit Data Systems*, and select **Send Invite**.
3. Repeat for `proposals@harborline.example` / *Harborline Cloud Services*.

The card moves to **Vendors Invited**. In normal use each vendor gets an invitation email with a single-use link. The demo vendors already have accounts, so the RFP appears straight away in their portal.

### Step 4: Vendors submit proposals (Vendors)
1. Sign in as **Summit Data Systems**. Under **My RFPs**, open the new RFP.
2. Upload the Summit sample PDF; PDF, Word and Excel files are accepted. Select **Submit Proposal** and confirm.
3. Sign in as **Harborline Cloud Services** and do the same with the Harborline sample.

Notice what a vendor **doesn't** see: no scores, no compliance flags, no reports, and nothing about the other vendor. Each vendor only ever sees its own invitation, documents and status.

### Step 5: AI reads the proposals (Procurement Manager)
1. Back as the **Procurement Manager**, open the RFP. It's now in **Submissions In**. Each document shows its processing status and updates by itself, usually within a minute.
2. Open **View Details** on each vendor:
   - **Documents:** the ✨ AI-extracted key terms, such as price, payment terms, service levels and contract length.
   - **Compliance:** the ✨ AI risk flags with severity and the clause text. Harborline's proposal should raise several, including data copied outside the EU, a one-month liability cap, automatic renewal and slow breach notification. Try **Acknowledge** on one and **Escalate** on another.
   - **Notes:** add an internal note. Vendors never see these.

### Step 6: Evaluate with AI (Procurement Manager)
1. On the RFP, select **Start Evaluation**.
2. Select **Suggest with AI**. ✨ Weighted criteria appear, based on the RFP. Edit names or weights, or remove or add criteria; the weights must total 100. You can also start from the saved template "IT services — standard".
3. Select **Confirm and Start Scoring**. The RFP moves to **Under Evaluation** while the AI scores each vendor against each criterion.
4. When scoring finishes, the vendor list shows each total score. On a vendor's **Scores** tab you can read the ✨ justification for every score, and override one if you disagree; the override is recorded.
5. **Shortlist** the vendor you prefer.
6. Select **Generate Report**. When it's ready (usually under a minute), the report opens. You'll see the ✨ executive summary and advisory recommendation, the scorecard, the key-terms comparison and the risk summary. Try **Export PDF**.

The AI recommendation is advice only. Nothing moves forward until a person decides.

### Step 7: The department weighs in (Department Head)
1. Sign in as the **Department Head**. The dashboard lists the evaluation as ready for review.
2. Open the comparison report, then select **Add Recommendation** to add Engineering's view, e.g. *"Engineering supports Summit: better recovery times and EU-only data."*

### Step 8: Submit for approval (Procurement Manager)
1. As the **Procurement Manager**, open the report and select **Submit for Approval**. Choose the shortlisted vendor and the Finance Approver.
2. The RFP moves to **Approval Pending**. You can **Recall** the request if something needs changing.

### Step 9: Finance decides (Finance Approver)
1. Sign in as the **Finance Approver**. The dashboard and **Approvals** show the request with its response deadline.
2. Select **Review**. One screen shows everything needed to decide: the selected vendor, the report, scores, escalated risk flags and the department's recommendation.
3. Select **Approve** and add a comment. Alternatively, try **Reject**: a reason is required, the Procurement Manager is told why, and the RFP goes back to Shortlisted for another attempt.

### Step 10: The contract is tracked (Procurement Manager)
1. As the **Procurement Manager**, the RFP is now **Contracted**: approval created the contract automatically. The chosen vendor's status shows as contracted and the other as not selected.
2. Go to **Contracts** and open the new contract. Add the value, payment terms and dates with **Edit**, upload the signed file, and set how many days before the end date you want a renewal alert.
3. See **Cloud Backup Service**, which ends in under a month. It's flagged *Expiring soon* and appears on the dashboard. **Initiate Renewal** starts a new RFP for it.

### Step 11: Look back at the trail (any internal role)
- **Activity** shows every action with who, what and when, including before-and-after details. Each RFP also has its own activity tab.
- **Search** (top bar) finds RFPs, vendors and contracts across the workspace.
- Sign in as each vendor once more: their portal shows only their own status, such as *Contracted* or *Not Selected*, and never the scores behind it.

---

## What each role can do

| Role | Sees | Does |
| --- | --- | --- |
| **Procurement Manager** | Everything in the organisation | Creates RFPs, invites vendors, runs the AI evaluation, shortlists, generates reports, submits for approval, manages contracts and settings |
| **Department Head** | Their requirements and the evaluations that come from them | Raises requirements, reviews comparison reports, adds recommendations |
| **Finance Approver** | Approval requests assigned to them, with the full report | Approves or rejects with a reason |
| **Vendor** | Only its own invitations, documents and status | Uploads and submits proposals |

## If something doesn't go as expected

| You see | Why | What to do |
| --- | --- | --- |
| An AI error with a **Retry** button | The free AI tier's limit was reached for the moment | Wait a minute, then select **Retry** |
| "This document appears to be a scanned image" | The file is an image without text; v1 doesn't do OCR | Upload a text-based PDF, such as the samples |
| A step already done, or an RFP in an unexpected stage | Another visitor got there first | Use Path B with your own new requirement, or come back after the nightly reset |
| A message that an action is turned off | Password, email and organisation changes, team invites and new sign-ups are disabled in the demonstration | Everything else works normally |
