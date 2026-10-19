# Canonical lifecycle and inventory rules

## Event transitions
- Draft: editable; requires complete operational dates, venue capacity, cover, and at least one active valid tier before publishing.
- Published: public only when visibility is `visible`; may be hidden, cancelled, or moved to ongoing.
- Ongoing: may complete or be cancelled for an unavoidable incident.
- Completed/cancelled: read-only audit state; never reopen sales.

## Single venue and lock order
- One venue for the platform (`platform_settings`, id 1). Events must not overlap on the closed interval `[checkin_start_at, end_time]`; Draft occupies the slot, Cancelled frees it. Create/schedule edits lock `platform_settings` first, then check conflicts (service) with the BI/BU triggers as a backstop; only changes to start/end/check-in start re-check.
- Global lock order: `platform_settings -> Event -> Order (ascending id) -> Ticket Type (ascending id) -> Ticket`. Never take `platform_settings` after an Event lock.
- Venue snapshots on Events change only per the venue-change rule (Draft w/o Orders/Tickets sync; published w/o sales needs confirmation; sold/issued/completed locked).

## Sales window
Sales open before the Event starts and close no later than check-in end (Event and every tier's effective window): `sales_start_at < start_time`, `sales_end_at <= checkin_end_at <= end_time`. Enforced by schema CHECK/triggers, the Event and Ticket Type services, readiness and the Admin forms.

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
