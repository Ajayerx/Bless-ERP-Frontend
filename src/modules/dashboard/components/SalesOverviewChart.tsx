import { ChevronDown } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import type { SalesDay } from "@/services"

interface Props {
  data: SalesDay[]
}

export default function SalesOverviewChart({ data }: Props) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Sales Overview</CardTitle>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px] hover:bg-gray-50 transition-colors">
          This Week
          <ChevronDown size={12} />
        </button>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748B" }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#64748B" }}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                domain={[0, "auto"]}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #e5e7eb",
                  boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
                  padding: "8px 12px",
                }}
                formatter={(value) => [
                  formatCurrency(Number(value ?? 0)),
                  "Revenue",
                ]}
                labelStyle={{ fontWeight: 600, color: "#0F172A" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#salesGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
