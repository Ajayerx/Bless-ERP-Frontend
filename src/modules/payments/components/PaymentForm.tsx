import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Loader2, ChevronDown, Plus, Trash2, FileText, RefreshCw, Save,
} from "lucide-react"
import { paymentService } from "@/services"
import { getCompanyDefaults } from "@/services/company"
import { ApiError } from "@/services/api-client"
import { cn } from "@/lib/utils"
import LinkField from "./LinkField"
import GetOutstandingDialog from "./GetOutstandingDialog"
import type {
  InvoiceAllocation,
  PaymentDeductionForm,
  OutstandingReference,
  PartyDetails,
  AccountDetails,
  PaymentEntry,
} from "../types"
import type { SalesInvoice } from "@/modules/invoices/services"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(s: string): boolean {
  if (!s || !DATE_REGEX.test(s)) return false
  const d = new Date(s + "T00:00:00")
  return !isNaN(d.getTime())
}

function formatCurrency(n: number, currency?: string): string {
  const cur = currency || "CAD"
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(n)
  } catch {
    return `$${n.toFixed(2)}`
  }
}

export interface PaymentFormProps {
  initialValues?: PaymentEntry
  invoice?: SalesInvoice | null
  onSaved: (paymentName: string) => void
  onCancel: () => void
}

type PaymentType = "Receive" | "Pay" | "Internal Transfer"

