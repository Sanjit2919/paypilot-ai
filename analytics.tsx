"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { CashFlowBars, CashFlowChart, ForecastLegend, HealthGauge, RevenueExpenseChart } from "@/components/charts";
import { ActionCenter } from "@/components/ActionCenter";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { formatDate, formatMoney, relativeTime, titleCase } from "@/lib/format";
import { AGENTS, agentDisplayName } from "@/lib/agentMeta";
import type { ActivityDTO, BusinessDTO, Forecast, InsightDTO, Metrics, MonthlyPoint } from "@/lib/types";
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  Field,
  PageHeader,
  Progress,
  Skeleton,
  StatCard,
  Tabs,
  ToastHost,
  statusTone,
  useToast,
} from "@/components/ui";

export function CashFlowView() {
  const [horizon, setHorizon] = useState<"7" | "30" | "60" | "90">("30");
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { data, loading, error, refreshing, updatedAt, reload } = useApi<{
    metrics: Metrics;
    forecast: Forecast;
    forecast7: Forecast;
    forecast30: Forecast;
    forecast60: Forecast;
    forecast90: Forecast;
    monthly: MonthlyPoint[];
    business: { currency: string; name: string };
  }>(`/api/cashflow?horizon=${horizon}`, { refreshMs: 30_000 });

  function onChartTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  function onChartTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const horizons = ["7", "30", "60", "90"] as const;
    const index = horizons.indexOf(horizon);
    setHorizon(horizons[Math.max(0, Math.min(2, index + (dx < 0 ? 1 : -1)))]);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Cash flow" subtitle="Projecting liquidity…" />
        <Skeleton rows={4} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div>
        <PageHeader title="Cash flow" />
        <Alert tone="error">{error ?? "Unable to load cash-flow analytics."}</Alert>
      </div>
    );
  }

  const { metrics, forecast, forecast7, forecast90, monthly, business } = data;
  const currency = business.currency;
  const money = (value: number) => formatMoney(value, currency);
  const net = forecast.expectedInflow - forecast.expectedOutflow;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Cash-flow analytics"
        subtitle="Actual balances versus probability-weighted estimates. Every assumption is documented."
        actions={<div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-mint" />{updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : "Syncing"}</span><button type="button" onClick={() => void reload(true)} disabled={refreshing} className="btn btn-secondary !px-2.5" aria-label="Refresh forecast"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button><Badge tone="amber">Forecast = estimate, not a guarantee</Badge></div>}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current cash (recorded)" value={money(metrics.cashBalance)} hint="Opening + collections − expenses" tone="brand" />
        <StatCard label="Expected inflow" value={money(forecast.expectedInflow)} hint={`Next ${forecast.horizonDays} days (estimate)`} tone="green" />
        <StatCard label="Expected outflow" value={money(forecast.expectedOutflow)} hint="Modelled from your burn rate" tone="amber" />
        <StatCard
          label="Projected balance"
          value={money(forecast.projectedBalance)}
          hint={`Net ${net >= 0 ? "+" : ""}${money(net)} · ${forecast.confidence}% confidence`}
          tone={forecast.projectedBalance >= metrics.cashBalance ? "green" : "red"}
        />
      </div>

      <div className="mb-4">
        <Tabs
          value={horizon}
          onChange={setHorizon}
          tabs={[
            { key: "7", label: "7-day" },
            { key: "30", label: "30-day" },
            { key: "60", label: "60-day" },
            { key: "90", label: "90-day" },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2" onTouchStart={onChartTouchStart} onTouchEnd={onChartTouchEnd}>
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-navy">Projected cash balance · {horizon} days</h2>
              <p className="text-xs text-slate-500">
                Starting {money(forecast.startingBalance)} · lowest {money(forecast.lowestBalance)} on {formatDate(forecast.lowestDate)}
              </p>
            </div>
            <ForecastLegend />
          </div>
          <CashFlowChart data={forecast.series} currency={currency} height={280} />
          <p className="mt-1 text-center text-[10px] font-semibold text-slate-400 sm:hidden">Swipe left or right to change forecast horizon</p>
          {forecast.shortageDate ? (
            <div className="mt-3">
              <Alert tone="warning" title="Potential cash shortage">
                The model projects a negative balance from {formatDate(forecast.shortageDate)}. Collecting overdue invoices
                or deferring discretionary spend would change this projection.
              </Alert>
            </div>
          ) : (
            <div className="mt-3">
              <Alert tone="success" title="No projected shortage">
                The balance stays positive across the {horizon}-day window in this model. That is an estimate based on
                current invoices and your average burn rate.
              </Alert>
            </div>
          )}
        </Card>
        </div>

        <Card>
          <h2 className="text-sm font-semibold text-navy">Forecast comparison</h2>
          <p className="mb-3 text-xs text-slate-500">Same model, three horizons</p>
          <div className="space-y-2">
            {[
              { label: "7 days", value: forecast7 },
              { label: "30 days", value: data.forecast30 },
              { label: "60 days", value: data.forecast60 },
              { label: "90 days", value: forecast90 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200/80 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                  <Badge tone={item.value.shortageDate ? "red" : "green"}>
                    {item.value.shortageDate ? "shortage risk" : "stable"}
                  </Badge>
                </div>
                <p className="mt-1 text-lg font-semibold text-navy">{money(item.value.projectedBalance)}</p>
                <p className="text-[11px] text-slate-500">
                  Lowest {money(item.value.lowestBalance)} · confidence {item.value.confidence}%
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-navy">Expected inflows vs outflows</h2>
          <p className="mb-2 text-xs text-slate-500">Daily model output for the selected horizon</p>
          <CashFlowBars data={forecast.series} currency={currency} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold text-navy">Assumptions behind this forecast</h2>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-600">
            {forecast.assumptions.map((assumption) => (
              <li key={assumption} className="flex gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                {assumption}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-navy">Actual vs estimated</p>
            <p className="mt-1">
              Actual cash today: <span className="font-semibold">{money(metrics.cashBalance)}</span>. Everything to the
              right of today is an estimate produced by the Cash Flow Prediction Agent.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-navy">Revenue vs expenses trend</h2>
        <RevenueExpenseChart data={monthly} currency={currency} />
      </Card>
    </div>
  );
}

export function InsightsView() {
  const { data, loading, error, reload } = useApi<{ insights: InsightDTO[] }>("/api/insights", { refreshMs: 30_000 });
  const agents = useApi<{ plan: { headline: string; whatHappened: string; why: string; whatNext: string; actions: { agent: string; title: string; detail: string; requiresApproval: boolean }[] }; activities: ActivityDTO[]; health: { score: number; grade: string } }>("/api/agents", { refreshMs: 30_000 });
  const { toast, show, clear } = useToast();
  const reloadAgents = agents.reload;
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => { void reload(true); void reloadAgents(true); };
    window.addEventListener("paypilot:review-complete", refresh);
    return () => window.removeEventListener("paypilot:review-complete", refresh);
  }, [reload, reloadAgents]);

  async function runReview() {
    setRunning(true);
    try {
      await apiSend("/api/agents", "POST");
      show("success", "All five agents completed a review. Insights refreshed.");
      await reload();
      reloadAgents();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setRunning(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusy(id);
    try {
      await apiSend("/api/insights", "PATCH", { id, status });
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const insights = data?.insights ?? [];
  const plan = agents.data?.plan;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="AI insights & recommendations"
        subtitle="Prioritised findings from all five agents, each with supporting data and a recommended action."
        actions={
          <button type="button" onClick={runReview} disabled={running} className="btn btn-primary">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {running ? "Agents running…" : "Run agent review"}
          </button>
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {plan ? (
        <div className="mb-4 rounded-2xl bg-navy p-5 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">
              <Bot className="h-3 w-3" /> PayPilot brief
            </Badge>
            {agents.data?.health ? <Badge tone="green">Health {agents.data.health.score}/100</Badge> : null}
          </div>
          <p className="mt-2 text-base font-semibold">{plan.headline}</p>
          <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What happened</p>
              <p className="mt-1 leading-relaxed">{plan.whatHappened}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Why</p>
              <p className="mt-1 leading-relaxed">{plan.why}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What could happen next</p>
              <p className="mt-1 leading-relaxed">{plan.whatNext}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recommended actions</p>
              <ul className="mt-1 space-y-1">
                {plan.actions.slice(0, 3).map((action) => (
                  <li key={action.title} className="leading-relaxed">
                    • {action.title}
                    {action.requiresApproval ? <span className="ml-1 text-[11px] text-amber-300">(needs approval)</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <ActionCenter />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {loading ? <Skeleton rows={4} /> : null}
          {!loading && !insights.length ? (
            <Card>
              <EmptyState
                title="No insights yet"
                description="Run an agent review to analyse your invoices, expenses and cash flow."
                action={
                  <button type="button" onClick={runReview} className="btn btn-primary">
                    <Sparkles className="h-4 w-4" /> Run agent review
                  </button>
                }
              />
            </Card>
          ) : null}
          {insights.map((insight) => (
            <Card key={insight.id} className={insight.status !== "open" ? "opacity-70" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      insight.severity === "critical" || insight.severity === "high"
                        ? "bg-rose-soft text-[#b42318]"
                        : insight.severity === "medium"
                          ? "bg-amber-soft text-[#b54708]"
                          : "bg-brand-soft text-brand"
                    }`}
                  >
                    {insight.severity === "critical" || insight.severity === "high" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <TrendingUp className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-navy">{insight.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(insight.severity)}>{insight.severity}</Badge>
                      <Badge tone="neutral">{AGENTS.find((agent) => agent.key === insight.agent)?.name ?? titleCase(insight.agent)}</Badge>
                      <span className="text-[11px] text-slate-400">{relativeTime(insight.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setStatus(insight.id, "acted")}
                    disabled={busy === insight.id}
                    className="btn btn-secondary !px-2 !py-1 text-[11px]"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Acted
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(insight.id, "dismissed")}
                    disabled={busy === insight.id}
                    className="btn btn-ghost !p-1.5 text-slate-400"
                    aria-label="Dismiss insight"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{insight.explanation}</p>
              <div className="mt-2 rounded-xl bg-slate-50 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recommended action</p>
                <p className="text-xs leading-relaxed text-slate-700">{insight.recommendation}</p>
              </div>
              {Object.keys(insight.supportingData ?? {}).length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(insight.supportingData).slice(0, 6).map(([key, value]) => (
                    <span key={key} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                      {titleCase(key)}: {typeof value === "number" ? value.toFixed(2) : String(value)}
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <Card>
            <h2 className="text-sm font-semibold text-navy">Agent activity</h2>
            <div className="mt-2 space-y-2.5">
              {(agents.data?.activities ?? []).map((activity) => (
                <div key={activity.id} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div>
                    <p className="text-xs font-semibold text-navy">
                      {agentDisplayName(activity.agent)}
                      <span className="ml-1.5 font-normal text-slate-400">{relativeTime(activity.createdAt)}</span>
                    </p>
                    <p className="text-[11px] leading-snug text-slate-600">{activity.action}</p>
                    <p className="text-[11px] leading-snug text-slate-400">{activity.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {agents.data?.health ? (
            <Card className="flex flex-col items-center">
              <HealthGauge score={agents.data.health.score} />
              <p className="mt-1 text-sm font-semibold text-navy">{agents.data.health.grade}</p>
              <p className="text-center text-xs text-slate-500">Weighted across collections, overdue exposure, margin, runway and forecast stability.</p>
            </Card>
          ) : null}
        </div>
      </div>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}

const REPORTS = [
  { type: "profit-loss", title: "Monthly profit & loss", description: "Revenue, expenses and net profit by month." },
  { type: "expenses", title: "Expense breakdown", description: "Category totals with share of spend." },
  { type: "revenue", title: "Revenue analysis", description: "Collected revenue by client and trend." },
  { type: "outstanding", title: "Outstanding invoices", description: "Open balances, due dates and overdue status." },
  { type: "clients", title: "Client payment history", description: "On-time rates, outstanding and risk level." },
  { type: "cashflow", title: "Cash-flow forecast", description: "90-day projection with documented assumptions." },
];

export function ReportsView() {
  const { data } = useApi<{ monthly: MonthlyPoint[]; business: { currency: string } }>("/api/cashflow?horizon=30");
  const currency = data?.business.currency ?? "USD";

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Reports"
        subtitle="Download board-ready reports as PDF or CSV. Every report is generated from your live ledger."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.type} className="card-hover">
            <div className="flex items-start gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">{report.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{report.description}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <a href={`/api/reports?type=${report.type}&format=pdf`} className="btn btn-primary flex-1 !py-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> PDF
              </a>
              <a href={`/api/reports?type=${report.type}&format=csv`} className="btn btn-secondary flex-1 !py-1.5 text-xs">
                <Download className="h-3.5 w-3.5" /> CSV
              </a>
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-navy">Monthly performance preview</h2>
            <p className="text-xs text-slate-500">Included in the profit & loss report</p>
          </div>
          <BarChart3 className="h-4 w-4 text-slate-400" />
        </div>
        {data?.monthly.length ? (
          <div className="scroll-thin -mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="px-3 py-2 text-right">Expenses</th>
                  <th className="px-3 py-2 text-right">Net profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.monthly.map((point) => (
                  <tr key={point.month}>
                    <td className="px-3 py-2 text-slate-600">
                      {new Date(`${point.month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2 text-right text-[#087443]">{formatMoney(point.revenue, currency)}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(point.expenses, currency)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${point.profit >= 0 ? "text-navy" : "text-[#b42318]"}`}>
                      {formatMoney(point.profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Skeleton rows={3} />
        )}
      </Card>
    </div>
  );
}

export function SettingsView() {
  const router = useRouter();
  const business = useApi<{ business: BusinessDTO }>("/api/business");
  const integrations = useApi<{ paypal: { configured: boolean; mode: string }; gemini: { configured: boolean; model: string } }>("/api/integrations");
  const { toast, show, clear } = useToast();
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    businessType: "Digital agency",
    industry: "Technology",
    currency: "USD",
    email: "",
    country: "United States",
    taxRate: "0",
    paymentTermsDays: "14",
    cashBalance: "0",
    monthlyRevenueEstimate: "0",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!business.data || loaded) return;
    const b = business.data.business;
    setForm({
      name: b.name,
      businessType: b.businessType,
      industry: b.industry,
      currency: b.currency,
      email: b.email,
      country: b.country,
      taxRate: String(b.taxRate),
      paymentTermsDays: String(b.paymentTermsDays),
      cashBalance: String(b.cashBalance),
      monthlyRevenueEstimate: String(b.monthlyRevenueEstimate),
    });
    setLoaded(true);
  }, [business.data, loaded]);

  async function save() {
    setSaving(true);
    try {
      await apiSend("/api/business", "PATCH", {
        ...form,
        taxRate: Number(form.taxRate) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
        cashBalance: Number(form.cashBalance) || 0,
        monthlyRevenueEstimate: Number(form.monthlyRevenueEstimate) || 0,
      });
      show("success", "Business profile updated. Insights will use the new defaults.");
      business.reload();
      router.refresh();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function loadDemo() {
    setSeeding(true);
    try {
      await apiSend("/api/seed", "POST");
      show("success", "Demo workspace loaded with sample clients, projects, invoices and expenses.");
      business.reload();
      router.refresh();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader title="Settings" subtitle="Business profile, financial defaults and integration status." />

      {business.error ? <Alert tone="error">{business.error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-navy">Business profile</h2>
          <p className="mb-3 text-xs text-slate-500">Used to personalise insights, invoices and forecasts.</p>
          {business.loading && !business.data ? (
            <Skeleton rows={4} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name">
                <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Business email">
                <input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              </Field>
              <Field label="Business type">
                <select className="input" value={form.businessType} onChange={(event) => setForm({ ...form, businessType: event.target.value })}>
                  {["Freelancer", "Digital agency", "Startup", "Small business", "Consultancy", "Studio"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Industry">
                <select className="input" value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })}>
                  {["Technology", "Marketing & advertising", "Design", "E-commerce", "Professional services", "Finance", "Healthcare", "Education", "Other"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Currency">
                <select className="input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}>
                  {["USD", "EUR", "GBP", "INR", "AED", "AUD", "CAD", "SGD", "JPY", "ZAR"].map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </Field>
              <Field label="Country">
                <input className="input" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
              </Field>
              <Field label="Default tax rate (%)">
                <input className="input" type="number" step="0.5" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} />
              </Field>
              <Field label="Default payment terms (days)">
                <input className="input" type="number" value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value })} />
              </Field>
              <Field label="Opening cash balance" hint="Cash in the bank before recorded payments.">
                <input className="input" type="number" step="100" value={form.cashBalance} onChange={(event) => setForm({ ...form, cashBalance: event.target.value })} />
              </Field>
              <Field label="Monthly revenue estimate">
                <input className="input" type="number" step="100" value={form.monthlyRevenueEstimate} onChange={(event) => setForm({ ...form, monthlyRevenueEstimate: event.target.value })} />
              </Field>
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={save} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <h2 className="text-sm font-semibold text-navy">Integrations</h2>
            <div className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5">
                <div>
                  <p className="font-medium text-navy">PayPal</p>
                  <p className="text-[11px] text-slate-500">
                    {integrations.data?.paypal.configured ? `Sandbox credentials detected (${integrations.data.paypal.mode})` : "Demo mode — no credentials"}
                  </p>
                </div>
                <Badge tone={integrations.data?.paypal.configured ? "green" : "amber"}>
                  {integrations.data?.paypal.configured ? "Live" : "Demo"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 p-2.5">
                <div>
                  <p className="font-medium text-navy">Gemini AI</p>
                  <p className="text-[11px] text-slate-500">
                    {integrations.data?.gemini.configured ? "Reasoning enabled" : "Deterministic engine (no API key)"}
                  </p>
                </div>
                <Badge tone={integrations.data?.gemini.configured ? "green" : "neutral"}>
                  {integrations.data?.gemini.configured ? "Connected" : "Fallback"}
                </Badge>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Keys are read from server-side environment variables only. Add PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and
              GEMINI_API_KEY to enable live integrations.
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-navy">Demo data</h2>
            <p className="mt-1 text-xs text-slate-500">
              Load a realistic sample business (clients, projects, quotations, invoices, payments and expenses). Existing
              records are preserved.
            </p>
            <button type="button" onClick={loadDemo} disabled={seeding} className="btn btn-secondary mt-3 w-full">
              {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {seeding ? "Loading demo data…" : "Load demo workspace"}
            </button>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-navy">Security</h2>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
              <li>• Server-side sessions with HTTP-only cookies.</li>
              <li>• Every query is scoped to your user id.</li>
              <li>• Passwords hashed with scrypt and per-user salt.</li>
              <li>• Agents require explicit approval before acting.</li>
            </ul>
          </Card>
        </div>
      </div>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}
