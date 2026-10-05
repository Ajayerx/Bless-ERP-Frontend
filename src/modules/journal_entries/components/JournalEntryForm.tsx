"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { DateInput, Input, } from "@/components/ui"
import { Combobox, inputClass, labelClass } from "@/components/ui/form-fields"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { useLazyOptions } from "@/services/lookup-cache"
import { useDocstatusLock } from "@/hooks/useDocstatusLock"
import { JOURNAL_ENTRY_DOCTYPE } from "@/services/journal-entry.service"
import {
  journalEntryService,
  FALLBACK_VOUCHER_TYPES,
  type JournalEntryFormData,
  type JournalEntryAccountFormRow,
  type JournalEntryDoc,
} from "../services"
import { cn, formatCurrency, todayISO as localTodayISO } from "@/lib/utils"

const DEFAULT_COMPANY = "Bless Erp"
const DEFAULT_SERIES = "ACC-JV-.YYYY.-"
const FALLBACK_COST_CENTERS = ["Main - BE", "Operations - BE", "Sales - BE"]
const PARTY_TYPES = ["Supplier", "Customer", "Employee"]

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

function todayISO(): string {
  return localTodayISO()
}

let uid = 0
function newKey(): string {
  uid += 1
  return `je-account-${uid}`
}

function createEmptyAccountRow(costCenter = "Main - BE"): JournalEntryAccountFormRow {
  return {
    key: newKey(),
    account: "",
    party_type: "",
    party: "",
    account_currency: "CAD",
    exchange_rate: 1,
    debit: 0,
    credit: 0,
    cost_center: costCenter,
    project: "",
  }
}

function buildEmptyForm(): JournalEntryFormData {
  return {
    doctype: JOURNAL_ENTRY_DOCTYPE,
    name: undefined,
    naming_series: DEFAULT_SERIES,
    voucher_type: "Journal Entry",
    posting_date: todayISO(),
    company: DEFAULT_COMPANY,
    finance_book: "",
    bill_no: "",
    is_opening: 0,
    multi_currency: 0,
    remark: "",
    user_remark: "",
    title: "",
    accounts: [createEmptyAccountRow()],
    total_debit: 0,
    total_credit: 0,
    difference: 0,
    docstatus: 0,
  }
}

export interface JournalEntryFormHandle {
  save: (action?: "Save" | "Submit") => Promise<string | undefined>
  isDirty: () => boolean
}

export interface JournalEntryFormProps {
  doc?: JournalEntryDoc | null
  mode?: "create" | "edit"
  onSaved?: (doc: JournalEntryDoc | null, action: "Save" | "Submit") => void
  onDirtyChange?: (dirty: boolean) => void
}

