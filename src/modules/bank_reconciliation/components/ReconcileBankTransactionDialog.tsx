import { useCallback, useEffect, useMemo, useState } from "react"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import {
  Button,
  Checkbox,
  Input,
  LinkSearchField,
  Select,
  messageFromError,
  useMessageDialog,
} from "@/components/ui"
import { searchLink } from "@/services"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  createJournalEntryFromBankTransaction,
  createPaymentEntryFromBankTransaction,
  getLinkedPayments,
  getReconcilableDoctypes,
  reconcileVouchers,
  updateBankTransaction,
} from "../services"
import { JOURNAL_ENTRY_TYPES } from "../types"
import type { BankTransaction, CreateVoucherDoctype, LinkedVoucher, ReconcileAction } from "../types"

interface Props {
  open: boolean
  transaction: BankTransaction | null
  currency: string
  onClose: () => void
  onReconciled: () => void
}

const PARTY_TYPES = ["", "Customer", "Supplier", "Employee", "Shareholder"]

// frappe.scrub — the dialog sends `document_types` as scrubbed fieldnames
// (get_selected_attributes reads the checkbox fieldnames).
function scrub(value: string): string {
  return value.toLowerCase().replace(/ /g, "_")
}

export default function ReconcileBankTransactionDialog({
  open,
  transaction,
  currency,
  onClose,
  onReconciled,
}: Props) {
  const { showMessage } = useMessageDialog()
  const [action, setAction] = useState<ReconcileAction>("match")
  const [doctypes, setDoctypes] = useState<string[]>([])
  const [selectedDoctypes, setSelectedDoctypes] = useState<string[]>([])
  const [vouchers, setVouchers] = useState<LinkedVoucher[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [onlyExact, setOnlyExact] = useState(false)
  const [busy, setBusy] = useState(false)

  const [createDoctype, setCreateDoctype] = useState<CreateVoucherDoctype>("Payment Entry")
  const [partyType, setPartyType] = useState("")
  const [party, setParty] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [postingDate, setPostingDate] = useState("")
  const [referenceDate, setReferenceDate] = useState("")
  const [modeOfPayment, setModeOfPayment] = useState("")
  const [journalEntryType, setJournalEntryType] = useState("Bank Entry")
  const [account, setAccount] = useState("")
  const [companyBankAccount, setCompanyBankAccount] = useState("")
  const [project, setProject] = useState("")
  const [costCenter, setCostCenter] = useState("")

  const isCreate = action === "create"
  const isJournalEntry = createDoctype === "Journal Entry"

  useEffect(() => {
    if (!open || !transaction) return
    setAction("match")
    setSelected(new Set())
    setOnlyExact(false)
    setPartyType(transaction.party_type)
    setParty(transaction.party)
    // copy_data_to_voucher(): reference_number||description, dates from the BT,
    // mode_of_payment from transaction_type.
    setReferenceNumber(transaction.reference_number || transaction.description)
    setPostingDate(transaction.date)
    setReferenceDate(transaction.date)
    setModeOfPayment(transaction.transaction_type)
    setCompanyBankAccount("")
    setProject("")
    setCostCenter("")
    setAccount("")
    getReconcilableDoctypes()
      .then((list) => {
        setDoctypes(list)
        // show_dialog() pre-checks payment_entry + journal_entry only.
        setSelectedDoctypes(list.filter((d) => d === "Payment Entry" || d === "Journal Entry"))
      })
      .catch(() => setDoctypes([]))
  }, [open, transaction])

  const loadVouchers = useCallback(async () => {
    if (!transaction) return
    try {
      setVouchers(await getLinkedPayments(transaction.name, selectedDoctypes.map(scrub)))
    } catch {
      setVouchers([])
    }
  }, [transaction, selectedDoctypes])

  useEffect(() => {
    if (!open || action !== "match") return
    void loadVouchers()
  }, [open, action, loadVouchers])

  const visibleVouchers = useMemo(
    () => (onlyExact ? vouchers.filter((v) => v.is_exact_match === 1) : vouchers),
    [vouchers, onlyExact]
  )

  const toggleDoctype = (doctype: string, checked: boolean) =>
    setSelectedDoctypes((prev) =>
      checked ? [...new Set([...prev, doctype])] : prev.filter((d) => d !== doctype)
    )

  const toggleVoucher = (key: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })

  const handleConfirm = async () => {
    if (!transaction) return
    setBusy(true)
    try {
      if (action === "match") {
        const payload = visibleVouchers
          .filter((v) => selected.has(`${v.doctype}:${v.name}`))
          .map((v) => ({ doctype: v.doctype, name: v.name, amount: v.remaining_amount }))
        const result = await reconcileVouchers(transaction.name, payload)
        result.messages.forEach((m) => showMessage(m))
      } else if (action === "create") {
        // mandatory_depends_on: reference_number | posting_date | reference_date
        // | journal_entry_type | second_account | party_type | party
        if (!referenceNumber) {
          showMessage("Reference Number is mandatory")
          setBusy(false)
          return
        }
        if (!postingDate) {
          showMessage("Posting Date is mandatory")
          setBusy(false)
          return
        }
        if (!referenceDate) {
          showMessage("Cheque/Reference Date is mandatory")
          setBusy(false)
          return
        }
        if (isJournalEntry) {
          if (!journalEntryType || !account) {
            showMessage("Journal Entry Type and Account are mandatory to create a Journal Entry.")
            setBusy(false)
            return
          }
          await createJournalEntryFromBankTransaction({
            bank_transaction: transaction.name,
            account,
            journal_entry_type: journalEntryType,
            posting_date: postingDate,
            reference_number: referenceNumber,
            reference_date: referenceDate,
            mode_of_payment: modeOfPayment,
            party_type: partyType,
            party,
          })
        } else {
          if (!partyType || !party) {
            showMessage("Party Type and Party is mandatory to create a voucher.")
            setBusy(false)
            return
          }
          await createPaymentEntryFromBankTransaction({
            bank_transaction: transaction.name,
            party_type: partyType,
            party,
            posting_date: postingDate,
            reference_number: referenceNumber,
            reference_date: referenceDate,
            mode_of_payment: modeOfPayment,
            company_bank_account: companyBankAccount,
            project,
            cost_center: costCenter,
          })
        }
        showMessage("Voucher created and reconciled.")
      } else {
        const result = await updateBankTransaction({
          bank_transaction: transaction.name,
          reference_number: referenceNumber,
          party_type: partyType,
          party,
        })
        result.messages.forEach((m) => showMessage(m))
      }
      onReconciled()
      onClose()
    } catch (err) {
      showMessage(messageFromError(err, "Bank reconciliation failed."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Reconcile Bank Transaction" size="xl">
      {transaction && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border border-border rounded-[12px] p-4">
            <Field label="Date" value={formatDate(transaction.date)} />
            <Field label="Deposit" value={formatCurrency(transaction.deposit, currency)} />
            <Field label="Withdrawal" value={formatCurrency(transaction.withdrawal, currency)} />
            <Field label="Unallocated" value={formatCurrency(transaction.unallocated_amount, currency)} />
            <Field label="Description" value={transaction.description} />
            <Field label="Allocated" value={formatCurrency(transaction.allocated_amount, currency)} />
            <Field label="Currency" value={transaction.currency} />
            <Field label="Reference №" value={transaction.reference_number} />
          </div>

          <Select
            id="br-action"
            label="Action"
            value={action}
            onChange={(e) => setAction(e.target.value as ReconcileAction)}
            className="max-w-xs"
          >
            <option value="match">Match Against Voucher</option>
            <option value="create">Create Voucher</option>
            <option value="update">Update Bank Transaction</option>
          </Select>

          {action === "match" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Filters</p>
              <div className="flex flex-wrap items-center gap-4">
                {doctypes.map((doctype) => (
                  <label key={doctype} className="flex items-center gap-2 text-sm text-body">
                    <Checkbox
                      aria-label={doctype}
                      checked={selectedDoctypes.includes(doctype)}
                      onCheckedChange={(checked) => toggleDoctype(doctype, checked === true)}
                    />
                    {doctype}
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm text-body">
                  <Checkbox
                    aria-label="Bank Transaction"
                    checked={selectedDoctypes.includes("Bank Transaction")}
                    onCheckedChange={(checked) => toggleDoctype("Bank Transaction", checked === true)}
                  />
                  Bank Transaction
                </label>
                <label className="flex items-center gap-2 text-sm text-body ml-auto">
                  <Checkbox
                    aria-label="Show Only Exact Amount"
                    checked={onlyExact}
                    onCheckedChange={(checked) => setOnlyExact(checked === true)}
                  />
                  Show Only Exact Amount
                </label>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                Select Vouchers to Match
              </p>
              <div className="overflow-x-auto border border-border rounded-[12px]">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-3 py-2 w-10" />
                      {["Doc Type", "Doc Name", "Reference Date", "Remaining", "Reference №", "Party"].map((h) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider ${
                            h === "Remaining" ? "text-right" : "text-left"
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {visibleVouchers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted">
                          No Matching Vouchers Found
                        </td>
                      </tr>
                    ) : (
                      visibleVouchers.map((voucher) => {
                        const key = `${voucher.doctype}:${voucher.name}`
                        return (
                          <tr key={key}>
                            <td className="px-3 py-2">
                              <Checkbox
                                aria-label={`Select ${voucher.name}`}
                                checked={selected.has(key)}
                                onCheckedChange={(checked) => toggleVoucher(key, checked === true)}
                              />
                            </td>
                            <td className="px-3 py-2 text-body">{voucher.doctype}</td>
                            <td className="px-3 py-2 font-medium text-heading">{voucher.name}</td>
                            <td className="px-3 py-2 text-body">{formatDate(voucher.reference_date)}</td>
                            <td className="px-3 py-2 text-right text-body">
                              {formatCurrency(voucher.remaining_amount, currency)}
                            </td>
                            <td className="px-3 py-2 text-body">{voucher.reference_number}</td>
                            <td className="px-3 py-2 text-body">{voucher.party}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {action !== "match" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Details</p>

              {/* document_type: eval:doc.action=='Create Voucher' */}
              {isCreate && (
                <Select
                  id="br-create-doctype"
                  label="Document Type"
                  value={createDoctype}
                  onChange={(e) => setCreateDoctype(e.target.value as CreateVoucherDoctype)}
                  className="max-w-xs"
                >
                  <option value="Payment Entry">Payment Entry</option>
                  <option value="Journal Entry">Journal Entry</option>
                </Select>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* reference_number: visible in Details; mandatory_depends_on Create */}
                <Input
                  id="br-detail-reference"
                  label="Reference Number"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                />
                {/* posting_date / reference_date: eval:doc.action=='Create Voucher' */}
                {isCreate && (
                  <>
                    <Input
                      id="br-create-posting-date"
                      label="Posting Date"
                      type="date"
                      value={postingDate}
                      onChange={(e) => setPostingDate(e.target.value)}
                    />
                    <Input
                      id="br-create-reference-date"
                      label="Cheque/Reference Date"
                      type="date"
                      value={referenceDate}
                      onChange={(e) => setReferenceDate(e.target.value)}
                    />
                    <LinkSearchField
                      label="Mode of Payment"
                      placeholder="Select Mode of Payment"
                      value={modeOfPayment}
                      searchFn={(query) =>
                        searchLink("Mode of Payment", query).then((items) => ({
                          items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                        }))
                      }
                      onChange={(value) => setModeOfPayment(value ?? "")}
                    />
                  </>
                )}
                {/* journal_entry_type / second_account:
                    eval:doc.action=='Create Voucher' && doc.document_type=='Journal Entry' */}
                {isCreate && isJournalEntry && (
                  <>
                    <Select
                      id="br-create-je-type"
                      label="Journal Entry Type"
                      value={journalEntryType}
                      onChange={(e) => setJournalEntryType(e.target.value)}
                    >
                      {JOURNAL_ENTRY_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </Select>
                    <Input
                      id="br-create-account"
                      label="Account"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    />
                  </>
                )}
                {/* party_type / party: visible in Details; mandatory_depends_on Create + Payment Entry */}
                <Select
                  id="br-detail-party-type"
                  label="Party Type"
                  value={partyType}
                  onChange={(e) => {
                    setPartyType(e.target.value)
                    setParty("")
                  }}
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
                  value={party}
                  disabled={!partyType}
                  searchFn={(query) =>
                    searchLink(partyType, query).then((items) => ({
                      items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                    }))
                  }
                  onChange={(value) => setParty(value ?? "")}
                />
                {/* bank_account (Company Bank Account): eval:doc.party */}
                {isCreate && party && (
                  <LinkSearchField
                    label="Company Bank Account"
                    placeholder="Select Bank Account"
                    value={companyBankAccount}
                    searchFn={(query) =>
                      searchLink("Bank Account", query, undefined, [["is_company_account", "=", 1]]).then(
                        (items) => ({
                          items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                        })
                      )
                    }
                    onChange={(value) => setCompanyBankAccount(value ?? "")}
                  />
                )}
                {/* project / cost_center:
                    eval:doc.action=='Create Voucher' && doc.document_type=='Payment Entry' */}
                {isCreate && !isJournalEntry && (
                  <>
                    <LinkSearchField
                      label="Project"
                      placeholder="Select Project"
                      value={project}
                      searchFn={(query) =>
                        searchLink("Project", query).then((items) => ({
                          items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                        }))
                      }
                      onChange={(value) => setProject(value ?? "")}
                    />
                    <LinkSearchField
                      label="Cost Center"
                      placeholder="Select Cost Center"
                      value={costCenter}
                      searchFn={(query) =>
                        searchLink("Cost Center", query, undefined, [["is_group", "=", 0]]).then((items) => ({
                          items: items.map((i) => ({ ...i, description: i.description ?? "" })),
                        }))
                      }
                      onChange={(value) => setCostCenter(value ?? "")}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          <ModalFooter>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleConfirm} loading={busy}>
              {action === "match" ? "Reconcile" : action === "create" ? "Create" : "Update"}
            </Button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-body">{value}</p>
    </div>
  )
}
