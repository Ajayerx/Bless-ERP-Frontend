"use client"

import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import QuotationForm from "@/modules/quotations/QuotationForm"

export default function NewQuotation() {
  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <QuotationForm />
      </motion.div>
    </>
  )
}
