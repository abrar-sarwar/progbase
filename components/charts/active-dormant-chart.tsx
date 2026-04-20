"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useChartTheme } from "./use-chart-theme";

export function ActiveDormantChart({
  data,
}: {
  data: { active: number; dormant: number };
}) {
  const t = useChartTheme();
  const rows = [
    { name: "Active", value: data.active },
    { name: "Dormant", value: data.dormant },
  ];
  const colors = [t.accent, t.accentSoft];
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={80}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: t.tooltipBg,
              border: "none",
              borderRadius: 4,
              color: t.tooltipText,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: t.tick }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
