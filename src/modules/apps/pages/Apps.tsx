import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { AVAILABLE_MODULES } from "@/config/modules.config"
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

        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {AVAILABLE_MODULES.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </motion.div>
      </motion.div>
    </>
  )
}