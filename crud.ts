import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  clients,
  expenses,
  invoiceItems,
  invoices,
  payments,
  projects,
  quotationItems,
  quotations,
} from "@/db/schema";
import { fail, money, num, str, today } from "@/lib/api";
import {
  loadLedger,
  nextDocumentNumber,
  round2,
  toClientDTO,
  toExpenseDTO,
  toInvoiceDTO,
  toPaymentDTO,
  toProjectDTO,
  toQuotationDTO,
  logActivity,
  type Ledger,
} from "@/lib/finance";
import { notify } from "@/lib/notifications";

export const RESOURCES = ["clients", "projects", "quotations", "invoices", "payments", "expenses"] as const;
export type Resource = (typeof RESOURCES)[number];

export function isResource(value: string): value is Resource {
  return (RESOURCES as readonly string[]).includes(value);
}

type ItemInput = { description?: unknown; quantity?: unknown; unitPrice?: unknown };

function parseItems(raw: unknown): { description: string; quantity: number; unitPrice: number; amount: number }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const record = (item ?? {}) as ItemInput;
      const quantity = num(record.quantity, 1) || 1;
      const unitPrice = num(record.unitPrice, 0);
      return {
        description: str(record.description) || "Service",
        quantity,
        unitPrice,
        amount: round2(quantity * unitPrice),
      };
    })
    .filter((item) => item.description.length > 0);
}

export function suggestExpenseCategory(vendor: string, description: string): string {
  const text = `${vendor} ${description}`.toLowerCase();
  const rules: [string, string[]][] = [
    ["software", ["aws", "figma", "github", "notion", "saas", "software", "hosting", "cloud", "subscription", "vercel"]],
    ["marketing", ["ads", "advert", "linkedin", "marketing", "campaign", "sponsor", "content"]],
    ["contractor", ["contractor", "freelancer", "consultant", "developer", "designer", "guild", "agency"]],
    ["office", ["office", "rent", "wework", "cowork", "desk", "furniture"]],
    ["travel", ["flight", "airline", "hotel", "travel", "uber", "taxi", "train"]],
    ["utilities", ["internet", "electric", "utility", "utilities", "phone", "water"]],
    ["insurance", ["insurance", "indemnity", "liability", "hiscox"]],
    ["equipment", ["laptop", "computer", "monitor", "equipment", "hardware", "camera"]],
    ["taxes", ["tax", "gst", "vat", "government"]],
  ];
  return rules.find(([, words]) => words.some((word) => text.includes(word)))?.[0] ?? "other";
}

function itemSignature(items: { description: string; quantity: number; unitPrice: number }[]): string {
  return items.map((item) => `${item.description.toLowerCase().trim()}|${item.quantity}|${item.unitPrice}`).sort().join(";");
}

