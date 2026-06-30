"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui"
import { expenseService, type ExpenseFormData } from "@/services"
import { EXPENSE_CATEGORIES } from "@/config/tax.config"

interface NewExpenseForm extends ExpenseFormData {
  status: "paid" | "unpaid"
}

export default function ExpenseForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState<NewExpenseForm>({
    description: "",
    category: "Office Supplies",
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: "credit_card",
    supplier: "",
    notes: "",
    status: "unpaid",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.description.trim() || form.amount <= 0) {
      setError("Description and a valid amount are required.")
      return
    }
    setSaving(true)
    try {
      const { status: _, ...expenseData } = form
      await expenseService.create(expenseData)
      navigate("/expenses")
    } catch {
      setError("Failed to save expense. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

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
            <h1 className="text-2xl font-bold text-heading">New Expense</h1>
            <p className="text-sm text-muted mt-0.5">Record a new business expense.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate("/expenses")}>Cancel</Button>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="description" className={labelClass}>Description *</label>
            <input id="description" name="description" value={form.description} onChange={handleChange} className={inputClass} placeholder="Office supplies for Q3" />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>Category</label>
            <select id="category" name="category" value={form.category} onChange={handleChange} className={inputClass}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="amount" className={labelClass}>Amount *</label>
            <input id="amount" name="amount" type="number" min={0} step={0.01} value={form.amount} onChange={handleChange} className={inputClass} placeholder="0.00" />
          </div>
          <div>
            <label htmlFor="date" className={labelClass}>Date</label>
            <input id="date" name="date" type="date" value={form.date} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label htmlFor="paymentMethod" className={labelClass}>Payment Method</label>
            <select id="paymentMethod" name="paymentMethod" value={form.paymentMethod} onChange={handleChange} className={inputClass}>
              <option value="credit_card">Credit Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" value={form.status} onChange={handleChange} className={inputClass}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label htmlFor="supplier" className={labelClass}>Supplier</label>
            <input id="supplier" name="supplier" value={form.supplier} onChange={handleChange} className={inputClass} placeholder="Vendor name" />
          </div>
          <div className="col-span-2">
            <label htmlFor="notes" className={labelClass}>Notes</label>
            <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={2} className={inputClass} placeholder="Optional notes..." />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button type="button" onClick={() => navigate("/expenses")}
            className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Create Expense"}
          </button>
        </div>
      </form>
    </>
  )
}
