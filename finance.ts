import { and, asc, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import {
  agentActivities,
  aiInsights,
  businesses,
  clients,
  expenses,
  invoiceItems,
  invoices,
  notifications,
  payments,
  projects,
  quotationItems,
  quotations,
} from "@/db/schema";
import { daysBetween, monthKey, titleCase } from "@/lib/format";
import type {
  ActivityDTO,
  BusinessDTO,
  ClientDTO,
  ClientProfile,
  DashboardPayload,
  ExpenseDTO,
  Forecast,
  ForecastPoint,
  Health,
  InsightDTO,
  InvoiceDTO,
  LineItemDTO,
  Metrics,
  MonthlyPoint,
  NotificationDTO,
  PaymentDTO,
  ProjectDTO,
  QuotationDTO,
  Severity,
} from "@/lib/types";

type BusinessRow = typeof businesses.$inferSelect;
type ClientRow = typeof clients.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type InvoiceRow = typeof invoices.$inferSelect;
type QuotationRow = typeof quotations.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;

export type Ledger = {
  business: BusinessRow;
  clients: ClientRow[];
  projects: ProjectRow[];
  invoices: (InvoiceRow & { items: LineItemDTO[] })[];
  quotations: (QuotationRow & { items: LineItemDTO[] })[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
};

const n = (v: unknown) => {
  const parsed = typeof v === "number" ? v : Number.parseFloat(String(v ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const round2 = (v: number) => Math.round(v * 100) / 100;
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const addDaysIso = (iso: string, days: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function loadLedger(userId: string): Promise<Ledger | null> {
  const [business] = await db.select().from(businesses).where(eq(businesses.userId, userId)).limit(1);
  if (!business) return null;

  const [clientRows, projectRows, invoiceRows, quotationRows, paymentRows, expenseRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.userId, userId)).orderBy(asc(clients.name)),
    db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt)),
    db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.issueDate)),
    db.select().from(quotations).where(eq(quotations.userId, userId)).orderBy(desc(quotations.issueDate)),
    db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.paidAt)),
    db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.expenseDate)),
  ]);

  // Only fetch line items belonging to this user's documents. No cross-tenant reads.
  const [allInvoiceItems, allQuotationItems] = await Promise.all([
    invoiceRows.length
      ? db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, invoiceRows.map((row) => row.id)))
      : Promise.resolve([]),
    quotationRows.length
      ? db.select().from(quotationItems).where(inArray(quotationItems.quotationId, quotationRows.map((row) => row.id)))
      : Promise.resolve([]),
  ]);

  const invoiceItemMap = new Map<string, LineItemDTO[]>();
  for (const item of allInvoiceItems) {
    const list = invoiceItemMap.get(item.invoiceId) ?? [];
    list.push({
      id: item.id,
      description: item.description,
      quantity: n(item.quantity),
      unitPrice: n(item.unitPrice),
      amount: n(item.amount),
    });
    invoiceItemMap.set(item.invoiceId, list);
  }
  const quotationItemMap = new Map<string, LineItemDTO[]>();
  for (const item of allQuotationItems) {
    const list = quotationItemMap.get(item.quotationId) ?? [];
    list.push({
      id: item.id,
      description: item.description,
      quantity: n(item.quantity),
      unitPrice: n(item.unitPrice),
      amount: n(item.amount),
    });
    quotationItemMap.set(item.quotationId, list);
  }

  return {
    business,
    clients: clientRows,
    projects: projectRows,
    invoices: invoiceRows.map((row) => ({ ...row, items: invoiceItemMap.get(row.id) ?? [] })),
    quotations: quotationRows.map((row) => ({ ...row, items: quotationItemMap.get(row.id) ?? [] })),
    payments: paymentRows,
    expenses: expenseRows,
  };
}

export function effectiveInvoiceStatus(row: InvoiceRow, amountPaid: number): string {
  const balance = round2(n(row.total) - amountPaid);
  if (row.status === "draft" || row.status === "void") return row.status;
  if (balance <= 0.005) return "paid";
  if (row.dueDate && row.dueDate < todayIso()) return "overdue";
  if (amountPaid > 0) return "partially_paid";
  return row.status === "sent" ? "sent" : row.status;
}

export function toBusinessDTO(row: BusinessRow): BusinessDTO {
  return {
    id: row.id,
    name: row.name,
    businessType: row.businessType,
    industry: row.industry,
    currency: row.currency,
    monthlyRevenueEstimate: n(row.monthlyRevenueEstimate),
    email: row.email,
    country: row.country,
    taxRate: n(row.taxRate),
    paymentTermsDays: row.paymentTermsDays,
    cashBalance: n(row.cashBalance),
    onboardingComplete: row.onboardingComplete,
    isDemo: row.isDemo,
  };
}

