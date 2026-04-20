"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function DemographicsChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  const t = useChartTheme();
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
        No data yet — fill in members to see this.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
            interval={0}
            angle={-20}
            textAnchor="end"
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
          />
          <Bar dataKey="count" fill={t.accent} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
