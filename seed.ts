import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
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
import { addDaysIso, round2, todayIso } from "@/lib/finance";

const demoYear = new Date().getUTCFullYear();
const d = (offset: number) => addDaysIso(todayIso(), offset);
const m = (value: number) => round2(value).toFixed(2);

type SeedItem = { description: string; quantity: number; unitPrice: number };

function totals(items: SeedItem[], discountType: string, discountValue: number, taxRate: number) {
  const subtotal = round2(items.reduce((s, i) => s + i.quantity * i.unitPrice, 0));
  const discount =
    discountType === "percent" ? round2((subtotal * discountValue) / 100) : round2(discountValue);
  const taxable = Math.max(0, subtotal - discount);
  const tax = round2((taxable * taxRate) / 100);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

export async function seedDemoData(userId: string): Promise<void> {
  const [business] = await db.select().from(businesses).where(eq(businesses.userId, userId)).limit(1);
  if (!business) return;

  const existing = await db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId)).limit(1);
  if (existing.length) return;

  const clientSeed = [
    { name: "Olivia Bennett", company: "Northwind Traders", email: "ap@northwindtraders.com", phone: "+1 415 555 0132", country: "United States", address: "500 Market St, San Francisco, CA", paymentTermsDays: 14, notes: "Strategic retainer client. Prefers bank transfer." },
    { name: "Rahul Mehta", company: "ABC Technologies", email: "finance@abctech.io", phone: "+91 98200 11223", country: "India", address: "Bandra Kurla Complex, Mumbai", paymentTermsDays: 30, notes: "Pays via PayPal. Requires GST invoice copy." },
    { name: "Sara Lindqvist", company: "Lumen Studio", email: "hello@lumenstudio.co", phone: "+46 8 555 0110", country: "Sweden", address: "Sveavägen 12, Stockholm", paymentTermsDays: 14, notes: "Slow payer historically — follow up early." },
    { name: "Marcus Cole", company: "Vertex Logistics", email: "accounts@vertexlogistics.com", phone: "+1 312 555 0177", country: "United States", address: "220 W Madison St, Chicago, IL", paymentTermsDays: 21, notes: "Partial payments are common; confirm balance." },
    { name: "Aiko Tanaka", company: "Kite & Co", email: "billing@kiteandco.jp", phone: "+81 3 5555 0121", country: "Japan", address: "Shibuya 2-11, Tokyo", paymentTermsDays: 7, notes: "New client — small pilot project." },
  ];

  const insertedClients = await db
    .insert(clients)
    .values(clientSeed.map((c) => ({ ...c, userId })))
    .returning();

  const clientId = (company: string) => insertedClients.find((c) => c.company === company)?.id ?? null;

  const projectSeed = [
    { name: "Website Redesign", company: "Northwind Traders", description: "Marketing site rebuild with CMS and analytics.", status: "active", budget: m(12000), startDate: d(-70), endDate: d(20) },
    { name: "Mobile App MVP", company: "ABC Technologies", description: "React Native MVP with payments and auth.", status: "active", budget: m(24000), startDate: d(-45), endDate: d(60) },
    { name: "Brand Identity", company: "Lumen Studio", description: "Logo, design system and brand guidelines.", status: "completed", budget: m(6500), startDate: d(-120), endDate: d(-40) },
    { name: "Logistics Dashboard", company: "Vertex Logistics", description: "Operations dashboard with shipment tracking.", status: "active", budget: m(18000), startDate: d(-30), endDate: d(45) },
  ];

  const insertedProjects = await db
    .insert(projects)
    .values(projectSeed.map((p) => ({ ...p, userId, clientId: clientId(p.company) })))
    .returning();
  const projectId = (name: string) => insertedProjects.find((p) => p.name === name)?.id ?? null;

  // Quotations
  const quotationSeed = [
    {
      number: `QUO-${demoYear}-001`,
      company: "ABC Technologies",
      project: "Mobile App MVP",
      status: "accepted",
      issueDate: d(-12),
      validUntil: d(18),
      discountType: "percent",
      discountValue: 5,
      taxRate: Number(business.taxRate) || 0,
      notes: "Discovery phase, valid for 30 days. 50% due on acceptance.",
      items: [
        { description: "Product discovery workshop", quantity: 1, unitPrice: 1800 },
        { description: "UX wireframes (8 screens)", quantity: 8, unitPrice: 220 },
        { description: "Technical architecture document", quantity: 1, unitPrice: 900 },
      ] as SeedItem[],
    },
    {
      number: `QUO-${demoYear}-002`,
      company: "Vertex Logistics",
      project: "Logistics Dashboard",
      status: "sent",
      issueDate: d(-6),
      validUntil: d(24),
      discountType: "percent",
      discountValue: 0,
      taxRate: Number(business.taxRate) || 0,
      notes: "Phase 2 dashboard expansion with realtime tracking.",
      items: [
        { description: "Dashboard phase 2 — build", quantity: 1, unitPrice: 7200 },
        { description: "Realtime tracking integration", quantity: 1, unitPrice: 2000 },
      ] as SeedItem[],
    },
    {
      number: `QUO-${demoYear}-003`,
      company: "Kite & Co",
      project: "",
      status: "draft",
      issueDate: d(-1),
      validUntil: d(29),
      discountType: "percent",
      discountValue: 0,
      taxRate: Number(business.taxRate) || 0,
      notes: "Pilot engagement for the Tokyo launch.",
      items: [{ description: "Landing page design sprint", quantity: 1, unitPrice: 3200 }] as SeedItem[],
    },
  ];

  for (const q of quotationSeed) {
    const t = totals(q.items, q.discountType, q.discountValue, q.taxRate);
    const [row] = await db
      .insert(quotations)
      .values({
        userId,
        clientId: clientId(q.company),
        projectId: q.project ? projectId(q.project) : null,
        number: q.number,
        status: q.status,
        issueDate: q.issueDate,
        validUntil: q.validUntil,
        subtotal: m(t.subtotal),
        discountType: q.discountType,
        discountValue: m(q.discountValue),
        taxRate: m(q.taxRate),
        total: m(t.total),
        notes: q.notes,
      })
      .returning();
    await db.insert(quotationItems).values(
      q.items.map((item) => ({
        quotationId: row.id,
        description: item.description,
        quantity: m(item.quantity),
        unitPrice: m(item.unitPrice),
        amount: m(item.quantity * item.unitPrice),
      })),
    );
  }

  // Invoices (mix of paid, overdue, partial, sent, draft) across 6 months
  const invoiceSeed = [
    { number: `INV-${demoYear}-001`, company: "Northwind Traders", project: "Website Redesign", status: "paid", issueDate: d(-160), dueDate: d(-146), items: [{ description: "Website redesign — phase 1", quantity: 1, unitPrice: 6200 }] as SeedItem[], paid: 6200, paidOffset: -150, method: "bank_transfer" },
    { number: `INV-${demoYear}-002`, company: "Lumen Studio", project: "Brand Identity", status: "paid", issueDate: d(-132), dueDate: d(-118), items: [{ description: "Brand identity package", quantity: 1, unitPrice: 4800 }] as SeedItem[], paid: 4800, paidOffset: -120, method: "bank_transfer" },
    { number: `INV-${demoYear}-003`, company: "Vertex Logistics", project: "Logistics Dashboard", status: "paid", issueDate: d(-104), dueDate: d(-83), items: [{ description: "Dashboard discovery sprint", quantity: 1, unitPrice: 5400 }] as SeedItem[], paid: 5400, paidOffset: -95, method: "paypal" },
    { number: `INV-${demoYear}-004`, company: "ABC Technologies", project: "Mobile App MVP", status: "paid", issueDate: d(-78), dueDate: d(-48), items: [{ description: "Mobile app MVP — milestone 1", quantity: 1, unitPrice: 7200 }] as SeedItem[], paid: 7200, paidOffset: -55, method: "paypal" },
    { number: `INV-${demoYear}-005`, company: "Northwind Traders", project: "Website Redesign", status: "paid", issueDate: d(-52), dueDate: d(-38), items: [{ description: "Website redesign — phase 2", quantity: 1, unitPrice: 5800 }] as SeedItem[], paid: 5800, paidOffset: -40, method: "bank_transfer" },
    { number: `INV-${demoYear}-006`, company: "Lumen Studio", project: "Brand Identity", status: "overdue", issueDate: d(-44), dueDate: d(-30), items: [{ description: "Brand guidelines addendum", quantity: 1, unitPrice: 3200 }] as SeedItem[], paid: 0, paidOffset: 0, method: "bank_transfer" },
    { number: `INV-${demoYear}-007`, company: "ABC Technologies", project: "Mobile App MVP", status: "overdue", issueDate: d(-62), dueDate: d(-32), items: [{ description: "Mobile app MVP — milestone 2", quantity: 1, unitPrice: 2800 }] as SeedItem[], paid: 0, paidOffset: 0, method: "paypal" },
    { number: `INV-${demoYear}-008`, company: "Vertex Logistics", project: "Logistics Dashboard", status: "partially_paid", issueDate: d(-26), dueDate: d(-5), items: [{ description: "Logistics dashboard — build", quantity: 1, unitPrice: 9200 }] as SeedItem[], paid: 4000, paidOffset: -8, method: "bank_transfer" },
    { number: `INV-${demoYear}-009`, company: "Northwind Traders", project: "Website Redesign", status: "sent", issueDate: d(-9), dueDate: d(5), items: [{ description: "Website redesign — final milestone", quantity: 1, unitPrice: 5400 }] as SeedItem[], paid: 0, paidOffset: 0, method: "bank_transfer" },
    { number: `INV-${demoYear}-010`, company: "ABC Technologies", project: "Mobile App MVP", status: "sent", issueDate: d(-4), dueDate: d(26), items: [{ description: "Mobile app MVP — milestone 3", quantity: 1, unitPrice: 6400 }] as SeedItem[], paid: 0, paidOffset: 0, method: "paypal" },
    { number: `INV-${demoYear}-011`, company: "Kite & Co", project: "", status: "draft", issueDate: d(-1), dueDate: d(13), items: [{ description: "Landing page design sprint", quantity: 1, unitPrice: 3200 }] as SeedItem[], paid: 0, paidOffset: 0, method: "bank_transfer" },
  ];

  for (const inv of invoiceSeed) {
    const taxRate = Number(business.taxRate) || 0;
    const t = totals(inv.items, "percent", 0, taxRate);
    const [row] = await db
      .insert(invoices)
      .values({
        userId,
        clientId: clientId(inv.company),
        projectId: inv.project ? projectId(inv.project) : null,
        number: inv.number,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        subtotal: m(t.subtotal),
        discountType: "percent",
        discountValue: "0",
        taxRate: m(taxRate),
        total: m(t.total),
        amountPaid: m(inv.paid),
        notes: "Thank you for your business. Payment via bank transfer or PayPal.",
      })
      .returning();

    await db.insert(invoiceItems).values(
      inv.items.map((item) => ({
        invoiceId: row.id,
        description: item.description,
        quantity: m(item.quantity),
        unitPrice: m(item.unitPrice),
        amount: m(item.quantity * item.unitPrice),
      })),
    );

    if (inv.paid > 0) {
      await db.insert(payments).values({
        userId,
        invoiceId: row.id,
        clientId: clientId(inv.company),
        amount: m(inv.paid),
        method: inv.method,
        status: "completed",
        transactionId: `${inv.method === "paypal" ? "PAYPAL" : "BNK"}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
        note: inv.paid < t.total ? "Partial payment received" : "Payment received in full",
        paidAt: d(inv.paidOffset),
      });
    }
  }

  // Expenses across three months
  const expenseSeed: {
    category: string;
    vendor: string;
    description: string;
    amount: number;
    offset: number;
    method: string;
    recurring?: boolean;
    project?: string;
  }[] = [
    { category: "software", vendor: "Figma", description: "Design tooling subscription", amount: 45, offset: -2, method: "card", recurring: true },
    { category: "software", vendor: "AWS", description: "Cloud hosting", amount: 320, offset: -3, method: "card", recurring: true },
    { category: "software", vendor: "GitHub", description: "Team plan", amount: 84, offset: -5, method: "card", recurring: true },
    { category: "office", vendor: "WeWork", description: "Co-working desk", amount: 650, offset: -6, method: "bank_transfer", recurring: true },
    { category: "marketing", vendor: "Google Ads", description: "Lead generation campaign", amount: 1450, offset: -8, method: "card", project: "Website Redesign" },
    { category: "marketing", vendor: "LinkedIn", description: "Sponsored content", amount: 780, offset: -12, method: "card" },
    { category: "contractor", vendor: "Design Collective", description: "Contract UI designer", amount: 2400, offset: -10, method: "bank_transfer", project: "Mobile App MVP" },
    { category: "contractor", vendor: "Backend Guild", description: "API development support", amount: 3100, offset: -18, method: "bank_transfer", project: "Logistics Dashboard" },
    { category: "travel", vendor: "Delta Airlines", description: "Client visit — Chicago", amount: 620, offset: -14, method: "card", project: "Logistics Dashboard" },
    { category: "utilities", vendor: "Comcast", description: "Office internet", amount: 120, offset: -9, method: "card", recurring: true },
    { category: "insurance", vendor: "Hiscox", description: "Professional indemnity", amount: 240, offset: -20, method: "bank_transfer", recurring: true },
    { category: "software", vendor: "Figma", description: "Design tooling subscription", amount: 45, offset: -32, method: "card", recurring: true },
    { category: "software", vendor: "AWS", description: "Cloud hosting", amount: 298, offset: -33, method: "card", recurring: true },
    { category: "office", vendor: "WeWork", description: "Co-working desk", amount: 650, offset: -36, method: "bank_transfer", recurring: true },
    { category: "marketing", vendor: "Google Ads", description: "Lead generation campaign", amount: 980, offset: -38, method: "card" },
    { category: "contractor", vendor: "Design Collective", description: "Contract UI designer", amount: 1800, offset: -41, method: "bank_transfer", project: "Brand Identity" },
    { category: "travel", vendor: "Hotel SFO", description: "Client workshop travel", amount: 540, offset: -44, method: "card" },
    { category: "software", vendor: "Notion", description: "Team workspace", amount: 96, offset: -47, method: "card", recurring: true },
    { category: "marketing", vendor: "Content Studio", description: "Case study writing", amount: 700, offset: -52, method: "bank_transfer" },
    { category: "utilities", vendor: "PG&E", description: "Electricity", amount: 180, offset: -55, method: "card" },
    { category: "software", vendor: "Figma", description: "Design tooling subscription", amount: 45, offset: -62, method: "card", recurring: true },
    { category: "software", vendor: "AWS", description: "Cloud hosting", amount: 275, offset: -63, method: "card", recurring: true },
    { category: "office", vendor: "WeWork", description: "Co-working desk", amount: 650, offset: -66, method: "bank_transfer", recurring: true },
    { category: "contractor", vendor: "Backend Guild", description: "API development support", amount: 2600, offset: -70, method: "bank_transfer", project: "Logistics Dashboard" },
    { category: "marketing", vendor: "Google Ads", description: "Lead generation campaign", amount: 1120, offset: -74, method: "card" },
    { category: "insurance", vendor: "Hiscox", description: "Professional indemnity", amount: 240, offset: -80, method: "bank_transfer", recurring: true },
  ];

  await db.insert(expenses).values(
    expenseSeed.map((e) => ({
      userId,
      projectId: e.project ? projectId(e.project) : null,
      category: e.category,
      vendor: e.vendor,
      description: e.description,
      amount: m(e.amount),
      taxAmount: "0",
      paymentMethod: e.method,
      expenseDate: d(e.offset),
      isRecurring: e.recurring ?? false,
    })),
  );

  await db
    .update(businesses)
    .set({ cashBalance: m(18500), isDemo: true, onboardingComplete: true })
    .where(eq(businesses.id, business.id));

  await db.insert(notifications).values([
    {
      userId,
      title: "3 invoices are overdue",
      body: "Payment Agent flagged overdue invoices. Review and approve reminders from the AI Finance Assistant.",
      type: "warning",
    },
    {
      userId,
      title: "Cash-flow forecast refreshed",
      body: "Cash Flow Agent re-projected your 30-day liquidity using the latest payments and expenses.",
      type: "info",
    },
    {
      userId,
      title: "Welcome to PayPilot AI",
      body: "Your demo workspace is preloaded with sample clients, projects, invoices and expenses. All figures are computed from this data.",
      type: "success",
    },
  ]);
}
