"use client"

import { useEffect, useState, useRef } from "react"
import { useNavigate, useLocation, useSearchParams } from "react-router-dom"
import { motion } from "framer-motion"
import { Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import PageHead from "@/components/layout/PageHead"
import { Button, Skeleton } from "@/components/ui"
import { useMessageDialog, messageFromError } from "@/components/ui"
import PaymentForm, { type PaymentFormHandle } from "../components/PaymentForm"
import { paymentService, type PaymentEntry, type SalesInvoice } from "@/services"

interface AmendState {
  amendFrom?: PaymentEntry
  copyFrom?: PaymentEntry
}

export default function RecordPaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const invoiceId = searchParams.get("invoice")
  const formRef = useRef<PaymentFormHandle>(null)
  const { showMessage } = useMessageDialog()

  const amendState = (location.state as AmendState | null)?.amendFrom
  const copyState = (location.state as AmendState | null)?.copyFrom
  const isAmend = !!amendState
  const isDuplicate = !!copyState

  const [initialValues] = useState<PaymentEntry | undefined>(
    amendState || copyState || undefined
  )
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [loading, setLoading] = useState(!!invoiceId && !amendState && !copyState)

  useEffect(() => {
    if (!invoiceId || amendState || copyState) return
    setLoading(true)
    paymentService
      .getUnpaidInvoices([["name", "=", invoiceId]])
      .then((list) => {
        if (list.length > 0) setInvoice(list[0])
      })
      .catch((err) => showMessage(messageFromError(err, "Failed to load the invoice.")))
      .finally(() => setLoading(false))
  }, [invoiceId, amendState, copyState])

  const handleSaved = (paymentName: string) => {
    navigate(`/payments/${paymentName}`)
  }

  return (
    <>
      <Topbar />
      <PageHead
        eyebrow="Payment Entry"
        title={
          isAmend ? "Amend Payment Entry" : isDuplicate ? "Duplicate Payment Entry" : "New Payment Entry"
        }
        subtitle={
          isAmend
            ? `Creating amended copy of ${initialValues?.name || ""}`
            : isDuplicate
              ? `Creating a copy of ${initialValues?.name || ""}`
              : "Record a payment against an invoice or create a new payment entry."
        }
        backTo="/payments"
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => formRef.current?.save()}
            data-testid="save_button"
          >
            <Save size={16} /> Save
          </Button>
        }
      />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {loading ? (
          <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <div className="bg-surface rounded-[16px] border border-border shadow-card p-6">
            <PaymentForm
              ref={formRef}
              initialValues={initialValues}
              invoice={invoice}
              duplicate={isDuplicate}
              onSaved={handleSaved}
              onCancel={() => navigate("/payments")}
              hideFooter={true}
            />
          </div>
        )}
      </motion.div>
    </>
  )
}