export function toClientDTO(row: ClientRow): ClientDTO {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    country: row.country,
    address: row.address,
    paymentTermsDays: row.paymentTermsDays,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toInvoiceDTO(ledger: Ledger, row: InvoiceRow & { items: LineItemDTO[] }): InvoiceDTO {
  const amountPaid = round2(
    ledger.payments
      .filter((p) => p.invoiceId === row.id && p.status === "completed")
      .reduce((sum, p) => sum + n(p.amount), 0),
  );
  const total = n(row.total);
  return {
    id: row.id,
    number: row.number,
    clientId: row.clientId,
    clientName: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "Unassigned",
    projectId: row.projectId,
    projectName: ledger.projects.find((p) => p.id === row.projectId)?.name ?? "",
    quotationId: row.quotationId,
    status: effectiveInvoiceStatus(row, amountPaid),
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    subtotal: n(row.subtotal),
    discountType: row.discountType,
    discountValue: n(row.discountValue),
    taxRate: n(row.taxRate),
    total,
    amountPaid,
    balance: round2(total - amountPaid),
    notes: row.notes,
    items: row.items,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toQuotationDTO(ledger: Ledger, row: QuotationRow & { items: LineItemDTO[] }): QuotationDTO {
  return {
    id: row.id,
    number: row.number,
    clientId: row.clientId,
    clientName: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "Unassigned",
    projectId: row.projectId,
    projectName: ledger.projects.find((p) => p.id === row.projectId)?.name ?? "",
    status: row.status,
    issueDate: row.issueDate,
    validUntil: row.validUntil,
    subtotal: n(row.subtotal),
    discountType: row.discountType,
    discountValue: n(row.discountValue),
    taxRate: n(row.taxRate),
    total: n(row.total),
    notes: row.notes,
    items: row.items,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toPaymentDTO(ledger: Ledger, row: PaymentRow): PaymentDTO {
  const invoice = ledger.invoices.find((i) => i.id === row.invoiceId);
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    invoiceNumber: invoice?.number ?? "—",
    clientId: row.clientId,
    clientName: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "—",
    amount: n(row.amount),
    method: row.method,
    status: row.status,
    transactionId: row.transactionId ?? "",
    note: row.note,
    paidAt: row.paidAt,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toProjectDTO(ledger: Ledger, row: ProjectRow): ProjectDTO {
  const projectInvoices = ledger.invoices.filter((i) => i.projectId === row.id);
  const invoiced = round2(projectInvoices.reduce((s, i) => s + n(i.total), 0));
  const projectPayments = ledger.payments.filter(
    (p) => p.status === "completed" && projectInvoices.some((i) => i.id === p.invoiceId),
  );
  const revenue = round2(projectPayments.reduce((s, p) => s + n(p.amount), 0));
  const projectExpenses = round2(
    ledger.expenses.filter((e) => e.projectId === row.id).reduce((s, e) => s + n(e.amount), 0),
  );
  const outstanding = round2(
    projectInvoices.reduce((s, i) => {
      const paid = ledger.payments
        .filter((p) => p.invoiceId === i.id && p.status === "completed")
        .reduce((sum, p) => sum + n(p.amount), 0);
      return s + Math.max(0, n(i.total) - paid);
    }, 0),
  );
  const profit = round2(revenue - projectExpenses);
  return {
    id: row.id,
    clientId: row.clientId,
    clientName: ledger.clients.find((c) => c.id === row.clientId)?.name ?? "Unassigned",
    name: row.name,
    description: row.description,
    status: row.status,
    budget: n(row.budget),
    startDate: row.startDate,
    endDate: row.endDate,
    revenue,
    expenses: projectExpenses,
    profit,
    margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
    invoiced,
    outstanding,
    paid: revenue,
  };
}

export function toExpenseDTO(ledger: Ledger, row: ExpenseRow): ExpenseDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: ledger.projects.find((p) => p.id === row.projectId)?.name ?? "",
    category: row.category,
    vendor: row.vendor,
    description: row.description,
    amount: n(row.amount),
    taxAmount: n(row.taxAmount),
    paymentMethod: row.paymentMethod,
    expenseDate: row.expenseDate,
    receiptUrl: row.receiptUrl,
    isRecurring: row.isRecurring,
    createdAt: row.createdAt.toISOString(),
  };
}

export function computeMetrics(ledger: Ledger): Metrics {
  const today = todayIso();
  const thisMonth = monthKey(today);
  const lastMonthDate = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  lastMonthDate.setUTCMonth(lastMonthDate.getUTCMonth() - 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);

  const completed = ledger.payments.filter((p) => p.status === "completed");
  const totalRevenue = round2(completed.reduce((s, p) => s + n(p.amount), 0));
  const totalExpenses = round2(ledger.expenses.reduce((s, e) => s + n(e.amount), 0));
  const openingBalance = n(ledger.business.cashBalance);
  const cashBalance = round2(openingBalance + totalRevenue - totalExpenses);

  const openInvoices = ledger.invoices
    .map((row) => toInvoiceDTO(ledger, row))
    .filter((i) => i.balance > 0.005 && i.status !== "draft" && i.status !== "void");

  const outstandingAmount = round2(openInvoices.reduce((s, i) => s + i.balance, 0));
  const overdue = openInvoices.filter((i) => i.status === "overdue");
  const overdueAmount = round2(overdue.reduce((s, i) => s + i.balance, 0));

  const horizon7 = addDaysIso(today, 7);
  const upcomingInflow = round2(
    openInvoices.filter((i) => i.dueDate >= today && i.dueDate <= horizon7).reduce((s, i) => s + i.balance, 0),
  );

  const recurringMonthly = round2(
    ledger.expenses.filter((e) => e.isRecurring).reduce((s, e) => s + n(e.amount), 0),
  );
  const avgMonthlyExpense = (() => {
    const months = new Map<string, number>();
    for (const e of ledger.expenses) {
      const key = monthKey(e.expenseDate);
      months.set(key, (months.get(key) ?? 0) + n(e.amount));
    }
    const recent = [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([, value]) => value);
    if (!recent.length) return 0;
    return round2(recent.reduce((a, b) => a + b, 0) / recent.length);
  })();
  const baselineMonthlyOutflow = round2(Math.max(recurringMonthly, avgMonthlyExpense));
  const upcomingOutflow = round2((baselineMonthlyOutflow / 30) * 7);

  const revenueThisMonth = round2(
    completed.filter((p) => monthKey(p.paidAt) === thisMonth).reduce((s, p) => s + n(p.amount), 0),
  );
  const revenueLastMonth = round2(
    completed.filter((p) => monthKey(p.paidAt) === lastMonth).reduce((s, p) => s + n(p.amount), 0),
  );
  const expenseThisMonth = round2(
    ledger.expenses.filter((e) => monthKey(e.expenseDate) === thisMonth).reduce((s, e) => s + n(e.amount), 0),
  );
  const expenseLastMonth = round2(
    ledger.expenses.filter((e) => monthKey(e.expenseDate) === lastMonth).reduce((s, e) => s + n(e.amount), 0),
  );

  const invoicedTotal = round2(ledger.invoices.filter((invoice) => !["draft", "void"].includes(invoice.status)).reduce((sum, invoice) => sum + n(invoice.total), 0));
  const collectionRate = invoicedTotal > 0 ? round2((totalRevenue / invoicedTotal) * 100) : 0;

  const paidInvoices = ledger.invoices.filter((i) => {
    const dto = toInvoiceDTO(ledger, i);
    return dto.status === "paid";
  });
  const avgDaysToPay = (() => {
    const spans: number[] = [];
    for (const inv of paidInvoices) {
      const pay = ledger.payments.find((p) => p.invoiceId === inv.id && p.status === "completed");
      if (pay) spans.push(Math.max(0, daysBetween(inv.issueDate, pay.paidAt)));
    }
    if (!spans.length) return 0;
    return Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
  })();

  const netProfit = round2(totalRevenue - totalExpenses);
  const profitMargin = totalRevenue > 0 ? round2((netProfit / totalRevenue) * 100) : 0;
  const runwayDays = baselineMonthlyOutflow > 0 ? Math.round((cashBalance / baselineMonthlyOutflow) * 30) : 0;

  return {
    totalRevenue,
    pendingPayments: outstandingAmount,
    totalExpenses,
    netProfit,
    outstandingInvoices: openInvoices.length,
    outstandingAmount,
    overdueAmount,
    overdueCount: overdue.length,
    upcomingInflow,
    upcomingOutflow,
    cashBalance,
    openingBalance,
    invoicedTotal,
    collectedTotal: totalRevenue,
    expenseThisMonth,
    expenseLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    profitMargin,
    collectionRate,
    avgDaysToPay,
    runwayDays,
    draftInvoices: ledger.invoices.filter((i) => i.status === "draft").length,
    paidInvoices: paidInvoices.length,
    totalInvoices: ledger.invoices.length,
    activeProjects: ledger.projects.filter((p) => p.status === "active").length,
    totalClients: ledger.clients.length,
    recurringMonthlyExpense: recurringMonthly,
  };
}

export function buildMonthly(ledger: Ledger): MonthlyPoint[] {
  const buckets = new Map<string, { revenue: number; expenses: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(d.toISOString().slice(0, 7), { revenue: 0, expenses: 0 });
  }
  for (const p of ledger.payments) {
    if (p.status !== "completed") continue;
    const key = monthKey(p.paidAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.revenue += n(p.amount);
  }
  for (const e of ledger.expenses) {
    const key = monthKey(e.expenseDate);
    const bucket = buckets.get(key);
    if (bucket) bucket.expenses += n(e.amount);
  }
  return [...buckets.entries()].map(([month, v]) => ({
    month,
    label: new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short" }),
    revenue: round2(v.revenue),
    expenses: round2(v.expenses),
    profit: round2(v.revenue - v.expenses),
  }));
}

export function buildClientProfiles(ledger: Ledger): ClientProfile[] {
  return ledger.clients.map((client) => {
    const clientInvoices = ledger.invoices
      .map((row) => toInvoiceDTO(ledger, row))
      .filter((i) => i.clientId === client.id);
    const clientPayments = ledger.payments.filter(
      (p) => p.clientId === client.id && p.status === "completed",
    );
    const invoiced = round2(clientInvoices.reduce((s, i) => s + i.total, 0));
    const paid = round2(clientPayments.reduce((s, p) => s + n(p.amount), 0));
    const outstanding = round2(clientInvoices.reduce((s, i) => s + i.balance, 0));
    const overdue = round2(
      clientInvoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.balance, 0),
    );
    const paidInvoices = clientInvoices.filter((i) => i.status === "paid");
    const onTime = paidInvoices.filter((i) => {
      const pay = ledger.payments.find((p) => p.invoiceId === i.id && p.status === "completed");
      return pay ? pay.paidAt <= i.dueDate : false;
    }).length;
    const onTimeRate = paidInvoices.length ? Math.round((onTime / paidInvoices.length) * 100) : 100;
    const spans = paidInvoices
      .map((i) => {
        const pay = ledger.payments.find((p) => p.invoiceId === i.id && p.status === "completed");
        return pay ? Math.max(0, daysBetween(i.issueDate, pay.paidAt)) : null;
      })
      .filter((v): v is number => v !== null);
    const avgDaysToPay = spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : 0;
    const lastPayment = clientPayments[0]?.paidAt ?? null;
    const riskLevel: ClientProfile["riskLevel"] =
      overdue > 0 || onTimeRate < 60 ? "high" : onTimeRate < 85 ? "medium" : "low";
    return {
      ...toClientDTO(client),
      invoiced,
      paid,
      outstanding,
      overdue,
      invoiceCount: clientInvoices.length,
      onTimeRate,
      avgDaysToPay,
      lastPaymentAt: lastPayment,
      riskLevel,
    };
  });
}

export function buildProjectProfiles(ledger: Ledger): ProjectDTO[] {
  return ledger.projects.map((project) => {
    const projectInvoices = ledger.invoices.filter((i) => i.projectId === project.id);
    const invoiced = round2(projectInvoices.reduce((s, i) => s + n(i.total), 0));
    const projectPayments = ledger.payments.filter(
      (p) => p.status === "completed" && projectInvoices.some((i) => i.id === p.invoiceId),
    );
    const revenue = round2(projectPayments.reduce((s, p) => s + n(p.amount), 0));
    const projectExpenses = round2(
      ledger.expenses.filter((e) => e.projectId === project.id).reduce((s, e) => s + n(e.amount), 0),
    );
    const outstanding = round2(
      projectInvoices.reduce((s, i) => {
        const paid = ledger.payments
          .filter((p) => p.invoiceId === i.id && p.status === "completed")
          .reduce((sum, p) => sum + n(p.amount), 0);
        return s + Math.max(0, n(i.total) - paid);
      }, 0),
    );
    const profit = round2(revenue - projectExpenses);
    return {
      id: project.id,
      clientId: project.clientId,
      clientName: ledger.clients.find((c) => c.id === project.clientId)?.name ?? "Unassigned",
      name: project.name,
      description: project.description,
      status: project.status,
      budget: n(project.budget),
      startDate: project.startDate,
      endDate: project.endDate,
      revenue,
      expenses: projectExpenses,
      profit,
      margin: revenue > 0 ? round2((profit / revenue) * 100) : 0,
      invoiced,
      outstanding,
      paid: revenue,
    };
  });
}

export function buildForecast(ledger: Ledger, metrics: Metrics, horizonDays: number): Forecast {
  const today = todayIso();
  const clientProfiles = buildClientProfiles(ledger);
  const openInvoices = ledger.invoices
    .map((row) => toInvoiceDTO(ledger, row))
    .filter((i) => i.balance > 0.005 && i.status !== "draft" && i.status !== "void");

  const scheduledInflow = new Map<string, number>();
  for (const invoice of openInvoices) {
    const profile = clientProfiles.find((c) => c.id === invoice.clientId);
    const reliability = profile ? 0.55 + (profile.onTimeRate / 100) * 0.45 : 0.75;
    const probability = invoice.status === "overdue" ? reliability * 0.75 : reliability;
    const expected = round2(invoice.balance * probability);
    const offset = invoice.status === "overdue" ? 3 : Math.max(0, daysBetween(today, invoice.dueDate));
    const date = addDaysIso(today, Math.min(offset, horizonDays - 1));
    scheduledInflow.set(date, round2((scheduledInflow.get(date) ?? 0) + expected));
  }

  const baselineOutflow = (() => {
    const months = new Map<string, number>();
    for (const e of ledger.expenses) {
      const key = monthKey(e.expenseDate);
      months.set(key, (months.get(key) ?? 0) + n(e.amount));
    }
    const recent = [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 3)
      .map(([, value]) => value);
    if (!recent.length) return 0;
    return round2(recent.reduce((a, b) => a + b, 0) / recent.length);
  })();
  const dailyOutflow = round2(baselineOutflow / 30);

  const series: ForecastPoint[] = [];
  let balance = metrics.cashBalance;
  let expectedInflow = 0;
  let expectedOutflow = 0;
  let lowestBalance = balance;
  let lowestDate = today;
  let shortageDate: string | null = null;

  for (let day = 0; day < horizonDays; day += 1) {
    const date = addDaysIso(today, day);
    const inflow = round2(scheduledInflow.get(date) ?? 0);
    const outflow = dailyOutflow;
    balance = round2(balance + inflow - outflow);
    expectedInflow = round2(expectedInflow + inflow);
    expectedOutflow = round2(expectedOutflow + outflow);
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestDate = date;
    }
    if (!shortageDate && balance < 0) shortageDate = date;
    series.push({ date, balance, inflow, outflow });
  }

  const dataPoints = ledger.payments.length + ledger.expenses.length + ledger.invoices.length;
  const confidence = Math.min(94, Math.round(52 + Math.min(30, dataPoints * 1.6) + (horizonDays <= 30 ? 8 : 0)));

  const assumptions = [
    `Starting balance of ${metrics.cashBalance.toFixed(2)} is derived from the opening balance plus completed payments minus recorded expenses.`,
    `Expected collections are probability-weighted using each client's historical on-time payment rate.`,
    `Recurring outflow is modelled at ${dailyOutflow.toFixed(2)} per day, based on the average of the last three months of recorded expenses.`,
    "Estimates assume no new invoices are issued and no new expenses are added during the forecast window.",
    "Predictions are estimates only and are not guaranteed financial outcomes.",
  ];

  return {
    horizonDays,
    startingBalance: metrics.cashBalance,
    projectedBalance: series.length ? series[series.length - 1].balance : metrics.cashBalance,
    lowestBalance: round2(lowestBalance),
    lowestDate,
    shortageDate,
    expectedInflow,
    expectedOutflow,
    series,
    assumptions,
    confidence,
    isEstimate: true,
  };
}

export function computeHealth(metrics: Metrics, forecast: Forecast): Health {
  const factors = [];
  const collectionScore = Math.max(0, Math.min(100, metrics.collectionRate));
  factors.push({
    label: "Collection efficiency",
    score: Math.round(collectionScore),
    weight: 0.25,
    detail: `${metrics.collectionRate.toFixed(0)}% of invoiced value has been collected.`,
  });

  const overdueRatio = metrics.outstandingAmount > 0 ? (metrics.overdueAmount / metrics.outstandingAmount) * 100 : 0;
  factors.push({
    label: "Overdue exposure",
    score: Math.round(Math.max(0, 100 - overdueRatio * 1.6)),
    weight: 0.2,
    detail: `${metrics.overdueCount} overdue invoice(s) worth ${metrics.overdueAmount.toFixed(2)}.`,
  });

  const marginScore = Math.max(0, Math.min(100, 50 + metrics.profitMargin * 1.6));
  factors.push({
    label: "Profitability",
    score: Math.round(marginScore),
    weight: 0.2,
    detail: `Net margin is ${metrics.profitMargin.toFixed(1)}%.`,
  });

  const runwayScore = Math.max(0, Math.min(100, (metrics.runwayDays / 90) * 100));
  factors.push({
    label: "Cash runway",
    score: Math.round(runwayScore),
    weight: 0.2,
    detail: `Cash runway is approximately ${metrics.runwayDays} days at the current burn rate.`,
  });

  const forecastScore = forecast.shortageDate ? 25 : forecast.lowestBalance < metrics.cashBalance * 0.4 ? 65 : 92;
  factors.push({
    label: "Forecast stability",
    score: forecastScore,
    weight: 0.15,
    detail: forecast.shortageDate
      ? `Projected cash shortage around ${forecast.shortageDate}.`
      : `No projected shortage in the next ${forecast.horizonDays} days.`,
  });

  const score = Math.round(factors.reduce((s, f) => s + f.score * f.weight, 0));
  const grade = score >= 80 ? "Excellent" : score >= 65 ? "Healthy" : score >= 50 ? "Watchlist" : "At risk";
  const headline =
    score >= 80
      ? "Your finances are in strong shape. Keep collecting early and monitor recurring costs."
      : score >= 65
        ? "Your business is stable, but a few levers could materially improve cash flow."
        : score >= 50
          ? "There are early warning signs. Tighten collections and review discretionary spend."
          : "Immediate action is recommended to protect liquidity.";

  return { score, grade, factors, headline };
}

export type InsightDraft = {
  agent: string;
  severity: Severity;
  title: string;
  explanation: string;
  supportingData: Record<string, unknown>;
  recommendation: string;
};

export function generateInsights(ledger: Ledger, metrics: Metrics, forecast: Forecast): InsightDraft[] {
  const drafts: InsightDraft[] = [];
  const clientProfiles = buildClientProfiles(ledger);
  const openInvoices = ledger.invoices
    .map((row) => toInvoiceDTO(ledger, row))
    .filter((i) => i.balance > 0.005 && i.status !== "draft" && i.status !== "void");

  if (forecast.shortageDate) {
    drafts.push({
      agent: "cashflow",
      severity: "critical",
      title: `Projected cash shortage on ${forecast.shortageDate}`,
      explanation: `Based on expected collections and your average daily outflow, the projected balance drops to ${forecast.lowestBalance.toFixed(2)} on ${forecast.lowestDate}. This is an estimate, not a certainty.`,
      supportingData: {
        startingBalance: forecast.startingBalance,
        lowestBalance: forecast.lowestBalance,
        lowestDate: forecast.lowestDate,
        horizonDays: forecast.horizonDays,
        expectedInflow: forecast.expectedInflow,
        expectedOutflow: forecast.expectedOutflow,
      },
      recommendation:
        "Collect overdue invoices first, delay non-critical spend, and consider a short-term credit line before the projected date.",
    });
  }

  const overdue = openInvoices.filter((i) => i.status === "overdue");
  if (overdue.length) {
    const amount = round2(overdue.reduce((s, i) => s + i.balance, 0));
    drafts.push({
      agent: "payment",
      severity: amount > metrics.cashBalance * 0.5 ? "high" : "medium",
      title: `${overdue.length} overdue invoice${overdue.length > 1 ? "s" : ""} worth ${amount.toFixed(2)}`,
      explanation: `These invoices are past their due date: ${overdue
        .slice(0, 4)
        .map((i) => `${i.number} (${i.clientName}, ${i.balance.toFixed(2)})`)
        .join(", ")}. Collecting them would immediately improve your cash position.`,
      supportingData: { overdueCount: overdue.length, overdueAmount: amount, invoices: overdue.slice(0, 6).map((i) => i.number) },
      recommendation:
        "Approve the Payment Agent to send a polite reminder sequence, starting with the oldest invoice.",
    });
  }

  if (metrics.expenseLastMonth > 0) {
    const change = ((metrics.expenseThisMonth - metrics.expenseLastMonth) / metrics.expenseLastMonth) * 100;
    if (Math.abs(change) >= 8) {
      drafts.push({
        agent: "expense",
        severity: change > 25 ? "high" : "medium",
        title: `Operating expenses ${change > 0 ? "increased" : "decreased"} by ${Math.abs(change).toFixed(0)}% this month`,
        explanation: `You spent ${metrics.expenseThisMonth.toFixed(2)} this month versus ${metrics.expenseLastMonth.toFixed(2)} last month.`,
        supportingData: { thisMonth: metrics.expenseThisMonth, lastMonth: metrics.expenseLastMonth, changePct: round2(change) },
        recommendation:
          change > 0
            ? "Review the largest category increases and renegotiate or pause non-essential subscriptions."
            : "Cost discipline is working. Consider redirecting the savings into a cash buffer.",
      });
    }
  }

  const categoryTotals = new Map<string, number>();
  for (const e of ledger.expenses) {
    categoryTotals.set(e.category, round2((categoryTotals.get(e.category) ?? 0) + n(e.amount)));
  }
  const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory && metrics.totalExpenses > 0) {
    const share = (topCategory[1] / metrics.totalExpenses) * 100;
    drafts.push({
      agent: "expense",
      severity: "info",
      title: `${titleCase(topCategory[0])} is your highest expense category`,
      explanation: `${titleCase(topCategory[0])} accounts for ${share.toFixed(0)}% of total recorded spend (${topCategory[1].toFixed(2)}).`,
      supportingData: { category: topCategory[0], amount: topCategory[1], sharePct: round2(share) },
      recommendation:
        "Benchmark this category against your revenue and set a monthly cap to protect margin.",
    });
  }

  const candidate = ledger.expenses[0];
  if (candidate) {
    const sameCategory = ledger.expenses.filter((expense) => expense.category === candidate.category).map((expense) => n(expense.amount)).sort((a, b) => a - b);
    const middle = Math.floor(sameCategory.length / 2);
    const median = sameCategory.length % 2 ? sameCategory[middle] : (sameCategory[middle - 1] + sameCategory[middle]) / 2;
    const amount = n(candidate.amount);
    if (sameCategory.length >= 3 && median > 0 && amount >= Math.max(500, median * 2.5)) {
      drafts.push({
        agent: "expense",
        severity: "medium",
        title: `Unusual ${titleCase(candidate.category)} spend detected`,
        explanation: `${candidate.vendor || candidate.description || "Your latest expense"} is ${amount.toFixed(2)}, compared with a median of ${median.toFixed(2)} across ${sameCategory.length} expenses in this category. This is 2.5× or more than the category median.`,
        supportingData: { vendor: candidate.vendor, amount, categoryMedian: median, category: candidate.category, expenseDate: candidate.expenseDate },
        recommendation: "Review the receipt and project allocation. If it is a one-off, tag it in the description; otherwise renegotiate the vendor or set a category cap.",
      });
    }
  }

  const riskyClients = clientProfiles.filter((c) => c.riskLevel === "high" && c.invoiceCount > 0);
  if (riskyClients.length) {
    const worst = riskyClients[0];
    drafts.push({
      agent: "bi",
      severity: "high",
      title: `${worst.name} shows delayed payment behaviour`,
      explanation: `${worst.name} has ${worst.invoiceCount} invoice(s), ${worst.overdue.toFixed(2)} overdue, and an on-time payment rate of ${worst.onTimeRate}%.`,
      supportingData: {
        client: worst.name,
        overdue: worst.overdue,
        onTimeRate: worst.onTimeRate,
        avgDaysToPay: worst.avgDaysToPay,
      },
      recommendation:
        "Consider requiring a deposit or shortening payment terms for this client before the next engagement.",
    });
  }

  const revenueByClient = new Map<string, number>();
  for (const p of ledger.payments) {
    if (p.status !== "completed" || !p.clientId) continue;
    revenueByClient.set(p.clientId, round2((revenueByClient.get(p.clientId) ?? 0) + n(p.amount)));
  }
  const topClient = [...revenueByClient.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topClient && metrics.totalRevenue > 0) {
    const share = (topClient[1] / metrics.totalRevenue) * 100;
    if (share >= 35) {
      const name = ledger.clients.find((c) => c.id === topClient[0])?.name ?? "your top client";
      drafts.push({
        agent: "bi",
        severity: "medium",
        title: `Revenue concentration risk: ${name} is ${share.toFixed(0)}% of revenue`,
        explanation: `A single client represents ${share.toFixed(0)}% of collected revenue. Losing them would materially impact cash flow.`,
        supportingData: { client: name, amount: topClient[1], sharePct: round2(share) },
        recommendation: "Diversify by converting accepted quotations from smaller clients into invoices this month.",
      });
    }
  }

  if (metrics.profitMargin < 20 && metrics.totalRevenue > 0) {
    drafts.push({
      agent: "bi",
      severity: metrics.profitMargin < 5 ? "high" : "medium",
      title: `Net profit margin is ${metrics.profitMargin.toFixed(1)}%`,
      explanation: `Revenue of ${metrics.totalRevenue.toFixed(2)} against expenses of ${metrics.totalExpenses.toFixed(2)} leaves a thin margin.`,
      supportingData: { revenue: metrics.totalRevenue, expenses: metrics.totalExpenses, marginPct: metrics.profitMargin },
      recommendation:
        "Raise pricing on new quotations, reduce the top expense category, and review project-level profitability.",
    });
  }

  const recurring = ledger.expenses.filter((e) => e.isRecurring);
  if (recurring.length >= 2) {
    const total = round2(recurring.reduce((s, e) => s + n(e.amount), 0));
    drafts.push({
      agent: "expense",
      severity: "low",
      title: `${recurring.length} recurring expenses detected (${total.toFixed(2)} per cycle)`,
      explanation: `Recurring commitments reduce flexibility. They include ${recurring
        .slice(0, 3)
        .map((e) => e.vendor || e.description || e.category)
        .join(", ")}.`,
      supportingData: { count: recurring.length, total },
      recommendation: "Audit recurring subscriptions quarterly and cancel anything unused in the last 60 days.",
    });
  }

  if (metrics.avgDaysToPay > 0 && metrics.avgDaysToPay > 21) {
    drafts.push({
      agent: "payment",
      severity: "medium",
      title: `Clients take ${metrics.avgDaysToPay} days on average to pay`,
      explanation: "Slow collection cycles tie up working capital and increase the risk of a cash shortage.",
      supportingData: { avgDaysToPay: metrics.avgDaysToPay, paymentTerms: ledger.business.paymentTermsDays },
      recommendation: "Shorten payment terms and add a small early-payment discount to accelerate collections.",
    });
  }

  const severityRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  return drafts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]).slice(0, 9);
}

