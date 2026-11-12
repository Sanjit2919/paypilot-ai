"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, CreditCard, Receipt, Sparkles, TrendingUp, Wallet } from "lucide-react";

const TEAM = [
  {
    name: "Invoice Agent",
    icon: Receipt,
    description: "Builds quotations and invoices, applies tax and discounts, generates PDFs and chases overdue documents.",
    from: "#3867FF",
    to: "#6E8BFF",
  },
  {
    name: "Payment Agent",
    icon: CreditCard,
    description: "Reconciles incoming payments, integrates PayPal, flags overdue balances and drafts reminders for approval.",
    from: "#12B76A",
    to: "#6CE9A6",
  },
  {
    name: "Expense Intelligence Agent",
    icon: Wallet,
    description: "Auto-categorises spend, detects anomalies, spots recurring costs and suggests reductions.",
    from: "#F79009",
    to: "#FEC84B",
  },
  {
    name: "Cash Flow Prediction Agent",
    icon: TrendingUp,
    description: "Projects 7, 30 and 90-day liquidity using real invoices, expected collections and your burn rate.",
    from: "#7A5AF8",
    to: "#B692F6",
  },
  {
    name: "Business Intelligence Agent",
    icon: BarChart3,
    description: "Scores financial health, evaluates client payment behaviour and writes your weekly and monthly reports.",
    from: "#F04438",
    to: "#FDA29B",
  },
  {
    name: "PayPilot",
    icon: Sparkles,
    description:
      "Detects a risk, asks the right agents why it happened, then explains what happens next and what you should do — with approval gates on every action.",
    from: "#101828",
    to: "#3b4a66",
  },
] as const;

/**
 * "A multi-agent team, not a chatbot" — driven by the scroll position.
 * Agents come online one by one as the section travels up the screen and go
 * back to standby when you scroll the other way. The rise/fade of each card,
 * the progress rail and the heading highlight come from ScrollMotion.
 */
export function AgentTeamSection() {
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  // Everyone is online by default, so the section reads complete without scripting.
  const [online, setOnline] = useState<boolean[]>(() => TEAM.map(() => true));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const nodes = cards.current;
      const viewport = window.innerHeight;
      const firstRowTop = nodes[0]?.offsetTop;
      const columns = Math.max(1, nodes.filter((node) => node && node.offsetTop === firstRowTop).length);
      const atPageEnd = window.scrollY + viewport >= document.documentElement.scrollHeight - 2;
      const next = nodes.map((node, index) => {
        if (!node) return true;
        // Each column switches on a little later, so a row lights up left to right as you scroll.
        const line = viewport * 0.9 - (index % columns) * 34;
        return atPageEnd || node.getBoundingClientRect().top < line;
      });
      setOnline((current) => (current.every((value, index) => value === next[index]) ? current : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  const onlineCount = online.filter(Boolean).length;

  return (
    <section id="agents" className="border-y border-slate-200/70 bg-[#f9fafc]">
      <div data-scroll-track className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div data-scroll className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              A multi-agent team,{" "}
              <span
                className="bg-no-repeat"
                style={{
                  backgroundImage: "linear-gradient(90deg, rgba(56,103,255,.24), rgba(0,156,222,.24))",
                  backgroundPosition: "0 90%",
                  backgroundSize: "calc(min(1, var(--track, 1) * 2.6) * 100%) .36em",
                }}
              >
                not a chatbot
              </span>
            </h2>
            <p className="mt-2 text-slate-600">
              Each agent owns a financial workflow. The coordinator shares context between them, then presents one
              prioritised action plan for you to approve.
            </p>
          </div>
          <div
            data-scroll
            data-scroll-delay={20}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-navy shadow-sm"
          >
            <span className={`h-2 w-2 rounded-full ${onlineCount === TEAM.length ? "bg-mint" : "animate-pulse-dot bg-brand"}`} />
            <span className="tabular-nums">
              {onlineCount} of {TEAM.length}
            </span>
            agents online
          </div>
        </div>

        <div className="mt-6 h-1 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
          <div
            className="h-full origin-left rounded-full bg-gradient-to-r from-brand to-[#009cde]"
            style={{ scale: "var(--track, 1) 1" }}
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((agent, index) => {
            const on = online[index];
            const gradient = `linear-gradient(135deg, ${agent.from}, ${agent.to})`;
            return (
              <div
                key={agent.name}
                ref={(node) => {
                  cards.current[index] = node;
                }}
                data-scroll
                data-scroll-delay={(index % 3) * 30}
                className="card card-hover relative overflow-hidden p-5"
                style={
                  on
                    ? { borderColor: "#c9d7ff", boxShadow: "0 1px 2px rgba(16,24,40,.03), 0 18px 40px -28px rgba(56,103,255,.65)" }
                    : undefined
                }
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] origin-left transition-transform duration-500 ease-out"
                  style={{ backgroundImage: gradient, transform: on ? "scaleX(1)" : "scaleX(0)" }}
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white transition duration-500 ${on ? "" : "opacity-45 grayscale"}`}
                    style={{ backgroundImage: gradient }}
                  >
                    <agent.icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] transition-colors duration-500 ${
                      on ? "bg-mint-soft text-[#087443]" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-500 ${on ? "bg-mint" : "bg-slate-300"}`} />
                    {on ? "Online" : "Standby"}
                  </span>
                </div>
                <p className="mt-3 font-semibold text-navy">{agent.name}</p>
                <p className={`mt-1 text-sm leading-relaxed transition-colors duration-500 ${on ? "text-slate-600" : "text-slate-400"}`}>
                  {agent.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
