# Staff and gate reporting

## Bửu: personal Google Staff → approval → assignment
UI: `client/src/pages/auth/LoginPage.tsx`, `client/src/components/auth/GoogleStaffLogin.tsx`, `client/src/pages/admin/AdminStaffPage.tsx`; services `auth.service.ts`, `admin-staff.service.ts` under client/src/services.

Backend: `server/src/modules/auth/auth.*.ts`, `google-identity.service.ts`, `auth-session.repository.ts`; `server/src/modules/admin-staff/admin-staff.*.ts`. Google `/api/auth/google`; Admin `/api/admin/staff`.

First verified unknown Google subject creates pending/inactive Staff without app session. Admin reviews/approves, then assigns eligible concerts. Reject inactive/terminal/duplicate/conflicting assignment using closed check-in intervals. Deactivation revokes assignments/sessions first; preserve history. Never automatically link existing accounts by email.

Tests in server/tests: `google-staff-auth.test.ts`, `google-identity.test.ts`, `admin-staff.service.test.ts`, `admin-staff.routes.test.ts`. Real Google/DB acceptance remains separate.

Admin password reset (local Admin passwords only, Staff use Google): `POST /api/auth/password-reset/request` (same 202 for every email, mail after the response) and `/confirm` (stateless HMAC token, 30 min, single use, only in `/reset-password#token=` and JSON bodies). Code `server/src/modules/auth/password-reset-token.ts`, `auth.service.ts`; tests `password-reset.test.ts`, `password-reset-mail.test.ts`.

## Khôi: assigned concert → scan/manual → log
UI: `client/src/pages/staff/StaffEventsPage.tsx`, `StaffCheckinPage.tsx`, `StaffHistoryPage.tsx`, `client/src/components/checkin`; client `checkin.service.ts`.

Backend: `server/src/modules/checkins/checkin.*.ts`; GET `/api/staff/events`, POST/GET `/api/staff/events/:eventId/checkins`, read-only GET `/api/staff/events/:eventId/attendance` (`admitted`/`validTickets`/`remaining`, same access rule as scan choices, `admitted` uses the Reports admission predicate). Scan results may carry `ticket.ticketTypeName` (purchase snapshot, unlocked read, never for WRONG_EVENT). Derive identity from auth; active assignment/window, correct Event, confirmed Order and issued Ticket are required. Atomic Ticket update + SUCCESS log; business rejection commits log. Pre-service auth/validation/rate-limit failures are not persisted business scans.

Preserve ticketbox token/hash contract. No invented shared accounts or scan-method column. Result enums in `checkin.types.ts` unchanged. Hidden concert may serve existing buyers; terminal/ended concerts may not check in.

No offline admission: while the browser is offline the scanner disables camera and manual entry ("TẠM DỪNG SOÁT VÉ"); never cache ticket credentials on a device.

Tests: `server/tests/checkin.service.test.ts`, `checkin.repository.test.ts`, `checkin.routes.test.ts`, `staff-operations.test.ts`, `checkin.attendance.test.ts`; client `staff-portal.test.cjs`, `staff-scan.test.cjs`. Camera, Wake Lock and real concurrency require separate UAT on devices.

## Khôi: logs → metrics → Excel
UI `client/src/pages/admin/AdminCheckinLogsPage.tsx` (+ `components/admin/checkins/*`, `lib/admin-checkin-logs.ts`) and `client/src/pages/admin/AdminReportsPage.tsx` (+ `lib/admin-reports.ts`), shared `components/admin/EventScopeSelect.tsx` and `lib/admin-date-range.ts`, `client/src/services/report.service.ts`; Backend `server/src/modules/reports/report.*.ts` (routes/schema/controller/service/repository/export/metrics/snapshot). Admin `/api/admin/reports`, `/api/admin/checkins`, their `/export` endpoints. Staff history stays restricted (Admin-only router; Staff gets 403).

Scope: `eventId` is optional. Omitted = all non-draft Events (cap 2000, labelled “Tất cả sự kiện”); a single Event keeps the flat response plus `scope`, `rates`, `breakdown`, `snapshot`. Logs paginate on the server with a `checkin_logs.id` watermark so rows do not shift while paging; totals come from SQL aggregation, never from the current page. Event options are paginated, not truncated at 100, and include terminal and zero-activity Events.

Export: Excel is rendered from a server-memory snapshot (`report.snapshot.ts`: random 24-byte id, TTL 15 min, ≤20 per Admin, bound to the creating Admin). Expired = `410 SNAPSHOT_EXPIRED`; filter differs from the snapshot = `409 SNAPSHOT_FILTER_MISMATCH`. Snapshot `generatedAt` equals the displayed data's. Workbook uses SUM/IF formulas with cached results and a totals row outside the autofilter. Single-instance only; a multi-instance deployment needs shared storage first. View limiter 120/min, export 5/min.

Metrics/time bases: confirmed Orders/confirmed_at; issued Tickets/issued_at; distinct SUCCESS Tickets/checked_at; successful Payments/paid_at; completed Refunds/completed_at. Aggregate sources separately to avoid multiplied money. Ratios use total numerator/denominator (`report.metrics.ts`), not mean percentages. Date-filtered attendance may exceed 100%. Finance explicitly simulated.

Logs export max 10,000 matching rows, no raw QR/hash/ciphertext. Tests: `client/tests/report-service.test.cjs`, `server/tests/report.test.ts`, `report.routes.test.ts`, `report-export.test.ts`, and (disposable MySQL only) `report.integration.test.ts` which cross-checks totals against SQL, Admin/Staff access and snapshots. Mock SQL/export tests do not replace real-data reconciliation and browser QA.
