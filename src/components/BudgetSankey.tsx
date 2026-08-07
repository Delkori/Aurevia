"use client";

import { Sankey, Tooltip, ResponsiveContainer, Layer, Rectangle } from "recharts";
import { formatMoney } from "@/lib/format";

type Category = {
  id: number;
  name: string;
  kind: "income" | "expense";
  color: string;
};

type Entry = { categoryId: number; amount: string };

const HUB = "Revenus";
const SAVINGS = "Épargne du mois";

function buildSankeyData(categories: Category[], entries: Entry[]) {
  const totalsByCategory = (id: number) =>
    entries.filter((e) => e.categoryId === id).reduce((s, e) => s + Number(e.amount), 0);

  const incomeCats = categories.filter((c) => c.kind === "income").map((c) => ({
    ...c,
    total: totalsByCategory(c.id),
  })).filter((c) => c.total > 0);

  const expenseCats = categories.filter((c) => c.kind === "expense").map((c) => ({
    ...c,
    total: totalsByCategory(c.id),
  })).filter((c) => c.total > 0);

  const totalIncome = incomeCats.reduce((s, c) => s + c.total, 0);
  const totalExpenses = expenseCats.reduce((s, c) => s + c.total, 0);
  const savings = totalIncome - totalExpenses;

  if (totalIncome <= 0 || (expenseCats.length === 0 && savings <= 0)) {
    return null;
  }

  const nodeNames = [
    ...incomeCats.map((c) => c.name),
    HUB,
    ...expenseCats.map((c) => c.name),
    ...(savings > 0 ? [SAVINGS] : []),
  ];
  const nodeIndex = (name: string) => nodeNames.indexOf(name);

  const nodes = nodeNames.map((name) => ({ name }));
  const links = [
    ...incomeCats.map((c) => ({
      source: nodeIndex(c.name),
      target: nodeIndex(HUB),
      value: c.total,
    })),
    ...expenseCats.map((c) => ({
      source: nodeIndex(HUB),
      target: nodeIndex(c.name),
      value: c.total,
    })),
    ...(savings > 0
      ? [{ source: nodeIndex(HUB), target: nodeIndex(SAVINGS), value: savings }]
      : []),
  ];

  return { nodes, links };
}

function SankeyNode(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  payload: { name: string };
}) {
  const { x, y, width, height, payload } = props;
  const isHub = payload.name === HUB;
  const isSavings = payload.name === SAVINGS;
  return (
    <Layer>
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        fill={isHub ? "#8a5cf5" : isSavings ? "#44cf6e" : "#027aff"}
        fillOpacity={0.9}
        radius={2}
      />
      <text
        x={x + width / 2}
        y={y - 8}
        textAnchor="middle"
        fontSize={11}
        fill="#dcddde"
      >
        {payload.name}
      </text>
    </Layer>
  );
}

export default function BudgetSankey({
  categories,
  entries,
}: {
  categories: Category[];
  entries: Entry[];
}) {
  const data = buildSankeyData(categories, entries);

  if (!data) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-text-muted border border-dashed border-border rounded-lg">
        Ajoute des revenus et des dépenses ce mois-ci pour voir le flux de ton
        budget.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <Sankey
        data={data}
        node={SankeyNode}
        nodePadding={28}
        link={{ stroke: "#3f3f3f", strokeOpacity: 0.5 }}
        margin={{ top: 24, bottom: 8, left: 8, right: 8 }}
      >
        <Tooltip
          contentStyle={{
            background: "#202020",
            border: "1px solid #333333",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => formatMoney(Number(value))}
        />
      </Sankey>
    </ResponsiveContainer>
  );
}
