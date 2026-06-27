import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  trend: number
  trendDirection: "up" | "down" | "neutral"
  icon: React.ReactNode
  variant?: "default" | "warning"
}

export default function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendDirection,
  icon,
  variant = "default",
}: KpiCardProps) {
  const trendColor =
    trendDirection === "up"
      ? "text-success-600 bg-success-50"
      : trendDirection === "down"
        ? "text-red-600 bg-red-50"
        : "text-gray-500 bg-gray-100"

  const TrendIcon =
    trendDirection === "up"
      ? TrendingUp
      : trendDirection === "down"
        ? TrendingDown
        : Minus

  const borderColor =
    variant === "warning" ? "border-l-warning-500" : "border-l-primary-500"

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} p-5 shadow-sm`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400">{subtitle}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-gray-50 text-gray-400">
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mt-3">
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full ${trendColor}`}
        >
          <TrendIcon size={12} />
          {Math.abs(trend)}%
        </span>
        <span className="text-xs text-gray-400">
          {trendDirection === "up"
            ? "vs last month"
            : trendDirection === "down"
              ? "vs last month"
              : "needs attention"}
        </span>
      </div>
    </div>
  )
}
