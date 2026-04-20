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

export function GrowthChart({
  data,
}: {
  data: { month: string; cumulative: number }[];
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-md bg-zinc-50 text-xs text-zinc-400">
        No data yet
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
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
            labelStyle={{ color: "white" }}
          />
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