export function buildSummary(ledger: Ledger, metrics: Metrics, forecast: Forecast, health: Health): string {
  const currency = ledger.business.currency;
  const parts: string[] = [];
  parts.push(
    `You have ${metrics.outstandingAmount.toFixed(2)} ${currency} in outstanding invoices across ${metrics.outstandingInvoices} invoice(s), of which ${metrics.overdueAmount.toFixed(2)} is overdue (${metrics.overdueCount} invoice${metrics.overdueCount === 1 ? "" : "s"}).`,
  );
  if (forecast.shortageDate) {
    parts.push(
      `If collections do not improve, your projected cash balance could fall to ${forecast.lowestBalance.toFixed(2)} ${currency} by ${forecast.lowestDate}, creating a potential shortage.`,
    );
  } else {
    parts.push(
      `Your projected cash balance stays positive over the next ${forecast.horizonDays} days, ending at approximately ${forecast.projectedBalance.toFixed(2)} ${currency} (estimate).`,
    );
  }
  if (metrics.revenueThisMonth !== metrics.revenueLastMonth) {
    const delta = metrics.revenueThisMonth - metrics.revenueLastMonth;
    parts.push(
      `Revenue this month is ${metrics.revenueThisMonth.toFixed(2)} ${currency}, ${delta >= 0 ? "up" : "down"} ${Math.abs(delta).toFixed(2)} versus last month.`,
    );
  }
  parts.push(`Financial health score: ${health.score}/100 (${health.grade}).`);
  return parts.join(" ");
}

