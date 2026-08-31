---
name: ticketbox-verify
description: Run the standard TicketBoxQR client and server quality checks after TypeScript, React, Express, database, or shared-contract changes and summarize failures without hiding them.
---

# TicketBox Verify

Run `scripts/verify.ps1` from PowerShell. Use `-Scope client`, `-Scope server`, or the default `all`.

Do not use force flags, automatically modify dependency versions, or suppress failures. Report the first failing command with its actual error. Database migrations require a separate MySQL smoke test and are not applied automatically by this script.
