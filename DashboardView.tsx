"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight,
  CircleAlert, Clock3, FileClock, FlaskConical, MoveUpRight, Plus,
  ReceiptText, RefreshCw, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { CashFlowChart, ExpenseDonut, HealthGauge, RevenueExpenseChart } from "@/components/charts";
import { LiveAgentOrbit } from "@/components/LiveAgentOrbit";
import { useWorkspace } from "@/components/WorkspaceContext";
import { Alert, Badge, Card, EmptyState, Progress, Skeleton, statusTone } from "@/components/ui";
import { useApi } from "@/lib/client";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { DashboardPayload } from "@/lib/types";

function SectionHeader({ eyebrow, title, href, link }: { eyebrow?: string; title: string; href?: string; link?: string }) {
  return <div className="mb-5 flex items-start justify-between gap-3"><div>{eyebrow && <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400">{eyebrow}</p>}<h2 className="text-[15px] font-extrabold tracking-tight text-navy">{title}</h2></div>{href && <Link href={href} className="mt-1 inline-flex min-h-[32px] shrink-0 items-center gap-1 text-[11px] font-extrabold text-brand hover:underline">{link || "View all"}<ArrowRight className="h-3 w-3" /></Link>}</div>;
}

function MetricCard({ label, value, description, icon: Icon, color = "brand", badge }: {
  label: string; value: string; description: string; icon: typeof Wallet; color?: "brand" | "green" | "amber" | "red"; badge?: string;
}) {
  const tone = { brand: "bg-[#edf2ff] text-brand", green: "bg-[#e8f8f0] text-[#0b9462]", amber: "bg-[#fff5e6] text-[#cc7a19]", red: "bg-[#fff0ee] text-[#d54b40]" }[color];
  return <div className="card card-hover flex min-h-[150px] flex-col justify-between p-5"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-[.07em] text-[#728098]">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-[11px] ${tone}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span></div><div><p className="font-display text-[25px] font-extrabold leading-none tracking-[-.055em] text-navy sm:text-[28px]">{value}</p><p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-500">{badge && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${tone}`}>{badge}</span>}{description}</p></div></div>;
}

export function DashboardView() {
  const { fullName } = useWorkspace();
  const { data, loading, error, reload, refreshing, updatedAt } = useApi<DashboardPayload>("/api/dashboard", { refreshMs: 20_000 });
  const [range, setRange] = useState<3 | 6>(6);

  if (loading) return <div className="animate-fade-up space-y-5"><div className="h-20 max-w-lg animate-pulse rounded-2xl bg-slate-100" /><div className="h-56 animate-pulse rounded-2xl bg-slate-100" /><div className="grid gap-4 sm:grid-cols-4">{[0,1,2,3].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}</div><Skeleton rows={3} /></div>;
  if (error || !data) return <div className="max-w-3xl space-y-4"><h1 className="text-2xl font-bold">Financial overview</h1><Alert tone="error" title="We couldn't load the overview">{error || "Please try again."}</Alert><button type="button" onClick={() => void reload()} className="btn btn-secondary">Try again</button></div>;

  const { metrics, forecast, health, business } = data;
  const currency = business.currency;
  const money = (amount: number) => formatMoney(amount, currency);
  const name = fullName?.split(" ")[0] || "there";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date());
  const headline = metrics.overdueCount > 0 ? `${metrics.overdueCount} overdue ${metrics.overdueCount === 1 ? "invoice needs" : "invoices need"} your attention.` : forecast.shortageDate ? "A cash-flow risk is on the horizon." : "Your finances are moving in the right direction.";
  const revenueDelta = metrics.revenueLastMonth > 0 ? Math.round((metrics.revenueThisMonth - metrics.revenueLastMonth) / metrics.revenueLastMonth * 100) : null;
  const expenseDelta = metrics.expenseLastMonth > 0 ? Math.round((metrics.expenseThisMonth - metrics.expenseLastMonth) / metrics.expenseLastMonth * 100) : null;
  const openInsights = data.insights.filter((item) => item.status === "open");
  const primaryInsight = openInsights.find((item) => item.severity === "critical" || item.severity === "high") ?? openInsights[0];
  const chartData = data.monthly.slice(-range);

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold text-slate-400"><CalendarDays className="h-3.5 w-3.5" />{todayLabel}<span className="mx-1 text-slate-300">/</span><span className="text-brand">EXECUTIVE OVERVIEW</span></div>
          <h1 className="font-display text-[26px] font-extrabold tracking-[-.055em] text-navy sm:text-[32px]">{greeting}, {name}<span className="text-[#9aa7bf]">.</span></h1>
          <p className="mt-1 text-[13px] text-slate-500">Here’s the full picture of {business.name} today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><div className="mr-1 hidden items-center gap-1.5 text-[11px] font-semibold text-slate-500 md:flex" title={updatedAt ? `Synced ${updatedAt.toLocaleTimeString()}` : "Syncing"}><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#54cba0] opacity-30" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[#17b881]" /></span>Live ledger</div><button type="button" onClick={() => void reload(true)} disabled={refreshing} className="btn btn-secondary !px-2.5" title={updatedAt ? `Last synced ${updatedAt.toLocaleTimeString()} · Refresh now` : "Refresh data"} aria-label="Refresh financial data"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /></button><Link href="/assistant" className="btn btn-secondary"><Sparkles className="h-4 w-4 text-brand" />Ask PayPilot</Link><Link href="/invoices?new=1" className="btn btn-primary"><Plus className="h-4 w-4" />New invoice</Link></div>
      </div>

      {business.isDemo && <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#f7e3ae] bg-[#fffbef] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#936314]"><FlaskConical className="h-4 w-4 shrink-0" /><span><strong>Demo workspace.</strong> These are illustrative records, not real transactions. Every figure below is calculated from the sample ledger.</span><Link href="/settings" className="ml-auto inline-flex min-h-[32px] shrink-0 items-center font-extrabold underline underline-offset-2">Manage workspace</Link></div>}

      <section className="relative overflow-hidden rounded-[24px] border border-[#304372] bg-[#131e35] text-white shadow-[0_22px_45px_-28px_rgba(18,35,73,.6)]">
        <div className="pointer-events-none absolute -right-14 -top-28 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-[#009cde]/10 blur-3xl" />
        <div className="relative p-5 sm:p-7">
          <div className="grid items-center gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)] xl:gap-8">
            <div className="flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-md bg-brand/25 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#b2c3ff]"><Sparkles className="h-3 w-3" />PayPilot intelligence</span><span className="text-[10px] font-medium text-[#9caac1]">DAILY BRIEF · {formatDate(new Date().toISOString())}</span></div>
              <h2 className="mt-4 max-w-[720px] font-display text-xl font-extrabold leading-snug tracking-[-.045em] text-white sm:text-[24px]">{headline}</h2>
              <p className="mt-2 max-w-2xl text-[12px] leading-[1.8] text-[#b8c5da] sm:text-[13px]">{data.summary}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-[#b9c7dd]">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#57d7a7]" />5 specialist agents</span>
                <span className="h-3 border-l border-white/20" />
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Actions require your approval</span>
                <span className="h-3 border-l border-white/20" />
                <span>Health {health.score}/100 · {health.grade}</span>
              </div>
              <p className="mt-4 text-[11px] font-medium text-[#8fa3bf]">The agent network is part of this dashboard. Point at it to hold an agent still while you read.</p>
            </div>

            <LiveAgentOrbit embedded />
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${primaryInsight?.severity === "critical" || primaryInsight?.severity === "high" ? "bg-[#ffab87]" : "bg-[#70d9ab]"}`} />
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#a4b6d4]">Priority action</p>
                  <p className="mt-1 text-[13px] font-bold leading-snug text-white">{primaryInsight?.title || "Your ledger is looking good"}</p>
                  <p className="mt-1 line-clamp-2 max-w-3xl text-[11px] leading-[1.65] text-[#bbc9dd]">{primaryInsight?.recommendation || "Keep invoices moving and monitor your forecast as new transactions come in."}</p>
                </div>
              </div>
              <Link href={primaryInsight ? "/insights" : "/assistant"} className="btn btn-primary shrink-0 !px-4 !py-2.5 text-[12px]">
                {primaryInsight ? "Review action plan" : "Talk to the assistant"}<ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recorded cash balance" value={money(metrics.cashBalance)} description="Opening balance + payments − expenses" color="brand" icon={Wallet} badge="RECORDED" />
        <MetricCard label="Collected revenue" value={money(metrics.totalRevenue)} description={revenueDelta !== null ? `${revenueDelta >= 0 ? "+" : ""}${revenueDelta}% vs last month` : `${money(metrics.revenueThisMonth)} collected this month`} color="green" icon={ArrowDownLeft} />
        <MetricCard label="Outstanding payments" value={money(metrics.pendingPayments)} description={`${metrics.outstandingInvoices} open invoice${metrics.outstandingInvoices === 1 ? "" : "s"}`} color="amber" icon={FileClock} />
        <MetricCard label="Net profit" value={money(metrics.netProfit)} description={`${metrics.profitMargin.toFixed(1)}% cash-basis margin`} color={metrics.netProfit >= 0 ? "green" : "red"} icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown} />
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-[16px] border border-[#e8ecf2] bg-white shadow-sm sm:grid-cols-4">
        {[
          { label: "Total expenses", value: money(metrics.totalExpenses), note: expenseDelta !== null ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% this month` : "Recorded spend", href: "/expenses" },
          { label: "Overdue invoices", value: String(metrics.overdueCount), note: `${money(metrics.overdueAmount)} to collect`, href: "/invoices" },
          { label: "Due in next 7 days", value: money(metrics.upcomingInflow), note: "Expected invoice payments", href: "/payments" },
          { label: "Cash runway", value: `${metrics.runwayDays} days`, note: "At recent expense rate", href: "/cash-flow" },
        ].map((item, i) => <Link key={item.label} href={item.href} className={`group relative px-4 py-4 transition-colors hover:bg-[#f8faff] sm:px-5 ${i % 2 !== 0 ? "border-l border-[#edf0f5]" : ""} ${i >= 2 ? "border-t border-[#edf0f5] sm:border-t-0 sm:border-l" : ""}`}><span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.055em] text-slate-500">{item.label}<MoveUpRight className="h-3 w-3 text-slate-300 transition group-hover:text-brand" /></span><span className="mt-2 block font-display text-[17px] font-extrabold tracking-tight text-navy sm:text-[19px]">{item.value}</span><span className="mt-0.5 block text-[11px] text-slate-400">{item.note}</span></Link>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <Card className="!p-5 sm:!p-6"><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">PERFORMANCE</p><h2 className="mt-1 font-display text-[17px] font-extrabold tracking-tight text-navy">Revenue & expenses</h2><p className="mt-1 text-[11px] text-slate-500">Cash received versus spend recorded, by month</p></div><div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">{([3, 6] as const).map((months) => <button key={months} type="button" onClick={() => setRange(months)} aria-pressed={range === months} className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition ${range === months ? "bg-white text-navy shadow-sm" : "text-slate-400 hover:text-navy"}`}>{months}M</button>)}</div></div><RevenueExpenseChart data={chartData} currency={currency} /><div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-[11px]"><span className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-brand" />Revenue <strong className="text-navy">{money(metrics.revenueThisMonth)}</strong> this month</span><span className="inline-flex items-center gap-1.5 text-slate-500"><span className="h-2 w-2 rounded-full bg-[#cfd5df]" />Expenses <strong className="text-navy">{money(metrics.expenseThisMonth)}</strong> this month</span></div></Card>
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="FINANCIAL WELLBEING" title="Your health score" href="/insights" link="Explore insights" /><div className="flex items-center gap-4 border-b border-slate-100 pb-4"><HealthGauge score={health.score} /><div><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-extrabold ${health.score >= 75 ? "bg-mint-soft text-[#07865d]" : health.score >= 50 ? "bg-amber-soft text-[#a66618]" : "bg-rose-soft text-[#bd463b]"}`}>{health.grade.toUpperCase()}</span><p className="mt-2 text-[11px] leading-[1.6] text-slate-500">{health.headline}</p></div></div><div className="mt-4 space-y-3">{health.factors.map((factor) => <div key={factor.label}><div className="mb-1 flex justify-between text-[11px]"><span className="font-semibold text-slate-600">{factor.label}</span><span className="font-bold text-navy">{factor.score}/100</span></div><Progress value={factor.score} tone={factor.score >= 75 ? "green" : factor.score >= 50 ? "brand" : "red"} /></div>)}</div></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,1fr)]">
        <Card className="!p-5 sm:!p-6"><div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">LOOKING AHEAD</p><h2 className="mt-1 font-display text-[17px] font-extrabold tracking-tight text-navy">30-day cash flow</h2><p className="mt-1 text-[11px] text-slate-500">Projected balance · estimate, not a guaranteed outcome</p></div><Link href="/cash-flow" className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-extrabold text-brand hover:underline">Full forecast<ArrowRight className="h-3 w-3" /></Link></div><CashFlowChart data={forecast.series} currency={currency} height={225} /><div className="mt-3 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-[#f8faff] py-3"><div className="px-3"><p className="text-[10px] font-semibold text-slate-500">Starting · recorded</p><p className="mt-1 text-[13px] font-extrabold text-navy">{money(forecast.startingBalance)}</p></div><div className="px-3"><p className="text-[10px] font-semibold text-slate-500">Expected inflows</p><p className="mt-1 text-[13px] font-extrabold text-[#07865d]">{money(forecast.expectedInflow)}</p></div><div className="px-3"><p className="text-[10px] font-semibold text-slate-500">Ending · estimate</p><p className="mt-1 text-[13px] font-extrabold text-brand">{money(forecast.projectedBalance)}</p></div></div>{forecast.shortageDate && <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#b54708]"><CircleAlert className="h-3.5 w-3.5" />Shortage projected around {formatDate(forecast.shortageDate)}. Review the assumptions.</p>}</Card>
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="NEXT UP" title="Upcoming payments" href="/payments" /><div className="space-y-1">{data.upcoming.length ? data.upcoming.slice(0, 5).map((item) => <div key={item.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.kind === "inflow" ? "bg-mint-soft text-[#0b9462]" : "bg-amber-soft text-[#bd7624]"}`}>{item.kind === "inflow" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-navy">{item.label}</p><p className="mt-0.5 text-[10px] text-slate-400">{formatDate(item.date)}</p></div><p className={`shrink-0 text-[11px] font-extrabold ${item.kind === "inflow" ? "text-[#07865d]" : "text-navy"}`}>{item.kind === "inflow" ? "+" : "−"}{money(item.amount)}</p></div>) : <EmptyState title="Nothing scheduled" description="Upcoming invoices and recurring costs will appear here." />}</div><Link href="/assistant?prompt=Which%20payments%20should%20I%20follow%20up%20on%3F" className="mt-4 flex items-center justify-between rounded-xl bg-[#eef2ff] px-3.5 py-3 text-[11px] font-bold text-brand hover:bg-[#e4ebff]"><span className="flex items-center gap-2"><Sparkles className="h-4 w-4" />Ask the payment agent</span><ChevronRight className="h-3.5 w-3.5" /></Link></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="ACCOUNTS RECEIVABLE" title="Invoices awaiting payment" href="/invoices" link="View all invoices" /><div>{data.pendingInvoices.length ? data.pendingInvoices.slice(0, 5).map((invoice) => <div key={invoice.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#f2f5fb] text-[#677b9b]"><ReceiptText className="h-[17px] w-[17px]" /></span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-navy">{invoice.clientName}</p><p className="mt-0.5 text-[10px] text-slate-400">{invoice.number} · Due {formatDate(invoice.dueDate)}</p></div><div className="shrink-0 text-right"><p className="text-[12px] font-extrabold text-navy">{money(invoice.balance)}</p><span className={`text-[10px] font-bold ${invoice.status === "overdue" ? "text-[#ca5143]" : "text-[#7c8da5]"}`}>{titleCase(invoice.status)}</span></div></div>) : <EmptyState title="All caught up" description="There are no unpaid invoices in the ledger." />}</div></Card>
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="LATEST ACTIVITY" title="Money in, money out" href="/payments" link="All payments" /><div>{data.recentTransactions.length ? data.recentTransactions.slice(0, 5).map((txn) => <div key={txn.id} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${txn.kind === "payment" ? "bg-mint-soft text-[#0b9462]" : "bg-[#f3f5f9] text-[#657690]"}`}>{txn.kind === "payment" ? <ArrowDownLeft className="h-[17px] w-[17px]" /> : <ArrowUpRight className="h-[17px] w-[17px]" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-navy">{txn.party}</p><p className="mt-0.5 truncate text-[10px] text-slate-400">{txn.label} · {formatDate(txn.date)}</p></div><p className={`shrink-0 text-[12px] font-extrabold ${txn.kind === "payment" ? "text-[#07865d]" : "text-navy"}`}>{txn.kind === "payment" ? "+" : "−"}{money(txn.amount)}</p></div>) : <EmptyState title="No transactions yet" description="Payments and expenses will appear here as you record them." />}</div></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="COST INTELLIGENCE" title="Where your money goes" href="/expenses" link="Explore expenses" /><ExpenseDonut data={data.expenseBreakdown} currency={currency} /></Card>
        <Card className="!p-5 sm:!p-6"><SectionHeader eyebrow="YOUR AGENT TEAM" title="Latest agent findings" href="/insights" link="All insights" /><div className="space-y-2">{openInsights.slice(0, 3).map((insight) => <div key={insight.id} className="rounded-xl border border-[#e9edf5] p-3"><div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold leading-snug text-navy">{insight.title}</p><Badge tone={statusTone(insight.severity)} className="!px-2 !py-0.5 !text-[10px]">{insight.severity}</Badge></div><p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-500">{insight.recommendation}</p></div>)}{!openInsights.length && <div className="flex items-center gap-2 rounded-xl border border-[#d5efdf] bg-[#f2fcf6] p-3 text-[11px] font-semibold text-[#07865d]"><Check className="h-4 w-4" />No immediate risks detected.</div>}</div><Link href="/assistant?prompt=Give%20me%20a%20financial%20health%20check" className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-brand hover:underline"><Sparkles className="h-3.5 w-3.5" />Discuss this with PayPilot <ArrowRight className="h-3 w-3" /></Link></Card>
      </div>
    </div>
  );
}
