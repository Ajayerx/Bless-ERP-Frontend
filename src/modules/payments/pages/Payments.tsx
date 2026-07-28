"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { DollarSign, FileText, BadgeCheck, AlertCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Badge, Card, CardContent, ConfirmationDialog } from "@/components/ui"
import PaymentTable from "../components/PaymentTable"
import { paymentService, type SalesInvoice, type PaymentEntryListResponse } from "@/services"
import type { PaymentListFilters } from "../services"
import { ApiError } from "@/services/api-client"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

type StatusFilter = "All" | "Draft" | "Submitted" | "Cancelled"

export default function Payments() {
  const navigate = useNavigate()

  const [unpaidInvoices, setUnpaidInvoices] = useState<SalesInvoice[]>([])
  const [paymentsData, setPaymentsData] = useState<PaymentEntryListResponse | null>(null)
  const [loadingUnpaid, setLoadingUnpaid] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentPage, setPaymentPage] = useState(1)

  const [selectedPayments, setSelectedPayments] = useState<string[]>([])
  const [acting, setActing] = useState(false)
  const [error, setError] = useState("")
  const [confirmAction, setConfirmAction] = useState<{
    type: "bulk-submit" | "bulk-cancel" | "bulk-delete" | "single-submit" | "single-cancel" | "single-delete" | "single-amend"
    target?: string
  } | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Filter state
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("All")
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("")
  const [modeFilter, setModeFilter] = useState("")
  const [partySearch, setPartySearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const fetchUnpaid = useCallback(async () => {
    setLoadingUnpaid(true)
    try {
      const unpaid = await paymentService.getUnpaidInvoices()
      setUnpaidInvoices(unpaid)
    } catch (err) {
      console.error("[Payments] Failed to fetch unpaid invoices:", err)
      setUnpaidInvoices([])
    } finally {
      setLoadingUnpaid(false)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true)
    try {
      const filterParams: PaymentListFilters = {
        page: paymentPage,
        pageSize: 10,
      }
      if (activeStatus !== "All") {
        filterParams.status = activeStatus.toLowerCase()
      }
      if (paymentTypeFilter) filterParams.paymentType = paymentTypeFilter
      if (modeFilter) filterParams.modeOfPayment = modeFilter
      if (partySearch) filterParams.party = partySearch
      if (dateFrom) filterParams.postingDateFrom = dateFrom
      if (dateTo) filterParams.postingDateTo = dateTo

      const paid = await paymentService.list(filterParams)
      setPaymentsData(paid)
    } catch (err) {
      console.error("[Payments] Failed to fetch payments:", err)
      setPaymentsData(null)
    } finally {
      setLoadingPayments(false)
    }
  }, [paymentPage, activeStatus, paymentTypeFilter, modeFilter, partySearch, dateFrom, dateTo])

  const fetchData = useCallback(async () => {
    await Promise.all([fetchUnpaid(), fetchPayments()])
  }, [fetchUnpaid, fetchPayments])

  useEffect(() => { fetchData() }, [fetchData])

  const overdueCount = unpaidInvoices.filter(
    (inv) => inv.status === "Overdue",
  ).length

  const handleRecordPayment = (inv: SalesInvoice) => {
    navigate(`/payments/new?invoice=${inv.name}`)
  }

  const hasActiveFilters = activeStatus !== "All" || paymentTypeFilter !== "" || modeFilter !== "" || partySearch !== "" || dateFrom !== "" || dateTo !== ""

  const resetFilters = () => {
    setActiveStatus("All")
    setPaymentTypeFilter("")
    setModeFilter("")
    setPartySearch("")
    setDateFrom("")
    setDateTo("")
    setPaymentPage(1)
  }

  // --- Confirmation dialog handling ---
  const getConfirmInfo = () => {
    if (!confirmAction) return { title: "", message: "" }
    const { type, target } = confirmAction
    const count = type.startsWith("bulk-") ? selectedPayments.length : 1
    const name = target ?? ""

    switch (type) {
      case "bulk-submit":
        return { title: `Submit ${count} payments`, message: `Permanently submit ${count} payment(s)? This action cannot be undone.` }
      case "bulk-cancel":
        return { title: `Cancel ${count} payments`, message: `Permanently cancel ${count} payment(s)? This will reverse all GL entries.` }
      case "bulk-delete":
        return { title: `Delete ${count} payments`, message: `Delete ${count} payment(s)? This action cannot be undone.` }
      case "single-submit":
        return { title: "Submit Payment", message: `Permanently submit ${name}? This action cannot be undone.` }
      case "single-cancel":
        return { title: "Cancel Payment", message: `Permanently cancel ${name}? This will reverse all GL entries.` }
      case "single-delete":
        return { title: "Delete Payment", message: `Delete ${name}? This action cannot be undone.` }
      case "single-amend":
        return { title: "Amend Payment", message: `Create a new draft copy of ${name}?` }
      default:
        return { title: "", message: "" }
    }
  }

  const handleConfirm = async () => {
    if (!confirmAction) return
    setActing(true)
    setConfirmError(null)
    try {
      const { type, target } = confirmAction
      if (type === "bulk-submit") {
        await Promise.all(selectedPayments.map((n) => paymentService.submitPayment(n)))
        setSelectedPayments([])
      } else if (type === "bulk-cancel") {
        await Promise.all(selectedPayments.map((n) => paymentService.cancelPayment(n)))
        setSelectedPayments([])
      } else if (type === "bulk-delete") {
        await Promise.all(selectedPayments.map((n) => paymentService.deletePayment(n)))
        setSelectedPayments([])
      } else if (type === "single-submit" && target) {
        await paymentService.submitPayment(target)
      } else if (type === "single-cancel" && target) {
        await paymentService.cancelPayment(target)
      } else if (type === "single-delete" && target) {
        await paymentService.deletePayment(target)
      } else if (type === "single-amend" && target) {
        const original = await paymentService.getById(target)
        navigate("/payments/new", { state: { amendFrom: original } })
      }
      await fetchData()
      setConfirmAction(null)
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : "Action failed. Please try again.")
    } finally {
      setActing(false)
    }
  }

  const confirmInfo = getConfirmInfo()

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Payments</h1>
            <p className="text-sm text-muted mt-1">Record payments and view payment history.</p>
          </div>
          <Button onClick={() => navigate("/payments/new")}>
            <DollarSign size={16} /> New Payment Entry
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-4 py-3 rounded-[10px]">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <PaymentTable
          paymentsData={paymentsData}
          loading={loadingPayments}
          page={paymentPage}
          onPageChange={setPaymentPage}
          onRowClick={(payment) => navigate(`/payments/${payment.name}`)}
          unpaidCount={unpaidInvoices.length}
          overdueCount={overdueCount}
          selectedPayments={selectedPayments}
          onSelectionChange={setSelectedPayments}
          onBulkSubmit={() => setConfirmAction({ type: "bulk-submit" })}
          onBulkCancel={() => setConfirmAction({ type: "bulk-cancel" })}
          onBulkDelete={() => setConfirmAction({ type: "bulk-delete" })}
          onSubmitSingle={(name) => setConfirmAction({ type: "single-submit", target: name })}
          onCancelSingle={(name) => setConfirmAction({ type: "single-cancel", target: name })}
          onDeleteSingle={(name) => setConfirmAction({ type: "single-delete", target: name })}
          onAmendSingle={(name) => setConfirmAction({ type: "single-amend", target: name })}
          activeStatus={activeStatus}
          onStatusFilterChange={(f) => { setActiveStatus(f); setPaymentPage(1) }}
          paymentTypeFilter={paymentTypeFilter}
          onPaymentTypeFilterChange={(v) => { setPaymentTypeFilter(v); setPaymentPage(1) }}
          modeFilter={modeFilter}
          onModeFilterChange={(v) => { setModeFilter(v); setPaymentPage(1) }}
          partySearch={partySearch}
          onPartySearchChange={(v) => { setPartySearch(v); setPaymentPage(1) }}
          dateFrom={dateFrom}
          onDateFromChange={(v) => { setDateFrom(v); setPaymentPage(1) }}
          dateTo={dateTo}
          onDateToChange={(v) => { setDateTo(v); setPaymentPage(1) }}
          onResetFilters={resetFilters}
          hasActiveFilters={hasActiveFilters}
        />

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-heading">Unpaid Invoices</h2>
            {unpaidInvoices.length > 0 && (
              <Badge variant="warning">{unpaidInvoices.length} pending</Badge>
            )}
          </div>

          {loadingUnpaid ? (
            <div className="bg-surface rounded-[16px] border border-border shadow-card p-8">
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-[12px]" />
                ))}
              </div>
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 rounded-[14px] bg-success-50 text-success-600 flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck size={24} />
                </div>
                <p className="font-semibold text-heading">All caught up!</p>
                <p className="text-sm text-muted mt-1">No unpaid invoices at this time.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="bg-gray-50/50">
                      {["Invoice", "Date", "Due", "Amount", "Status", ""].map((h) => (
                        <th
                          key={h}
                          className={cn(
                            "px-6 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider",
                            h === "Amount" || h === "" ? "text-right" : "text-left",
                            h === "Date" && "hidden lg:table-cell",
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {unpaidInvoices.map((inv) => (
                      <tr key={inv.name} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-heading">{inv.name}</p>
                              <p className="text-xs text-muted">{inv.customer_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted hidden lg:table-cell">
                          {formatDate(inv.posting_date)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("text-sm", inv.status === "Overdue" ? "text-danger-600 font-semibold" : "text-muted")}>
                            {formatDate(inv.due_date)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums text-heading">
                          {formatCurrency(inv.outstanding_amount)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={inv.status === "Overdue" ? "danger" : "info"}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="success" size="sm" onClick={() => handleRecordPayment(inv)}>
                            <DollarSign size={13} /> Record Payment
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </motion.div>

      {/* Confirmation dialog */}
      <ConfirmationDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null)
            setConfirmError(null)
          }
        }}
        onConfirm={handleConfirm}
        title={confirmInfo.title}
        description={confirmInfo.message}
        confirmLabel={confirmAction?.type.includes("submit") ? "Submit" : confirmAction?.type.includes("cancel") ? "Cancel" : confirmAction?.type.includes("amend") ? "Amend" : "Delete"}
        variant={confirmAction?.type.includes("delete") || confirmAction?.type.includes("cancel") ? "danger" : "warning"}
        loading={acting}
        error={confirmError}
      />
    </>
  )
}
