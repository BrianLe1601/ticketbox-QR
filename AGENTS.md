# TicketBoxQR Agent Guide

## Project context
- Product: concert ticket sales by email, QR delivery, gate check-in, and attendance reporting. New Events/demo content target music concerts; Categories represent genres (Pop/Rock/EDM/Acoustic), not a general conference/sports marketplace. Preserve existing non-music history; no artist management, seating map or organizer infrastructure is implied.
- Stack: React + Vite + TypeScript + Tailwind CSS (`client`), Node.js + Express + TypeScript + MySQL (`server`).
- Venue: TicketBox runs concerts at **one fixed venue** configured by an Admin in `platform_settings` (single row; never invent a venue name/address/capacity, and never add multi-venue management). Concerts may not overlap in that venue. Canonical rules, error codes and APIs: `docs/project-guide/07-venue-reports-theme.md`.
- `database/migrations/001_initial_schema.sql` is the single database source of truth for local reset and project setup.
- This file is the shared engineering contract. A task-specific note may add stricter rules, but it may not weaken the rules here.

## Product skeleton and ownership

| Owner | Primary responsibility | Owned API/modules |
|---|---|---|
| Bửu | Leader, platform, database, backend authentication, login, Admin Events, Admin Ticket Types, Admin Staff, Admin Categories; Admin Dashboard and planned realtime Admin notifications | `auth`, `categories`, admin `events`, admin `ticket-types`, `admin-staff`, `platform-settings`, shared platform/database |
| Tài | Public Event experience, Checkout, Order, Payment, QR, ticket Email, Ticket Retrieval and Admin Orders | public `events`, `checkout`, QR, initial delivery/redelivery, Ticket Retrieval, admin Orders |
| Khôi | Scanner, Check-in, Admin Check-in Logs, Admin Reports | `checkins`, scanner/staff gate UI, admin check-in logs and reports |

- The owner of a module designs and implements that module's API, tests, migrations, frontend service and UI integration.
- Shared contracts (`events`, `ticket_types`, `orders`, API response types, auth middleware, migrations) require review by the affected downstream owner.
- Do not duplicate another owner's business rule in UI-only code. Put canonical decisions in the owning backend service and expose a stable code/message to consumers.
- Cross-module delivery order is: migration -> repository -> service -> controller -> route -> client service -> UI -> tests/docs.

## Agreed product scope and task boundaries

