"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  CreditCard,
  FileText,
  FolderKanban,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { usePinnedProgress } from "@/components/usePinnedProgress";
import { useRealPointerMove } from "@/components/useRealPointerMove";

const STEPS = [
  {
    title: "Create the project",
    shortTitle: "Projects",
    description: "Start with the client, budget, dates and commercial context every later calculation depends on.",
    agent: "PayPilot",
    output: "A scoped project workspace with budget and ownership.",
    href: "/projects",
    icon: FolderKanban,
    accent: "#3867FF",
  },
  {
    title: "Generate the quotation",
    shortTitle: "Quotations",
    description: "Turn the scope into priced line items with discount, tax, validity and clear payment terms.",
    agent: "Invoice Agent",
    output: "A client-ready quotation that can be accepted as-is.",
    href: "/quotations",
    icon: FileText,
    accent: "#7A5AF8",
  },
  {
    title: "Convert it into an invoice",
    shortTitle: "Invoices",
    description: "Carry the accepted scope into a numbered invoice without retyping items or recalculating totals.",
    agent: "Invoice Agent",
    output: "A tax-ready invoice with due date, PDF and secure share link.",
    href: "/invoices",
    icon: ReceiptText,
    accent: "#009CDE",
  },
  {
    title: "Receive and reconcile payment",
    shortTitle: "Payments",
    description: "Collect through PayPal or record an offline payment, then reconcile it against the exact balance.",
    agent: "Payment Agent",
    output: "A verified payment record and an updated invoice balance.",
    href: "/payments",
    icon: CreditCard,
    accent: "#12B76A",
  },
  {
    title: "Track delivery costs",
    shortTitle: "Expenses",
    description: "Attach spend to the project as it happens so margin is visible before the work is finished.",
    agent: "Expense Intelligence",
    output: "Live project cost, budget use and margin.",
    href: "/expenses",
    icon: Wallet,
    accent: "#F79009",
  },
  {
    title: "Predict the cash position",
    shortTitle: "Cash flow",
    description: "Combine expected collections with the real burn rate to model the next 7, 30 and 90 days.",
    agent: "Cash Flow Agent",
    output: "A dated liquidity outlook with assumptions shown.",
    href: "/cash-flow",
    icon: TrendingUp,
    accent: "#6941C6",
  },
  {
    title: "Approve the action plan",
    shortTitle: "Insights",
    description: "PayPilot ranks what matters now. Nothing is sent or charged until you approve it.",
    agent: "PayPilot",
    output: "A prioritised next action with the reason behind it.",
    href: "/insights",
    icon: Sparkles,
    accent: "#D92D20",
  },
] as const;

const PLATFORM = [
  { icon: Users, title: "Client financial profiles", text: "Invoices, payments, outstanding balances and on-time behaviour in one view." },
  { icon: ReceiptText, title: "Invoices that chase themselves", text: "Tax, discounts, PDF export, secure links and status tracking." },
  { icon: TrendingUp, title: "Cash-flow you can defend", text: "Probability-weighted collections with every assumption documented." },
  { icon: ShieldCheck, title: "Approval-first automation", text: "Agents prepare actions; nothing is sent or charged without you." },
] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * "The complete finance loop" as a pinned scroll scene.
 *
 * The stage list and the console share one screen. Scrolling advances through
 * the seven stages; at 100% the scene un-pins and the page continues. Moving
 * the mouse over a stage previews it, but only on real pointer movement — the
 * scene is pinned, so nothing slides under a resting cursor while scrolling.
 */
