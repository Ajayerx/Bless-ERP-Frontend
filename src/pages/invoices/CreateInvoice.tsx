"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button } from "@/components/ui"
import { invoiceService, customerService, type Customer, type Product } from "@/services"
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

export default function CreateInvoice() {
  const navigate = useNavigate()

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("")
  const [billTo, setBillTo] = useState("")
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
  })
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productDropdowns, setProductDropdowns] = useState<Record<string, { open: boolean; search: string }>>({})

  useEffect(() => {
    customerService.list({ pageSize: 100 }).then((res) => setCustomers(res.items))
    invoiceService.getProducts().then(setProducts)
  }, [])

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
      }),
    )

  const selectProduct = (lineId: string, product: Product) => {
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
    if (!customerId) return
    setSaving(true)
    try {
      await invoiceService.create({
        customerId,
        customerName,
        billTo,
        issueDate,
        dueDate,
        lineItems: lineItems.map(({ id, ...rest }) => rest),
        subtotal,
        gst: gstAmount,
        qst: qstAmount,
        total: grandTotal,
      })
      navigate("/invoices")
    } finally {
      setSaving(false)
    }
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
      <motion.div
        className="p-6 space-y-6 max-w-5xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/invoices")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Invoice</h1>
              <p className="text-sm text-muted mt-0.5">Create a new sales invoice.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/invoices")}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !customerId} loading={saving}>
              <Save size={16} />
              {saving ? "Saving..." : "Save Invoice"}
            </Button>
          </div>
        </div>

        <InvoiceForm customers={customers} formData={formData} onChange={handleFormChange} />

        <InvoiceLineItems
          items={lineItems}
          products={products}
          productDropdowns={productDropdowns}
          onUpdate={updateLine}
          onRemove={removeLine}
          onAdd={addLine}
          onProductDropdownChange={(id, dropdown) =>
            setProductDropdowns((prev) => ({ ...prev, [id]: dropdown }))
          }
          onSelectProduct={selectProduct}
        />

        <div className="flex justify-end">
          <InvoiceTotals subtotal={subtotal} gst={gstAmount} qst={qstAmount} total={grandTotal} />
        </div>
      </motion.div>
    </>
  )
}
