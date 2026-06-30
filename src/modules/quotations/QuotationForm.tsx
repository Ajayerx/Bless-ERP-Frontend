"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronDown, Loader2 } from "lucide-react"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { quotationService, customerService, type Customer, productService } from "@/services"
import type { Product } from "@/services/products.service"
import { formatCurrency } from "@/lib/utils"
import { GST_RATE, QST_RATE } from "@/config/tax.config"

interface LineItemForm {
  id: string
  productId: string
  productName: string
  qty: number
  rate: number
  amount: number
}

function createEmptyLine(): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    qty: 1,
    rate: 0,
    amount: 0,
  }
}

export default function QuotationForm() {
  const navigate = useNavigate()

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productDropdowns, setProductDropdowns] = useState<Record<string, { open: boolean; search: string }>>({})

  useEffect(() => {
    customerService.list({ pageSize: 100 }).then((res) => setCustomers(res.items))
    productService.list({ pageSize: 100 }).then((res) => setProducts(res.items))
  }, [])

  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.contactName.toLowerCase().includes(customerSearch.toLowerCase())
  )

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id)
    setCustomerName(c.name)
    setCustomerSearch(c.name)
    setCustomerDropdownOpen(false)
  }

  const addLine = () => setLineItems((prev) => [...prev, createEmptyLine()])

  const removeLine = (id: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))

  const updateLine = (id: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...updates }
        next.amount = Math.round(next.qty * next.rate * 100) / 100
        return next
      })
    )

  const selectProduct = (lineId: string, product: Product) => {
    updateLine(lineId, { productId: product.id, productName: product.name, rate: product.price })
    setProductDropdowns((prev) => ({ ...prev, [lineId]: { open: false, search: "" } }))
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.amount, 0)
  const gstAmount = Math.round(subtotal * GST_RATE * 100) / 100
  const qstAmount = Math.round(subtotal * QST_RATE * 100) / 100
  const grandTotal = Math.round((subtotal + gstAmount + qstAmount) * 100) / 100

  const handleSave = async () => {
    if (!customerId) return
    setSaving(true)
    try {
      await quotationService.create({
        customerId, customerName, issueDate, validUntil, notes,
        items: lineItems.map(({ id, ...rest }) => rest),
        subtotal, gst: gstAmount, qst: qstAmount, total: grandTotal,
      })
      navigate("/quotations")
    } finally { setSaving(false) }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/quotations")}
            className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">New Quotation</h1>
            <p className="text-sm text-muted mt-0.5">Create a new customer quotation.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => navigate("/quotations")}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !customerId}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save Quotation"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <input type="text" value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true) }}
                onFocus={() => setCustomerDropdownOpen(true)}
                placeholder="Search customer..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
              {customerDropdownOpen && (
                <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">No customers found</p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button key={c.id} type="button" onClick={() => selectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                        style={c.id === customerId ? { backgroundColor: "var(--primary-50)", color: "var(--primary-700)", fontWeight: 600 } : {}}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-xs text-muted ml-2">{c.contactName}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Issue Date</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Valid Until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputClass} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="p-0 overflow-hidden">
        <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[35%]">Product</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[12%]">Qty</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[15%]">Rate</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[15%]">Amount</th>
                <th className="px-3 py-3 w-[8%]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {lineItems.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-6 py-2.5">
                    <div className="relative">
                      <input type="text" value={line.productName}
                        onChange={(e) => {
                          updateLine(line.id, { productName: e.target.value, productId: "" })
                          setProductDropdowns(prev => ({ ...prev, [line.id]: { open: true, search: e.target.value } }))
                        }}
                        onFocus={() => setProductDropdowns(prev => ({ ...prev, [line.id]: { open: true, search: line.productName } }))}
                        placeholder="Search product..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      />
                      {productDropdowns[line.id]?.open && (
                        <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-[12px] shadow-xl max-h-40 overflow-y-auto">
                          {products.filter((p) =>
                            p.name.toLowerCase().includes((productDropdowns[line.id]?.search ?? "").toLowerCase()) ||
                            p.sku.toLowerCase().includes((productDropdowns[line.id]?.search ?? "").toLowerCase())
                          ).map((p) => (
                            <button key={p.id} type="button" onClick={() => selectProduct(line.id, p)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-body transition-colors">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-xs text-muted ml-2">{p.sku}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" min={1} value={line.qty}
                      onChange={(e) => updateLine(line.id, { qty: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-20 px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                  </td>
                  <td className="px-3 py-2.5">
                    <input type="number" min={0} step={0.01} value={line.rate}
                      onChange={(e) => updateLine(line.id, { rate: Math.max(0, parseFloat(e.target.value) || 0) })}
                      className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-sm font-semibold tabular-nums text-heading">{formatCurrency(line.amount)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button type="button" onClick={() => removeLine(line.id)} disabled={lineItems.length <= 1}
                      className="p-1.5 rounded-[8px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 border-t border-border">
          <button onClick={addLine} className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            <Plus size={14} /> Add Item
          </button>
        </div>
      </Card>

      <div className="flex justify-end">
        <Card className="w-72">
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Subtotal</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">GST (5%)</span>
              <span className="text-body tabular-nums">{formatCurrency(gstAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">QST (9.975%)</span>
              <span className="text-body tabular-nums">{formatCurrency(qstAmount)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between text-base">
              <span className="font-bold text-heading">Total</span>
              <span className="font-bold text-heading tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
        <CardContent>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Terms, conditions, or special instructions..." />
        </CardContent>
      </Card>
    </>
  )
}