- Guests buy by email without an account. The Public Header has no Login/Register entry points; `/login` remains for Admin and Staff. **Ticket Retrieval and controlled ticket-email redelivery are in scope** and owned by Tài. The public response must remain neutral whether an email exists or not; require reCAPTCHA action verification plus independent IP/email/action rate limits before enqueueing mail.
- Payment and Refund are course-project simulations. Do not integrate, advertise, or imply real money transfer. A simulated success changes the internal workflow/audit state only; every Admin/Public label and demo script must say that payment/refund is simulated.
- Scope Bửu's Admin Staff work to Staff account administration and Event assignment. Tài owns Checkout/OTP, initial ticket delivery, Ticket Retrieval and Admin Orders; Khôi owns scanner/check-in. Preserve the `ticketbox:<raw-token>` QR payload and hash-based check-in lookup. A recoverable QR credential may exist only as immutable authenticated ciphertext for server-side initial delivery/redelivery; never use ciphertext as the lookup key, expose it to clients/logs, store plaintext, or rotate the QR merely because an email is resent.
- Tài owns OTP reCAPTCHA v3 verification, IP/email/action rate limits, HTTP 429/countdown, Ticket Retrieval and ticket-email delivery jobs. Extend the canonical implementation already integrated into the shared branches instead of recreating competing routes. The reCAPTCHA script is loaded on demand by `hooks/useRecaptcha.ts` (Checkout OTP and Ticket Retrieval only), never app-wide in `main.tsx`; its badge is hidden on Admin, Staff and `/login`. The cancellation-notification retry job remains a distinct `order_cancelled` workflow and must not be conflated with ticket delivery/redelivery.
- Ticket Retrieval may return only confirmed Orders and their currently valid Ticket/Event context. Email content must identify the Event, schedule, venue, Ticket Type/code, status, QR and check-in guidance. Public acknowledgement never proves that mail was delivered; provider work stays outside the request/transaction and must use auditable retry state without leaking whether a buyer was found.
- Bửu owns general realtime Admin notifications; keep notification-center work in a later task until event source, recipients, delivery and authorization are specified. Event lifecycle status push is already a separate, public-data-only WebSocket transport and must not be presented as a completed Admin notification center. Admin realtime notifications (Bửu, 18/10/2026) are specified as follows and must keep this contract: **transport** `/ws/admin` (`server/src/realtime/admin-signals.gateway.ts`, registered through `realtime/upgrade-router.ts` next to `/ws/events`; never create a ws server with `{ server, path }`, it rejects the other paths); **authorization** the access token is sent in the first message (never in the URL), verified as JWT and re-read as an active `admin` from the database, browser Origin must equal `CLIENT_URL`, unauthenticated sockets close after 5 s and every socket closes when its token expires (client refreshes the session and reconnects); **recipients** every connected active Admin; **event source** while an Admin is connected, the read-only `getAdminSignalFingerprint()` (dashboard repository) is compared every 5 s, and Event lifecycle pushes are forwarded; **payload** only `{type:"admin.signals.changed", occurredAt, topics}` — clients refetch REST (`hooks/useAdminSignals.ts`, coalesced ≥ 1.5 s, 60 s polling fallback). The topbar bell ("Việc cần xử lý", `components/admin/shell/TaskBell.tsx`) derives tasks from the dashboard summary (`lib/admin-insights.ts` `buildTasks`), toasts tasks that appear while the page is open and marks unseen ones "Mới" per browser; there is no server-side read state or history, and the broadcaster is single-instance (a shared broker is required before claiming multi-instance delivery). Producers in other owners' modules must not be modified to feed it without their review. The Dashboard does not repeat these items.
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
- Assignment must reject inactive Staff, terminal Events, Events whose `checkin_end_at` has passed, duplicate active Staff/Event pairs and overlapping check-in work windows for the same Staff account. Compute conflicts from the closed intervals `[checkin_start_at, checkin_end_at]`, not Event start/end; even touching boundaries conflict. Preserve `assigned_by`, `assigned_at` and `revoked_at`; revoke then create a new row instead of rewriting assignment identity. Event or check-in schedule changes require resolving active assignments first.
- `checkin_logs.staff_id` must identify the person operating the gate. Shared credentials defeat individual accountability and are not the default; any emergency exception needs explicit approval, a limited scope and credential rotation. Do not change Tài's QR or Khôi's check-in contract to implement Admin Staff.

## Commands before handoff
- Client: `npm run lint`, `npm run build` and `node --test tests/*.test.cjs` from `client`.
- Server: `npm run typecheck`, `npm run build`, and relevant tests from `server`.
- Database clean-install only on explicitly disposable data: `database/migrations/001_initial_schema.sql` drops/recreates the database. Neither it nor destructive seed cleanup is a routine verification step; get explicit authorization before running them.
- The real-MySQL integration suites refuse the normal `ticketboxqr` database. Run `node scripts/verify-ticket-email.mjs` from `server` when the full disposable-database suite is required; do not interpret a deliberately skipped/refused integration suite as a passing full verification. The script runs Vitest twice (suites that create their own Events, then, after `seed:workflows`, the suites that read QA fixtures) because the single venue holds only one "ongoing now" Event. If the configured MySQL user cannot create `ticketboxqr_test_*`, grant it that pattern or point `DB_*` env at a separate throwaway MySQL instance (README, "Bật kiểm thử MySQL tích hợp"); a limitation like this is reported, never turned into "pass".
- UI work is verified in a real browser at 1440/768/390px in both themes against a disposable database (contrast, tiny text, overflow, portaled dialogs, keyboard), not only by build/lint. Client/server unit tests and mocks do not prove MySQL behaviour.
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
- `npm test` is sufficient only when the current environment satisfies every selected suite. For the full MySQL-backed verification, use the disposable `ticketboxqr_test_*` workflow documented in README; never point destructive integration setup at the normal database.
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
- Never put an Order lookup token or QR credential in a URL, access log, analytics event or error message. Preserve the existing POST `/api/checkout/orders/:id/lookup` JSON-body contract and Morgan `safe-path` logging; do not restore the removed GET/query-token endpoint.
- Admin password reset (Bửu, `auth`): `POST /api/auth/password-reset/request` answers the same 202 for every email and mails only an active Admin with a local password, after the response; `/confirm` re-checks under the Admin row lock, applies the shared password rules and revokes every session. Tokens are stateless HMACs over the current password hash (`password-reset-token.ts`, key derived from `JWT_SECRET`), single use because the hash changes, 30-minute expiry, carried only in the `/reset-password#token=` fragment and JSON bodies; never log or store them, and never add a query-string variant.
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

