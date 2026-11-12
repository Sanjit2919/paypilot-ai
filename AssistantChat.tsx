"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, CheckCircle2, Loader2, Send, ShieldCheck, Sparkles, User } from "lucide-react";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { AGENTS, agentDisplayName } from "@/lib/agentMeta";
import { Alert, Badge, Card, PageHeader, Skeleton, ToastHost, useToast } from "@/components/ui";

type ChatAction = {
  id: string;
  label: string;
  kind: string;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  agents: string[];
  actions: ChatAction[];
  createdAt: string;
};

const SUGGESTIONS = [
  "How much money did I earn this month?",
  "Which clients haven't paid?",
  "Generate an invoice for ABC Technologies",
  "What are my highest expenses?",
  "Will I face a cash shortage next month?",
  "Which invoices should I follow up on?",
  "How can I improve my profit margin?",
];

export function AssistantChat() {
  const searchParams = useSearchParams();
  const prefilledQuestion = searchParams.get("prompt");
  const { data, loading, error, setData } = useApi<{ messages: ChatMessage[] }>("/api/assistant");
  const integration = useApi<{ gemini: { configured: boolean } }>("/api/integrations");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const { toast, show, clear } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = data?.messages ?? [];

  useEffect(() => {
    if (prefilledQuestion) setInput(prefilledQuestion);
  }, [prefilledQuestion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    const lower = trimmed.toLowerCase();
    setActiveAgents([
      "coordinator",
      ...(lower.match(/invoice|quotation|quote/) ? ["invoice"] : []),
      ...(lower.match(/paid|payment|overdue|remind/) ? ["payment"] : []),
      ...(lower.match(/expense|spend|cost/) ? ["expense"] : []),
      ...(lower.match(/cash|forecast|shortage|runway/) ? ["cashflow"] : []),
      ...(lower.match(/revenue|profit|margin|client/) ? ["bi"] : []),
    ]);
    const optimistic: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      agents: [],
      actions: [],
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ messages: [...(prev?.messages ?? []), optimistic] }));

    try {
      const result = await apiSend<{ reply: ChatMessage; userMessage: ChatMessage }>("/api/assistant", "POST", {
        message: trimmed,
      });
      setData((prev) => ({
        messages: [...(prev?.messages ?? []).filter((m) => m.id !== optimistic.id), result.userMessage, result.reply],
      }));
    } catch (err) {
      show("error", errorMessage(err));
      setData((prev) => ({ messages: (prev?.messages ?? []).filter((m) => m.id !== optimistic.id) }));
    } finally {
      setSending(false);
      setActiveAgents([]);
    }
  }

  async function approve(action: ChatAction, messageId: string) {
    setApproving(`${messageId}:${action.id}`);
    try {
      const result = await apiSend<{ message: string }>("/api/assistant/approve", "POST", {
        messageId,
        actionId: action.id,
      });
      show("success", result.message);
      setData((prev) => ({
        messages: (prev?.messages ?? []).map((message) => message.id === messageId
          ? { ...message, actions: message.actions.filter((item) => item.id !== action.id) }
          : message),
      }));
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        compactOnMobile
        title="AI Finance Assistant"
        subtitle="Ask anything about your money. PayPilot routes your request to the right specialist agents."
        actions={
          <Badge tone="brand">
            <ShieldCheck className="h-3 w-3" /> Approval required for actions
          </Badge>
        }
      />

      {error ? (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="flex h-[calc(100svh-185px)] min-h-[320px] flex-col !p-0 sm:h-[calc(100svh-235px)] lg:h-[calc(100svh-265px)] lg:min-h-[520px]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy">PayPilot</p>
                <p className="text-[11px] text-slate-500">Grounded in your ledger · {integration.data?.gemini.configured ? "Gemini reasoning" : "deterministic reasoning"}</p>
              </div>
            </div>
            {sending ? (
              <div className="flex items-center gap-1.5 text-xs text-brand">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {activeAgents.map((agent) => (
                  <span key={agent} className="animate-pulse-dot">
                    {agentDisplayName(agent)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {loading ? <Skeleton rows={2} /> : null}
            {!loading && !messages.length ? (
              <div className="mx-auto flex max-w-xl flex-col items-center px-2 py-4 text-center sm:py-12">
                <span className="hidden h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3867ff] to-[#7d98ff] text-white shadow-lg shadow-brand/20 min-[380px]:flex"><Sparkles className="h-6 w-6" /></span>
                <span className="mt-4 rounded-full border border-brand/15 bg-brand-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-brand">Your virtual CFO is ready</span>
                <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight text-navy sm:mt-3 sm:text-[23px]">What would you like to know?</h2>
                <p className="mt-2 hidden max-w-md text-[13px] leading-relaxed text-slate-500 min-[380px]:block">Ask about your revenue, cash runway, clients or overdue invoices. PayPilot coordinates the right specialists and grounds every answer in your ledger.</p>
                <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.slice(0, 4).map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => send(suggestion)} className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-[12px] font-semibold text-slate-600 transition hover:border-brand/40 hover:bg-brand-soft/30 hover:text-brand">
                      {suggestion}<Sparkles className="h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-brand" />
                    </button>
                  ))}
                </div>
                <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5" />No financial action or external message without your approval</p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" ? (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    <Bot className="h-4 w-4" />
                  </span>
                ) : null}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-brand text-white"
                      : "border border-slate-200/80 bg-white text-slate-700"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {message.agents.length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {message.agents.map((agent) => (
                        <span
                          key={agent}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {agentDisplayName(agent)}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {message.actions.length ? (
                    <div className="mt-3 space-y-2">
                      {message.actions.map((action) => (
                        <div key={action.id} className="rounded-xl border border-brand/25 bg-brand-soft/60 p-2.5">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                            Action prepared · approval required
                          </p>
                          <p className="mt-0.5 text-xs text-slate-600">{action.label}</p>
                          <button
                            type="button"
                            onClick={() => approve(action, message.id)}
                            disabled={approving === `${message.id}:${action.id}`}
                            className="btn btn-primary mt-2 !px-3 !py-1.5 text-xs"
                          >
                            {approving === action.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            )}
                            Approve action
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                {message.role === "user" ? (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                    <User className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 p-3">
            <div className="mb-2 hidden flex-wrap gap-1.5 min-[430px]:flex">
              {SUGGESTIONS.slice(2).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => send(suggestion)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:border-brand/40 hover:text-brand"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send(input);
              }}
              className="flex items-center gap-2"
            >
              <input
                className="input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about revenue, overdue invoices, expenses or cash flow…"
              />
              <button type="submit" disabled={sending || !input.trim()} className="btn btn-primary !px-3">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </Card>

        <div className="space-y-3">
          <Card>
            <h2 className="text-sm font-semibold text-navy">Agent routing</h2>
            <p className="mb-3 text-xs text-slate-500">The coordinator delegates to these specialists</p>
            <div className="space-y-2">
              {AGENTS.map((agent) => (
                <div key={agent.key} className="flex items-start gap-2">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                      activeAgents.includes(agent.key) ? "animate-pulse-dot bg-brand" : "bg-slate-300"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-navy">{agent.name}</p>
                    <p className="text-[11px] leading-snug text-slate-500">{agent.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold text-navy">Guardrails</h2>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slate-600">
              <li>• Agents never send email or charge a card without explicit approval.</li>
              <li>• Forecasts are labelled as estimates with documented assumptions.</li>
              <li>• Every answer is computed from your own database records.</li>
              <li>• Demo PayPal mode is clearly labelled when credentials are missing.</li>
            </ul>
          </Card>
        </div>
      </div>

      <ToastHost toast={toast} onClose={clear} />
    </div>
  );
}
