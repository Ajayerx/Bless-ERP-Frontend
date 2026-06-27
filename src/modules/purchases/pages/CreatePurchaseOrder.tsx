"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Plus, Trash2, Save, Search, ChevronDown } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { purchaseOrderService } from "@/services"
import type { Product } from "@/services/invoices.service"
import { formatCurrency } from "@/lib/utils"

interface LineItemForm {
  id: string
  productId: string
  productName: string
  sku: string
  quantity: number
  price: number
  taxRate: number
  taxLabel: string
  total: number
}

const GST_RATE = 0.05
const QST_RATE = 0.09975

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100
}

function createEmptyLine(): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    sku: "",
    quantity: 1,
    price: 0,
    taxRate: GST_RATE,
    taxLabel: "GST",
    total: 0,
  }
}

export default function CreatePurchaseOrder() {
  const navigate = useNavigate()

  const [vendorId, setVendorId] = useState("")
  const [vendorName, setVendorName] = useState("")
  const [vendorContact, setVendorContact] = useState("")
  const [billTo, setBillTo] = useState("")
  const [shippingAddress, setShippingAddress] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 14); return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [vendors, setVendors] = useState<Array<{ id: string; name: string; contactName: string; billingAddress: string; shippingAddress: string }>>([])
  const [vendorSearch, setVendorSearch] = useState("")
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productDropdowns, setProductDropdowns] = useState<Record<string, { open: boolean; search: string }>>({})

  useEffect(() => {
    fetch("/api/customers").then(r => r.json()).then((body) => {
      const items = body.data?.items ?? body.data ?? []
      const vendorList = items.map((c: any) => ({
        id: c.id, name: c.name, contactName: c.contactName,
        billingAddress: c.billingAddress, shippingAddress: c.shippingAddress,
      }))
      setVendors(vendorList)
    })
    fetch("/api/products").then(r => r.json()).then((body) => setProducts(body.data))
  }, [])

  const filteredVendors = vendors.filter(
    (v) => v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
      v.contactName.toLowerCase().includes(vendorSearch.toLowerCase())
  )

  const selectVendor = (v: typeof vendors[number]) => {
    setVendorId(v.id); setVendorName(v.name); setVendorContact(v.contactName)
    setBillTo(v.billingAddress); setShippingAddress(v.shippingAddress)
    setVendorSearch(v.name); setVendorDropdownOpen(false)
  }

  const addLine = () => setLineItems((prev) => [...prev, createEmptyLine()])
  const removeLine = (id: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))

  const updateLine = (id: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...updates }
        next.total = calcTotal(next.quantity, next.price)
        return next
      })
    )

  const selectProduct = (lineId: string, product: Product) => {
    updateLine(lineId, { productId: product.id, productName: product.name, sku: product.sku, price: product.price })
    setProductDropdowns((prev) => ({ ...prev, [lineId]: { open: false, search: "" } }))
  }

  const filteredProducts = useCallback(
    (search: string) => products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())),
    [products]
  )

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0)
  const gstTotal = lineItems.filter((l) => l.taxLabel === "GST").reduce((sum, l) => sum + l.total, 0)
  const qstTotal = lineItems.filter((l) => l.taxLabel === "QST").reduce((sum, l) => sum + l.total, 0)
  const gstAmount = Math.round(gstTotal * GST_RATE * 100) / 100
  const qstAmount = Math.round(qstTotal * QST_RATE * 100) / 100
  const grandTotal = Math.round((subtotal + gstAmount + qstAmount) * 100) / 100

  const handleSave = async () => {
    if (!vendorId) return
    setSaving(true)
    try {
      await purchaseOrderService.create({
        vendorId, vendorName, vendorContact, billTo, shippingAddress, issueDate, deliveryDate, notes,
        lineItems: lineItems.map(({ id: _id, ...rest }) => rest),
        subtotal, gst: gstAmount, qst: qstAmount, total: grandTotal,
      })
      navigate("/purchases/orders")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/purchases/orders")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Purchase Order</h1>
              <p className="text-sm text-muted mt-0.5">Create a new purchase order for a vendor.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/purchases/orders")}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !vendorId} loading={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Save Purchase Order"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <input type="text" value={vendorSearch}
                  onChange={(e) => { setVendorSearch(e.target.value); setVendorDropdownOpen(true) }}
                  onFocus={() => setVendorDropdownOpen(true)}
                  placeholder="Search vendor..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
                {vendorDropdownOpen && (
                  <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                    {filteredVendors.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-muted">No vendors found</p>
                    ) : (
                      filteredVendors.map((v) => (
                        <button key={v.id} type="button" onClick={() => selectVendor(v)}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors text-body hover:bg-gray-50">
                          <span className="font-medium">{v.name}</span>
                          <span className="text-xs text-muted ml-2">{v.contactName}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {vendorName && (
                <>
                  <div>
                    <label className={labelClass}>Bill To</label>
                    <textarea value={billTo} onChange={(e) => setBillTo(e.target.value)} rows={2} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Shipping Address</label>
                    <textarea value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} className={inputClass} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Order Date</label>
                  <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Delivery Date</label>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} placeholder="Optional notes..." />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[30%]">Product</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">SKU</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">Qty</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Price</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">Tax</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Total</th>
                  <th className="px-3 py-3 w-[7%]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {lineItems.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-2.5">
                      <div className="relative">
                        <input type="text" value={line.productName}
                          onChange={(e) => {
                            updateLine(line.id, { productName: e.target.value, productId: "", sku: "" })
                            setProductDropdowns(prev => ({ ...prev, [line.id]: { open: true, search: e.target.value } }))
                          }}
                          onFocus={() => setProductDropdowns(prev => ({ ...prev, [line.id]: { open: true, search: line.productName } }))}
                          placeholder="Search product..."
                          className="w-full px-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all" />
                        {productDropdowns[line.id]?.open && (
                          <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-[12px] shadow-xl max-h-40 overflow-y-auto">
                            {filteredProducts(productDropdowns[line.id]?.search ?? "").map((p) => (
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
                    <td className="px-3 py-2.5"><span className="text-sm text-muted">{line.sku}</span></td>
                    <td className="px-3 py-2.5">
                      <input type="number" min={1} value={line.quantity}
                        onChange={(e) => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-16 px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="number" min={0} step={0.01} value={line.price}
                        onChange={(e) => updateLine(line.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
                        className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <select value={`${line.taxRate}`}
                        onChange={(e) => {
                          const rate = parseFloat(e.target.value)
                          updateLine(line.id, { taxRate: rate, taxLabel: rate === GST_RATE ? "GST" : "QST" })
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white">
                        <option value={GST_RATE}>GST 5%</option>
                        <option value={QST_RATE}>QST 9.975%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="text-sm font-semibold tabular-nums text-heading">{formatCurrency(line.total)}</span>
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
      </motion.div>
    </>
  )
}
