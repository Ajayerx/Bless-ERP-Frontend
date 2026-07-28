"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui"
import PaymentForm from "../components/PaymentForm"
import { paymentService, type PaymentEntry, type SalesInvoice } from "@/services"

interface AmendState {
  amendFrom?: PaymentEntry
}

export default function RecordPaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const invoiceId = searchParams.get("invoice")

  const amendState = (location.state as AmendState | null)?.amendFrom
  const isAmend = !!amendState

  const [initialValues, setInitialValues] = useState<PaymentEntry | undefined>(
    amendState || undefined
  )
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [loading, setLoading] = useState(!!invoiceId && !amendState)

  useEffect(() => {
    if (!invoiceId || amendState) return
    setLoading(true)
    paymentService
      .getUnpaidInvoices([["name", "=", invoiceId]])
      .then((list) => {
        if (list.length > 0) setInvoice(list[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [invoiceId, amendState])

  const handleSaved = (paymentName: string) => {
    navigate(`/payments/${paymentName}`)
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/payments")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">
                {isAmend ? "Amend Payment Entry" : "New Payment Entry"}
              </h1>
              <p className="text-sm text-muted mt-0.5">
                {isAmend
                  ? `Creating amended copy of ${initialValues?.name || ""}`
                  : "Record a payment against an invoice or create a new payment entry."}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="bg-surface rounded-[16px] border border-border shadow-card p-6">
            <PaymentForm
              initialValues={initialValues}
              invoice={invoice}
              onSaved={handleSaved}
              onCancel={() => navigate("/payments")}
            />
          </div>
        )}
      </motion.div>
    </>
  )
}
