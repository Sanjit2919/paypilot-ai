import { generateText, aiConfigured } from "@/lib/ai";
import {
  buildClientProfiles,
  buildForecast,
  buildProjectProfiles,
  computeHealth,
  computeMetrics,
  generateInsights,
  round2,
  todayIso,
  type Ledger,
} from "@/lib/finance";
import { formatMoney, titleCase } from "@/lib/format";
import type { AgentActionCard, AssistantReply } from "@/lib/types";

export const AGENTS = [
  {
    key: "invoice",
    name: "Invoice Agent",
    role: "Quotations, invoices, tax & PDF generation",
    accent: "blue",
  },
  {
    key: "payment",
    name: "Payment Agent",
    role: "Collections, reminders & PayPal reconciliation",
    accent: "green",
  },
  {
    key: "expense",
    name: "Expense Intelligence Agent",
    role: "Categorisation, anomaly & cost reduction analysis",
    accent: "amber",
  },
  {
    key: "cashflow",
    name: "Cash Flow Prediction Agent",
    role: "7/30/60/90-day liquidity forecasting",
    accent: "violet",
  },
  {
    key: "bi",
    name: "Business Intelligence Agent",
    role: "Risk, margin & client behaviour analysis",
    accent: "rose",
  },
] as const;

export type OrchestratorPlan = {
  headline: string;
  whatHappened: string;
  why: string;
  whatNext: string;
  actions: {
    agent: string;
    title: string;
    detail: string;
    requiresApproval: boolean;
    action?: AgentActionCard;
  }[];
  agentsInvolved: string[];
  generatedAt: string;
  aiGenerated: boolean;
};