export default forwardRef<JournalEntryFormHandle, JournalEntryFormProps>(
  function JournalEntryForm({ doc: initialData, mode = initialData ? "edit" : "create", onSaved, onDirtyChange }, ref) {
    const [form, setForm] = useState<JournalEntryFormData>(() =>
      initialData ? fromDoc(initialData) : buildEmptyForm(),
    )
    const [baseline, setBaseline] = useState<JournalEntryFormData>(() =>
      initialData ? fromDoc(initialData) : buildEmptyForm(),
    )
    const baselineRef = useRef<JournalEntryFormData>(baseline)
    const formRef = useRef<JournalEntryFormData>(form)
    useEffect(() => {
      formRef.current = form
    }, [form])

    const companies = useLazyOptions<string[]>(
      "journal-entry:companies",
      journalEntryService.lookups.companies,
      [],
    )
    const voucherTypes = useLazyOptions<string[]>(
      "journal-entry:voucher-types",
      journalEntryService.lookups.voucherTypes,
      [],
    )
    const costCenters = useLazyOptions<string[]>(
      "journal-entry:cost-centers",
      () => journalEntryService.lookups.costCenters(),
      [],
    )

    const companyOptions = useMemo(
      () => Array.from(new Set([...(companies.value || []), DEFAULT_COMPANY])),
      [companies.value],
    )
    const voucherOptions = useMemo(
      () => Array.from(new Set([...(voucherTypes.value || []), ...FALLBACK_VOUCHER_TYPES])),
      [voucherTypes.value],
    )
    const costCenterOptions = useMemo(
      () => Array.from(new Set([...(costCenters.value || []), ...FALLBACK_COST_CENTERS])),
      [costCenters.value],
    )

    useEffect(() => {
      if (initialData) {
        const next = fromDoc(initialData)
        setForm(next)
        setBaseline(next)
        baselineRef.current = next
      }
    }, [initialData])

    const update = (patch: Partial<JournalEntryFormData>) => setForm((prev) => ({ ...prev, ...patch }))

    const isDirty = () => JSON.stringify(formRef.current) !== JSON.stringify(baselineRef.current)
    useEffect(() => {
      onDirtyChange?.(isDirty())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, baseline])

    const totals = useMemo(() => {
      const rows = form.accounts ?? []
      const total_debit = round2(rows.reduce((s, a) => s + (Number(a.debit) || 0), 0))
      const total_credit = round2(rows.reduce((s, a) => s + (Number(a.credit) || 0), 0))
      return { total_debit, total_credit, difference: round2(total_debit - total_credit) }
    }, [form.accounts])

    const handleAccountsChange = (next: JournalEntryAccountFormRow[]) => {
      update({ accounts: next })
    }

    // ERPNext auto-balance: place the imbalance on the last row's free side, or
    // on a new row when the last row already has both sides filled.
    const autoBalance = () => {
      const { difference } = totals
      if (difference === 0) return
      const rows = [...(form.accounts ?? [])]
      const last = rows[rows.length - 1]
      const amount = Math.abs(difference)
      const needsCredit = difference > 0
      if (last && last.account && (needsCredit ? last.credit === 0 : last.debit === 0)) {
        rows[rows.length - 1] =
          needsCredit
            ? { ...last, credit: amount }
            : { ...last, debit: amount }
      } else {
        const defaults = createEmptyAccountRow()
        defaults.cost_center = last?.cost_center || "Main - BE"
        defaults.account_currency = last?.account_currency || "CAD"
        defaults.exchange_rate = last?.exchange_rate || 1
        rows.push(needsCredit ? { ...defaults, credit: amount } : { ...defaults, debit: amount })
      }
      update({ accounts: rows })
    }

    const accountColumns: GridColumn<JournalEntryAccountFormRow>[] = [
      {
        key: "account",
        label: "Account",
        type: "link",
        docType: "Account",
        searchFn: async (q) => {
          const results = await journalEntryService.searchLink("Account", q).catch(() => [])
          return {
            items: results.map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })),
          }
        },
        onSelect: () => undefined,
        placeholder: "Search account…",
      },
      {
        key: "party_type",
        label: "Party Type",
        type: "link",
        options: PARTY_TYPES,
        placeholder: "Select…",
      },
      { key: "party", label: "Party", type: "text", placeholder: "Party…" },
      {
        key: "account_currency",
        label: "Currency",
        type: "readonly",
        formatter: (row) => <span className="text-xs text-body">{row.account_currency || "CAD"}</span>,
      },
      {
        key: "exchange_rate",
        label: "Exchange Rate",
        type: "number",
        formatter: (row) => String(row.exchange_rate ?? 1),
      },
      {
        key: "debit",
        label: `Debit (${form.company || "CAD"})`,
        type: "number",
        align: "right",
        prefix: "$",
        formatter: (row) => formatCurrency(row.debit ?? 0),
      },
      {
        key: "credit",
        label: `Credit (${form.company || "CAD"})`,
        type: "number",
        align: "right",
        prefix: "$",
        formatter: (row) => formatCurrency(row.credit ?? 0),
      },
      {
        key: "cost_center",
        label: "Cost Center",
        type: "link",
        options: costCenterOptions,
        placeholder: "Select…",
      },
      {
        key: "project",
        label: "Project",
        type: "text",
        placeholder: "Project…",
      },
    ]

    const { locked: headerLocked } = useDocstatusLock({
      docstatus: initialData?.docstatus,
      mode,
    })

    const handleSave = async (action: "Save" | "Submit" = "Save"): Promise<string | undefined> => {
      const rows = (form.accounts ?? []).filter((r) => (r.account || "").trim() !== "")
      if (rows.length === 0) {
        throw new Error("Add at least one account line before saving.")
      }
      const emptyAmounts = rows.filter((r) => (Number(r.debit) || 0) === 0 && (Number(r.credit) || 0) === 0)
      if (emptyAmounts.length > 0) {
        throw new Error(`Account row "${emptyAmounts[0].account}" needs a Debit or Credit amount.`)
      }
      const hasAmount = rows.some((r) => Number(r.debit) > 0 || Number(r.credit) > 0)
      if (!hasAmount) {
        throw new Error("Enter a Debit or Credit amount before saving.")
      }
      if (Math.abs(totals.difference) > 0.001) {
        throw new Error(
          `Journal Entry is not balanced. Total Debit (${formatCurrency(totals.total_debit)}) must equal Total Credit (${formatCurrency(totals.total_credit)}). Difference: ${formatCurrency(totals.difference)}`,
        )
      }
      const userRemark = String(form.user_remark ?? "").trim()
      const doc: Record<string, unknown> = {
        doctype: JOURNAL_ENTRY_DOCTYPE,
        title: userRemark || `Journal Entry - ${form.posting_date || todayISO()}`,
        naming_series: form.naming_series || DEFAULT_SERIES,
        voucher_type: form.voucher_type || "Journal Entry",
        posting_date: form.posting_date || todayISO(),
        posting_time: "00:00:00",
        company: form.company || DEFAULT_COMPANY,
        finance_book: form.finance_book,
        bill_no: form.bill_no,
        is_opening: form.is_opening,
        multi_currency: form.multi_currency,
        user_remark: userRemark,
        remark: userRemark,
        accounts: rows.map(({ key: _k, ...r }) => ({
          doctype: "Journal Entry Account",
          parentfield: "accounts",
          parenttype: JOURNAL_ENTRY_DOCTYPE,
          account: r.account,
          party_type: r.party_type,
          party: r.party,
          account_currency: r.account_currency || "CAD",
          exchange_rate: Number(r.exchange_rate) || 1,
          debit_in_account_currency: Number(r.debit) || 0,
          credit_in_account_currency: Number(r.credit) || 0,
          cost_center: r.cost_center,
          project: r.project,
        })),
        total_debit: totals.total_debit,
        total_credit: totals.total_credit,
        difference: totals.difference,
      }
      if (mode === "edit" && initialData?.name) {
        doc.name = initialData.name
      } else {
        doc.__islocal = 1
        doc.name = ""
      }
      let saved: JournalEntryDoc | null = null
      try {
        saved = await journalEntryService.saveAs(doc, action)
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to save journal entry.")
      }
      const baselineNext = { ...form, name: saved?.name }
      baselineRef.current = baselineNext
      setBaseline(baselineNext)
      onSaved?.(saved, action)
      return saved?.name
    }

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty,
    }))

    return (
      <div className="space-y-6">
        {/* Section 1: Header */}
        <div className="pb-4 border-b border-border">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Voucher Type *</label>
                {headerLocked ? (
                  <input type="text" value={form.voucher_type || "Journal Entry"} readOnly className={`${inputClass} bg-gray-50`} />
                ) : (
                  <Combobox
                    name="voucher_type"
                    value={form.voucher_type || "Journal Entry"}
                    options={voucherOptions}
                    onChange={(_n, v) => update({ voucher_type: v })}
                    load={voucherTypes.ensure}
                    loading={voucherTypes.loading}
                    placeholder="Select type…"
                  />
                )}
              </div>
              {mode === "create" ? (
                <div>
                  <label className={labelClass}>Series *</label>
                  <select
                    value={form.naming_series || DEFAULT_SERIES}
                    onChange={(e) => update({ naming_series: e.target.value })}
                    className={inputClass}
                    data-testid="je-naming-series"
                  >
                    <option value={DEFAULT_SERIES}>{DEFAULT_SERIES}</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className={labelClass}>Series</label>
                  <input type="text" value={form.naming_series || DEFAULT_SERIES} readOnly className={`${inputClass} bg-gray-50`} />
                </div>
              )}
              <div>
                <label className={labelClass}>Company *</label>
                {headerLocked ? (
                  <input type="text" value={form.company || DEFAULT_COMPANY} readOnly className={`${inputClass} bg-gray-50`} />
                ) : (
                  <Combobox
                    name="company"
                    value={form.company || DEFAULT_COMPANY}
                    options={companyOptions}
                    onChange={(_n, v) => update({ company: v })}
                    load={companies.ensure}
                    loading={companies.loading}
                  />
                )}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Posting Date *</label>
                <DateInput
                  value={form.posting_date || todayISO()}
                  onChange={(e) => update({ posting_date: e.target.value })}
                  readOnly={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Reference Number</label>
                <Input
                  value={form.bill_no ?? ""}
                  onChange={(e) => update({ bill_no: e.target.value })}
                  placeholder="Bill / reference no…"
                  readOnly={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Finance Book</label>
                <Input
                  value={form.finance_book ?? ""}
                  onChange={(e) => update({ finance_book: e.target.value })}
                  placeholder="e.g. Main - BE"
                  readOnly={headerLocked}
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Journal Title</label>
                <Input
                  value={form.user_remark ?? ""}
                  onChange={(e) => update({ user_remark: e.target.value })}
                  placeholder="Auto-generated from remark…"
                  readOnly={headerLocked}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-body cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={form.is_opening === 1}
                  onChange={(e) => update({ is_opening: e.target.checked ? 1 : 0 })}
                  disabled={headerLocked}
                  className="accent-primary-600"
                />
                Is Opening
              </label>
              <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.multi_currency === 1}
                  onChange={(e) => update({ multi_currency: e.target.checked ? 1 : 0 })}
                  disabled={headerLocked}
                  className="accent-primary-600"
                />
                Multi-Currency
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Accounts */}
        <div className="space-y-3 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-heading">Accounts</h3>
          <ChildTableGrid<JournalEntryAccountFormRow>
            title="Accounts"
            description="Click a row to edit its fields. ERPNext auto-balances when Debit and Credit totals match."
            rows={form.accounts ?? []}
            columns={accountColumns}
            emptyRow={createEmptyAccountRow(form.accounts?.[0]?.cost_center || "Main - BE")}
            onChange={handleAccountsChange}
            readOnly={headerLocked}
            canAdd={!headerLocked}
            minWidth="1080px"
            noTopBorder
            testId="je-accounts"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={headerLocked}
              onClick={autoBalance}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + Auto-Balance
            </button>
            <span className="text-xs text-muted">
              Enter Debits and Credits per line; Auto-Balance tops up the opposite side to balance the entry.
            </span>
          </div>
        </div>

        {/* Section 3: Totals */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-heading">Totals</h3>
          <div className="lg:w-1/2 lg:ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Debit ({form.company || DEFAULT_COMPANY})</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totals.total_debit)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Credit ({form.company || DEFAULT_COMPANY})</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totals.total_credit)}</span>
            </div>
            <div className={cn("flex justify-between pt-2 border-t border-border text-sm")}>
              <span className="font-bold text-heading">Difference</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  Math.abs(totals.difference) > 0.001 ? "text-danger-600" : "text-success-600",
                )}
              >
                {formatCurrency(totals.difference)}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  },
)

