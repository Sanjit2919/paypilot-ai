"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import {
  ArrowUpRight, BarChart3, Bell, ChevronDown, ChevronLeft, ChevronRight,
  Command, CreditCard, FileText, FolderKanban, LayoutDashboard, Lightbulb,
  Loader2, LogOut, Menu, Plus, Receipt, Search, Settings, ShieldCheck,
  Sparkles, TrendingUp, Users, Wallet, X,
} from "lucide-react";
import { BearMark } from "@/components/BearMark";
import { CommandMenu } from "@/components/CommandMenu";
import { useScrollMotion } from "@/components/ScrollMotion";
import { WorkspaceProvider, type Workspace } from "@/components/WorkspaceContext";
import { ToastHost, useToast } from "@/components/ui";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { relativeTime } from "@/lib/format";
import type { NotificationDTO } from "@/lib/types";

const GROUPS = [
  { title: "WORKSPACE", links: [
    { href: "/overview", label: "Overview", icon: LayoutDashboard },
    { href: "/assistant", label: "AI Finance Assistant", icon: Sparkles },
  ] },
  { title: "OPERATIONS", links: [
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/quotations", label: "Quotations", icon: FileText },
    { href: "/invoices", label: "Invoices", icon: Receipt },
    { href: "/payments", label: "Payments", icon: CreditCard },
    { href: "/expenses", label: "Expenses", icon: Wallet },
    { href: "/clients", label: "Clients", icon: Users },
  ] },
  { title: "INTELLIGENCE", links: [
    { href: "/cash-flow", label: "Cash Flow", icon: TrendingUp },
    { href: "/insights", label: "AI Insights", icon: Lightbulb },
    { href: "/reports", label: "Reports", icon: BarChart3 },
  ] },
  { title: "ACCOUNT", links: [
    { href: "/settings", label: "Settings", icon: Settings },
  ] },
];

const ALL_LINKS = GROUPS.flatMap((group) => group.links);

