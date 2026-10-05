"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Send } from "lucide-react"
import { Button } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { expenseService, type Expense, type ExpenseFormData } from "@/services"
import { formatCurrency, todayISO } from "@/lib/utils"

interface ExpenseFormProps {
  expense?: Expense
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

const EXPENSE_ACCOUNT_FILTERS: unknown[][] = [
  ["root_type", "=", "Expense"],
  ["is_group", "=", 0],
]
const PAID_FROM_FILTERS: unknown[][] = [
  ["root_type", "=", "Asset"],
  ["is_group", "=", 0],
]

export default function ExpenseForm({ expense }: ExpenseFormProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<ExpenseFormData>({
    postingDate: todayISO(),
    company: "",
    remark: "",
    expenseAccount: "",
    amount: 0,
    costCenter: "",
    project: "",
    supplier: "",
    paidFrom: "",
  })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState<false | "save" | "submit">(false)
  const [error, setError] = useState("")
  const editing = expense ? expense.name : null
  // Submitted/cancelled entries are locked (mirrors ERPNext docstatus): only
  // drafts are editable. The edit page also gates this, but the form defends
  // itself so a submitted doc can never be re-saved through this component.
  const locked = !!editing && (expense?.docstatus ?? 0) !== 0

  useEffect(() => {
    if (expense) {
      const debitLine = expense.lines.find((l) => l.debit > 0) ?? expense.lines[0]
      const creditLine = expense.lines.find((l) => l.credit > 0) ?? expense.lines[1]
      setForm({
        postingDate: expense.postingDate || todayISO(),
        company: expense.company,
        remark: expense.remark,
        expenseAccount: expense.expenseAccount || debitLine?.account || "",
        amount: expense.amount || debitLine?.debit || 0,
        costCenter: debitLine?.costCenter || "",
        project: debitLine?.project || "",
        supplier: expense.supplier || debitLine?.party || "",
        paidFrom: expense.paidFrom || creditLine?.account || "",
      })
      return
    }
    let cancelled = false
    expenseService.getDefaults()
      .then((d) => {
        if (cancelled) return
        setForm((prev) => ({
          ...prev,
          company: d.company,
          expenseAccount: d.defaultExpenseAccount || prev.expenseAccount,
          paidFrom: d.defaultPaidFrom || prev.paidFrom,
          costCenter: d.defaultCostCenter || prev.costCenter,
        }))
      })
      .catch(() => null)
    return () => { cancelled = true }
  }, [expense])

  const updateField = (name: keyof ExpenseFormData, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [name]: name === "amount" ? Number(value) || 0 : value,
    }))
    setDirty(true)
  }

  const accountSearch = (filters: unknown[][]) => async (q: string) => {
    const results = await expenseService.searchLink("Account", q, filters).catch(() => [])
    return { items: results.map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })) }
  }

  const supplierSearch = async (q: string) => {
    const results = await expenseService.searchLink("Supplier", q).catch(() => [])
    return { items: results.map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })) }
  }

  const amount = Number(form.amount) || 0
  const hasRemark = form.remark.trim().length > 0
  const balanced =
    amount > 0 &&
    form.expenseAccount.trim().length > 0 &&
    form.paidFrom.trim().length > 0
  const difference = balanced ? 0 : amount

  const persist = async (action: "save" | "submit") => {
    if (locked) {
      setError("Only draft expenses can be edited.")
      return
    }
    setError("")
    if (!hasRemark) {
      setError("Description is required.")
      return
    }
    if (!balanced) {
      setError("Amount, Expense Account and Paid From are required before saving.")
      return
    }
    setSaving(action)
    try {
      if (editing) {
        const updated = await expenseService.update(editing, form)
        if (action === "submit") {
          await expenseService.submit(updated.name)
        }
      } else {
        const doc = await expenseService.create(form)
        if (action === "submit") {
          await expenseService.submit(doc.name)
        }
      }
      navigate("/expenses")
    } catch {
      setError("Failed to save expense. Please try again.")
      setSaving(false)
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/expenses")}
            className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">{editing ? "Edit Expense" : "New Expense"}</h1>
            <p className="text-sm text-muted mt-0.5">Record a new business expense as a Journal Entry.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate("/expenses")}>Cancel</Button>
          <Button variant="secondary" onClick={() => persist("save")} disabled={saving !== false || locked} loading={saving === "save"}>
            <Save size={16} />
            {saving === "save" ? "Saving..." : "Save"}
          </Button>
          <Button onClick={() => persist("submit")} disabled={saving !== false || !balanced || locked} loading={saving === "submit"}>
            <Send size={16} />
            {saving === "submit" ? "Submitting..." : "Save & Submit"}
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); persist("save") }}
        className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4"
      >
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        {!locked && !balanced && (
          <div className="text-xs text-warning-700 bg-warning-50 border border-warning-100 px-3 py-2 rounded-[10px]">
            {amount <= 0
              ? "Enter an amount to balance the entry."
              : form.expenseAccount.trim().length === 0
                ? "Select the Expense Account (debit line)."
                : "Select the Paid From account (credit line)."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="remark" className={labelClass}>Description *</label>
            <input
              id="remark" name="remark" value={form.remark} onChange={(e) => updateField("remark", e.target.value)}
              className={inputClass} placeholder="Office supplies for Q3" readOnly={locked}
            />
          </div>
          <div>
            <label htmlFor="postingDate" className={labelClass}>Posting Date</label>
            <input id="postingDate" name="postingDate" type="date" value={form.postingDate} onChange={(e) => updateField("postingDate", e.target.value)} className={inputClass} readOnly={locked} />
          </div>
          <div>
            <label htmlFor="company" className={labelClass}>Company</label>
            {form.company ? (
              <input id="company" name="company" value={form.company} readOnly className={inputClass} />
            ) : (
              <input id="company" className={inputClass} placeholder="Loading active company..." disabled />
            )}
          </div>
          <div>
            <LinkSearchField
              id="expenseAccount"
              label="Expense Account *"
              value={form.expenseAccount}
              onChange={(v) => updateField("expenseAccount", v ?? "")}
              searchFn={accountSearch(EXPENSE_ACCOUNT_FILTERS)}
              validate={async (v) => {
                if (v) await expenseService.validateLink("Account", v)
              }}
              docType="Account"
              placeholder="Select account..."
              readOnly={locked}
            />
          </div>
          <div>
            <LinkSearchField
              id="paidFrom"
              label="Paid From (credit) *"
              value={form.paidFrom}
              onChange={(v) => updateField("paidFrom", v ?? "")}
              searchFn={accountSearch(PAID_FROM_FILTERS)}
              validate={async (v) => {
                if (v) await expenseService.validateLink("Account", v)
              }}
              docType="Account"
              placeholder="Select account..."
              readOnly={locked}
            />
          </div>
          <div>
            <label htmlFor="amount" className={labelClass}>Amount *</label>
            <input id="amount" name="amount" type="number" min={0} step={0.01} value={form.amount} onChange={(e) => updateField("amount", e.target.value)} className={inputClass} placeholder="0.00" readOnly={locked} />
          </div>
          <div>
            <label htmlFor="costCenter" className={labelClass}>Cost Center</label>
            <input id="costCenter" name="costCenter" value={form.costCenter ?? ""} onChange={(e) => updateField("costCenter", e.target.value)} className={inputClass} placeholder="Main - BE" readOnly={locked} />
          </div>
          <div>
            <label htmlFor="project" className={labelClass}>Project</label>
            <input id="project" name="project" value={form.project ?? ""} onChange={(e) => updateField("project", e.target.value)} className={inputClass} placeholder="Optional project..." readOnly={locked} />
          </div>
          <div>
            <LinkSearchField
              id="supplier"
              label="Supplier"
              value={form.supplier ?? ""}
              onChange={(v) => updateField("supplier", v ?? "")}
              searchFn={supplierSearch}
              validate={async (v) => {
                if (v) await expenseService.validateLink("Supplier", v)
              }}
              docType="Supplier"
              placeholder="Optional supplier..."
              readOnly={locked}
            />
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-[12px] bg-gray-50 border border-border px-4 py-3">
          <div className="text-center flex-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Debit (Expense)</p>
            <p className="text-lg font-bold text-heading tabular-nums">{formatCurrency(amount)}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Credit (Paid From)</p>
            <p className="text-lg font-bold text-heading tabular-nums">{formatCurrency(amount)}</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Difference</p>
            <p className={`text-lg font-bold tabular-nums ${balanced ? "text-success-600" : "text-danger-600"}`}>{formatCurrency(difference)}</p>
          </div>
        </div>
        {dirty && !locked && <p className="text-xs text-muted">Edit a draft expense later, or submit now to post it to the general ledger.</p>}
      </form>
    </>
  )
}