function createDeductionId(): string {
  return crypto.randomUUID()
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

export default function PaymentForm({
  initialValues,
  invoice,
  onSaved,
  onCancel,
}: PaymentFormProps) {
  const isAmend = !!initialValues

  const [paymentType, setPaymentType] = useState<PaymentType>("Receive")
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [modeOfPayment, setModeOfPayment] = useState("")
  const [company, setCompany] = useState("")

  const [partyType, setPartyType] = useState("Customer")
  const [party, setParty] = useState("")
  const [partyName, setPartyName] = useState("")
  const [partyBalance, setPartyBalance] = useState(0)

  const [bankAccount, setBankAccount] = useState("")
  const [partyBankAccount, setPartyBankAccount] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  const [paidFrom, setPaidFrom] = useState("")
  const [paidFromCurrency, setPaidFromCurrency] = useState("")
  const [paidFromBalance, setPaidFromBalance] = useState(0)
  const [paidFromType, setPaidFromType] = useState("")

  const [paidTo, setPaidTo] = useState("")
  const [paidToCurrency, setPaidToCurrency] = useState("")
  const [paidToBalance, setPaidToBalance] = useState(0)
  const [paidToType, setPaidToType] = useState("")

  const [paidAmount, setPaidAmount] = useState(0)
  const [receivedAmount, setReceivedAmount] = useState(0)
  const [sourceExchangeRate, setSourceExchangeRate] = useState(1)
  const [targetExchangeRate, setTargetExchangeRate] = useState(1)

  const [references, setReferences] = useState<InvoiceAllocation[]>([])
  const [deductions, setDeductions] = useState<PaymentDeductionForm[]>([])

  const [referenceNo, setReferenceNo] = useState("")
  const [referenceDate, setReferenceDate] = useState("")
  const [remarks, setRemarks] = useState("")
  const [showDeductions, setShowDeductions] = useState(false)

  const [outstandingDialogOpen, setOutstandingDialogOpen] = useState(false)
  const [outstandingDialogTitle, setOutstandingDialogTitle] = useState("")
  const [fetchingOutstanding, setFetchingOutstanding] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const isReceive = paymentType === "Receive"
  const isPay = paymentType === "Pay"
  const isInternal = paymentType === "Internal Transfer"
  const hasParty = !isInternal && !!partyType && !!party
  const companyCurrency = paidFromCurrency || paidToCurrency || "CAD"

  const showReceivedAmount = isInternal || (paidFromCurrency && paidToCurrency && paidFromCurrency !== paidToCurrency)
  const showSourceRate = paidFromCurrency && paidFromCurrency !== companyCurrency
  const showTargetRate = paidToCurrency && paidToCurrency !== companyCurrency && paidFromCurrency !== paidToCurrency
  const needRefNo = paidFromType === "Bank" || paidToType === "Bank"

  const basePaidAmount = useMemo(
    () => Math.round(paidAmount * sourceExchangeRate * 100) / 100,
    [paidAmount, sourceExchangeRate]
  )
  const baseReceivedAmount = useMemo(
    () => Math.round(receivedAmount * targetExchangeRate * 100) / 100,
    [receivedAmount, targetExchangeRate]
  )
  const totalAllocated = useMemo(
    () => references.reduce((s, r) => s + r.allocated_amount, 0),
    [references]
  )
  const partyAccountCurrency = isReceive ? paidFromCurrency : paidToCurrency
  const unallocated = useMemo(() => {
    if (!partyAccountCurrency) return 0
    const partyAmount = isReceive ? basePaidAmount : baseReceivedAmount
    return Math.max(0, Math.round((partyAmount - totalAllocated) * 100) / 100)
  }, [basePaidAmount, baseReceivedAmount, totalAllocated, isReceive, partyAccountCurrency])
  const differenceAmount = useMemo(() => {
    const basePartyAmount = totalAllocated + (isReceive ? unallocated * sourceExchangeRate : unallocated * targetExchangeRate)
    if (isReceive) return Math.round((basePartyAmount - baseReceivedAmount) * 100) / 100
    if (isPay) return Math.round((basePaidAmount - basePartyAmount) * 100) / 100
    return Math.round((basePaidAmount - baseReceivedAmount) * 100) / 100
  }, [totalAllocated, unallocated, basePaidAmount, baseReceivedAmount, isReceive, isPay, sourceExchangeRate, targetExchangeRate])

  const totalDeductions = useMemo(
    () => deductions.reduce((s, d) => s + (d.amount || 0), 0),
    [deductions]
  )

  // --- Initialize company ---
  useEffect(() => {
    getCompanyDefaults().then((d) => setCompany(d.company)).catch(() => {})
  }, [])

  // --- Populate from initialValues (amend) or invoice pre-select ---
  useEffect(() => {
    if (initialValues) {
      const v = initialValues
      setPaymentType((v.payment_type as PaymentType) || "Receive")
      setPostingDate(v.posting_date || new Date().toISOString().slice(0, 10))
      setModeOfPayment(v.mode_of_payment || "")
      setCompany(v.company)
      setPartyType(v.party_type || "Customer")
      setParty(v.party)
      setPartyName(v.party_name || "")
      setPartyBalance(v.party_balance || 0)
      setBankAccount(v.bank_account || "")
      setPartyBankAccount(v.party_bank_account || "")
      setContactPerson(v.contact_person || "")
      setContactEmail(v.contact_email || "")
      setPaidFrom(v.paid_from)
      setPaidFromCurrency(v.paid_from_account_currency)
      setPaidFromBalance(v.paid_from_account_balance || 0)
      setPaidTo(v.paid_to)
      setPaidToCurrency(v.paid_to_account_currency)
      setPaidToBalance(v.paid_to_account_balance || 0)
      setPaidAmount(v.paid_amount)
      setReceivedAmount(v.received_amount)
      setSourceExchangeRate(v.source_exchange_rate || 1)
      setTargetExchangeRate(v.target_exchange_rate || 1)
      setReferenceNo(v.reference_no || "")
      setReferenceDate(v.reference_date || "")
      setRemarks(v.remarks || "")

      if (v.references && v.references.length > 0) {
        setReferences(v.references.map((r) => ({
          reference_doctype: r.reference_doctype,
          reference_name: r.reference_name,
          due_date: r.due_date,
          total_amount: r.total_amount,
          outstanding_amount: r.outstanding_amount,
          allocated_amount: r.allocated_amount,
          exchange_rate: r.exchange_rate,
          account: r.account,
        })))
      } else {
        setReferences([])
      }

      if (v.deductions && v.deductions.length > 0) {
        setDeductions(v.deductions.map((d) => ({
          id: createDeductionId(),
          account: d.account,
          cost_center: d.cost_center,
          amount: d.amount,
          description: d.description || "",
        })))
        setShowDeductions(true)
      } else {
        setDeductions([])
        setShowDeductions(false)
      }
    } else if (invoice) {
      setPartyType("Customer")
      setParty(invoice.customer)
      setPartyName(invoice.customer_name)
      setReferences([{
        reference_doctype: "Sales Invoice",
        reference_name: invoice.name,
        total_amount: invoice.grand_total,
        outstanding_amount: invoice.outstanding_amount,
        allocated_amount: invoice.outstanding_amount,
      }])
      setPaidAmount(invoice.outstanding_amount)
      setReceivedAmount(invoice.outstanding_amount)
      setRemarks(`Payment against ${invoice.name}`)
    } else {
      setPartyType("Customer")
      setParty("")
      setPartyName("")
      setPartyBalance(0)
      setReferences([])
      setPaidAmount(0)
      setReceivedAmount(0)
      setRemarks("")
    }

    if (!initialValues) {
      setPaymentType("Receive")
      setPostingDate(new Date().toISOString().slice(0, 10))
      setModeOfPayment("")
      setBankAccount("")
      setPartyBankAccount("")
      setContactPerson("")
      setContactEmail("")
      setPaidFrom("")
      setPaidFromCurrency("")
      setPaidFromBalance(0)
      setPaidFromType("")
      setPaidTo("")
      setPaidToCurrency("")
      setPaidToBalance(0)
      setPaidToType("")
      setSourceExchangeRate(1)
      setTargetExchangeRate(1)
      setDeductions([])
      setShowDeductions(false)
      setReferenceNo("")
      setReferenceDate("")
    }
    setError("")
  }, [initialValues, invoice])

  // --- Payment type change ---
  useEffect(() => {
    if (isInternal) {
      setParty("")
      setPartyName("")
      setPartyBalance(0)
      setPartyBankAccount("")
      setContactPerson("")
      setContactEmail("")
      setReferences([])
      setPaidAmount(0)
      setReceivedAmount(0)
    } else if (party) {
      handlePartyChange(party, partyType)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType])

  // --- Party type auto-set from payment type ---
  useEffect(() => {
    if (isReceive) setPartyType("Customer")
    else if (isPay) setPartyType("Supplier")
  }, [paymentType, isReceive, isPay])

  // --- Fetch party details ---
  const handlePartyChange = useCallback(
    async (partyValue: string, pType: string) => {
      if (!partyValue || !pType || !company || !postingDate) return
      try {
        const details: PartyDetails = await paymentService.getPartyDetails(company, pType, partyValue, postingDate)
        setPartyName(details.party_name || "")
        setPartyBalance(details.party_balance || 0)
        setPartyBankAccount(details.party_bank_account || "")
        setBankAccount(details.bank_account || "")
        setContactPerson(details.contact_person || "")
        setContactEmail(details.contact_email || "")

        if (isReceive) {
          setPaidFrom(details.party_account || "")
          setPaidFromCurrency(details.party_account_currency || "")
        } else if (isPay) {
          setPaidTo(details.party_account || "")
          setPaidToCurrency(details.party_account_currency || "")
        }
      } catch {
        // party might not have details yet
      }
    },
    [company, postingDate, isReceive, isPay]
  )

  // --- Auto-fetch party details once company is available ---
  useEffect(() => {
    if (!company || !party || !postingDate) return
    if ((isReceive && paidFrom) || (isPay && paidTo)) return
    handlePartyChange(party, partyType)
  }, [company, party, postingDate, isReceive, isPay, paidFrom, paidTo, partyType, handlePartyChange])

  // --- Fetch account details when paid_from/paid_to change ---
  const fetchAccountDetails = useCallback(
    async (account: string, setCurrency: (v: string) => void, setBalance: (v: number) => void, setType: (v: string) => void) => {
      if (!account || !postingDate) return
      try {
        const details: AccountDetails = await paymentService.getAccountDetails(account, postingDate)
        setCurrency(details.account_currency || "")
        setBalance(details.account_balance || 0)
        setType(details.account_type || "")
      } catch {
        setCurrency("")
        setBalance(0)
        setType("")
      }
    },
    [postingDate]
  )

  useEffect(() => {
    if (paidFrom) fetchAccountDetails(paidFrom, setPaidFromCurrency, setPaidFromBalance, setPaidFromType)
  }, [paidFrom, fetchAccountDetails])

  useEffect(() => {
    if (paidTo) fetchAccountDetails(paidTo, setPaidToCurrency, setPaidToBalance, setPaidToType)
  }, [paidTo, fetchAccountDetails])

  // --- Fetch exchange rates when currencies change ---
  useEffect(() => {
    if (!postingDate) return
    if (paidFromCurrency && companyCurrency && paidFromCurrency !== companyCurrency) {
      paymentService.getExchangeRate(paidFromCurrency, companyCurrency, postingDate).then(setSourceExchangeRate).catch(() => setSourceExchangeRate(1))
    } else {
      setSourceExchangeRate(1)
    }
  }, [paidFromCurrency, companyCurrency, postingDate])

  useEffect(() => {
    if (!postingDate) return
    if (paidToCurrency && companyCurrency && paidToCurrency !== companyCurrency) {
      paymentService.getExchangeRate(paidToCurrency, companyCurrency, postingDate).then(setTargetExchangeRate).catch(() => setTargetExchangeRate(1))
    } else {
      setTargetExchangeRate(1)
    }
  }, [paidToCurrency, companyCurrency, postingDate])

  // --- Mode of Payment auto-sets account ---
  useEffect(() => {
    if (!modeOfPayment || !company) return
    paymentService.getModeOfPaymentAccount(modeOfPayment, company).then((account) => {
      if (!account) return
      if (isPay) setPaidFrom(account)
      else if (isReceive) setPaidTo(account)
    }).catch(() => {})
  }, [modeOfPayment, company, isPay, isReceive])

  // --- Fetch outstanding references ---
  const handleFetchOutstanding = useCallback(
    async (filters: { from_posting_date: string; to_posting_date: string; from_due_date: string; to_due_date: string; outstanding_amt_greater_than: number; outstanding_amt_less_than: number; allocate_payment_amount: boolean }) => {
      if (!party || !partyType || !company) return
      setFetchingOutstanding(true)
      try {
        const partyAccount = isReceive ? paidFrom : paidTo
        const results: OutstandingReference[] = await paymentService.getOutstandingReferences({
          posting_date: postingDate,
          company,
          party_type: partyType,
          payment_type: paymentType,
          party,
          party_account: partyAccount,
          get_outstanding_invoices: outstandingDialogTitle.includes("Invoice"),
          from_posting_date: filters.from_posting_date || undefined,
          to_posting_date: filters.to_posting_date || undefined,
          from_due_date: filters.from_due_date || undefined,
          to_due_date: filters.to_due_date || undefined,
          outstanding_amt_greater_than: filters.outstanding_amt_greater_than || undefined,
          outstanding_amt_less_than: filters.outstanding_amt_less_than || undefined,
          allocate_payment_amount: filters.allocate_payment_amount,
        })

        const newRefs: InvoiceAllocation[] = results.map((r) => ({
          reference_doctype: r.voucher_type,
          reference_name: r.voucher_no,
          due_date: r.due_date,
          total_amount: r.invoice_amount,
          outstanding_amount: r.outstanding_amount,
          allocated_amount: r.allocated_amount || r.outstanding_amount,
          exchange_rate: r.exchange_rate,
          account: r.account,
        }))

        setReferences(newRefs)

        const totalPositive = results.filter((r) => r.outstanding_amount > 0).reduce((s, r) => s + r.outstanding_amount, 0)
        const totalNegative = results.filter((r) => r.outstanding_amount < 0).reduce((s, r) => s + Math.abs(r.outstanding_amount), 0)
        const netOutstanding = totalPositive - totalNegative

        if (isReceive && netOutstanding > 0) {
          setPaidAmount(netOutstanding)
          setReceivedAmount(showReceivedAmount ? netOutstanding : netOutstanding)
        } else if (isPay && netOutstanding > 0) {
          setReceivedAmount(netOutstanding)
          if (!showReceivedAmount) setPaidAmount(netOutstanding)
        }

        setOutstandingDialogOpen(false)
      } catch {
        setError("Failed to fetch outstanding documents.")
      } finally {
        setFetchingOutstanding(false)
      }
    },
    [party, partyType, company, postingDate, paymentType, paidFrom, paidTo, isReceive, isPay, showReceivedAmount, outstandingDialogTitle]
  )

  // --- Allocation helpers ---
  const updateAllocation = (refName: string, amount: number) => {
    setReferences((prev) =>
      prev.map((r) =>
        r.reference_name === refName
          ? { ...r, allocated_amount: Math.min(Math.max(0, amount), r.outstanding_amount) }
          : r
      )
    )
  }

  const removeAllocation = (refName: string) => {
    setReferences((prev) => prev.filter((r) => r.reference_name !== refName))
  }

  // --- Deduction helpers ---
  const addDeduction = () => {
    setDeductions((prev) => [...prev, { id: createDeductionId(), account: "", cost_center: "", amount: 0, description: "" }])
  }

  const updateDeduction = (id: string, field: keyof PaymentDeductionForm, value: string | number) => {
    setDeductions((prev) => prev.map((d) => d.id === id ? { ...d, [field]: value } : d))
  }

  const removeDeduction = (id: string) => {
    setDeductions((prev) => prev.filter((d) => d.id !== id))
  }

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isInternal && !party) { setError("Please select a party."); return }
    if (!isInternal && !modeOfPayment) { setError("Please select a Mode of Payment."); return }
    if (!paidFrom) { setError("Please select a Paid From account."); return }
    if (!paidTo) { setError("Please select a Paid To account."); return }
    if (paidAmount <= 0 && receivedAmount <= 0) { setError("Payment amount must be greater than zero."); return }
    if (needRefNo && !referenceNo) { setError("Reference No is required for bank accounts."); return }
    if (referenceDate && !isValidDateString(referenceDate)) { setError("Reference Date must be a valid date (YYYY-MM-DD)."); return }

    setSaving(true)
    try {
      const draft = await paymentService.saveDraft({
        payment_type: paymentType,
        party_type: isInternal ? "" : partyType,
        party: isInternal ? "" : party,
        posting_date: postingDate,
        company,
        mode_of_payment: modeOfPayment || undefined,
        paid_from: paidFrom,
        paid_from_account_currency: paidFromCurrency || companyCurrency,
        paid_to: paidTo,
        paid_to_account_currency: paidToCurrency || companyCurrency,
        paid_amount: paidAmount,
        received_amount: showReceivedAmount ? receivedAmount : paidAmount,
        source_exchange_rate: sourceExchangeRate,
        target_exchange_rate: showReceivedAmount ? targetExchangeRate : sourceExchangeRate,
        base_paid_amount: basePaidAmount,
        base_received_amount: showReceivedAmount ? baseReceivedAmount : basePaidAmount,
        bank_account: bankAccount || undefined,
        party_bank_account: partyBankAccount || undefined,
        contact_person: contactPerson || undefined,
        contact_email: contactEmail || undefined,
        reference_no: referenceNo || undefined,
        reference_date: referenceDate || undefined,
        remarks: remarks || undefined,
        amended_from: initialValues?.amended_from || initialValues?.name || undefined,
        references: references.filter((r) => r.allocated_amount > 0),
        deductions: deductions
          .filter((d) => d.account && d.amount > 0)
          .map((d) => ({ account: d.account, cost_center: d.cost_center, amount: d.amount, description: d.description || undefined })),
      })
      onSaved(draft.name)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save payment. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const openOutstandingDialog = (title: string) => {
    setOutstandingDialogTitle(title)
    setOutstandingDialogOpen(true)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isAmend && (
        <div className="flex items-center gap-2 text-xs font-semibold text-warning-700 bg-warning-50 border border-warning-200 px-3 py-2 rounded-[10px]">
          <span>Amended from {initialValues?.amended_from || initialValues?.name}</span>
          <span className="text-muted">— Review references before saving.</span>
        </div>
      )}

      {/* Section 1: Type of Payment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Payment Type *</label>
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType)}
            className={inputClass}
          >
            <option value="Receive">Receive</option>
            <option value="Pay">Pay</option>
            <option value="Internal Transfer">Internal Transfer</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Posting Date *</label>
          <input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Mode of Payment *</label>
          <LinkField
            doctype="Mode of Payment"
            value={modeOfPayment}
            onChange={setModeOfPayment}
            placeholder="Select mode..."
          />
        </div>
      </div>

      {/* Section 2: Party */}
      {!isInternal && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Party</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Party Type *</label>
              <select value={partyType} onChange={(e) => { setPartyType(e.target.value); setParty(""); setPartyName("") }} className={inputClass}>
                <option value="Customer">Customer</option>
                <option value="Supplier">Supplier</option>
                <option value="Employee">Employee</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Party *</label>
              <LinkField
                doctype={partyType}
                value={party}
                onChange={(v) => { setParty(v); handlePartyChange(v, partyType) }}
                placeholder={`Search ${partyType.toLowerCase()}...`}
              />
            </div>
            <div>
              <label className={labelClass}>Party Name</label>
              <input type="text" value={partyName} readOnly className={`${inputClass} bg-gray-50`} />
            </div>
          </div>
          {partyBalance !== 0 && (
            <p className="text-xs text-muted">Party Balance: <span className="font-semibold text-body">{formatCurrency(partyBalance, partyAccountCurrency || companyCurrency)}</span></p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Party Bank Account</label>
              <LinkField
                doctype="Bank Account"
                value={partyBankAccount}
                onChange={setPartyBankAccount}
                placeholder="Select party bank..."
                filters={[["is_company_account", "=", 0], ["party_type", "=", partyType], ["party", "=", party]]}
              />
            </div>
            <div>
              <label className={labelClass}>Contact Person</label>
              <LinkField
                doctype="Contact"
                value={contactPerson}
                onChange={setContactPerson}
                placeholder="Search contact..."
                filters={[["links", "link_doctype", "=", partyType], ["links", "link_name", "=", party]]}
                labelField="full_name"
              />
            </div>
          </div>
          {contactEmail && (
            <p className="text-xs text-muted">Email: <span className="font-medium text-body">{contactEmail}</span></p>
          )}
        </div>
      )}

      {/* Section 3: Accounts */}
      <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Accounts</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={labelClass}>Paid From *</label>
            <LinkField
              doctype="Account"
              value={paidFrom}
              onChange={setPaidFrom}
              placeholder="Select account..."
              filters={[
                ["is_group", "=", 0],
                ["company", "=", company],
                ["account_type", "in", isReceive ? ["Receivable"] : ["Bank", "Cash"]],
              ]}
            />
            {paidFrom && (
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{paidFromCurrency || "—"}</span>
                <span>Balance: <span className="font-medium text-body">{formatCurrency(paidFromBalance, paidFromCurrency)}</span></span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className={labelClass}>Paid To *</label>
            <LinkField
              doctype="Account"
              value={paidTo}
              onChange={setPaidTo}
              placeholder="Select account..."
              filters={[
                ["is_group", "=", 0],
                ["company", "=", company],
                ["account_type", "in", isPay ? ["Payable"] : ["Bank", "Cash"]],
              ]}
            />
            {paidTo && (
              <div className="flex items-center gap-3 text-xs text-muted">
                <span>{paidToCurrency || "—"}</span>
                <span>Balance: <span className="font-medium text-body">{formatCurrency(paidToBalance, paidToCurrency)}</span></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Amount */}
      <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">Amount</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={labelClass}>Paid Amount ({paidFromCurrency || companyCurrency}) *</label>
            <input
              type="number" min={0} step={0.01}
              value={paidAmount}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0
                setPaidAmount(v)
                if (!showReceivedAmount) setReceivedAmount(v)
              }}
              className={inputClass}
            />
          </div>
          {showSourceRate && (
            <div>
              <label className={labelClass}>Source Exchange Rate</label>
              <input
                type="number" min={0} step={0.00000001}
                value={sourceExchangeRate}
                onChange={(e) => setSourceExchangeRate(parseFloat(e.target.value) || 1)}
                className={inputClass}
              />
              <p className="text-[10px] text-muted mt-1">1 {paidFromCurrency} = {sourceExchangeRate} {companyCurrency}</p>
            </div>
          )}
          <div>
            <label className={labelClass}>Base Paid Amount ({companyCurrency})</label>
            <input type="text" value={formatCurrency(basePaidAmount, companyCurrency)} readOnly className={`${inputClass} bg-gray-50`} />
          </div>
        </div>
        {showReceivedAmount && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Received Amount ({paidToCurrency || companyCurrency}) *</label>
              <input
                type="number" min={0} step={0.01}
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
            </div>
            {showTargetRate && (
              <div>
                <label className={labelClass}>Target Exchange Rate</label>
                <input
                  type="number" min={0} step={0.00000001}
                  value={targetExchangeRate}
                  onChange={(e) => setTargetExchangeRate(parseFloat(e.target.value) || 1)}
                  className={inputClass}
                />
                <p className="text-[10px] text-muted mt-1">1 {paidToCurrency} = {targetExchangeRate} {companyCurrency}</p>
              </div>
            )}
            <div>
              <label className={labelClass}>Base Received Amount ({companyCurrency})</label>
              <input type="text" value={formatCurrency(baseReceivedAmount, companyCurrency)} readOnly className={`${inputClass} bg-gray-50`} />
            </div>
          </div>
        )}
      </div>

      {/* Section 5: References */}
      {!isInternal && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">References</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openOutstandingDialog("Get Outstanding Invoices")}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <FileText size={12} /> Get Outstanding Invoices
              </button>
              <button
                type="button"
                onClick={() => openOutstandingDialog("Get Outstanding Orders")}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
              >
                <RefreshCw size={12} /> Get Outstanding Orders
              </button>
            </div>
          </div>

          {references.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-1.5 text-xs font-semibold text-muted">Type</th>
                    <th className="text-left py-1.5 text-xs font-semibold text-muted">Name</th>
                    <th className="text-left py-1.5 text-xs font-semibold text-muted hidden md:table-cell">Due Date</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-muted">Total</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-muted">Outstanding</th>
                    <th className="text-right py-1.5 text-xs font-semibold text-muted w-[110px]">Allocate</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {references.map((r) => (
                    <tr key={r.reference_name} className="border-b border-border/30">
                      <td className="py-1.5 text-xs text-muted">{r.reference_doctype}</td>
                      <td className="py-1.5 font-medium text-heading">{r.reference_name}</td>
                      <td className="py-1.5 text-xs text-muted hidden md:table-cell">{r.due_date || "—"}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{formatCurrency(r.total_amount, partyAccountCurrency)}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{formatCurrency(r.outstanding_amount, partyAccountCurrency)}</td>
                      <td className="py-1.5 text-right">
                        <input
                          type="number" min={0} max={r.outstanding_amount} step={0.01}
                          value={r.allocated_amount}
                          onChange={(e) => updateAllocation(r.reference_name, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm text-right border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                        />
                      </td>
                      <td className="py-1.5 text-right">
                        <button type="button" onClick={() => removeAllocation(r.reference_name)} className="p-1 text-muted hover:text-danger-600 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted text-center py-3">Click "Get Outstanding Invoices" or "Get Outstanding Orders" to fetch references.</p>
          )}
        </div>
      )}

      {/* Section 6: Summary */}
      {!isInternal && references.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <span className="text-muted">Total Allocated</span>
            <p className="font-bold text-heading tabular-nums">{formatCurrency(totalAllocated, partyAccountCurrency)}</p>
          </div>
          <div>
            <span className="text-muted">Unallocated</span>
            <p className="font-bold text-heading tabular-nums">{formatCurrency(unallocated, partyAccountCurrency)}</p>
          </div>
          <div>
            <span className="text-muted">Difference</span>
            <p className={cn("font-bold tabular-nums", differenceAmount !== 0 ? "text-danger-600" : "text-heading")}>{formatCurrency(differenceAmount, companyCurrency)}</p>
          </div>
        </div>
      )}

      {/* Section 7: Deductions */}
      <div>
        <button
          type="button"
          onClick={() => setShowDeductions(!showDeductions)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wider hover:text-body transition-colors"
        >
          <ChevronDown size={12} className={cn("transition-transform", showDeductions && "rotate-180")} />
          Deductions or Loss
          {deductions.length > 0 && <span className="text-primary-600">({deductions.length})</span>}
        </button>
        {showDeductions && (
          <div className="mt-2 space-y-2">
            {deductions.map((d) => (
              <div key={d.id} className="grid grid-cols-[1fr_1fr_100px_1fr_auto] gap-2 items-start">
                <LinkField
                  doctype="Account"
                  value={d.account}
                  onChange={(v) => updateDeduction(d.id, "account", v)}
                  placeholder="Account"
                  filters={[["is_group", "=", 0], ["company", "=", company]]}
                />
                <LinkField
                  doctype="Cost Center"
                  value={d.cost_center}
                  onChange={(v) => updateDeduction(d.id, "cost_center", v)}
                  placeholder="Cost Center"
                  filters={[["company", "=", company], ["is_group", "=", 0]]}
                />
                <input
                  type="number" min={0} step={0.01}
                  value={d.amount || ""}
                  onChange={(e) => updateDeduction(d.id, "amount", parseFloat(e.target.value) || 0)}
                  placeholder="Amount"
                  className={inputClass}
                />
                <input
                  type="text"
                  value={d.description}
                  onChange={(e) => updateDeduction(d.id, "description", e.target.value)}
                  placeholder="Description"
                  className={inputClass}
                />
                <button type="button" onClick={() => removeDeduction(d.id)} className="p-2 text-muted hover:text-danger-600 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addDeduction}
              className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              <Plus size={14} /> Add Deduction
            </button>
          </div>
        )}
      </div>

      {/* Section 8: Transaction Reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Reference No {needRefNo && <span className="text-danger-500">*</span>}</label>
          <input
            type="text"
            value={referenceNo}
            onChange={(e) => setReferenceNo(e.target.value)}
            className={inputClass}
            placeholder="Cheque/Reference No"
          />
        </div>
        <div>
          <label className={labelClass}>Reference Date</label>
          <input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} pattern="\d{4}-\d{2}-\d{2}" className={inputClass} />
        </div>
      </div>

      {/* Section 9: Remarks */}
      <div>
        <label className={labelClass}>Remarks</label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Payment remarks..."
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : isAmend ? "Save as Draft" : "Save as Draft"}
        </button>
      </div>

      {/* Outstanding Dialog */}
      <GetOutstandingDialog
        open={outstandingDialogOpen}
        onClose={() => setOutstandingDialogOpen(false)}
        onFetch={handleFetchOutstanding}
        loading={fetchingOutstanding}
        title={outstandingDialogTitle}
      />
    </form>
  )
}
