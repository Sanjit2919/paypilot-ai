# PayPilot AI — Built With

This file documents the technologies used by the PayPilot AI project. It is intended for the public GitHub repository.

## Devpost "Built with" tags

Add these tags individually in the Devpost **Built with** field:

- PayPal
- PayPal Orders API
- OAuth 2.0
- Google Gemini
- Generative AI
- Multi-Agent AI
- Next.js
- React
- TypeScript
- Tailwind CSS
- Node.js
- PostgreSQL
- Drizzle ORM
- REST API
- Recharts
- pdf-lib

Only retain tags that correspond to functionality present in the submitted version.

## Technology stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend framework | Next.js 16 App Router | Application pages, layouts, and server-rendered experience |
| UI library | React 19 | Reusable interactive interface components |
| Language | TypeScript | Type-safe application development |
| Styling | Tailwind CSS 4 | Responsive interface styling |
| Backend | Node.js / Next.js route handlers | Server-side business logic and REST-style API endpoints |
| Database | PostgreSQL | Persistent business and financial records |
| ORM and schema tools | Drizzle ORM / Drizzle Kit | Database queries and schema management |
| Payments | PayPal OAuth 2.0 / Orders API v2 | PayPal order creation, approval, capture, and verification |
| AI | Google Gemini API (optional configuration) | AI-assisted conversational financial analysis |
| Agent workflows | Five specialist agents and an orchestrator | Invoice, payment, expense, cash-flow, and business intelligence workflows |
| Charts | Recharts | Financial dashboards and analytics visualisations |
| Documents | pdf-lib | Invoice and report PDF generation |
| Icons | Lucide React | Interface icons |

## Important implementation notes

- PayPal Sandbox credentials are required to demonstrate a real sandbox checkout and capture. Demo/simulated transactions must remain clearly labelled as simulated.
- A Gemini API key is required to demonstrate Gemini-powered responses. Without it, the application may use its deterministic financial-analysis fallback.
- Do not commit `.env`, `.env.local`, API keys, PayPal client secrets, database passwords, or other credentials to Git.
- The list above describes the repository's documented stack; verify each integration in the final build before claiming it in the Devpost submission.
