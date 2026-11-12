# PayPilot AI

**Autonomous financial operations for freelancers, agencies and small businesses.**  
PayPal AI Hackathon 2026 submission.

PayPilot AI connects clients, projects, quotations, invoices, payments, expenses and cash-flow forecasting in one fintech workspace. Five specialist agents analyse the same real ledger and PayPal Pilot turns their findings into recommendations that require explicit owner approval.

## Problem statement

Small teams usually manage invoices in one tool, expenses in another, PayPal separately, and cash-flow forecasts in a spreadsheet. That makes overdue invoices easy to miss, project profitability hard to see and short-term cash risk difficult to anticipate. Most chatbots answer questions without reading the underlying financial records or carrying out a controlled workflow.

## Solution overview

PayPilot AI provides:

- A persistent financial ledger with user-scoped data access.
- Database-backed client, project, quotation, invoice, payment and expense workflows.
- **PayPal Orders API v2 integration code path**, independent of demo mode and requiring your sandbox credentials for end-to-end testing.
- A database-grounded financial assistant with optional **Gemini** reasoning.
- Five collaborating agents plus an orchestrator.
- A durable action centre with reasons, expected outcomes, approval status, execution status and history.
- Actual/expected/predicted values labelled separately throughout the product.
- PDF invoices, secure revocable share links, and PDF/CSV reports.
- Responsive desktop, tablet and phone interfaces.

## Key features

### Financial operations

- Register, complete business onboarding, sign in/out and reset passwords.
- Create and edit clients; inspect projects, invoices, payments, outstanding balances and on-time behaviour.
- Create projects with budgets and measure collected revenue, expenses, margin and budget use.
- Build quotations with multiple services, quantities, discounts and taxes; accept and convert them into invoices.
- Create and **edit draft invoices**, issue them, detect exact duplicates, download PDFs and create revocable share links.
- Record full or partial manual payments, reject overpayments and reconcile invoice status automatically.
- Record expenses with automatic category suggestions, recurring flags, project allocation and private PNG/JPG/PDF receipts (up to 2 MB).
- View monthly revenue/expense comparisons, profit, outstanding amounts, collection efficiency and financial health.

### Multi-agent intelligence

| Agent | Responsibilities |
| --- | --- |
| Invoice Agent | Validated invoice generation, duplicate detection, accepted-quotation conversion, tax/discount calculations, PDF and follow-up preparation |
| Payment Agent | PayPal order status, capture reconciliation, overdue detection, client payment behaviour and reminder drafts |
| Expense Intelligence Agent | Automatic categorisation, unusual-spend detection, recurring-cost analysis, category trends and reduction suggestions |
| Cash Flow Prediction Agent | Probability-weighted collections, current burn rate, 7/30/60/90-day forecasts, shortages and visible assumptions |
| Business Intelligence Agent | Profitability, revenue trends, client concentration, financial health and recommendations |
| PayPal Pilot orchestrator | Routes questions and data to the relevant agents, combines their results and prepares owner-approved actions |

The assistant handles revenue, overdue clients, payment delays, expense analysis, expected collections, outstanding balances, affordability scenarios, reminder drafting, business summaries and invoice approval cards. It **does not invent an invoice price**: an explicit amount or accepted quotation total is required.

### Autonomous workflow examples

1. **Overdue invoice:** detect overdue balance → analyse client history → prepare reminder → owner approves → owner executes → reminder draft and activity history saved. No email is claimed or sent without an email provider.
2. **Payment reconciliation:** create order → buyer approves → backend captures → verify PayPal response → save transaction → update invoice → refresh metrics and notifications.
3. **Cash-flow risk:** analyse expected collections and expenses → detect a projected shortage → recommend a review → owner approves → warning saved to Notifications.
4. **Expense intelligence:** save expense → suggest category → attach receipt if needed → update project profitability and reports → analyse unusual spend.

## Verification status and AI/payment modes

These modes are intentionally distinct. The repository does **not** claim that real PayPal or Gemini tests ran without credentials.

| Mode | What happens | Verification in this submission |
| --- | --- | --- |
| Actual PayPal sandbox transaction | Server obtains OAuth token, creates an Orders v2 order, redirects to PayPal, captures and verifies the response, then records a real sandbox transaction ID | Code path reviewed. **Not executed here because no PayPal credentials were configured.** |
| Simulated demo transaction | A `DEMO-*` order is created only after explicit confirmation and stored with method `paypal_demo` and status `SIMULATED` | Tested: it never marks an invoice paid, never changes recorded cash/revenue and cannot create a duplicate capture |
| Gemini-powered response | The server sends the authenticated business's ledger context and the deterministic draft to Gemini for grounded natural-language reasoning | Adapter reviewed. **Not executed here because no Gemini key was configured.** |
| Deterministic AI fallback | The five agents calculate answers, forecasts, risks and actions directly from PostgreSQL records; no Gemini response is simulated | Tested through assistant questions, all five agents, orchestration and approval workflows |