export function FinanceLoopSection() {
  const sceneRef = useRef<HTMLElement>(null);
  const progress = usePinnedProgress(sceneRef);
  const isRealMove = useRealPointerMove();
  const [preview, setPreview] = useState<{ index: number; at: number } | null>(null);

  const scrollIndex = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
  // Scrolling always owns the console: any wheel/trackpad/touch scroll clears a
  // hover preview immediately, so a resting cursor can never pin a stale stage.
  useEffect(() => {
    const clearPreview = () => setPreview((current) => (current === null ? current : null));
    window.addEventListener("scroll", clearPreview, { passive: true });
    window.addEventListener("wheel", clearPreview, { passive: true });
    window.addEventListener("touchmove", clearPreview, { passive: true });
    return () => {
      window.removeEventListener("scroll", clearPreview);
      window.removeEventListener("wheel", clearPreview);
      window.removeEventListener("touchmove", clearPreview);
    };
  }, []);
  const activeIndex = preview && preview.at === scrollIndex ? preview.index : scrollIndex;
  const active = STEPS[activeIndex];
  const ActiveIcon = active.icon;
  const percent = Math.round(progress * 100);
  const done = progress >= 0.995;
  const fill = (index: number) => clamp01(progress * STEPS.length - index);

  return (
    <>
      <section
        id="workflow"
        ref={sceneRef}
        data-loop-active={scrollIndex}
        data-loop-percent={percent}
        className="relative bg-white"
        style={{ height: "300svh" }}
      >
        <div className="loop-scene sticky top-0 isolate flex h-svh flex-col overflow-hidden px-4 pb-4 pt-[78px] sm:px-6 sm:pb-5 sm:pt-[88px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(56,103,255,.09),transparent_70%)]"
          />
          <div className="relative mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col">
            <div className="loop-heading-row flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="hidden text-[11px] font-extrabold uppercase tracking-[.18em] text-brand sm:block">The complete finance loop</p>
                <h2 className="font-display text-xl font-extrabold tracking-tight text-navy sm:mt-1.5 sm:text-[34px]">One loop. Every step connected.</h2>
              </div>
              <div className="loop-stage-badge flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <span className="text-[11px] font-bold text-slate-500">
                  Stage <span className="text-navy">{scrollIndex + 1}</span> of {STEPS.length}
                </span>
                <span className="h-4 border-l border-slate-200" />
                <span className="font-display text-lg font-extrabold tabular-nums text-navy" data-loop-readout>
                  {percent}%
                </span>
              </div>
            </div>

            <div className="loop-stage-progress mt-4 flex gap-1.5" aria-hidden="true">
              {STEPS.map((step, index) => (
                <span key={step.title} className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full" style={{ width: `${(fill(index) * 100).toFixed(1)}%`, background: step.accent }} />
                </span>
              ))}
            </div>

            <div className="loop-content-grid mt-4 grid min-h-0 flex-1 gap-4 lg:mt-5 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-6">
              {/* Desktop stage list */}
              <ol className="hidden min-h-0 flex-col justify-center gap-2.5 lg:flex" onMouseLeave={() => setPreview(null)}>
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const state = index < scrollIndex ? "complete" : index === scrollIndex ? "current" : "queued";
                  const previewed = preview?.at === scrollIndex && preview.index === index && index !== scrollIndex;
                  return (
                    <li key={step.title} className="min-h-0">
                      <Link
                        href={step.href}
                        onPointerMove={(event) => {
                          if (isRealMove(event) && preview?.index !== index) setPreview({ index, at: scrollIndex });
                        }}
                        onFocus={() => setPreview({ index, at: scrollIndex })}
                        onBlur={() => setPreview(null)}
                        aria-current={state === "current" ? "step" : undefined}
                        data-loop-step={state}
                        className="group flex items-center gap-3.5 rounded-2xl border px-3.5 py-2.5 transition-[transform,background-color,border-color,box-shadow,opacity] duration-300"
                        style={{
                          transform: state === "current" ? "translateX(8px)" : "none",
                          borderColor: state === "current" || previewed ? `${step.accent}66` : "#e8ecf2",
                          background: state === "current" ? "#ffffff" : state === "complete" ? "#fbfcfe" : "#f8fafc",
                          boxShadow: state === "current" ? `0 18px 40px -26px ${step.accent}` : "none",
                          opacity: state === "queued" && !previewed ? 0.62 : 1,
                        }}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300"
                          style={{
                            background: state === "current" ? step.accent : state === "complete" ? `${step.accent}1a` : "#ffffff",
                            color: state === "current" ? "#ffffff" : state === "complete" ? step.accent : "#a0abbb",
                            border: state === "queued" ? "1px solid #e3e8f0" : "1px solid transparent",
                          }}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-display text-[15px] font-extrabold tracking-tight text-navy">{step.title}</span>
                          <span className="block truncate text-[11px] font-semibold" style={{ color: state === "queued" ? "#98a2b3" : step.accent }}>
                            {step.agent}
                          </span>
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.08em]"
                          style={{
                            background: state === "current" ? `${step.accent}17` : state === "complete" ? "#eaf8f1" : "#f1f4f8",
                            color: state === "current" ? step.accent : state === "complete" ? "#07865d" : "#98a2b3",
                          }}
                        >
                          {state}
                        </span>
                        <span className="w-6 shrink-0 text-right font-display text-[13px] font-extrabold tabular-nums text-slate-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>

              {/* Mobile stepper: every stage visible at a glance */}
              <div className="loop-stepper flex items-center justify-between gap-1 lg:hidden" aria-hidden="true">
                {STEPS.map((step, index) => {
                  const Icon = step.icon;
                  const state = index < scrollIndex ? "complete" : index === scrollIndex ? "current" : "queued";
                  return (
                    <span
                      key={step.title}
                      data-loop-chip={state}
                      className="flex h-10 flex-1 items-center justify-center rounded-xl transition-all duration-300"
                      style={{
                        background: state === "current" ? step.accent : state === "complete" ? `${step.accent}1a` : "#f1f4f8",
                        color: state === "current" ? "#ffffff" : state === "complete" ? step.accent : "#a0abbb",
                        transform: state === "current" ? "scale(1.08)" : "none",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                  );
                })}
              </div>

              {/* Console */}
              <aside className="loop-console relative flex min-h-0 w-full flex-col self-start overflow-hidden rounded-[24px] bg-navy text-white shadow-[0_30px_70px_-38px_rgba(16,24,40,.75)] lg:self-stretch">
                <div className="h-1.5 shrink-0 bg-white/10">
                  <div className="h-full bg-gradient-to-r from-brand via-[#009cde] to-mint" style={{ width: `${percent}%` }} />
                </div>
                <div className="loop-console-body flex min-h-0 flex-1 flex-col p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9db4d6]">
                        {preview && preview.at === scrollIndex && preview.index !== scrollIndex ? "Previewing stage" : "Live loop console"}
                      </p>
                      <p key={`n-${activeIndex}`} className="animate-fade-up mt-2 font-display text-4xl font-extrabold leading-none tracking-tight sm:text-5xl" data-loop-console-number>
                        {String(activeIndex + 1).padStart(2, "0")}
                        <span className="text-lg text-[#7f95b5]"> / {String(STEPS.length).padStart(2, "0")}</span>
                      </p>
                    </div>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10" style={{ color: active.accent }}>
                      <ActiveIcon className="h-6 w-6" />
                    </span>
                  </div>

                  <div key={`t-${activeIndex}`} className="animate-fade-up">
                    <h3 className="mt-3 font-display text-xl font-extrabold tracking-tight sm:mt-4">{active.title}</h3>
                    <p className="loop-short-hide mt-2 text-[13px] leading-relaxed text-[#b9c7dc]">{active.description}</p>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-[12px] sm:space-y-2.5">
                    <div className="loop-detail-row flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <span className="text-[#8fa3bf]">Responsible agent</span>
                      <span className="text-left font-bold text-white sm:text-right">{active.agent}</span>
                    </div>
                    <div className="loop-detail-row flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="shrink-0 text-[#8fa3bf]">Stage output</span>
                      <span className="text-left font-semibold leading-snug text-white sm:max-w-[240px] sm:text-right">{active.output}</span>
                    </div>
                  </div>

                  {activeIndex < STEPS.length - 1 ? (
                    <div className="loop-short-hide mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.04] px-3.5 py-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10"
                        style={{ color: STEPS[activeIndex + 1].accent }}
                      >
                        {(() => {
                          const NextIcon = STEPS[activeIndex + 1].icon;
                          return <NextIcon className="h-[18px] w-[18px]" />;
                        })()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-extrabold uppercase tracking-[.14em] text-[#8fa3bf]">Next up</span>
                        <span className="block truncate text-[13px] font-bold text-white">{STEPS[activeIndex + 1].title}</span>
                      </span>
                      <span className="hidden shrink-0 text-[11px] font-semibold text-[#8fa3bf] sm:block">{STEPS[activeIndex + 1].agent}</span>
                    </div>
                  ) : (
                    <div className="loop-short-hide mt-4 rounded-2xl border border-[#70d9ab]/30 bg-[#70d9ab]/10 px-3.5 py-3 text-[12px] font-semibold text-[#a9ecd0]">
                      The loop is complete. Every step wrote to the same ledger, so the next cycle starts with today’s numbers.
                    </div>
                  )}

                  <div className="loop-cta mt-5 pt-1 sm:mt-auto sm:pt-4">
                    <Link href={active.href} className="btn btn-primary w-full !py-3">
                      Open {active.shortTitle} <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[10px] font-bold uppercase tracking-[.14em]" style={{ color: done ? "#70d9ab" : "#7f95b5" }}>
                      <ArrowDown className={`h-3.5 w-3.5 ${done ? "" : "animate-bounce"}`} />
                      {done ? "Loop complete — keep scrolling" : "Scroll to advance the loop"}
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-white">
        <div className="mx-auto max-w-6xl border-t border-slate-200/80 px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div data-scroll>
              <p className="text-[11px] font-extrabold uppercase tracking-[.18em] text-brand">Built for operators</p>
              <h3 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-navy">Not another accounting maze.</h3>
            </div>
            <p data-scroll data-scroll-delay={20} className="max-w-md text-[13px] leading-relaxed text-slate-500">
              The loop stays useful because every screen answers the next business question, not just the last transaction.
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM.map((item, index) => (
              <div key={item.title} data-scroll data-scroll-delay={index * 25} className="card card-hover p-5">
                <item.icon className="h-5 w-5 text-brand" />
                <p className="mt-3 text-[14px] font-extrabold tracking-tight text-navy">{item.title}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
