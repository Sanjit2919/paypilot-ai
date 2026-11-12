"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Loader2, Paperclip, Pencil, Plus, Trash2, Users, Wallet } from "lucide-react";
import { ExpenseDonut } from "@/components/charts";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { useWorkspace } from "@/components/WorkspaceContext";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { ClientDTO, ExpenseDTO, InvoiceDTO, PaymentDTO, ProjectDTO } from "@/lib/types";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
  ToastHost,
  statusTone,
  useToast,
} from "@/components/ui";

const EXPENSE_CATEGORIES = [
  "software",
  "marketing",
  "contractor",
  "office",
  "travel",
  "utilities",
  "insurance",
  "equipment",
  "taxes",
  "other",
];

export function ClientsView() {
  const searchParams = useSearchParams();
  const openFromSearch = searchParams.get("new");
  const highlightedId = searchParams.get("highlight");
  const { data, loading, error, reload } = useApi<{ clients: ClientDTO[] }>("/api/data/clients");
  const invoices = useApi<{ invoices: InvoiceDTO[] }>("/api/data/invoices");
  const payments = useApi<{ payments: PaymentDTO[] }>("/api/data/payments");
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "",
    address: "",
    paymentTermsDays: "14",
    notes: "",
  });

  const clients = useMemo(() => data?.clients ?? [], [data]);
  const allInvoices = useMemo(() => invoices.data?.invoices ?? [], [invoices.data]);
  const allPayments = useMemo(() => payments.data?.payments ?? [], [payments.data]);
  const currency = useWorkspace().currency;
  useEffect(() => { if (openFromSearch === "1") setOpen(true); }, [openFromSearch]);
  useEffect(() => { if (highlightedId) setSelected(highlightedId); }, [highlightedId]);

  const profiles = useMemo(
    () =>
      clients.map((client) => {
        const clientInvoices = allInvoices.filter((invoice) => invoice.clientId === client.id);
        const clientPayments = allPayments.filter((payment) => payment.clientId === client.id && payment.status === "completed");
        const paid = clientPayments.reduce((sum, payment) => sum + payment.amount, 0);
        const outstanding = clientInvoices.reduce((sum, invoice) => sum + invoice.balance, 0);
        const overdue = clientInvoices.filter((i) => i.status === "overdue").reduce((sum, i) => sum + i.balance, 0);
        const paidInvoices = clientInvoices.filter((i) => i.status === "paid");
        const onTime = paidInvoices.filter((invoice) => {
          const payment = clientPayments.find((p) => p.invoiceId === invoice.id);
          return payment ? payment.paidAt <= invoice.dueDate : false;
        }).length;
        const onTimeRate = paidInvoices.length ? Math.round((onTime / paidInvoices.length) * 100) : 100;
        return {
          ...client,
          invoiced: clientInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
          paid,
          outstanding,
          overdue,
          invoiceCount: clientInvoices.length,
          onTimeRate,
          risk: overdue > 0 || onTimeRate < 60 ? "high" : onTimeRate < 85 ? "medium" : "low",
        };
      }),
    [clients, allInvoices, allPayments],
  );

  function openCreate() {
    setEditing(null);
    setForm({ name: "", company: "", email: "", phone: "", country: "", address: "", paymentTermsDays: "14", notes: "" });
    setOpen(true);
  }

  function openEdit(client: ClientDTO) {
    setEditing(client);
    setForm({
      name: client.name,
      company: client.company,
      email: client.email,
      phone: client.phone,
      country: client.country,
      address: client.address,
      paymentTermsDays: String(client.paymentTermsDays),
      notes: client.notes,
    });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await apiSend(`/api/data/clients/${editing.id}`, "PATCH", { ...form, paymentTermsDays: Number(form.paymentTermsDays) || 0 });
        show("success", "Client updated.");
      } else {
        await apiSend("/api/data/clients", "POST", { ...form, paymentTermsDays: Number(form.paymentTermsDays) || 0 });
        show("success", "Client added.");
      }
      setOpen(false);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/data/clients/${id}`, "DELETE");
      show("success", "Client deleted.");
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    }
  }

  const totalOutstanding = profiles.reduce((sum, profile) => sum + profile.outstanding, 0);
  const selectedProfile = profiles.find((profile) => profile.id === selected) ?? null;
  const selectedInvoices = allInvoices.filter((invoice) => invoice.clientId === selected);
  const selectedPayments = allPayments.filter((payment) => payment.clientId === selected);

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Clients"
        subtitle="Every client carries a financial profile: invoices, payments, outstanding balance and payment behaviour."
        actions={
          <button type="button" onClick={openCreate} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Add client
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Clients" value={String(clients.length)} hint="Active relationships" icon={<Users className="h-4 w-4" />} />
        <StatCard label="Outstanding" value={formatMoney(totalOutstanding, currency)} hint="Across all clients" tone="amber" />
        <StatCard
          label="High risk"
          value={String(profiles.filter((p) => p.risk === "high").length)}
          hint="Late or partial payers"
          tone="red"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="!p-0">
          {loading ? (
            <div className="p-4">
              <Skeleton rows={3} />
            </div>
          ) : profiles.length ? (
            <>
            <div className="divide-y divide-slate-100 md:hidden">
              {profiles.map((profile) => (
                <div key={profile.id} className={`p-4 ${selected === profile.id ? "bg-brand-soft/50" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelected(profile.id)} className="min-w-0 text-left">
                      <p className="truncate text-[13px] font-extrabold text-navy">{profile.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{profile.company || profile.email || "—"}</p>
                    </button>
                    <Badge tone={profile.risk === "high" ? "red" : profile.risk === "medium" ? "amber" : "green"}>{profile.risk}</Badge>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2">
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Paid</p><p className="text-[12px] font-bold text-[#087443]">{formatMoney(profile.paid, currency)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Open</p><p className="text-[12px] font-extrabold text-navy">{formatMoney(profile.outstanding, currency)}</p></div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">On time</p><p className="text-[12px] text-slate-600">{profile.onTimeRate}%</p></div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button type="button" onClick={() => setSelected(profile.id)} className="btn btn-secondary !px-2.5 !py-1.5 text-[11px]">View profile</button>
                    <button type="button" onClick={() => openEdit(profile)} className="btn btn-ghost !p-1.5 text-slate-400 hover:text-brand" aria-label={`Edit ${profile.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={() => void remove(profile.id)} className="btn btn-ghost ml-auto !p-1.5 text-slate-400 hover:text-[#b42318]" aria-label={`Delete ${profile.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3">On-time</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map((profile) => (
                    <tr
                      key={profile.id}
                      onClick={() => setSelected(profile.id)}
                      className={`cursor-pointer hover:bg-slate-50/70 ${selected === profile.id ? "bg-brand-soft/40" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{profile.name}</p>
                        <p className="text-xs text-slate-500">{profile.company || profile.email || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-[#087443]">{formatMoney(profile.paid, currency)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(profile.outstanding, currency)}</td>
                      <td className="px-4 py-3 text-slate-600">{profile.onTimeRate}%</td>
                      <td className="px-4 py-3">
                        <Badge tone={profile.risk === "high" ? "red" : profile.risk === "medium" ? "amber" : "green"}>
                          {profile.risk}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openEdit(profile);
                            }}
                            className="btn btn-ghost !p-1.5 text-slate-400 hover:text-brand"
                            aria-label="Edit client"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void remove(profile.id);
                            }}
                            className="btn btn-ghost !p-1.5 text-slate-400 hover:text-[#b42318]"
                            aria-label="Delete client"
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
                title="No clients yet"
                description="Add your first client to create projects, quotations and invoices."
                action={
                  <button type="button" onClick={openCreate} className="btn btn-primary">
                    <Plus className="h-4 w-4" /> Add client
                  </button>
                }
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-navy">Client financial profile</h2>
          {selectedProfile ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-base font-semibold text-navy">{selectedProfile.name}</p>
                <p className="text-xs text-slate-500">
                  {selectedProfile.company} · {selectedProfile.email || "no email"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[11px] uppercase text-slate-500">Invoiced</p>
                  <p className="font-semibold text-navy">{formatMoney(selectedProfile.invoiced, currency)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[11px] uppercase text-slate-500">Paid</p>
                  <p className="font-semibold text-[#087443]">{formatMoney(selectedProfile.paid, currency)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[11px] uppercase text-slate-500">Outstanding</p>
                  <p className="font-semibold text-[#b54708]">{formatMoney(selectedProfile.outstanding, currency)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[11px] uppercase text-slate-500">Overdue</p>
                  <p className="font-semibold text-[#b42318]">{formatMoney(selectedProfile.overdue, currency)}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Invoices ({selectedInvoices.length})</p>
                <div className="scroll-thin max-h-40 space-y-1 overflow-y-auto">
                  {selectedInvoices.length ? (
                    selectedInvoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                        <span className="text-slate-600">
                          {invoice.number} · {formatDate(invoice.dueDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-navy">{formatMoney(invoice.balance, currency)}</span>
                          <Badge tone={statusTone(invoice.status)}>{invoice.status}</Badge>
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No invoices yet.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Payment history ({selectedPayments.length})</p>
                <div className="scroll-thin max-h-32 space-y-1 overflow-y-auto">
                  {selectedPayments.length ? (
                    selectedPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-xs">
                        <span className="text-slate-600">{formatDate(payment.paidAt)}</span>
                        <span className="font-medium text-[#087443]">+{formatMoney(payment.amount, currency)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500">No payments recorded.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Select a client to see their invoices, payments and risk profile.</p>
          )}
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit client" : "Add client"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Contact name">
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Company">
            <input className="input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="Country">
            <input className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </Field>
          <Field label="Payment terms (days)">
            <input
              className="input"
              type="number"
              min="0"
              value={form.paymentTermsDays}
              onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input className="input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <textarea className="input" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !form.name} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {editing ? "Save changes" : "Add client"}
          </button>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}

export function ProjectsView() {
  const searchParams = useSearchParams();
  const openFromSearch = searchParams.get("new");
  const highlightedId = searchParams.get("highlight");
  const { data, loading, error, reload } = useApi<{ projects: ProjectDTO[] }>("/api/data/projects");
  const clients = useApi<{ clients: ClientDTO[] }>("/api/data/clients");
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", clientId: "", description: "", budget: "", status: "active", startDate: "", endDate: "" });

  const projects = data?.projects ?? [];
  const currency = useWorkspace().currency;
  useEffect(() => { if (openFromSearch === "1") setOpen(true); }, [openFromSearch]);

  async function save() {
    setSaving(true);
    try {
      await apiSend("/api/data/projects", "POST", {
        ...form,
        budget: Number(form.budget) || 0,
      });
      show("success", "Project created.");
      setOpen(false);
      setForm({ name: "", clientId: "", description: "", budget: "", status: "active", startDate: "", endDate: "" });
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    try {
      await apiSend(`/api/data/projects/${id}`, "PATCH", { status });
      show("success", `Project marked ${status}.`);
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/data/projects/${id}`, "DELETE");
      show("success", "Project deleted.");
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Projects"
        subtitle="Track budgets, revenue, expenses and profitability per engagement."
        actions={
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New project
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <Skeleton rows={4} />
      ) : projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const utilisation = project.budget > 0 ? (project.expenses / project.budget) * 100 : 0;
            return (
              <Card key={project.id} className={`card-hover ${highlightedId === project.id ? "ring-2 ring-brand/40" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{project.name}</p>
                    <p className="text-xs text-slate-500">{project.clientName}</p>
                  </div>
                  <Badge tone={statusTone(project.status)}>{project.status}</Badge>
                </div>
                {project.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-500">{project.description}</p> : null}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] uppercase text-slate-500">Revenue</p>
                    <p className="text-sm font-semibold text-[#087443]">{formatMoney(project.revenue, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] uppercase text-slate-500">Expenses</p>
                    <p className="text-sm font-semibold text-navy">{formatMoney(project.expenses, currency)}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-[10px] uppercase text-slate-500">Margin</p>
                    <p className={`text-sm font-semibold ${project.margin >= 0 ? "text-[#087443]" : "text-[#b42318]"}`}>
                      {project.margin.toFixed(0)}%
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>Budget used {formatMoney(project.expenses, currency)} of {formatMoney(project.budget, currency)}</span>
                    <span>{utilisation.toFixed(0)}%</span>
                  </div>
                  <Progress value={utilisation} tone={utilisation > 90 ? "red" : utilisation > 70 ? "amber" : "green"} />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Outstanding {formatMoney(project.outstanding, currency)}</span>
                  <div className="flex gap-1">
                    {project.status !== "completed" ? (
                      <button type="button" onClick={() => setStatus(project.id, "completed")} className="btn btn-secondary !px-3 !py-1.5 text-[11px]">
                        Complete
                      </button>
                    ) : (
                      <button type="button" onClick={() => setStatus(project.id, "active")} className="btn btn-secondary !px-3 !py-1.5 text-[11px]">
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(project.id)}
                      className="btn btn-ghost !p-2 text-slate-400 hover:text-[#b42318]"
                      aria-label="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="No projects yet"
            description="Create a project, assign a client and set a budget to start tracking profitability."
            icon={<FolderKanban className="h-6 w-6" />}
            action={
              <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
                <Plus className="h-4 w-4" /> New project
              </button>
            }
          />
        </Card>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New project">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name" className="sm:col-span-2">
            <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field label="Client">
            <select className="input" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}>
              <option value="">Unassigned</option>
              {clients.data?.clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Budget">
            <input className="input" type="number" min="0" step="100" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} />
          </Field>
          <Field label="Start date">
            <input className="input" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
          </Field>
          <Field label="End date">
            <input className="input" type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <textarea className="input" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !form.name} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create project
          </button>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}

export function ExpensesView() {
  const searchParams = useSearchParams();
  const openFromSearch = searchParams.get("new");
  const { data, loading, error, reload } = useApi<{ expenses: ExpenseDTO[] }>("/api/data/expenses");
  const projects = useApi<{ projects: ProjectDTO[] }>("/api/data/projects");
  const { toast, show, clear } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [category, setCategory] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [form, setForm] = useState({
    category: "auto",
    vendor: "",
    description: "",
    amount: "",
    taxAmount: "0",
    paymentMethod: "card",
    expenseDate: new Date().toISOString().slice(0, 10),
    projectId: "",
    isRecurring: false,
  });

  const expenses = useMemo(() => data?.expenses ?? [], [data]);
  const currency = useWorkspace().currency;
  useEffect(() => { if (openFromSearch === "1") setOpen(true); }, [openFromSearch]);
  const filtered = expenses.filter((expense) => {
    if (category !== "all" && expense.category !== category) return false;
    if (from && expense.expenseDate < from) return false;
    if (to && expense.expenseDate > to) return false;
    return true;
  });

  const breakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    return [...totals.entries()].map(([key, amount]) => ({ category: key, amount })).sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const recurring = expenses.filter((expense) => expense.isRecurring).reduce((sum, expense) => sum + expense.amount, 0);

  async function save() {
    setSaving(true);
    try {
      const result = await apiSend<{ expense: ExpenseDTO }>("/api/data/expenses", "POST", {
        ...form,
        amount: Number(form.amount) || 0,
        taxAmount: Number(form.taxAmount) || 0,
        projectId: form.projectId || undefined,
      });
      if (receiptFile) {
        const upload = new FormData();
        upload.set("expenseId", result.expense.id);
        upload.set("file", receiptFile);
        const response = await fetch("/api/receipts", { method: "POST", body: upload });
        if (!response.ok) {
          const detail = await response.json().catch(() => ({ error: "Receipt upload failed" }));
          throw new Error(detail.error || "Receipt upload failed");
        }
      }
      show("success", receiptFile ? "Expense and receipt saved. The Expense Intelligence Agent will re-analyse your spend." : "Expense recorded. The Expense Intelligence Agent will re-analyse your spend.");
      setOpen(false);
      setReceiptFile(null);
      setForm({ ...form, vendor: "", description: "", amount: "" });
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiSend(`/api/data/expenses/${id}`, "DELETE");
      show("success", "Expense deleted.");
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Expenses"
        subtitle="Record spend, categorise it and see where your money goes. Recurring costs feed the cash-flow forecast."
        actions={
          <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Add expense
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total expenses" value={formatMoney(expenses.reduce((s, e) => s + e.amount, 0), currency)} hint={`${expenses.length} record(s)`} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Filtered total" value={formatMoney(total, currency)} hint={`${filtered.length} record(s)`} tone="brand" />
        <StatCard label="Recurring" value={formatMoney(recurring, currency)} hint="Per cycle commitments" tone="amber" />
        <StatCard label="Top category" value={breakdown[0] ? titleCase(breakdown[0].category) : "—"} hint={breakdown[0] ? formatMoney(breakdown[0].amount, currency) : "No data"} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="!p-0">
          <div className="grid grid-cols-2 items-end gap-2 border-b border-slate-100 p-3 sm:flex sm:flex-wrap">
            <Field label="Category" className="col-span-2 w-full sm:w-40">
              <select className="input" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {EXPENSE_CATEGORIES.map((option) => (
                  <option key={option} value={option}>
                    {titleCase(option)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="From" className="w-full sm:w-36">
              <input className="input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="To" className="w-full sm:w-36">
              <input className="input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
            {(category !== "all" || from || to) && (
              <button
                type="button"
                onClick={() => {
                  setCategory("all");
                  setFrom("");
                  setTo("");
                }}
                className="btn btn-secondary !py-2 text-xs"
              >
                Reset
              </button>
            )}
          </div>
          {loading ? (
            <div className="p-4">
              <Skeleton rows={4} />
            </div>
          ) : filtered.length ? (
            <>
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((expense) => (
                <div key={expense.id} className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3f5f9] text-[#657690]"><Wallet className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-navy">{expense.vendor || expense.description}</p>
                        <p className="truncate text-[11px] text-slate-500">{expense.description}</p>
                      </div>
                      <p className="shrink-0 text-[13px] font-extrabold text-navy">{formatMoney(expense.amount, currency)}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={expense.isRecurring ? "violet" : "neutral"}>{titleCase(expense.category)}</Badge>
                      <span className="text-[11px] text-slate-400">{formatDate(expense.expenseDate)}</span>
                      {expense.receiptUrl ? <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-brand"><Paperclip className="h-3 w-3" /> Receipt</a> : null}
                      {expense.projectName ? <span className="truncate text-[11px] text-slate-400">· {expense.projectName}</span> : null}
                      <button type="button" onClick={() => remove(expense.id)} className="btn btn-ghost ml-auto !p-1.5 text-slate-400 hover:text-[#b42318]" aria-label={`Delete ${expense.vendor || "expense"}`}><Trash2 className="h-3.5 w-3.5" /></button>
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
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-600">{formatDate(expense.expenseDate)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-navy">{expense.vendor || "—"}</p>
                        <p className="text-xs text-slate-500">{expense.description}</p>
                        {expense.receiptUrl ? <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-brand"><Paperclip className="h-3 w-3" /> Receipt</a> : null}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={expense.isRecurring ? "violet" : "neutral"}>
                          {titleCase(expense.category)}
                          {expense.isRecurring ? " · recurring" : ""}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{expense.projectName || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-navy">{formatMoney(expense.amount, currency)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => remove(expense.id)}
                          className="btn btn-ghost !p-1.5 text-slate-400 hover:text-[#b42318]"
                          aria-label="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
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
                title="No expenses match this filter"
                description="Record an expense to unlock category analytics and cost-reduction suggestions."
                action={
                  <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
                    <Plus className="h-4 w-4" /> Add expense
                  </button>
                }
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-navy">Expense distribution</h2>
          <p className="mb-3 text-xs text-slate-500">All recorded expenses by category</p>
          <ExpenseDonut data={breakdown} currency={currency} />
        </Card>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add expense">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Category">
            <select className="input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              <option value="auto">Suggest automatically</option>
              {EXPENSE_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {titleCase(option)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Vendor">
            <input className="input" value={form.vendor} onChange={(event) => setForm({ ...form, vendor: event.target.value })} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <input className="input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Amount">
            <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
          </Field>
          <Field label="Tax amount">
            <input className="input" type="number" min="0" step="0.01" value={form.taxAmount} onChange={(event) => setForm({ ...form, taxAmount: event.target.value })} />
          </Field>
          <Field label="Date">
            <input className="input" type="date" value={form.expenseDate} onChange={(event) => setForm({ ...form, expenseDate: event.target.value })} />
          </Field>
          <Field label="Payment method">
            <select className="input" value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })}>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
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
          <Field label="Receipt (optional)" hint="PNG, JPG or PDF, up to 2 MB. Stored privately for your account." className="sm:col-span-2">
            <input className="input !py-2 text-xs" type="file" accept="image/png,image/jpeg,application/pdf" onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(event) => setForm({ ...form, isRecurring: event.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand"
            />
            This is a recurring expense (subscription, rent, retainer)
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={saving || !form.amount} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save expense
          </button>
        </div>
      </Modal>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}
