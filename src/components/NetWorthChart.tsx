"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatMoney } from "@/lib/format";

type Snapshot = { date: string; totalValue: string };

export default function NetWorthChart({ data }: { data: Snapshot[] }) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
    }),
    value: Number(d.totalValue),
  }));

  if (chartData.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-lg">
        La courbe apparaît après quelques jours de suivi. Ajoute tes actifs
        pour commencer.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C9A227" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#C9A227" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fill: "#8A92A3", fontSize: 11 }}
          axisLine={{ stroke: "#262B33" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#8A92A3", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatMoney(v)}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: "#161A21",
            border: "1px solid #262B33",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#8A92A3" }}
          formatter={(value) => [formatMoney(Number(value)), "Patrimoine"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#C9A227"
          strokeWidth={2}
          fill="url(#netWorthFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
