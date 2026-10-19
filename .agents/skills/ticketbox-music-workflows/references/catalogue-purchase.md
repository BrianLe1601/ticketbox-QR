# Catalogue and purchase

## Bửu: genre → concert → tier
UI: `client/src/pages/admin/AdminCategoriesPage.tsx`, `AdminEventsPage.tsx`, `AdminTicketTypesPage.tsx`; client services `admin-categories.service.ts`, `admin-events.service.ts`, `admin-ticket-types.service.ts` under `client/src/services`.

Backend families: `server/src/modules/categories/admin-categories.*.ts`, `events/admin-events.*.ts`, `ticket-types/admin-ticket-types.*.ts` (routes/schema/controller/service/repository). Admin mounts: `/api/admin/categories`, `/api/admin/events`, `/api/admin/ticket-types`.

Single venue: `server/src/modules/platform-settings/*` (`/api/admin/platform-settings`: GET, PUT `/venue`, PUT `/category-scope`; Admin form in `components/admin/settings/SystemSettings.tsx` on Settings (tab Hệ thống)). Venue name/address/city/capacity are never typed per Event: create/edit schemas reject them (400) and the service copies the platform values. Capacity checks use that venue capacity. Events may not overlap on `[checkin_start_at, end_time]` (closed interval; Draft counts, Cancelled frees the slot): service check under `platform_settings FOR UPDATE` plus BI/BU triggers as backstop; error `VENUE_SCHEDULE_CONFLICT`. Venue change affects new Events; Draft without Orders/Tickets may sync, published without sales needs confirmation, sold/issued/completed stay untouched. Lock order starts `platform_settings -> Event -> Order -> Ticket Type -> Ticket`. If the DB lacks the new tables the API answers 503 `PLATFORM_SCHEMA_UPGRADE_REQUIRED` (clean-install on a disposable DB only).

Categories carry `kind` (`music`/`other`); scope `music_only` (default) or `all` is stored in `platform_settings`. New Event or category change must pick a selectable category (`CATEGORY_NOT_MUSIC` otherwise); legacy Events keep their category. Seeds: 4 music genres (Pop/Rock/EDM/Acoustic) + 5 legacy `other`, never deleted. Public `getCategories` shape is unchanged. Details: `docs/project-guide/07-venue-reports-theme.md`.

Input: configured active genre, schedule/capacity/cover and tiers. Publication still requires readiness. Preserve referenced slug/history, capacity/price rules and last-active-tier. Event lifecycle is not tier state. Check-in same Vietnam day and two-hour lead remain canonical; assignment uses check-in interval.

Fixtures: `server/src/database/seed-venue.ts` (platform venue; seeds use it, placeholder only if empty), `seed-admin-demo.ts` + `admin-demo-presentation-fixtures.ts` (10 concerts, one per day from tomorrow, UTC+7), `seed-workflows.ts` (+23 days on-sale). The demo and workflow seeds are mutually exclusive for the single venue (a venue conflict reports a friendly error). Never execute destructive cleanup to restyle UI. Legacy SQL default categories are not silently migrated.

Tests: `server/tests/admin-events.time-validation.test.ts`, `admin-demo-presentation-fixtures.test.ts`, `event-sales.test.ts`, `platform-settings.routes.test.ts`, `admin-categories.schema.test.ts`, and (disposable MySQL only) `venue-schedule.integration.test.ts` for concurrency/triggers. Manually check missing-cover/tier publication, inactive genre, capacity, last tier and mixed statuses. Single schema `database/migrations/001_initial_schema.sql` is destructive clean install, not a safe upgrade.

## Tài: verified email → held Order → original QR/email
UI: `client/src/pages/public/CheckoutPlaceholder.tsx`, `OrderPaymentPage.tsx`, Home/Event List/Detail; services `order.service.ts`, `event.service.ts` under client/src/services.

Backend: `server/src/modules/checkout/checkout.*.ts`; `server/src/services/email-verification.service.ts`, `public-email-security.service.ts`. Creation at `/api/checkout/orders` requires session-bound verified email and Idempotency-Key. Reserve after valid phone + OTP on “Tiếp tục mua vé”, not first at payment. Concurrent loser receives SOLD_OUT; ten-minute hold remains.

QR/email: `server/src/services/qr.service.ts`, `qr-encryption.service.ts`, `ticket-email.service.ts`; `server/src/modules/tickets/ticket-email.repository.ts`, `server/src/jobs/ticket-email.job.ts`. Preserve original QR/hash and immutable ciphertext. Provider outside transaction, no credentials in URL/logs. Payment converts this Order's hold, never reserves new capacity.

Retrieval: `client/src/components/event/TicketRetrievalForm.tsx`; `server/src/modules/tickets/ticket-retrieval.*.ts`, POST `/api/tickets/retrieval`. Neutral response, action-specific reCAPTCHA/cooldown, confirmed Orders + eligible issued Tickets, no terminal/ended Event resend. Retrieval itself does not require OTP/account.

Tests in server/tests: `email-verification.test.ts`, `public-email-security.test.ts`, `ticket-retrieval.test.ts`, `ticket-mail.test.ts`. MySQL checkout/credential suites only on explicitly disposable `ticketboxqr_test_*`; mock tests do not prove concurrency or inbox delivery.
