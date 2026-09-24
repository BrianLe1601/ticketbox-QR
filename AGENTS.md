# TicketBoxQR Agent Guide

## Project context
- Product: event ticket management, registration, QR delivery, gate check-in, and attendance reporting.
- Stack: React + Vite + TypeScript + Tailwind CSS (`client`), Node.js + Express + TypeScript + MySQL (`server`).
- `database/migrations/001_initial_schema.sql` is the single database source of truth for local reset and project setup.
- This file is the shared engineering contract. A task-specific note may add stricter rules, but it may not weaken the rules here.

## Product skeleton and ownership

| Owner | Primary responsibility | Owned API/modules |
|---|---|---|
| Bửu | Leader, platform, database, backend authentication, login, Admin Events, Admin Ticket Types, Admin Staff, Admin Categories; Admin Dashboard and planned realtime Admin notifications | `auth`, `categories`, admin `events`, admin `ticket-types`, `admin-staff`, shared platform/database |
| Tài | Public Event experience, Checkout, Order, Payment, QR, initial ticket Email and Admin Orders | public `events`, `checkout`, QR and initial mail delivery, admin Orders |
| Khôi | Scanner, Check-in, Admin Check-in Logs, Admin Reports | `checkins`, scanner/staff gate UI, admin check-in logs and reports |

- The owner of a module designs and implements that module's API, tests, migrations, frontend service and UI integration.
- Shared contracts (`events`, `ticket_types`, `orders`, API response types, auth middleware, migrations) require review by the affected downstream owner.
- Do not duplicate another owner's business rule in UI-only code. Put canonical decisions in the owning backend service and expose a stable code/message to consumers.
- Cross-module delivery order is: migration -> repository -> service -> controller -> route -> client service -> UI -> tests/docs.

## Agreed product scope and task boundaries

- Guests buy by email without an account. The Public Header has no Login/Register entry points; `/login` remains for Admin and Staff. **Ticket Retrieval and controlled ticket-email redelivery are in scope** and owned by Tài. The public response must remain neutral whether an email exists or not; require reCAPTCHA action verification plus independent IP/email/action rate limits before enqueueing mail.
- Scope Bửu's Admin Staff work to Staff account administration and Event assignment. Tài owns Checkout/OTP, initial ticket delivery, Ticket Retrieval and Admin Orders; Khôi owns scanner/check-in. Preserve the `ticketbox:<raw-token>` QR payload and hash-based check-in lookup. A recoverable QR credential may exist only as immutable authenticated ciphertext for server-side initial delivery/redelivery; never use ciphertext as the lookup key, expose it to clients/logs, store plaintext, or rotate the QR merely because an email is resent.
- Tài owns OTP reCAPTCHA v3 verification, IP/email/action rate limits, HTTP 429/countdown, Ticket Retrieval and ticket-email delivery jobs. Reuse the reviewed implementation from `develop` when integrating owner branches instead of recreating competing routes. The cancellation-notification retry job remains a distinct `order_cancelled` workflow and must not be conflated with ticket delivery/redelivery.
- Ticket Retrieval may return only confirmed Orders and their currently valid Ticket/Event context. Email content must identify the Event, schedule, venue, Ticket Type/code, status, QR and check-in guidance. Public acknowledgement never proves that mail was delivered; provider work stays outside the request/transaction and must use auditable retry state without leaking whether a buyer was found.
- Bửu owns general realtime Admin notifications; keep notification-center work in a later task until event source, recipients, delivery and authorization are specified. Event lifecycle status push is already a separate, public-data-only WebSocket transport and must not be presented as a completed Admin notification center.
- Edit only files needed for the current task; do not perform broad refactors or overwrite another owner's work. A shared schema, API contract, or business-workflow change requires affected-owner review before implementation.
- Before changing a shared contract, trace its effect on Public/User, Admin, Staff, Event, Ticket, Payment, Email and Check-in; keep schema edits in the existing database workflow and validate affected routes and tests.
- Do not commit, push, merge, create a pull request, or change Trello on an agent's own initiative. Run relevant checks and report changed files and unverified behavior; never mark a feature complete from documentation alone.

### Personal Staff accounts and Event assignment (target Admin workflow)

