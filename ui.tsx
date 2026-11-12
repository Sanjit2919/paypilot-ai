"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card p-5", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  compactOnMobile = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Collapses the description and actions on phones to leave room for full-height content. */
  compactOnMobile?: boolean;
}) {
  return (
    <div className={`mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${compactOnMobile ? "mb-3 sm:mb-6" : ""}`}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className={`mt-1 max-w-2xl text-sm text-slate-500 ${compactOnMobile ? "hidden sm:block" : ""}`}>{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className={`flex flex-wrap items-center gap-2 ${compactOnMobile ? "hidden sm:flex" : ""}`}>{actions}</div>
      ) : null}
    </div>
  );
}

const TONES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-brand-soft text-brand",
  green: "bg-mint-soft text-[#087443]",
  amber: "bg-amber-soft text-[#b54708]",
  red: "bg-rose-soft text-[#b42318]",
  violet: "bg-[#f4f0ff] text-[#6941c6]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): string {
  switch (status) {
    case "paid":
    case "completed":
    case "accepted":
    case "active":
      return "green";
    case "overdue":
    case "failed":
    case "critical":
      return "red";
    case "partially_paid":
    case "pending":
    case "pending_approval":
    case "warning":
    case "high":
      return "amber";
    case "sent":
    case "medium":
      return "brand";
    case "simulated":
      return "violet";
    case "draft":
    case "info":
    case "low":
      return "neutral";
    default:
      return "neutral";
  }
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "green" | "red" | "brand" | "amber";
  icon?: ReactNode;
  emphasis?: boolean;
}) {
  const valueTone =
    tone === "green"
      ? "text-[#087443]"
      : tone === "red"
        ? "text-[#b42318]"
        : tone === "brand"
          ? "text-brand"
          : tone === "amber"
            ? "text-[#b54708]"
            : "text-navy";
  return (
    <div className={cn("card card-hover p-4", emphasis && "ring-1 ring-brand/20")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={cn("mt-2 text-xl font-semibold tracking-tight sm:text-2xl", valueTone)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}…
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
      {icon ? <div className="text-slate-400">{icon}</div> : null}
      <p className="text-sm font-semibold text-navy">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
}) {
  const map = {
    info: { cls: "border-[#c7d7fe] bg-brand-soft text-[#1849a9]", Icon: Info },
    success: { cls: "border-[#abefc6] bg-mint-soft text-[#05603a]", Icon: CheckCircle2 },
    warning: { cls: "border-[#fedf89] bg-amber-soft text-[#93370d]", Icon: AlertTriangle },
    error: { cls: "border-[#fecdca] bg-rose-soft text-[#912018]", Icon: XCircle },
  } as const;
  const { cls, Icon } = map[tone];
  return (
    <div className={cn("flex gap-2 rounded-xl border px-3 py-2.5 text-sm", cls)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-[13px] leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 backdrop-blur-sm sm:items-center">
      <div
        className={cn(
          "animate-fade-up my-auto w-full rounded-2xl bg-white p-5 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-navy">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn btn-ghost !p-1.5" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "green" | "red" | "amber" }) {
  const colors = {
    brand: "bg-brand",
    green: "bg-mint",
    red: "bg-[#f04438]",
    amber: "bg-[#f79009]",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export type ToastState = { tone: "success" | "error" | "info"; message: string } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const show = useCallback((tone: "success" | "error" | "info", message: string) => {
    setToast({ tone, message });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  return { toast, show, clear: () => setToast(null) };
}

export function ToastHost({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;
  const tone = {
    success: "border-[#abefc6] bg-mint-soft text-[#05603a]",
    error: "border-[#fecdca] bg-rose-soft text-[#912018]",
    info: "border-[#c7d7fe] bg-brand-soft text-[#1849a9]",
  }[toast.tone];
  return (
    <div className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className={cn("animate-fade-up flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg", tone)}>
        <span className="flex-1">{toast.message}</span>
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === tab.key ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy",
          )}
        >
          {tab.label}
          {typeof tab.count === "number" ? (
            <span className="ml-1.5 text-xs text-slate-400">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
