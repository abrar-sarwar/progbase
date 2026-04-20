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

export function DemographicsChart({
  data,
}: {
  data: { label: string; count: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400">
        No data yet — fill in members to see this.
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
          <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="#d4d4d8"
            tick={{ fill: "#52525b", fontSize: 11 }}
            interval={0}
            angle={-20}
            textAnchor="end"
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