- Default to one `users(role='staff')` account per person, not one shared login per Event. Reuse the same account across non-overlapping Events through `event_staff`; multiple Staff accounts may be assigned to one Event. Do not invent a group/membership table or a one-account-per-Event rule.
- Google sign-in may create an inactive, pending Staff profile; Admin alone approves/rejects it, edits the profile, activates/deactivates it and manages assignments. Staff cannot self-approve, self-assign, change Event permissions, or access Admin functions. Authentication alone never grants check-in access; Khôi's backend must still check active Staff, active assignment and Event check-in window.
- Staff onboarding uses Google sign-in, not an open Staff password-registration form. The backend verifies the Google ID token against the configured web client ID, uses Google's stable `sub` as the account identity, and requires a verified email. Never infer identity solely from an email match or link a Google login to an existing local Admin/Staff account automatically.
- A first Google login creates a `staff` record with approval `pending` and `is_active = FALSE`; it must not issue a TicketBox access/refresh session. Only an Admin can approve, reject, deactivate or reactivate. Approval does not auto-assign an Event. Password login remains for existing local Admin and seeded development accounts; Google-only Staff have no local password.
- Google client IDs are environment configuration, not Staff credentials. Never trust a frontend-supplied role, email, score or approval status. Keep Google token verification and role/approval decisions on the backend. Do not add Google access tokens or raw ID tokens to application logs.
- When a Staff member leaves, revoke every active `event_staff` row before setting `users.is_active = FALSE` (required by the trigger); invalidate their sessions and retain their account, assignments and `checkin_logs` for audit. Reactivation and reassignment may reuse the same account; never delete/recreate it merely because an Event or employment period ends.
- Assignment must reject inactive Staff, terminal Events, Events whose `end_time` has passed, duplicate active Staff/Event pairs and overlapping Event schedules for the same Staff account. Preserve `assigned_by`, `assigned_at` and `revoked_at`; revoke then create a new row instead of rewriting assignment identity. Event schedule changes require resolving active assignments first.
- `checkin_logs.staff_id` must identify the person operating the gate. Shared credentials defeat individual accountability and are not the default; any emergency exception needs explicit approval, a limited scope and credential rotation. Do not change Tài's QR or Khôi's check-in contract to implement Admin Staff.

## Commands before handoff
- Client: `npm run lint` and `npm run build` from `client`.
- Server: `npm run typecheck`, `npm run build`, and relevant tests from `server`.
- Database setup: run the complete `database/migrations/001_initial_schema.sql`, then run `npm run seed` from `server`.
- Do not install, commit, push, merge, reset, or rewrite user changes unless explicitly requested.

## Daily Git workflow

Use `develop` as the integration branch and `main` only for reviewed releases. Work on the existing owner branch (currently `buu-events`, `tai`, or `khoi-checkin-reports`) or a short-lived owner-prefixed branch. Verify the actual branch name before switching; never invent a branch.

Before coding:

