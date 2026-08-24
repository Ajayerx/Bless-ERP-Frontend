"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Printer, FileDown, FileSpreadsheet, Search } from "lucide-react"
import * as XLSX from "xlsx"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { useCompany } from "@/context/CompanyContext"
import { reportService, type TaxSummary, type TaxTransactionRow } from "@/services"
import GSTSummaryReport from "../components/GSTSummaryReport"

const inputClass =
  "h-9 rounded-[10px] border border-border bg-white px-3 text-sm text-body outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-muted"

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthStart(d: Date): string {
  return isoDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

function today(): string {
  return isoDate(new Date())
}

function quarterStart(d: Date): string {
  return isoDate(new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1))
}

function quarterEnd(d: Date): string {
  const start = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1)
  const next = new Date(start.getFullYear(), start.getMonth() + 3, 1)
  return isoDate(new Date(next.getTime() - 86400000))
}

interface Preset {
  label: string
  testId: string
  from: () => string
  to: () => string
}

const PRESETS: Preset[] = [
  { label: "This Month", testId: "gst_preset_month", from: () => monthStart(new Date()), to: () => today() },
  {
    label: "Last Month",
    testId: "gst_preset_last_month",
    from: () => isoDate(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)),
    to: () => isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 0)),
  },
  { label: "This Quarter", testId: "gst_preset_quarter", from: () => quarterStart(new Date()), to: () => today() },
  {
    label: "Last Quarter",
    testId: "gst_preset_last_quarter",
    from: () => quarterStart(new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1)),
    to: () => quarterEnd(new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1)),
  },
  { label: "This Year", testId: "gst_preset_year", from: () => isoDate(new Date(new Date().getFullYear(), 0, 1)), to: () => today() },
  {
    label: "Last Year",
    testId: "gst_preset_last_year",
    from: () => isoDate(new Date(new Date().getFullYear() - 1, 0, 1)),
    to: () => isoDate(new Date(new Date().getFullYear() - 1, 11, 31)),
  },
  { label: "All Time", testId: "gst_preset_all", from: () => "2000-01-01", to: () => today() },
]