export function buildOrchestratorPlan(ledger: Ledger): OrchestratorPlan {
  const metrics = computeMetrics(ledger);
  const forecast = buildForecast(ledger, metrics, 30);
  const health = computeHealth(metrics, forecast);
  const insights = generateInsights(ledger, metrics, forecast);
  const clientProfiles = buildClientProfiles(ledger);
  const openInvoices = ledger.invoices
    .map((row) => ({ row }))
    .filter(({ row }) => row.status !== "draft" && row.status !== "void")
    .map(({ row }) => {
      const paid = ledger.payments
        .filter((p) => p.invoiceId === row.id && p.status === "completed")
        .reduce((s, p) => s + Number(p.amount), 0);
      return { row, balance: round2(Number(row.total) - paid) };
    })
    .filter((i) => i.balance > 0.005);

  const overdue = openInvoices.filter((i) => i.row.dueDate < todayIso());
  const risky = clientProfiles.filter((c) => c.riskLevel === "high");
  const topCategory = (() => {
    const totals = new Map<string, number>();
    for (const e of ledger.expenses) totals.set(e.category, round2((totals.get(e.category) ?? 0) + Number(e.amount)));
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  })();

  const agentsInvolved = new Set<string>(["coordinator", "cashflow", "bi"]);
  if (overdue.length) agentsInvolved.add("payment");
  if (openInvoices.length) agentsInvolved.add("invoice");
  if (ledger.expenses.length) agentsInvolved.add("expense");

  const whatHappened = forecast.shortageDate
    ? `Cash Flow Agent projects a liquidity shortfall around ${forecast.shortageDate}, with the balance bottoming at ${formatMoney(forecast.lowestBalance, ledger.business.currency)} (estimate). ${overdue.length} invoice(s) worth ${formatMoney(metrics.overdueAmount, ledger.business.currency)} are overdue.`
    : `Cash Flow Agent projects a positive balance of ${formatMoney(forecast.projectedBalance, ledger.business.currency)} over the next 30 days (estimate). ${openInvoices.length} invoice(s) worth ${formatMoney(metrics.outstandingAmount, ledger.business.currency)} remain open.`;

  const whyParts: string[] = [];
  if (overdue.length) {
    const worst = [...overdue].sort((a, b) => a.row.dueDate.localeCompare(b.row.dueDate))[0];
    whyParts.push(
      `Collections are the main driver: ${worst.row.number} for ${ledger.clients.find((c) => c.id === worst.row.clientId)?.name ?? "a client"} is ${Math.abs(
        Math.round((new Date(todayIso()).getTime() - new Date(worst.row.dueDate).getTime()) / 86_400_000),
      )} days past due.`,
    );
  }
  if (topCategory) {
    whyParts.push(
      `${titleCase(topCategory[0])} is your largest cost base at ${formatMoney(topCategory[1], ledger.business.currency)}.`,
    );
  }
  if (risky.length) {
    whyParts.push(`${risky[0].name} has a ${risky[0].onTimeRate}% on-time payment rate, which lowers expected collections.`);
  }
  if (!whyParts.length) whyParts.push("No material anomalies were detected in the current dataset.");

  const whatNext = forecast.shortageDate
    ? `If nothing changes, the projected balance stays below zero from ${forecast.shortageDate}. Collecting the overdue invoices would add ${formatMoney(metrics.overdueAmount, ledger.business.currency)} and remove the shortfall in this model.`
    : `If collections continue at the current pace, the balance should stay above ${formatMoney(Math.max(0, forecast.lowestBalance), ledger.business.currency)}. New expenses or delayed payments would change this estimate.`;

  const actions: OrchestratorPlan["actions"] = [];
  if (overdue.length) {
    actions.push({
      agent: "payment",
      title: `Send payment reminders for ${overdue.length} overdue invoice(s)`,
      detail: `Payment Agent prepared reminder drafts for ${overdue
        .slice(0, 3)
        .map((i) => i.row.number)
        .join(", ")}. Nothing is sent until you approve.`,
      requiresApproval: true,
      action: {
        id: "send_reminders",
        label: "Approve & queue reminders",
        kind: "payment_reminder",
        requiresApproval: true,
        payload: { invoiceIds: overdue.map((i) => i.row.id) },
      },
    });
  }
  const draftQuotation = ledger.quotations.find((q) => q.status === "accepted");
  if (draftQuotation) {
    actions.push({
      agent: "invoice",
      title: `Convert accepted quotation ${draftQuotation.number} into an invoice`,
      detail: "Invoice Agent can issue the invoice with the same line items, tax and due date.",
      requiresApproval: true,
      action: {
        id: "convert_quotation",
        label: "Approve & create invoice",
        kind: "convert_quotation",
        requiresApproval: true,
        payload: { quotationId: draftQuotation.id },
      },
    });
  }
  if (topCategory && metrics.expenseThisMonth > 0) {
    actions.push({
      agent: "expense",
      title: `Review ${titleCase(topCategory[0])} spend (${formatMoney(topCategory[1], ledger.business.currency)})`,
      detail: "Expense Intelligence Agent flagged this as the largest category. Set a monthly cap or renegotiate.",
      requiresApproval: false,
    });
  }
  actions.push({
    agent: "cashflow",
    title: `Re-run the 90-day forecast after your next collection`,
    detail: "Cash Flow Agent will re-project liquidity using the updated payment data.",
    requiresApproval: false,
  });

  return {
    headline: forecast.shortageDate
      ? `Action needed: projected cash shortage around ${forecast.shortageDate}`
      : `Cash flow is stable for the next 30 days (estimate)`,
    whatHappened,
    why: whyParts.join(" "),
    whatNext,
    actions,
    agentsInvolved: [...agentsInvolved],
    generatedAt: new Date().toISOString(),
    aiGenerated: aiConfigured(),
  };
}

