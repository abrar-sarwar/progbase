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

export function EmailDomainChart({
  data,
}: {
  data: { domain: string; count: number }[];
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
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 80, bottom: 8 }}
        >
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
          />
          <YAxis
            dataKey="domain"
            type="category"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill={t.accent} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
