---
name: ticketbox-admin-ui
description: Build or change TicketBoxQR Admin, Staff or Login UI with the shared light/dark tokens, scoped styles, page-specific layouts, accessible dialogs and measured contrast. Not for backend rules, schema, auth/security, or Public restyling.
---

# TicketBox Admin / Staff / Login UI

Read the target page, its client service and its stylesheet before editing. Paths are repository-relative. Canonical design decisions and results: `docs/project-guide/07-venue-reports-theme.md`.

## Scope
- **Use for:** appearance and behaviour of `/login`, `/admin/*`, `/staff/*`: layout, states, filters, dialogs, theme, readability.
- **Never for:** Home, Event list/detail, Checkout, Order, ticket pages (Tài), API contracts, schema, authentication/authorization, check-in/QR rules. Report a missing endpoint instead of faking numbers. Load `ticketbox-event-safety` if availability/lifecycle changes and `ticketbox-verify` before handoff.

## Verified source map
- Tokens: `client/src/styles/ticketbox-tokens.css` (`--tb-*`, light + dark). Imported first in `client/src/index.css`.
- Admin: shell `client/src/layouts/AdminLayout.tsx`; overrides `styles/admin/theme.css`, shared pieces `styles/admin/foundations.css`, old layouts `styles/admin/legacy.css`, per-page `styles/admin/{categories,dashboard,events,ticket-types,staff,orders,checkins,reports,event-scope,settings}.css` (each imported by its page). Components `client/src/components/admin/{EventScopeSelect,EventCoverUploader}.tsx` (everything else lives in `components/admin/ui`), Settings `components/admin/settings/*` + `lib/admin-settings.ts` (`styles/admin/settings.css`), Events `components/admin/events/*` + `lib/admin-events-view.ts`/`lib/admin-event-form.ts`, Ticket Types `components/admin/ticket-types/*` + `lib/admin-ticket-types.ts` (`styles/admin/ticket-types.css`), Staff `components/admin/staff/*` + `lib/admin-staff.ts` (`styles/admin/staff.css`), Categories `components/admin/categories/*` + `lib/admin-category-view.ts` (`styles/admin/categories.css`), Orders (Tài, UI only) `components/admin/orders/*` + `lib/admin-orders.ts` (`styles/admin/orders.css`), Check-in Logs (Khôi) `pages/admin/AdminCheckinLogsPage.tsx` + `components/admin/checkins/*` + `lib/admin-checkin-logs.ts` (`styles/admin/checkins.css`), Reports (Khôi) `pages/admin/AdminReportsPage.tsx` + `lib/admin-reports.ts` (`styles/admin/reports.css`), shared `lib/admin-date-range.ts` and `styles/admin/event-scope.css`, all rebuilt on the Bento reference.
- Staff (Mint/Teal since 19/10/2026; `styles/admin/tokens.css` also covers `.staff-portal-room`): `layouts/StaffLayout.tsx` (floating header, connection pill, shift data shared through `hooks/useStaffShell.ts` every 30 s), `styles/staff/{theme,portal}.css` (`sp-*` classes; section bar pinned to the bottom below 768px), `components/staff/*` (`ConnectionPill`, `StaffEmptyState`, `CameraCheck`, `GateAttendanceBar`), `hooks/useWakeLock.ts`, `components/checkin/*` (`scan-verdict.ts` incl. `CHECKIN_LABELS`; `EventScanner` terminal with sound/vibration via `hooks/useScanFeedback.ts`, fullscreen and a this-device session tally), helpers `lib/staff-portal.ts`, `pages/staff/{StaffOverviewPage,StaffCheckinPage,StaffEventsPage,StaffHistoryPage}.tsx`.
- Login: `pages/auth/LoginPage.tsx`, `pages/auth/ResetPasswordPage.tsx`, `components/auth/{AuthShell,LoginForm,ForgotPasswordForm,GoogleStaffLogin,StaffPendingCard}.tsx`, `lib/login-flow.ts`, `styles/auth/login.css`; uses the Mint/Teal tokens (`styles/admin/tokens.css` also covers `.login-page`). The Staff waiting pass re-sends the in-memory Google credential to `POST /auth/google` (never stored); the server still decides pending/approved/rejected.
- Theme: `lib/ticketbox-theme.ts` (`useTheme(scope, accountId)` → theme, preference light/dark/auto), `components/shared/ThemeToggle.tsx` (Staff/Login), `components/admin/ui/ThemeMenu.tsx` (Admin). Font preference (Admin only): `lib/admin-appearance.ts` + Settings.
- Admin design system (redesign, `docs/admin-redesign-plan.md`): `components/admin/ui/*` + `styles/admin/{tokens,ui,shell}.css`, shell `components/admin/shell/*`, helpers `lib/admin-{format,status,table,gate}.ts`, live badges `hooks/useAdminSignals.ts`. Catalogue at `/admin/_ui` (not in the menu). Migrated pages use these only; legacy classes stay until a page is rebuilt.
- Services: `client/src/services/admin-*.service.ts`, `report.service.ts`, `checkin.service.ts`.