- Lock rows in the global order `Event -> Order (ascending id) -> Ticket Type (ascending id) -> Ticket`. Only Admin operations that create an Event or change its schedule/venue lock the `platform_settings` row first (`platform_settings -> Event -> ...`); Checkout, Payment, expiry and Check-in never lock it, so no wait cycle exists. Schedule changes read venue occupancy under that lock and a `BEFORE INSERT/UPDATE` trigger on `events` re-checks it.
- Checkout locks the Event, then requested Ticket Types before checking availability and incrementing reservations.
- Payment and order expiry resolve the immutable Event id, lock the Event, then lock the Order and inventory rows.
- Event cancellation locks the Event and all related Orders before releasing reservations, cancelling pending work, invalidating QR Tickets, creating Refunds and queueing Email Logs.
- Never call email or Cloudinary while a database transaction is open. This project does not call a payment/refund provider; if that scope is ever approved later, commit an auditable outbox/workflow row first and process the provider asynchronously.
- Retry/idempotency keys and unique codes are database contracts. A retry must return/reuse the prior result or be rejected predictably; it must not duplicate inventory or money movement.

### State and inventory contract

- Event: `draft -> published -> ongoing -> completed`; `published|ongoing -> cancelled`. Completed and Cancelled are terminal.
- Order: `pending_payment -> confirmed|expired|cancelled`. Confirmed Orders remain historical records during Event cancellation; Refund tracks the simulated reversal workflow.
- The Admin cancel-order endpoint may cancel only `pending_payment` Orders. A confirmed Order follows the simulated Refund workflow while preserving its confirmed history; do not force `confirmed -> cancelled` while the schema and reporting contract treat confirmed Orders as immutable sales history.
- Ticket: `issued -> checked_in|cancelled`; `checked_in -> cancelled` only for Event cancellation.
- Payment: `pending -> success|failed|cancelled`. Never rewrite a successful payment into another state.
- Refund: `pending -> processing|completed|failed`; `failed -> pending|processing` for a simulated retry. `order_id`, amount and request time are immutable. Only a confirmed Order affected by the agreed cancellation workflow receives one Refund record.
- Refund and Email delivery have retryable states; immutable identity/amount/recipient fields must not be overwritten during retry.
- Completing a Refund records a **simulated** outcome and `completed_at`; failure records a safe `failure_reason`. It never calls a bank/payment provider, never promises money reached the customer, and never changes a successful Payment row. Reports subtract only simulated Refunds whose status is `completed`.
- Availability is always `capacity - reserved_quantity - sold_quantity`; all three values are changed in the same transaction as the related Order state.
- The inventory competition boundary is Order creation after verified email/OTP and a valid buyer phone, not payment. Creating a `pending_payment` Order must lock the Event and selected Ticket Types and reserve inventory atomically; a concurrent loser receives `409 SOLD_OUT`. Payment may still lock Event/Order for idempotent settlement, but it must only convert that Order's existing `reserved_quantity` to `sold_quantity`, never reserve fresh capacity.
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
- Each Category has `kind` (`music` or `other`, default `other`). `platform_settings.category_scope` (`music_only` default, or `all`) decides which active Categories a **new** Event may use; the backend enforces it on create and on changing an Event's Category (`409 CATEGORY_NOT_MUSIC`), never only the UI. Editing an existing Event that keeps its Category is not blocked. Never delete or auto-reclassify legacy Categories; unclassified ones stay `other` until an Admin decides.
- Update schemas must not inherit Zod defaults (Zod 4 applies `.default()` inside `.partial()`, which silently reset fields); derive PATCH schemas from fields without defaults.

