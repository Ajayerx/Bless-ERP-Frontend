import { useState } from "react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useInstalledApps } from "@/hooks/useInstalledApps"
import AppCard from "../components/AppCard"

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
}

export default function Apps() {
  const { installed, available, installApp, uninstallApp, isInstalled } = useInstalledApps()
  const [tab, setTab] = useState<"all" | "installed" | "available">("all")

  const filtered = tab === "installed" ? installed : tab === "available" ? available : [...installed, ...available]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <h1 className="text-2xl font-bold text-heading">Apps</h1>
          <p className="text-sm text-muted mt-1">
            Extend BlessERP with additional modules for your business.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">All ({installed.length + available.length})</TabsTrigger>
              <TabsTrigger value="installed">Installed ({installed.length})</TabsTrigger>
              <TabsTrigger value="available">Available ({available.length})</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtered.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              isInstalled={isInstalled(app.id)}
              onInstall={() => installApp(app.id)}
              onUninstall={() => uninstallApp(app.id)}
            />
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <motion.div variants={itemVariants} className="text-center py-12">
            <p className="text-sm text-muted">
              {tab === "installed"
                ? "No apps installed yet."
                : "No apps available."}
            </p>
          </motion.div>
        )}
      </motion.div>
    </>
  )
}