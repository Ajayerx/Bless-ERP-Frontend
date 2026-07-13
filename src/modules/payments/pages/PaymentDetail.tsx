"use client"

import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import { Badge, Skeleton } from "@/components/ui"
import { paymentService, type PaymentEntry } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<PaymentEntry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    paymentService.getById(id).then(setPayment).catch(() => null).finally(() => setLoading(false))
  }, [id])

  if (loading) return <><Topbar /><div className="p-6 space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-48 w-full" /></div></>
  if (!payment) return <><Topbar /><div className="p-6 text-center text-muted">Payment not found</div></>

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Link to="/payments" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
          <ArrowLeft size={15} /> Back to Payments
        </Link>

        <div className="bg-white rounded-2xl shadow-card p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-heading">{payment.name}</h1>
            <Badge variant={payment.docstatus === 1 ? "success" : "default"}>
              {payment.docstatus === 1 ? "Submitted" : payment.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Party</label>
              <p className="font-semibold text-heading">{payment.party_name || payment.party}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Payment Type</label>
              <p className="text-sm text-body">{payment.payment_type}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Amount</label>
              <p className="font-semibold text-heading">{formatCurrency(payment.paid_amount)}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Date</label>
              <p className="text-sm text-body">{formatDate(payment.posting_date)}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Method</label>
              <p className="text-sm text-body">{payment.mode_of_payment ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Reference</label>
              <p className="text-sm text-body">{payment.reference_no ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Bank Account</label>
              <p className="text-sm text-body">{payment.bank_account ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Party Bank</label>
              <p className="text-sm text-body">{payment.party_bank_account ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Contact</label>
              <p className="text-sm text-body">{payment.contact_person ?? "—"}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Paid From</label>
              <p className="text-sm text-body">{payment.paid_from}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Paid To</label>
              <p className="text-sm text-body">{payment.paid_to}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Exchange Rate</label>
              <p className="text-sm text-body">{payment.source_exchange_rate ?? 1}</p>
            </div>
          </div>

          {payment.remarks && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Remarks</label>
              <p className="text-sm text-body">{payment.remarks}</p>
            </div>
          )}

          {/* Deductions */}
          {payment.deductions && payment.deductions.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">Deductions</label>
              <div className="space-y-1">
                {payment.deductions.map((d, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-[10px] px-4 py-2">
                    <span className="font-medium text-heading">{d.account}</span>
                    <span className="text-muted">{d.description}</span>
                    <span className="font-semibold text-danger-600">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* References */}
          {payment.references && payment.references.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                References ({payment.references.length})
              </label>
              <div className="space-y-2">
                {payment.references.map((ref, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-[10px] px-4 py-2.5">
                    <div>
                      <span className="font-medium text-heading">{ref.reference_name}</span>
                      <span className="text-xs text-muted ml-2">{ref.reference_doctype}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted text-xs mr-2">O/S {formatCurrency(ref.outstanding_amount)}</span>
                      <span className="font-semibold text-success-600">{formatCurrency(ref.allocated_amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Total Allocated</label>
              <p className="font-semibold text-heading">{formatCurrency(payment.total_allocated_amount ?? 0)}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Unallocated</label>
              <p className="font-semibold text-heading">{formatCurrency(payment.unallocated_amount ?? 0)}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wider mb-1">Difference</label>
              <p className="font-semibold text-heading">{formatCurrency(payment.difference_amount ?? 0)}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  )
}