## PayPal integration

Server code: `src/lib/paypal.ts` and `src/app/api/paypal/[action]/route.ts`.

### Real sandbox workflow

1. Create and issue an invoice. PayPilot calculates its total and balance server-side.
2. Open **Payments** and choose the invoice under **Collect a payment with PayPal**.
3. The backend obtains an OAuth 2.0 access token using the server-only client credentials.
4. `POST /v2/checkout/orders` creates the order with the exact outstanding balance and currency.
5. The user is redirected to PayPal's returned approval URL.
6. After approval, PayPal returns to `/payments?paypal=success&invoice=...&token=...`.
7. Click **Verify & capture payment**. The backend checks that the order belongs to that user's invoice and calls `POST /v2/checkout/orders/{orderId}/capture`.
8. PayPilot accepts only `COMPLETED`, validates currency and amount, locks the invoice, checks for an existing order/payment and saves the transaction atomically.
9. The invoice becomes `paid` or `partially_paid`; transaction ID, amount, timestamp, method, order ID and status are stored. Metrics, notifications and activity history update.
10. Duplicate capture attempts return the existing record and never create a second payment.

Cancelled or uncompleted orders never mark an invoice paid. `POST /api/paypal/status` performs a read-only order lookup without changing the invoice. Secrets are never included in browser bundles.

### Demo mode versus sandbox

With no PayPal credentials, the UI clearly shows **Demo mode**. Creating a demo order requires explicit simulation confirmation. A simulated capture:

- is labelled `SIMULATED` and uses method `paypal_demo`;
- never marks an invoice paid;
- never changes recorded cash or revenue;
- remains idempotent;
- is separate from real sandbox orders.

Set the environment variables below to use the actual sandbox path instead.

## System architecture

```text
Browser (React 19 / TypeScript / Tailwind / Recharts)
        │ HTTP-only session cookie
        ▼
Next.js App Router server components + REST route handlers
        ├── Authentication and per-user authorisation
        ├── Shared CRUD + financial calculation engine
        ├── PayPal OAuth / Orders v2 / capture / status sync
        ├── Gemini adapter (optional) + deterministic agent engine
        ├── PDF invoices and PDF/CSV reports
        └── Approval-gated action executor
        ▼
PostgreSQL via Drizzle ORM
        users · businesses · clients · projects · quotations · invoices
        payments · expenses · receipts · forecasts · insights
        financial actions · activities · notifications · chat history
```

The ledger is always loaded for the authenticated user. Public access is limited to a random, revocable share token for one invoice and its PDF.

## Technology stack

- **Frontend:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Recharts, Lucide icons
- **Backend:** Node.js, Next.js route handlers (REST)
- **Database:** PostgreSQL, Drizzle ORM, Drizzle Kit schema push
- **Authentication:** scrypt password hashes, random per-user salts, expiring HTTP-only sessions
- **AI:** Gemini API when configured; deterministic database-grounded multi-agent engine otherwise
- **Payments:** PayPal OAuth 2.0 and Orders API v2
- **Documents:** pdf-lib for invoice and report PDFs; CSV generation for tabular reports

## Screenshots

![Financial overview](docs/screenshots/overview.png)

![Autonomous action centre](docs/screenshots/action-centre.png)

![AI finance assistant](docs/screenshots/assistant.png)

![PayPal payments](docs/screenshots/payments.png)

![Cash-flow forecasts](docs/screenshots/cash-flow.png)

![Mobile overview](docs/screenshots/mobile-overview.png)

## Installation

### Requirements

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 14 or newer
- Optional: PayPal Developer sandbox application and Google AI Studio API key

```bash
git clone <your-repository-url>
cd paypilot-ai
npm install
cp .env.example .env
# Create the database named in DATABASE_URL, then apply the schema:
npx drizzle-kit push
npm run dev
```

Open `http://localhost:3000`.

Production:

```bash
npm run typecheck
npx next typegen
npm run lint
npm run build
npm run start
```

## Environment variables

Copy `.env.example`; never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Drizzle |
| `APP_URL` | Recommended in production | Public origin used for PayPal return/cancel URLs and invoice share links |
| `PAYPAL_MODE` | No | `sandbox` (default) or `live` |
| `PAYPAL_ALLOW_LIVE` | No | Must be `true` **and** `PAYPAL_MODE=live` to reach live PayPal; otherwise the code deliberately stays on sandbox. Defaults to `false` |
| `PAYPAL_CLIENT_ID` | Real PayPal only | Server-side PayPal application client ID |
| `PAYPAL_CLIENT_SECRET` | Real PayPal only | Server-side PayPal application secret |
| `PAYPAL_SANDBOX_CLIENT_ID` | Alternative | Alias for sandbox client ID |
| `PAYPAL_SANDBOX_CLIENT_SECRET` | Alternative | Alias for sandbox secret |
| `GEMINI_API_KEY` | Optional | Enables Gemini response reasoning/polishing |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Alternative | Supported Gemini key alias |
| `GOOGLE_API_KEY` | Alternative | Supported Gemini key alias |

