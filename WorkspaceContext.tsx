"use client";

import { createContext, useContext, type ReactNode } from "react";
import { formatMoney } from "@/lib/format";

export type Workspace = {
  fullName: string;
  email: string;
  businessName: string;
  currency: string;
  isDemo: boolean;
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("WorkspaceProvider is missing");
  return workspace;
}

export function useWorkspaceMoney(): (amount: number, compact?: boolean) => string {
  const { currency } = useWorkspace();
  return (amount, compact = false) => formatMoney(amount, currency, compact);
}
