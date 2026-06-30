"use client"
import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import { paymentService, type Payment } from "@/services"

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    paymentService.getById(id).then(setPayment).catch(() => null).finally(() => setLoading(false))
  }, [id])

  if (loading) return <><Topbar /><div className="p-6 max-w-2xl mx-auto space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!payment) return <><Topbar /><div className="p-6 text-center text-muted">Payment not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 max-w-2xl mx-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3 mb-6">
          <Link to="/payments" className="flex items-center gap-2 text-sm text-muted hover:text-body transition-colors">
            <ArrowLeft size={18} /><span>Back to Payments</span>
          </Link>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <h1 className="text-2xl font-bold text-heading">Payment Details</h1>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted">Invoice</span><p className="text-body font-medium">{payment.invoiceNumber}</p></div>
            <div><span className="text-muted">Customer</span><p className="text-body font-medium">{payment.customerName}</p></div>
            <div><span className="text-muted">Amount</span><p className="text-body font-medium">${payment.amount.toLocaleString()}</p></div>
            <div><span className="text-muted">Date</span><p className="text-body font-medium">{payment.paymentDate}</p></div>
            <div><span className="text-muted">Method</span><p className="text-body font-medium capitalize">{payment.paymentMethod.replace(/_/g, " ")}</p></div>
            <div><span className="text-muted">Reference</span><p className="text-body font-medium">{payment.reference}</p></div>
          </div>
          {payment.notes && <div><span className="text-sm text-muted">Notes</span><p className="text-sm text-body mt-1">{payment.notes}</p></div>}
        </div>
      </motion.div>
    </>
  )
}
