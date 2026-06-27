"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, Phone, MapPin, CreditCard, FileText, Building2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable from "@/components/ui/DataTable"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Avatar } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { customerService, invoiceService, paymentService, type Customer, type Invoice, type Payment } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const invoiceColumns = [
  { key: "number", header: "Invoice", render: (inv: Invoice) => (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center">
        <FileText size={14} />
      </div>
      <div>
        <p className="font-semibold text-heading text-sm">{inv.number}</p>
        <p className="text-xs text-muted">{formatDate(inv.issueDate)}</p>
      </div>
    </div>
  )},
  { key: "total", header: "Amount", className: "text-right", render: (inv: Invoice) => (
    <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(inv.total)}</span>
  )},
  { key: "status", header: "Status", render: (inv: Invoice) => {
    const colors: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
      paid: "success", sent: "info", draft: "warning", overdue: "danger", cancelled: "default",
    }
    return <Badge variant={colors[inv.status] ?? "default"}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</Badge>
  }},
]

const paymentColumns = [
  { key: "invoiceNumber", header: "Invoice", render: (p: Payment) => (
    <span className="font-semibold text-heading text-sm">{p.invoiceNumber}</span>
  )},
  { key: "amount", header: "Amount", className: "text-right", render: (p: Payment) => (
    <span className="font-semibold tabular-nums text-heading text-sm">{formatCurrency(p.amount)}</span>
  )},
  { key: "paymentMethod", header: "Method", hideOnMobile: true, render: (p: Payment) => (
    <span className="text-sm text-muted capitalize">{p.paymentMethod.replace("_", " ")}</span>
  )},
  { key: "paymentDate", header: "Date", hideOnMobile: true, render: (p: Payment) => (
    <span className="text-sm text-muted">{formatDate(p.paymentDate)}</span>
  )},
]

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    Promise.all([
      customerService.getById(id),
      invoiceService.list({ customerId: id, pageSize: 50 }),
      paymentService.list({ pageSize: 50 }),
    ]).then(([cust, invData, payData]) => {
      setCustomer(cust)
      setInvoices(invData.items)
      setPayments(payData.items.filter((p) => p.customerName === cust.name))
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="h-48 rounded-[16px] lg:col-span-1" />
            <Skeleton className="h-48 rounded-[16px] lg:col-span-2" />
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!customer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Customer not found.</p>
          <Button className="mt-4" onClick={() => navigate("/customers")}>Back to Customers</Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/customers")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{customer.name}</h1>
                <Badge variant={customer.status === "active" ? "success" : "default"}>
                  {customer.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">Customer details and history.</p>
            </div>
          </div>
          <Button variant="secondary">
            <Building2 size={16} />
            Edit Customer
          </Button>
        </div>

        {/* Customer Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={customer.name} size="lg" />
                <div>
                  <p className="font-semibold text-heading">{customer.contactName}</p>
                  <p className="text-xs text-muted">Primary contact</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={15} className="text-muted shrink-0" />
                  <span className="text-body">{customer.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-muted shrink-0" />
                  <span className="text-body">{customer.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CreditCard size={15} className="text-muted shrink-0" />
                  <span className="text-body">Tax ID: {customer.taxId || "—"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle>Billing Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{customer.billingAddress || "No billing address on file."}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm">
                <MapPin size={15} className="text-muted shrink-0 mt-0.5" />
                <span className="text-body">{customer.shippingAddress || "No shipping address on file."}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Invoice History */}
        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Invoice History</CardTitle>
          </CardHeader>
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            keyExtractor={(inv) => inv.id}
            pageSize={10}
            emptyState={
              <div className="text-center py-8">
                <p className="font-semibold text-body">No invoices</p>
                <p className="text-xs text-muted mt-1">This customer has no invoices yet.</p>
              </div>
            }
          />
        </Card>

        {/* Payment History */}
        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <DataTable
            columns={paymentColumns}
            data={payments}
            keyExtractor={(p) => p.id}
            pageSize={10}
            emptyState={
              <div className="text-center py-8">
                <p className="font-semibold text-body">No payments</p>
                <p className="text-xs text-muted mt-1">This customer has no payments yet.</p>
              </div>
            }
          />
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">Notes functionality coming soon.</p>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
