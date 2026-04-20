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

export function AttendanceChart({
  data,
}: {
  data: { bucket: string; count: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            stroke="#d4d4d8"
            tick={{ fill: "#52525b", fontSize: 11 }}
          />
          <YAxis stroke="#d4d4d8" tick={{ fill: "#52525b", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "none",
              borderRadius: 4,
              color: "white",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
