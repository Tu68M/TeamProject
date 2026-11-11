import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatResponse } from "@shared/types/api";
import { useThemeStore } from "@shared/model/themeStore";

const PIE_COLORS = [
  "#BFDBFE",
  "#93C5FD",
  "#60A5FA",
  "#3B82F6",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF",
  "#1E3A8A",
];

const DARK_PIE_COLORS = ["#B7CDEB", "#9DBBE3", "#85A9DA", "#6E97CF", "#5A85C0", "#4C74AE", "#41669A", "#3A5A88"];

interface StatsPieChartProps {
  data?: StatResponse;
  height?: number;
}

function toPieData(row: StatResponse) {
  return (row.stats || [])
    .map((s) => ({ name: s.columnName ?? "—", value: s.count ?? 0 }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function StatsPieChart({ data, height = 320 }: StatsPieChartProps) {
  const isDark = useThemeStore((s) => s.resolved) === "dark";
  const palette = isDark ? DARK_PIE_COLORS : PIE_COLORS;
  const pieData = data ? toPieData(data) : [];

  if (pieData.length === 0) {
    return <div className="text-[13px] text-tx2 py-4">Нет данных за выбранный период</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="70%"
          innerRadius="0%"
          paddingAngle={1}
          label={({ percent }) => (percent && percent > 0.04 ? `${Math.round(percent * 100)}%` : "")}
          labelLine={false}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={palette[i % palette.length]} stroke={isDark ? "rgb(var(--c-bg))" : undefined} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "rgb(var(--c-bg))", border: "1px solid rgb(var(--c-bd))", color: "rgb(var(--c-tx))" }} itemStyle={{ color: "rgb(var(--c-tx))" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "rgb(var(--c-tx2))" }}
          iconType="circle"
          layout="horizontal"
          verticalAlign="bottom"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}