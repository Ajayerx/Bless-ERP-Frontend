"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { invoiceService, customerService, type Customer, type Invoice } from "@/services"
import InvoiceForm from "@/modules/invoices/InvoiceForm"
import InvoiceLineItems from "@/modules/invoices/InvoiceLineItems"
import InvoiceTotals from "@/modules/invoices/InvoiceTotals"

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

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100
}

const GST_RATE = 0.05
const QST_RATE = 0.09975

export default function EditInvoice() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string; price: number }[]>([])
  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [billTo, setBillTo] = useState("")
  const [issueDate, setIssueDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [lineItems, setLineItems] = useState<LineItemForm[]>([])
  const [saving, setSaving] = useState(false)
  const [productDropdowns, setProductDropdowns] = useState<Record<string, { open: boolean; search: string }>>({})

  useEffect(() => {
    if (!id) return
    Promise.all([
      invoiceService.getById(id),
      customerService.list({ pageSize: 100 }),
      invoiceService.getProducts(),
    ]).then(([inv, custRes, prods]) => {
      setInvoice(inv)
      setCustomers(custRes.items)
      setProducts(prods)
      setCustomerId(inv.customerId)
      setCustomerName(inv.customerName)
      setBillTo(inv.billTo ?? "")
      setIssueDate(inv.issueDate)
      setDueDate(inv.dueDate)
      setLineItems(
        inv.lineItems.map((li: { productId: string; productName: string; sku: string; quantity: number; price: number; taxRate: number; taxLabel: string; total: number }) => ({
          id: crypto.randomUUID(),
          productId: li.productId,
          productName: li.productName,
          sku: li.sku ?? "",
          quantity: li.quantity,
          price: li.price,
          taxRate: li.taxRate ?? GST_RATE,
          taxLabel: li.taxLabel ?? "GST",
          total: li.total ?? calcTotal(li.quantity, li.price),
        }))
      )
    }).catch(() => null).finally(() => setLoading(false))
  }, [id])

  const addLine = () => {
    const newLine: LineItemForm = {
      id: crypto.randomUUID(),
      productId: "", productName: "", sku: "",
      quantity: 1, price: 0,
      taxRate: GST_RATE, taxLabel: "GST", total: 0,
    }
    setLineItems((prev) => [...prev, newLine])
  }

  const removeLine = (lineId: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev))

  const updateLine = (lineId: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const next = { ...l, ...updates }
        next.total = calcTotal(next.quantity, next.price)
        return next
      })
    )

  const selectProduct = (lineId: string, product: { id: string; name: string; sku: string; price: number }) => {
    updateLine(lineId, { productId: product.id, productName: product.name, sku: product.sku, price: product.price })
    setProductDropdowns((prev) => ({ ...prev, [lineId]: { open: false, search: "" } }))
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0)
  const gstTotal = lineItems.filter((l) => l.taxLabel === "GST").reduce((sum, l) => sum + l.total, 0)
  const qstTotal = lineItems.filter((l) => l.taxLabel === "QST").reduce((sum, l) => sum + l.total, 0)
  const gstAmount = Math.round(gstTotal * GST_RATE * 100) / 100
  const qstAmount = Math.round(qstTotal * QST_RATE * 100) / 100
  const grandTotal = Math.round((subtotal + gstAmount + qstAmount) * 100) / 100

  const handleSave = async () => {
    if (!id || !customerId) return
    setSaving(true)
    try {
      await invoiceService.update(id, {
        customerId, customerName, billTo, issueDate, dueDate,
        lineItems: lineItems.map(({ id: _, ...rest }) => rest),
        subtotal, gst: gstAmount, qst: qstAmount, total: grandTotal,
      })
      navigate(`/invoices/${id}`)
    } catch {
      alert("Failed to save invoice. Please try again.")
    } finally { setSaving(false) }
  }

  const formData = { customerId, customerName, billTo, issueDate, dueDate }
  const handleFormChange = (data: Partial<typeof formData>) => {
    if (data.customerId !== undefined) setCustomerId(data.customerId)
    if (data.customerName !== undefined) setCustomerName(data.customerName)
    if (data.billTo !== undefined) setBillTo(data.billTo)
    if (data.issueDate !== undefined) setIssueDate(data.issueDate)
    if (data.dueDate !== undefined) setDueDate(data.dueDate)
  }

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6 max-w-5xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/invoices/${id}`)} className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Edit Invoice</h1>
              <p className="text-sm text-muted mt-0.5">{invoice?.number ?? "Loading..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate(`/invoices/${id}`)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !customerId}>
              <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <InvoiceForm customers={customers} formData={formData} onChange={handleFormChange} />
            <InvoiceLineItems
              items={lineItems} products={products} productDropdowns={productDropdowns}
              onUpdate={updateLine} onRemove={removeLine} onAdd={addLine}
              onProductDropdownChange={(lid, dd) => setProductDropdowns((prev) => ({ ...prev, [lid]: dd }))}
              onSelectProduct={selectProduct}
            />
            <div className="flex justify-end">
              <InvoiceTotals subtotal={subtotal} gst={gstAmount} qst={qstAmount} total={grandTotal} />
            </div>
          </>
        )}
      </motion.div>
    </>
  )
}
