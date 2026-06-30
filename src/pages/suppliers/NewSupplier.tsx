"use client"

import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import SupplierForm from "@/modules/suppliers/SupplierForm"

export default function NewSupplier() {
  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <SupplierForm />
      </motion.div>
    </>
  )
}
