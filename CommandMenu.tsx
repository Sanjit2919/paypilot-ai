"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText, FolderKanban, Plus, Receipt, Search, Sparkles, Users, Wallet, X } from "lucide-react";

type SearchResult = {
  id: string;
  kind: "client" | "project" | "invoice" | "quotation";
  title: string;
  detail: string;
  href: string;
};

type CommandItem = { title: string; detail: string; href: string; icon: typeof Search; category: string };

const QUICK: CommandItem[] = [
  { title: "Create invoice", detail: "Issue a new invoice", href: "/invoices?new=1", icon: Receipt, category: "Quick actions" },
  { title: "Add client", detail: "Add a new contact", href: "/clients?new=1", icon: Users, category: "Quick actions" },
  { title: "Create project", detail: "Start an engagement", href: "/projects?new=1", icon: FolderKanban, category: "Quick actions" },
  { title: "Record expense", detail: "Log a business cost", href: "/expenses?new=1", icon: Wallet, category: "Quick actions" },
  { title: "Ask the assistant", detail: "Get an answer from your agents", href: "/assistant", icon: Sparkles, category: "Quick actions" },
];

const PAGES: CommandItem[] = [
  { title: "Overview", detail: "Financial dashboard", href: "/overview", icon: Search, category: "Pages" },
  { title: "AI Finance Assistant", detail: "Ask the agent team", href: "/assistant", icon: Sparkles, category: "Pages" },
  { title: "Projects", detail: "Profitability and budgets", href: "/projects", icon: FolderKanban, category: "Pages" },
  { title: "Quotations", detail: "Proposals and estimates", href: "/quotations", icon: FileText, category: "Pages" },
  { title: "Invoices", detail: "Issued and draft invoices", href: "/invoices", icon: Receipt, category: "Pages" },
  { title: "Payments", detail: "Collections and PayPal", href: "/payments", icon: Receipt, category: "Pages" },
  { title: "Expenses", detail: "Spending and categories", href: "/expenses", icon: Wallet, category: "Pages" },
  { title: "Cash Flow", detail: "Forecasts and runway", href: "/cash-flow", icon: Search, category: "Pages" },
  { title: "AI Insights", detail: "Risks and recommendations", href: "/insights", icon: Sparkles, category: "Pages" },
  { title: "Clients", detail: "Client financial profiles", href: "/clients", icon: Users, category: "Pages" },
  { title: "Reports", detail: "PDF and CSV exports", href: "/reports", icon: FileText, category: "Pages" },
  { title: "Settings", detail: "Business and integrations", href: "/settings", icon: Search, category: "Pages" },
];

const icons = { client: Users, project: FolderKanban, invoice: Receipt, quotation: FileText } as const;

export function CommandMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      document.body.style.overflow = "hidden";
      const timer = setTimeout(() => inputRef.current?.focus(), 30);
      return () => { clearTimeout(timer); document.body.style.overflow = ""; };
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setResults([]);
      } finally { if (!controller.signal.aborted) setSearching(false); }
    }, 230);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, query]);

  const items = useMemo(() => {
    const text = query.trim().toLowerCase();
    const local = text
      ? [...QUICK, ...PAGES].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(text)).slice(0, 6)
      : [...QUICK];
    return [
      ...local,
      ...results.map((result) => ({
        title: result.title,
        detail: result.detail,
        href: result.href,
        icon: icons[result.kind],
        category: "Your workspace",
      })),
    ];
  }, [query, results]);

  useEffect(() => { setSelectedIndex(0); }, [query, results]);

  function navigate(href: string) {
    onClose();
    router.push(href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#0b1427]/55 px-4 pt-[12vh] backdrop-blur-[5px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Search PayPilot" className="animate-fade-up w-full max-w-[570px] overflow-hidden rounded-[20px] border border-white/40 bg-white shadow-[0_28px_90px_-20px_rgba(6,17,40,.45)]">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-brand" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") { event.preventDefault(); setSelectedIndex((value) => Math.min(value + 1, items.length - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setSelectedIndex((value) => Math.max(value - 1, 0)); }
              if (event.key === "Enter" && items[selectedIndex]) { event.preventDefault(); navigate(items[selectedIndex].href); }
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-navy outline-none placeholder:text-slate-400"
            placeholder="Search invoices, clients, projects or pages…"
            aria-label="Search workspace"
          />
          {searching ? <span className="text-xs text-slate-400">Searching…</span> : null}
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-navy" aria-label="Close search"><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="scroll-thin max-h-[min(500px,65vh)] overflow-y-auto p-2.5">
          {items.length ? items.map((item, index) => {
            const Icon = item.icon;
            const showCategory = index === 0 || items[index - 1]?.category !== item.category;
            return (
              <div key={`${item.href}-${index}`}>
                {showCategory ? <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{item.category}</p> : null}
                <button
                  type="button"
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${selectedIndex === index ? "bg-brand-soft" : "hover:bg-slate-50"}`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selectedIndex === index ? "bg-white text-brand" : "bg-slate-100 text-slate-500"}`}><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-navy">{item.title}</span><span className="block truncate text-[11px] text-slate-500">{item.detail}</span></span>
                  {selectedIndex === index ? <ArrowRight className="h-4 w-4 text-brand" /> : null}
                </button>
              </div>
            );
          }) : <p className="px-5 py-8 text-center text-sm text-slate-500">No matches yet. Try an invoice number, client or project name.</p>}
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] text-slate-500"><span>↑ ↓ to navigate · Enter to open</span><span>Esc to close</span></div>
      </div>
    </div>
  );
}
