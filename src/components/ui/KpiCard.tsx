import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  title: string; value: string; subtitle?: string; trend: number
  trendDirection: "up" | "down" | "neutral"; icon: React.ReactNode
  variant?: "default" | "warning"
}

export default function KpiCard({ title, value, subtitle, trend, trendDirection, icon, variant = "default" }: KpiCardProps) {
  const trendColor = trendDirection === "up" ? "text-success-600 bg-success-50"
    : trendDirection === "down" ? "text-danger-600 bg-danger-50" : "text-muted bg-muted/10"
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Minus
  const borderColor = variant === "warning" ? "border-l-warning-500" : "border-l-primary-500"

  return (
    <div className={cn("bg-surface rounded-card border border-border border-l-4 p-5 shadow-card", borderColor)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="text-2xl font-semibold text-heading tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-muted/10 text-muted">{icon}</div>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full", trendColor)}>
          <TrendIcon size={12} />{Math.abs(trend)}%
        </span>
        <span className="text-xs text-muted">
          {trendDirection === "neutral" ? "needs attention" : "vs last month"}
        </span>
      </div>
    </div>
  )
}
