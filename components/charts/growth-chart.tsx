"use client";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function GrowthChart({
  data,
}: {
  data: { month: string; cumulative: number }[];
}) {
  const t = useChartTheme();
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
        No data yet
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
          />
          <YAxis stroke={t.axis} tick={{ fill: t.tick, fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
            labelStyle={{ color: t.tooltipText }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke={t.accent}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
