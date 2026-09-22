import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { ArrowLeft, Save, Unlink } from "lucide-react"
import { motion } from "framer-motion"
import Topbar from "@/components/layout/Topbar"
import {
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Link,
  LinkSearchField,
  Select,
  Skeleton,
  messageFromError,
  useMessageDialog,
} from "@/components/ui"
import { searchLink } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import ReconcileBankTransactionDialog from "@/modules/bank_reconciliation/components/ReconcileBankTransactionDialog"
import type { BankTransaction as ReconBankTransaction } from "@/modules/bank_reconciliation/types"
import { getBankTransaction, removePaymentEntries, updateBankTransaction } from "../services"
import type { BankTransactionDoc } from "../types"
import { statusIndicator } from "../types"

const PARTY_TYPES = ["", "Customer", "Supplier", "Employee", "Shareholder"]

export default function BankTransactionDetail() {
  const { id } = useParams<{ id: string }>()
  const { showMessage } = useMessageDialog()

  const [doc, setDoc] = useState<BankTransactionDoc | null>(null)
  const [form, setForm] = useState<BankTransactionDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unreconciling, setUnreconciling] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const loaded = await getBankTransaction(id)
      setDoc(loaded)
      setForm(loaded)
    } catch (err) {
      showMessage(messageFromError(err, "Failed to load the Bank Transaction."))
      setDoc(null)
    } finally {
      setLoading(false)
    }
  }, [id, showMessage])

  useEffect(() => {
    void load()
  }, [load])

  const patch = (values: Partial<BankTransactionDoc>) =>
    setForm((f) => (f ? { ...f, ...values } : f))

  // ERPNext: only allow_on_submit fields stay editable on a submitted doc
  // (reference_number / party_type / party).
  const canEdit = (allowOnSubmit = false): boolean => {
    if (!doc) return false
    if (doc.docstatus === 2) return false
    return allowOnSubmit || doc.docstatus === 0
  }

  const handleSave = async () => {
    if (!doc || !form) return
    setSaving(true)
    try {
      const saved = await updateBankTransaction(doc.name, {
        reference_number: form.reference_number,
        party_type: form.party_type,
        party: form.party,
        ...(doc.docstatus === 0
          ? {
              date: form.date,
              description: form.description,
              transaction_type: form.transaction_type,
              deposit: form.deposit,
              withdrawal: form.withdrawal,
              included_fee: form.included_fee,
              excluded_fee: form.excluded_fee,
            }
          : {}),
      })
      setDoc(saved)
      setForm(saved)
      showMessage("Bank Transaction saved")
    } catch (err) {
      showMessage(messageFromError(err, "Failed to save the Bank Transaction."))
    } finally {
      setSaving(false)
    }
  }

  const handleUnreconcile = async () => {
    if (!doc) return
    setUnreconciling(true)
    try {
      const result = await removePaymentEntries(doc)
      result.messages.forEach((m) => showMessage(m))
      if (result.doc) {
        setDoc(result.doc)
        setForm(result.doc)
      } else {
        await load()
      }
    } catch (err) {
      showMessage(messageFromError(err, "Failed to unreconcile the Bank Transaction."))
    } finally {
      setUnreconciling(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    )
  }
  if (!doc || !form) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted">Bank Transaction not found</div>
      </>
    )
  }

  const indicator = statusIndicator(doc)
  const currency = doc.currency || "CAD"

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link to="/bank-transactions">
              <ArrowLeft size={18} />
              <span>Back to Bank Transactions</span>
            </Link>
            <h1 className="text-xl font-bold text-heading">{doc.name}</h1>
            <Badge variant={indicator.tone}>{indicator.label}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {doc.payment_entries.length > 0 && (
              <Button variant="outline" onClick={handleUnreconcile} loading={unreconciling}>
                <Unlink size={14} /> Unreconcile Transaction
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setReconcileOpen(true)}
              disabled={Number(doc.unallocated_amount) <= 0}
            >
              Reconcile
            </Button>
            <Button onClick={handleSave} loading={saving}>
              <Save size={14} /> Save
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              id="btx-date"
              label="Date"
              type="date"
              value={form.date}
              disabled={!canEdit()}
              onChange={(e) => patch({ date: e.target.value })}
            />
            <div className="space-y-1.5">
              <span className="block text-sm font-normal text-heading">Status</span>
              <div className="pt-2">
                <Badge variant={indicator.tone}>{doc.status}</Badge>
              </div>
            </div>
            <Input id="btx-bank-account" label="Bank Account" value={doc.bank_account} readOnly disabled />
            <Input id="btx-company" label="Company" value={doc.company} readOnly disabled />
            <Input id="btx-currency" label="Currency" value={doc.currency} readOnly disabled />
            <Input
              id="btx-transaction-id"
              label="Transaction ID"
              value={doc.transaction_id}
              readOnly
              disabled
            />
            <Input
              id="btx-description"
              label="Description"
              value={form.description}
              disabled={!canEdit()}
              onChange={(e) => patch({ description: e.target.value })}
            />
            <Input
              id="btx-reference-number"
              label="Reference Number"
              value={form.reference_number}
              disabled={!canEdit(true)}
              onChange={(e) => patch({ reference_number: e.target.value })}
            />
            <Input
              id="btx-transaction-type"
              label="Transaction Type"
              value={form.transaction_type}
              disabled={!canEdit()}
              onChange={(e) => patch({ transaction_type: e.target.value })}
            />
            <Input
              id="btx-deposit"
              label="Deposit"
              type="number"
              value={String(form.deposit ?? "")}
              disabled={!canEdit()}
              onChange={(e) => patch({ deposit: Number(e.target.value || 0) })}
            />
            <Input
              id="btx-withdrawal"
              label="Withdrawal"
              type="number"
              value={String(form.withdrawal ?? "")}
              disabled={!canEdit()}
              onChange={(e) => patch({ withdrawal: Number(e.target.value || 0) })}
            />
            <Input
              id="btx-allocated"
              label="Allocated Amount"
              value={formatCurrency(doc.allocated_amount, currency)}
              readOnly
              disabled
            />
            <Input
              id="btx-unallocated"
              label="Unallocated Amount"
              value={formatCurrency(doc.unallocated_amount, currency)}
              readOnly
              disabled
            />
            <Input
              id="btx-included-fee"
              label="Included Fee"
              type="number"
              value={String(form.included_fee ?? "")}
              disabled={!canEdit()}
              onChange={(e) => patch({ included_fee: Number(e.target.value || 0) })}
            />
            <Input
              id="btx-excluded-fee"
              label="Excluded Fee"
              type="number"
              value={String(form.excluded_fee ?? "")}
              disabled={!canEdit()}
              onChange={(e) => patch({ excluded_fee: Number(e.target.value || 0) })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-heading">Payment From / To</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                id="btx-party-type"
                label="Party Type"
                value={form.party_type}
                disabled={!canEdit(true)}
                onChange={(e) => patch({ party_type: e.target.value, party: "" })}
              >
                {PARTY_TYPES.map((type) => (
                  <option key={type || "none"} value={type}>
                    {type || "Select Party Type"}
                  </option>
                ))}
              </Select>
              <LinkSearchField
                label="Party"
                placeholder="Select Party"
                value={form.party}
                disabled={!canEdit(true) || !form.party_type}
                searchFn={(query) =>
                  searchLink(form.party_type, query).then((items) => ({
                    items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                  }))
                }
                onChange={(value) => patch({ party: value ?? "" })}
              />
              <Input
                id="btx-bank-party-name"
                label="Party Name/Account Holder (Bank Statement)"
                value={form.bank_party_name}
                disabled={!canEdit()}
                onChange={(e) => patch({ bank_party_name: e.target.value })}
              />
              <Input
                id="btx-bank-party-account"
                label="Party Account No. (Bank Statement)"
                value={form.bank_party_account_number}
                disabled={!canEdit()}
                onChange={(e) => patch({ bank_party_account_number: e.target.value })}
              />
              <Input
                id="btx-bank-party-iban"
                label="Party IBAN (Bank Statement)"
                value={form.bank_party_iban}
                disabled={!canEdit()}
                onChange={(e) => patch({ bank_party_iban: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-sm font-semibold text-heading">Payment Entries</h2>
            <div className="overflow-x-auto border border-border rounded-[12px]">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="bg-gray-50/50">
                    {["Payment Document", "Payment Entry", "Allocated Amount"].map((h) => (
                      <th
                        key={h}
                        className={`px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wider ${
                          h === "Allocated Amount" ? "text-right" : "text-left"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {doc.payment_entries.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-muted">
                        No linked payment entries
                      </td>
                    </tr>
                  ) : (
                    doc.payment_entries.map((entry) => (
                      <tr key={`${entry.payment_document}:${entry.payment_entry}`}>
                        <td className="px-4 py-2 text-body">{entry.payment_document}</td>
                        <td className="px-4 py-2 text-body">{entry.payment_entry}</td>
                        <td className="px-4 py-2 text-right text-body">
                          {formatCurrency(entry.allocated_amount, currency)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Allocated on {formatDate(doc.date)} · Unallocated{" "}
              {formatCurrency(doc.unallocated_amount, currency)}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <ReconcileBankTransactionDialog
        open={reconcileOpen}
        transaction={doc as unknown as ReconBankTransaction}
        currency={currency}
        onClose={() => setReconcileOpen(false)}
        onReconciled={() => void load()}
      />
    </>
  )
}