export function AppShell({ children, user }: { children: ReactNode; user: Workspace }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  useScrollMotion(mainRef, { selector: ".card, [data-scroll]", distance: 82, shift: 26, floor: 0.16 });
  const { toast, show, clear } = useToast();
  const { data, reload } = useApi<{ notifications: NotificationDTO[] }>("/api/notifications", { refreshMs: 30_000 });

  useEffect(() => {
    setMobileOpen(false);
    setBellOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") { setBellOpen(false); setCommandOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const page = ALL_LINKS.find((item) => item.href === pathname);
  const unread = data?.notifications.filter((n) => !n.read).length ?? 0;
  const initials = (user.fullName || user.email || "PA")
    .split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  async function logout() {
    try {
      await apiSend("/api/auth/logout", "POST");
      router.push("/login");
      router.refresh();
    } catch (error) { show("error", errorMessage(error)); }
  }

  async function runReview() {
    setRunning(true);
    try {
      await apiSend("/api/agents", "POST");
      show("success", "Agent review complete. Your recommendations are ready.");
      if (pathname === "/insights") window.dispatchEvent(new Event("paypilot:review-complete"));
      else router.push("/insights");
    } catch (error) { show("error", errorMessage(error)); }
    finally { setRunning(false); }
  }

  async function markAllRead() {
    try { await apiSend("/api/notifications", "PATCH", {}); await reload(); }
    catch (error) { show("error", errorMessage(error)); }
  }

  const expanded = !collapsed || mobileOpen;

  function startSwipe(event: TouchEvent<HTMLDivElement>) {
    if (window.innerWidth >= 1024) return;
    const touch = event.touches[0];
    swipeStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function endSwipe(event: TouchEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || window.innerWidth >= 1024) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 72 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (!mobileOpen && start.x < 42 && dx > 0) setMobileOpen(true);
    if (mobileOpen && dx < 0) setMobileOpen(false);
  }

  return (
    <WorkspaceProvider value={user}>
      <div className="flex min-h-screen bg-[#f6f8fc]" onTouchStart={startSwipe} onTouchEnd={endSwipe}>
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/[.07] bg-[#101828] text-white shadow-2xl shadow-navy/10 transition-all duration-300 ${collapsed ? "lg:w-[76px]" : "lg:w-[270px]"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
          <div className="relative overflow-hidden border-b border-white/[.07] px-4 pb-4 pt-5">
            <div className="pointer-events-none absolute -right-10 -top-16 h-32 w-32 rounded-full bg-brand/20 blur-2xl" />
            <div className="relative flex items-center justify-between gap-2">
              <Link href="/overview" className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-brand text-white shadow-[0_6px_18px_rgba(56,103,255,.35)]"><BearMark className="h-[22px] w-[22px]" /></span>
                {expanded && <span className="min-w-0"><span className="block font-display text-[15px] font-extrabold tracking-tight text-white">PayPilot <span className="text-[#8ca8ff]">AI</span></span><span className="block text-[10px] font-medium tracking-[.07em] text-slate-400">AUTONOMOUS FINANCE</span></span>}
              </Link>
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            {expanded && <Link href="/settings" className="relative mt-6 flex items-center gap-2.5 rounded-xl border border-white/[.09] bg-white/[.055] px-3 py-2.5 transition hover:bg-white/[.09]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#334b82] text-xs font-bold text-white">{user.businessName.trim().slice(0, 1).toUpperCase() || "B"}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{user.businessName || "Your business"}</span><span className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${user.isDemo ? "bg-amber-400" : "bg-emerald-400"}`} />{user.isDemo ? "Demo workspace" : "Your workspace"} · {user.currency}</span></span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </Link>}
          </div>

          <nav aria-label="Main navigation" className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
            {GROUPS.map((group) => (
              <div key={group.title}>
                {expanded ? <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[.15em] text-[#79869d]">{group.title}</p> : <div className="mx-2 mb-2 border-t border-white/10" />}
                <div className="space-y-0.5">
                  {group.links.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return <Link key={item.href} href={item.href} title={item.label} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-[9px] text-[12.5px] font-medium transition-colors ${active ? "bg-[#273c73] text-white" : "text-[#aebbd0] hover:bg-white/[.065] hover:text-white"}`}>
                      {active && <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#6f93ff]" />}
                      <Icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[#8aa5ff]" : "text-[#7f91ad] group-hover:text-slate-200"}`} strokeWidth={1.9} />
                      {expanded && <span className="truncate">{item.label}</span>}
                      {expanded && item.href === "/assistant" && <span className="ml-auto rounded-[5px] bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-[#a8baff]">AI</span>}
                    </Link>;
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/[.07] px-3 pb-3 pt-3">
            {expanded && <div className="mb-3 rounded-xl border border-[#5f79c5]/20 bg-gradient-to-br from-[#243659] to-[#1a2949] p-3.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-white"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand/25 text-[#9bb0ff]"><Sparkles className="h-3.5 w-3.5" /></span>Your finance team is ready</div>
              <p className="mt-2 text-[11px] leading-[1.6] text-[#b0bed5]">Five specialist agents turn your ledger into a plan you can act on.</p>
              <button type="button" onClick={runReview} disabled={running} className="mt-2 flex min-h-[40px] w-full items-center gap-1.5 rounded-lg bg-white/[.06] px-2.5 py-2 text-[12px] font-bold text-[#a5baff] transition hover:bg-white/10 hover:text-white">{running ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpRight className="h-3 w-3" />}{running ? "Running review…" : "Run a review"}</button>
            </div>}
            <div className="flex items-center gap-2 rounded-xl px-1.5 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#385291] text-xs font-bold text-white">{initials}</span>
              {expanded && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{user.fullName || "Workspace owner"}</span><span className="block truncate text-[10px] text-[#91a0b6]">{user.email}</span></span>}
              {expanded && <button type="button" onClick={logout} className="rounded-lg p-2 text-[#91a0b6] transition hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>}
            </div>
            {!expanded && <button type="button" onClick={logout} className="mt-2 flex w-full items-center justify-center rounded-lg p-2 text-[#91a0b6] hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>}
          </div>
          <button type="button" onClick={() => setCollapsed((state) => !state)} className="hidden items-center justify-center gap-1.5 border-t border-white/[.07] py-2.5 text-[10px] font-semibold text-[#91a0b6] hover:bg-white/[.04] hover:text-white lg:flex"><ChevronLeft className={`h-3.5 w-3.5 transition-transform ${collapsed ? "rotate-180" : ""}`} />{!collapsed && "Collapse sidebar"}</button>
        </aside>

        {mobileOpen && <div className="fixed inset-0 z-30 bg-navy/55 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />}

        <div className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-300 ${collapsed ? "lg:pl-[76px]" : "lg:pl-[270px]"}`}>
          <header className="sticky top-0 z-20 flex h-[69px] items-center gap-3 border-b border-[#e8ecf2] bg-white/95 px-4 backdrop-blur-xl sm:px-7 lg:px-8">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[12px] text-slate-400"><span className="hidden truncate sm:inline">{user.businessName}</span><ChevronRight className="hidden h-3 w-3 sm:inline" /><span className="truncate font-bold text-[#344054]">{page?.label || "Workspace"}</span></div>
              <p className="hidden text-[10px] text-slate-400 sm:block">Your financial command center</p>
            </div>
            <button type="button" onClick={() => setCommandOpen(true)} className="hidden h-9 min-w-[204px] items-center gap-2 rounded-lg border border-[#e5eaf2] bg-[#f8faff] px-3 text-xs text-slate-400 transition hover:border-[#bfcbec] hover:bg-white md:flex"><Search className="h-3.5 w-3.5" /><span className="flex-1 text-left">Search anything</span><kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400">⌘ K</kbd></button>
            <button type="button" onClick={() => setCommandOpen(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden" aria-label="Search workspace"><Search className="h-[18px] w-[18px]" /></button>
            <Link href="/invoices?new=1" className="btn btn-primary hidden !px-3.5 !py-2 text-[12px] sm:inline-flex"><Plus className="h-3.5 w-3.5" />New invoice</Link>
            <span className="mx-0.5 hidden h-6 border-l border-slate-200 sm:block" />
            <div className="relative">
              <button type="button" onClick={() => setBellOpen((state) => !state)} className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Notifications" aria-expanded={bellOpen}><Bell className="h-[18px] w-[18px]" />{unread > 0 && <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#ef594a] px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}</button>
              {bellOpen && <div className="absolute right-[-38px] z-30 mt-2 w-[min(350px,calc(100vw-2rem))] rounded-[16px] border border-slate-200 bg-white p-2 shadow-[0_20px_50px_-15px_rgba(16,24,40,.23)] sm:right-0"><div className="flex items-center justify-between px-2 py-2"><p className="text-xs font-extrabold text-navy">Notifications {unread > 0 && <span className="ml-1 text-brand">{unread}</span>}</p><button type="button" onClick={markAllRead} className="text-[11px] font-bold text-brand hover:underline">Mark all read</button></div><div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">{data?.notifications.length ? data.notifications.map((notification) => <div key={notification.id} className={`rounded-xl px-3 py-2.5 ${notification.read ? "" : "bg-[#f3f6ff]"}`}><p className="text-xs font-bold text-navy">{notification.title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{notification.body}</p><p className="mt-1 text-[10px] text-slate-400">{relativeTime(notification.createdAt)}</p></div>) : <p className="px-3 py-6 text-center text-xs text-slate-500">You&apos;re all caught up.</p>}</div></div>}
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9efff] text-[10px] font-extrabold text-brand" title={user.email}>{initials}</span>
          </header>

          <main ref={mainRef} className="mx-auto w-full max-w-[1540px] flex-1 px-4 pb-12 pt-7 sm:px-7 lg:px-8 lg:pt-8">{children}</main>
          <footer className="mx-auto flex w-full max-w-[1540px] flex-wrap items-center justify-between gap-2 px-4 pb-6 text-[10px] text-slate-400 sm:px-7 lg:px-8"><span>© {new Date().getFullYear()} PayPilot AI · Your finance, in focus.</span><span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Forecasts are estimates. You approve every action.</span></footer>
        </div>

        <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
        <ToastHost toast={toast} onClose={clear} />
      </div>
    </WorkspaceProvider>
  );
}
