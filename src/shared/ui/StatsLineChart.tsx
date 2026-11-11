import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatResponse } from "@shared/types/api";
import { useThemeStore } from "@shared/model/themeStore";

const SERIES_COLORS = ["#2563EB", "#DC2626", "#16A34A", "#D97706", "#7C3AED", "#0891B2", "#DB2777", "#4B5563"];
const DARK_SERIES_COLORS = ["#6FA0E6", "#E08A8A", "#74C494", "#DDB070", "#A892E0", "#68BDD0", "#DE8CB5", "#A1A9B8"];

function toChartData(rows: StatResponse[]) {
  const periods = rows[0]?.stats?.map((s) => s.columnName ?? "") ?? [];
  return periods.map((period, i) => {
    const point: Record<string, string | number> = { period };
    rows.forEach((row) => {
      point[row.rowName || "—"] = row.stats?.[i]?.count ?? 0;
    });
    return point;
  });
}

interface StatsLineChartProps {
  data: StatResponse[];
  type?: "line" | "bar";
  height?: number;
}

export function StatsLineChart({ data, type = "line", height = 260 }: StatsLineChartProps) {
  const isDark = useThemeStore((s) => s.resolved) === "dark";
  const colors = isDark ? DARK_SERIES_COLORS : SERIES_COLORS;
  if (data.length === 0 || !data.some((r) => (r.stats?.length ?? 0) > 0)) {
    return <div className="text-[13px] text-tx2 py-4">Нет данных за выбранный период</div>;
  }

  const chartData = toChartData(data);
  const seriesNames = data.map((r) => r.rowName || "—");

  const Chart = type === "bar" ? BarChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-line))" />
        <XAxis dataKey="period" tick={{ fontSize: 11, fill: "rgb(var(--c-tx2))" }} stroke="rgb(var(--c-bd))" interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "rgb(var(--c-tx2))" }} stroke="rgb(var(--c-bd))" allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: "rgb(var(--c-bg))", border: "1px solid rgb(var(--c-bd))", color: "rgb(var(--c-tx))" }} cursor={{ fill: "rgb(var(--c-ntbg) / 0.5)" }} />
        {seriesNames.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "rgb(var(--c-tx2))" }} />}
        {seriesNames.map((name, i) =>
          type === "bar" ? (
            <Bar key={name} dataKey={name} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />
          ) : (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={chartData.length <= 40}
            />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}
