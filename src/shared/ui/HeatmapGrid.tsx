import type { StatResponse } from "@shared/types/api";
import { useThemeStore } from "@shared/model/themeStore";

interface HeatmapGridProps {
  data: StatResponse[];
  rowLabel?: string;
  minScaleMax?: number;
}

type ColorStops = Array<[number, [number, number, number]]>;

const COLOR_STOPS: ColorStops = [
  [0, [255, 255, 255]],
  [0.15, [239, 246, 255]],
  [0.35, [191, 219, 254]],
  [0.6, [96, 165, 250]],
  [0.85, [59, 130, 246]],
  [1, [29, 78, 216]],
];

const DARK_COLOR_STOPS: ColorStops = [
  [0, [38, 38, 42]],
  [0.15, [41, 48, 60]],
  [0.35, [38, 62, 96]],
  [0.6, [40, 88, 146]],
  [0.85, [48, 104, 172]],
  [1, [56, 118, 190]],
];

function colorForIntensity(t: number, stops: ColorStops): string {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (clamped <= t1) {
      const localT = t1 === t0 ? 0 : (clamped - t0) / (t1 - t0);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * localT);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * localT);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * localT);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const [, last] = stops[stops.length - 1];
  return `rgb(${last[0]}, ${last[1]}, ${last[2]})`;
}

export function HeatmapGrid({ data, rowLabel, minScaleMax = 5 }: HeatmapGridProps) {
  const isDark = useThemeStore((s) => s.resolved) === "dark";
  const stops = isDark ? DARK_COLOR_STOPS : COLOR_STOPS;
  if (data.length === 0) {
    return <div className="text-[13px] text-tx2 py-4">Нет данных за выбранный период</div>;
  }

  const columns = data[0]?.stats?.map((s) => s.columnName ?? "") ?? [];
  const actualMax = Math.max(0, ...data.flatMap((row) => row.stats?.map((s) => s.count ?? 0) ?? [0]));
  const scaleMax = Math.max(actualMax, minScaleMax);

  return (
    <div className="overflow-x-auto scrollbar-thin -mx-1">
      <table className="border-collapse text-[12px] w-full">
        <thead>
          <tr>
            <th className="sticky left-0 bg-bg text-left px-2 py-1.5 text-tx2 font-medium whitespace-nowrap z-10">
              {rowLabel || ""}
            </th>
            {columns.map((col) => (
              <th key={col} className="px-2 py-1.5 text-tx2 font-medium whitespace-nowrap text-center">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.rowName}>
              <td className="sticky left-0 bg-bg px-2 py-1.5 text-tx font-medium whitespace-nowrap border-t border-bd">
                {row.rowName}
              </td>
              {(row.stats || []).map((cell, i) => {
                const value = cell.count ?? 0;
                const intensity = value / scaleMax;
                const bg = colorForIntensity(intensity, stops);
                const textColor = intensity > 0.55 ? "#fff" : undefined;
                return (
                  <td
                    key={`${row.rowName}-${i}`}
                    className="px-2 py-1.5 text-center border-t border-bd font-medium tabular-nums"
                    style={{ backgroundColor: bg, color: textColor }}
                    title={`${row.rowName} · ${cell.columnName}: ${value}`}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
