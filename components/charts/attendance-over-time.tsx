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

export function AttendanceOverTimeChart({
  data,
}: {
  data: { label: string; date: string | null; checkedIn: number }[];
}) {
  const t = useChartTheme();
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
        No events yet
      </div>
    );
  }
  const rows = data.map((d) => ({
    x: d.date ? d.date.slice(0, 10) : d.label,
    checkedIn: d.checkedIn,
    label: d.label,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            stroke={t.axis}
            tick={{ fill: t.tick, fontSize: 11 }}
            interval="preserveStartEnd"
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
            formatter={(v, _name, p) => [`${v} checked in`, p.payload.label]}
          />
          <Bar dataKey="checkedIn" fill={t.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