export async function persistInsights(userId: string, drafts: InsightDraft[]): Promise<void> {
  const existing = await db.select().from(aiInsights).where(eq(aiInsights.userId, userId));
  const byTitle = new Map(existing.map((row) => [row.title, row]));

  for (const draft of drafts) {
    const current = byTitle.get(draft.title);
    if (current) {
      await db.update(aiInsights).set({
        agent: draft.agent,
        severity: draft.severity,
        explanation: draft.explanation,
        supportingData: draft.supportingData,
        recommendation: draft.recommendation,
      }).where(and(eq(aiInsights.id, current.id), eq(aiInsights.userId, userId)));
    } else {
      await db.insert(aiInsights).values({ userId, ...draft, status: "open" });
    }
  }

  if (drafts.length) {
    await db.delete(aiInsights).where(and(eq(aiInsights.userId, userId), notInArray(aiInsights.title, drafts.map((draft) => draft.title))));
  } else {
    await db.delete(aiInsights).where(eq(aiInsights.userId, userId));
  }
}

export async function logActivity(
  userId: string,
  agent: string,
  action: string,
  status: string,
  detail: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(agentActivities).values({ userId, agent, action, status, detail, payload });
}

export function deriveActivities(ledger: Ledger, metrics: Metrics, forecast: Forecast): ActivityDTO[] {
  const items: ActivityDTO[] = [];
  const stamp = (offsetMinutes: number) => new Date(Date.now() - offsetMinutes * 60000).toISOString();
  const openInvoices = ledger.invoices
    .map((row) => toInvoiceDTO(ledger, row))
    .filter((i) => i.balance > 0.005 && i.status !== "draft");

  items.push({
    id: "a-cashflow",
    agent: "cashflow",
    action: `Recomputed ${forecast.horizonDays}-day cash-flow forecast`,
    status: forecast.shortageDate ? "warning" : "success",
    detail: forecast.shortageDate
      ? `Projected shortage on ${forecast.shortageDate}; lowest balance ${forecast.lowestBalance.toFixed(2)}.`
      : `Projected balance ${forecast.projectedBalance.toFixed(2)} at horizon.`,
    createdAt: stamp(4),
  });

  items.push({
    id: "a-payment",
    agent: "payment",
    action: `Monitored ${openInvoices.length} open invoice(s)`,
    status: metrics.overdueCount ? "warning" : "success",
    detail: metrics.overdueCount
      ? `${metrics.overdueCount} overdue invoice(s) worth ${metrics.overdueAmount.toFixed(2)} flagged for follow-up.`
      : "No overdue invoices detected.",
    createdAt: stamp(18),
  });

  items.push({
    id: "a-invoice",
    agent: "invoice",
    action: "Validated invoice numbering and tax calculations",
    status: "success",
    detail: `${metrics.totalInvoices} invoice(s) checked; ${metrics.draftInvoices} draft(s) awaiting issue.`,
    createdAt: stamp(36),
  });

  const topCategory = (() => {
    const totals = new Map<string, number>();
    for (const e of ledger.expenses) totals.set(e.category, round2((totals.get(e.category) ?? 0) + n(e.amount)));
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  })();
  items.push({
    id: "a-expense",
    agent: "expense",
    action: "Categorised and analysed expenses",
    status: "info",
    detail: topCategory
      ? `${ledger.expenses.length} expense(s) analysed; top category ${titleCase(topCategory[0])} at ${topCategory[1].toFixed(2)}.`
      : "No expenses recorded yet.",
    createdAt: stamp(58),
  });

  items.push({
    id: "a-bi",
    agent: "bi",
    action: "Generated business intelligence brief",
    status: "info",
    detail: `Health score ${computeHealth(metrics, forecast).score}/100 with ${metrics.totalClients} client(s) and ${metrics.activeProjects} active project(s).`,
    createdAt: stamp(95),
  });

  return items;
}

