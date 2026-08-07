"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoney } from "@/lib/format";
import { ASSET_TYPE_LABELS } from "@/lib/networth";

const COLORS: Record<string, string> = {
  stock: "#7c6af5",
  etf: "#5eead4",
  crypto: "#fb923c",
  precious_metal: "#fbbf24",
  real_estate: "#60a5fa",
  scpi: "#38bdf8",
  private_equity: "#a78bfa",
  art: "#fb7185",
  life_insurance: "#34d399",
  cash: "#6b6b72",
  other: "#4f4f57",
};

export default function AllocationChart({
  data,
}: {
  data: { type: string; value: number }[];
}) {
  const grouped = Object.values(
    data.reduce<Record<string, { type: string; value: number }>>((acc, d) => {
      acc[d.type] = acc[d.type] || { type: d.type, value: 0 };
      acc[d.type].value += d.value;
      return acc;
    }, {})
  ).filter((d) => d.value > 0);

  const total = grouped.reduce((s, d) => s + d.value, 0);

  if (grouped.length === 0) {
    return (
      <div className="h-52 flex items-center justify-center text-sm text-text-muted">
        Aucun actif pour le moment.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-6">
      <div className="w-40 h-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={grouped}
              dataKey="value"
              nameKey="type"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={2}
              stroke="none"
            >
              {grouped.map((entry) => (
                <Cell key={entry.type} fill={COLORS[entry.type] ?? "#4f4f57"} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                formatMoney(Number(value)),
                ASSET_TYPE_LABELS[String(name)] ?? String(name),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2 text-sm flex-1 min-w-0">
        {grouped
          .sort((a, b) => b.value - a.value)
          .map((d) => (
            <li key={d.type} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-text-muted">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: COLORS[d.type] ?? "#4f4f57" }}
                />
                {ASSET_TYPE_LABELS[d.type] ?? d.type}
              </span>
              <span className="tabular font-[family-name:var(--font-mono-num)]">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
