"use client"

import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, RefreshCw } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Card, CardContent, Input, useMessageDialog, messageFromError } from "@/components/ui"
import { apiClient } from "@/services/api-client"
import { validateLink } from "@/services/frappe-client"
import {
  getUnreconciledEntries,
  allocateReconciliationEntries,
  reconcileWorkspace,
  calculateReconDifference,
  isAutoReconcileEnabled,
  getPartyReconciliationAccount,
  isReconciliationJobRunning,
  getDimensionFilters,
  emptyReconWorkspace,
} from "../services/reconciliation"
import type {
  PaymentReconciliationWorkspace,
  ReconAllocationRow,
  ReconInvoiceRow,
  ReconPaymentRow,
} from "../types"
import PaymentReconciliationFilters from "../components/reconciliation/PaymentReconciliationFilters"
import ReconPaymentTable from "../components/reconciliation/ReconPaymentTable"
import ReconInvoiceTable from "../components/reconciliation/ReconInvoiceTable"
import ReconAllocationTable from "../components/reconciliation/ReconAllocationTable"
import DifferenceAccountDialog from "../components/reconciliation/DifferenceAccountDialog"

const CURRENCY = "CAD"

type Busy = "" | "get" | "allocate" | "reconcile"

export default function PaymentReconciliation() {
  const { showMessage } = useMessageDialog()

  const [doc, setDoc] = useState<PaymentReconciliationWorkspace>(() => emptyReconWorkspace(""))
  const [selectedPayments, setSelectedPayments] = useState<Set<string>>(new Set())
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<Busy>("")
  const [jobBanner, setJobBanner] = useState<string | null>(null)
  const [differenceOpen, setDifferenceOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let company = "Bless Erp"
      try {
        const defaults = await apiClient<{ default_company?: string }>("/resource/Global Defaults/Global Defaults")
        if (defaults?.default_company) company = defaults.default_company
      } catch {
        // fall back to the seeded company
      }
      if (!cancelled) setDoc((d) => ({ ...d, company }))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const patch = useCallback((values: Partial<PaymentReconciliationWorkspace>) => {
    setDoc((d) => ({ ...d, ...values }))
  }, [])

  const checkRunningJob = useCallback(async () => {
    try {
      const auto = await isAutoReconcileEnabled({ doctype: "Payment Reconciliation" })
      if (!auto) {
        setJobBanner(null)
        return
      }
      const name = await isReconciliationJobRunning({
        company: doc.company,
        party_type: doc.party_type,
        party: doc.party,
        account: doc.receivable_payable_account,
      })
      setJobBanner(name)
    } catch {
      setJobBanner(null)
    }
  }, [doc.company, doc.party_type, doc.party, doc.receivable_payable_account])

  // Selecting a party type clears the party + accounts (party_type onchange in
  // payment_reconciliation.js).
  const handlePartyTypeChange = useCallback((partyType: string) => {
    setDoc((d) => ({
      ...d,
      party_type: partyType,
      party: "",
      receivable_payable_account: "",
      default_advance_account: "",
      payments: [],
      invoices: [],
      allocation: [],
    }))
    setSelectedPayments(new Set())
    setSelectedInvoices(new Set())
  }, [])

  // Selecting a party auto-fetches the Receivable/Payable + advance accounts
  // (erpnext.accounts.party.get_party_account, include_advance=1), then mirrors
  // the form JS: validate_link on the resolved account, is_auto_process_enabled
  // (run_doc_method) + is_any_doc_running, and get_queries_for_dimension_filters.
  const handlePartyChange = useCallback(
    async (party: string) => {
      setDoc((d) => ({
        ...d,
        party,
        receivable_payable_account: party ? d.receivable_payable_account : "",
        payments: [],
        invoices: [],
        allocation: [],
      }))
      setSelectedPayments(new Set())
      setSelectedInvoices(new Set())
      if (!party) return
      let resolvedAccount = doc.receivable_payable_account
      try {
        const account = await getPartyReconciliationAccount(doc.company, doc.party_type, party)
        if (account?.account) {
          resolvedAccount = account.account
          setDoc((d) => ({
            ...d,
            receivable_payable_account: account.account,
            default_advance_account: account.advance_account,
          }))
          void validateLink("Account", account.account).catch(() => {})
        }
      } catch {
        // leave the account as typed
      }
      try {
        const auto = await isAutoReconcileEnabled({ doctype: "Payment Reconciliation" })
        if (!auto) {
          setJobBanner(null)
        } else {
          const name = await isReconciliationJobRunning({
            company: doc.company,
            party_type: doc.party_type,
            party,
            account: resolvedAccount,
          })
          setJobBanner(name)
        }
      } catch {
        setJobBanner(null)
      }
      getDimensionFilters(doc.company)
        .then((filters) => setDoc((d) => ({ ...d, dimensionFilters: filters })))
        .catch(() => {})
    },
    [doc.company, doc.party_type, doc.receivable_payable_account]
  )

  const handleGet = useCallback(async () => {
    setBusy("get")
    try {
      const { workspace, messages } = await getUnreconciledEntries(
        doc as unknown as Record<string, unknown>
      )
      setDoc((d) => ({ ...d, ...workspace }))
      setSelectedPayments(new Set(workspace.payments.map((p) => p.reference_name)))
      setSelectedInvoices(new Set(workspace.invoices.map((i) => i.invoice_number)))
      messages.forEach((m) => showMessage(m))
      void checkRunningJob()
    } catch (err) {
      showMessage(messageFromError(err, "Failed to get unreconciled entries."))
    } finally {
      setBusy("")
    }
  }, [doc, showMessage, checkRunningJob])

  const handleAllocate = useCallback(async () => {
    const payments = doc.payments.filter((p) => selectedPayments.has(p.reference_name))
    const invoices = doc.invoices.filter((i) => selectedInvoices.has(i.invoice_number))
    setBusy("allocate")
    try {
      const [result] = await Promise.all([
        allocateReconciliationEntries(
          doc as unknown as Record<string, unknown>,
          payments,
          invoices
        ),
        // ERPNext parity: Allocate also fires get_queries_for_dimension_filters
        // (accounting dimension filter link queries) before/alongside allocation.
        getDimensionFilters(doc.company).catch(() => null),
      ])
      const { workspace, messages } = result
      setDoc((d) => ({ ...d, ...workspace }))
      messages.forEach((m) => showMessage(m))
    } catch (err) {
      showMessage(messageFromError(err, "Allocation failed."))
    } finally {
      setBusy("")
    }
  }, [doc, selectedPayments, selectedInvoices, showMessage])

  const runReconcile = useCallback(
    async (allocation: ReconAllocationRow[]) => {
      setBusy("reconcile")
      try {
        const { workspace, messages } = await reconcileWorkspace({
          ...(doc as unknown as Record<string, unknown>),
          allocation,
        })
        if (workspace) setDoc((d) => ({ ...d, ...workspace }))
        setSelectedPayments(new Set())
        setSelectedInvoices(new Set())
        messages.forEach((m) => showMessage(m))
      } catch (err) {
        showMessage(messageFromError(err, "Reconcile failed."))
      } finally {
        setBusy("")
        setDifferenceOpen(false)
      }
    },
    [doc, showMessage]
  )

  const handleReconcile = useCallback(() => {
    const hasDifference = doc.allocation.some((row) => Number(row.difference_amount) !== 0)
    if (hasDifference) {
      setDifferenceOpen(true)
      return
    }
    void runReconcile(doc.allocation)
  }, [doc.allocation, runReconcile])

  const handleDifferenceConfirm = useCallback(
    (updates: Array<{ index: number; difference_account: string; gain_loss_posting_date: string }>) => {
      const next = doc.allocation.map((row, index) => {
        const update = updates.find((u) => u.index === index)
        return update
          ? {
              ...row,
              difference_account: update.difference_account,
              gain_loss_posting_date: update.gain_loss_posting_date,
            }
          : row
      })
      setDoc((d) => ({ ...d, allocation: next }))
      void runReconcile(next)
    },
    [doc.allocation, runReconcile]
  )

  // Editing an allocated amount re-derives the row's Difference Amount
  // (calculate_difference_on_allocation_change).
  const handleAllocationChange = useCallback(
    async (index: number, values: Partial<ReconAllocationRow>) => {
      const current = { ...doc.allocation[index], ...values }
      setDoc((d) => ({
        ...d,
        allocation: d.allocation.map((row, i) => (i === index ? { ...row, ...values } : row)),
      }))
      if (values.allocated_amount === undefined) return
      try {
        const difference = await calculateReconDifference(
          doc as unknown as Record<string, unknown>,
          {
            reference_type: current.reference_type,
            reference_name: current.reference_name,
            posting_date: current.posting_date,
            amount: current.amount,
            difference_amount: current.difference_amount,
          } as ReconPaymentRow,
          {
            invoice_type: current.invoice_type,
            invoice_number: current.invoice_number,
            invoice_date: current.invoice_date,
            amount: current.outstanding_amount,
            outstanding_amount: current.outstanding_amount,
          } as ReconInvoiceRow,
          current.allocated_amount
        )
        setDoc((d) => ({
          ...d,
          allocation: d.allocation.map((row, i) => (i === index ? { ...row, difference_amount: difference } : row)),
        }))
      } catch {
        // keep the user's allocation amount
      }
    },
    [doc]
  )

  const togglePayment = (key: string, checked: boolean) =>
    setSelectedPayments((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })

  const toggleInvoice = (key: string, checked: boolean) =>
    setSelectedInvoices((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })

  // refresh(): the Get / Allocate / Reconcile custom buttons are added only
  // when receivable_payable_account / (invoices && payments) / allocation exist.
  const canAllocate = doc.payments.length > 0 && doc.invoices.length > 0
  const canReconcile = doc.allocation.length > 0

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-heading">Payment Reconciliation</h1>
            <p className="text-sm text-muted mt-1">
              Match unreconciled payment entries against outstanding invoices.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {doc.receivable_payable_account && (
              <Button onClick={handleGet} loading={busy === "get"}>
                <RefreshCw size={16} /> Get Unreconciled Entries
              </Button>
            )}
            {canAllocate && (
              <Button variant="secondary" onClick={handleAllocate} loading={busy === "allocate"}>
                Allocate
              </Button>
            )}
            {canReconcile && (
              <Button variant="success" onClick={handleReconcile} loading={busy === "reconcile"}>
                Reconcile
              </Button>
            )}
          </div>
        </div>

        {jobBanner && (
          <div className="flex items-start gap-2 text-sm text-warning-600 bg-warning-50 border border-warning-100 px-4 py-3 rounded-[10px]">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <p>
              Payment Reconciliation Job: {jobBanner} is running for this party. Can&apos;t reconcile now.
            </p>
          </div>
        )}

        <Card>
          <CardContent className="pt-6">
            <PaymentReconciliationFilters
              doc={doc}
              onChange={patch}
              onPartyTypeChange={handlePartyTypeChange}
              onPartyChange={handlePartyChange}
            />
          </CardContent>
        </Card>

        {(doc.payments.length > 0 || doc.invoices.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-heading">Unreconciled Entries</h2>
            <div className="space-y-3">
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-heading">Invoices</h2>
                <div className="max-w-md">
                  <Input
                    id="recon-invoice-name"
                    label="Filter on Invoice"
                    value={doc.invoice_name ?? ""}
                    onChange={(e) => patch({ invoice_name: e.target.value })}
                  />
                </div>
                <ReconInvoiceTable
                  rows={doc.invoices}
                  selected={selectedInvoices}
                  onToggle={toggleInvoice}
                  onToggleAll={(checked) =>
                    setSelectedInvoices(checked ? new Set(doc.invoices.map((i) => i.invoice_number)) : new Set())
                  }
                  currency={CURRENCY}
                />
              </section>

              <section className="space-y-3">
                <h2 className="text-base font-semibold text-heading">Payments</h2>
                <div className="max-w-md">
                  <Input
                    id="recon-payment-name"
                    label="Filter on Payment"
                    value={doc.payment_name ?? ""}
                    onChange={(e) => patch({ payment_name: e.target.value })}
                  />
                </div>
                <ReconPaymentTable
                  rows={doc.payments}
                  selected={selectedPayments}
                  onToggle={togglePayment}
                  onToggleAll={(checked) =>
                    setSelectedPayments(checked ? new Set(doc.payments.map((p) => p.reference_name)) : new Set())
                  }
                  currency={CURRENCY}
                />
              </section>
            </div>
          </section>
        )}

        {doc.allocation.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-heading">Allocated Entries</h2>
            <ReconAllocationTable rows={doc.allocation} onChange={handleAllocationChange} currency={CURRENCY} />
          </section>
        )}

        <DifferenceAccountDialog
          open={differenceOpen}
          rows={doc.allocation}
          currency={CURRENCY}
          onClose={() => setDifferenceOpen(false)}
          onConfirm={handleDifferenceConfirm}
        />
      </motion.div>
    </>
  )
}