"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Clock3, Loader2, Play, ShieldCheck, X } from "lucide-react";
import { apiSend, errorMessage, useApi } from "@/lib/client";
import { formatDate, formatDateTime } from "@/lib/format";
import { Alert, Badge, Card, EmptyState, ToastHost, useToast } from "@/components/ui";

type Action = {
  id: string;
  agent: string;
  kind: string;
  title: string;
  reason: string;
  expectedOutcome: string;
  supportingData: Record<string, unknown>;
  approvalStatus: string;
  executionStatus: string;
  resultMessage: string;
  approvedAt: string | null;
  executedAt: string | null;
  createdAt: string;
};

export function ActionCenter() {
  const { data, loading, error, reload } = useApi<{ actions: Action[] }>("/api/actions");
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast, show, clear } = useToast();

  async function run(id: string, operation: "approve" | "execute" | "dismiss") {
    setBusy(`${id}:${operation}`);
    try {
      const result = await apiSend<{ message?: string }>("/api/actions", "POST", { id, operation });
      show(operation === "dismiss" ? "info" : "success", result.message ?? (operation === "approve" ? "Action approved." : "Action updated."));
      await reload();
    } catch (err) {
      show("error", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const actions = data?.actions ?? [];
  const pending = actions.filter((action) => action.executionStatus !== "completed" && action.approvalStatus !== "dismissed");

  return (
    <Card className="mb-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-brand">Autonomous workflow centre</p>
          <h2 className="mt-1 font-display text-[17px] font-extrabold tracking-tight text-navy">Actions that wait for your approval</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Agents recommend and document the next step. Nothing executes until you approve it.</p>
        </div>
        <Badge tone="brand"><ShieldCheck className="h-3 w-3" /> {pending.length} awaiting decision</Badge>
      </div>

      {error ? <div className="mb-3"><Alert tone="error">{error}</Alert></div> : null}
      {loading ? <div className="space-y-2">{[1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div> : null}
      {!loading && !actions.length ? <EmptyState title="No actions recommended yet" description="Overdue invoices, accepted quotations and forecast risks will appear here with the reason and expected outcome." /> : null}

      <div className="space-y-2.5">
        {actions.slice(0, 10).map((action) => {
          const open = expanded === action.id;
          const complete = action.executionStatus === "completed";
          const dismissed = action.approvalStatus === "dismissed";
          return (
            <div key={action.id} className={`rounded-xl border p-3.5 ${complete ? "border-[#c9ebd9] bg-[#f5fcf8]" : dismissed ? "border-slate-200 bg-slate-50 opacity-65" : "border-slate-200 bg-white"}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{action.agent}</Badge>
                    <Badge tone={complete ? "green" : dismissed ? "neutral" : action.approvalStatus === "approved" ? "brand" : "amber"}>
                      {complete ? "completed" : dismissed ? "dismissed" : `${action.approvalStatus} · ${action.executionStatus.replace("_", " ")}`}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[13px] font-bold text-navy">{action.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{action.reason}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {!complete && !dismissed && action.approvalStatus === "pending" ? (
                    <button type="button" onClick={() => run(action.id, "approve")} disabled={busy !== null} className="btn btn-secondary !px-3 !py-1.5 text-[11px]">
                      {busy === `${action.id}:approve` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                    </button>
                  ) : null}
                  {!complete && !dismissed && action.executionStatus === "ready" ? (
                    <button type="button" onClick={() => run(action.id, "execute")} disabled={busy !== null} className="btn btn-primary !px-3 !py-1.5 text-[11px]">
                      {busy === `${action.id}:execute` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Execute
                    </button>
                  ) : null}
                  {!complete && !dismissed ? (
                    <button type="button" onClick={() => run(action.id, "dismiss")} disabled={busy !== null} className="btn btn-ghost !p-2 text-slate-400" aria-label={`Dismiss ${action.title}`}><X className="h-4 w-4" /></button>
                  ) : null}
                  <button type="button" onClick={() => setExpanded(open ? null : action.id)} className="btn btn-ghost !p-2 text-slate-400" aria-label={open ? "Hide action details" : "Show action details"}>
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {open ? (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div><p className="font-bold uppercase tracking-wide text-slate-400">Expected outcome</p><p className="mt-1 leading-relaxed text-slate-600">{action.expectedOutcome}</p></div>
                  {action.resultMessage ? <Alert tone="success">{action.resultMessage}</Alert> : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Recommended {formatDate(action.createdAt)}</span>
                    {action.approvedAt ? <span>Approved {formatDateTime(action.approvedAt)}</span> : null}
                    {action.executedAt ? <span>Executed {formatDateTime(action.executedAt)}</span> : null}
                  </div>
                  {typeof action.supportingData.reminderText === "string" ? <pre className="scroll-thin max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 font-sans text-[11px] leading-relaxed text-slate-600">{action.supportingData.reminderText}</pre> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <ToastHost toast={toast} onClose={clear} />
    </Card>
  );
}
