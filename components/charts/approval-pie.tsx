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

export function ApprovalPie({
  data,
}: {
  data: { invited: number; approved: number; declined: number };
}) {
  const t = useChartTheme();
  const rows = [
    { name: "Approved", value: data.approved },
    { name: "Invited", value: data.invited },
    { name: "Declined", value: data.declined },
  ];
  const colors = [t.accent, t.accentSoft, "rgba(228, 228, 231, 0.7)"];
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
