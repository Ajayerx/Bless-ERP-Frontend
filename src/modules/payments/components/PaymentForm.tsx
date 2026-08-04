import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  Loader2, Plus, Trash2, FileText, RefreshCw, Save,
  Check, Ban, GitBranch, Printer, Mail, Copy,
} from "lucide-react"
import { paymentService, getValue, getAccountingDimensions, searchLink } from "@/services"
import { validateLink } from "@/services/frappe-client"
import { getCompanyDefaults } from "@/services/company"
import { ApiError } from "@/services/api-client"
import { cn } from "@/lib/utils"
import LinkField from "./LinkField"
import GetOutstandingDialog from "./GetOutstandingDialog"
import CollapsibleSection from "./CollapsibleSection"
import ChildTableGrid, {
  type GridColumn,
} from "@/components/ui/ChildTableGrid"
import {
  calculateTaxes,
  computeUnallocatedAmount,
  computeDifferenceAmount,
} from "../utils/taxes"
import type { AccountingDimension } from "@/services"
import type {
  InvoiceAllocation,
  PaymentDeductionForm,
  PaymentEntryTax,
  OutstandingReference,
  PartyDetails,
  AccountDetails,
  PaymentEntry,
  RecordPaymentData,
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

export type PaymentFormMode = "new" | "existing"

export type PaymentToolbarAction = "submit" | "cancel" | "delete" | "amend" | "print" | "email" | "duplicate"

export interface PaymentFormProps {
  initialValues?: PaymentEntry
  invoice?: SalesInvoice | null
  onSaved: (paymentName: string) => void
  onCancel: () => void
  mode?: PaymentFormMode
  onToolbarAction?: (action: PaymentToolbarAction) => void
  duplicate?: boolean
}

type PaymentType = "Receive" | "Pay" | "Internal Transfer"

const CHARGE_TYPES = ["Actual", "On Paid Amount", "On Previous Row Amount", "On Previous Row Total"]

const PARTY_ACCOUNT_TYPES: Record<string, string> = {
  Customer: "Receivable",
  Supplier: "Payable",
  Employee: "Payable",
}

function createDeductionId(): string {
  return crypto.randomUUID()
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed"

const labelClass = "block text-[13px] font-medium text-body/70 mb-1.5"

export default function PaymentForm({
  initialValues,
  invoice,
  onSaved,
  onCancel,
  mode = "new",
  onToolbarAction,
  duplicate = false,
}: PaymentFormProps) {
  const isAmend = !!initialValues && mode !== "existing" && !duplicate
  const isExisting = mode === "existing" && !!initialValues
  const docstatus = isExisting ? initialValues.docstatus : 0
  const isReadOnly = isExisting && docstatus !== 0
  const readOnlyLinkProps = isReadOnly ? { disabled: true } : {}

  const [namingSeries, setNamingSeries] = useState("ACC-PAY-.YYYY.-")
  const [paymentType, setPaymentType] = useState<PaymentType>("Receive")
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10))
  const [modeOfPayment, setModeOfPayment] = useState("")
  const [modeOfPaymentError, setModeOfPaymentError] = useState("")
  const [company, setCompany] = useState("")
  const [companyDefaultCurrency, setCompanyDefaultCurrency] = useState("")

  const [partyType, setPartyType] = useState("Customer")
  const [partyTypes, setPartyTypes] = useState<Array<{ name: string; account_type: string | null }>>([])
  const [party, setParty] = useState("")
  const [partyName, setPartyName] = useState("")
  const [partyBalance, setPartyBalance] = useState(0)

  const partyAccountTypes = useMemo(() => {
    const map: Record<string, string> = { ...PARTY_ACCOUNT_TYPES }
    for (const pt of partyTypes) {
      if (pt.account_type) map[pt.name] = pt.account_type
    }
    return map
  }, [partyTypes])

  const [bankAccount, setBankAccount] = useState("")
  const [bankName, setBankName] = useState("")
  const [bankAccountNo, setBankAccountNo] = useState("")
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

  const [taxes, setTaxes] = useState<PaymentEntryTax[]>([])
  const [salesTaxesTemplate, setSalesTaxesTemplate] = useState("")
  const [purchaseTaxesTemplate, setPurchaseTaxesTemplate] = useState("")
  const [applyTaxWithholding, setApplyTaxWithholding] = useState(false)
  const [taxWithholdingCategory, setTaxWithholdingCategory] = useState("")

  const [referenceNo, setReferenceNo] = useState("")
  const [referenceDate, setReferenceDate] = useState("")
  const [clearanceDate, setClearanceDate] = useState("")
  const [customRemarks, setCustomRemarks] = useState(false)
  const [remarks, setRemarks] = useState("")
  const [showDeductions, setShowDeductions] = useState(false)

  const [costCenter, setCostCenter] = useState("")
  const [project, setProject] = useState("")
  const [letterHead, setLetterHead] = useState("")
  const [printHeading, setPrintHeading] = useState("")
  const [isOpening, setIsOpening] = useState(false)
  const [bookAdvancePayments, setBookAdvancePayments] = useState(false)
  const [reconcileOnAdvancePaymentDate, setReconcileOnAdvancePaymentDate] = useState(false)
  const [dimensions, setDimensions] = useState<AccountingDimension[]>([])
  const [showTaxes, setShowTaxes] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const [showAccountingDimensions, setShowAccountingDimensions] = useState(false)
  const [showMoreInfo, setShowMoreInfo] = useState(false)

  const companyRef = useRef(initialValues?.company ?? null)
  const bankAccountFromAccountRef = useRef(false)

  const [outstandingDialogOpen, setOutstandingDialogOpen] = useState(false)
  const [outstandingDialogTitle, setOutstandingDialogTitle] = useState("")
  const [fetchingOutstanding, setFetchingOutstanding] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const isReceive = paymentType === "Receive"
  const isPay = paymentType === "Pay"
  const isInternal = paymentType === "Internal Transfer"
  const companyCurrency = companyDefaultCurrency || paidFromCurrency || paidToCurrency || "CAD"

  const basePaidAmount = useMemo(
    () => Math.round(paidAmount * sourceExchangeRate * 100) / 100,
    [paidAmount, sourceExchangeRate]
  )
  const baseReceivedAmount = useMemo(
    () => Math.round(receivedAmount * targetExchangeRate * 100) / 100,
    [receivedAmount, targetExchangeRate]
  )

  const showReceivedAmount = isInternal || (paidFromCurrency && paidToCurrency && paidFromCurrency !== paidToCurrency)
  const showSourceRate = paidFromCurrency && paidFromCurrency !== companyCurrency && paidAmount > 0
  const showTargetRate = paidToCurrency && paidToCurrency !== companyCurrency && paidFromCurrency !== paidToCurrency && receivedAmount > 0
  const showBasePaid = paidFromCurrency && paidFromCurrency !== companyCurrency
  const showBaseReceived = paidToCurrency && paidToCurrency !== companyCurrency && paidFromCurrency !== paidToCurrency && basePaidAmount !== baseReceivedAmount
  const needRefNo = (isPay && paidFromType === "Bank") || (isReceive && paidToType === "Bank")
  const needRefDate = needRefNo
  const showPaidFromField = isInternal || isPay || !!party
  const showPaidToField = isInternal || isReceive || !!party
  const partyAccountCurrency = isReceive ? paidFromCurrency : paidToCurrency
  const multiCurrency = !!partyAccountCurrency && !!companyCurrency && partyAccountCurrency !== companyCurrency

  const totalAllocated = useMemo(
    () => references.reduce((s, r) => s + r.allocated_amount, 0),
    [references]
  )
  const baseTotalAllocated = useMemo(
    () => references.reduce((s, r) => s + r.allocated_amount * (r.exchange_rate || 1), 0),
    [references]
  )

  const referencesWithGainLoss = useMemo(() => {
    if (!multiCurrency) return references
    const paymentRate = isReceive ? sourceExchangeRate : targetExchangeRate
    if (!paymentRate) return references
    return references.map((r) => ({
      ...r,
      exchange_gain_loss:
        typeof r.exchange_rate === "number" && r.allocated_amount > 0
          ? Math.round((r.allocated_amount * paymentRate - r.allocated_amount * r.exchange_rate) * 100) / 100
          : undefined,
    }))
  }, [references, multiCurrency, isReceive, sourceExchangeRate, targetExchangeRate])

  const taxCalc = useMemo(() => {
    if (taxes.length === 0) return null
    return calculateTaxes({
      taxes,
      basePaidAmount,
      paymentType,
      sourceExchangeRate,
      targetExchangeRate,
      paidFromCurrency,
      paidToCurrency,
    })
  }, [taxes, basePaidAmount, paymentType, sourceExchangeRate, targetExchangeRate, paidFromCurrency, paidToCurrency])

  const computedTaxes = taxCalc?.taxes ?? taxes
  const paidAmountAfterTax = taxCalc?.paidAmountAfterTax ?? basePaidAmount
  const totalTaxesAndCharges = taxCalc?.totalTaxesAndCharges ?? 0
  const baseTotalTaxesAndCharges = taxCalc?.baseTotalTaxesAndCharges ?? 0

  const unallocated = useMemo(
    () => computeUnallocatedAmount({
      paymentType,
      basePaidAmount,
      baseReceivedAmount,
      baseTotalAllocatedAmount: baseTotalAllocated,
      deductions,
      taxes: computedTaxes,
      sourceExchangeRate,
      targetExchangeRate,
    }),
    [paymentType, basePaidAmount, baseReceivedAmount, baseTotalAllocated, deductions, computedTaxes, sourceExchangeRate, targetExchangeRate]
  )
  const differenceAmount = useMemo(
    () => computeDifferenceAmount({
      paymentType,
      unallocatedAmount: unallocated,
      basePaidAmount,
      baseReceivedAmount,
      baseTotalAllocatedAmount: baseTotalAllocated,
      deductions,
      baseTotalTaxesAndCharges,
      sourceExchangeRate,
      targetExchangeRate,
    }),
    [paymentType, unallocated, basePaidAmount, baseReceivedAmount, baseTotalAllocated, deductions, baseTotalTaxesAndCharges, sourceExchangeRate, targetExchangeRate]
  )

  // --- Initialize company + company default currency ---
  useEffect(() => {
    if (isExisting) {
      // Existing docs: company comes from the doc. Only resolve the default
      // currency (ERPNext has it in boot) for correct base-amount labels.
      getCompanyDefaults().then((d) => {
        setCompanyDefaultCurrency((prev) => prev || d.currency)
      }).catch(() => {})
      return
    }
    getCompanyDefaults().then((d) => {
      setCompany(d.company)
      setCompanyDefaultCurrency(d.currency)
    }).catch(() => {})
  }, [isExisting])

  // --- Fetch Party Type master (ERPNext boot: tabParty Type -> party_account_types) ---
  useEffect(() => {
    paymentService.getPartyTypes().then(setPartyTypes).catch(() => {})
  }, [])

  // --- Mirror ERPNext onload: fetch accounting dimensions ---
  useEffect(() => {
    if (isExisting) return
    getAccountingDimensions(true).then((result) => setDimensions(result.dimensions)).catch(() => {})
  }, [isExisting])

  // --- Mirror ERPNext fetch_from: company advance-payment flags + letter head ---
  useEffect(() => {
    if (isExisting) return
    if (!company || company === companyRef.current) return
    companyRef.current = company
    validateLink("Company", company, [
      "book_advance_payments_in_separate_party_account",
      "reconcile_on_advance_payment_date",
    ])
      .then((result) => {
        setBookAdvancePayments(!!result.book_advance_payments_in_separate_party_account)
        setReconcileOnAdvancePaymentDate(!!result.reconcile_on_advance_payment_date)
      })
      .catch(() => {})

    // erpnext.utils.set_letter_head -> frappe.db.get_value("Company", company, "default_letter_head")
    getValue("Company", "default_letter_head", company)
      .then((result) => {
        const letterHead = result.default_letter_head as string | undefined
        if (letterHead) setLetterHead(letterHead)
      })
      .catch(() => {})
  }, [company, isExisting])

  // --- Mirror ERPNext Dynamic Link validation: party_type must be a valid DocType ---
  useEffect(() => {
    if (isExisting) return
    if (company && partyType) {
      validateLink("DocType", partyType).catch(() => {})
    }
  }, [company, partyType, isExisting])

  // --- Populate from initialValues (amend) or invoice pre-select ---
  useEffect(() => {
    if (initialValues) {
      const v = initialValues
      setNamingSeries(v.naming_series || "ACC-PAY-.YYYY.-")
      setPaymentType((v.payment_type as PaymentType) || "Receive")
      setPostingDate(v.posting_date || new Date().toISOString().slice(0, 10))
      setModeOfPayment(v.mode_of_payment || "")
      setCompany(v.company)
      setPartyType(v.party_type || "Customer")
      setParty(v.party)
      setPartyName(v.party_name || "")
      setPartyBalance(v.party_balance || 0)
      setBankAccount(v.bank_account || "")
      setBankName(v.bank || "")
      setBankAccountNo(v.bank_account_no || "")
      setPartyBankAccount(v.party_bank_account || "")
      setContactPerson(v.contact_person || "")
      setContactEmail(v.contact_email || "")
      setPaidFrom(v.paid_from)
      setPaidFromCurrency(v.paid_from_account_currency)
      setPaidFromBalance(v.paid_from_account_balance || 0)
      setPaidFromType(v.paid_from_account_type || "")
      setPaidTo(v.paid_to)
      setPaidToCurrency(v.paid_to_account_currency)
      setPaidToBalance(v.paid_to_account_balance || 0)
      setPaidToType(v.paid_to_account_type || "")
      setPaidAmount(v.paid_amount)
      setReceivedAmount(v.received_amount)
      setSourceExchangeRate(v.source_exchange_rate || 1)
      setTargetExchangeRate(v.target_exchange_rate || 1)
      setReferenceNo(v.reference_no || "")
      setReferenceDate(v.reference_date || "")
      setClearanceDate(v.clearance_date || "")
      setCustomRemarks(!!v.custom_remarks)
      setRemarks(v.remarks || "")
      setCostCenter(v.cost_center || "")
      setProject(v.project || "")
      setLetterHead(v.letter_head || "")
      setPrintHeading(v.print_heading || "")
      setIsOpening(!!v.is_opening)
      setBookAdvancePayments(!!v.book_advance_payments_in_separate_party_account)
      setReconcileOnAdvancePaymentDate(!!v.reconcile_on_advance_payment_date)
      setSalesTaxesTemplate(v.sales_taxes_and_charges_template || "")
      setPurchaseTaxesTemplate(v.purchase_taxes_and_charges_template || "")
      setApplyTaxWithholding(!!v.apply_tax_withholding_amount)
      setTaxWithholdingCategory(v.tax_withholding_category || "")

      if (v.references && v.references.length > 0) {
        setReferences(v.references.map((r) => ({
          reference_doctype: r.reference_doctype,
          reference_name: r.reference_name,
          due_date: r.due_date,
          total_amount: r.total_amount,
          outstanding_amount: r.outstanding_amount,
          allocated_amount: r.allocated_amount,
          exchange_rate: r.exchange_rate,
          exchange_gain_loss: r.exchange_gain_loss,
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
          is_exchange_gain_loss: d.is_exchange_gain_loss,
        })))
        setShowDeductions(true)
      } else {
        setDeductions([])
        setShowDeductions(false)
      }

      if (v.taxes && v.taxes.length > 0) {
        setTaxes(v.taxes.map((t) => ({
          charge_type: t.charge_type,
          row_id: t.row_id,
          account_head: t.account_head,
          description: t.description,
          rate: t.rate,
          tax_amount: t.tax_amount,
          total: t.total,
          add_deduct_tax: t.add_deduct_tax || "Add",
          included_in_paid_amount: t.included_in_paid_amount,
          cost_center: t.cost_center,
          project: t.project,
          currency: t.currency,
        })))
        setShowTaxes(true)
      } else {
        setTaxes([])
        setShowTaxes(false)
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
      setCustomRemarks(false)
      setCostCenter("")
      setProject("")
      setLetterHead("")
      setPrintHeading("")
      setIsOpening(false)
      setBookAdvancePayments(false)
      setReconcileOnAdvancePaymentDate(false)
      setTaxes([])
      setSalesTaxesTemplate("")
      setPurchaseTaxesTemplate("")
      setApplyTaxWithholding(false)
      setTaxWithholdingCategory("")
      setClearanceDate("")
      companyRef.current = null
    } else {
      setPartyType("Customer")
      setParty("")
      setPartyName("")
      setPartyBalance(0)
      setReferences([])
      setPaidAmount(0)
      setReceivedAmount(0)
      setRemarks("")
      setCustomRemarks(false)
      setCostCenter("")
      setProject("")
      setLetterHead("")
      setPrintHeading("")
      setIsOpening(false)
      setBookAdvancePayments(false)
      setReconcileOnAdvancePaymentDate(false)
      setTaxes([])
      setSalesTaxesTemplate("")
      setPurchaseTaxesTemplate("")
      setApplyTaxWithholding(false)
      setTaxWithholdingCategory("")
      setClearanceDate("")
      companyRef.current = null
    }

    if (!initialValues) {
      setNamingSeries("ACC-PAY-.YYYY.-")
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
      setShowTaxes(false)
      setShowAccountingDimensions(false)
      setShowMoreInfo(false)
      setShowAccounts(false)
      setCustomRemarks(false)
    }
    setError("")
  }, [initialValues, invoice])

  // --- Payment type change (ERPNext parity: payment_type handler) ---
  useEffect(() => {
    if (isExisting) return
    if (isInternal) {
      setParty("")
      setPartyType("")
      setPartyName("")
      setPartyBalance(0)
      setPaidFrom("")
      setPaidFromCurrency("")
      setPaidFromBalance(0)
      setPaidFromType("")
      setPaidTo("")
      setPaidToCurrency("")
      setPaidToBalance(0)
      setPaidToType("")
      setPartyBankAccount("")
      setContactPerson("")
      setContactEmail("")
      setReferences([])
      setPaidAmount(0)
      setReceivedAmount(0)
    } else if (party) {
      handlePartyChange(party, partyType)
      if (modeOfPayment) {
        paymentService
          .getBankCashAccount(modeOfPayment, company)
          .then((account) => {
            if (isPay) setPaidFrom(account)
            else if (isReceive) setPaidTo(account)
          })
          .catch(() => {})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentType, isExisting])

  // --- Party type auto-set from payment type (ERPNext parity: set_default_party_type) ---
  useEffect(() => {
    if (isExisting) return
    if (party) return
    if (isReceive) setPartyType("Customer")
    else if (isPay) setPartyType("Supplier")
  }, [paymentType, isReceive, isPay, party, isExisting])

  // --- Fetch party details (ERPNext parity: party handler -> get_party_details cascade) ---
  const handlePartyChange = useCallback(
    async (partyValue: string, pType: string) => {
      if (!partyValue) {
        setContactPerson("")
        setContactEmail("")
        setPartyName("")
        setPartyBalance(0)
        setReferences([])
        return
      }
      if (!pType || !company || !postingDate) return

      setContactPerson("")
      setContactEmail("")

      validateLink(pType, partyValue, undefined, { dedupeKey: "party" }).catch(() => {})

      try {
        const details: PartyDetails = await paymentService.getPartyDetails(company, pType, partyValue, postingDate, costCenter)
        const partyAccount = details.party_account || ""
        const partyCurrency = details.party_account_currency || ""

        setPartyName(details.party_name || "")
        setPartyBalance(details.party_balance || 0)

        if (isReceive) {
          setPaidFrom(partyAccount)
          setPaidFromCurrency(partyCurrency)
        } else if (isPay) {
          setPaidTo(partyAccount)
          setPaidToCurrency(partyCurrency)
        }

        setReferences([])

        if (details.party_bank_account) setPartyBankAccount(details.party_bank_account)
        if (details.bank_account) setBankAccount(details.bank_account)

        if (partyAccount) {
          validateLink("Account", partyAccount, ["account_type"]).catch(() => {})
        }

        // Mirror ERPNext party handler: refresh the OTHER side's exchange rate
        // (the changed side is covered by the account-details cascade).
        const otherCurrency = isReceive ? paidToCurrency : paidFromCurrency
        if (otherCurrency) {
          const setter = isReceive ? setTargetExchangeRate : setSourceExchangeRate
          paymentService
            .getExchangeRate(otherCurrency, companyCurrency, postingDate, "party_other", { skipDedup: true })
            .then(setter)
            .catch(() => setter(1))
        }
      } catch {
        // party might not have details yet
      }
    },
    [company, postingDate, isReceive, isPay, costCenter, paidFromCurrency, paidToCurrency, companyCurrency]
  )

  // --- Party type change (ERPNext parity: party_type handler clears party/accounts when party set) ---
  const handlePartyTypeChange = (pType: string) => {
    setPartyType(pType)
    if (!party) return
    setParty("")
    setPartyName("")
    setPartyBalance(0)
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
    setReferences([])
  }

  // --- Auto-fetch party details once company is available ---
  useEffect(() => {
    if (isExisting) return
    if (!company || !party || !postingDate) return
    if ((isReceive && paidFrom) || (isPay && paidTo)) return
    handlePartyChange(party, partyType)
  }, [company, party, postingDate, isReceive, isPay, paidFrom, paidTo, partyType, handlePartyChange, isExisting])

  // --- Fetch account details when paid_from/paid_to change ---
  const fetchAccountDetails = useCallback(
    async (
      account: string,
      side: "paid_from" | "paid_to",
      setCurrency: (v: string) => void,
      setBalance: (v: number) => void,
      setType: (v: string) => void,
      setRate: (v: number) => void
    ) => {
      if (!account || !postingDate) return
      try {
        const details: AccountDetails = await paymentService.getAccountDetails(account, postingDate, costCenter)
        const currency = details.account_currency || ""
        setCurrency(currency)
        setBalance(details.account_balance || 0)
        setType(details.account_type || "")

        if (currency && company && postingDate) {
          validateLink("Currency", currency, undefined, { dedupeKey: side }).catch(() => {})
          paymentService
            .getExchangeRate(currency, companyCurrency, postingDate, side, { skipDedup: true })
            .then(setRate)
            .catch(() => setRate(1))
        }
      } catch {
        setCurrency("")
        setBalance(0)
        setType("")
      }
    },
    [postingDate, company, companyCurrency, costCenter]
  )

  useEffect(() => {
    if (isExisting) return
    if (paidFrom) fetchAccountDetails(paidFrom, "paid_from", setPaidFromCurrency, setPaidFromBalance, setPaidFromType, setSourceExchangeRate)
  }, [paidFrom, fetchAccountDetails, isExisting])

  useEffect(() => {
    if (isExisting) return
    if (paidTo) fetchAccountDetails(paidTo, "paid_to", setPaidToCurrency, setPaidToBalance, setPaidToType, setTargetExchangeRate)
  }, [paidTo, fetchAccountDetails, isExisting])

  // --- Fetch contact details when contact_person changes (ERPNext parity: contact_person handler -> get_contact_details) ---
  useEffect(() => {
    if (isExisting) return
    if (!contactPerson) {
      setContactEmail("")
      return
    }
    validateLink("Contact", contactPerson, undefined, { dedupeKey: "contact" }).catch(() => {})
    paymentService
      .getContactDetails(contactPerson)
      .then((details) => {
        setContactEmail(details.contact_email || "")
      })
      .catch(() => setContactEmail(""))
  }, [contactPerson, isExisting])

  // --- Refresh balances when cost_center changes (ERPNext parity: cost_center handler -> get_party_and_account_balance) ---
  const prevCostCenterRef = useRef(costCenter)
  useEffect(() => {
    if (isExisting) return
    const prev = prevCostCenterRef.current
    prevCostCenterRef.current = costCenter
    if (prev === costCenter) return
    if (!postingDate || (!paidFrom && !paidTo)) return
    paymentService
      .getPartyAndAccountBalance({
        company,
        date: postingDate,
        paid_from: paidFrom || "",
        paid_to: paidTo || "",
        party_type: partyType,
        party,
        cost_center: costCenter || undefined,
      })
      .then((res) => {
        setPaidFromBalance(res.paid_from_account_balance ?? 0)
        setPaidToBalance(res.paid_to_account_balance ?? 0)
        setPartyBalance(res.party_balance ?? 0)
      })
      .catch(() => {})
  }, [costCenter, postingDate, paidFrom, paidTo, company, partyType, party, isExisting])

  // --- Fetch exchange rates + validate currency links when account currencies change ---
  useEffect(() => {
    if (isExisting) return
    if (!paidFromCurrency) {
      setSourceExchangeRate(1)
      return
    }
    if (!postingDate || !company) return
    validateLink("Currency", paidFromCurrency, undefined, { dedupeKey: "paid_from" }).catch(() => {})
    paymentService.getExchangeRate(paidFromCurrency, companyCurrency, postingDate, "paid_from")
      .then(setSourceExchangeRate)
      .catch(() => setSourceExchangeRate(1))
  }, [paidFromCurrency, companyCurrency, postingDate, company, isExisting])

  useEffect(() => {
    if (isExisting) return
    if (!paidToCurrency) {
      setTargetExchangeRate(1)
      return
    }
    if (!postingDate || !company) return
    validateLink("Currency", paidToCurrency, undefined, { dedupeKey: "paid_to" }).catch(() => {})
    paymentService.getExchangeRate(paidToCurrency, companyCurrency, postingDate, "paid_to")
      .then(setTargetExchangeRate)
      .catch(() => setTargetExchangeRate(1))
  }, [paidToCurrency, companyCurrency, postingDate, company, isExisting])

  // --- Mode of Payment auto-sets account (ERPNext parity: sales_invoice.get_bank_cash_account) ---
  useEffect(() => {
    if (isExisting) return
    if (!modeOfPayment || !company) return
    if (!isPay && !isReceive) return

    validateLink("Mode of Payment", modeOfPayment).catch(() => {})

    paymentService
      .getBankCashAccount(modeOfPayment, company)
      .then((account) => {
        setModeOfPaymentError("")
        if (isPay) setPaidFrom(account)
        else if (isReceive) setPaidTo(account)
      })
      .catch((err) => {
        setModeOfPaymentError(
          err instanceof ApiError
            ? err.message
            : `No default Cash or Bank account found for Mode of Payment "${modeOfPayment}" in ${company}`
        )
      })
  }, [modeOfPayment, company, isPay, isReceive, isExisting])

  // --- Auto-fill Company Bank Account when the bank-side account changes (ERPNext parity: set_company_bank_account) ---
  useEffect(() => {
    if (isExisting) return
    const bankSideAccount = isPay ? paidFrom : isReceive ? paidTo : ""
    if (!company || !bankSideAccount) return

    validateLink("Account", bankSideAccount, ["account_type"]).catch(() => {})

    getValue("Bank Account", ["name"], { company, account: bankSideAccount, disabled: 0 })
      .then((res) => {
        const name = res.name as string | undefined
        if (name) {
          bankAccountFromAccountRef.current = true
          setBankAccount(name)
        }
      })
      .catch(() => {})
  }, [company, isPay, isReceive, paidFrom, paidTo, isExisting])

  // --- Show Bank + Bank Account No for the selected Company Bank Account ---
  useEffect(() => {
    if (!bankAccount) {
      setBankName("")
      setBankAccountNo("")
      return
    }
    paymentService
      .getBankAccountDetails(bankAccount)
      .then((details) => {
        setBankName(details.bank || "")
        setBankAccountNo(details.bank_account_no || "")
      })
      .catch(() => {
        setBankName("")
        setBankAccountNo("")
      })
  }, [bankAccount])

  // --- Auto-set the bank-side account when Company Bank Account changes (ERPNext parity: bank_account handler) ---
  useEffect(() => {
    if (isExisting) return
    if (!isPay && !isReceive) return
    if (bankAccountFromAccountRef.current) {
      bankAccountFromAccountRef.current = false
      return
    }
    if (!bankAccount) return

    paymentService
      .getBankAccountDetails(bankAccount)
      .then((details) => {
        const account = details.account
        if (!account) return
        if (!modeOfPayment) {
          if (isPay) setPaidFrom(account)
          else setPaidTo(account)
          return
        }
        getValue(
          "Mode of Payment Account",
          "default_account",
          { parent: modeOfPayment, company }
        )
          .then((res) => {
            const defaultAccount = res.default_account as string | undefined
            if (!defaultAccount) {
              if (isPay) setPaidFrom(account)
              else setPaidTo(account)
            }
          })
          .catch(() => {})
      })
      .catch(() => {})
  }, [bankAccount, modeOfPayment, company, isPay, isReceive, isExisting])

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
          exchange_gain_loss: r.exchange_gain_loss,
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

  // --- Tax helpers (mirrors ERPNext taxes_and_charges grid) ---
  const emptyTaxRow: PaymentEntryTax = {
    charge_type: "",
    add_deduct_tax: "Add",
    account_head: "",
    included_in_paid_amount: 0,
  }

  const handleTaxGridChange = (rows: PaymentEntryTax[]) => {
    setShowTaxes(true)
    setTaxes((prev) => {
      if (rows.length !== prev.length) return rows
      return prev.map((t, i) => {
        const incoming = rows[i]
        const display = computedTaxes[i] ?? t
        const patch: Partial<PaymentEntryTax> = {}
        ;(Object.keys(display) as (keyof PaymentEntryTax)[]).forEach((k) => {
          if (incoming[k] !== display[k]) (patch as Record<string, unknown>)[k] = incoming[k]
        })
        if (Object.keys(patch).length === 0) return t
        const next = { ...t, ...patch }
        if (patch.charge_type) {
          if (
            (patch.charge_type === "On Previous Row Amount" || patch.charge_type === "On Previous Row Total") &&
            i > 0
          ) {
            next.row_id = String(i)
          } else {
            next.row_id = ""
          }
        }
        return next
      })
    })
  }

  // --- Fetch taxes from template (mirrors fetch_taxes_from_template) ---
  useEffect(() => {
    if (isExisting) return
    if (partyType !== "Supplier" || !purchaseTaxesTemplate) return
    paymentService.fetchTaxesAndCharges("Purchase Taxes and Charges Template", purchaseTaxesTemplate)
      .then((rows) => {
        setTaxes(rows)
        setShowTaxes(true)
      })
      .catch(() => {})
  }, [purchaseTaxesTemplate, partyType, isExisting])

  useEffect(() => {
    if (isExisting) return
    if (partyType !== "Customer" || !salesTaxesTemplate) return
    paymentService.fetchTaxesAndCharges("Sales Taxes and Charges Template", salesTaxesTemplate)
      .then((rows) => {
        setTaxes(rows)
        setShowTaxes(true)
      })
      .catch(() => {})
  }, [salesTaxesTemplate, partyType, isExisting])

  // --- Withholding (mirrors apply_tax_withholding_amount handler) ---
  useEffect(() => {
    if (isExisting) return
    if (applyTaxWithholding && partyType === "Supplier" && party) {
      paymentService.getSupplierWithholding(party)
        .then((category) => {
          if (category) setTaxWithholdingCategory(category)
        })
        .catch(() => {})
    } else if (!applyTaxWithholding) {
      setTaxWithholdingCategory("")
    }
  }, [applyTaxWithholding, partyType, party, isExisting])

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

  // --- Exchange gain/loss auto-deduction (mirrors set_exchange_gain_loss_deduction) ---
  useEffect(() => {
    if (isExisting) return
    if (!company || (!isInternal && !showReceivedAmount)) return
    const exchangeGainLoss = Math.round((basePaidAmount - baseReceivedAmount) * 100) / 100
    if (!exchangeGainLoss) {
      setDeductions((prev) =>
        prev.some((d) => d.is_exchange_gain_loss) ? prev.filter((d) => !d.is_exchange_gain_loss) : prev
      )
      return
    }
    getCompanyDefaults()
      .then((defaults) => {
        if (!defaults.exchangeGainLossAccount) return
        setShowDeductions(true)
        setDeductions((prev) => {
          const existing = prev.find((d) => d.is_exchange_gain_loss)
          if (existing) {
            return prev.map((d) => (d.is_exchange_gain_loss ? { ...d, amount: exchangeGainLoss } : d))
          }
          return [
            ...prev,
            {
              id: createDeductionId(),
              account: defaults.exchangeGainLossAccount,
              cost_center: defaults.costCenter,
              amount: exchangeGainLoss,
              description: "Exchange Gain/Loss",
              is_exchange_gain_loss: 1,
            },
          ]
        })
      })
      .catch(() => {})
  }, [basePaidAmount, baseReceivedAmount, company, isInternal, showReceivedAmount, isExisting])

  // --- Write Off difference amount (mirrors set_write_off_deduction) ---
  const handleWriteOff = () => {
    const diff = Math.round(differenceAmount * 100) / 100
    if (!diff) return
    getCompanyDefaults()
      .then((defaults) => {
        if (!defaults.writeOffAccount) {
          setError("No Write Off Account is configured for this company.")
          return
        }
        setDeductions((prev) => {
          const existing = prev.find((d) => d.account === defaults.writeOffAccount && !d.is_exchange_gain_loss)
          if (existing) {
            return prev.map((d) =>
              d === existing
                ? { ...d, amount: Math.round((d.amount + diff) * 100) / 100 }
                : d
            )
          }
          return [
            ...prev,
            {
              id: createDeductionId(),
              account: defaults.writeOffAccount,
              cost_center: defaults.costCenter,
              amount: diff,
              description: "Write Off",
            },
          ]
        })
        setShowDeductions(true)
      })
      .catch(() => {})
  }

  // --- Submit ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (isReadOnly) return

    if (!isInternal && !party) { setError("Please select a party."); return }
    if (!paidFrom) { setError("Please select a Paid From account."); return }
    if (!paidTo) { setError("Please select a Paid To account."); return }
    if (paidAmount <= 0 && receivedAmount <= 0) { setError("Payment amount must be greater than zero."); return }
    if (needRefNo && !referenceNo) { setError("Reference No is required for bank accounts."); return }
    if (needRefDate && !referenceDate) { setError("Reference Date is required for bank accounts."); return }
    if (referenceDate && !isValidDateString(referenceDate)) { setError("Reference Date must be a valid date (YYYY-MM-DD)."); return }
    if (applyTaxWithholding && !taxWithholdingCategory) { setError("Tax Withholding Category is required when applying withholding."); return }

    const payload: RecordPaymentData = {
      naming_series: namingSeries,
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
      sales_taxes_and_charges_template: partyType === "Customer" ? salesTaxesTemplate || undefined : undefined,
      purchase_taxes_and_charges_template: partyType === "Supplier" ? purchaseTaxesTemplate || undefined : undefined,
      apply_tax_withholding_amount: applyTaxWithholding ? 1 : 0,
      tax_withholding_category: applyTaxWithholding ? taxWithholdingCategory || undefined : undefined,
      bank_account: bankAccount || undefined,
      party_bank_account: partyBankAccount || undefined,
      contact_person: contactPerson || undefined,
      contact_email: contactEmail || undefined,
      cost_center: costCenter || undefined,
      project: project || undefined,
      letter_head: letterHead || undefined,
      print_heading: printHeading || undefined,
      is_opening: isOpening ? 1 : 0,
      book_advance_payments_in_separate_party_account: bookAdvancePayments ? 1 : 0,
      reconcile_on_advance_payment_date: reconcileOnAdvancePaymentDate ? 1 : 0,
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
      clearance_date: clearanceDate || undefined,
      custom_remarks: customRemarks ? 1 : 0,
      remarks: remarks || undefined,
      amended_from: isExisting ? undefined : isAmend ? initialValues?.amended_from || initialValues?.name : undefined,
      references: referencesWithGainLoss.filter((r) => r.allocated_amount > 0),
      deductions: deductions
        .filter((d) => d.account && d.amount > 0)
        .map((d) => ({ account: d.account, cost_center: d.cost_center, amount: d.amount, description: d.description || undefined, is_exchange_gain_loss: d.is_exchange_gain_loss })),
      taxes: computedTaxes
        .filter((t) => t.account_head)
        .map((t) => ({
          charge_type: t.charge_type,
          row_id: t.row_id || undefined,
          account_head: t.account_head,
          description: t.description || undefined,
          rate: t.rate ?? undefined,
          tax_amount: t.tax_amount ?? undefined,
          total: t.total ?? undefined,
          add_deduct_tax: t.add_deduct_tax || "Add",
          included_in_paid_amount: t.included_in_paid_amount ? 1 : 0,
          cost_center: t.cost_center || undefined,
          project: t.project || undefined,
        })),
    }

    setSaving(true)
    try {
      const saved = isExisting
        ? await paymentService.updatePayment(initialValues.name, payload)
        : await paymentService.saveDraft(payload)
      onSaved(saved.name)
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

  const showWriteOffButton =
    !!differenceAmount && !!party && totalAllocated > (isReceive ? paidAmount : receivedAmount)

  const showAmountSection = !!paidFrom && !!paidTo

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {isAmend && (
        <div className="flex items-center gap-2 text-xs font-semibold text-warning-700 bg-warning-50 border border-warning-200 px-3 py-2 rounded-[10px]">
          <span>Amended from {initialValues?.amended_from || initialValues?.name}</span>
          <span className="text-muted">— Review references before saving.</span>
        </div>
      )}

      {/* Section 1: Type of Payment */}
      <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
        <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Type of Payment</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>{isExisting ? "Series" : <>Series <span className="text-danger-500">*</span></>}</label>
              {isExisting ? (
                <input
                  type="text"
                  value={namingSeries}
                  readOnly
                  className={`${inputClass} bg-gray-50`}
                />
              ) : (
                <select
                  value={namingSeries}
                  onChange={(e) => setNamingSeries(e.target.value)}
                  className={inputClass}
                >
                  <option value="ACC-PAY-.YYYY.-">ACC-PAY-.YYYY.-</option>
                </select>
              )}
            </div>
            <div>
              <label className={labelClass}>Payment Type <span className="text-danger-500">*</span></label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                disabled={isReadOnly}
                data-testid="payment_type"
                className={inputClass}
              >
                <option value="Receive">Receive</option>
                <option value="Pay">Pay</option>
                <option value="Internal Transfer">Internal Transfer</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Posting Date <span className="text-danger-500">*</span></label>
              <input type="date" value={postingDate} onChange={(e) => setPostingDate(e.target.value)} disabled={isReadOnly} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mode of Payment</label>
              <LinkField
                {...readOnlyLinkProps}
                doctype="Mode of Payment"
                value={modeOfPayment}
                onChange={setModeOfPayment}
                placeholder="Select mode..."
                searchMethod="search_link"
                referenceDoctype="Payment Entry"
                pageLength={10}
                testId="mop"
              />
              {modeOfPaymentError && (
                <p className="text-xs text-red-600 mt-1">{modeOfPaymentError}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Payment From/To (Party) */}
      {!isInternal && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Payment From/To</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Party Type</label>
                <select value={partyType} onChange={(e) => { handlePartyTypeChange(e.target.value) }} disabled={isReadOnly} data-testid="party_type" className={inputClass}>
                  <option value="">Select Party Type</option>
                  {partyTypes.length > 0
                    ? partyTypes.map((pt) => (
                        <option key={pt.name} value={pt.name}>{pt.name}</option>
                      ))
                    : ["Customer", "Supplier", "Employee"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                </select>
              </div>
              {partyType && (
              <div>
                <label className={labelClass}>Party</label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype={partyType}
                  value={party}
                  onChange={(v) => { setParty(v); handlePartyChange(v, partyType) }}
                  placeholder={`Search ${partyType.toLowerCase()}...`}
                  searchMethod="search_link"
                  referenceDoctype="Payment Entry"
                  pageLength={10}
                  testId="party"
                  queryMethod={partyType === "Employee" ? "erpnext.controllers.queries.employee_query" : undefined}
                />
              </div>
              )}
              {partyType && (
              <div>
                <label className={labelClass}>Party Name</label>
                <input type="text" value={partyName} readOnly className={`${inputClass} bg-gray-50`} />
              </div>
              )}
            </div>
            <div className="space-y-3">
              {party && (
                <div>
                  <label className={labelClass}>Company Bank Account</label>
                  <LinkField
                    {...readOnlyLinkProps}
                    doctype="Bank Account"
                    value={bankAccount}
                    onChange={setBankAccount}
                    placeholder="Select company bank..."
                    searchMethod="search_link"
                    referenceDoctype="Payment Entry"
                    pageLength={10}
                    searchLinkFilters={{ is_company_account: 1, company }}
                    testId="bank_account"
                  />
                </div>
              )}
              {bankAccount && (bankName || bankAccountNo) && (
                <div className="space-y-3">
                  {bankName && (
                    <div>
                      <label className={labelClass}>Bank</label>
                      <div className={`${inputClass} bg-gray-50`}>{bankName}</div>
                    </div>
                  )}
                  {bankAccountNo && (
                    <div>
                      <label className={labelClass}>Bank Account No</label>
                      <div className={`${inputClass} bg-gray-50`}>{bankAccountNo}</div>
                    </div>
                  )}
                </div>
              )}
              {party && (
                <div>
                  <label className={labelClass}>Party Bank Account</label>
                  <LinkField
                    {...readOnlyLinkProps}
                    doctype="Bank Account"
                    value={partyBankAccount}
                    onChange={setPartyBankAccount}
                    placeholder="Select party bank..."
                    searchMethod="search_link"
                    referenceDoctype="Payment Entry"
                    pageLength={10}
                    searchLinkFilters={{ is_company_account: 0, party_type: partyType, party }}
                    testId="party_bank_account"
                  />
                </div>
              )}
              {party && partyType !== "Employee" && (
                <div>
                  <label className={labelClass}>Contact Person</label>
                  <LinkField
                    {...readOnlyLinkProps}
                    doctype="Contact"
                    value={contactPerson}
                    onChange={setContactPerson}
                    placeholder="Search contact..."
                    searchMethod="search_link"
                    referenceDoctype="Payment Entry"
                    pageLength={10}
                    queryMethod="frappe.contacts.doctype.contact.contact.contact_query"
                    searchLinkFilters={{ link_doctype: partyType, link_name: party }}
                    testId="contact_person"
                  />
                </div>
              )}
              {(contactPerson || partyType === "Employee") && contactEmail && (
                <div>
                  <label className={labelClass}>Email</label>
                  <input type="text" value={contactEmail} readOnly className={`${inputClass} bg-gray-50`} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Accounts */}
      <CollapsibleSection
        title="Accounts"
        open={showAccounts}
        onToggle={() => setShowAccounts(!showAccounts)}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {party && (
              <div>
                <label className={labelClass}>Party Balance</label>
                <div className={`${inputClass} bg-gray-50 tabular-nums`}>
                  {formatCurrency(partyBalance, partyAccountCurrency || companyCurrency)}
                </div>
              </div>
            )}
            {showPaidFromField && (
              <div>
                <label className={labelClass}>Account Paid From <span className="text-danger-500">*</span></label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Account"
                  value={paidFrom}
                  onChange={setPaidFrom}
                  placeholder="Select account..."
                  searchMethod="search_link"
                  referenceDoctype="Payment Entry"
                  pageLength={10}
                  searchLinkFilters={{
                    account_type: ["in", isPay || isInternal ? ["Bank", "Cash"] : [partyAccountTypes[partyType]]],
                    is_group: 0,
                    company,
                  }}
                  testId="paid_from"
                />
                {paidFrom && (
                  <>
                    <label className={labelClass}>Account Currency (From)</label>
                    <div className={`${inputClass} bg-gray-50`}>{paidFromCurrency || "—"}</div>
                    <label className={labelClass}>Account Balance (From)</label>
                    <div className={`${inputClass} bg-gray-50 tabular-nums`}>{formatCurrency(paidFromBalance, paidFromCurrency)}</div>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="space-y-3">
            {showPaidToField && (
              <div>
                <label className={labelClass}>Account Paid To <span className="text-danger-500">*</span></label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Account"
                  value={paidTo}
                  onChange={setPaidTo}
                  placeholder="Select account..."
                  searchMethod="search_link"
                  referenceDoctype="Payment Entry"
                  pageLength={10}
                  searchLinkFilters={{
                    account_type: ["in", isReceive || isInternal ? ["Bank", "Cash"] : [partyAccountTypes[partyType]]],
                    is_group: 0,
                    company,
                  }}
                  testId="paid_to"
                />
                {paidTo && (
                  <>
                    <label className={labelClass}>Account Currency (To)</label>
                    <div className={`${inputClass} bg-gray-50`}>{paidToCurrency || "—"}</div>
                    <label className={labelClass}>Account Balance (To)</label>
                    <div className={`${inputClass} bg-gray-50 tabular-nums`}>{formatCurrency(paidToBalance, paidToCurrency)}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 4: Amount (gated on accounts) */}
      {showAmountSection && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Amount</p>
          <div className={cn("grid grid-cols-1 gap-3", showReceivedAmount && "lg:grid-cols-2")}>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Paid Amount ({paidFromCurrency || companyCurrency}) <span className="text-danger-500">*</span></label>
                <input
                  type="number" min={0} step={0.01}
                  value={paidAmount}
                  data-testid="paid_amount"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setPaidAmount(v)
                    if (!showReceivedAmount) setReceivedAmount(v)
                  }}
                  disabled={isReadOnly}
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
                    disabled={isReadOnly}
                    className={inputClass}
                  />
                  <p className="text-[10px] text-muted mt-1">1 {paidFromCurrency} = {sourceExchangeRate} {companyCurrency}</p>
                </div>
              )}
              {showBasePaid && (
                <div>
                  <label className={labelClass}>Base Paid Amount ({companyCurrency})</label>
                  <input type="text" value={formatCurrency(basePaidAmount, companyCurrency)} readOnly className={`${inputClass} bg-gray-50`} />
                </div>
              )}
            </div>
            {showReceivedAmount && (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Received Amount ({paidToCurrency || companyCurrency}) <span className="text-danger-500">*</span></label>
                  <input
                    type="number" min={0} step={0.01}
                    value={receivedAmount}
                    data-testid="received_amount"
                    onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                    disabled={isReadOnly}
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
                      disabled={isReadOnly}
                      className={inputClass}
                    />
                    <p className="text-[10px] text-muted mt-1">1 {paidToCurrency} = {targetExchangeRate} {companyCurrency}</p>
                  </div>
                )}
                {showBaseReceived && (
                  <div>
                    <label className={labelClass}>Base Received Amount ({companyCurrency})</label>
                    <input type="text" value={formatCurrency(baseReceivedAmount, companyCurrency)} readOnly className={`${inputClass} bg-gray-50`} />
                  </div>
                )}
              </div>
            )}
          </div>
          {computedTaxes.length > 0 && (
            <div>
              <label className={labelClass}>Paid Amount After Tax ({companyCurrency})</label>
              <input type="text" value={formatCurrency(paidAmountAfterTax, companyCurrency)} readOnly className={`${inputClass} bg-gray-50`} />
            </div>
          )}
        </div>
      )}

      {/* Section 5: References */}
      {!!(party && paidFrom && paidTo && paidAmount && receivedAmount) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">References</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openOutstandingDialog("Get Outstanding Invoices")}
                disabled={isReadOnly}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileText size={12} /> Get Outstanding Invoices
              </button>
              <button
                type="button"
                onClick={() => openOutstandingDialog("Get Outstanding Orders")}
                disabled={isReadOnly}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                    {multiCurrency && (
                      <th className="text-right py-1.5 text-xs font-semibold text-muted">Exchange Gain/Loss</th>
                    )}
                    <th className="text-right py-1.5 text-xs font-semibold text-muted w-[110px]">Allocate</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {referencesWithGainLoss.map((r) => (
                    <tr key={r.reference_name} className="border-b border-border/30">
                      <td className="py-1.5 text-xs text-muted">{r.reference_doctype}</td>
                      <td className="py-1.5 font-medium text-heading">{r.reference_name}</td>
                      <td className="py-1.5 text-xs text-muted hidden md:table-cell">{r.due_date || "—"}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{formatCurrency(r.total_amount, partyAccountCurrency)}</td>
                      <td className="py-1.5 text-right text-muted tabular-nums">{formatCurrency(r.outstanding_amount, partyAccountCurrency)}</td>
                      {multiCurrency && (
                        <td className="py-1.5 text-right text-muted tabular-nums">
                          {r.exchange_gain_loss != null ? formatCurrency(r.exchange_gain_loss, partyAccountCurrency) : "—"}
                        </td>
                      )}
                      <td className="py-1.5 text-right">
                        <input
                          type="number" min={0} max={r.outstanding_amount} step={0.01}
                          value={r.allocated_amount}
                          onChange={(e) => updateAllocation(r.reference_name, parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          className="w-24 px-2 py-1 text-sm text-right border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
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

      {/* Section 6: Writeoff */}
      {!!(paidAmount && receivedAmount) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Write Off</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            <div className="space-y-3">
              {!!(paidAmount && receivedAmount && references.length > 0) && (
                <div>
                  <span className="text-muted">Total Allocated ({partyAccountCurrency || companyCurrency})</span>
                  <p className="font-bold text-heading tabular-nums">{formatCurrency(totalAllocated, partyAccountCurrency)}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {!!(paidAmount && receivedAmount && references.length > 0) && (
                <div>
                  <span className="text-muted">Unallocated ({partyAccountCurrency || companyCurrency})</span>
                  <p className="font-bold text-heading tabular-nums">{formatCurrency(unallocated, partyAccountCurrency)}</p>
                </div>
              )}
              {!!(paidAmount && receivedAmount) && (
                <div>
                  <span className="text-muted">Difference ({companyCurrency})</span>
                  <p className={cn("font-bold tabular-nums", differenceAmount !== 0 ? "text-danger-600" : "text-heading")}>{formatCurrency(differenceAmount, companyCurrency)}</p>
                </div>
              )}
              {showWriteOffButton && (
                <button
                  type="button"
                  onClick={handleWriteOff}
                  disabled={isReadOnly}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Write Off Difference Amount
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section 7: Deductions or Loss */}
      {!!(paidAmount && receivedAmount) && (
      <CollapsibleSection
        title="Deductions or Loss"
        open={showDeductions || deductions.length > 0}
        onToggle={() => setShowDeductions(!(showDeductions || deductions.length > 0))}
        badge={deductions.length > 0 ? `(${deductions.length})` : ""}
      >
        <div className="space-y-2">
          {deductions.map((d) => (
            <div key={d.id} className="grid grid-cols-[1fr_1fr_100px_1fr_auto] gap-2 items-start">
              <LinkField
                {...readOnlyLinkProps}
                doctype="Account"
                value={d.account}
                onChange={(v) => updateDeduction(d.id, "account", v)}
                placeholder="Account"
                filters={[["is_group", "=", 0], ["company", "=", company]]}
              />
              <LinkField
                {...readOnlyLinkProps}
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
                disabled={isReadOnly}
                className={inputClass}
              />
              <input
                type="text"
                value={d.description}
                onChange={(e) => updateDeduction(d.id, "description", e.target.value)}
                placeholder="Description"
                disabled={isReadOnly}
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
            disabled={isReadOnly}
            className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> Add Deduction
          </button>
        </div>
      </CollapsibleSection>
      )}

      {/* Section 8: Taxes and Charges */}
      {!isInternal && (partyType === "Customer" || partyType === "Supplier") && (
        <CollapsibleSection
          title="Taxes and Charges"
          open={showTaxes}
          onToggle={() => setShowTaxes(!showTaxes)}
          badge={taxes.length > 0 ? `(${taxes.length})` : ""}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {partyType === "Supplier" && (
              <div>
                <label className={labelClass}>Purchase Taxes and Charges Template</label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Purchase Taxes and Charges Template"
                  value={purchaseTaxesTemplate}
                  onChange={setPurchaseTaxesTemplate}
                  placeholder="Select template..."
                  searchMethod="search_link"
                  referenceDoctype="Payment Entry"
                  pageLength={10}
                  searchLinkFilters={{ company, disabled: false }}
                />
              </div>
            )}
            {partyType === "Customer" && (
              <div>
                <label className={labelClass}>Sales Taxes and Charges Template</label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Sales Taxes and Charges Template"
                  value={salesTaxesTemplate}
                  onChange={setSalesTaxesTemplate}
                  placeholder="Select template..."
                  searchMethod="search_link"
                  referenceDoctype="Payment Entry"
                  pageLength={10}
                  searchLinkFilters={{ company, disabled: false }}
                />
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Section 8b: Advance Taxes and Charges (standalone grid like ERPNext child table) */}
      {!isInternal && (partyType === "Customer" || partyType === "Supplier") && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <ChildTableGrid<PaymentEntryTax>
            title="Advance Taxes and Charges"
            rows={computedTaxes}
            onChange={handleTaxGridChange}
            emptyRow={emptyTaxRow}
            readOnly={isReadOnly}
            columns={[
              { key: "charge_type", label: "Type", type: "link", options: CHARGE_TYPES },
              {
                key: "account_head",
                label: "Account Head",
                type: "link",
                docType: "Account",
                searchFn: (q) => searchLink("Account", q, undefined, [["is_group", "=", 0], ["company", "=", company]]).then((items) => ({ items })),
                validate: (v) => validateLink("Account", v),
              },
              { key: "rate", label: "Tax Rate", type: "number", placeholder: "Tax Rate", disabled: (row) => row.charge_type === "Actual" },
              { key: "tax_amount", label: "Amount", type: "number", disabled: (row) => row.charge_type !== "Actual" },
              { key: "total", label: "Total", type: "readonly" },
            ] as GridColumn<PaymentEntryTax>[]}
          />

          {computedTaxes.length > 0 && totalTaxesAndCharges !== 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted">Total Taxes and Charges ({partyAccountCurrency || companyCurrency})</span>
                <p className="font-bold text-heading tabular-nums">{formatCurrency(totalTaxesAndCharges, partyAccountCurrency)}</p>
              </div>
              {partyAccountCurrency && partyAccountCurrency !== companyCurrency && (
                <div>
                  <span className="text-muted">Total Taxes and Charges ({companyCurrency})</span>
                  <p className="font-bold text-heading tabular-nums">{formatCurrency(baseTotalTaxesAndCharges, companyCurrency)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Section 9: Transaction ID */}
      {!!(paidFrom && paidTo) && (
      <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
        <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Transaction ID</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Reference No {needRefNo && <span className="text-danger-500">*</span>}</label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                disabled={isReadOnly}
                className={inputClass}
                placeholder="Cheque/Reference No"
                data-testid="reference_no"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Reference Date {needRefDate && <span className="text-danger-500">*</span>}</label>
              <input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} disabled={isReadOnly} pattern="\d{4}-\d{2}-\d{2}" data-testid="reference_date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Clearance Date</label>
              <input
                type="date"
                value={clearanceDate}
                onChange={(e) => setClearanceDate(e.target.value)}
                disabled={isReadOnly}
                data-testid="clearance_date"
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Section 10: More Information (gated like ERPNext) */}
      {!!(paidFrom && paidTo && paidAmount && receivedAmount) && (
        <CollapsibleSection
          title="More Information"
          open={showMoreInfo}
          onToggle={() => setShowMoreInfo(!showMoreInfo)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  disabled={isReadOnly}
                  className={inputClass}
                  placeholder="Payment remarks..."
                />
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Letter Head</label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Letter Head"
                  value={letterHead}
                  onChange={setLetterHead}
                  placeholder="Select letter head..."
                />
              </div>
              <div>
                <label className={labelClass}>Print Heading</label>
                <LinkField
                  {...readOnlyLinkProps}
                  doctype="Print Heading"
                  value={printHeading}
                  onChange={setPrintHeading}
                  placeholder="Select print heading..."
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                  <input
                    type="checkbox"
                    checked={isOpening}
                    onChange={(e) => setIsOpening(e.target.checked)}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                  />
                  Opening Entry
                </label>
                <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                  <input
                    type="checkbox"
                    checked={bookAdvancePayments}
                    onChange={(e) => setBookAdvancePayments(e.target.checked)}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                  />
                  Book Advance Payments in Separate Party Account
                </label>
                <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                  <input
                    type="checkbox"
                    checked={reconcileOnAdvancePaymentDate}
                    onChange={(e) => setReconcileOnAdvancePaymentDate(e.target.checked)}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                  />
                  Reconcile on Advance Payment Date
                </label>
                <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                  <input
                    type="checkbox"
                    checked={customRemarks}
                    onChange={(e) => setCustomRemarks(e.target.checked)}
                    disabled={isReadOnly}
                    className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                  />
                  Custom Remarks
                </label>
              </div>
              {partyType === "Supplier" && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                    <input
                      type="checkbox"
                      checked={applyTaxWithholding}
                      onChange={(e) => setApplyTaxWithholding(e.target.checked)}
                      disabled={isReadOnly}
                      className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                    />
                    Apply Tax Withholding Amount
                  </label>
                  {applyTaxWithholding && (
                    <LinkField
                      {...readOnlyLinkProps}
                      doctype="Tax Withholding Category"
                      value={taxWithholdingCategory}
                      onChange={setTaxWithholdingCategory}
                      placeholder="Select category..."
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Section 11: Accounting Dimensions */}
      {(isExisting || dimensions.length > 0) && (
        <CollapsibleSection
          title="Accounting Dimensions"
          open={showAccountingDimensions}
          onToggle={() => setShowAccountingDimensions(!showAccountingDimensions)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              {(dimensions.length === 0 || dimensions.some((d) => d.fieldname === "project")) && (
                <div>
                  <label className={labelClass}>Project</label>
                  <LinkField
                    {...readOnlyLinkProps}
                    doctype="Project"
                    value={project}
                    onChange={setProject}
                    placeholder="Select project..."
                    filters={[
                      ["company", "=", company],
                      ...(partyType === "Customer" && party ? [["customer", "=", party]] : []),
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              {(dimensions.length === 0 || dimensions.some((d) => d.fieldname === "cost_center")) && (
                <div>
                  <label className={labelClass}>Cost Center</label>
                  <LinkField
                    {...readOnlyLinkProps}
                    doctype="Cost Center"
                    value={costCenter}
                    onChange={setCostCenter}
                    placeholder="Select cost center..."
                    filters={[
                      ["is_group", "=", 0],
                      ["company", "=", company],
                    ]}
                  />
                </div>
              )}
              {isExisting && (
                <div>
                  <label className={labelClass}>Status</label>
                  <input
                    type="text"
                    value={initialValues.status || (docstatus === 1 ? "Submitted" : docstatus === 2 ? "Cancelled" : "Draft")}
                    readOnly
                    className={`${inputClass} bg-gray-50`}
                  />
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Error */}
      {error && (
        <p data-testid="form_error" className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        {isExisting ? (
          isReadOnly ? (
            <>
              <button
                type="button"
                onClick={() => onToolbarAction?.("delete")}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-danger-600 bg-danger-50 border border-danger-100 rounded-[12px] hover:bg-danger-100 transition-colors"
              >
                <Trash2 size={16} /> Delete
              </button>
              {docstatus === 0 && (
                <button
                  type="button"
                  onClick={() => onToolbarAction?.("submit")}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 transition-all duration-200 shadow-sm"
                >
                  <Check size={16} /> Submit
                </button>
              )}
              {docstatus === 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => onToolbarAction?.("amend")}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-600 bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
                  >
                    <GitBranch size={16} /> Amend
                  </button>
                  <button
                    type="button"
                    onClick={() => onToolbarAction?.("cancel")}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
                  >
                    <Ban size={16} /> Cancel
                  </button>
                </>
              )}
              {docstatus === 2 && (
                <button
                  type="button"
                  onClick={() => onToolbarAction?.("amend")}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-600 bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
                >
                  <GitBranch size={16} /> Amend
                </button>
              )}
              <button
                type="button"
                onClick={() => onToolbarAction?.("duplicate")}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
              >
                <Copy size={16} /> Duplicate
              </button>
              <button
                type="button"
                onClick={() => onToolbarAction?.("email")}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
              >
                <Mail size={16} /> Email
              </button>
              <button
                type="button"
                onClick={() => onToolbarAction?.("print")}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
              >
                <Printer size={16} /> Print
              </button>
            </>
          ) : (
            <>
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
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )
        ) : (
          <>
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
              data-testid="save_button"
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save as Draft"}
            </button>
          </>
        )}
      </div>

      {/* Outstanding Dialog */}
      <GetOutstandingDialog
        open={outstandingDialogOpen}
        onClose={() => setOutstandingDialogOpen(false)}
        onFetch={handleFetchOutstanding}
        loading={fetchingOutstanding}
        title={outstandingDialogTitle}
        dimensions={dimensions.filter((d) => d.document_type !== "Project")}
      />
    </form>
  )
}