```powershell
git status
git switch develop
git pull --ff-only origin develop
git switch <existing-owner-branch>
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
- Never hardcode or log an API key, reCAPTCHA secret, OTP, password or authentication token; the frontend may contain only a public reCAPTCHA site key.
- Never put an Order lookup token or QR credential in a URL, access log, analytics event or error message. The current GET lookup query and Morgan `:url` logging need an owner-reviewed fix before staging.
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
- Time-based lifecycle is server-owned: persist `published -> ongoing` at `start_time` and `ongoing -> completed` at `end_time` with the idempotent Event lifecycle transaction. Run it at startup, every second in the lifecycle job and after Event fixture seeds. Only after commit, publish the changed Event ids/statuses through `/ws/events`; Admin/Public clients must refetch REST data rather than trust or write the WebSocket payload. Keep one shared client socket, heartbeat/reconnect cleanup and the 60-second polling fallback. The in-process broadcaster is single-instance only; a multi-instance deployment requires a shared broker before claiming cross-instance realtime delivery.
- Public APIs may retain visible completed Events as read-only history, but must always derive `saleStatus='closed'`; cancelled Events remain hidden and terminal.
- Draft without orders may be permanently deleted. Draft is not cancelled.
- Publishing and showing a published/ongoing Event require at least one active, valid Ticket Type.
- `checkin_start_at` must be on the same Vietnam calendar date as `events.start_time` and at least 30 minutes before Event start; `checkin_end_at` must be after check-in start and no later than Event end. Enforce this in Admin UI, backend service validation and the schema constraint—never rely on the browser alone.
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

### Admin summary-card filtering contract

- Use Admin Staff as the interaction reference for Admin summary metrics: every card that names a list segment and shows a count must act as a filter, not as decoration. Clicking it updates the existing list in place without route navigation or a full-page reload; clicking the total card restores the complete base scope.
- Implement metric filters with local state for an already-loaded complete dataset, or URL query state when the filter must be shareable/back-button aware. Do not navigate away merely to filter. A server-paginated page must receive aggregate counts from the API for the same base scope; never calculate a claimed global total from only the current page.
- Counts and rows must use one canonical predicate. Selecting a card must produce the exact segment represented by its label/count. Reset incompatible text search, page number and subfilters on selection unless the UI explicitly displays that filters are combined; preserve only stable parent scope such as the currently selected Event.
- Render interactive cards as semantic `<button type="button">` elements where possible. Provide visible hover, focus and selected states, `aria-pressed`, an action-oriented Vietnamese `aria-label`, keyboard activation and a disabled/loading state. Color alone must not identify the active filter.
- Keep the selected metric visibly active and synchronize any duplicated status tabs/dropdowns with the same state. Search, sort, refresh, mutations and WebSocket refetches must not silently desynchronize the selected card, count and visible rows. Show a contextual empty state such as “Không có sự kiện đã hủy”, not a generic load failure.
- Admin Events keeps both **Dạng thẻ** and **Danh sách** views over the same filtered collection. Switching views is local presentation state only, must not navigate or refetch, and must preserve search/status/category filters. Both views expose the same lifecycle-safe actions and disabled rules; storing the user's last view locally is allowed, but API data remains the source of truth.
- Category segments are `all`, `active` and `inactive`: **Tổng danh mục**, **Đang hoạt động**, **Đã vô hiệu hóa**. “Sự kiện liên kết” is informational unless its click behavior and exact predicate are explicitly designed.
- Event segments follow the persisted lifecycle exactly: `all`, `draft`, `published`, `ongoing`, `completed`, `cancelled`. Labels are **Tổng sự kiện**, **Bản nháp**, **Đã công bố**, **Đang diễn ra**, **Đã kết thúc**, **Đã hủy**. Do not merge statuses into a card if the user needs to inspect them separately; do not infer state from dates on the client when the API already supplies effective status.
- Ticket Type segments describe Ticket Type state/inventory: **Tổng hạng vé**, **Đang bán/đang hoạt động**, **Tạm dừng**, **Hết vé**, and optionally **Có vé đang giữ**. `draft`, `published`, `ongoing`, `completed`, `cancelled` belong to the parent Event, not to a Ticket Type. If the Hạng vé screen needs those labels, use them only to filter the Event browser/sidebar, then filter tiers within the selected Event by tier predicates such as `isActive`, `availableQuantity`, `reservedQuantity` and `soldQuantity`.
- Reuse the current Admin design tokens, spacing, status colors, responsive grid and compact confirmation-dialog pattern. On narrow screens, allow horizontal metric-card scrolling or a compact grid without hiding filters or causing page-level horizontal overflow.
- Before declaring an Admin filter complete, test each card against seeded mixed-status data; test search combined/reset behavior, zero-result segments, mutation/refetch count updates, keyboard activation, mobile layout and server pagination where present.

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
- Trello completion and README `[x]` require reviewed, merged code plus relevant automated and manual evidence. An uncommitted working tree, passing mock tests, or a Trello description alone is insufficient. Keep owner/week cards and the shared remaining-work list in sync without duplicating ownership.
- The branch contains only task-related changes and is ready for another member to pull and run.

## Project skills
- Use `.agents/skills/ticketbox-event-safety` for Event, Ticket Type, Order, refund, or cancellation work.
- Use `.agents/skills/ticketbox-verify` before handing off a code change.
- Read the selected skill completely and follow its referenced checklist before editing.