### PayPal sandbox configuration

1. Sign in to the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Create a sandbox application and copy its client ID and secret into `.env`.
3. Keep `PAYPAL_MODE=sandbox` and `PAYPAL_ALLOW_LIVE=false`, then restart the server. Live payments require two deliberate opt-ins: `PAYPAL_MODE=live` **and** `PAYPAL_ALLOW_LIVE=true`. Setting only `PAYPAL_MODE=live` still uses sandbox, preventing accidental real charges.
4. Create an invoice and use the workflow above. Approve with a **sandbox buyer** account, not a live PayPal account.
5. Confirm that the returned capture is `COMPLETED`, the invoice is paid and a real transaction ID appears in payment history.

Do not place PayPal secrets in `NEXT_PUBLIC_*` variables.

### Gemini configuration

Create a key in Google AI Studio and set `GEMINI_API_KEY` in `.env`, then restart. Without it, the application remains functional and labels the deterministic reasoning engine in the assistant and Settings. Financial facts come from the ledger in both modes.

## Demo account

Choose **Explore the live demo** on the landing page, **Or explore the preloaded demo workspace** on the sign-in page, or visit `/api/auth/demo`.

No password is required. Each new visitor receives an isolated demo account with sample clients, projects, quotations, invoices, expenses and completed payment history. Demo records are labelled throughout. A regular account can start empty or load demo data during onboarding or Settings.

## Database setup

The schema is in `src/db/schema.ts`. Apply additive schema changes with:

```bash
npx drizzle-kit push
```

Tables cover users, sessions, password resets, businesses, clients, projects, quotations/items, invoices/items, payments, expenses, private receipts, forecast snapshots, insights, agent activities, notifications, chat messages and financial actions. Unique indexes protect user/document numbers, share tokens and PayPal order idempotency.

## Testing

With the app running on port 3000:

```bash
node scripts/test-api.mjs
```

The script creates isolated test users and verifies registration, onboarding, login/logout, client/project creation, quotation totals and conversion, draft editing, duplicate prevention, PDFs, partial/full payments, PayPal demo safeguards, idempotency, expenses, private receipts, action approval/execution, 30/60/90-day forecasts, all five agents, orchestration, reports and cross-user isolation.

For browser tests, run these commands **from the project root** so Node can resolve Playwright from the local `node_modules` directory:

```bash
npm install --no-save playwright
npx playwright install --with-deps chromium
node scripts/test-ui.mjs
```

Browser checks cover the action centre, UI draft editing, assistant responses, 60-day forecast, desktop/phone pages and overflow at 320, 390 and 768 px. See `TESTING.md` for the verified report and external-credential limitations.

## Security and validation

- Every financial route requires an authenticated user; ownership checks apply to invoices, orders, receipts and actions.
- Passwords use scrypt with per-user salts; sessions are random, expiring and HTTP-only.
- Server-side client/date/item/tax/discount/payment validation and real HTTP error statuses.
- Duplicate invoice and PayPal order protection; payment capture uses a transaction and row lock.
- Rate limits on authentication, assistant, action, PayPal and receipt routes (single-instance fixed window; use Redis for multi-instance deployment).
- Receipt MIME/size restrictions and user-scoped downloads.
- Secrets are read only on the server. No financial database dump or `.env` is included in the submission ZIP.

## Limitations and future improvements

- A real sandbox capture requires your PayPal credentials and buyer account; it cannot be claimed or tested in this credential-free environment.
- Gemini responses require an API key. The deterministic fallback is intentional, not a simulated Gemini response.
- Email delivery is not configured. Reminder execution produces a saved draft/notification, not a claim that an email was sent.
- The in-memory rate limiter should move to Redis for a multi-instance production deployment.
- Forecasts are estimates, not financial advice or guaranteed outcomes. They assume probability-weighted existing invoices and recent burn, with no unrecorded future sales/costs.
- Future work: email/webhook delivery, PayPal webhooks for asynchronous reconciliation, bank feeds, double-entry accounting and production object storage for receipts.

## Repository files

- [`AUDIT.md`](AUDIT.md) — baseline audit and issue resolutions
- [`TESTING.md`](TESTING.md) — tested behaviour and credential limitations
- [`scripts/test-api.mjs`](scripts/test-api.mjs) — end-to-end API/security workflow
- [`scripts/test-ui.mjs`](scripts/test-ui.mjs) — browser workflow and responsive checks
- [`docs/screenshots/`](docs/screenshots/) — screenshots captured from the running app
- [`deliverables/build-paypilot-ai-platform.zip`](deliverables/build-paypilot-ai-platform.zip) — source archive without dependencies, build output or secrets

## License

MIT — see [`LICENSE`](LICENSE).
