import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import {
  ShoppingCart,
  Truck,
  Package,
  ShoppingBag,
  CheckCircle2,
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
  isInstalled: boolean
  onInstall: () => void
  onUninstall: () => void
}

export default function AppCard({ app, isInstalled, onInstall, onUninstall }: Props) {
  const navigate = useNavigate()
  const Icon = iconMap[app.icon] || Package
  const isComingSoon = app.status === "coming_soon"

  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={() => navigate(`/apps/${app.id}`)}
      className={cn(
        "bg-surface rounded-[16px] border border-border p-5 transition-shadow cursor-pointer hover:shadow-md",
        isComingSoon && "opacity-70",
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
            {isInstalled && (
              <CheckCircle2 size={14} className="text-success-500 shrink-0" />
            )}
            {isComingSoon && (
              <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-warning-100 text-warning-700">
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1 line-clamp-2">{app.description}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[10px] font-mono text-muted bg-gray-100 px-1.5 py-0.5 rounded">
              v{app.version}
            </span>
            {app.category && (
              <span className="text-[10px] text-muted">{app.category}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <span className={cn(
          "text-xs font-medium",
          isInstalled ? "text-success-600" : "text-muted",
        )}>
          {isInstalled ? "Installed" : "Not installed"}
        </span>
        {isComingSoon ? (
          <span className="text-xs text-muted">Coming Soon</span>
        ) : isInstalled ? (
          <button
            onClick={(e) => { e.stopPropagation(); onUninstall() }}
            className="text-xs font-semibold text-danger-600 hover:text-danger-700"
          >
            Uninstall
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onInstall() }}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            Install
          </button>
        )}
      </div>
    </motion.div>
  )
}
