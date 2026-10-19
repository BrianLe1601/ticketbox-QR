---
name: ticketbox-verify
description: Run the standard TicketBoxQR client and server quality checks after TypeScript, React, Express, database, or shared-contract changes and summarize failures without hiding them.
---

# TicketBox Verify

Run `scripts/verify.ps1` from PowerShell. Use `-Scope client`, `-Scope server`, or the default `all`. It runs server `typecheck`, `build`, `test` and client `lint`, `build`.

Also run by hand when the change touches them:
- Client logic/theme/services: `node --test tests/*.test.cjs` in `client`.
- Server unit tests (`npm test`) refuse the MySQL-backed suites on the normal database (checkout, report, ticket-credential, venue-schedule integration files fail with "requires a disposable ticketboxqr_test_* database"); that is expected, but it is not a pass. For the full suite run `node scripts/verify-ticket-email.mjs` in `server` with `DB_*` pointing at a MySQL user allowed to create `ticketboxqr_test_*` (or a throwaway instance): it creates a fresh `ticketboxqr_test_<time>` database, runs two Vitest passes (own-Event suites, then `seed:workflows` + fixture suites), `db:verify`, and drops the database.
- Schema change: clean-install `database/migrations/001_initial_schema.sql` only on a disposable database, then `npm run seed`, `npm run seed:workflows`, `npm run db:verify`. Never run these against the user's `ticketboxqr`.
- UI change: browser check per `ticketbox-admin-ui` (both themes; 1440/768/390px), plus `npm run audit:layout -- --width=<1440|768|390>` in `client` against the disposable stack (credentials via `AUDIT_*` env only) when the change touches a shell, a page frame, loading states or images.

Do not use force flags, automatically modify dependency versions, or suppress failures. Report the first failing command with its actual error, plus what was not run (real Google, SMTP, camera, other MySQL versions) so unverified behaviour is never presented as verified.
