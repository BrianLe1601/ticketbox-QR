# TicketBoxQR Agent Guide

## Project context
- Product: event ticket management, registration, QR delivery, gate check-in, and attendance reporting.
- Stack: React + Vite + TypeScript + Tailwind CSS (`client`), Node.js + Express + TypeScript + MySQL (`server`).
- `database/migrations/001_initial_schema.sql` is the single database source of truth for local reset and project setup.
- This file is the shared engineering contract. A task-specific note may add stricter rules, but it may not weaken the rules here.

## Product skeleton and ownership

| Owner | Primary responsibility | Owned API/modules |
|---|---|---|
| Bửu | Leader, platform, database, backend authentication, login, Admin Events, Admin Ticket Types, Admin Staff, Admin Categories | `auth`, `categories`, admin `events`, admin `ticket-types`, admin `staff`, shared platform/database |
| Tài | Public Event experience, Order, Payment, QR, Email | public `events`, `orders`, `payments`, `tickets`, QR and mail delivery |
| Khôi | Scanner, Check-in, Admin Check-in Logs, Admin Reports | `checkins`, scanner/staff gate UI, admin check-in logs and reports |

- The owner of a module designs and implements that module's API, tests, migrations, frontend service and UI integration.
- Shared contracts (`events`, `ticket_types`, `orders`, API response types, auth middleware, migrations) require review by the affected downstream owner.
- Do not duplicate another owner's business rule in UI-only code. Put canonical decisions in the owning backend service and expose a stable code/message to consumers.
- Cross-module delivery order is: migration -> repository -> service -> controller -> route -> client service -> UI -> tests/docs.

## Commands before handoff
- Client: `npm run lint` and `npm run build` from `client`.
- Server: `npm run typecheck`, `npm run build`, and relevant tests from `server`.
- Database setup: run the complete `database/migrations/001_initial_schema.sql`, then run `npm run seed` from `server`.
- Do not install, commit, push, merge, reset, or rewrite user changes unless explicitly requested.

## Daily Git workflow

Use `develop` as the integration branch and `main` only for reviewed releases. Each person works on their own branch (`buu`, `tai`, or `khoi`) or a short-lived branch prefixed with their name.

Before coding:

```powershell
git status
git switch develop
git pull --ff-only origin develop
git switch <buu|tai|khoi>
git merge develop
```

Before pushing:

```powershell
git status
git diff --check
cd client; npm run lint; npm run build; cd ..
cd server; npm run typecheck; npm run build; npm test; cd ..
git add <only-files-owned-by-this-task>
git diff --cached
git commit -m "feat(scope): short description"
git push origin <branch-name>
```

- Pull request flow: owner branch -> `develop`; reviewed/stable `develop` -> `main`.
- Never run `git add .` blindly when unrelated files are present. Stage explicit paths and inspect `git diff --cached`.
- Never force-push a shared branch. Resolve cross-owner conflicts together; do not delete unfamiliar code to make a conflict disappear.
- LF/CRLF conversion warnings are not build failures. Keep `.gitattributes` as the shared line-ending policy and do not mass-convert files in a feature PR.

## Architecture rules
- Route -> validation middleware -> controller -> service -> repository -> MySQL.
- Controllers translate HTTP only. Business rules belong in services. SQL and transactions belong in repositories.
- Validate all request params/query/body with Zod. Return stable application error codes with safe messages.
- Use ESM imports ending in `.js` in server TypeScript. Use `import type` for type-only imports.
- Keep secrets in server environment variables. Never place secrets in `client`, examples, logs, or Git.
- Database changes must be coordinated by Bửu and merged into the single schema file only after reviewing every affected module.

## Database schema workflow

- Keep exactly one executable schema file: `database/migrations/001_initial_schema.sql`.
- The file intentionally drops and recreates `ticketboxqr`; never run it against production or data that must be preserved.
- Bửu owns integration of schema changes. Tài and Khôi propose the table/column/constraint required by their module; Bửu reviews cross-module foreign keys and merges it into the complete schema.
- Keep table creation in dependency order and define indexes, constraints, triggers, views and default Categories in the same file.
- After a schema change, reset a disposable local database, run the complete SQL from top to bottom, then run `npm run seed` and the standard verification suite.
- Never add a second executable `.sql` or nested database `README.md`. Database instructions belong in the root `README.md` and engineering rules belong here.
- Production-safe incremental migrations are intentionally outside the current student-project workflow; introduce a real migration framework before deploying against persistent production data.

## Canonical database workflow for all owners

The database is a shared state machine, not merely a collection of CRUD tables. Every owner must preserve this dependency chain:

```text
categories -> events -> ticket_types -> orders -> order_items -> tickets
                       |              |                 |
                       |              +-> payments      +-> checkin_logs
                       |              +-> refunds
                       |              +-> email_logs
                       +-> event_staff <- users
users -> auth_sessions
```