function contextBlock(ledger: Ledger): string {
  const metrics = computeMetrics(ledger);
  const forecast = buildForecast(ledger, metrics, 30);
  const clients = buildClientProfiles(ledger);
  const projects = buildProjectProfiles(ledger);
  const open = ledger.invoices
    .map((row) => {
      const paid = ledger.payments
        .filter((p) => p.invoiceId === row.id && p.status === "completed")
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        number: row.number,
        client: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "Unassigned",
        total: Number(row.total),
        balance: round2(Number(row.total) - paid),
        dueDate: row.dueDate,
        status: row.status,
      };
    })
    .filter((i) => i.balance > 0.005);
  const categoryTotals = new Map<string, number>();
  for (const e of ledger.expenses) categoryTotals.set(e.category, round2((categoryTotals.get(e.category) ?? 0) + Number(e.amount)));

  return [
    `Business: ${ledger.business.name} (${ledger.business.businessType}, ${ledger.business.industry}, ${ledger.business.country}). Currency: ${ledger.business.currency}.`,
    `Metrics: revenue=${metrics.totalRevenue.toFixed(2)}, expenses=${metrics.totalExpenses.toFixed(2)}, netProfit=${metrics.netProfit.toFixed(2)}, cashBalance=${metrics.cashBalance.toFixed(2)}, outstanding=${metrics.outstandingAmount.toFixed(2)}, overdue=${metrics.overdueAmount.toFixed(2)} (${metrics.overdueCount} invoices), margin=${metrics.profitMargin.toFixed(1)}%, collectionRate=${metrics.collectionRate.toFixed(1)}%, runwayDays=${metrics.runwayDays}.`,
    `30-day forecast (estimate): projected=${forecast.projectedBalance.toFixed(2)}, lowest=${forecast.lowestBalance.toFixed(2)} on ${forecast.lowestDate}, shortageDate=${forecast.shortageDate ?? "none"}, expectedInflow=${forecast.expectedInflow.toFixed(2)}, expectedOutflow=${forecast.expectedOutflow.toFixed(2)}.`,
    `Open invoices: ${open.map((i) => `${i.number} ${i.client} ${i.balance.toFixed(2)} due ${i.dueDate} (${i.status})`).join("; ") || "none"}.`,
    `Clients: ${clients.map((c) => `${c.name} paid=${c.paid.toFixed(2)} outstanding=${c.outstanding.toFixed(2)} onTime=${c.onTimeRate}% risk=${c.riskLevel}`).join("; ") || "none"}.`,
    `Projects: ${projects.map((p) => `${p.name} revenue=${p.revenue.toFixed(2)} expenses=${p.expenses.toFixed(2)} margin=${p.margin.toFixed(1)}%`).join("; ") || "none"}.`,
    `Expense categories: ${[...categoryTotals.entries()].map(([k, v]) => `${k}=${v.toFixed(2)}`).join(", ") || "none"}.`,
    `Recent expenses: ${ledger.expenses.slice(0, 8).map((e) => `${e.expenseDate} ${e.vendor || e.category} ${Number(e.amount).toFixed(2)}`).join("; ") || "none"}.`,
  ].join("\n");
}

function findClient(ledger: Ledger, name: string) {
  const needle = name.toLowerCase().trim();
  if (!needle) return null;
  return (
    ledger.clients.find((c) => c.name.toLowerCase() === needle || c.company.toLowerCase() === needle) ??
    ledger.clients.find((c) => needle.includes(c.name.toLowerCase()) || (c.company && needle.includes(c.company.toLowerCase()))) ??
    ledger.clients.find((c) => c.name.toLowerCase().includes(needle) || (c.company && c.company.toLowerCase().includes(needle))) ??
    null
  );
}

function explicitAmount(question: string): number | null {
  const match = question.replaceAll(",", "").match(/(?:[$₹€£]\s*)?(\d+(?:\.\d+)?)\s*(k)?\b/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]) * (match[2] ? 1000 : 1);
  return Number.isFinite(amount) && amount > 0 ? round2(amount) : null;
}

