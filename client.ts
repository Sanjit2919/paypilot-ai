"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : "Something went wrong. Please try again.",
      response.status,
      typeof data.code === "string" ? data.code : undefined,
    );
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  return parse<T>(response);
}

export async function apiSend<T>(url: string, method: "POST" | "PATCH" | "DELETE" | "PUT", body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(response);
}

/** Fetches user-scoped API data with optional visibility-aware live refresh. */
export function useApi<T>(url: string | null, options?: { refreshMs?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const refreshMs = options?.refreshMs ?? 0;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const reload = useCallback(async (silent = false) => {
    if (!url) return;
    const id = ++requestId.current;
    if (silent) setRefreshing(true);
    else { setLoading(true); setError(null); }
    try {
      const result = await apiGet<T>(url);
      if (mounted.current && requestId.current === id) {
        setData(result);
        setUpdatedAt(new Date());
        setError(null);
      }
    } catch (err) {
      if (mounted.current && requestId.current === id && !silent) setError(err instanceof Error ? err.message : "Unable to load data.");
    } finally {
      if (mounted.current && requestId.current === id) {
        setRefreshing(false);
        if (!silent) setLoading(false);
      }
    }
  }, [url]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!url || refreshMs < 1000) return;
    const refreshVisible = () => { if (document.visibilityState === "visible") void reload(true); };
    const timer = window.setInterval(refreshVisible, refreshMs);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [url, refreshMs, reload]);

  return { data, loading, refreshing, updatedAt, error, reload, setData };
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}
