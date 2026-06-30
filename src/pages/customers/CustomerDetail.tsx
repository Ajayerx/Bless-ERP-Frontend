"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Mail, MapPin, DollarSign, FileText, Pencil } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, Avatar, Skeleton } from "@/components/ui"
import { Button } from "@/components/ui"
import { customerService, invoiceService, type Customer, type Invoice, type InvoiceListResponse } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

const invoiceColumns: Column<Invoice>[] = [
  {
    key: "number",
    header: "Invoice",
    render: (inv) => (
      <Link to={`/invoices/${inv.id}`} className="font-semibold text-primary-600 hover:underline">
        {inv.number}
      </Link>
    ),
  },
  {
    key: "total",
    header: "Amount",
    className: "text-right",
    render: (inv) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(inv.total)}</span>,
  },
  {
    key: "dueDate",
    header: "Due",
    hideOnMobile: true,
    render: (inv) => <span className="text-sm text-muted">{formatDate(inv.dueDate)}</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (inv) => <Badge variant={inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : "warning"}>{inv.status}</Badge>,
  },
]

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [invoices, setInvoices] = useState<InvoiceListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      customerService.getById(id).catch(() => null),
      invoiceService.list({ customerId: id, pageSize: 20 }).catch(() => null),
    ]).then(([c, inv]) => {
      setCustomer(c)
      setInvoices(inv)
      setLoading(false)
    })
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    )
  }

  if (!customer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Customer not found.</div>
      </>
    )
  }

  const totalInvoiced = invoices?.items?.reduce((s, inv) => s + inv.total, 0) ?? 0
  const totalPaid = invoices?.items?.filter((inv) => inv.status === "paid")?.reduce((s, inv) => s + inv.total, 0) ?? 0
  const totalDue = invoices?.items?.filter((inv) => inv.status !== "paid")?.reduce((s, inv) => s + inv.total, 0) ?? 0

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Link to="/customers" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
          <ArrowLeft size={15} /> Back to Customers
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={customer.name} size="lg" />
            <div>
              <h1 className="text-2xl font-bold text-heading">{customer.name}</h1>
              <p className="text-sm text-muted mt-0.5">Customer since {new Date(customer.createdAt).getFullYear()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
            <Badge variant={customer.status === "active" ? "success" : "default"} className="px-3 py-1 text-sm">
              {customer.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-primary-50 text-primary-600 flex items-center justify-center shrink-0"><Mail size={16} /></div>
                <div>
                  <p className="font-semibold text-heading">Contact</p>
                  <p className="text-xs text-muted">{customer.email}</p>
                  <p className="text-xs text-muted">{customer.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {(customer.billingAddress || customer.shippingAddress) && (
            <Card>
              <CardContent>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-gray-100 text-muted flex items-center justify-center shrink-0"><MapPin size={16} /></div>
                  <div>
                    <p className="font-semibold text-heading">Billing Address</p>
                    <p className="text-xs text-muted whitespace-pre-line">{customer.billingAddress}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
                <div>
                  <p className="font-semibold text-heading">Outstanding</p>
                  <p className="text-sm text-muted">{formatCurrency(totalDue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="text-center">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Invoiced</p>
              <p className="text-xl font-bold text-heading mt-1 tabular-nums">{formatCurrency(totalInvoiced)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Paid</p>
              <p className="text-xl font-bold text-success-600 mt-1 tabular-nums">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Due</p>
              <p className="text-xl font-bold text-warning-600 mt-1 tabular-nums">{formatCurrency(totalDue)}</p>
            </CardContent>
          </Card>
        </div>

        <div>
          <h2 className="text-lg font-bold text-heading mb-3">Invoices</h2>
          <DataTable
            columns={invoiceColumns} data={invoices?.items ?? []} keyExtractor={(inv) => inv.id}
            emptyState={
              <div className="flex flex-col items-center gap-2 py-4">
                <FileText size={32} className="text-muted opacity-40" />
                <p className="font-semibold text-body">No invoices yet</p>
              </div>
            }
          />
        </div>
      </motion.div>
    </>
  )
}
