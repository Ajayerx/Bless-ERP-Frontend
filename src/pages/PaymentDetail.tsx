"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Banknote,
  FileText,
  DollarSign,
  Calendar,
  Building2,
  Hash,
  MessageSquareText,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { paymentService, type Payment } from "@/services"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

const methodIcons: Record<string, React.ReactNode> = {
  bank_transfer: <Banknote size={16} />,
  credit_card: <CreditCard size={16} />,
  check: <FileText size={16} />,
  cash: <DollarSign size={16} />,
}

const methodLabels: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  credit_card: "Credit Card",
  check: "Check",
  cash: "Cash",
}

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    paymentService.getById(id)
      .then(setPayment)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Skeleton className="h-36 rounded-[16px]" />
            <Skeleton className="h-36 rounded-[16px]" />
            <Skeleton className="h-36 rounded-[16px]" />
          </div>
        </div>
      </>
    )
  }

  if (!payment) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Payment not found.</p>
          <Button className="mt-4" onClick={() => navigate("/payments")}>Back to Payments</Button>
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
            <button onClick={() => navigate("/payments")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-success-50 text-success-600 flex items-center justify-center">
                  <CheckCircle2 size={20} />
                </div>
                <h1 className="text-2xl font-bold text-heading">Payment Details</h1>
              </div>
              <p className="text-sm text-muted mt-0.5">Reference: {payment.reference || "—"}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/invoices/${payment.invoiceId}`)}>
            <FileText size={15} />
            View Invoice
          </Button>
        </div>

        {/* Detail Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Amount */}
          <Card>
            <CardHeader>
              <CardTitle>Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-heading tabular-nums">{formatCurrency(payment.amount)}</p>
              <p className="text-xs text-muted mt-1">on invoice {payment.invoiceNumber}</p>
            </CardContent>
          </Card>

          {/* Method & Date */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className={cn("p-2 rounded-[8px]", "bg-primary-50 text-primary-600")}>
                  {methodIcons[payment.paymentMethod]}
                </div>
                <div>
                  <p className="text-xs text-muted">Method</p>
                  <p className="font-semibold text-heading">{methodLabels[payment.paymentMethod]}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={15} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Payment Date</p>
                  <p className="font-semibold text-heading">{formatDate(payment.paymentDate)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Hash size={15} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Reference</p>
                  <p className="font-semibold text-heading">{payment.reference || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Building2 size={15} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Name</p>
                  <p className="font-semibold text-heading">{payment.customerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MessageSquareText size={15} className="text-muted shrink-0" />
                <div>
                  <p className="text-xs text-muted">Notes</p>
                  <p className="font-semibold text-heading">{payment.notes || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
