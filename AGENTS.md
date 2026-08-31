# TicketBoxQR Agent Guide

## Project context
- Product: event ticket management, registration, QR delivery, gate check-in, and attendance reporting.
- Stack: React + Vite + TypeScript + Tailwind CSS (`client`), Node.js + Express + TypeScript + MySQL (`server`).
- Database migrations are the source of truth and run in numeric order from `database/migrations`.
- Team ownership: Bửu owns platform/auth/admin/events/ticket types; Tài owns public/checkout/orders/payments/tickets/email; Khôi owns staff/scanner/check-in/logs/reports.

## Commands before handoff
- Client: `npm run lint` and `npm run build` from `client`.
- Server: `npm run typecheck`, `npm run build`, and relevant tests from `server`.
- Do not install, commit, push, merge, reset, or rewrite user changes unless explicitly requested.

## Architecture rules
- Route -> validation middleware -> controller -> service -> repository -> MySQL.
- Controllers translate HTTP only. Business rules belong in services. SQL and transactions belong in repositories.
- Validate all request params/query/body with Zod. Return stable application error codes with safe messages.
- Use ESM imports ending in `.js` in server TypeScript. Use `import type` for type-only imports.
- Keep secrets in server environment variables. Never place secrets in `client`, examples, logs, or Git.
- Create a new numbered migration for schema changes; never silently change a migration already shared with teammates.

## Event and ticket invariants
- Lifecycle: `draft -> published -> ongoing -> completed`; `published` and `ongoing` may transition to `cancelled`.
- Draft without orders may be permanently deleted. Draft is not cancelled.
- Publishing and showing a published/ongoing Event require at least one active, valid Ticket Type.
- A visible published/ongoing Event must never lose its final active valid Ticket Type. Hide the Event or activate a replacement tier first.
- Hiding controls public visibility only; it does not erase orders or automatically mutate Ticket Type intent.
- Ticket capacity must not exceed venue capacity. It cannot fall below reserved + sold inventory.
- A Ticket Type referenced by an order is never hard-deleted. Pause it instead.
- Price cannot change after reservation or sale. Close the old tier and create a new one.
- Public availability must be decided by Event status/visibility, Ticket Type active state, sales window, and remaining inventory on the server—not UI labels alone.

## Cancellation safety
- Cancellation is one database transaction: hide/cancel Event, close tiers, release pending holds, cancel pending payments/orders, invalidate issued QR tickets, create refund records for confirmed orders, and queue email logs.
- Email delivery is asynchronous and retryable. A mail provider failure must not roll back the cancellation.
- Refund records are an audit workflow; do not mark a real refund completed without payment-provider or administrator confirmation.
- Preserve Orders, Order Items, Tickets, Payments, Check-in Logs, Email Logs, and Refunds for audit history.

## UI and performance
- Accessible labels, keyboard escape, visible hover/focus, loading/disabled/error states are required for every action.
- Prefer `transform` and `opacity` for animations. Avoid continuous full-screen blur/filter, layout-thrashing animation, or overlapping timers.
- Respect `prefers-reduced-motion`. Keep route transitions bounded and cancel timers/listeners during cleanup.

## Project skills
- Use `.agents/skills/ticketbox-event-safety` for Event, Ticket Type, Order, refund, or cancellation work.
- Use `.agents/skills/ticketbox-verify` before handing off a code change.
- Read the selected skill completely and follow its referenced checklist before editing.
