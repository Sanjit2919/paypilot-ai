"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Loader2, Pencil, Plus, Receipt, Send, Share2, Trash2, X } from "lucide-react";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { useWorkspace } from "@/components/WorkspaceContext";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { ClientDTO, InvoiceDTO, LineItemDTO, ProjectDTO, QuotationDTO } from "@/lib/types";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Skeleton,
  StatCard,
  Tabs,
  ToastHost,
  statusTone,
  useToast,
} from "@/components/ui";

type ItemDraft = { description: string; quantity: string; unitPrice: string };

function computeTotals(items: ItemDraft[], discountType: string, discountValue: number, taxRate: number) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  const discount = discountType === "fixed" ? Math.min(discountValue, subtotal) : (subtotal * discountValue) / 100;
  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * taxRate) / 100;
  return { subtotal, discount, tax, total: taxable + tax };
}

function LineItemsEditor({
  items,
  onChange,
  currency,
}: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  currency: string;
}) {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0);
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 items-end gap-2">
          <div className="col-span-12 sm:col-span-6">
            <input
              className="input"
              placeholder="Description"
              value={item.description}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, description: event.target.value };
                onChange(next);
              }}
            />
          </div>
          <div className="col-span-3 sm:col-span-2">
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              placeholder="Qty"
              value={item.quantity}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, quantity: event.target.value };
                onChange(next);
              }}
            />
          </div>
          <div className="col-span-4 sm:col-span-2">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              placeholder="Unit price"
              value={item.unitPrice}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, unitPrice: event.target.value };
                onChange(next);
              }}
            />
          </div>
          <div className="col-span-4 flex items-center justify-end gap-1 sm:col-span-2">
            <span className="text-xs text-slate-500">
              {formatMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), currency)}
            </span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="btn btn-ghost !p-1 text-slate-400 hover:text-[#b42318]"
              aria-label="Remove line"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...items, { description: "", quantity: "1", unitPrice: "" }])}
          className="btn btn-secondary !py-1.5 text-xs"
        >
          <Plus className="h-3.5 w-3.5" /> Add line item
        </button>
        <span className="text-xs text-slate-500">
          Subtotal <span className="font-semibold text-navy">{formatMoney(subtotal, currency)}</span>
        </span>
      </div>
    </div>
  );
}

function DocumentTotals({
  subtotal,
  discount,
  tax,
  total,
  currency,
}: {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
}) {
  return (
    <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex justify-between text-slate-600">
        <span>Subtotal</span>
        <span>{formatMoney(subtotal, currency)}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Discount</span>
        <span>−{formatMoney(discount, currency)}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>Tax</span>
        <span>{formatMoney(tax, currency)}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-navy">
        <span>Total</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
    </div>
  );
}

const emptyItem: ItemDraft = { description: "", quantity: "1", unitPrice: "" };