// Doc → form model (moves the child-table rows into the sampler shape and
// strips server-managed fields the form does not edit).
function fromDoc(doc: JournalEntryDoc): JournalEntryFormData {
  const raw = doc as unknown as Record<string, unknown>
  const accounts = Array.isArray(doc.accounts) ? (doc.accounts as unknown as Record<string, unknown>[]) : []
  const rows: JournalEntryAccountFormRow[] = (accounts.length > 0 ? accounts : []).map((a) => ({
    key: String(a.name ?? newKey()),
    account: String(a.account ?? ""),
    party_type: String(a.party_type ?? ""),
    party: String(a.party ?? ""),
    account_currency: String(a.account_currency ?? "CAD"),
    exchange_rate: Number(a.exchange_rate) || 1,
    debit: Number(a.debit_in_account_currency ?? a.debit ?? 0) || 0,
    credit: Number(a.credit_in_account_currency ?? a.credit ?? 0) || 0,
    cost_center: String(a.cost_center ?? ""),
    project: String(a.project ?? ""),
  }))
  if (rows.length === 0) rows.push(createEmptyAccountRow())
  return {
    doctype: JOURNAL_ENTRY_DOCTYPE,
    name: doc.name,
    naming_series: String(doc.naming_series ?? DEFAULT_SERIES),
    voucher_type: String(doc.voucher_type ?? "Journal Entry"),
    posting_date: String(doc.posting_date ?? todayISO()),
    company: String(doc.company ?? DEFAULT_COMPANY),
    finance_book: String(raw.finance_book ?? ""),
    bill_no: String(doc.bill_no ?? ""),
    is_opening: Number(raw.is_opening) === 1 ? 1 : 0,
    multi_currency: Number(raw.multi_currency) === 1 ? 1 : 0,
    remark: String(doc.remark ?? ""),
    user_remark: String(doc.user_remark ?? ""),
    title: String(doc.title ?? ""),
    accounts: rows,
    total_debit: Number(doc.total_debit) || 0,
    total_credit: Number(doc.total_credit) || 0,
    difference: Number(doc.difference) || 0,
    docstatus: Number(doc.docstatus) || 0,
  }
}