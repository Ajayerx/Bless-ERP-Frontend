"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { accountingService } from "@/services"
import { getDefaultTaxTemplate } from "@/services/tax-template"
import type { TaxRow } from "@/services/tax-template"
import { formatCurrency } from "@/lib/utils"

const categories = [
  "Office Supplies", "Software & IT", "Utilities", "Rent",
  "Professional Services", "Shipping & Delivery", "Travel",
  "Meals & Entertainment", "Insurance", "Other",
]

const paymentMethods = ["Bank Transfer", "Credit Card", "Cash", "Cheque", "Debit Card"]

const PURCHASE_DOCTYPE = "Purchase Taxes and Charges Template"

export default function CreateExpense() {
  const navigate = useNavigate()
  const [vendorName, setVendorName] = useState("")
  const [category, setCategory] = useState(categories[0])
  const [amount, setAmount] = useState("")
  const [taxType, setTaxType] = useState("none")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0])
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [taxRows, setTaxRows] = useState<TaxRow[]>([])
  const [templateLoading, setTemplateLoading] = useState(true)

  useEffect(() => {
    getDefaultTaxTemplate(PURCHASE_DOCTYPE).then((template) => {
      if (template) setTaxRows(template.rows)
    }).finally(() => setTemplateLoading(false))
  }, [])

  const parsedAmount = parseFloat(amount) || 0
  const selectedTaxRow = taxRows.find((r) => r.accountHead === taxType)
  const taxRate = selectedTaxRow?.rate ?? 0
  const taxAmount = taxRate > 0 ? Math.round(parsedAmount * taxRate * 100) / 100 : 0
  const total = Math.round((parsedAmount + taxAmount) * 100) / 100

  const handleSave = async () => {
    if (!vendorName || !amount) return
    setSaving(true)
    try {
      await accountingService.createExpense({
        vendorName, category, amount: parsedAmount, taxAmount, total,
        description, date, paymentMethod, notes,
      })
      navigate("/accounting/expenses")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6 max-w-3xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/accounting/expenses")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Add Expense</h1>
              <p className="text-sm text-muted mt-0.5">Record a new business expense.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/accounting/expenses")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !vendorName || !amount || templateLoading} loading={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save Expense"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Vendor Name</label>
                <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Vendor name" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Payment Method</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}>
                  {paymentMethods.map((pm) => <option key={pm} value={pm}>{pm}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>Amount ($)</label>
                <input type="number" min={0} step={0.01} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Tax</label>
                <select value={taxType} onChange={(e) => setTaxType(e.target.value)} className={inputClass}>
                  {taxRows.map((r) => {
                    const label = r.description ?? r.accountHead
                    return <option key={r.accountHead} value={r.accountHead}>{label}</option>
                  })}
                  <option value="none">No Tax</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Total</label>
                <div className="h-[42px] flex items-center px-3 bg-gray-50 border border-border rounded-[12px] text-sm font-bold text-heading tabular-nums">
                  {formatCurrency(total)}
                </div>
              </div>
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Optional notes..." />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
