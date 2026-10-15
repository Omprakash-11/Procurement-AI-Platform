# Customer Use Case: From Request to Signed Contract

*An illustrative customer scenario for ProcureMaster. Northbridge Industries and every person and vendor named here are fictional; they are the same sample company used in the platform's demonstration mode.*

## The customer

Northbridge Industries is a 180-person engineering and manufacturing company. Procurement is a team of one: Morgan Hayes, Procurement Manager, buys everything from laptops to cloud services for six departments. Two other people take part in every significant purchase. Department heads such as Alex Rivera (Engineering) raise the needs, and Jordan Lee in Finance signs off the spend.

## The problem

Northbridge's buying process had grown organically, and it showed:

- **Requests arrived by email and chat.** No one could say how many purchases were in flight or where each one stood.
- **Proposals were read by hand.** A typical RFP drew three to five vendor proposals of 20–40 pages each, plus price sheets. Comparing them meant copying prices, payment terms and service levels into a spreadsheet, one document at a time.
- **Risky terms slipped through.** Last year Northbridge renewed a backup contract automatically, at a higher price, because the 30-day cancellation window was buried in clause 14. A liability cap limited to three months of fees had gone unnoticed in another contract.
- **Scoring was inconsistent.** Each evaluation used different criteria and weights, so decisions were hard to explain afterwards.
- **Approvals stalled in inboxes.** Finance received a forwarded email chain and a spreadsheet, with no clear summary of what it was approving or why.
- **Renewals were missed.** Contract end dates lived in a shared folder, and nobody was reminded before a notice period closed.
- **Vendor information needed care.** Vendors received documents by email, and keeping one vendor from seeing another's details depended on people being careful.

The cost was time and risk. Purchases took weeks longer than necessary, and the company signed terms it would have pushed back on had anyone spotted them.

## What Northbridge needed

Northbridge set out these requirements for a procurement platform:

1. One place where every purchase is visible, from the department's request to the signed contract.
2. Proposals read automatically, with key terms laid out side by side.
3. Risky contract clauses flagged before anyone signs, with the source text to check.
4. Consistent, weighted scoring that can be explained to Finance and to auditors.
5. A clear approval step with a recorded decision and reason.
6. Reminders before contracts end.
7. Vendors kept fully separate: each sees only its own invitation, documents and status.
8. A full history of who did what, and when.
9. AI that assists people but never makes the decision.

## How ProcureMaster works for Northbridge

**1. A requirement becomes an RFP.** Engineering's file servers are nearly full, so Alex raises a requirement in ProcureMaster: about 60 TB of managed cloud storage, EU data residency, 24/7 support and migration within a quarter. Morgan turns it into an RFP, "Managed Cloud Storage Platform". The RFP appears on the pipeline board, where every purchase moves through the same stages, from request to contract.

**2. Vendors respond through their own portal.** Morgan invites Harborline Cloud Services and Summit Data Systems. Each receives a single-use invitation link that expires after 72 hours. In the vendor portal they see only this RFP and their own documents. They upload proposals and price sheets as PDF, Word or Excel files and submit.

**3. AI reads every proposal.** As soon as a vendor submits, ProcureMaster extracts the text and the AI pulls out the key terms: total price, payment terms, service levels, migration timeline, contract length, data protection. Within about a minute, Morgan has a side-by-side comparison that used to take an afternoon of copying into a spreadsheet.

**4. AI flags the risks.** The same pass checks every clause against common procurement risks. Harborline's proposal comes back with several high-risk flags. Its liability cap is limited to three months of fees. It renews automatically with only 30 days' notice. Its prices can rise "at the provider's discretion". It charges data egress separately. Each flag quotes the source text, so Morgan can check it in seconds. Morgan escalates the liability clause for Finance to see, and acknowledges the others.

**5. A consistent, explainable evaluation.** Morgan selects **Start Evaluation**. The AI suggests weighted criteria based on the RFP, such as commercial value, service levels, security and compliance, and implementation. Morgan adjusts the weights, or reuses the company's standard template. The AI then scores each vendor against each criterion and gives a short justification for every score. Morgan can override any score, and the override is recorded.

**6. A comparison report with a recommendation.** ProcureMaster writes an executive summary and an advisory recommendation. In this case it recommends Summit Data Systems, which scores 9.15 against Harborline's 5.5 on the confirmed criteria: better service levels, fixed pricing, EU-only data and fairer liability terms. Alex adds a recommendation from Engineering on the report. The report can be exported as a PDF. The recommendation is clearly marked as AI-generated and is only advice: Morgan decides.

**7. One clear approval.** Morgan submits Summit for approval. Jordan receives a notification with everything in one screen: the report, the scores, the escalated flags and Engineering's comment. Jordan approves, with a comment. Had Jordan rejected it, a reason would have been required and Morgan told why. If a decision waits too long, ProcureMaster sends a reminder.

**8. The contract is tracked to renewal.** Approval creates the contract automatically, and Summit's status changes to contracted. ProcureMaster watches the end date and alerts Morgan well before the notice period closes, so a renewal like last year's cannot happen silently again.

Every step is written to the activity log with before-and-after details, so Northbridge can answer "who approved this, and on what basis?" at any time.

## What changes for Northbridge

| Before | With ProcureMaster |
| --- | --- |
| Purchases scattered across email and chat | Every purchase on one pipeline, from request to contract |
| Proposals compared by hand in spreadsheets | Key terms extracted and compared automatically |
| Risky clauses found too late, or never | Risks flagged on submission, with the source text |
| Different criteria every time | Consistent weighted scoring with written justifications |
| Approvals lost in email chains | One approval screen, with a recorded decision and reason |
| Missed renewals and notice periods | Automatic renewal alerts |
| Vendor separation depended on care | Vendors isolated by design, down to the database |

The result Northbridge cares about most is a shorter, safer path from "we need this" to "contract signed". Morgan spends time on judgement and negotiation instead of copying data. Finance approves with confidence. And the company stops signing terms it never meant to accept.

## Why the AI can be trusted

- **People stay in control.** The AI suggests, flags and recommends; it never approves, rejects or moves a purchase forward on its own.
- **AI output is always marked.** Anything the AI wrote carries a violet ✨ icon, so it's never mistaken for a person's input.
- **Checked before it's saved.** Every AI answer must match a strict format, or it's rejected and can be retried. It never quietly shows wrong data.
- **Confidential by design.** Vendors never see scores, flags, reports or each other. Each company's data is separated at the database level.

---

*See [Architecture and Technology Flow](architecture.md) for how the platform is built.*
