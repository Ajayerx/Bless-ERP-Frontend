import { motion } from "framer-motion"
import {
  ShoppingCart,
  Truck,
  Package,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react"
import type { Module } from "@/config/modules.config"
import { cn } from "@/lib/utils"

const iconMap: Record<string, LucideIcon> = {
  ShoppingCart,
  Truck,
  Package,
  ShoppingBag,
}

interface Props {
  app: Module
}

export default function AppCard({ app }: Props) {
  const Icon = iconMap[app.icon] || Package
  const isComingSoon = app.status === "coming_soon"

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={cn(
        "bg-surface rounded-[16px] border border-border p-5 transition-shadow",
        isComingSoon ? "opacity-70" : "hover:shadow-md cursor-pointer",
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-[12px] flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: app.color }}
        >
          {Icon && <Icon size={22} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-heading">{app.label}</h3>
            {isComingSoon && (
              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1">{app.description}</p>
        </div>
      </div>
    </motion.div>
  )
}