# Canonical lifecycle and inventory rules

## Event transitions
- Draft: editable; requires complete operational dates, venue capacity, cover, and at least one active valid tier before publishing.
- Published: public only when visibility is `visible`; may be hidden, cancelled, or moved to ongoing.
- Ongoing: may complete or be cancelled for an unavoidable incident.
- Completed/cancelled: read-only audit state; never reopen sales.

## Availability predicate
An Event/tier can be sold publicly only when all are true: Event is published or ongoing, Event is visible, tier is active, current time is within the effective sales window, and `capacity - reserved_quantity - sold_quantity > 0`.

Public Event sale state is derived from active tiers in this order: any purchasable tier = `on-sale`; otherwise any tier with remaining inventory whose sales start is in the future = `coming-soon`; otherwise all active tiers without inventory = `sold-out`; otherwise = `closed`. The API is the source of this state for both list and detail UI.

## Last-tier invariant
A visible published/ongoing Event retains at least one active valid tier. To retire the final tier: hide the Event, activate a replacement tier, or cancel the Event. Never leave a public Event with an empty purchase catalogue.

## Cancellation outcomes
- No orders: cancel/hide Event and close tiers. No refunds or customer emails are created.
- Pending orders: release reserved inventory, cancel pending payments/orders, and queue notice email.
- Confirmed orders: retain order/payment history, invalidate QR tickets, create one refund record per order, and queue one cancellation email per order.
- Cancellation must be idempotent and transactional. Email sending retries asynchronously and never reopens the Event.
