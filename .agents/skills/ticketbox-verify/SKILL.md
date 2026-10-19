---
name: ticketbox-verify
description: Run the standard TicketBoxQR client and server quality checks after TypeScript, React, Express, database, or shared-contract changes and summarize failures without hiding them.
---

# TicketBox Verify

Run `scripts/verify.ps1` from PowerShell. Use `-Scope client`, `-Scope server`, or the default `all`. It runs server `typecheck`, `build`, `test` and client `lint`, `build`.

Also run by hand when the change touches them:
- Client logic/theme/services: `node --test tests/*.test.cjs` in `client`.
- Server unit tests (`npm test`) skip MySQL-backed suites. For the full suite create a **disposable** database named `ticketboxqr_test_*` and run `node scripts/verify-ticket-email.mjs` in `server` (two Vitest passes: without, then with the ticket-credential and report integration suites). A refused/skipped suite is not a pass.
- Schema change: clean-install `database/migrations/001_initial_schema.sql` only on a disposable database, then `npm run seed`, `npm run seed:workflows`, `npm run db:verify`. Never run these against the user's `ticketboxqr`.
- UI change: browser check per `ticketbox-admin-ui` (both themes; 1440/768/390px), plus `npm run audit:layout -- --width=<1440|768|390>` in `client` against the disposable stack (credentials via `AUDIT_*` env only) when the change touches a shell, a page frame, loading states or images.

Do not use force flags, automatically modify dependency versions, or suppress failures. Report the first failing command with its actual error, plus what was not run (real Google, SMTP, camera, other MySQL versions) so unverified behaviour is never presented as verified.