## Event and ticket invariants
- Lifecycle: `draft -> published -> ongoing -> completed`; `published` and `ongoing` may transition to `cancelled`.
- Time-based lifecycle is server-owned: persist `published -> ongoing` at `start_time` and `ongoing -> completed` at `end_time` with the idempotent Event lifecycle transaction. Run it at startup, every second in the lifecycle job and after Event fixture seeds. Only after commit, publish the changed Event ids/statuses through `/ws/events`; Admin/Public clients must refetch REST data rather than trust or write the WebSocket payload. Keep one shared client socket, heartbeat/reconnect cleanup and the 60-second polling fallback. The in-process broadcaster is single-instance only; a multi-instance deployment requires a shared broker before claiming cross-instance realtime delivery.
- Public APIs may retain visible completed Events as read-only history, but must always derive `saleStatus='closed'`; cancelled Events remain hidden and terminal.
- Draft without orders may be permanently deleted. Draft is not cancelled.
- Publishing and showing a published/ongoing Event require at least one active, valid Ticket Type.
- `checkin_start_at` must be on the same Vietnam calendar date as `events.start_time` and at least 2 hours before Event start; `checkin_end_at` must be after check-in start and no later than Event end. Staff assignment and conflict detection use this actual check-in window, not the Event presentation window. Enforce this in Admin UI, backend service validation and the schema constraint—never rely on the browser alone.
- Ticket sales must close by check-in end: the Event `sales_end_at <= checkin_end_at` (`chk_events_sales_before_checkin_end`, `409/400 SALES_AFTER_CHECKIN_END`) and every Ticket Type's effective sales end (own or inherited) `<= events.checkin_end_at` (triggers, `TICKET_SALES_AFTER_CHECKIN_END`); a ticket sold after the gates close could never be used. Moving check-in end earlier is refused while a tier still sells past it. Readiness reports `SALES_END_AFTER_CHECKIN_END`. The Admin form suggests sales end = show start (latest allowed: check-in end); Public sale state and Checkout are unchanged because the stored window already satisfies the rule.
- A visible published/ongoing Event must never lose its final active valid Ticket Type. Hide the Event or activate a replacement tier first.
- Hiding controls public visibility only; it does not erase orders or automatically mutate Ticket Type intent.
- Venue exclusivity: a non-cancelled Event occupies the venue over the closed interval `[checkin_start_at, end_time]`; touching boundaries conflict and only `cancelled` frees the slot (`409 VENUE_SCHEDULE_CONFLICT`, enforced in the service under the `platform_settings` lock and by the trigger). Draft Events count. Event creation/update never accepts typed `venue/address/city/venueCapacity`; a new Event copies the platform venue (`409 VENUE_NOT_CONFIGURED` until configured). Existing Events keep their snapshot; `syncVenue` re-applies the current venue only for a Draft/published Event with no pending/confirmed Order or issued Ticket (published also needs `confirmPublicVenueChange`).
- Fixtures and tests that create Events directly must respect the same rule (one concert per time slot; at most one Event "ongoing now", so `seed:admin-demo` and `seed:workflows` do not share a database).
- Ticket capacity must not exceed venue capacity. It cannot fall below reserved + sold inventory.
- A Ticket Type referenced by an order is never hard-deleted. Pause it instead.
- Price cannot change after reservation or sale. Close the old tier and create a new one.
- Public availability must be decided by Event status/visibility, Ticket Type active state, sales window, and remaining inventory on the server—not UI labels alone.

## Cancellation safety
- Cancellation is one database transaction: hide/cancel Event, close tiers, release pending holds, cancel pending payments/orders, invalidate issued QR tickets, create refund records for confirmed orders, and queue email logs.
- Email delivery is asynchronous and retryable. A mail provider failure must not roll back the cancellation.
- A cancellation-email worker must claim rows transactionally (`FOR UPDATE SKIP LOCKED` or an equivalent atomic claim), commit the claim before calling SMTP, use a lease/stale-processing recovery rule, and prevent an obsolete attempt from overwriting a newer result. Do not claim a batch with an unlocked `SELECT` followed by a broad update.
- Refund records are a simulated audit workflow for this course project. Only an authorized Admin action/test fixture may advance their state; the UI and email must distinguish “đã ghi nhận/yêu cầu hoàn tiền mô phỏng” from a real provider refund.
- Preserve Orders, Order Items, Tickets, Payments, Check-in Logs, Email Logs, and Refunds for audit history.