export function buildAssistantReply(ledger: Ledger, question: string): AssistantReply {
  const q = question.toLowerCase();
  const metrics = computeMetrics(ledger);
  const forecast = buildForecast(ledger, metrics, 30);
  const currency = ledger.business.currency;
  const clientProfiles = buildClientProfiles(ledger);
  const openInvoices = ledger.invoices
    .map((row) => {
      const paid = ledger.payments
        .filter((p) => p.invoiceId === row.id && p.status === "completed")
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        id: row.id,
        number: row.number,
        clientId: row.clientId,
        clientName: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "Unassigned",
        balance: round2(Number(row.total) - paid),
        dueDate: row.dueDate,
        status: row.status,
      };
    })
    .filter((i) => i.balance > 0.005);

  const overdue = openInvoices.filter((i) => i.dueDate < todayIso());
  const actions: AgentActionCard[] = [];
  let reply = "";
  let agents: string[] = ["coordinator"];

  const wantsInvoice = /(generate|create|make|draft|issue).*(invoice|quotation)/.test(q) || /invoice for/.test(q);
  const wantsAffordability = /(afford|can i spend|should i spend|safe to spend)/.test(q);
  const wantsReminderDraft = /(generate|write|draft|professional).*(reminder|follow.?up)|reminder.*(message|email|text)/.test(q);
  const wantsExpected = /(expecting|expected|outstanding|owe me|total outstanding)/.test(q);
  const wantsSummary = /(summar|business performance|business health)/.test(q);
  const wantsReminder = /(follow.?up|remind|reminder|chase|overdue)/.test(q);
  const wantsExpense = /(expense|spend|spending|cost)/.test(q);
  const wantsCash = /(cash|shortage|forecast|predict|runway|liquidity|next month)/.test(q);
  const wantsClients = /(client|customer|who hasn|not paid|unpaid|owe)/.test(q);
  const wantsRevenue = /(earn|revenue|income|sales|this month)/.test(q);
  const wantsMargin = /(margin|profit|profitab|improve)/.test(q);

  if (wantsAffordability) {
    agents = ["coordinator", "payment", "cashflow", "bi"];
    const expense = explicitAmount(question);
    if (!expense) {
      reply = `Tell me the expense amount and I will compare it with your recorded cash and expected collections. Right now you have ${formatMoney(metrics.cashBalance, currency)} recorded cash and ${formatMoney(metrics.outstandingAmount, currency)} outstanding.`;
    } else {
      const afterExpense = round2(forecast.projectedBalance - expense);
      const affordable = afterExpense >= 0;
      reply = `Payment Agent found ${formatMoney(metrics.outstandingAmount, currency)} outstanding. Cash Flow Agent's 30-day estimate is ${formatMoney(forecast.projectedBalance, currency)} before the proposed ${formatMoney(expense, currency)} expense, leaving ${formatMoney(afterExpense, currency)}. ${affordable ? "The model stays positive, but this is an estimate, not spending approval or a guarantee." : "The model turns negative, so the safer action is to delay part of the spend or collect overdue invoices first."} Assumptions: no new sales, probability-weighted collections and current expense run-rate.`;
    }
  } else if (wantsReminderDraft) {
    agents = ["coordinator", "payment", "invoice"];
    const invoice = overdue[0] ?? openInvoices[0];
    if (!invoice) {
      reply = "There are no open invoices to remind a client about. Once you issue an invoice, I can draft a reminder using its real amount and due date.";
    } else {
      reply = `Subject: Friendly reminder for ${invoice.number}

Hello ${invoice.clientName},

This is a friendly reminder that invoice ${invoice.number} for ${formatMoney(invoice.balance, currency)} ${invoice.dueDate < todayIso() ? "was" : "is"} due on ${invoice.dueDate}. Please let us know if payment has already been arranged or if you need any details.

Thank you,
${ledger.business.name}

This is a draft only. Nothing has been sent.`;
      if (overdue.length) actions.push({ id: "send_reminders", label: "Approve reminder sequence", kind: "payment_reminder", requiresApproval: true, payload: { invoiceIds: overdue.map((item) => item.id) } });
    }
  } else if (wantsExpected) {
    agents = ["coordinator", "payment", "cashflow"];
    reply = `You have ${formatMoney(metrics.outstandingAmount, currency)} outstanding across ${openInvoices.length} open invoice(s). The 30-day model expects ${formatMoney(forecast.expectedInflow, currency)} after weighting each client's payment history. ${formatMoney(metrics.overdueAmount, currency)} is already overdue. These collections are estimates, not guaranteed income.`;
  } else if (wantsSummary) {
    agents = ["coordinator", "bi", "cashflow", "expense"];
    const health = computeHealth(metrics, forecast);
    const risky = clientProfiles.filter((client) => client.riskLevel === "high").map((client) => client.name);
    reply = `Business Intelligence summary: collected revenue ${formatMoney(metrics.totalRevenue, currency)}, expenses ${formatMoney(metrics.totalExpenses, currency)}, net profit ${formatMoney(metrics.netProfit, currency)} (${metrics.profitMargin.toFixed(1)}% margin). Recorded cash is ${formatMoney(metrics.cashBalance, currency)}, with ${formatMoney(metrics.outstandingAmount, currency)} outstanding. Health score ${health.score}/100 (${health.grade}). ${risky.length ? `Watch payment behaviour from ${risky.join(", ")}.` : "No client is currently classified high-risk."}`;
  } else if (wantsInvoice) {
    agents = ["coordinator", "invoice"];
    const target = findClient(ledger, q) ?? ledger.clients.find((client) => q.includes(client.company.toLowerCase())) ?? null;
    if (!target) {
      reply = "Tell me which existing client the invoice is for. I will use their database record rather than inventing client details.";
    } else {
      const accepted = ledger.quotations.find((quotation) => quotation.clientId === target.id && quotation.status === "accepted");
      const amount = accepted ? Number(accepted.total) : explicitAmount(question);
      if (!amount) {
        reply = `I found ${target.name} in your clients. What amount should the invoice charge? You can say “Generate an invoice for ${target.name} for ${ledger.business.currency === "INR" ? "₹" : "$"}5000”. I will not invent a price.`;
      } else {
        const description = accepted ? `Accepted quotation ${accepted.number}` : "Professional services";
        reply = `Invoice Agent prepared a draft for ${target.name} of ${formatMoney(amount, currency)} using ${accepted ? `accepted quotation ${accepted.number}` : "the amount in your request"}. Review and approve to create it; nothing has been issued.`;
        actions.push({
          id: accepted ? "convert_quotation" : "create_invoice",
          label: `Approve draft invoice for ${target.name}`,
          kind: accepted ? "convert_quotation" : "create_invoice",
          requiresApproval: true,
          payload: accepted ? { quotationId: accepted.id } : { clientId: target.id, description, amount, taxRate: ledger.business.taxRate },
        });
      }
    }
  } else if (wantsReminder || (wantsClients && overdue.length)) {
    agents = ["coordinator", "payment", "invoice"];
    if (!overdue.length) {
      reply = `Payment Agent found no overdue invoices. You have ${formatMoney(metrics.outstandingAmount, currency)} outstanding across ${openInvoices.length} open invoice(s), all within terms.`;
    } else {
      const total = round2(overdue.reduce((s, i) => s + i.balance, 0));
      reply = `Payment Agent identified ${overdue.length} overdue invoice(s) worth ${formatMoney(total, currency)}: ${overdue
        .slice(0, 4)
        .map((i) => `${i.number} (${i.clientName}, ${formatMoney(i.balance, currency)}, due ${i.dueDate})`)
        .join("; ")}. I can queue a polite reminder sequence — approval required before anything is sent.`;
      actions.push({
        id: "send_reminders",
        label: "Approve reminder sequence",
        kind: "payment_reminder",
        requiresApproval: true,
        payload: { invoiceIds: overdue.map((i) => i.id) },
      });
    }
  } else if (wantsExpense) {
    agents = ["coordinator", "expense"];
    const totals = new Map<string, number>();
    for (const e of ledger.expenses) totals.set(e.category, round2((totals.get(e.category) ?? 0) + Number(e.amount)));
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    reply = sorted.length
      ? `Expense Intelligence Agent analysed ${ledger.expenses.length} expense(s). Highest categories: ${sorted
          .slice(0, 4)
          .map(([k, v]) => `${titleCase(k)} ${formatMoney(v, currency)}`)
          .join(", ")}. This month you spent ${formatMoney(metrics.expenseThisMonth, currency)} versus ${formatMoney(metrics.expenseLastMonth, currency)} last month.`
      : "No expenses recorded yet. Add your first expense and I will start categorising and benchmarking your spend.";
  } else if (wantsCash) {
    agents = ["coordinator", "cashflow", "bi"];
    reply = forecast.shortageDate
      ? `Cash Flow Agent (estimate, not a guarantee) projects a shortage around ${forecast.shortageDate}: the balance dips to ${formatMoney(forecast.lowestBalance, currency)} versus ${formatMoney(forecast.startingBalance, currency)} today. Expected inflows of ${formatMoney(forecast.expectedInflow, currency)} are outweighed by ${formatMoney(forecast.expectedOutflow, currency)} of modelled outflow. Collecting ${formatMoney(metrics.overdueAmount, currency)} of overdue invoices would materially change this projection.`
      : `Cash Flow Agent projects a positive balance over the next 30 days: ${formatMoney(forecast.startingBalance, currency)} today to about ${formatMoney(forecast.projectedBalance, currency)} (estimate, ${forecast.confidence}% confidence). Lowest point is ${formatMoney(forecast.lowestBalance, currency)} on ${forecast.lowestDate}.`;
  } else if (wantsMargin) {
    agents = ["coordinator", "bi", "expense"];
    reply = `Business Intelligence Agent: net margin is ${metrics.profitMargin.toFixed(1)}% on ${formatMoney(metrics.totalRevenue, currency)} revenue and ${formatMoney(metrics.totalExpenses, currency)} expenses. To improve it: (1) collect ${formatMoney(metrics.overdueAmount, currency)} overdue, (2) cap your largest expense category, (3) raise pricing on new quotations by 5-10% given your ${metrics.avgDaysToPay}-day collection cycle.`;
  } else if (wantsRevenue) {
    agents = ["coordinator", "bi"];
    reply = `You earned ${formatMoney(metrics.revenueThisMonth, currency)} this month from completed payments, versus ${formatMoney(metrics.revenueLastMonth, currency)} last month. Lifetime collected revenue is ${formatMoney(metrics.totalRevenue, currency)} across ${metrics.totalClients} client(s).`;
  } else if (wantsClients) {
    agents = ["coordinator", "bi", "payment"];
    const risky = clientProfiles.filter((c) => c.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    reply = risky.length
      ? `Clients with open balances: ${risky
          .slice(0, 5)
          .map((c) => `${c.name} (${formatMoney(c.outstanding, currency)} open, ${c.onTimeRate}% on-time, risk ${c.riskLevel})`)
          .join("; ")}.`
      : "No client currently has an open balance. Every invoice is settled.";
  } else {
    agents = ["coordinator"];
    reply = `Here is your position: ${formatMoney(metrics.cashBalance, currency)} cash, ${formatMoney(metrics.outstandingAmount, currency)} outstanding (${formatMoney(metrics.overdueAmount, currency)} overdue), ${formatMoney(metrics.totalExpenses, currency)} total expenses and a ${metrics.profitMargin.toFixed(1)}% net margin. Health score ${computeHealth(metrics, forecast).score}/100. Ask me about revenue, overdue invoices, expenses, cash forecast or margin improvement.`;
  }

  return { reply, agents, actions };
}

export async function polishWithGemini(ledger: Ledger, question: string, fallback: AssistantReply): Promise<AssistantReply> {
  const generated = await generateText(
    "You are PayPilot AI, an autonomous finance assistant for small businesses. Answer using ONLY the supplied financial data. Be concise (max 130 words), specific with numbers, and never invent figures. Clearly label any forward-looking statement as an estimate. Do not claim to have sent emails or moved money.",
    `Financial data:\n${contextBlock(ledger)}\n\nBusiness owner question: ${question}\n\nDraft answer from the deterministic engine (use it as the factual basis):\n${fallback.reply}`,
    400,
  );
  if (!generated) return fallback;
  return { ...fallback, reply: generated };
}
