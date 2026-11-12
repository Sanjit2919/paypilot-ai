"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Building2, Loader2, Sparkles } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client";
import { Alert, Field } from "@/components/ui";

const BUSINESS_TYPES = ["Freelancer", "Digital agency", "Startup", "Small business", "Consultancy", "Studio"];
const INDUSTRIES = [
  "Technology",
  "Marketing & advertising",
  "Design",
  "E-commerce",
  "Professional services",
  "Finance",
  "Healthcare",
  "Education",
  "Other",
];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "AUD", "CAD", "SGD", "JPY", "ZAR"];
const COUNTRIES = [
  "United States",
  "United Kingdom",
  "India",
  "United Arab Emirates",
  "Germany",
  "France",
  "Sweden",
  "Australia",
  "Canada",
  "Singapore",
  "Japan",
  "South Africa",
  "Other",
];

export function OnboardingForm({ initial }: { initial: { name: string; email: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: initial.name,
    businessType: "Digital agency",
    industry: "Technology",
    currency: "USD",
    monthlyRevenueEstimate: "15000",
    email: initial.email,
    country: "United States",
    taxRate: "0",
    paymentTermsDays: "14",
    cashBalance: "10000",
    seedDemo: true,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiSend("/api/business", "PATCH", {
        name: form.name,
        businessType: form.businessType,
        industry: form.industry,
        currency: form.currency,
        monthlyRevenueEstimate: Number(form.monthlyRevenueEstimate) || 0,
        email: form.email,
        country: form.country,
        taxRate: Number(form.taxRate) || 0,
        paymentTermsDays: Number(form.paymentTermsDays) || 14,
        cashBalance: Number(form.cashBalance) || 0,
        onboardingComplete: true,
        seedDemo: form.seedDemo,
      });
      router.push("/overview");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-navy">Tell us about your business</h1>
          <p className="text-sm text-slate-500">
            These details personalise your AI insights, tax defaults and cash-flow forecasts.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name">
          <input
            className="input"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Northwind Studio"
            required
          />
        </Field>
        <Field label="Business email">
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="finance@company.com"
            required
          />
        </Field>
        <Field label="Business type">
          <select className="input" value={form.businessType} onChange={(e) => update("businessType", e.target.value)}>
            {BUSINESS_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </Field>
        <Field label="Industry">
          <select className="input" value={form.industry} onChange={(e) => update("industry", e.target.value)}>
            {INDUSTRIES.map((industry) => (
              <option key={industry}>{industry}</option>
            ))}
          </select>
        </Field>
        <Field label="Currency">
          <select className="input" value={form.currency} onChange={(e) => update("currency", e.target.value)}>
            {CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </Field>
        <Field label="Country">
          <select className="input" value={form.country} onChange={(e) => update("country", e.target.value)}>
            {COUNTRIES.map((country) => (
              <option key={country}>{country}</option>
            ))}
          </select>
        </Field>
        <Field label="Monthly revenue estimate" hint="Used to benchmark your performance.">
          <input
            className="input"
            type="number"
            min="0"
            step="100"
            value={form.monthlyRevenueEstimate}
            onChange={(e) => update("monthlyRevenueEstimate", e.target.value)}
          />
        </Field>
        <Field label="Opening cash balance" hint="Cash you have in the bank today.">
          <input
            className="input"
            type="number"
            step="100"
            value={form.cashBalance}
            onChange={(e) => update("cashBalance", e.target.value)}
          />
        </Field>
        <Field label="Default tax rate (%)">
          <input
            className="input"
            type="number"
            min="0"
            step="0.5"
            value={form.taxRate}
            onChange={(e) => update("taxRate", e.target.value)}
          />
        </Field>
        <Field label="Default payment terms (days)">
          <input
            className="input"
            type="number"
            min="0"
            value={form.paymentTermsDays}
            onChange={(e) => update("paymentTermsDays", e.target.value)}
          />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          checked={form.seedDemo}
          onChange={(e) => update("seedDemo", e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand"
        />
        <span>
          <span className="font-medium text-navy">Preload a demo business</span>
          <span className="block text-xs text-slate-500">
            Adds sample clients, projects, quotations, invoices, payments and expenses so you can explore every agent
            immediately. Demo records are labelled and can be deleted at any time.
          </span>
        </span>
      </label>

      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <button type="submit" disabled={loading} className="btn btn-primary mt-4 w-full">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Building your workspace…" : "Enter your workspace"}
        {!loading ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}