- Bửu owns schema integration, Categories, Events, Ticket Types, Users and Staff assignments.
- Tài may mutate Orders, Order Items, Payments, Tickets and Email Logs only through the Order/Payment workflow; changes affecting Event/Ticket inventory require Bửu review.
- Khôi may mutate Ticket check-in state and append Check-in Logs only for an assigned Staff/Event pair; reporting queries never rewrite transactional history.
- Foreign keys use `RESTRICT` for business/audit history. `auth_sessions.user_id` is the only intentional business-independent cascade because sessions are transient security records.
- `order_items.ticket_type_name` and `unit_price` are intentional purchase snapshots. `checkin_logs.event_id` is intentional scanner context. Do not remove them as apparent duplication.
- Hard delete is allowed only for unreferenced configuration or a Draft without Orders. Otherwise use lifecycle/status fields.

### Transaction and lock contract

- Lock rows in the global order `Event -> Order (ascending id) -> Ticket Type (ascending id) -> Ticket`.
- Checkout locks the Event, then requested Ticket Types before checking availability and incrementing reservations.
- Payment and order expiry resolve the immutable Event id, lock the Event, then lock the Order and inventory rows.
- Event cancellation locks the Event and all related Orders before releasing reservations, cancelling pending work, invalidating QR Tickets, creating Refunds and queueing Email Logs.
- Never call email, Cloudinary or payment providers while a database transaction is open. Commit the auditable outbox/workflow row first; process the provider asynchronously.
- Retry/idempotency keys and unique codes are database contracts. A retry must return/reuse the prior result or be rejected predictably; it must not duplicate inventory or money movement.

### State and inventory contract

- Event: `draft -> published -> ongoing -> completed`; `published|ongoing -> cancelled`. Completed and Cancelled are terminal.
- Order: `pending_payment -> confirmed|expired|cancelled`. Confirmed Orders remain historical records during Event cancellation; Refund tracks money reversal.
- Ticket: `issued -> checked_in|cancelled`; `checked_in -> cancelled` only for Event cancellation.
- Payment: `pending -> success|failed|cancelled`. Never rewrite a successful payment into another state.
- Refund and Email delivery have retryable states; immutable identity/amount/recipient fields must not be overwritten during retry.
- Availability is always `capacity - reserved_quantity - sold_quantity`; all three values are changed in the same transaction as the related Order state.
- Public sale state is derived on the server from Event lifecycle/visibility, effective Event/Tier sales window, tier active state and remaining inventory.

### Local workflow fixtures

- Run `npm run seed` first for Admin/Staff accounts.
- Run `npm run seed:workflows` to replace only the isolated `qa-workflow` Category and create the documented Event/Ticket/Order/Refund/Check-in scenarios.
- Run `npm run db:verify` to verify positive fixtures and ensure invalid operations are rejected. Negative checks always roll back.
- Both commands are forbidden in `NODE_ENV=production`. Never rename/remove the `qa-workflow` isolation marker without updating cleanup and verification together.

## Category invariants

- `categories` is the source of truth; Events reference it through `events.category_id`.
- Category slugs are lowercase, URL-safe and unique. Public filtering uses the slug; internal relationships use the numeric ID.
- An inactive Category cannot be selected for a new Event, but existing Events keep their relationship for history.
- A Category referenced by any Event cannot be hard-deleted. Deactivate it instead.
- A referenced Category slug is immutable because it is part of the public filtering contract.

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

## API contract and review boundaries

- Use resource routes under `/api`; Admin routes require `authenticate` and `authorize("admin")`.
- Keep success payloads in the shared `{ success, data, meta? }` shape and errors in `{ success: false, message, code }`.
- Error codes are stable API contract. UI may translate/display messages but may not infer business state from English text.
- Any change affecting another owner includes a short migration/API compatibility note in the pull request.
- Public pages must not call Admin endpoints. Admin UI must not access the database or Cloudinary secrets directly.

## Definition of Done

- Acceptance rules and unhappy paths are implemented, not only the happy path.
- Validation, authentication, authorization, transaction boundaries and audit history are appropriate for the operation.
- Loading, empty, success, disabled and error states are visible and keyboard accessible.
- New database changes are integrated into the single schema and verified on a disposable local database.
- Relevant tests pass; client lint/build and server typecheck/build pass.
- Database work additionally requires `npm run seed:workflows` and `npm run db:verify` against a disposable local database.
- README/API notes and manual test evidence are updated when setup or contracts change.
- The branch contains only task-related changes and is ready for another member to pull and run.

## Project skills
- Use `.agents/skills/ticketbox-event-safety` for Event, Ticket Type, Order, refund, or cancellation work.
- Use `.agents/skills/ticketbox-verify` before handing off a code change.
- Read the selected skill completely and follow its referenced checklist before editing.
