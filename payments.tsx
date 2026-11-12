"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Plus, Receipt, Wallet } from "lucide-react";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { useWorkspace } from "@/components/WorkspaceContext";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { InvoiceDTO, PaymentDTO } from "@/lib/types";
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
  ToastHost,
  statusTone,
  useToast,
} from "@/components/ui";

export function PaymentsView() {
  const { data, loading, error, reload } = useApi<{ payments: PaymentDTO[] }>("/api/data/payments");
  const invoices = useApi<{ invoices: InvoiceDTO[] }>("/api/data/invoices");
  const paypal = useApi<{ configured: boolean; mode: string }>("/api/paypal/status");
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paypalInvoice, setPaypalInvoice] = useState("");
  const [approvedOrder, setApprovedOrder] = useState<{ orderId: string; invoiceId: string } | null>(null);
  const [paypalBusy, setPaypalBusy] = useState(false);
  const [demoOrder, setDemoOrder] = useState<{ orderId: string; invoiceId: string; amount: number } | null>(null);
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    invoiceId: "",
    amount: "",
    method: "bank_transfer",
    paidAt: new Date().toISOString().slice(0, 10),
    note: "",
  });

  const payments = data?.payments ?? [];
  const openInvoices = (invoices.data?.invoices ?? []).filter((invoice) => invoice.balance > 0 && invoice.status !== "draft");
  const currency = useWorkspace().currency;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("paypal");
    const invoiceId = params.get("invoice");
    const orderId = params.get("token");
    if (status === "success" && invoiceId && orderId) {
      setReturnNotice("PayPal approved the order. Verify and capture the payment to finalise it.");
      setPaypalInvoice(invoiceId);
      setApprovedOrder({ invoiceId, orderId });
    } else if (status === "success") {
      setReturnNotice("PayPal did not return an order ID. No payment was recorded; please retry checkout.");
    } else if (status === "cancelled") { 
      setReturnNotice("PayPal checkout was cancelled. No payment was captured.");
    }
  }, []);

  async function recordPayment() {
    setSaving(true);
    try {
      await apiSend("/api/data/payments", "POST", {
        invoiceId: form.invoiceId,
        amount: Number(form.amount) || 0,
        method: form.method,
        paidAt: form.paidAt,
        note: form.note,
      });
      show("success", "Payment recorded and invoice updated.");
      setOpen(false);
      setForm({ ...form, invoiceId: "", amount: "", note: "" });
      await reload();
      invoices.reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function startPaypal() {
    if (!paypalInvoice) {
      show("error", "Select an invoice to pay.");
      return;
    }
    setPaypalBusy(true);
    try {
      const result = await apiSend<{ mode: string; orderId: string; approveUrl: string | null; message: string }>(
        "/api/paypal/create-order",
        "POST",
        { invoiceId: paypalInvoice },
      );
      if (result.approveUrl) {
        window.location.assign(result.approveUrl);
      } else {
        const invoice = openInvoices.find((i) => i.id === paypalInvoice);
        setDemoOrder({ orderId: result.orderId, invoiceId: paypalInvoice, amount: invoice?.balance ?? 0 });
        show("info", result.message);
      }
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setPaypalBusy(false);
    }
  }

  async function capture(orderId: string, invoiceId: string) {
    setPaypalBusy(true);
    try {
      const result = await apiSend<{ message: string; mode: string }>("/api/paypal/capture", "POST", {
        orderId,
        invoiceId,
        confirmDemo: orderId.startsWith("DEMO-"),
      });
      show(result.mode === "demo" ? "info" : "success", result.message);
      setDemoOrder(null);
      setApprovedOrder(null);
      setReturnNotice(null);
      window.history.replaceState({}, "", "/payments");
      await reload();
      await invoices.reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setPaypalBusy(false);
    }
  }

  const collected = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
  const pending = openInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Payments"
        subtitle="Reconcile incoming payments, collect via PayPal and keep invoice balances accurate."
        actions={
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Record payment
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {returnNotice ? (
        <div className="mb-3">
          <Alert tone="info">{returnNotice}</Alert>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={formatMoney(collected, currency)} hint={`${payments.filter((payment) => payment.status === "completed").length} completed payment(s)`} tone="green" icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Awaiting collection" value={formatMoney(pending, currency)} hint={`${openInvoices.length} open invoice(s)`} tone="amber" />
        <StatCard
          label="PayPal integration"
          value={paypal.data?.configured ? paypal.data.mode === "live" ? "PayPal live" : "Sandbox ready" : "Demo mode"}
          hint={paypal.data?.configured ? "Server-side credentials detected" : "No credentials configured"}
          tone={paypal.data?.configured ? "green" : "neutral"}
          icon={<CreditCard className="h-4 w-4" />}
        />
      </div>

      {!paypal.data?.configured ? (
        <div className="mb-3">
          <Alert tone="warning" title="PayPal demo mode">
            No PayPal credentials are configured. A demo checkout records a simulation only: no funds move, invoices stay
            open, and cash and revenue figures are not affected. Add server-side PayPal sandbox credentials to test captures.
          </Alert>
        </div>
      ) : null}

      <section className="paypal-panel mb-4 overflow-hidden rounded-[18px] border border-[#0b3a8f] p-5 text-white shadow-[0_20px_50px_-32px_rgba(1,33,105,.9)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white/12 ring-1 ring-white/20">
              <CreditCard className="h-5 w-5 text-[#7fd0f5]" />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-extrabold tracking-tight text-white">Collect a payment with PayPal</h2>
              <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-[#b9d3ea]">
                The order is created server-side with your sandbox credentials. The buyer approves on PayPal, then capture
                verifies the response before the invoice is settled.
              </p>
            </div>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.1em]"
            style={{ background: paypal.data?.configured ? "#009cde26" : "#ffc43926", color: paypal.data?.configured ? "#7fd0f5" : "#ffc439" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
            {paypal.data?.configured ? `${paypal.data.mode} connected` : "Demo mode"}
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-[.1em] text-[#9dc0dd]">Invoice</span>
            <select
              className="input !border-[#0b3a8f] !bg-white/95 !text-[#012169]"
              value={paypalInvoice}
              onChange={(event) => setPaypalInvoice(event.target.value)}
            >
              <option value="">Select an open invoice</option>
              {openInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number} · {invoice.clientName} · {formatMoney(invoice.balance, currency)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={startPaypal}
            disabled={paypalBusy || !paypalInvoice}
            className="btn btn-paypal w-full !border-[#f0b429] !bg-[#ffc439] !font-extrabold !text-[#012169] shadow-[0_6px_16px_-8px_rgba(255,196,57,.65)] disabled:!bg-[#ffd977] disabled:!text-[#5a4a1f] sm:mb-0.5 sm:w-auto"
          >
            {paypalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Create PayPal order
          </button>
        </div>

        {approvedOrder && (
          <div className="mt-3 rounded-[13px] border border-[#7fd0f5]/40 bg-[#009cde]/15 p-3.5">
            <p className="text-xs font-extrabold text-[#a9e0fa]">Order approved · {approvedOrder.orderId}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#c6e3f6]">
              Capture re-reads PayPal&apos;s response and verifies the amount and currency before recording the payment.
            </p>
            <button type="button" onClick={() => capture(approvedOrder.orderId, approvedOrder.invoiceId)} disabled={paypalBusy} className="btn btn-paypal mt-2.5 !px-3.5 !py-2 text-xs !bg-[#ffc439] !text-[#012169] !font-extrabold">
              {paypalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Verify & capture payment
            </button>
          </div>
        )}

        {demoOrder ? (
          <div className="mt-3 rounded-[13px] border border-[#ffc439]/45 bg-[#ffc439]/12 p-3.5">
            <p className="text-xs font-extrabold text-[#ffd98a]">Demo order created · {demoOrder.orderId}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#ffe6b0]">
              You can record a simulated transaction to preview the payment history. The invoice stays open and your real
              cash balance is unchanged.
            </p>
            <button type="button" onClick={() => capture(demoOrder.orderId, demoOrder.invoiceId)} disabled={paypalBusy} className="btn btn-paypal-outline mt-2.5 !px-3.5 !py-2 text-xs">
              {paypalBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Simulate demo payment of {formatMoney(demoOrder.amount, currency)}
            </button>
          </div>
        ) : null}
      </section>

      <Card className="!p-0">
        {loading ? (
          <div className="p-4">
            <Skeleton rows={4} />
          </div>
        ) : payments.length ? (
          <>
          <div className="divide-y divide-slate-100 md:hidden">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-start gap-3 p-4">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${payment.status === "simulated" ? "bg-[#f4f0ff] text-[#6941c6]" : "bg-mint-soft text-[#0b9462]"}`}><Receipt className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-extrabold text-navy">{payment.invoiceNumber}</p>
                      <p className="truncate text-[11px] text-slate-500">{payment.clientName} · {formatDate(payment.paidAt)}</p>
                    </div>
                    <p className={`shrink-0 text-[13px] font-extrabold ${payment.status === "simulated" ? "text-[#6941c6]" : "text-[#087443]"}`}>{payment.status === "simulated" ? "Demo " : "+"}{formatMoney(payment.amount, currency)}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={payment.method.includes("paypal") ? "brand" : "neutral"}>{titleCase(payment.method)}</Badge>
                    <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                    {payment.transactionId ? <span className="truncate text-[10px] text-slate-400">{payment.transactionId}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-600">{formatDate(payment.paidAt)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-navy">
                        <Receipt className="h-3.5 w-3.5 text-slate-400" />
                        {payment.invoiceNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{payment.clientName}</td>
                    <td className="px-4 py-3">
                      <Badge tone={payment.method.includes("paypal") ? "brand" : "neutral"}>{titleCase(payment.method)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{payment.transactionId || "—"}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${payment.status === "simulated" ? "text-[#6941c6]" : "text-[#087443]"}`}>{payment.status === "simulated" ? "Demo " : "+"}{formatMoney(payment.amount, currency)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
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
              title="No payments recorded"
              description="Record a manual payment or collect one through PayPal. Invoice balances update automatically."
              action={
                <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
                  <Plus className="h-4 w-4" /> Record payment
                </button>
              }
            />
          </div>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Record a payment" description="Use this for bank transfers, cash or any offline collection.">
        <div className="space-y-3">
          <Field label="Invoice">
            <select
              className="input"
              value={form.invoiceId}
              onChange={(event) => {
                const invoice = openInvoices.find((i) => i.id === event.target.value);
                setForm({ ...form, invoiceId: event.target.value, amount: invoice ? String(invoice.balance) : "" });
              }}
            >
              <option value="">Select an open invoice</option>
              {openInvoices.map((invoice) => (
                <option key={invoice.id} value={invoice.id}>
                  {invoice.number} · {invoice.clientName} · balance {formatMoney(invoice.balance, currency)}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
              />
            </Field>
            <Field label="Payment date">
              <input className="input" type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} />
            </Field>
            <Field label="Method">
              <select className="input" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="cash">Cash</option>
                <option value="paypal">PayPal</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Note">
              <input className="input" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Reference" />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={recordPayment} disabled={saving || !form.invoiceId} className="btn btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Record payment
            </button>
          </div>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}
