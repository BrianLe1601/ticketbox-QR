---
name: ticketbox-music-workflows
description: Trace TicketBoxQR concert-domain consistency for music-category/demo changes or a specific purchase, Staff assignment, check-in or report change. Not a whole-project optimization or permission to remove functioning features.
---

# TicketBox Concert Workflows

Concerts are the target domain; Categories describe music genres. Reuse the existing schema/workflows. Preserve old non-music history; no implicit DB reset or seed execution. Payment/refund remain simulations. No artist catalogue, seat map or organizer infrastructure is implied.

Read only the reference relevant to the task, completely:
- Catalogue/public purchase/QR/email: [references/catalogue-purchase.md](references/catalogue-purchase.md).
- Approval/assignment/check-in/reports: [references/gate-reporting.md](references/gate-reporting.md).

Trace component → client service → route/schema/controller/service/repository → SQL/tests. Recheck against source: references navigate code, not certify completion.

For inventory/lifecycle/cancellation/refund/availability, load `.agents/skills/ticketbox-event-safety/SKILL.md` and its reference. Do not invent an alternative transaction contract. Use `.agents/skills/ticketbox-verify/SKILL.md` before handoff.

Keep ownership from AGENTS. Cross-owner API/schema/auth/workflow changes require review/approval. UI simplification removes duplicate presentation, not OTP, holds/expiry/idempotency or QR/email/Retrieval. Propose removal of working business features separately.

Report scoped input/state/result, invariant at risk, unhappy paths, changed files, evidence and manual limits. Do not audit/refactor every workflow merely because this skill references it.