## Staff operation safety
- `GET /api/staff/events` offers only active assignments to published/ongoing Events within the actual check-in window and before Event end. Keep upcoming/preparing/history in the existing separate `/api/staff/assignments` scope, never in scan choices; the check-in service remains authoritative for every request.
- Gate-wide counters come from `GET /api/staff/events/:eventId/attendance` (read-only, same access rule as the scan choices, `admitted` uses the Reports admission predicate). Scan results may carry `ticket.ticketTypeName` (purchase snapshot read with the unlocked lookup; the lock order Event -> Order -> Ticket is unchanged, never sent for WRONG_EVENT).
- There is no offline admission: a ticket is valid only after the server answers. While the browser is offline the scanner disables camera and manual entry and shows "TẠM DỪNG SOÁT VÉ"; never cache ticket credentials on a device or let a holder in on a local guess. Gate outages are handled operationally (backup network, Admin-approved manual procedure).
- Filtering closed Events in the UI is not an authorization control. Every scan still verifies active Staff, active assignment, Event lifecycle/check-in window, confirmed Order, valid Ticket and atomic `issued -> checked_in` transition on the backend.

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
- Admin Events keeps **Dạng thẻ**, **Danh sách**, **Lịch** and **Kanban** views over the same filtered collection (`lib/admin-events-view.ts` `filterEvents`/`eventCounts`, one predicate for cards and rows). Switching views is local presentation state only, must not navigate or refetch, and must preserve search/status/category filters. Every view exposes the same lifecycle-safe actions and disabled rules (`components/admin/events/eventActions.ts`); storing the user's last view locally is allowed, but API data remains the source of truth. The calendar groups by the Vietnam start day. Kanban drag (`@dnd-kit/core`, pointer and keyboard) only *proposes* the two Admin transitions, Draft → Published (when ready) and Published/Ongoing → Cancelled, through the same confirmation dialogs as the menu (`kanbanDrop`); cards never move optimistically, every other drop is refused with a reason, and Ongoing/Completed stay server-owned by the clock. `?focus=<id>` opens the Event detail panel (Dashboard, task bell and Ctrl/⌘+K links); `?create=1` opens the create form once and is then removed from the URL (setup guide).
- Category segments are `all`, `active` and `inactive`: **Tổng danh mục**, **Đang hoạt động**, **Đã vô hiệu hóa**. “Sự kiện liên kết” is informational unless its click behavior and exact predicate are explicitly designed.
- Event segments follow the persisted lifecycle exactly: `all`, `draft`, `published`, `ongoing`, `completed`, `cancelled`. Labels are **Tổng sự kiện**, **Bản nháp**, **Đã công bố**, **Đang diễn ra**, **Đã kết thúc**, **Đã hủy**. Do not merge statuses into a card if the user needs to inspect them separately; do not infer state from dates on the client when the API already supplies effective status.
- Ticket Type segments describe Ticket Type state/inventory: **Tổng hạng vé**, **Đang bán/đang hoạt động**, **Tạm dừng**, **Hết vé**, and optionally **Có vé đang giữ**. `draft`, `published`, `ongoing`, `completed`, `cancelled` belong to the parent Event, not to a Ticket Type. If the Hạng vé screen needs those labels, use them only to filter the Event browser/sidebar, then filter tiers within the selected Event by tier predicates such as `isActive`, `availableQuantity`, `reservedQuantity` and `soldQuantity`.
- Admin, Staff and Login default to light with a Sáng/Tối switch (`components/shared/ThemeToggle.tsx`, `lib/ticketbox-theme.ts`; browser-local, namespaced by scope+account, light on blocked/corrupt storage). Admin also offers **Tự động** (Vietnam clock: light 06:00–17:59, dark 18:00–05:59; never the OS preference) through `ThemeMenu`; the default stays Sáng, a manual choice always wins, and Auto never flips the theme by itself because a gate is open (it only suggests Tối once per session). `index.html` paints a stored dark theme before React for Admin, Staff and Login (`data-tb-boot`, from `bootKey(scope)` / the Login key), and each area removes the marker on mount. Public has its own Sáng/Tối switch (Tài: `layouts/PublicLayout.tsx`, `styles/public-theme.css`, key `ticketbox-public-theme`, default Tối) that never reads the internal `--tb-*` tokens; do not merge the two systems.
- Admin redesign (`docs/admin-redesign-plan.md`): new pages use the design system in `client/src/components/admin/ui` (Button/IconButton, StatusBadge with `lib/admin-status.ts`, KpiCard, PageHeader, DataTable with `lib/admin-table.ts`, FilterBar, SlideOver, ConfirmDialog, Tabs/SegmentedControl, Menu, Switch, Toast via `notify`) and the shell in `layouts/AdminLayout.tsx` + `components/admin/shell` (floating Mint/Teal sidebar with profile, quick summary and logout, collapsible; slim topbar with search, setup guide (see below), task bell and theme; badges from `hooks/useAdminSignals.ts`; Ctrl/⌘+K). Admin palette overrides live in `styles/admin/tokens.css` (Mint/Teal Bento for the whole internal side: Admin, `/login` and the Staff portal; the template colours were darkened where text fell under 4.5:1, see the file header), component CSS in `styles/admin/ui.css`, shell in `styles/admin/shell.css`; review components at `/admin/_ui`. Never style a raw `<button>` for an action, never hard-code hex in components, and keep Radix `asChild` children free of function-valued `className` (the Slot stringifies it). Legacy page CSS (`legacy.css`, `theme.css`) remains only until each page is migrated. All three read the same tokens in `client/src/styles/ticketbox-tokens.css` (`--tb-*`); write new styles with tokens, never new hex colours, and check both themes. Scopes: `.admin-room`, `.staff-portal-room`, `.login-page` (`data-theme`) and `body[data-admin-appearance]` / `body[data-staff-appearance]` (value `light|dark`) for portals, set and cleaned up by the layouts. Admin CSS lives in `client/src/styles/admin/` (`theme.css` overrides, `legacy.css` old layouts, one file per page), Staff in `styles/staff/`, Login in `styles/auth/`. Tailwind colour utilities are remapped to tokens inside the Admin/Staff scopes (Tailwind v4 compiles them to `var(--color-*)`). Connected components live in `client/src/components/admin`. Public pages never read these tokens. No decorative background images, glow, blur or continuous animation behind operational tables. Preserve covers/logo/QR.
- **Admin visual system (canonical, Bửu 18/10/2026).** The Tổng quan page (`/admin`, `pages/admin/AdminDashboardPage.tsx`) is the reference every Admin page follows; when a page is rebuilt it must match it, not invent a new look:
  - Colour: only the Mint/Teal tokens in `styles/admin/tokens.css` (canvas `--tb-bg` #EEF2F1, white cards, teal `--tb-accent` #287A64 pills/buttons, card titles `--tb-heading` #286A58, subtitles `--tb-secondary`, sidebar `--tb-nav-*`, data colours `--tb-chart-*`/`--tb-ring-*`). The template's lighter teal/greys were darkened on purpose for ≥ 4.5:1 text; do not "restore" them. Both themes must keep working.
  - Layout: `PageLayout` → `PageHeader` (title, short description, meta "Cập nhật lúc…", one primary/secondary action) → `BentoGrid` of `BentoCard`s (`components/admin/ui/Bento.tsx`: 12 columns, gap 20px, card radius 18px, soft shadow instead of borders, teal title + secondary subtitle, actions top-right). Spans collapse at 1280px and 760px automatically.
  - Controls: pill groups via `SegmentedControl` (teal group, white selected pill), primary actions teal pills, status as coloured text/dot or `StatusBadge` pills, tables with a rounded `--tb-surface-2` header row, mini charts via `Gauge`/`DonutRing`/`SparkBars` with the value always written as text.
  - Data honesty: every number, chart and control must be backed by a real API field; omit (or disable with a reason) anything without data, and label money as "mô phỏng".
  - Verify each rebuilt page like the reference: both themes × 1440/1024/768/390, 0 low-contrast, 0 text < 12px, no horizontal page scroll.
  - Product voice: UI text is written for the venue operator (Admin), gate Staff and buyers using a real product; never mention implementation, APIs or where a number comes from (keep that in code comments and docs). The required "mô phỏng" label for payment/refund stays.
- Setup guide "Bắt đầu với TicketBox" (Bửu, `components/admin/shell/SetupGuide.tsx` + `lib/admin-setup-guide.ts`, topbar button): six steps in the order the server requires (venue → selectable Category under the scope → Event → active valid Ticket Type → publish → first Staff assignment), each derived only from existing Admin APIs (`/admin/platform-settings`, `/admin/categories`, `/admin/events`, dashboard summary); no new endpoint/schema and never a permission check. A step the server would refuse is shown locked with its reason; actions deep-link (`/admin/events?create=1`, `/admin/ticket-types?eventId=…&setup=1`, `/admin/events?focus=…`, `/admin/staff?assignEvent=…`). It auto-opens at most once per browser session while unfinished, never over a URL with query parameters, and the Admin may turn auto-open off (browser-local per account). The Staff step is done after the first assignment to a published Event; later unstaffed Events stay in the task bell. Header and footer stay fixed, only the step list scrolls.
- Layout stability (Admin, Staff, Login): a section click must switch the page within ~300 ms and the page frame must not move while data loads. Keep `scrollbar-gutter: stable` on both shells, lazy pages loaded inside the shell (Suspense in the layout) through `routes/page-loaders.ts` and preloaded by `usePreloadPages` (React Router 7 otherwise keeps the old page on screen during a chunk download), scroll reset per pathname, `PageHeader meta={null}` while unknown, skeletons no taller than the loaded line, aspect-ratio media with `overflow: hidden`, and blocks that arrive from a separate request mounted in their final place rather than pushing others down. Routing is a data router (`client/src/routes/router.tsx`, route-level `lazy`), so `components/shared/RouteProgress.tsx` (Admin/Staff/Login shells only, never Public) shows a progress bar while a page chunk downloads. Measure with `npm run audit:layout` in `client` against a disposable stack, and before a release against `npm run build` + `npm run preview`; `tests/layout-stability.test.cjs` guards the invariants.
- Readability floor: no text under 12px in Admin; Staff gate controls are at least 48px with verdicts written in words (`components/checkin/scan-verdict.ts`: only `SUCCESS` reads "CHO VÀO"; a missing result is never shown as accepted). Check contrast ≥ 4.5:1 in both themes for any new UI, including portaled dialogs.
- Summary filters must be connected to actual pages, not merely exported. Avoid duplicate summary cards/status tabs. Do not present Dashboard metrics as filters when the destination does not represent the same segment. Preserve pending-request guards and focus/scroll restoration for nested Admin dialogs; use existing dialog primitives rather than CSS-only modal changes.
- Admin font preferences use `client/src/lib/admin-appearance.ts` and Settings: system/Arial/Georgia, 14/15/17px, preview/reset; localStorage is namespaced by account ID, browser-local, not cross-device. Blocked/corrupt storage falls back safely. Do not introduce a font API/schema, CSS zoom or fixed-height text boxes. Portaled forms must inherit the same scale.
- On narrow screens, confine table overflow to its panel, allow compact metric grids and keep sidebar navigation operable. Validate 1440/768/390px, keyboard focus/return, large font and native select contrast.
- Logs/Reports default to **all Events**: `eventId` is optional, the Event picker and data are server-paginated, and Excel renders the Admin-bound snapshot being viewed (random id, 15-minute TTL, at most 20 per Admin, in memory; another Admin, an unknown or an expired id all answer `410 SNAPSHOT_EXPIRED`; changed filters answer `409 SNAPSHOT_FILTER_MISMATCH`). "All" means every non-Draft Event including terminal and zero-activity ones. Ratios come from summed numerators/denominators (`report.metrics.ts`), never from averaging per-Event percentages; keep time bases and independent money aggregates. Do not label one Event's totals as "Tất cả", use Staff endpoints for Admin filters, invent scan-method fields, or export QR tokens/hashes; Staff permissions and schema are unchanged. This expanded Khôi's module at the user's request: it needs Khôi's review before merge. Order-code search is a separate Tài task.
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
- Use `.agents/skills/ticketbox-admin-ui` for approved Admin/Staff/Login appearance tasks and Admin font preferences. It never authorizes backend/schema/security changes or Public restyling, and an Admin-only task must not restyle Staff.
- Use `.agents/skills/ticketbox-music-workflows` for a specific concert-domain/catalogue, purchase, assignment, check-in or reporting task; read only its relevant workflow reference, not every module by default.
- Use `.agents/skills/ticketbox-event-safety` for Event, Ticket Type, Order, refund, or cancellation work.
- Use `.agents/skills/ticketbox-verify` before handing off a code change.
- Read the selected skill completely and follow its referenced checklist before editing.
