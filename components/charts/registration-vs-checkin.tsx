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

export function RegistrationVsCheckin({
  data,
}: {
  data: { registered: number; checked_in: number };
}) {
  const t = useChartTheme();
  const rows = [
    { label: "Registered", count: data.registered },
    { label: "Checked in", count: data.checked_in },
  ];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke={t.grid} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
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
          />
          <Bar dataKey="count" fill={t.accent} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
