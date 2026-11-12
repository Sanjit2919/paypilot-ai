"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/format";
import type { ForecastPoint, MonthlyPoint } from "@/lib/types";

const AXIS = { fontSize: 11, fill: "#667085" };
const GRID = "#eef1f7";

function money(value: number, currency: string) {
  return formatMoney(value, currency, true);
}

export function RevenueExpenseChart({ data, currency }: { data: MonthlyPoint[]; currency: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} width={64} />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [formatMoney(Number(value), currency), name === "revenue" ? "Revenue" : "Expenses"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" fill="#3867FF" radius={[6, 6, 0, 0]} maxBarSize={26} />
          <Bar dataKey="expenses" fill="#D0D5DD" radius={[6, 6, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowChart({
  data,
  currency,
  height = 260,
}: {
  data: ForecastPoint[];
  currency: string;
  height?: number;
}) {
  const chartData = data.map((point) => ({
    ...point,
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3867FF" stopOpacity={0.28} />
              <stop offset="100%" stopColor="#3867FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} width={64} />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [formatMoney(Number(value), currency), name === "balance" ? "Projected balance" : String(name)]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="balance" stroke="#3867FF" strokeWidth={2.4} fill="url(#balanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CashFlowBars({ data, currency }: { data: ForecastPoint[]; currency: string }) {
  const chartData = data.map((point) => ({
    ...point,
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={24} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} width={64} />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [formatMoney(Number(value), currency), name === "inflow" ? "Expected in" : "Expected out"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="inflow" fill="#12B76A" radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="outflow" fill="#F79009" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const DONUT_COLORS = ["#3867FF", "#12B76A", "#F79009", "#7A5AF8", "#F04438", "#06AED4", "#667085", "#EAAA08"];

export function ExpenseDonut({
  data,
  currency,
}: {
  data: { category: string; amount: number }[];
  currency: string;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="category"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={entry.category} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [formatMoney(Number(value), currency), String(name)]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full min-w-0 space-y-1.5">
        {data.slice(0, 6).map((entry, index) => (
          <div key={entry.category} className="flex min-w-0 items-center justify-between gap-2 text-sm">
            <span className="flex min-w-0 items-center gap-2 capitalize text-slate-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: DONUT_COLORS[index % DONUT_COLORS.length] }}
              />
              <span className="truncate">{entry.category}</span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-medium text-navy">
              {formatMoney(entry.amount, currency)}
              <span className="ml-1 text-xs text-slate-400">
                {total > 0 ? `${Math.round((entry.amount / total) * 100)}%` : "0%"}
              </span>
            </span>
          </div>
        ))}
        {!data.length ? <p className="text-sm text-slate-500">No expenses recorded yet.</p> : null}
      </div>
    </div>
  );
}

export function HealthGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped >= 80 ? "#12B76A" : clamped >= 60 ? "#3867FF" : clamped >= 45 ? "#F79009" : "#F04438";
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#EEF1F7" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-navy">{clamped}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export function RevenueTrendLine({ data, currency }: { data: MonthlyPoint[]; currency: string }) {
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#12B76A" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#12B76A" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} width={64} />
          <Tooltip
            formatter={(value: unknown) => [formatMoney(Number(value), currency), "Net profit"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="profit" stroke="#12B76A" strokeWidth={2.2} fill="url(#profitFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ClientRevenueBars({ data, currency }: { data: { client: string; amount: number }[]; currency: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
          <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} />
          <YAxis type="category" dataKey="client" tick={{ ...AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
          <Tooltip
            formatter={(value: unknown) => [formatMoney(Number(value), currency), "Collected"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Bar dataKey="amount" fill="#3867FF" radius={[0, 6, 6, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-brand" /> Projected balance (estimate)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#12B76A]" /> Expected inflow
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[#F79009]" /> Expected outflow
      </span>
    </div>
  );
}

export function SparkLine({ values, color = "#3867FF" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 100;
      const y = 30 - ((value - min) / Math.max(1, max - min)) * 28;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function LineTrend({ data, currency }: { data: { label: string; value: number }[]; currency: string }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => money(Number(v), currency)} width={60} />
          <Tooltip
            formatter={(value: unknown) => [formatMoney(Number(value), currency), "Value"]}
            contentStyle={{ borderRadius: 10, border: "1px solid #e9ecf3", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="value" stroke="#3867FF" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
