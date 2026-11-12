"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { BearMark } from "@/components/BearMark";
import { apiSend, errorMessage } from "@/lib/client";
import { Alert } from "@/components/ui";

type Mode = "login" | "register" | "forgot";

export function AuthForm({ mode, initialToken = "" }: { mode: Mode; initialToken?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetPath, setResetPath] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    token: initialToken,
  });

  function update(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "login") {
        const result = await apiSend<{ onboarding: boolean }>("/api/auth/login", "POST", {
          email: form.email,
          password: form.password,
        });
        router.push(result.onboarding ? "/onboarding" : "/overview");
        router.refresh();
      } else if (mode === "register") {
        const result = await apiSend<{ onboarding: boolean }>("/api/auth/register", "POST", {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
        });
        router.push(result.onboarding ? "/onboarding" : "/overview");
        router.refresh();
      } else if (form.token) {
        await apiSend("/api/auth/reset-password", "POST", {
          token: form.token,
          password: form.password,
        });
        setInfo("Password updated. You can now sign in with your new password.");
      } else {
        const result = await apiSend<{ message: string; resetPath?: string }>(
          "/api/auth/forgot-password",
          "POST",
          { email: form.email },
        );
        setInfo(result.message);
        if (result.resetPath) setResetPath(result.resetPath);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, { title: string; subtitle: string; cta: string }> = {
    login: {
      title: "Welcome back",
      subtitle: "Sign in to your autonomous finance workspace.",
      cta: "Sign in",
    },
    register: {
      title: "Create your account",
      subtitle: "Start with a preloaded demo business, then make it yours.",
      cta: "Create account",
    },
    forgot: {
      title: "Reset your password",
      subtitle: "We will generate a secure reset link for your account.",
      cta: form.token ? "Update password" : "Generate reset link",
    },
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-lg shadow-brand/30">
          <BearMark className="h-[22px] w-[22px]" />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy">PayPilot AI</p>
          <p className="text-xs text-slate-500">Your autonomous finance assistant</p>
        </div>
      </div>

      <div className="card p-6">
        <h1 className="text-xl font-semibold text-navy">{titles[mode].title}</h1>
        <p className="mt-1 text-sm text-slate-500">{titles[mode].subtitle}</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" ? (
            <label className="block">
              <span className="label">Full name</span>
              <input
                className="input"
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="Alex Morgan"
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="block">
            <span className="label">Work email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </label>

          {mode !== "forgot" || form.token ? (
            <label className="block">
              <span className="label">{mode === "forgot" ? "New password" : "Password"}</span>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder={mode === "register" ? "At least 8 characters" : "••••••••"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
              />
            </label>
          ) : null}

          {mode === "forgot" && form.token ? (
            <label className="block">
              <span className="label">Reset token</span>
              <input
                className="input"
                value={form.token}
                onChange={(e) => update("token", e.target.value)}
                placeholder="Paste the token from your reset link"
              />
            </label>
          ) : null}

          {error ? <Alert tone="error">{error}</Alert> : null}
          {info ? <Alert tone="success">{info}</Alert> : null}
          {resetPath ? (
            <Link href={resetPath} className="inline-flex items-center gap-1 text-sm font-medium text-brand">
              Open reset link <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {titles[mode].cta}
          </button>
        </form>

        <div className="mt-4 space-y-1 text-sm text-slate-500">
          {mode === "login" ? (
            <>
              <p>
                New to PayPilot?{" "}
                <Link href="/register" className="font-medium text-brand">
                  Create an account
                </Link>
              </p>
              <p>
                <Link href="/forgot-password" className="font-medium text-brand">
                  Forgot your password?
                </Link>
              </p>
              <p>
                <Link href="/api/auth/demo" className="font-medium text-brand">
                  Or explore the preloaded demo workspace →
                </Link>
              </p>
            </>
          ) : (
            <p>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-brand">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-400">
        Protected by server-side sessions. Your financial data is scoped to your account.
      </p>
    </div>
  );
}