## Design rules
1. **Tokens only (Mint/Teal, `styles/admin/tokens.css`).** No new hex/rgb colours; use `var(--tb-*)` (surface, subtle, border, text, muted, accent, success/warning/danger and their `-soft/-border`). Status uses text/icon as well as colour. Amber (`--tb-stub`) is for ticket emphasis, pink (`--tb-live`) only for an Event happening now.
2. **Scopes.** Elements: `.admin-room`, `.staff-portal-room`, `.login-page` with `data-theme="light|dark"`. Portals (Radix dialogs/drawers) render in `<body>`, so also style via `body[data-admin-appearance]` / `body[data-staff-appearance]`; layouts set and clean up that attribute. Nothing may leak to Public or to another role.
3. **Light is the default**; dark is the same system at night. Persist with `useTheme` (scope + account). Never read the OS preference as the default.
4. **Tailwind colour utilities** in Admin/Staff components are remapped to tokens through `--color-*` inside the scopes; prefer semantic classes over new `text-slate-*` utilities. Inline style colours defeat theming: use classes.
5. **Readability.** Admin text ≥ 12px; Staff controls ≥ 48px, verdicts in words; body 15px Admin (14/17 preferences) and no fixed-height text boxes or CSS zoom.
6. **Follow the reference page.** Tổng quan (`/admin`, `pages/admin/AdminDashboardPage.tsx`) is the canonical Admin look (AGENTS "Admin visual system"): `PageLayout` → `PageHeader` → `BentoGrid`/`BentoCard` (white cards, 18px radius, soft shadow, teal title, secondary subtitle), teal pill `SegmentedControl`, mini charts with values as text. Keep each page’s purpose (tables stay tables, forms stay forms) inside that frame; do not invent another palette or card style. Never show a control or number without real data.
7. **Filters.** Follow the summary-filter contract in AGENTS.md: semantic buttons with `aria-pressed`, one predicate for count and rows, server totals for server-paginated lists, stable parent scope, contextual empty states.
8. **Dialogs.** Prefer the existing Radix primitives; nested Admin drawers/confirmations use `hooks/useDialogFocus.ts`; no duplicate mutation or dismissal while a request is pending; Escape closes and focus returns to the opener.
9. Vietnamese labels; enum/API values unchanged. Keep loading, empty, error, success and disabled states.

## Steps
1. Trace page → service → route → what the server actually allows (UI is not authorization).
2. Implement with tokens/components; add page CSS in the right `styles/` folder and import it from the page.
3. Add tests where logic exists: pure state/format helpers and presentational components are covered with `node --test` (see `client/tests/*.test.cjs`); service query strings are asserted.
4. Run `client`: `npm run lint`, `npm run build`, `node --test tests/*.test.cjs`.
5. Browser check against a **disposable** database (never the user's): seed, log in, then for each touched page, in **both themes** at **1440, 768 and 390px**: no horizontal page scroll (tables scroll inside their panel), text contrast ≥ 4.5:1 (3:1 for large text) including hover/disabled-excluded states, no text under 12px, keyboard order, visible focus, Escape/focus return, native `<select>` and date inputs readable, large font preference. Open every dialog/drawer of the page. Leave the area and confirm `body[data-*-appearance]` is gone and Public is unchanged.

## Acceptance criteria
- Lint, build and client tests pass; no new colour literal outside `ticketbox-tokens.css`.
- Both themes pass the browser checks above on the touched pages; no regression on untouched pages in the same role.
- No change to Public pages, API contracts, schema or permissions; any such need is reported, not implemented.
- States exist for loading, empty, zero-result, error (with retry) and pending/disabled.
- Report states what was verified in a browser versus only by build/tests, and what could not be run (real Google/SMTP/camera).
