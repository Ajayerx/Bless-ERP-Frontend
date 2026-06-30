"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { invoiceService, type InvoiceListResponse } from "@/services"
import TaxSummary from "@/modules/taxes/TaxSummary"

export default function Taxes() {
  const [invoices, setInvoices] = useState<InvoiceListResponse | null>(null)

  useEffect(() => {
    invoiceService.list({ pageSize: 100 }).then(setInvoices).catch(() => null)
  }, [])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <TaxSummary invoices={invoices} />
      </motion.div>
    </>
  )
}
