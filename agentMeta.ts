import { titleCase } from "@/lib/format";

export const AGENTS = [
  { key: "invoice", name: "Invoice Agent", role: "Quotations, invoices, tax and PDF generation" },
  { key: "payment", name: "Payment Agent", role: "Collections, reminders and PayPal reconciliation" },
  { key: "expense", name: "Expense Intelligence Agent", role: "Categorisation, anomalies and cost reduction" },
  { key: "cashflow", name: "Cash Flow Prediction Agent", role: "7/30/60/90-day liquidity forecasting" },
  { key: "bi", name: "Business Intelligence Agent", role: "Risk, margin and client behaviour analysis" },
  { key: "coordinator", name: "PayPilot", role: "Orchestrates the agents and presents action plans" },
] as const;

export function agentDisplayName(key: string): string {
  const found = AGENTS.find((agent) => agent.key === key);
  return found ? found.name : titleCase(key);
}
