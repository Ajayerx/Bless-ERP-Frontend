import { Badge } from "@/components/ui"
import { cn } from "@/lib/utils"

export interface StockStatus {
  label: "In Stock" | "Low Stock" | "Out of Stock"
  variant: "success" | "warning" | "danger"
  level: "ok" | "low" | "critical" | "out"
}

export function getStockStatus(
  stock: number,
  threshold = 20,
): StockStatus {
  if (stock === 0) return { label: "Out of Stock", variant: "danger", level: "out" }
  if (stock < threshold * 0.5) return { label: "Low Stock", variant: "danger", level: "critical" }
  if (stock < threshold) return { label: "Low Stock", variant: "warning", level: "low" }
  return { label: "In Stock", variant: "success", level: "ok" }
}

export function stockColorClass(
  stock: number,
  threshold = 20,
): string {
  const { level } = getStockStatus(stock, threshold)
  return cn(
    level === "out" && "text-danger-600",
    level === "critical" && "text-danger-600",
    level === "low" && "text-warning-600",
    level === "ok" && "text-heading",
  )
}

interface StockBadgeProps {
  stock: number
  threshold?: number
}

export default function StockBadge({ stock, threshold = 20 }: StockBadgeProps) {
  const { label, variant } = getStockStatus(stock, threshold)
  return <Badge variant={variant}>{label}</Badge>
}
