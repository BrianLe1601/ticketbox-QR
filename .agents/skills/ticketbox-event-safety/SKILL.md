---
name: ticketbox-event-safety
description: Enforce TicketBoxQR Event, Ticket Type, Order, inventory, cancellation, refund, QR invalidation, and customer-notification invariants. Use whenever changing Event or Ticket lifecycle APIs, repositories, migrations, jobs, or Admin/Public ticket availability UI.
---

# TicketBox Event Safety

1. Read `references/lifecycle.md` completely.
2. Trace the request through route, schema, controller, service, repository, migration, and affected UI.
3. List the invariant that could be broken before editing.
4. Put multi-table state changes in one MySQL transaction with row locks or conditional atomic updates where inventory is involved.
5. Keep provider work such as email outside the transaction; queue an auditable log inside it.
6. Preserve historical rows. Prefer status transitions over deletion after any order reference exists.
7. Verify success, invalid transition, retry/idempotency, and concurrent/partial-failure paths.
8. Run the `ticketbox-verify` skill before handoff.
