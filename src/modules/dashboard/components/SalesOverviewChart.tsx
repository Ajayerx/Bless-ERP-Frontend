
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
import { useChartPalette } from "@/hooks/useChartPalette"
import type { SalesDay } from "@/services"

interface Props {
  data: SalesDay[]
  periodLabel?: string
}

function compactMoney(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) {
    const m = v / 1_000_000
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (abs >= 1_000) {
    const k = v / 1_000
    return `$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `$${v.toFixed(0)}`
}

export default function SalesOverviewChart({ data, periodLabel = "This Week" }: Props) {
  const palette = useChartPalette()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Overview</CardTitle>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-[8px]">
          {periodLabel}
        </span>
      </CardHeader>
      <CardContent>
        <div className="h-[340px]">
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
                stroke={palette.border}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: palette.muted }}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: palette.muted }}
                tickFormatter={compactMoney}
                domain={[0, "auto"]}
                width={56}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  backgroundColor: palette.surface,
                  border: `1px solid ${palette.border}`,
                  boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
                  padding: "8px 12px",
                }}
                formatter={(value) => [
                  formatCurrency(Number(value ?? 0)),
                  "Revenue",
                ]}
                labelStyle={{ fontWeight: 600, color: palette.heading }}
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