function validateDocument(
  ledger: Ledger,
  input: { clientId: string; items: { description: string; quantity: number; unitPrice: number; amount: number }[]; discountType: string; discountValue: number; taxRate: number; issueDate: string; dueDate: string },
): string | null {
  if (!input.clientId || !ledger.clients.some((client) => client.id === input.clientId)) return "Select a valid client before continuing.";
  if (!input.items.length) return "Add at least one line item.";
  if (input.items.some((item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice <= 0)) return "Every line item needs a description, quantity above zero and unit price above zero.";
  if (input.discountType === "percent" && (input.discountValue < 0 || input.discountValue > 100)) return "Percentage discount must be between 0 and 100.";
  if (input.discountType === "fixed" && input.discountValue < 0) return "Fixed discount cannot be negative.";
  if (input.taxRate < 0 || input.taxRate > 100) return "Tax rate must be between 0 and 100.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issueDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) return "Enter valid issue and due dates.";
  if (input.dueDate < input.issueDate) return "Due date cannot be before the issue date.";
  return null;
}

function computeTotals(items: { amount: number }[], discountType: string, discountValue: number, taxRate: number) {
  const subtotal = round2(items.reduce((s, i) => s + i.amount, 0));
  const discount =
    discountType === "fixed" ? round2(Math.min(discountValue, subtotal)) : round2((subtotal * discountValue) / 100);
  const taxable = Math.max(0, round2(subtotal - discount));
  const tax = round2((taxable * taxRate) / 100);
  return { subtotal, discount, tax, total: round2(taxable + tax) };
}

export async function listResource(userId: string, resource: Resource) {
  const ledger = await loadLedger(userId);
  if (!ledger) return fail("Business profile not found", 404);
  switch (resource) {
    case "clients":
      return { clients: ledger.clients.map(toClientDTO) };
    case "projects":
      return { projects: (await import("@/lib/finance")).buildProjectProfiles(ledger) };
    case "quotations":
      return { quotations: ledger.quotations.map((q) => toQuotationDTO(ledger, q)) };
    case "invoices":
      return { invoices: ledger.invoices.map((i) => toInvoiceDTO(ledger, i)) };
    case "payments":
      return { payments: ledger.payments.map((p) => toPaymentDTO(ledger, p)) };
    case "expenses":
      return { expenses: ledger.expenses.map((e) => toExpenseDTO(ledger, e)) };
    default:
      return fail("Unknown resource", 404);
  }
}

export async function createResource(userId: string, resource: Resource, body: Record<string, unknown>) {
  const ledger = await loadLedger(userId);
  if (!ledger) return fail("Business profile not found", 404);

  if (resource === "clients") {
    const name = str(body.name);
    if (!name) return fail("Client name is required.");
    if (str(body.email) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(str(body.email))) return fail("Enter a valid client email address.");
    const [row] = await db
      .insert(clients)
      .values({
        userId,
        name,
        company: str(body.company),
        email: str(body.email),
        phone: str(body.phone),
        country: str(body.country),
        address: str(body.address),
        notes: str(body.notes),
        paymentTermsDays: Math.max(0, Math.round(num(body.paymentTermsDays, ledger.business.paymentTermsDays))),
      })
      .returning();
    return { client: toClientDTO(row) };
  }

  if (resource === "projects") {
    const name = str(body.name);
    if (!name) return fail("Project name is required.");
    if (num(body.budget) < 0) return fail("Project budget cannot be negative.");
    if (str(body.clientId) && !ledger.clients.some((client) => client.id === str(body.clientId))) return fail("Select a valid client for this project.");
    const startDate = str(body.startDate) || today();
    const endDate = str(body.endDate);
    if (endDate && endDate < startDate) return fail("Project end date cannot be before its start date.");
    const [row] = await db
      .insert(projects)
      .values({
        userId,
        name,
        clientId: str(body.clientId) || null,
        description: str(body.description),
        status: str(body.status) || "active",
        budget: money(num(body.budget)),
        startDate,
        endDate,
      })
      .returning();
    return { project: toProjectDTO({ ...ledger, projects: [...ledger.projects, row] }, row) };
  }

  if (resource === "quotations") {
    const items = parseItems(body.items);
    if (!items.length) return fail("Add at least one line item.");
    const discountType = str(body.discountType) === "fixed" ? "fixed" : "percent";
    const discountValue = num(body.discountValue);
    const taxRate = num(body.taxRate, num(ledger.business.taxRate));
    const issueDate = str(body.issueDate) || today();
    const validUntil = str(body.validUntil) || issueDate;
    const validationError = validateDocument(ledger, { clientId: str(body.clientId), items, discountType, discountValue, taxRate, issueDate, dueDate: validUntil });
    if (validationError) return fail(validationError);
    const t = computeTotals(items, discountType, discountValue, taxRate);
    const number = str(body.number) || (await nextDocumentNumber(userId, "quotation"));
    const [row] = await db
      .insert(quotations)
      .values({
        userId,
        clientId: str(body.clientId) || null,
        projectId: str(body.projectId) || null,
        number,
        status: str(body.status) || "draft",
        issueDate,
        validUntil,
        subtotal: money(t.subtotal),
        discountType,
        discountValue: money(discountValue),
        taxRate: money(taxRate),
        total: money(t.total),
        notes: str(body.notes),
      })
      .returning();
    await db.insert(quotationItems).values(
      items.map((item) => ({
        quotationId: row.id,
        description: item.description,
        quantity: money(item.quantity),
        unitPrice: money(item.unitPrice),
        amount: money(item.amount),
      })),
    );
    await logActivity(userId, "invoice", `Created quotation ${row.number}`, "success", `${items.length} line item(s); total ${row.total}.`, { quotationId: row.id });
    return { quotation: toQuotationDTO(ledger, { ...row, items }) };
  }

  if (resource === "invoices") {
    let items = parseItems(body.items);
    const quotationId = str(body.quotationId);
    let inheritedClientId = str(body.clientId);
    let inheritedProjectId = str(body.projectId);
    let inheritedDiscountType = str(body.discountType);
    let inheritedDiscountValue = num(body.discountValue);
    let inheritedTaxRate = num(body.taxRate, num(ledger.business.taxRate));
    if (quotationId) {
      const source = ledger.quotations.find((q) => q.id === quotationId);
      if (!source) return fail("Quotation not found", 404);
      if (!items.length) items = source.items.map((i) => ({ ...i }));
      if (!inheritedClientId) inheritedClientId = source.clientId ?? "";
      if (!inheritedProjectId) inheritedProjectId = source.projectId ?? "";
      if (!inheritedDiscountType) inheritedDiscountType = source.discountType;
      if (!inheritedDiscountValue) inheritedDiscountValue = num(source.discountValue);
      if (!body.taxRate) inheritedTaxRate = num(source.taxRate);
    }
    if (!items.length) return fail("Add at least one line item.");
    const discountType = inheritedDiscountType === "fixed" ? "fixed" : "percent";
    const discountValue = inheritedDiscountValue;
    const taxRate = inheritedTaxRate;
    const issueDate = str(body.issueDate) || today();
    const dueDate =
      str(body.dueDate) ||
      new Date(new Date(`${issueDate}T00:00:00Z`).getTime() + ledger.business.paymentTermsDays * 86400000)
        .toISOString()
        .slice(0, 10);
    const validationError = validateDocument(ledger, { clientId: inheritedClientId, items, discountType, discountValue, taxRate, issueDate, dueDate });
    if (validationError) return fail(validationError);
    const t = computeTotals(items, discountType, discountValue, taxRate);
    const signature = itemSignature(items);
    const duplicate = ledger.invoices.find((existing) => {
      if (existing.clientId !== inheritedClientId || existing.status === "void") return false;
      if (Math.abs(Number(existing.total) - t.total) > 0.01) return false;
      if (Math.abs(new Date(existing.issueDate).getTime() - new Date(issueDate).getTime()) > 7 * 86400000) return false;
      return itemSignature(existing.items) === signature;
    });
    if (duplicate) return fail(`Possible duplicate invoice: ${duplicate.number} has the same client, total and line items within 7 days. Review it before creating another.`, 409);
    const number = str(body.number) || (await nextDocumentNumber(userId, "invoice"));
    const [row] = await db
      .insert(invoices)
      .values({
        userId,
        clientId: inheritedClientId || null,
        projectId: inheritedProjectId || null,
        quotationId: quotationId || null,
        number,
        status: str(body.status) || "sent",
        issueDate,
        dueDate,
        subtotal: money(t.subtotal),
        discountType,
        discountValue: money(discountValue),
        taxRate: money(taxRate),
        total: money(t.total),
        notes: str(body.notes),
      })
      .returning();
    await db.insert(invoiceItems).values(
      items.map((item) => ({
        invoiceId: row.id,
        description: item.description,
        quantity: money(item.quantity),
        unitPrice: money(item.unitPrice),
        amount: money(item.amount),
      })),
    );
    if (quotationId) {
      await db.update(quotations).set({ status: "converted" }).where(eq(quotations.id, quotationId));
    }
    await logActivity(userId, "invoice", `Created ${row.status === "draft" ? "draft " : ""}invoice ${row.number}`, "success", `${items.length} line item(s); total ${row.total}.`, { invoiceId: row.id });
    await notify(userId, `Invoice ${row.number} created`, `${row.number} totals ${row.total} and is ${row.status === "draft" ? "saved as a draft" : "issued and awaiting payment"}.`, "info");
    return { invoice: toInvoiceDTO(ledger, { ...row, items }) };
  }

  if (resource === "payments") {
    const invoiceId = str(body.invoiceId);
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .limit(1);
    if (!invoice) return fail("Invoice not found", 404);
    const amount = round2(num(body.amount));
    if (amount <= 0) return fail("Payment amount must be greater than zero.");
    const paid = ledger.payments
      .filter((p) => p.invoiceId === invoice.id && p.status === "completed")
      .reduce((s, p) => s + num(p.amount), 0);
    const balance = round2(num(invoice.total) - paid);
    if (amount > balance + 0.01) return fail(`Payment exceeds the invoice balance of ${balance.toFixed(2)}.`);

    const [row] = await db
      .insert(payments)
      .values({
        userId,
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        amount: money(amount),
        method: str(body.method) || "bank_transfer",
        status: "completed",
        transactionId: str(body.transactionId) || `MANUAL-${Date.now().toString(36).toUpperCase()}`,
        note: str(body.note),
        paidAt: str(body.paidAt) || today(),
      })
      .returning();

    const newPaid = round2(paid + amount);
    await db
      .update(invoices)
      .set({
        amountPaid: money(newPaid),
        status: newPaid >= num(invoice.total) - 0.01 ? "paid" : "partially_paid",
      })
      .where(eq(invoices.id, invoice.id));

    await logActivity(userId, "payment", `Recorded payment for ${invoice.number}`, "success", `${amount.toFixed(2)} received via ${row.method}; transaction ${row.transactionId}.`, { paymentId: row.id, invoiceId: invoice.id });
    await notify(userId, `Payment received · ${invoice.number}`, `${amount.toFixed(2)} was recorded. The invoice is ${newPaid >= num(invoice.total) - 0.01 ? "paid in full" : "partially paid"}.`, "success");
    return { payment: toPaymentDTO(ledger, row) };
  }

  if (resource === "expenses") {
    const amount = round2(num(body.amount));
    if (amount <= 0) return fail("Expense amount must be greater than zero.");
    const [row] = await db
      .insert(expenses)
      .values({
        userId,
        projectId: str(body.projectId) || null,
        category: !body.category || str(body.category) === "auto" ? suggestExpenseCategory(str(body.vendor), str(body.description)) : str(body.category),
        vendor: str(body.vendor),
        description: str(body.description),
        amount: money(amount),
        taxAmount: money(num(body.taxAmount)),
        paymentMethod: str(body.paymentMethod) || "card",
        expenseDate: str(body.expenseDate) || today(),
        receiptUrl: str(body.receiptUrl),
        isRecurring: Boolean(body.isRecurring),
      })
      .returning();
    await logActivity(userId, "expense", `Recorded ${row.category} expense`, "success", `${row.vendor || row.description || "Business expense"}: ${row.amount}.`, { expenseId: row.id });
    await notify(userId, "Expense recorded", `${row.vendor || row.description || row.category}: ${row.amount}. Category: ${row.category}.`, "info");
    return { expense: toExpenseDTO(ledger, row) };
  }

  return fail("Unknown resource", 404);
}

function existingItems(ledger: Ledger, invoiceId: string) {
  return ledger.invoices.find((invoice) => invoice.id === invoiceId)?.items ?? [];
}

export async function updateResource(
  userId: string,
  resource: Resource,
  id: string,
  body: Record<string, unknown>,
) {
  const ledger = await loadLedger(userId);
  if (!ledger) return fail("Business profile not found", 404);

  if (resource === "clients") {
    const [existing] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.userId, userId)))
      .limit(1);
    if (!existing) return fail("Client not found", 404);
    const [row] = await db
      .update(clients)
      .set({
        name: body.name !== undefined ? str(body.name) : existing.name,
        company: body.company !== undefined ? str(body.company) : existing.company,
        email: body.email !== undefined ? str(body.email) : existing.email,
        phone: body.phone !== undefined ? str(body.phone) : existing.phone,
        country: body.country !== undefined ? str(body.country) : existing.country,
        address: body.address !== undefined ? str(body.address) : existing.address,
        notes: body.notes !== undefined ? str(body.notes) : existing.notes,
        paymentTermsDays:
          body.paymentTermsDays !== undefined
            ? Math.max(0, Math.round(num(body.paymentTermsDays, existing.paymentTermsDays)))
            : existing.paymentTermsDays,
      })
      .where(eq(clients.id, id))
      .returning();
    return { client: toClientDTO(row) };
  }

  if (resource === "projects") {
    const [existing] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, userId)))
      .limit(1);
    if (!existing) return fail("Project not found", 404);
    const [row] = await db
      .update(projects)
      .set({
        name: body.name !== undefined ? str(body.name) : existing.name,
        clientId: body.clientId !== undefined ? str(body.clientId) || null : existing.clientId,
        description: body.description !== undefined ? str(body.description) : existing.description,
        status: body.status !== undefined ? str(body.status) : existing.status,
        budget: body.budget !== undefined ? money(num(body.budget)) : existing.budget,
        startDate: body.startDate !== undefined ? str(body.startDate) : existing.startDate,
        endDate: body.endDate !== undefined ? str(body.endDate) : existing.endDate,
      })
      .where(eq(projects.id, id))
      .returning();
    const fresh = await loadLedger(userId);
    return { project: fresh ? toProjectDTO(fresh, row) : null };
  }

  if (resource === "quotations") {
    const [existing] = await db
      .select()
      .from(quotations)
      .where(and(eq(quotations.id, id), eq(quotations.userId, userId)))
      .limit(1);
    if (!existing) return fail("Quotation not found", 404);
    const [row] = await db
      .update(quotations)
      .set({
        status: body.status !== undefined ? str(body.status) : existing.status,
        notes: body.notes !== undefined ? str(body.notes) : existing.notes,
        validUntil: body.validUntil !== undefined ? str(body.validUntil) : existing.validUntil,
      })
      .where(eq(quotations.id, id))
      .returning();
    return { quotation: toQuotationDTO(ledger, { ...row, items: ledger.quotations.find((q) => q.id === id)?.items ?? [] }) };
  }

  if (resource === "invoices") {
    const [existing] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
      .limit(1);
    if (!existing) return fail("Invoice not found", 404);

    const financialFields = ["items", "clientId", "projectId", "issueDate", "discountType", "discountValue", "taxRate"];
    const editingFinancials = financialFields.some((field) => body[field] !== undefined);
    if (editingFinancials && existing.status !== "draft") return fail("Only draft invoices can have their client or financial details edited. Duplicate the invoice to make a new version.", 409);
    if (body.status !== undefined && !["draft", "sent", "void", "paid", "partially_paid"].includes(str(body.status))) return fail("Invalid invoice status.");

    const items = body.items !== undefined ? parseItems(body.items) : existingItems(ledger, id);
    const clientId = body.clientId !== undefined ? str(body.clientId) : existing.clientId ?? "";
    const projectId = body.projectId !== undefined ? str(body.projectId) || null : existing.projectId;
    const issueDate = body.issueDate !== undefined ? str(body.issueDate) : existing.issueDate;
    const dueDate = body.dueDate !== undefined ? str(body.dueDate) : existing.dueDate;
    const discountType = body.discountType !== undefined ? str(body.discountType) : existing.discountType;
    const discountValue = body.discountValue !== undefined ? num(body.discountValue) : num(existing.discountValue);
    const taxRate = body.taxRate !== undefined ? num(body.taxRate) : num(existing.taxRate);

    if (editingFinancials || body.dueDate !== undefined) {
      const validationError = validateDocument(ledger, { clientId, items, discountType, discountValue, taxRate, issueDate, dueDate });
      if (validationError) return fail(validationError);
    }
    if (projectId && !ledger.projects.some((project) => project.id === projectId)) return fail("Select a valid project.");

    const totals = computeTotals(items, discountType, discountValue, taxRate);
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({
        clientId: clientId || null,
        projectId,
        issueDate,
        dueDate,
        subtotal: money(editingFinancials ? totals.subtotal : num(existing.subtotal)),
        discountType,
        discountValue: money(discountValue),
        taxRate: money(taxRate),
        total: money(editingFinancials ? totals.total : num(existing.total)),
        notes: body.notes !== undefined ? str(body.notes) : existing.notes,
        status: body.status !== undefined ? str(body.status) : existing.status,
      }).where(eq(invoices.id, id));
      if (body.items !== undefined) {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
        if (items.length) {
          await tx.insert(invoiceItems).values(items.map((item) => ({
            invoiceId: id,
            description: item.description,
            quantity: money(item.quantity),
            unitPrice: money(item.unitPrice),
            amount: money(item.amount),
          })));
        }
      }
    });

    const paid = ledger.payments
      .filter((p) => p.invoiceId === id && p.status === "completed")
      .reduce((s, p) => s + num(p.amount), 0);
    const balance = round2(num(existing.total) - paid);
    if (body.status === "paid" && balance > 0.01) {
      await db.insert(payments).values({
        userId,
        invoiceId: id,
        clientId: existing.clientId,
        amount: money(balance),
        method: str(body.method) || "bank_transfer",
        status: "completed",
        transactionId: `MANUAL-${Date.now().toString(36).toUpperCase()}`,
        note: "Marked as paid manually",
        paidAt: today(),
      });
      await db.update(invoices).set({ amountPaid: money(num(existing.total)), status: "paid" }).where(eq(invoices.id, id));
    }

    if (existing.status === "draft" && body.status === "sent") {
      await logActivity(userId, "invoice", `Issued invoice ${existing.number}`, "success", "The invoice is ready to share with the client.", { invoiceId: id });
      await notify(userId, `Invoice ${existing.number} issued`, `${existing.number} is ready to share. Total due: ${totals.total.toFixed(2)}.`, "success");
    }
    const fresh = await loadLedger(userId);
    const row = fresh?.invoices.find((i) => i.id === id);
    return { invoice: fresh && row ? toInvoiceDTO(fresh, row) : null };
  }

  if (resource === "payments") {
    const [existing] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.id, id), eq(payments.userId, userId)))
      .limit(1);
    if (!existing) return fail("Payment not found", 404);
    const [row] = await db
      .update(payments)
      .set({
        status: body.status !== undefined ? str(body.status) : existing.status,
        note: body.note !== undefined ? str(body.note) : existing.note,
      })
      .where(eq(payments.id, id))
      .returning();

    if (existing.invoiceId && body.status !== undefined && str(body.status) !== "completed") {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, existing.invoiceId)).limit(1);
      if (invoice) {
        const remaining = Math.max(0, round2(num(invoice.amountPaid) - num(existing.amount)));
        await db
          .update(invoices)
          .set({
            amountPaid: money(remaining),
            status: remaining <= 0.01 ? "sent" : "partially_paid",
          })
          .where(eq(invoices.id, invoice.id));
      }
    }
    return { payment: toPaymentDTO(ledger, row) };
  }

  if (resource === "expenses") {
    const [existing] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .limit(1);
    if (!existing) return fail("Expense not found", 404);
    const [row] = await db
      .update(expenses)
      .set({
        category: body.category !== undefined ? str(body.category) : existing.category,
        vendor: body.vendor !== undefined ? str(body.vendor) : existing.vendor,
        description: body.description !== undefined ? str(body.description) : existing.description,
        amount: body.amount !== undefined ? money(num(body.amount)) : existing.amount,
        taxAmount: body.taxAmount !== undefined ? money(num(body.taxAmount)) : existing.taxAmount,
        paymentMethod: body.paymentMethod !== undefined ? str(body.paymentMethod) : existing.paymentMethod,
        expenseDate: body.expenseDate !== undefined ? str(body.expenseDate) : existing.expenseDate,
        isRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : existing.isRecurring,
        projectId: body.projectId !== undefined ? str(body.projectId) || null : existing.projectId,
      })
      .where(eq(expenses.id, id))
      .returning();
    return { expense: toExpenseDTO(ledger, row) };
  }

  return fail("Unknown resource", 404);
}

export async function deleteResource(userId: string, resource: Resource, id: string) {
  const tables = { clients, projects, quotations, invoices, payments, expenses } as const;
  const table = tables[resource];
  const deleted = await db.delete(table).where(and(eq(table.id, id), eq(table.userId, userId))).returning();
  if (!deleted.length) return fail("Record not found", 404);
  return { ok: true };
}
