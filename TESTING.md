# PayPilot AI — Testing Report

## Environment tested

- Next.js 16.2.6 production build
- Node.js 22
- PostgreSQL via Drizzle ORM
- Chromium desktop and mobile viewports
- No PayPal or Gemini credentials were available in this sandbox

## Verified results

### API and security workflow — 52/52 passed

Run with the application on port 3000:

```bash
node scripts/test-api.mjs
```

Verified:

- Registration, onboarding persistence, login/logout and invalid-password rejection
- Password-reset link generation, token redemption and login with the new password
- Authenticated dashboard protection (`401` without a session)
- Client creation and project assignment
- Quotation creation with exact discount/tax calculations (test total: 2090.00)
- Accepted quotation conversion with line items preserved
- Invoice PDF generation with `application/pdf`
- Draft invoice creation, line-item editing, total recalculation and issue
- Exact duplicate invoice rejection (`409`) and missing-client rejection
- Partial and full payments, paid status and zero remaining balance
- Overpayment rejection
- Explicitly labelled demo order and read-only status synchronisation
- Demo capture confirmation requirement
- Simulated capture remains `SIMULATED`, never marks the invoice paid
- Capture idempotency and unchanged recorded cash after simulation
- Automatic expense categorisation (AWS/cloud hosting → software)
- Valid private receipt upload/download and invalid MIME-type rejection
- Overdue action recommendation with reason and expected outcome
- Approval status persisted before execution
- Approved reminder produces a saved draft, explicitly not an external email
- Notifications persist across requests
- 30-, 60- and 90-day forecast series and assumptions, all marked as estimates
- All five agents orchestrated, with severity, recommendation and supporting data
- Affordability scenario invokes Payment + Cash Flow + BI agents
- Expected collections grounded in actual outstanding invoices
- Assistant refuses to invent an invoice price
- Assistant creates an approval card for an explicit amount and executes after approval
- Profit-and-loss CSV and cash-flow PDF reports
- Cross-user invoice PDF denial, PayPal capture denial and empty data isolation

### Browser and responsive workflow — 24/24 passed

```bash
node scripts/test-ui.mjs
```

Verified:

- Persistent action centre and approval controls
- Draft editor opens, saves a changed description and returns it from the database
- Assistant answers through the Payment Agent
- 60-day forecast control is present
- No desktop runtime errors
- Overview, invoices, expenses, insights and assistant have no sideways overflow at 320 px, 390 px and 768 px
- No off-screen page buttons at those widths
- No runtime errors across tested devices

### Additional console layout verification — 25/25 passed

The pinned finance-loop console was checked at the middle and final stages on 320×568, 390×844, 412×915, 768×1024 and 1280×720 viewports. The console, labels, values and action button fit the viewport without horizontal overflow; normal phones use stacked left-aligned values and short phones use compact fixed-gutter columns.

### Documentation and submission-readiness checks — 21/21 passed

Verified separately: client edit/delete, demo seed endpoint, secure share-link opening and revocation, all six report types in both CSV and PDF formats, and assistant rate limiting (`429`). All six screenshot files were regenerated from the running application and validated as real PNGs (1440×900 desktop and 390×844 mobile). Every local README link resolves, and the external PayPal Developer Dashboard link returned HTTP 200.

PayPal mode unit checks passed: default remains `sandbox`; `PAYPAL_MODE=live` without the second opt-in still resolves to `sandbox`; only `PAYPAL_MODE=live` plus `PAYPAL_ALLOW_LIVE=true` resolves to `live`. No real PayPal request was made by these configuration-only tests.

ESLint completed with no errors or warnings.

## Production verification

The required final checks are run from the project root:

```bash
npx next typegen
npm exec tsc -- --noEmit --pretty false
npm run lint
npm run build
```

`build_and_start` is also used to bootstrap the database, build, start the production server and verify `/api/health`.

## External integrations: what was and was not tested

### PayPal

Verified in this environment:

- The sandbox-independent demo path is clearly labelled.
- Demo order creation, read-only status sync, explicit simulation confirmation, idempotency and invoice/cash non-settlement.
- Backend code uses OAuth 2.0 and Orders API v2 create/capture/status endpoints.
- Capture code requires `COMPLETED`, verifies order ownership, amount and currency, locks the invoice, rejects duplicates and stores the transaction atomically.

**Not testable without credentials:** a real PayPal OAuth token, real hosted approval page and real sandbox capture/transaction ID. Configure `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (or their sandbox aliases), then follow the exact judge workflow in `README.md`. No real sandbox success is claimed here.

### Gemini

The real Gemini adapter is present and uses the server-side key when configured. This sandbox had no key, so the deterministic financial reasoning engine was tested instead. The UI reports the active mode rather than claiming Gemini was used.

### Email

No email provider is configured. Reminder execution saves a professional draft and notification. It does not send or claim to send external communication.

## Data used by tests

The API script creates fresh users and records with timestamped email addresses. It does not require demo seed data and does not modify another user's financial records. The one-click demo uses a separate isolated seeded account for browser review.
