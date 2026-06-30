import { TrendingUp } from "lucide-react"
import { LineChart, Line, ResponsiveContainer } from "recharts"

interface KpiCardProps {
  title: string
  value: string
  trend: number
  icon: React.ReactNode
  iconBgColor: string
  chartColor: string
  trendColor: string
  sparkline: number[]
}

export default function KpiCard({
  title,
  value,
  trend,
  icon,
  iconBgColor,
  chartColor,
  trendColor,
  sparkline,
}: KpiCardProps) {
  const sparkData = sparkline.map((v) => ({ v }))

  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex flex-col relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-[10px] flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: iconBgColor }}
          >
            {icon}
          </div>
          <div>
            <p className="text-xs font-semibold text-muted">
              {title}
            </p>
            <p className="text-2xl font-bold text-heading tracking-tight mt-0.5">
              {value}
            </p>
          </div>
        </div>
        <button className="text-muted hover:text-body transition-colors">
          <svg width="16" height="4" viewBox="0 0 16 4" fill="currentColor">
            <circle cx="2" cy="2" r="1.5" />
            <circle cx="8" cy="2" r="1.5" />
            <circle cx="14" cy="2" r="1.5" />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-1.5 mt-1">
        <span
          className="inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ color: trendColor, backgroundColor: `${trendColor}1A` }}
        >
          <TrendingUp size={12} />
          {trend}%
        </span>
        <span className="text-xs text-muted">from last week</span>
      </div>

      <div className="mt-auto -mx-5 -mb-5 h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sparkData}>
            <Line
              type="monotone"
              dataKey="v"
              stroke={chartColor}
              strokeWidth={2}
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
