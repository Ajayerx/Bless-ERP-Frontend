"use client"

import { useEffect, useState, useCallback } from "react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { reportService, type TaxSummary } from "@/services"
import GSTSummaryReport from "../components/GSTSummaryReport"

export default function GSTSummaryPage() {
  const [report, setReport] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await reportService.getTaxSummary(fromDate || undefined, toDate || undefined)
      setReport(data)
    } catch {
      setReport(null)
    } finally {
      setLoading(false)
    }
  }, [fromDate, toDate])

  useEffect(() => { load() }, [load])

  const inputClass = "h-9 rounded-[10px] border border-border bg-white px-3 text-sm text-body outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">GST/QST Summary</h1>
            <p className="text-sm text-muted mt-1">{report?.period ?? "Select a date range"}</p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </div>
            <button onClick={load} className="h-9 px-4 rounded-[10px] bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
              Refresh
            </button>
          </div>
        </div>
        {loading ? (
          <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div>
        ) : !report ? (
          <div className="text-center text-muted py-24">Report data unavailable.</div>
        ) : (
          <GSTSummaryReport report={report} />
        )}
      </motion.div>
    </>
  )
}
