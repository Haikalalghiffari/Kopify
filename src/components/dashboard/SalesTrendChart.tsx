"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatRupiah } from "@/lib/money";

export default function SalesTrendChart({ data }: { data: { date: string; total: number }[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-gray-400">
        Belum ada data transaksi tren
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0B3B2C" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0B3B2C" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(val) => (val >= 1000 ? `${Math.round(val / 1000)}k` : val)}
          />
          <Tooltip
            formatter={(value: any) => [formatRupiah(value), "Penjualan"]}
            labelStyle={{ fontWeight: "bold", color: "#0B3B2C", fontSize: "11px" }}
            contentStyle={{
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              border: "1px solid #E5E7EB",
              fontSize: "11px",
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#0B3B2C"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
