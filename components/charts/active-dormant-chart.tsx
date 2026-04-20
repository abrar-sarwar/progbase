"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function ActiveDormantChart({
  data,
}: {
  data: { active: number; dormant: number };
}) {
  const rows = [
    { name: "Active", value: data.active },
    { name: "Dormant", value: data.dormant },
  ];
  const colors = ["#6366f1", "#d4d4d8"];
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
              background: "#18181b",
              border: "none",
              borderRadius: 4,
              color: "white",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#52525b" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
