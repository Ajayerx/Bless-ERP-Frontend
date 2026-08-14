"use client"

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { motion } from "framer-motion"
import { Loader2, Search, X, ChevronDown, ChevronUp, Printer, FileDown, FileSpreadsheet } from "lucide-react"
import * as XLSX from "xlsx"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { useCompany } from "@/context/CompanyContext"
import { searchLink, reportService, type GeneralLedgerReport, type GeneralLedgerRow, type GeneralLedgerColumn, type GeneralLedgerFilters } from "@/services"
import { formatDate } from "@/lib/utils"
import { DOCTYPE_ROUTES } from "@/lib/doctype-routes"

const inputClass =
  "h-9 rounded-[10px] border border-border bg-white px-3 text-sm text-body outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 disabled:bg-gray-50 disabled:text-muted"

const checkClass = "rounded border-border"

function monthAgo(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function fmtCurrency(n: number | null | undefined, currency?: string): string {
  const num = n ?? 0
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

// ERPNext "Categorize by" options (general_ledger.js). The default, matching
// the desktop report, is "Categorize by Voucher (Consolidated)".
const CATEGORIZE_OPTIONS = [
  { label: "Categorize by Voucher (Consolidated)", value: "Categorize by Voucher (Consolidated)" },
  { label: "Categorize by Voucher", value: "Categorize by Voucher" },
  { label: "Categorize by Account", value: "Categorize by Account" },
  { label: "Categorize by Party", value: "Categorize by Party" },
  { label: "No Grouping", value: "" },
]

// ERPNext's party_account_types (Customer/Supplier/Employee/Shareholder/Member).
const PARTY_TYPES = ["Customer", "Supplier", "Employee", "Shareholder", "Member"]

// Common presentation currencies (the desktop report lists the Currency master).
const COMMON_CURRENCIES = ["CAD", "USD", "EUR", "INR", "GBP", "AUD", "JPY", "CNY"]

interface Chip {
  value: string
  label: string
}

// Reusable multi-select link filter (ERPNext MultiSelectList): debounced
// searchLink lookup, chip list, single-select mode via `max: 1`.
function LinkMultiSelect({
  doctype,
  value,
  onChange,
  placeholder,
  testId,
  max = Infinity,
}: {
  doctype: string
  value: Chip[]
  onChange: (next: Chip[]) => void
  placeholder?: string
  testId?: string
  max?: number
}) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<Chip[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setOptions([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const rows = await searchLink(doctype, query)
        const chips = rows.map((r) => ({ value: r.value, label: r.label || r.value }))
        setOptions(chips)
        setOpen(true)
      } catch {
        setOptions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doctype])

  const add = (chip: Chip) => {
    if (value.some((v) => v.value === chip.value)) return
    onChange(max === 1 ? [chip] : [...value, chip])
    setQuery("")
    setOpen(false)
  }

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || "Select..."}
          className={inputClass}
          data-testid={testId}
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-2.5 animate-spin text-muted" />}
        {open && options.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-[10px] border border-border bg-white shadow-card">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  add(o)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-body hover:bg-gray-50"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((chip) => (
            <span
              key={chip.value}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 border border-primary-100 px-2.5 py-1 text-xs font-medium text-primary-700"
            >
              {chip.label}
              <button
                type="button"
                aria-label={`Remove ${chip.label}`}
                onClick={() => onChange(value.filter((v) => v.value !== chip.value))}
                className="text-primary-500 hover:text-primary-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">{label}</label>
      {children}
    </div>
  )
}

// ERPNext computes Opening / Total / Closing summary rows server-side. They are
// identified by a missing posting_date, with the label placed in `account`.
function isSummaryRow(row: GeneralLedgerRow): boolean {
  return !row.posting_date
}

export default function GeneralLedgerPage() {
  const { companies, selectedCompany, selectedCompanyInfo } = useCompany()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialParamsRef = useRef(searchParams)
  const initializedRef = useRef(false)

  const [company, setCompany] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [accounts, setAccounts] = useState<Chip[]>([])
  const [voucherNo, setVoucherNo] = useState("")
  const [againstVoucherNo, setAgainstVoucherNo] = useState("")
  const [partyType, setPartyType] = useState("")
  const [party, setParty] = useState<Chip[]>([])
  const [categorizeBy, setCategorizeBy] = useState("Categorize by Voucher (Consolidated)")
  const [financeBook, setFinanceBook] = useState("")
  const [presentationCurrency, setPresentationCurrency] = useState("")
  const [costCenters, setCostCenters] = useState<Chip[]>([])
  const [projects, setProjects] = useState<Chip[]>([])

  const [includeDimensions, setIncludeDimensions] = useState(true)
  const [disableOpeningBalance, setDisableOpeningBalance] = useState(false)
  const [showOpeningEntries, setShowOpeningEntries] = useState(false)
  const [includeDefaultBookEntries, setIncludeDefaultBookEntries] = useState(true)
  const [showNetValues, setShowNetValues] = useState(false)
  const [showAmountInCompanyCurrency, setShowAmountInCompanyCurrency] = useState(false)
  const [addTransactionCurrency, setAddTransactionCurrency] = useState(false)
  const [showRemarks, setShowRemarks] = useState(false)
  const [ignoreErr, setIgnoreErr] = useState(false)
  const [ignoreCrDrNotes, setIgnoreCrDrNotes] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [report, setReport] = useState<GeneralLedgerReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)

  const companyCurrency = selectedCompanyInfo?.defaultCurrency || "CAD"
  const displayCurrency = presentationCurrency || companyCurrency

  // Read every filter from the URL query string (deep links like the Payment
  // Entry "Ledger" button rely on this).
  useEffect(() => {
    const p = initialParamsRef.current
    const qCompany = p.get("company")
    const qFrom = p.get("from_date")
    const qTo = p.get("to_date")
    const qVoucher = p.get("voucher_no")
    const qAgainst = p.get("against_voucher_no")
    const qPartyType = p.get("party_type")
    const qParty = p.get("party")
    const qCategorizeBy = p.get("categorize_by")
    const qFinanceBook = p.get("finance_book")
    const qCurrency = p.get("presentation_currency")
    const qCostCenters = p.get("cost_center")
    const qProjects = p.get("project")

    setCompany(qCompany || selectedCompany || "")
    setFromDate(qFrom || monthAgo())
    setToDate(qTo || today())
    if (qVoucher) {
      setVoucherNo(qVoucher)
      setCategorizeBy("Categorize by Voucher (Consolidated)")
    }
    if (qAgainst) setAgainstVoucherNo(qAgainst)
    if (qPartyType) setPartyType(qPartyType)
    if (qParty) {
      try {
        setParty(JSON.parse(qParty).map((v: string) => ({ value: v, label: v })))
      } catch {
        setParty([])
      }
    }
    if (qCategorizeBy) setCategorizeBy(qCategorizeBy)
    if (qFinanceBook) setFinanceBook(qFinanceBook)
    if (qCurrency) setPresentationCurrency(qCurrency)
    if (qCostCenters) {
      try {
        setCostCenters(JSON.parse(qCostCenters).map((v: string) => ({ value: v, label: v })))
      } catch {
        setCostCenters([])
      }
    }
    if (qProjects) {
      try {
        setProjects(JSON.parse(qProjects).map((v: string) => ({ value: v, label: v })))
      } catch {
        setProjects([])
      }
    }

    if (p.get("include_dimensions") === "0") setIncludeDimensions(false)
    if (p.get("disable_opening_balance_calculation") === "1") setDisableOpeningBalance(true)
    if (p.get("show_opening_entries") === "1") setShowOpeningEntries(true)
    if (p.get("include_default_book_entries") === "0") setIncludeDefaultBookEntries(false)
    if (p.get("show_net_values_in_party_account") === "1") setShowNetValues(true)
    if (p.get("show_amount_in_company_currency") === "1") setShowAmountInCompanyCurrency(true)
    if (p.get("add_values_in_transaction_currency") === "1") setAddTransactionCurrency(true)
    if (p.get("show_remarks") === "1") setShowRemarks(true)
    if (p.get("ignore_err") === "1") setIgnoreErr(true)
    if (p.get("ignore_cr_dr_notes") === "1") setIgnoreCrDrNotes(true)
    if (p.get("show_cancelled_entries") === "1") setShowCancelled(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!company) setCompany(selectedCompany || "")
  }, [selectedCompany, company])

  const buildFilters = useCallback((): GeneralLedgerFilters => {
    const f: GeneralLedgerFilters = { company, from_date: fromDate, to_date: toDate }
    if (accounts.length > 0) f.account = accounts.map((a) => a.value)
    if (voucherNo.trim()) f.voucher_no = voucherNo.trim()
    if (againstVoucherNo.trim()) f.against_voucher_no = againstVoucherNo.trim()
    if (partyType && party.length > 0) {
      f.party_type = partyType
      f.party = party.map((p) => p.value)
    }
    if (categorizeBy) f.categorize_by = categorizeBy
    if (financeBook) f.finance_book = financeBook
    if (presentationCurrency) f.presentation_currency = presentationCurrency
    if (costCenters.length > 0) f.cost_center = costCenters.map((c) => c.value)
    if (projects.length > 0) f.project = projects.map((p) => p.value)
    f.include_dimensions = includeDimensions ? 1 : 0
    f.disable_opening_balance_calculation = disableOpeningBalance ? 1 : 0
    f.show_opening_entries = showOpeningEntries ? 1 : 0
    f.include_default_book_entries = includeDefaultBookEntries ? 1 : 0
    f.show_net_values_in_party_account = showNetValues ? 1 : 0
    f.show_amount_in_company_currency = showAmountInCompanyCurrency ? 1 : 0
    f.add_values_in_transaction_currency = addTransactionCurrency ? 1 : 0
    f.show_remarks = showRemarks ? 1 : 0
    f.ignore_err = ignoreErr ? 1 : 0
    f.ignore_cr_dr_notes = ignoreCrDrNotes ? 1 : 0
    f.show_cancelled_entries = showCancelled ? 1 : 0
    return f
  }, [
    company, fromDate, toDate, accounts, voucherNo, againstVoucherNo, partyType, party,
    categorizeBy, financeBook, presentationCurrency, costCenters, projects,
    includeDimensions, disableOpeningBalance, showOpeningEntries, includeDefaultBookEntries,
    showNetValues, showAmountInCompanyCurrency, addTransactionCurrency, showRemarks,
    ignoreErr, ignoreCrDrNotes, showCancelled,
  ])

  // Sync the current filters into the URL (replace) so the report is shareable,
  // mirroring ERPNext's query-report URL round-trip.
  const syncUrl = useCallback(
    (filters: GeneralLedgerFilters) => {
      const params = new URLSearchParams()
      params.set("company", filters.company)
      params.set("from_date", filters.from_date)
      params.set("to_date", filters.to_date)
      if (filters.voucher_no) params.set("voucher_no", filters.voucher_no)
      if (filters.against_voucher_no) params.set("against_voucher_no", filters.against_voucher_no)
      if (filters.party_type && filters.party && filters.party.length > 0) {
        params.set("party_type", filters.party_type)
        params.set("party", JSON.stringify(filters.party))
      }
      if (filters.categorize_by) params.set("categorize_by", filters.categorize_by)
      if (filters.finance_book) params.set("finance_book", filters.finance_book)
      if (filters.presentation_currency) params.set("presentation_currency", filters.presentation_currency)
      if (filters.cost_center && filters.cost_center.length > 0) params.set("cost_center", JSON.stringify(filters.cost_center))
      if (filters.project && filters.project.length > 0) params.set("project", JSON.stringify(filters.project))
      params.set("include_dimensions", String(filters.include_dimensions ?? 1))
      params.set("disable_opening_balance_calculation", String(filters.disable_opening_balance_calculation ?? 0))
      params.set("show_opening_entries", String(filters.show_opening_entries ?? 0))
      params.set("include_default_book_entries", String(filters.include_default_book_entries ?? 1))
      params.set("show_net_values_in_party_account", String(filters.show_net_values_in_party_account ?? 0))
      params.set("show_amount_in_company_currency", String(filters.show_amount_in_company_currency ?? 0))
      params.set("add_values_in_transaction_currency", String(filters.add_values_in_transaction_currency ?? 0))
      params.set("show_remarks", String(filters.show_remarks ?? 0))
      params.set("ignore_err", String(filters.ignore_err ?? 0))
      params.set("ignore_cr_dr_notes", String(filters.ignore_cr_dr_notes ?? 0))
      params.set("show_cancelled_entries", String(filters.show_cancelled_entries ?? 0))
      setSearchParams(params, { replace: true })
    },
    [setSearchParams]
  )

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
    const filters = buildFilters()
    try {
      const data = await reportService.getGeneralLedger(filters)
      setReport(data)
      setLoadedOnce(true)
      syncUrl(filters)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : "Failed to load the General Ledger.")
    } finally {
      setLoading(false)
    }
  }, [buildFilters, company, fromDate, toDate, syncUrl])

  // Auto-load exactly once when the page is opened from a deep link that carries
  // a voucher_no or from_date (e.g. the Payment Entry "Ledger" button).
  useEffect(() => {
    if (initializedRef.current) return
    const p = initialParamsRef.current
    if (!p.get("voucher_no") && !p.get("from_date")) return
    if (!company || !fromDate || !toDate) return
    initializedRef.current = true
    load()
  }, [company, fromDate, toDate, load])

  const exportCsv = () => {
    if (!report) return
    const columns = report.columns.filter((c) => !c.hidden)
    const header = columns.map((c) => c.label)
    const lines = report.rows.map((r) =>
      columns.map((c) => r[c.fieldname] ?? "").map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `general-ledger-${company}-${fromDate}-to-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = () => {
    if (!report) return
    const columns = report.columns.filter((c) => !c.hidden)
    const rows = report.rows.map((r) => {
      const o: Record<string, string | number> = {}
      for (const c of columns) {
        const v = r[c.fieldname]
        o[c.label] = typeof v === "number" ? v : String(v ?? "")
      }
      return o
    })
    const sheet = XLSX.utils.json_to_sheet(rows)
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, "General Ledger")
    XLSX.writeFile(book, `general-ledger-${company}-${fromDate}-to-${toDate}.xlsx`)
  }

  const accountRows = report?.rows ?? []
  const visibleColumns = (report?.columns ?? []).filter((c) => !c.hidden)

  function renderCell(row: GeneralLedgerRow, col: GeneralLedgerColumn): ReactNode {
    const value = row[col.fieldname]
    if (value === null || value === undefined || value === "") return ""
    switch (col.fieldtype) {
      case "Date":
        return <span className="whitespace-nowrap">{formatDate(String(value))}</span>
      case "Currency":
        return <span className="whitespace-nowrap">{fmtCurrency(Number(value), displayCurrency)}</span>
      case "Link":
      case "Dynamic Link": {
        if (col.fieldname === "voucher_no") {
          const route = DOCTYPE_ROUTES[String(row.voucher_type ?? "")]
          if (route) {
            return (
              <Link to={`${route}/${encodeURIComponent(String(value))}`} className="text-primary-700 hover:underline whitespace-nowrap">
                {String(value)}
              </Link>
            )
          }
        }
        return <span className="whitespace-nowrap">{String(value)}</span>
      }
      default:
        return <span className="break-words">{String(value)}</span>
    }
  }

  return (
    <>
      <style>{`
        @media print {
          .gl-hide-print { display: none !important; }
          .gl-print-table { width: 100% !important; font-size: 10px; }
          .gl-print-table th, .gl-print-table td { border: 1px solid #000; padding: 4px 6px; }
          body { background: #fff !important; }
        }
      `}</style>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="gl-hide-print">
          <h1 className="text-2xl font-bold text-heading">General Ledger</h1>
          <p className="text-sm text-muted mt-1">GL entries for {company || selectedCompany || "selected company"}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6 gl-hide-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Field label="Company">
              <select value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} data-testid="gl_company_select">
                {companies.length === 0 && <option value={company}>{company || "Bless Erp"}</option>}
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>{c.companyName || c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="From Date">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} data-testid="gl_from_date" />
            </Field>
            <Field label="To Date">
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} data-testid="gl_to_date" />
            </Field>
            <Field label="Account">
              <LinkMultiSelect doctype="Account" value={accounts} onChange={setAccounts} placeholder="Select account..." testId="gl_account_input" />
            </Field>
            <Field label="Voucher No">
              <input
                type="text"
                value={voucherNo}
                onChange={(e) => {
                  setVoucherNo(e.target.value)
                  if (e.target.value.trim()) setCategorizeBy("Categorize by Voucher (Consolidated)")
                }}
                placeholder="e.g. ACC-PAY-0001"
                className={inputClass}
                data-testid="gl_voucher_no"
              />
            </Field>
            <Field label="Against Voucher No">
              <input
                type="text"
                value={againstVoucherNo}
                onChange={(e) => setAgainstVoucherNo(e.target.value)}
                placeholder="e.g. ACC-SINV-2026-00058"
                className={inputClass}
                data-testid="gl_against_voucher_no"
              />
            </Field>
            <Field label="Categorize by">
              <select value={categorizeBy} onChange={(e) => setCategorizeBy(e.target.value)} className={inputClass} data-testid="gl_categorize_by">
                {CATEGORIZE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Party Type">
              <select value={partyType} onChange={(e) => { setPartyType(e.target.value); setParty([]) }} className={inputClass} data-testid="gl_party_type">
                <option value="">All Parties</option>
                {PARTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>{pt}</option>
                ))}
              </select>
            </Field>
            <Field label="Party">
              <LinkMultiSelect
                doctype={partyType || "Customer"}
                value={party}
                onChange={setParty}
                placeholder={partyType ? `Select ${partyType}...` : "Select Party Type first"}
                testId="gl_party_input"
              />
            </Field>
            <Field label="Cost Center">
              <LinkMultiSelect doctype="Cost Center" value={costCenters} onChange={setCostCenters} placeholder="Select cost center..." testId="gl_cost_center_input" />
            </Field>
            <Field label="Project">
              <LinkMultiSelect doctype="Project" value={projects} onChange={setProjects} placeholder="Select project..." testId="gl_project_input" />
            </Field>
            <Field label="Finance Book">
              <LinkMultiSelect doctype="Finance Book" value={financeBook ? [{ value: financeBook, label: financeBook }] : []} onChange={(n) => setFinanceBook(n[0]?.value ?? "")} placeholder="Select finance book..." testId="gl_finance_book" max={1} />
            </Field>
            <Field label="Currency">
              <select value={presentationCurrency} onChange={(e) => setPresentationCurrency(e.target.value)} className={inputClass} data-testid="gl_currency">
                <option value="">Company Currency ({companyCurrency})</option>
                {Array.from(new Set([...COMMON_CURRENCIES, companyCurrency])).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-700 hover:underline"
              data-testid="gl_show_advanced"
            >
              {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showAdvanced ? "Hide advanced filters" : "More filters"}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="h-9 px-4 rounded-[10px] bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-60"
              data-testid="gl_load_button"
            >
              {loading ? "Loading..." : "Load"}
            </button>
            {report && accountRows.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={exportCsv}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gl_export_csv"
                >
                  <FileDown size={14} /> CSV
                </button>
                <button
                  onClick={exportExcel}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gl_export_excel"
                >
                  <FileSpreadsheet size={14} /> Excel
                </button>
                <button
                  onClick={() => window.print()}
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-[10px] border border-border text-sm font-medium text-body hover:bg-gray-50 transition-colors"
                  data-testid="gl_print"
                >
                  <Printer size={14} /> Print
                </button>
              </div>
            )}
          </div>

          {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-2 border-t border-border pt-4">
              {[
                { label: "Consider Accounting Dimensions", checked: includeDimensions, set: setIncludeDimensions, id: "gl_include_dimensions" },
                { label: "Show Remarks", checked: showRemarks, set: setShowRemarks, id: "gl_show_remarks" },
                { label: "Show Cancelled Entries", checked: showCancelled, set: setShowCancelled, id: "gl_show_cancelled" },
                { label: "Show Net Values in Party Account", checked: showNetValues, set: setShowNetValues, id: "gl_show_net_values" },
                { label: "Show Credit / Debit in Company Currency", checked: showAmountInCompanyCurrency, set: setShowAmountInCompanyCurrency, id: "gl_show_company_currency" },
                { label: "Add Columns in Transaction Currency", checked: addTransactionCurrency, set: setAddTransactionCurrency, id: "gl_add_transaction_currency" },
                { label: "Include Default FB Entries", checked: includeDefaultBookEntries, set: setIncludeDefaultBookEntries, id: "gl_include_default_book_entries" },
                { label: "Disable Opening Balance Calculation", checked: disableOpeningBalance, set: setDisableOpeningBalance, id: "gl_disable_opening" },
                { label: "Show Opening Entries", checked: showOpeningEntries, set: setShowOpeningEntries, id: "gl_show_opening_entries", disabled: disableOpeningBalance },
                { label: "Ignore Exchange Rate Revaluation & Gain/Loss Journals", checked: ignoreErr, set: setIgnoreErr, id: "gl_ignore_err" },
                { label: "Ignore System Generated Credit / Debit Notes", checked: ignoreCrDrNotes, set: setIgnoreCrDrNotes, id: "gl_ignore_cr_dr_notes" },
              ].map((c) => (
                <label key={c.id} className="inline-flex items-center gap-2 text-sm text-body">
                  <input
                    type="checkbox"
                    className={checkClass}
                    checked={c.checked}
                    disabled={c.disabled}
                    onChange={(e) => c.set(e.target.checked)}
                    data-testid={c.id}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !report ? (
          !loadedOnce ? (
            <div className="text-center text-muted py-16">
              <Search size={24} className="mx-auto mb-2 text-muted" />
              Set the filters and click Load to view GL entries.
            </div>
          ) : (
            <div className="text-center text-muted py-16">No GL entries found for the selected filters.</div>
          )
        ) : (
          <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
            <table className="w-full text-sm gl-print-table" data-testid="gl_table">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted uppercase tracking-wider">
                  {visibleColumns.map((c) => (
                    <th key={c.fieldname} className="px-4 py-3 whitespace-nowrap">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accountRows.map((row, idx) =>
                  isSummaryRow(row) ? (
                    <tr key={idx} className="border-b border-border bg-gray-50/70 font-semibold text-body" data-testid={`gl_summary_row_${String(row.account)}`}>
                      {visibleColumns.map((c, ci) => (
                        <td key={c.fieldname} className="px-4 py-2.5 whitespace-nowrap">
                          {ci === 0 ? String(row.account ?? "") : c.fieldtype === "Currency" ? fmtCurrency(Number(row[c.fieldname] ?? 0), displayCurrency) : ""}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      {visibleColumns.map((c) => (
                        <td key={c.fieldname} className="px-4 py-2.5">{renderCell(row, c)}</td>
                      ))}
                    </tr>
                  )
                )}
                {accountRows.length === 0 && (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-muted">
                      No GL entries found for the selected filters.
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