export function QuotationsView() {
  const searchParams = useSearchParams();
  const openFromSearch = searchParams.get("new");
  const highlightedId = searchParams.get("highlight");
  const { data, loading, error, reload } = useApi<{ quotations: QuotationDTO[] }>("/api/data/quotations");
  const clients = useApi<{ clients: ClientDTO[] }>("/api/data/clients");
  const projects = useApi<{ projects: ProjectDTO[] }>("/api/data/projects");
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    projectId: "",
    validUntil: "",
    discountType: "percent",
    discountValue: "0",
    taxRate: "0",
    notes: "",
    status: "draft",
    items: [{ ...emptyItem }] as ItemDraft[],
  });

  const currency = useWorkspace().currency;
  useEffect(() => { if (openFromSearch === "1") setOpen(true); }, [openFromSearch]);
  const quotations = data?.quotations ?? [];
  const totals = useMemo(
    () => computeTotals(form.items, form.discountType, Number(form.discountValue) || 0, Number(form.taxRate) || 0),
    [form.items, form.discountType, form.discountValue, form.taxRate],
  );

  async function create() {
    setSaving(true);
    try {
      await apiSend("/api/data/quotations", "POST", {
        clientId: form.clientId,
        projectId: form.projectId,
        validUntil: form.validUntil,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        taxRate: Number(form.taxRate) || 0,
        notes: form.notes,
        status: form.status,
        items: form.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      });
      show("success", "Quotation created by the Invoice Agent.");
      setOpen(false);
      setForm({ ...form, items: [{ ...emptyItem }], notes: "", clientId: "", projectId: "" });
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await apiSend(`/api/data/quotations/${id}`, "PATCH", { status });
      show("success", `Quotation marked ${status}.`);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function convert(quotation: QuotationDTO) {
    setBusy(quotation.id);
    try {
      const result = await apiSend<{ invoice: InvoiceDTO }>("/api/data/invoices", "POST", {
        clientId: quotation.clientId ?? "",
        projectId: quotation.projectId ?? "",
        quotationId: quotation.id,
        items: quotation.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discountType: quotation.discountType,
        discountValue: quotation.discountValue,
        taxRate: quotation.taxRate,
        status: "sent",
        notes: `Converted from quotation ${quotation.number}.`,
      });
      show("success", `Invoice ${result.invoice.number} created from ${quotation.number}.`);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await apiSend(`/api/data/quotations/${id}`, "DELETE");
      show("success", "Quotation deleted.");
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const totalValue = quotations.reduce((sum, q) => sum + q.total, 0);
  const accepted = quotations.filter((q) => q.status === "accepted").length;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Quotations"
        subtitle="Draft, send and convert proposals. Accepted quotations become invoices with one click."
        actions={
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New quotation
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total quoted" value={formatMoney(totalValue, currency)} hint={`${quotations.length} document(s)`} />
        <StatCard label="Accepted" value={String(accepted)} hint="Ready to convert" tone="green" />
        <StatCard
          label="Awaiting decision"
          value={String(quotations.filter((q) => q.status === "sent").length)}
          hint="Sent to clients"
          tone="amber"
        />
      </div>

      <Card className="!p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton rows={3} />
          </div>
        ) : quotations.length ? (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {quotations.map((quotation) => (
              <div key={quotation.id} className={`p-4 ${highlightedId === quotation.id ? "bg-brand-soft/60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-navy">{quotation.number}</p>
                    <p className="truncate text-[12px] text-slate-600">{quotation.clientName}</p>
                  </div>
                  <Badge tone={statusTone(quotation.status)}>{quotation.status}</Badge>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</p><p className="text-[12px] font-bold text-navy">{formatMoney(quotation.total, currency)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Issued</p><p className="text-[12px] text-slate-600">{formatDate(quotation.issueDate)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Valid to</p><p className="text-[12px] text-slate-600">{formatDate(quotation.validUntil)}</p></div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {quotation.status !== "accepted" && quotation.status !== "converted" ? (
                    <button type="button" onClick={() => setStatus(quotation.id, "accepted")} disabled={busy === quotation.id} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]">Accept</button>
                  ) : null}
                  {quotation.status !== "converted" ? (
                    <button type="button" onClick={() => convert(quotation)} disabled={busy === quotation.id} className="btn btn-primary !px-2.5 !py-1.5 text-[11px]">{busy === quotation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Receipt className="h-3 w-3" />} Convert</button>
                  ) : <Badge tone="green">Converted</Badge>}
                  <button type="button" onClick={() => remove(quotation.id)} disabled={busy === quotation.id} className="btn btn-ghost ml-auto !p-1.5 text-slate-400 hover:text-[#b42318]" aria-label={`Delete ${quotation.number}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Number</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Issued</th>
                  <th className="px-4 py-3">Valid until</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((quotation) => (
                  <tr key={quotation.id} className={`hover:bg-slate-50/70 ${highlightedId === quotation.id ? "bg-brand-soft/60 ring-1 ring-inset ring-brand/25" : ""}`}>
                    <td className="px-4 py-3 font-medium text-navy">{quotation.number}</td>
                    <td className="px-4 py-3 text-slate-600">{quotation.clientName}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(quotation.issueDate)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(quotation.validUntil)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">
                      {formatMoney(quotation.total, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(quotation.status)}>{quotation.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {quotation.status !== "accepted" && quotation.status !== "converted" ? (
                          <button
                            type="button"
                            onClick={() => setStatus(quotation.id, "accepted")}
                            disabled={busy === quotation.id}
                            className="btn btn-secondary !px-2 !py-1 text-xs"
                          >
                            Accept
                          </button>
                        ) : null}
                        {quotation.status !== "converted" ? (
                          <button
                            type="button"
                            onClick={() => convert(quotation)}
                            disabled={busy === quotation.id}
                            className="btn btn-primary !px-2 !py-1 text-xs"
                          >
                            {busy === quotation.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Receipt className="h-3 w-3" />}
                            Convert
                          </button>
                        ) : (
                          <Badge tone="green">Converted</Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => remove(quotation.id)}
                          disabled={busy === quotation.id}
                          className="btn btn-ghost !p-1.5 text-slate-400 hover:text-[#b42318]"
                          aria-label="Delete quotation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-4">
            <EmptyState
              title="No quotations yet"
              description="Create your first quotation with line items, discount and tax. The Invoice Agent will number it automatically."
              action={
                <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
                  <Plus className="h-4 w-4" /> New quotation
                </button>
              }
            />
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New quotation" description="Line items, discount and tax are calculated automatically." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <select
              className="input"
              value={form.clientId}
              onChange={(event) => setForm({ ...form, clientId: event.target.value })}
            >
              <option value="">Select client</option>
              {clients.data?.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company ? `· ${client.company}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project (optional)">
            <select
              className="input"
              value={form.projectId}
              onChange={(event) => setForm({ ...form, projectId: event.target.value })}
            >
              <option value="">No project</option>
              {projects.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Valid until">
            <input
              className="input"
              type="date"
              value={form.validUntil}
              onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
            />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </select>
          </Field>
          <Field label="Discount type">
            <select
              className="input"
              value={form.discountType}
              onChange={(event) => setForm({ ...form, discountType: event.target.value })}
            >
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </Field>
          <Field label="Discount value">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </Field>
          <Field label="Tax rate (%)">
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={form.taxRate}
              onChange={(event) => setForm({ ...form, taxRate: event.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input
              className="input"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="Payment terms, validity…"
            />
          </Field>
        </div>

        <div className="mt-4">
          <p className="label">Line items</p>
          <LineItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} currency={currency} />
        </div>

        <div className="mt-4">
          <DocumentTotals
            subtotal={totals.subtotal}
            discount={totals.discount}
            tax={totals.tax}
            total={totals.total}
            currency={currency}
          />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={create} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Create quotation
          </button>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}

export function InvoicesView() {
  const searchParams = useSearchParams();
  const openFromSearch = searchParams.get("new");
  const highlightedId = searchParams.get("highlight");
  const { data, loading, error, reload } = useApi<{ invoices: InvoiceDTO[] }>("/api/data/invoices");
  const clients = useApi<{ clients: ClientDTO[] }>("/api/data/clients");
  const projects = useApi<{ projects: ProjectDTO[] }>("/api/data/projects");
  const quotations = useApi<{ quotations: QuotationDTO[] }>("/api/data/quotations");
  const { toast, show, clear } = useToast();
  const [tab, setTab] = useState<"all" | "open" | "overdue" | "paid" | "draft">("all");
  const [open, setOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceDTO | null>(null);
  const [share, setShare] = useState<{ invoiceId: string; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    clientId: "",
    projectId: "",
    quotationId: "",
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    discountType: "percent",
    discountValue: "0",
    taxRate: "0",
    notes: "",
    status: "sent",
    items: [{ ...emptyItem }] as ItemDraft[],
  });

  const invoices = data?.invoices ?? [];
  const currency = useWorkspace().currency;
  useEffect(() => { if (openFromSearch === "1") setOpen(true); }, [openFromSearch]);
  useEffect(() => { if (highlightedId) setTab("all"); }, [highlightedId]);
  const filtered = invoices.filter((invoice) => {
    if (tab === "all") return true;
    if (tab === "open") return ["sent", "partially_paid", "overdue"].includes(invoice.status);
    if (tab === "overdue") return invoice.status === "overdue";
    if (tab === "paid") return invoice.status === "paid";
    return invoice.status === "draft";
  });
  const totals = useMemo(
    () => computeTotals(form.items, form.discountType, Number(form.discountValue) || 0, Number(form.taxRate) || 0),
    [form.items, form.discountType, form.discountValue, form.taxRate],
  );

  function openCreate() {
    setEditingInvoice(null);
    setForm({
      clientId: "", projectId: "", quotationId: "", issueDate: new Date().toISOString().slice(0, 10), dueDate: "",
      discountType: "percent", discountValue: "0", taxRate: "0", notes: "", status: "sent", items: [{ ...emptyItem }],
    });
    setOpen(true);
  }

  function openEditor(invoice: InvoiceDTO) {
    setEditingInvoice(invoice);
    setForm({
      clientId: invoice.clientId ?? "",
      projectId: invoice.projectId ?? "",
      quotationId: invoice.quotationId ?? "",
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      discountType: invoice.discountType,
      discountValue: String(invoice.discountValue),
      taxRate: String(invoice.taxRate),
      notes: invoice.notes,
      status: invoice.status,
      items: invoice.items.map((item) => ({ description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })),
    });
    setOpen(true);
  }

  function closeEditor() {
    setOpen(false);
    setEditingInvoice(null);
  }

  async function create() {
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId,
        projectId: form.projectId,
        quotationId: form.quotationId || undefined,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        discountType: form.discountType,
        discountValue: Number(form.discountValue) || 0,
        taxRate: Number(form.taxRate) || 0,
        notes: form.notes,
        status: form.status,
        items: form.items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      };
      const result = editingInvoice
        ? await apiSend<{ invoice: InvoiceDTO }>(`/api/data/invoices/${editingInvoice.id}`, "PATCH", payload)
        : await apiSend<{ invoice: InvoiceDTO }>("/api/data/invoices", "POST", payload);
      show("success", `Invoice ${result.invoice.number} ${editingInvoice ? "updated" : "created"}.`);
      closeEditor();
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function issueInvoice(invoice: InvoiceDTO) {
    setBusy(invoice.id);
    try {
      await apiSend(`/api/data/invoices/${invoice.id}`, "PATCH", { status: "sent" });
      show("success", `${invoice.number} issued. Create a secure share link when you are ready to send it to the client.`);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally { setBusy(null); }
  }

  async function markPaid(invoice: InvoiceDTO) {
    setBusy(invoice.id);
    try {
      await apiSend(`/api/data/invoices/${invoice.id}`, "PATCH", { status: "paid" });
      show("success", `${invoice.number} marked as paid and a payment record was created.`);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await apiSend(`/api/data/invoices/${id}`, "DELETE");
      show("success", "Invoice deleted.");
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(invoice: InvoiceDTO) {
    setBusy(invoice.id);
    try {
      const result = await apiSend<{ url: string }>(`/api/invoices/${invoice.id}/share`, "POST");
      setShare({ invoiceId: invoice.id, url: result.url });
      try { await navigator.clipboard.writeText(result.url); show("success", "Secure invoice link copied."); }
      catch { show("info", "Secure link ready. Copy it from the dialog."); }
    } catch (err) { show("error", errorMessage(err)); }
    finally { setBusy(null); }
  }

  async function revokeShare() {
    if (!share) return;
    try {
      await apiSend(`/api/invoices/${share.invoiceId}/share`, "DELETE");
      show("success", "Invoice link revoked. The previous URL no longer works.");
      setShare(null);
    } catch (err) { show("error", errorMessage(err)); }
  }

  const outstanding = invoices.reduce((sum, invoice) => sum + invoice.balance, 0);
  const overdue = invoices.filter((invoice) => invoice.status === "overdue");

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Invoices"
        subtitle="Issue invoices with tax and discounts, download PDFs, collect payments and track status."
        actions={
          <button type="button" onClick={openCreate} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New invoice
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding" value={formatMoney(outstanding, currency)} hint={`${invoices.filter((i) => i.balance > 0).length} open invoice(s)`} tone="amber" />
        <StatCard label="Overdue" value={formatMoney(overdue.reduce((s, i) => s + i.balance, 0), currency)} hint={`${overdue.length} invoice(s)`} tone="red" />
        <StatCard label="Collected" value={formatMoney(invoices.reduce((s, i) => s + i.amountPaid, 0), currency)} tone="green" />
        <StatCard label="Drafts" value={String(invoices.filter((i) => i.status === "draft").length)} hint="Not yet issued" />
      </div>

      <div className="mb-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: "all", label: "All", count: invoices.length },
            { key: "open", label: "Open", count: invoices.filter((i) => ["sent", "partially_paid", "overdue"].includes(i.status)).length },
            { key: "overdue", label: "Overdue", count: overdue.length },
            { key: "paid", label: "Paid", count: invoices.filter((i) => i.status === "paid").length },
            { key: "draft", label: "Drafts", count: invoices.filter((i) => i.status === "draft").length },
          ]}
        />
      </div>

      <Card className="!p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton rows={4} />
          </div>
        ) : filtered.length ? (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {filtered.map((invoice) => (
              <div key={invoice.id} className={`p-4 ${highlightedId === invoice.id ? "bg-brand-soft/60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold text-navy">{invoice.number}</p>
                    <p className="truncate text-[12px] text-slate-600">{invoice.clientName}</p>
                  </div>
                  <Badge tone={statusTone(invoice.status)}>{invoice.status.replace("_", " ")}</Badge>
                </div>
                <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total</p><p className="text-[12px] font-bold text-navy">{formatMoney(invoice.total, currency)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Balance</p><p className="text-[12px] font-extrabold text-navy">{formatMoney(invoice.balance, currency)}</p></div>
                  <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Due</p><p className="text-[12px] text-slate-600">{formatDate(invoice.dueDate)}</p></div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <a href={`/api/invoices/${invoice.id}/pdf`} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]"><Download className="h-3 w-3" /> PDF</a>
                  <button type="button" onClick={() => copyLink(invoice)} disabled={busy === invoice.id} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]"><Share2 className="h-3 w-3" /> Share</button>
                  {invoice.status === "draft" ? (
                    <>
                      <button type="button" onClick={() => openEditor(invoice)} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]"><Pencil className="h-3 w-3" /> Edit</button>
                      <button type="button" onClick={() => issueInvoice(invoice)} disabled={busy === invoice.id} className="btn btn-primary !px-2.5 !py-1.5 text-[11px]"><Send className="h-3 w-3" /> Issue</button>
                    </>
                  ) : null}
                  {invoice.balance > 0 && invoice.status !== "draft" ? (
                    <button type="button" onClick={() => markPaid(invoice)} disabled={busy === invoice.id} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]">{busy === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Paid</button>
                  ) : null}
                  <button type="button" onClick={() => remove(invoice.id)} disabled={busy === invoice.id} className="btn btn-ghost ml-auto !p-1.5 text-slate-400 hover:text-[#b42318]" aria-label={`Delete ${invoice.number}`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Due</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((invoice) => (
                  <tr key={invoice.id} className={`hover:bg-slate-50/70 ${highlightedId === invoice.id ? "bg-brand-soft/60 ring-1 ring-inset ring-brand/25" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{invoice.number}</p>
                      <p className="text-xs text-slate-500">Issued {formatDate(invoice.issueDate)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{invoice.clientName}</p>
                      {invoice.projectName ? <p className="text-xs text-slate-500">{invoice.projectName}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(invoice.dueDate)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatMoney(invoice.total, currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(invoice.balance, currency)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(invoice.status)}>{invoice.status.replace("_", " ")}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <a
                          href={`/api/invoices/${invoice.id}/pdf`}
                          className="btn btn-secondary !px-2 !py-1 text-xs"
                          title="Download PDF"
                        >
                          <Download className="h-3 w-3" /> PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => copyLink(invoice)}
                          disabled={busy === invoice.id}
                          className="btn btn-ghost !p-1.5 text-slate-400 hover:text-brand"
                          title="Create a secure, revocable invoice link"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        {invoice.status === "draft" ? (
                          <>
                            <button type="button" onClick={() => openEditor(invoice)} className="btn btn-secondary !px-2 !py-1 text-xs"><Pencil className="h-3 w-3" /> Edit</button>
                            <button type="button" onClick={() => issueInvoice(invoice)} disabled={busy === invoice.id} className="btn btn-primary !px-2 !py-1 text-xs"><Send className="h-3 w-3" /> Issue</button>
                          </>
                        ) : null}
                        {invoice.balance > 0 && invoice.status !== "draft" ? (
                          <button
                            type="button"
                            onClick={() => markPaid(invoice)}
                            disabled={busy === invoice.id}
                            className="btn btn-secondary !px-2 !py-1 text-xs"
                          >
                            {busy === invoice.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                            Mark paid
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => remove(invoice.id)}
                          disabled={busy === invoice.id}
                          className="btn btn-ghost !p-1.5 text-slate-400 hover:text-[#b42318]"
                          aria-label="Delete invoice"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <div className="p-4">
            <EmptyState
              title="No invoices in this view"
              description="Create an invoice or convert an accepted quotation to get started."
              action={
                <button type="button" onClick={openCreate} className="btn btn-primary">
                  <Plus className="h-4 w-4" /> New invoice
                </button>
              }
            />
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="New invoice" description="Tax and discounts are applied to the line items automatically." wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <select className="input" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
              <option value="">Select client</option>
              {clients.data?.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company ? `· ${client.company}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Project (optional)">
            <select className="input" value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })}>
              <option value="">No project</option>
              {projects.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Convert from quotation (optional)">
            <select
              className="input"
              value={form.quotationId}
              onChange={(event) => {
                const quotation = quotations.data?.quotations.find((q) => q.id === event.target.value);
                setForm({
                  ...form,
                  quotationId: event.target.value,
                  clientId: quotation?.clientId ?? form.clientId,
                  projectId: quotation?.projectId ?? form.projectId,
                  taxRate: quotation ? String(quotation.taxRate) : form.taxRate,
                  items: quotation
                    ? quotation.items.map((item) => ({
                        description: item.description,
                        quantity: String(item.quantity),
                        unitPrice: String(item.unitPrice),
                      }))
                    : form.items,
                });
              }}
            >
              <option value="">Enter manually</option>
              {quotations.data?.quotations
                .filter((quotation) => quotation.status !== "converted")
                .map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>
                    {quotation.number} · {quotation.clientName} · {formatMoney(quotation.total, currency)}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
            </select>
          </Field>
          <Field label="Issue date">
            <input className="input" type="date" value={form.issueDate} onChange={(event) => setForm({ ...form, issueDate: event.target.value })} />
          </Field>
          <Field label="Due date">
            <input className="input" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
          </Field>
          <Field label="Discount type">
            <select className="input" value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
            </select>
          </Field>
          <Field label="Discount value">
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </Field>
          <Field label="Tax rate (%)">
            <input
              className="input"
              type="number"
              min="0"
              step="0.5"
              value={form.taxRate}
              onChange={(event) => setForm({ ...form, taxRate: event.target.value })}
            />
          </Field>
          <Field label="Notes">
            <input className="input" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Payment instructions" />
          </Field>
        </div>

        <div className="mt-4">
          <p className="label">Line items</p>
          <LineItemsEditor items={form.items} onChange={(items) => setForm({ ...form, items })} currency={currency} />
        </div>

        <div className="mt-4">
          <DocumentTotals subtotal={totals.subtotal} discount={totals.discount} tax={totals.tax} total={totals.total} currency={currency} />
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={closeEditor} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={create} disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {editingInvoice ? "Save draft" : "Create invoice"}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(share)} onClose={() => setShare(null)} title="Secure invoice link" description="Anyone with this link can view this invoice only. You can revoke it at any time.">
        <div className="space-y-4">
          <Field label="Client-facing invoice URL">
            <input className="input" readOnly value={share?.url ?? ""} onFocus={(event) => event.target.select()} />
          </Field>
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={revokeShare} className="btn btn-danger">Revoke link</button>
            <button type="button" onClick={async () => { if (!share) return; try { await navigator.clipboard.writeText(share.url); show("success", "Invoice link copied."); } catch { show("error", "Clipboard access was blocked. Select the URL above to copy it."); } }} className="btn btn-primary"><Share2 className="h-4 w-4" />Copy link</button>
          </div>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}

export function documentStatusLabel(status: string) {
  return titleCase(status);
}