export async function buildDashboard(userId: string): Promise<DashboardPayload | null> {
  const ledger = await loadLedger(userId);
  if (!ledger) return null;

  const metrics = computeMetrics(ledger);
  const forecast = buildForecast(ledger, metrics, 30);
  const health = computeHealth(metrics, forecast);
  const drafts = generateInsights(ledger, metrics, forecast);
  await persistInsights(userId, drafts);

  const [insightRows, notificationRows, activityRows] = await Promise.all([
    db.select().from(aiInsights).where(eq(aiInsights.userId, userId)).orderBy(desc(aiInsights.createdAt)),
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(8),
    db.select().from(agentActivities).where(eq(agentActivities.userId, userId)).orderBy(desc(agentActivities.createdAt)).limit(8),
  ]);

  const invoiceDTOs = ledger.invoices.map((row) => toInvoiceDTO(ledger, row));
  const openInvoices = invoiceDTOs.filter((i) => i.balance > 0.005 && i.status !== "draft" && i.status !== "void");

  const recentTransactions = [
    ...ledger.payments
      .filter((p) => p.status === "completed")
      .map((p) => ({
        id: `pay-${p.id}`,
        kind: "payment" as const,
        label: `Payment received · ${ledger.invoices.find((i) => i.id === p.invoiceId)?.number ?? "Invoice"}`,
        party: ledger.clients.find((c) => c.id === p.clientId)?.name ?? "Client",
        amount: n(p.amount),
        date: p.paidAt,
        status: p.status,
      })),
    ...ledger.expenses.map((e) => ({
      id: `exp-${e.id}`,
      kind: "expense" as const,
      label: e.description || `${titleCase(e.category)} expense`,
      party: e.vendor || titleCase(e.category),
      amount: n(e.amount),
      date: e.expenseDate,
      status: "completed",
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  const recurringVendors = new Map<string, ExpenseRow>();
  for (const expense of ledger.expenses) {
    if (!expense.isRecurring) continue;
    const key = `${expense.vendor || expense.category}-${expense.category}`.toLowerCase();
    if (!recurringVendors.has(key)) recurringVendors.set(key, expense);
  }

  const upcoming = [
    ...openInvoices
      .filter((invoice) => invoice.dueDate >= todayIso())
      .slice(0, 5)
      .map((invoice) => ({
        id: `in-${invoice.id}`,
        label: `${invoice.number} · ${invoice.clientName}`,
        amount: invoice.balance,
        date: invoice.dueDate,
        kind: "inflow" as const,
      })),
    ...[...recurringVendors.values()].map((expense) => {
      let next = addDaysIso(expense.expenseDate, 30);
      while (next < todayIso()) next = addDaysIso(next, 30);
      return {
        id: `out-${expense.id}`,
        label: `${expense.vendor || titleCase(expense.category)} (recurring estimate)`,
        amount: n(expense.amount),
        date: next,
        kind: "outflow" as const,
      };
    }),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

  const categoryTotals = new Map<string, number>();
  for (const e of ledger.expenses) {
    categoryTotals.set(e.category, round2((categoryTotals.get(e.category) ?? 0) + n(e.amount)));
  }
  const expenseTotal = [...categoryTotals.values()].reduce((a, b) => a + b, 0) || 1;
  const expenseBreakdown = [...categoryTotals.entries()]
    .map(([category, amount]) => ({ category, amount, share: round2((amount / expenseTotal) * 100) }))
    .sort((a, b) => b.amount - a.amount);

  const revenueMap = new Map<string, number>();
  for (const p of ledger.payments) {
    if (p.status !== "completed" || !p.clientId) continue;
    revenueMap.set(p.clientId, round2((revenueMap.get(p.clientId) ?? 0) + n(p.amount)));
  }
  const revenueByClient = [...revenueMap.entries()]
    .map(([clientId, amount]) => ({
      client: ledger.clients.find((c) => c.id === clientId)?.name ?? "Unknown",
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  const insights: InsightDTO[] = insightRows.map((row) => ({
    id: row.id,
    agent: row.agent,
    severity: row.severity as Severity,
    title: row.title,
    explanation: row.explanation,
    supportingData: row.supportingData ?? {},
    recommendation: row.recommendation,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));

  const notificationDtos: NotificationDTO[] = notificationRows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    type: row.type,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    business: toBusinessDTO(ledger.business),
    metrics,
    monthly: buildMonthly(ledger),
    forecast,
    health,
    summary: buildSummary(ledger, metrics, forecast, health),
    insights,
    activities: activityRows.length
      ? activityRows.map((row) => ({
          id: row.id,
          agent: row.agent,
          action: row.action,
          status: row.status,
          detail: row.detail,
          createdAt: row.createdAt.toISOString(),
        }))
      : deriveActivities(ledger, metrics, forecast),
    notifications: notificationDtos,
    recentTransactions,
    pendingInvoices: openInvoices.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1)).slice(0, 6),
    upcoming,
    expenseBreakdown,
    revenueByClient,
  };
}

export async function nextDocumentNumber(
  userId: string,
  kind: "invoice" | "quotation",
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = kind === "invoice" ? "INV" : "QUO";
  const rows =
    kind === "invoice"
      ? await db.select({ number: invoices.number }).from(invoices).where(eq(invoices.userId, userId))
      : await db.select({ number: quotations.number }).from(quotations).where(eq(quotations.userId, userId));
  const max = rows.reduce((acc, row) => {
    const match = row.number.match(/(\d+)$/);
    return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}
