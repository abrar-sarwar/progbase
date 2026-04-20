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

export function EmailDomainChart({
  data,
}: {
  data: { domain: string; count: number }[];
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
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 80, bottom: 8 }}
        >
          <CartesianGrid stroke="#e4e4e7" strokeDasharray="3 3" />
          <XAxis
            type="number"
            stroke="#d4d4d8"
            tick={{ fill: "#52525b", fontSize: 11 }}
          />
          <YAxis
            dataKey="domain"
            type="category"
            stroke="#d4d4d8"
            tick={{ fill: "#52525b", fontSize: 11 }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              background: "#18181b",
              border: "none",
              borderRadius: 4,
              color: "white",
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
