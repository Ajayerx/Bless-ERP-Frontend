"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion } from "framer-motion"
import { FileDown, Printer, Search } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Input,
  LinkSearchField,
  Skeleton,
  messageFromError,
  useMessageDialog,
} from "@/components/ui"
import { searchLink, reportService } from "@/services"
import { useCompany } from "@/context/CompanyContext"
import { formatDate } from "@/lib/utils"
import type {
  BankReconciliationStatementReport,
  BankReconciliationStatementRow,
  GeneralLedgerColumn,
} from "@/modules/reports/types"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtCurrency(n: number | null | undefined, currency: string): string {
  const num = Number(n ?? 0)
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency || "CAD",
      minimumFractionDigits: 2,
    }).format(num)
  } catch {
    return `$${num.toFixed(2)}`
  }
}

// The report appends balance/summary rows without a posting_date; `{}` rows are
// visual separators (mirrors get_balance_row + the blank `{}` rows in execute()).
function isBalanceRow(row: BankReconciliationStatementRow): boolean {
  return !row.posting_date && Boolean(row.payment_entry)
}

function isSeparatorRow(row: BankReconciliationStatementRow): boolean {
  return Object.keys(row).length === 0
}

export default function BankReconciliationStatementPage() {
  const { companies, selectedCompany } = useCompany()
  const { showMessage } = useMessageDialog()

  const [company, setCompany] = useState("")
  const [account, setAccount] = useState("")
  const [reportDate, setReportDate] = useState(today())
  const [includePos, setIncludePos] = useState(false)

  const [report, setReport] = useState<BankReconciliationStatementReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadedOnce, setLoadedOnce] = useState(false)

  useEffect(() => {
    if (!company && selectedCompany) setCompany(selectedCompany)
  }, [selectedCompany, company])

  const load = async () => {
    if (!company || !account || !reportDate) {
      showMessage("Company, Bank Account and Date are mandatory.")
      return
    }
    setLoading(true)
    try {
      const data = await reportService.getBankReconciliationStatement({
        company,
        account,
        report_date: reportDate,
        include_pos_transactions: includePos ? 1 : 0,
      })
      setReport(data)
      setLoadedOnce(true)
    } catch (err) {
      setReport(null)
      showMessage(messageFromError(err, "Failed to load the Bank Reconciliation Statement."))
    } finally {
      setLoading(false)
    }
  }

  const accountCurrency = "CAD"

  const exportCsv = () => {
    if (!report) return
    const header = report.columns.map((c) => c.label)
    const lines = report.rows.map((row) =>
      report.columns
        .map((c) => row[c.fieldname] ?? "")
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `bank-reconciliation-statement-${reportDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function renderCell(row: BankReconciliationStatementRow, col: GeneralLedgerColumn): ReactNode {
    const value = row[col.fieldname]
    if (value === null || value === undefined || value === "") return ""
    switch (col.fieldtype) {
      case "Date":
        return <span className="whitespace-nowrap">{formatDate(String(value))}</span>
      case "Currency":
        return <span className="whitespace-nowrap">{fmtCurrency(Number(value), accountCurrency)}</span>
      default:
        return <span className="whitespace-nowrap">{String(value)}</span>
    }
  }

  const rows = report?.rows ?? []

  return (
    <>
      <style>{`
        @media print {
          .brs-hide-print { display: none !important; }
          .brs-print-table { width: 100% !important; font-size: 10px; }
          .brs-print-table th, .brs-print-table td { border: 1px solid #000; padding: 4px 6px; }
          body { background: #fff !important; }
        }
      `}</style>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="brs-hide-print">
          <h1 className="text-2xl font-bold tracking-tight text-heading">
            Bank Reconciliation Statement
          </h1>
          <p className="text-sm text-muted mt-1">
            Uncleared vouchers and the calculated bank statement balance as of the report date.
          </p>
        </div>

        <Card className="brs-hide-print">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="brs-company" className="text-sm font-medium text-body">
                  Company
                </label>
                <select
                  id="brs-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                >
                  {(companies.length ? companies.map((c) => c.name) : [company || "Bless Erp"]).map(
                    (name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    )
                  )}
                </select>
              </div>
              <LinkSearchField
                label="Bank Account"
                placeholder="Select Bank Account"
                value={account}
                searchFn={(query) =>
                  searchLink("Account", query, undefined, [
                    ["is_group", "=", 0],
                    ["account_type", "in", ["Bank", "Cash"]],
                  ]).then((items) => ({
                    items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                  }))
                }
                onChange={(value) => setAccount(value ?? "")}
              />
              <Input
                id="brs-report-date"
                label="Date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-body self-end pb-2.5">
                <Checkbox
                  aria-label="Include POS Transactions"
                  checked={includePos}
                  onCheckedChange={(checked) => setIncludePos(checked === true)}
                />
                Include POS Transactions
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={load} loading={loading}>
                <Search size={16} /> Load
              </Button>
              {report && rows.length > 0 && (
                <>
                  <Button variant="secondary" onClick={exportCsv}>
                    <FileDown size={16} /> CSV
                  </Button>
                  <Button variant="ghost" onClick={() => window.print()}>
                    <Printer size={16} /> Print
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !report ? (
          <div className="text-center text-muted py-16">
            <Search size={24} className="mx-auto mb-2 text-muted" />
            {loadedOnce
              ? "No entries found for the selected filters."
              : "Set the filters and click Load to view the statement."}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
            <table className="w-full text-sm brs-print-table" data-testid="brs_table">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {report.columns.map((c) => (
                    <th key={c.fieldname} className="px-4 py-3 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) =>
                  isSeparatorRow(row) ? (
                    <tr key={idx} className="h-3" />
                  ) : isBalanceRow(row) ? (
                    <tr
                      key={idx}
                      className="border-b border-border bg-gray-50/70 font-semibold text-body"
                    >
                      {report.columns.map((c, ci) => (
                        <td key={c.fieldname} className="px-4 py-2.5 whitespace-nowrap">
                          {ci === 0
                            ? String(row.payment_entry ?? "")
                            : c.fieldtype === "Currency"
                              ? fmtCurrency(Number(row[c.fieldname] ?? 0), accountCurrency)
                              : ""}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      {report.columns.map((c) => (
                        <td key={c.fieldname} className="px-4 py-2.5">
                          {renderCell(row, c)}
                        </td>
                      ))}
                    </tr>
                  )
                )}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={report.columns.length} className="px-4 py-8 text-center text-muted">
                      No entries found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </>
  )
}