function fmtCurrency(n: number, currency?: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

export default function GSTSummaryPage() {
  const { companies, selectedCompany, selectedCompanyInfo } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()
  const initializedRef = useRef(false)

  const [company, setCompany] = useState("")
  const [fromDate, setFromDate] = useState(monthStart(new Date()))
  const [toDate, setToDate] = useState(today())

  const [report, setReport] = useState<TaxSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)

  const currency = selectedCompanyInfo?.defaultCurrency || "CAD"

  // Read the report scope from the URL query string (deep-linkable, shareable).
  useEffect(() => {
    const qCompany = searchParams.get("company")
    const qFrom = searchParams.get("from_date")
    const qTo = searchParams.get("to_date")
    setCompany(qCompany || selectedCompany || "")
    if (qFrom) setFromDate(qFrom)
    if (qTo) setToDate(qTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!company) setCompany(selectedCompany || "")
  }, [selectedCompany, company])

  const load = useCallback(async () => {
    if (!company || !fromDate || !toDate) {
      setError("Company, From Date and To Date are mandatory.")
      return
    }
    if (fromDate > toDate) {
      setError("From Date must be before To Date.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await reportService.getTaxSummary({ company, fromDate, toDate })
      setReport(data)
      setLoadedOnce(true)
      setSearchParams({ company, from_date: fromDate, to_date: toDate }, { replace: true })
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : "Failed to load the GST/QST summary.")
    } finally {
      setLoading(false)
    }
  }, [company, fromDate, toDate, setSearchParams])

  // Auto-load once when opened from a deep link carrying dates.
  useEffect(() => {
    if (initializedRef.current) return
    if (!searchParams.get("from_date") && !searchParams.get("to_date")) return
    if (!company || !fromDate || !toDate) return
    initializedRef.current = true
    load()
  }, [company, fromDate, toDate, load, searchParams])

  const applyPreset = (preset: Preset) => {
    setFromDate(preset.from())
    setToDate(preset.to())
  }

  const exportCsv = () => {
    if (!report) return
    const header = ["Side", "Voucher", "Party", "Date", "Subtotal", "GST", "QST", "Other Tax", "Total"]
    const lines = report.transactions.map((t) =>
      [
        t.side === "sales" ? "Sales" : "Purchase",
        t.voucherNo,
        t.partyName,
        t.postingDate,
        t.subtotal,
        t.gst,
        t.qst,
        t.otherTax,
        t.total,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    const blob = new Blob(["\uFEFF" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;bom" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `gst-qst-summary-${company}-${fromDate}-to-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = () => {
    if (!report) return
    const rows = report.transactions.map((t: TaxTransactionRow) => ({
      Side: t.side === "sales" ? "Sales" : "Purchase",
      Voucher: t.voucherNo,
      Party: t.partyName,
      Date: t.postingDate,
      Subtotal: t.subtotal,
      GST: t.gst,
      QST: t.qst,
      "Other Tax": t.otherTax,
      Total: t.total,
    }))
    const sheet = XLSX.utils.json_to_sheet(rows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "GST/QST Summary")
    XLSX.writeFile(book, `gst-qst-summary-${company}-${fromDate}-to-${toDate}.xlsx`)
  }

  return (
    <>
      <style>{`
        .gst-print-title { display: none; }
        @media print {
          @page { margin: 12mm; }
          body, * { background-color: #fff !important; color: #111827 !important; box-shadow: none !important; border-radius: 0 !important; }
          aside, header { display: none !important; }
          .ml-\\[260px\\], .ml-\\[72px\\] { margin-left: 0 !important; }
          .gst-hide-print { display: none !important; }
          .gst-print-title { display: block; }
          .gst-report .gst-kpi-icon { display: none !important; }
          .gst-report .overflow-x-auto { overflow: visible !important; }
          .gl-print-table { width: 100% !important; font-size: 10px; border-collapse: collapse; }
          .gl-print-table th, .gl-print-table td { border: 1px solid #000; padding: 4px 6px; }
          .gl-print-table thead { display: table-header-group; }
          .gl-print-table tr { page-break-inside: avoid; }
          .gl-print-table a { text-decoration: underline; }
        }
      `}</style>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="gst-hide-print">
          <h1 className="text-2xl font-bold text-heading">GST/QST Summary</h1>
          <p className="text-sm text-muted mt-1">Tax collected on sales and input tax credits on purchases, for {company || selectedCompany || "selected company"}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 gst-hide-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">Company</label>
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} data-testid="gst_company_select">
                {companies.length === 0 && <option value={company}>{company || "Bless Erp"}</option>}
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>{c.companyName || c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} data-testid="gst_from_date" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} data-testid="gst_to_date" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">Quick Periods</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.testId}
                    type="button"
                    onClick={() => applyPreset(p)}
                    data-testid={p.testId}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-body hover:bg-gray-50 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="h-9 px-4 rounded-[10px] bg-primary-600 text-primary-50 text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
              data-testid="gst_load_button"
            >
              {loading ? "Loading..." : "Load"}
            </button>
            {report && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gst_export_csv"
                >
                  <FileDown size={14} /> CSV
                </button>
                <button
                  onClick={exportExcel}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gst_export_excel"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gst_print"
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-muted mt-3">
            Currency: {currency}. GST {report ? fmtCurrency(report.sales.gst, currency) : "—"} collected · QST {report ? fmtCurrency(report.sales.qst, currency) : "—"} collected · Net remittance {report ? fmtCurrency(report.netRemittance.total, currency) : "—"}.
          </p>
        </div>

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !report ? (
          !loadedOnce ? (
            <div className="text-center text-muted py-24">
              <Search size={24} className="mx-auto mb-2 text-muted" />
              Select a period and click Load to generate the GST/QST summary.
            </div>
          ) : (
            <div className="text-center text-muted py-24">No invoices or purchase bills found for the selected period.</div>
          )
        ) : report.transactions.length === 0 ? (
          <div className="text-center text-muted py-24">No invoices or purchase bills found for the selected period.</div>
        ) : (
          <>
            <div className="gst-print-title mb-4">
              <h1 className="text-2xl font-bold text-heading">GST/QST Summary</h1>
              <p className="text-sm text-muted mt-1">
                {company || selectedCompany || "Selected company"} · {fromDate} to {toDate} · {currency}
              </p>
            </div>
            <GSTSummaryReport report={report} />
          </>
        )}
      </motion.div>
    </>
  )
}
