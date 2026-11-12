import { NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function authed(): Promise<
  { user: SessionUser; response: null } | { user: null; response: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { user: null, response: fail("You must be signed in.", 401) };
  return { user, response: null };
}

export function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function str(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

export function money(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The address visitors actually use. Behind a proxy this differs from the
 * server's own bind address, so links must never be built from `request.url`.
 */
export function publicOrigin(request: Request): string {
  const configured = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  const first = (value: string | null) => value?.split(",")[0]?.trim() ?? "";
  const host = first(request.headers.get("x-forwarded-host")) || first(request.headers.get("host"));
  if (!host || !/^[a-z0-9.:\-\[\]]+$/i.test(host)) return new URL(request.url).origin;
  const local = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host);
  const forwarded = first(request.headers.get("x-forwarded-proto"));
  const protocol = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
