import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  title: string; value: string; subtitle?: string; trend: number
  trendDirection: "up" | "down" | "neutral"; icon: React.ReactNode
  variant?: "default" | "warning"
}

export default function KpiCard({ title, value, subtitle, trend, trendDirection, icon, variant = "default" }: KpiCardProps) {
  const accentBar = variant === "warning" ? "bg-warning-500" : "bg-primary-500"
  const TrendIcon = trendDirection === "up" ? TrendingUp : trendDirection === "down" ? TrendingDown : Minus

  return (
    <div className="relative bg-surface rounded-card border border-border p-5 shadow-card overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-1", accentBar)} />
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted">{title}</p>
          <p className="text-2xl font-semibold text-heading tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-muted/10 text-muted">{icon}</div>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <span className="text-xs text-muted">
          <TrendIcon size={12} className="inline mr-0.5" />
          {Math.abs(trend)}%
        </span>
        <span className="text-xs text-muted/60">
          {trendDirection === "neutral" ? "needs attention" : "vs last month"}
        </span>
      </div>
    </div>
  )
}
