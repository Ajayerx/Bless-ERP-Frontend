"use client"

import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import SettingsForm from "@/modules/settings/SettingsForm"

export default function Settings() {
  return (
    <>
      <Topbar />
      <motion.div className="p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <SettingsForm />
      </motion.div>
    </>
  )
}
