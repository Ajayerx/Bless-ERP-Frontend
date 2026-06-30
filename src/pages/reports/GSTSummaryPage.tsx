"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { reportService, type TaxSummary } from "@/services"
import GSTSummaryReport from "@/modules/reports/GSTSummaryReport"

export default function GSTSummaryPage() {
  const [report, setReport] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportService.getTaxSummary().then(setReport).catch(() => null).finally(() => setLoading(false))
  }, [])

  if (loading) return <><Topbar /><div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!report) return <><Topbar /><div className="p-6 text-center text-muted py-24">Report data unavailable.</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div>
          <h1 className="text-2xl font-bold text-heading">GST/QST Summary</h1>
          <p className="text-sm text-muted mt-1">{report.period}</p>
        </div>
        <GSTSummaryReport report={report} />
      </motion.div>
    </>
  )
}
