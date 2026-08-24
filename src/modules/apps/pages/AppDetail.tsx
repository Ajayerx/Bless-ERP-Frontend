import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  ShoppingCart,
  Truck,
  Package,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { useInstalledApps } from "@/hooks/useInstalledApps"

const iconMap: Record<string, LucideIcon> = {
  ShoppingCart,
  Truck,
  Package,
  ShoppingBag,
}

export default function AppDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getModule, isInstalled, installApp, uninstallApp } = useInstalledApps()

  const app = getModule(id ?? "")

  if (!app) {
    return (
      <>
        <Topbar />
        <div className="p-6">
          <p className="text-sm text-muted">App not found.</p>
          <button onClick={() => navigate("/apps")} className="text-sm text-primary-600 mt-2 hover:underline">
            Back to Apps
          </button>
        </div>
      </>
    )
  }

  const Icon = iconMap[app.icon] ?? Package
  const installed = isInstalled(app.id)
  const isComingSoon = app.status === "coming_soon"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <button
          onClick={() => navigate("/apps")}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Apps
        </button>

        <div className="bg-surface rounded-[16px] border border-border p-6 space-y-6">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-[14px] flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: app.color }}
            >
              <Icon size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{app.label}</h1>
                <span className="text-xs font-mono text-muted bg-gray-100 px-2 py-0.5 rounded-md">
                  v{app.version}
                </span>
                {installed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-success-100 text-success-700">
                    <CheckCircle2 size={12} />
                    Installed
                  </span>
                )}
                {isComingSoon && (
                  <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-warning-100 text-warning-700">
                    Coming Soon
                  </span>
                )}
              </div>
              <p className="text-sm text-muted mt-2 leading-relaxed">{app.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Category</p>
              <p className="text-sm text-body mt-1">{app.category ?? "General"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted uppercase tracking-wider">Status</p>
              <p className="text-sm text-body mt-1 capitalize">{app.status.replace("_", " ")}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            {installed ? (
              <Button variant="danger" onClick={() => uninstallApp(app.id)}>
                Uninstall
              </Button>
            ) : (
              <Button onClick={() => installApp(app.id)} disabled={isComingSoon}>
                {isComingSoon ? "Coming Soon" : "Install"}
              </Button>
            )}
            {app.docsUrl && (
              <a
                href={app.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-body transition-colors"
              >
                <ExternalLink size={14} />
                Documentation
              </a>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
