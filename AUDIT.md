# PayPilot AI — Completion Audit

## Baseline verified before changes

- Next.js production build starts and `/api/health` returns `{ "ok": true }`.
- One-click demo login creates an isolated demo workspace.
- Dashboard metrics are calculated from PostgreSQL records, not hardcoded totals.
- All five agents return an orchestrated plan.
- Unauthenticated financial APIs return `401`.
- PayPal configuration is independent from demo mode. The codebase uses OAuth 2.0 and Orders API v2; no sandbox credentials were available in this environment.
- Gemini is called only when a server-side key exists; the deterministic, database-grounded assistant works without it.

## Issues found and resolution plan

| Area | Issue found | Resolution |
| --- | --- | --- |
| Cash flow | API supported 7/30/90 days, not the required 30/60/90 comparison and forecast persistence | Add 60-day forecast, retain 7-day option, persist generated forecasts and expose all horizons |
| Invoices | Drafts could not have their line items edited; client/detail validation was incomplete | Add validated draft editing and stricter create/update checks |
| Invoice Agent | No exact-duplicate guard for new invoices | Add client + total + issue-window duplicate detection |
| Expense Agent | Category was always manually selected; anomaly coverage was limited | Add deterministic categorisation and unusual-spend insight |
| Actions | Chat actions existed, but there was no durable approval/execution history for coordinated workflows | Add a persistent action centre with pending/approved/completed/dismissed states |
| Notifications | Some payment and CRUD events were logged as agent activity but did not create user notifications | Add persistent notifications and retain activity logging |
| PayPal | Capture was verified and idempotent, but there was no standalone order-status sync endpoint | Add server-side order status lookup/synchronisation |
| Security | Sensitive routes had no abuse throttling | Add bounded in-memory fixed-window rate limiting for auth, assistant and PayPal routes |
| Submission | No professional README, license, env template, test report or source archive | Add submission documentation, screenshots, setup instructions and a secrets-free ZIP |

## External credential limitations

- **PayPal Sandbox:** real OAuth/order creation/approval/capture cannot be completed without `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Demo transactions are explicitly simulated and never settle invoices or change recorded cash.
- **Gemini:** natural-language polishing requires `GEMINI_API_KEY` (or a supported Google AI key alias). Without it, responses use the deterministic financial engine and the UI says so.

## Additional defects caught by end-to-end testing

- CRUD helpers returned `NextResponse` validation errors inside successful `200/201` wrappers. All data routes now return the helper response with its real status (`400/401/403/404/409/429`).
- Assistant client matching compared the whole sentence to the client name. It now finds an existing client by full name or company inside the request, while still requiring a real price before drafting.
- The password-reset link token was not consumed by the form. The reset page now passes the URL token to the form; generate/reset/login was retested.
- Settings form defaults were populated during render. They now load through an effect.

No existing working feature is intentionally removed by this completion pass.
