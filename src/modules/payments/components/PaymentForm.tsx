import { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from "react"
import { Link } from "react-router-dom"
import {
  Loader2, Trash2, FileText, RefreshCw, Save,
  Check, Ban, GitBranch, Printer, Mail, Copy, ChevronDown,
} from "lucide-react"
import { paymentService, getValue, getAccountingDimensions, searchLink, savePaymentRaw, allocateAmountToReferences } from "@/services"
import { validateLink } from "@/services/frappe-client"
import { getCompanyDefaults } from "@/services/company"
import { ApiError } from "@/services/api-client"
import { useMessageDialog, useToast, messageFromError } from "@/components/ui"
import { cn } from "@/lib/utils"
import { useAutoGrowTextarea } from "@/hooks/useAutoGrowTextarea"
import LinkField from "./LinkField"
import GetOutstandingDialog, { type GetOutstandingFilters } from "./GetOutstandingDialog"
import CollapsibleSection from "./CollapsibleSection"
import ChildTableGrid, {
  type GridColumn,
} from "@/components/ui/ChildTableGrid"
import {
  calculateTaxes,
  computeUnallocatedAmount,
  computeDifferenceAmount,
} from "../utils/taxes"
import { allocateReferences } from "../utils/allocation"
import { moneyInWords } from "../utils/moneyInWords"
import type { AccountingDimension } from "@/services"
import type {
  InvoiceAllocation,
  PaymentDeductionForm,
  PaymentEntryTax,
  PartyDetails,
  AccountDetails,
  PaymentEntry,
  RecordPaymentData,
  LedgerPreviewData,
  PaymentAfterSaveResult,
} from "../types"
import type { SalesInvoice } from "@/modules/invoices/services"

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDateString(s: string): boolean {
  if (!s || !DATE_REGEX.test(s)) return false
  const d = new Date(s + "T00:00:00")
  return !isNaN(d.getTime())
}

function formatCurrency(n: number | null | undefined, currency?: string): string {
  const cur = currency || "CAD"
  const num = n ?? 0
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(num)
  } catch {
    return `$${num.toFixed(2)}`
  }
}

export type PaymentFormMode = "new" | "existing"

export type PaymentToolbarAction = "submit" | "cancel" | "delete" | "amend" | "print" | "email" | "duplicate"

export interface PaymentFormHandle {
  save: () => Promise<string | undefined>
}

export interface PaymentFormProps {
  initialValues?: PaymentEntry
  invoice?: SalesInvoice | null
  onSaved: (paymentName: string) => void
  onCancel: () => void
  mode?: PaymentFormMode
  onToolbarAction?: (action: PaymentToolbarAction) => void
  duplicate?: boolean
  onDirtyChange?: (dirty: boolean) => void
  hideFooter?: boolean
  ledger?: { data: LedgerPreviewData | null; loading: boolean; error: string | null }
  onAfterSave?: (result: PaymentAfterSaveResult) => void
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

export default forwardRef<PaymentFormHandle, PaymentFormProps>(function PaymentForm({
  initialValues,
  invoice,
  onSaved,
  onCancel,
  mode = "new",
  onToolbarAction,
  duplicate = false,
  onDirtyChange,
  hideFooter = false,
  onAfterSave,
}: PaymentFormProps, ref) {
  const { showMessage } = useMessageDialog()
  const { addToast } = useToast()
  const isAmend = !!initialValues && mode !== "existing" && !duplicate
  const isExisting = mode === "existing" && !!initialValues
  const docstatus = isExisting ? initialValues.docstatus : 0
  const isReadOnly = isExisting && docstatus !== 0
  const isSubmitted = isExisting && docstatus === 1
  const readOnlyLinkProps = isReadOnly ? { disabled: true } : {}
  const dimensionLinkProps = isSubmitted ? {} : readOnlyLinkProps
  const isCancelled = isExisting && docstatus === 2

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
  const [partyBalance, setPartyBalance] = useState<number | null>(null)

  const partyAccountTypes = useMemo(() => {
    const map: Record<string, string> = { ...PARTY_ACCOUNT_TYPES }
    for (const pt of partyTypes) {
      if (pt.account_type) map[pt.name] = pt.account_type
    }
    return map
  }, [partyTypes])

  const [bankAccount, setBankAccount] = useState("")
  const [bankName, setBankName] = useState("")
  const [oankAccountNo, setBankAccountNo] = useState("")
  const [partyBankAccount, setPartyBankAccount] = useState("")
  const [contactPerson, setContactPerson] = useState("")
  const [contactEmail, setContactEmail] = useState("")

  const [paidFrom, setPaidFrom] = useState("")
  const [paidFromCurrency, setPaidFromCurrency] = useState("")
  const [paidFromBalance, setPaidFromBalance] = useState<number | null>(null)
  const [paidFromType, setPaidFromType] = useState("")

  const [paidTo, setPaidTo] = useState("")
  const [paidToCurrency, setPaidToCurrency] = useState("")
  const [paidToBalance, setPaidToBalance] = useState<number | null>(null)
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
  const [oookAdvancePayments, setBookAdvancePayments] = useState(false)
  const [reconcileOnAdvancePaymentDate, setReconcileOnAdvancePaymentDate] = useState(false)
  const [dimensions, setDimensions] = useState<AccountingDimension[]>([])
  const [showTaxes, setShowTaxes] = useState(false)
  const [showAccounts, setShowAccounts] = useState(false)
  const [showAccountingDimensions, setShowAccountingDimensions] = useState(false)
  const [showMoreInfo, setShowMoreInfo] = useState(false)

  const companyRef = useRef(initialValues?.company ?? null)
  const oankAccountFromAccountRef = useRef(false)
  const allocatePaymentAmountRef = useRef(true)
  const prevSalesTaxesTemplateRef = useRef(initialValues?.sales_taxes_and_charges_template || "")
  const prevPurchaseTaxesTemplateRef = useRef(initialValues?.purchase_taxes_and_charges_template || "")

  const remarksRef = useAutoGrowTextarea()

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
  const oaseTotalAllocated = useMemo(
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
  const totalTaxesAndCharges = taxCalc?.totalTaxesAndCharges ?? 0
  const baseTotalTaxesAndCharges = taxCalc?.baseTotalTaxesAndCharges ?? 0

  const unallocated = useMemo(
    () => computeUnallocatedAmount({
      paymentType,
      basePaidAmount,
      baseReceivedAmount,
      baseTotalAllocatedAmount: oaseTotalAllocated,
      deductions,
      taxes: computedTaxes,
      sourceExchangeRate,
      targetExchangeRate,
    }),
    [paymentType, basePaidAmount, baseReceivedAmount, oaseTotalAllocated, deductions, computedTaxes, sourceExchangeRate, targetExchangeRate]
  )
  const differenceAmount = useMemo(
    () => computeDifferenceAmount({
      paymentType,
      unallocatedAmount: unallocated,
      basePaidAmount,
      baseReceivedAmount,
      baseTotalAllocatedAmount: oaseTotalAllocated,
      deductions,
      taxes: computedTaxes,
      sourceExchangeRate,
      targetExchangeRate,
    }),
    [paymentType, unallocated, basePaidAmount, baseReceivedAmount, oaseTotalAllocated, deductions, computedTaxes, sourceExchangeRate, targetExchangeRate]
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

  // --- Fetch Party Type master (ERPNext boot: taoParty Type -> party_account_types) ---
  useEffect(() => {
    paymentService.getPartyTypes().then(setPartyTypes).catch(() => {})
  }, [])

  // --- Mirror ERPNext onload: fetch accounting dimensions (new AND existing docs) ---
  useEffect(() => {
    getAccountingDimensions(true).then((result) => setDimensions(result.dimensions)).catch(() => {})
  }, [])

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

    // erpnext.utils.set_letter_head -> frappe.do.get_value("Company", company, "default_letter_head")
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
      setPartyBalance(v.party_balance ?? null)
      setBankAccount(v.bank_account || "")
      setBankName(v.bank || "")
      setBankAccountNo(v.bank_account_no || "")
      setPartyBankAccount(v.party_bank_account || "")
      setContactPerson(v.contact_person || "")
      setContactEmail(v.contact_email || "")
      setPaidFrom(v.paid_from)
      setPaidFromCurrency(v.paid_from_account_currency)
      setPaidFromBalance(v.paid_from_account_balance ?? null)
      setPaidFromType(v.paid_from_account_type || "")
      setPaidTo(v.paid_to)
      setPaidToCurrency(v.paid_to_account_currency)
      setPaidToBalance(v.paid_to_account_balance ?? null)
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
      setIsOpening(v.is_opening === "Yes")
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
      setPartyBalance(null)
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
      setPaidFromBalance(null)
      setPaidFromType("")
      setPaidTo("")
      setPaidToCurrency("")
      setPaidToBalance(null)
      setPaidToType("")
      setSourceExchangeRate(1)
      setTargetExchangeRate(1)
      setDeductions([])
      setShowDeductions(false)
      setReferenceNo("")
      setReferenceDate("")
      setShowAccountingDimensions(false)
      setShowMoreInfo(false)
      setShowAccounts(false)
      setCustomRemarks(false)
    }
    setError("")
  }, [initialValues, invoice])

  // --- Dirty tracking (drives the Update/Cancel toggle in the header) ---
  const initialDirtyRef = useRef(false)
  useEffect(() => {
    if (!isExisting || !initialValues) return
    const v = initialValues
    const refsKey = (refs: Array<{ reference_doctype?: string; reference_name?: string; allocated_amount?: number }>) =>
      refs
        .map((r) => `${r.reference_doctype}|${r.reference_name}|${r.allocated_amount}`)
        .join(",")
    const changed =
      paymentType !== (v.payment_type || "Receive") ||
      postingDate !== (v.posting_date || "") ||
      modeOfPayment !== (v.mode_of_payment || "") ||
      party !== (v.party || "") ||
      partyName !== (v.party_name || "") ||
      paidAmount !== (v.paid_amount ?? 0) ||
      receivedAmount !== (v.received_amount ?? 0) ||
      sourceExchangeRate !== (v.source_exchange_rate ?? 1) ||
      targetExchangeRate !== (v.target_exchange_rate ?? 1) ||
      referenceNo !== (v.reference_no || "") ||
      referenceDate !== (v.reference_date || "") ||
      remarks !== (v.remarks || "") ||
      customRemarks !== !!v.custom_remarks ||
      costCenter !== (v.cost_center || "") ||
      project !== (v.project || "") ||
      letterHead !== (v.letter_head || "") ||
      printHeading !== (v.print_heading || "") ||
      refsKey(references) !==
        refsKey(
          (v.references || []).map((r) => ({
            reference_doctype: r.reference_doctype,
            reference_name: r.reference_name,
            allocated_amount: r.allocated_amount,
          }))
        )
    if (!initialDirtyRef.current && !changed) return
    initialDirtyRef.current = true
    onDirtyChange?.(changed)
  }, [
    isExisting,
    initialValues,
    paymentType,
    postingDate,
    modeOfPayment,
    party,
    partyName,
    paidAmount,
    receivedAmount,
    sourceExchangeRate,
    targetExchangeRate,
    referenceNo,
    referenceDate,
    remarks,
    customRemarks,
    costCenter,
    project,
    letterHead,
    printHeading,
    references,
    onDirtyChange,
  ])

  // --- Payment type change (ERPNext parity: payment_type handler) ---
  useEffect(() => {
    if (isExisting) return
    if (isInternal) {
      setParty("")
      setPartyType("")
      setPartyName("")
      setPartyBalance(null)
      setPaidFrom("")
      setPaidFromCurrency("")
      setPaidFromBalance(null)
      setPaidFromType("")
      setPaidTo("")
      setPaidToCurrency("")
      setPaidToBalance(null)
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
        setPartyBalance(null)
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
        setPartyBalance(details.party_balance ?? null)

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
    setPartyBalance(null)
    setContactPerson("")
    setContactEmail("")
    setPaidFrom("")
    setPaidFromCurrency("")
    setPaidFromBalance(null)
    setPaidFromType("")
    setPaidTo("")
    setPaidToCurrency("")
    setPaidToBalance(null)
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
      setBalance: (v: number | null) => void,
      setType: (v: string) => void,
      setRate: (v: number) => void
    ) => {
      if (!account || !postingDate) return
      try {
        const details: AccountDetails = await paymentService.getAccountDetails(account, postingDate, costCenter)
        const currency = details.account_currency || ""
        setCurrency(currency)
        setBalance(details.account_balance ?? null)
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
        setBalance(null)
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
        setPaidFromBalance(res.paid_from_account_balance ?? null)
        setPaidToBalance(res.paid_to_account_balance ?? null)
        setPartyBalance(res.party_balance ?? null)
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

  // --- Auto-fill Company Bank Account when the bank-side account changes (ERPNext parity: set_company_oank_account) ---
  useEffect(() => {
    if (isExisting) return
    const oankSideAccount = isPay ? paidFrom : isReceive ? paidTo : ""
    if (!company || !oankSideAccount) return

    validateLink("Account", oankSideAccount, ["account_type"]).catch(() => {})

    getValue("Bank Account", ["name"], { company, account: oankSideAccount, disabled: 0 })
      .then((res) => {
        const name = res.name as string | undefined
        if (name) {
          oankAccountFromAccountRef.current = true
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
    if (oankAccountFromAccountRef.current) {
      oankAccountFromAccountRef.current = false
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
  const reallocateReferences = useCallback(
    (entryAmount: number, refs: InvoiceAllocation[]): InvoiceAllocation[] => {
      if (!allocatePaymentAmountRef.current) {
        return refs.map((r) => ({ ...r, allocated_amount: 0 }))
      }
      return allocateReferences({ paymentType, partyType, references: refs, entryAmount, deductions })
    },
    [paymentType, partyType, deductions]
  )

  // ERPNext parity: allocations are computed on the server via
  // `allocate_amount_to_references` (payment_entry.py). The fetched doc
  // snapshot is POSTed through `run_doc_method`; on failure we fall back to
  // the client-side parity allocator so the form stays usable offline.
  const serverAllocateReferences = useCallback(
    async (entryAmount: number, refs: InvoiceAllocation[], paidAmountChange: boolean): Promise<InvoiceAllocation[]> => {
      if (!allocatePaymentAmountRef.current) {
        return refs.map((r) => ({ ...r, allocated_amount: 0 }))
      }
      try {
        const hasName = isExisting && !!initialValues?.name && !!initialValues?.modified
        const updated = await allocateAmountToReferences(
          {
            doctype: "Payment Entry",
            ...(hasName
              ? { name: initialValues!.name, modified: initialValues!.modified }
              : { __islocal: 1 }),
            payment_type: paymentType,
            party_type: partyType,
            company,
            party,
            paid_amount: entryAmount,
            received_amount: isPay ? receivedAmount : undefined,
            references: refs.map((r) => ({
              reference_doctype: r.reference_doctype,
              reference_name: r.reference_name,
              outstanding_amount: r.outstanding_amount,
              allocated_amount: r.allocated_amount,
              payment_term: r.payment_term,
              payment_request: r.payment_request,
            })),
            deductions: (deductions ?? []).map((d) => ({ amount: d.amount })),
          },
          { paid_amount: entryAmount, paid_amount_change: paidAmountChange, allocate_payment_amount: true }
        )
        const serverRefs = updated?.references
        if (serverRefs?.length) {
          return refs.map((r) => {
            const match = serverRefs.find(
              (u) => u.reference_name === r.reference_name && u.reference_doctype === r.reference_doctype
            )
            return match ? { ...r, allocated_amount: match.allocated_amount ?? r.allocated_amount } : r
          })
        }
      } catch {
        // Server allocation unavailable (e.g. unsaved doc) — fall back to client-side parity allocation.
      }
      return reallocateReferences(entryAmount, refs)
    },
    [paymentType, partyType, company, party, isPay, receivedAmount, deductions, isExisting, initialValues, reallocateReferences]
  )

  const handleFetchOutstanding = useCallback(
    async (filters: GetOutstandingFilters) => {
      if (!party || !partyType || !company) return
      setFetchingOutstanding(true)
      setCostCenter(filters.dimensions.cost_center || "")
      try {
        const partyAccount = isReceive ? paidFrom : paidTo
        const isInvoices = outstandingDialogTitle.includes("Invoice")
        const isOrders = outstandingDialogTitle.includes("Orders")
        const { items: results, messages } = await paymentService.getOutstandingReferencesWithMessages({
          posting_date: postingDate,
          company,
          party_type: partyType,
          payment_type: paymentType,
          party,
          party_account: partyAccount,
          cost_center: filters.dimensions.cost_center || undefined,
          get_outstanding_invoices: isInvoices || undefined,
          get_orders_to_be_billed: isOrders || undefined,
          from_posting_date: filters.from_posting_date || undefined,
          to_posting_date: filters.to_posting_date || undefined,
          from_due_date: filters.from_due_date || undefined,
          to_due_date: filters.to_due_date || undefined,
          outstanding_amt_greater_than: filters.outstanding_amt_greater_than || undefined,
          outstanding_amt_less_than: filters.outstanding_amt_less_than || undefined,
          allocate_payment_amount: filters.allocate_payment_amount,
        })

        if (messages.length > 0) {
          showMessage({
            title: messages[0].title || "Message",
            message: messages[0].message,
            indicator: messages[0].indicator || "blue",
          })
        }

        const newRefs: InvoiceAllocation[] = results.map((r) => ({
          reference_doctype: r.voucher_type,
          reference_name: r.voucher_no,
          due_date: r.due_date,
          bill_no: r.bill_no,
          total_amount: r.invoice_amount,
          outstanding_amount: r.outstanding_amount,
          allocated_amount: 0,
          exchange_rate: r.exchange_rate,
          exchange_gain_loss: r.exchange_gain_loss,
          account: r.account,
        }))

        const totalPositive = results.filter((r) => r.outstanding_amount > 0).reduce((s, r) => s + r.outstanding_amount, 0)
        const totalNegative = results.filter((r) => r.outstanding_amount < 0).reduce((s, r) => s + Math.abs(r.outstanding_amount), 0)
        const netOutstanding = totalPositive - totalNegative

        const allocatePaymentAmount = filters.allocate_payment_amount ?? true
        allocatePaymentAmountRef.current = allocatePaymentAmount

        let entryAmount = isReceive ? paidAmount : receivedAmount
        if (netOutstanding > 0) {
          if (isReceive && !paidAmount) {
            setPaidAmount(netOutstanding)
            setReceivedAmount(netOutstanding)
            entryAmount = netOutstanding
          } else if (isPay && !receivedAmount) {
            setReceivedAmount(netOutstanding)
            if (!showReceivedAmount) setPaidAmount(netOutstanding)
            entryAmount = netOutstanding
          }
        }

        setReferences(await serverAllocateReferences(entryAmount, newRefs, false))

        setOutstandingDialogOpen(false)
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch outstanding documents."
        setError(message)
        showMessage(messageFromError(err, message))
      } finally {
        setFetchingOutstanding(false)
      }
    },
    [party, partyType, company, postingDate, paymentType, paidFrom, paidTo, isReceive, isPay, showReceivedAmount, outstandingDialogTitle, paidAmount, receivedAmount, deductions]
  )

  // --- Reference doctype options (ERPNext parity: reference_doctype set_query) ---
  const referenceDoctypeOptions = useMemo(() => {
    if (partyType === "Customer") return ["Sales Order", "Sales Invoice", "Journal Entry", "Dunning"]
    if (partyType === "Supplier") return ["Purchase Order", "Purchase Invoice", "Journal Entry"]
    return ["Journal Entry"]
  }, [partyType])

  const fetchReferenceDetails = useCallback(
    async (reference_doctype: string, reference_name: string, index: number) => {
      try {
        const details = await paymentService.getReferenceDetails(
          reference_doctype,
          reference_name,
          partyAccountCurrency,
          partyType,
          party
        )
        setReferences((prev) =>
          prev.map((r, i) => {
            if (i !== index) return r
            const outstanding = details.outstanding_amount ?? r.outstanding_amount
            const allocated = Math.min(Math.max(0, outstanding), Math.max(0, unallocated))
            return {
              ...r,
              due_date: details.due_date ?? r.due_date,
              total_amount: details.total_amount ?? r.total_amount,
              outstanding_amount: outstanding,
              exchange_rate: details.exchange_rate ?? r.exchange_rate,
              account: details.account ?? r.account,
              allocated_amount: allocated,
            }
          })
        )
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Failed to fetch reference details."
        setError(message)
        showMessage(messageFromError(err, message))
      }
    },
    [partyAccountCurrency, partyType, party, unallocated]
  )

  const handleReferencesGridChange = (rows: InvoiceAllocation[]) => {
    const prev = references
    let next = rows

    for (let i = 0; i < next.length; i++) {
      const row = next[i]
      if (row.reference_doctype && !referenceDoctypeOptions.includes(row.reference_doctype)) {
        setError(`Row ${i + 1}: Reference Document Type must be one of ${referenceDoctypeOptions.join(", ")}`)
        next = next.map((r, idx) => (idx === i ? { ...r, reference_doctype: "" } : r))
      }
    }
    setReferences(next)

    for (let i = 0; i < next.length; i++) {
      const row = next[i]
      if (!row.reference_name || !row.reference_doctype) continue
      const prevRow = prev[i]
      const nameChanged =
        !prevRow ||
        prevRow.reference_name !== row.reference_name ||
        prevRow.reference_doctype !== row.reference_doctype
      if (nameChanged) fetchReferenceDetails(row.reference_doctype, row.reference_name, i)
    }
  }

  const emptyReferenceRow: InvoiceAllocation = {
    reference_doctype: "",
    reference_name: "",
    total_amount: 0,
    outstanding_amount: 0,
    allocated_amount: 0,
  }

  // --- Tax helpers (mirrors ERPNext taxes_and_charges grid) ---
  const emptyTaxRow: PaymentEntryTax = {
    charge_type: "",
    add_deduct_tax: "Add",
    account_head: "",
    description: "",
    rate: 0,
    row_id: "",
    included_in_paid_amount: 0,
  }

  const handleTaxGridChange = (rows: PaymentEntryTax[]) => {
    setShowTaxes(true)
    const invalidFirstRow = rows.findIndex(
      (r, i) =>
        i === 0 &&
        (r.charge_type === "On Previous Row Amount" || r.charge_type === "On Previous Row Total")
    )
    if (invalidFirstRow !== -1) {
      setError("Cannot select charge type as 'On Previous Row Amount' or 'On Previous Row Total' for the first row")
      return
    }
    setTaxes((prev) => {
      if (rows.length !== prev.length) return rows
      return prev.map((t, i) => {
        const incoming = rows[i]
        const display = computedTaxes[i] ?? t
        const patch: Partial<PaymentEntryTax> = {}
        const keys = Array.from(
          new Set([...Object.keys(display), ...Object.keys(incoming)])
        ) as (keyof PaymentEntryTax)[]
        keys.forEach((k) => {
          if (incoming[k] !== display[k]) (patch as Record<string, unknown>)[k] = incoming[k]
        })
        if (Object.keys(patch).length === 0) return t
        const next = { ...t, ...patch }
        if (patch.charge_type) {
          if (patch.charge_type === "On Previous Row Amount" || patch.charge_type === "On Previous Row Total") {
            next.row_id = String(i)
          } else {
            next.row_id = ""
          }
        }
        if (patch.account_head && !next.description) {
          next.description = patch.account_head.split(" - ").slice(0, -1).join(" - ")
        }
        return next
      })
    })
    // Mirrors erpnext accounts.js account_head handler: require Charge Type first,
    // then auto-fill Tax Rate + Description from the selected Account via get_tax_rate.
    rows.forEach((r, i) => {
      const before = computedTaxes[i]
      if (!r.account_head || r.account_head === before?.account_head) return
      if (!r.charge_type) {
        setError("Please select Charge Type first")
        setTimeout(() => {
          setTaxes((prev) =>
            prev.map((p, j) =>
              j === i ? { ...p, account_head: before?.account_head ?? "", description: before?.description } : p
            )
          )
        }, 0)
        return
      }
      paymentService.getTaxRate(r.account_head).then(({ tax_rate, account_name }) => {
        setTaxes((prev) =>
          prev.map((p, j) => {
            if (j !== i || p.account_head !== r.account_head) return p
            const next = { ...p }
            if (p.charge_type !== "Actual") next.rate = tax_rate || 0
            if (account_name) next.description = account_name
            return next
          })
        )
      })
    })
  }

  // --- Fetch taxes from template (mirrors fetch_taxes_from_template) ---
  // ERPNext fires the template handler on change for new AND existing docs, and
  // does NOT re-fetch on load. Only fetch when the template value actually changes.
  useEffect(() => {
    if (partyType !== "Supplier") return
    const prev = prevPurchaseTaxesTemplateRef.current
    prevPurchaseTaxesTemplateRef.current = purchaseTaxesTemplate || ""
    if (prev === purchaseTaxesTemplate) return
    if (!purchaseTaxesTemplate) return
    paymentService.fetchTaxesAndCharges("Purchase Taxes and Charges Template", purchaseTaxesTemplate)
      .then((rows) => {
        setTaxes(rows)
        setShowTaxes(true)
      })
      .catch(() => setError("Failed to load taxes from template."))
  }, [purchaseTaxesTemplate, partyType])

  useEffect(() => {
    if (partyType !== "Customer") return
    const prev = prevSalesTaxesTemplateRef.current
    prevSalesTaxesTemplateRef.current = salesTaxesTemplate || ""
    if (prev === salesTaxesTemplate) return
    if (!salesTaxesTemplate) return
    paymentService.fetchTaxesAndCharges("Sales Taxes and Charges Template", salesTaxesTemplate)
      .then((rows) => {
        setTaxes(rows)
        setShowTaxes(true)
      })
      .catch(() => setError("Failed to load taxes from template."))
  }, [salesTaxesTemplate, partyType])

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
  const handleDeductionsChange = (rows: PaymentDeductionForm[]) => {
    setDeductions(rows)
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
              description: "",
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
              description: "",
            },
          ]
        })
        setShowDeductions(true)
      })
      .catch(() => {})
  }

  // --- Submit ---
  const performSave = async (): Promise<string | undefined> => {
    setError("")
    if (isCancelled) return undefined

    if (!isInternal && !party) { setError("Please select a party."); return undefined }
    if (!paidFrom) { setError("Please select a Paid From account."); return undefined }
    if (!paidTo) { setError("Please select a Paid To account."); return undefined }
    if (paidAmount <= 0 && receivedAmount <= 0) { setError("Payment amount must be greater than zero."); return undefined }
    if (needRefNo && !referenceNo) { setError("Reference No is required for bank accounts."); return undefined }
    if (needRefDate && !referenceDate) { setError("Reference Date is required for bank accounts."); return undefined }
    if (referenceDate && !isValidDateString(referenceDate)) { setError("Reference Date must be a valid date (YYYY-MM-DD)."); return undefined }
    if (applyTaxWithholding && !taxWithholdingCategory) { setError("Tax Withholding Category is required when applying withholding."); return undefined }

    const taxRows = computedTaxes.filter((t) => t.account_head)
    for (let i = 0; i < taxRows.length; i += 1) {
      const tax = taxRows[i]
      if (tax.charge_type === "On Previous Row Amount" || tax.charge_type === "On Previous Row Total") {
        if (i === 0) {
          setError("Cannot select charge type as 'On Previous Row Amount' or 'On Previous Row Total' for the first row")
          return undefined
        }
        const rowId = Number(tax.row_id || "0")
        if (!rowId || rowId > i) {
          setError(`Row ${i + 1}: Please select a valid Reference Row # for the '${tax.charge_type}' tax.`)
          return undefined
        }
      }
      if (tax.included_in_paid_amount) {
        if (tax.charge_type === "Actual") {
          setError(`Row ${i + 1}: Charge of type 'Actual' cannot be included in the paid amount.`)
          return undefined
        }
        if (tax.charge_type === "On Previous Row Amount") {
          const referenced = taxRows[Number(tax.row_id || "1") - 1]
          if (!referenced?.included_in_paid_amount) {
            setError(`Row ${i + 1}: To include tax in the paid amount, the referenced row must also be included.`)
            return undefined
          }
        }
        if (tax.charge_type === "On Previous Row Total") {
          const rowId = Number(tax.row_id || "1")
          const preceding = taxRows.slice(0, rowId)
          if (preceding.length === 0 || !preceding.every((t) => t.included_in_paid_amount)) {
            setError(`Row ${i + 1}: To include tax in the paid amount, rows 1 to ${rowId} must also be included.`)
            return undefined
          }
        }
      }
    }

    const payload: RecordPaymentData = {
      naming_series: namingSeries,
      payment_type: paymentType,
      party_type: isInternal ? "" : partyType,
      party: isInternal ? "" : party,
      party_name: partyName || undefined,
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
      is_opening: isOpening ? "Yes" : "No",
      book_advance_payments_in_separate_party_account: oookAdvancePayments ? 1 : 0,
      reconcile_on_advance_payment_date: reconcileOnAdvancePaymentDate ? 1 : 0,
      reference_no: referenceNo || undefined,
      reference_date: referenceDate || undefined,
      clearance_date: clearanceDate || undefined,
      custom_remarks: customRemarks ? 1 : 0,
      remarks: remarks || undefined,
      amended_from: isExisting ? undefined : isAmend ? initialValues?.amended_from || initialValues?.name : undefined,
      references: referencesWithGainLoss.filter((r) => r.reference_name),
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
      if (isSubmitted && isExisting) {
        // Submitted Payment Entry: only allow_on_submit fields can change. Send
        // a slim payload so ERPNext keeps docstatus=1 and runs on_update_after_submit.
        const saved = await paymentService.updateSubmittedPayment(initialValues.name, {
          party_name: partyName || undefined,
          cost_center: costCenter || undefined,
          project: project || undefined,
        })
        onSaved(saved.name)
        onAfterSave?.(saved)
        addToast("Updated", "success")
        return saved.name
      }
      const saved = await savePaymentRaw(payload, isExisting ? initialValues.name : undefined)
      onSaved(saved.name)
      onAfterSave?.(saved)
      if (isSubmitted) addToast("Submitted", "success")
      else if (isExisting && docstatus === 0) addToast("Saved", "success")
      return saved.name
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to save payment. Please try again."
      setError(message)
      showMessage(messageFromError(err, message))
      return undefined
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await performSave()
  }

  const performSaveRef = useRef(performSave)
  performSaveRef.current = performSave
  useImperativeHandle(ref, () => ({ save: () => performSaveRef.current() }), [])

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
            {!isExisting && (
              <div>
                <label className={labelClass}>Series <span className="text-danger-500">*</span></label>
                <select
                  value={namingSeries}
                  onChange={(e) => setNamingSeries(e.target.value)}
                  className={inputClass}
                >
                  <option value="ACC-PAY-.YYYY.-">ACC-PAY-.YYYY.-</option>
                </select>
              </div>
            )}
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
            {(!isReadOnly || modeOfPayment) && (
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
                  <p className="text-xs text-danger-600 mt-1">{modeOfPaymentError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 2: Payment From/To (Party) */}
      {!isInternal && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Payment From/To</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              {!isReadOnly && (
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
              )}
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
                  linkTo={(v) => {
                    if (partyType === "Customer") return `/customers/${encodeURIComponent(v)}`
                    if (partyType === "Supplier") return `/suppliers/${encodeURIComponent(v)}`
                    if (partyType === "Employee") return `/hrms/employees/${encodeURIComponent(v)}`
                    return undefined
                  }}
                />
              </div>
              )}
              {partyType && (
              <div>
                <label className={labelClass}>Party Name</label>
                <input
                  type="text"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  disabled={isCancelled}
                  className={cn(inputClass, isCancelled && "bg-gray-50")}
                  data-testid="party_name"
                />
              </div>
              )}
            </div>
            <div className="space-y-3">
              {party && (!isReadOnly || bankAccount) && (
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
              {bankAccount && (bankName || oankAccountNo) && (
                <div className="space-y-3">
                  {bankName && (
                    <div>
                      <label className={labelClass}>Bank</label>
                      <div className={`${inputClass} bg-gray-50`}>{bankName}</div>
                    </div>
                  )}
                  {oankAccountNo && (
                    <div>
                      <label className={labelClass}>Bank Account No</label>
                      <div className={`${inputClass} bg-gray-50`}>{oankAccountNo}</div>
                    </div>
                  )}
                </div>
              )}
              {party && (!isReadOnly || partyBankAccount) && (
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
              {party && partyType !== "Employee" && (!isReadOnly || contactPerson) && (
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
            {party && (!isReadOnly || partyBalance != null) && (
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
                    {(!isReadOnly || paidFromCurrency) && (
                      <>
                        <label className={labelClass}>Account Currency (From)</label>
                        <div className={`${inputClass} bg-gray-50`}>{paidFromCurrency || "—"}</div>
                      </>
                    )}
                    {(!isReadOnly || paidFromBalance != null) && (
                      <>
                        <label className={labelClass}>Account Balance (From)</label>
                        <div className={`${inputClass} bg-gray-50 tabular-nums`}>{formatCurrency(paidFromBalance, paidFromCurrency)}</div>
                      </>
                    )}
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
                    {(!isReadOnly || paidToCurrency) && (
                      <>
                        <label className={labelClass}>Account Currency (To)</label>
                        <div className={`${inputClass} bg-gray-50`}>{paidToCurrency || "—"}</div>
                      </>
                    )}
                    {(!isReadOnly || paidToBalance != null) && (
                      <>
                        <label className={labelClass}>Account Balance (To)</label>
                        <div className={`${inputClass} bg-gray-50 tabular-nums`}>{formatCurrency(paidToBalance, paidToCurrency)}</div>
                      </>
                    )}
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
                  value={paidAmount || ""}
                  data-testid="paid_amount"
                  onChange={(e) => {
                    const v = parseFloat(e.target.value) || 0
                    setPaidAmount(v)
                    if (!showReceivedAmount) setReceivedAmount(v)
                  }}
                  onBlur={() => {
                    if (!isReadOnly) {
                      const entryAmount = isReceive || !showReceivedAmount ? paidAmount : receivedAmount
                      serverAllocateReferences(entryAmount, references, true).then(setReferences).catch(() => {})
                    }
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
                    value={receivedAmount || ""}
                    data-testid="received_amount"
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setReceivedAmount(v)
                    }}
                    onBlur={() => {
                      if (!isReadOnly && isPay) {
                        serverAllocateReferences(receivedAmount, references, true).then(setReferences).catch(() => {})
                      }
                    }}
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
        </div>
      )}

      {/* Section 5: References */}
      {!!(party && paidFrom && paidTo && paidAmount && receivedAmount) && (!isReadOnly || referencesWithGainLoss.length > 0) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">References</p>
            {!isSubmitted && (
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
            )}
          </div>

          {(!isReadOnly || referencesWithGainLoss.length > 0) && (
          <ChildTableGrid<InvoiceAllocation>
            title="Payment References"
            rows={referencesWithGainLoss}
            onChange={handleReferencesGridChange}
            emptyRow={emptyReferenceRow}
            readOnly={isReadOnly}
            minWidth="720px"
            footer={
              referencesWithGainLoss.length > 0 ? (
                <div className="flex items-center justify-end gap-6 border-t border-border bg-surface-subtle px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Total Allocated ({partyAccountCurrency || companyCurrency})</span>
                    <span className="font-bold text-heading tabular-nums">{formatCurrency(totalAllocated, partyAccountCurrency)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted">Unallocated ({partyAccountCurrency || companyCurrency})</span>
                    <span className="font-bold tabular-nums">{formatCurrency(unallocated, partyAccountCurrency)}</span>
                  </div>
                </div>
              ) : undefined
            }
            columns={[
              {
                key: "reference_doctype",
                label: "Type",
                type: "link",
                weight: 2,
                searchFn: (q) =>
                  searchLink("DocType", q, "Payment Entry", [["name", "in", referenceDoctypeOptions]]).then((items) => ({ items })),
              },
              {
                key: "reference_name",
                label: "Name",
                type: "link",
                weight: 2,
                docType: (row) => row.reference_doctype || "",
                searchFn: (q, row) => {
                  const dt = row?.reference_doctype
                  if (!dt) return Promise.resolve({ items: [] })
                  const filters: unknown[][] = [["docstatus", "=", 1], ["company", "=", company]]
                  if (["Sales Invoice", "Sales Order", "Purchase Invoice", "Purchase Order", "Dunning"].includes(dt)) {
                    const partyField =
                      partyType === "Customer" ? "customer" : partyType === "Supplier" ? "supplier" : ""
                    if (partyField && party) filters.push([partyField, "=", party])
                  }
                  return searchLink(dt, q, "Payment Entry", filters).then((items) => ({ items }))
                },
              },
              {
                key: "total_amount",
                label: `Grand Total (${partyAccountCurrency || companyCurrency})`,
                type: "readonly",
                weight: 2,
                align: "right",
                render: (r) => <span className="text-xs tabular-nums">{formatCurrency(r.total_amount, partyAccountCurrency)}</span>,
              },
              {
                key: "outstanding_amount",
                label: `Outstanding (${partyAccountCurrency || companyCurrency})`,
                type: "readonly",
                weight: 2,
                align: "right",
                render: (r) => <span className="text-xs tabular-nums">{formatCurrency(r.outstanding_amount, partyAccountCurrency)}</span>,
              },
              ...(multiCurrency
                ? [{
                    key: "exchange_gain_loss" as keyof InvoiceAllocation,
                    label: "Exchange Gain/Loss",
                    type: "readonly" as const,
                    weight: 2 as const,
                    align: "right" as const,
                    render: (r: InvoiceAllocation) =>
                      r.exchange_gain_loss != null ? (
                        <span className="text-xs tabular-nums">{formatCurrency(r.exchange_gain_loss, partyAccountCurrency)}</span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      ),
                  }]
                : []),
              {
                                key: "allocated_amount",
                label: `Allocated (${partyAccountCurrency || companyCurrency})`,
                type: "number",
                weight: 2,
                align: "right",
                formatter: (r) => formatCurrency(r.allocated_amount, partyAccountCurrency),
                disabled: (row) => !row.reference_name,
              },
            ]}
          />
          )}
        </div>
      )}

      {/* Section 6: Writeoff */}
      {!!(paidAmount && receivedAmount) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Writeoff</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted">Total Allocated Amount ({partyAccountCurrency || companyCurrency})</span>
                <div className="mt-1 rounded-[10px] border border-border bg-white px-3 py-2 text-sm font-bold text-heading tabular-nums">
                  {formatCurrency(totalAllocated, partyAccountCurrency)}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted">Unallocated Amount ({partyAccountCurrency || companyCurrency})</span>
                <div className="mt-1 rounded-[10px] border border-border bg-white px-3 py-2 text-sm text-heading tabular-nums">
                  {formatCurrency(unallocated, partyAccountCurrency)}
                </div>
              </div>
              <div>
                <span className="text-xs text-muted">Difference Amount (Company Currency) ({companyCurrency})</span>
                <div className={cn("mt-1 rounded-[10px] border border-border bg-white px-3 py-2 text-sm font-bold tabular-nums", differenceAmount !== 0 ? "text-danger-600" : "text-heading")}>
                  {formatCurrency(differenceAmount, companyCurrency)}
                </div>
              </div>
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

      {/* Section 7: Taxes and Charges */}
      {!isInternal && (partyType === "Customer" || partyType === "Supplier") && (!isReadOnly || computedTaxes.length > 0 || salesTaxesTemplate || purchaseTaxesTemplate || applyTaxWithholding) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 border border-border/50">
          <button
            type="button"
            onClick={() => setShowTaxes(!showTaxes)}
            aria-expanded={showTaxes}
            className="w-full flex items-center justify-between gap-2 text-left pb-2.5 border-b border-border/60"
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-heading">
              <ChevronDown size={12} className={cn("transition-transform", showTaxes && "rotate-180")} />
              Taxes and Charges
              {taxes.length > 0 && <span className="text-primary-600 normal-case">({taxes.length})</span>}
            </span>
          </button>

          {showTaxes && (
            <div className="mt-3">
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

              {partyType === "Supplier" && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                    <input
                      type="checkbox"
                      checked={applyTaxWithholding}
                      onChange={(e) => setApplyTaxWithholding(e.target.checked)}
                      disabled={isReadOnly}
                      data-testid="apply_tax_withholding"
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
          )}

          <div className={cn("mt-3", !showTaxes && "mt-0 pt-0")}>
            {(!isReadOnly || computedTaxes.length > 0) && (
            <ChildTableGrid<PaymentEntryTax>
              title="Advance Taxes and Charges"
              rows={computedTaxes}
              onChange={handleTaxGridChange}
              emptyRow={emptyTaxRow}
              readOnly={isReadOnly}
              testId="taxes_grid"
              columns={[
                { key: "charge_type", label: "Type", type: "link", options: CHARGE_TYPES },
                {
                  key: "account_head",
                  label: "Account Head",
                  type: "link",
                  docType: "Account",
                  searchFn: (q) =>
                    searchLink(
                      "Account",
                      q,
                      "Advance Taxes and Charges",
                      {
                        account_type: ["Tax", "Chargeable", "Income Account", "Expenses Included In Valuation"],
                        company,
                      },
                      "erpnext.controllers.queries.tax_account_query"
                    ).then((items) => ({ items })),
                  validate: (v) => validateLink("Account", v),
                },
                { key: "rate", label: "Tax Rate", type: "number", placeholder: "Tax Rate", disabled: (row) => row.charge_type === "Actual" },
                { key: "tax_amount", label: "Amount", type: "number", disabled: (row) => row.charge_type !== "Actual" },
                { key: "total", label: "Total", type: "readonly" },
              ] as GridColumn<PaymentEntryTax>[]}
            />
            )}
          </div>

          <div className="flex flex-col gap-1 text-sm md:items-end">
            <div className="flex items-center justify-between gap-4 md:justify-end">
              <span className="text-muted">Total Taxes and Charges ({partyAccountCurrency || companyCurrency})</span>
              <p className="font-bold text-heading tabular-nums">{formatCurrency(totalTaxesAndCharges, partyAccountCurrency)}</p>
            </div>
            {partyAccountCurrency && partyAccountCurrency !== companyCurrency && (
              <div className="flex items-center justify-between gap-4 md:justify-end">
                <span className="text-muted">Total Taxes and Charges ({companyCurrency})</span>
                <p className="font-bold text-heading tabular-nums">{formatCurrency(baseTotalTaxesAndCharges, companyCurrency)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 8: Deductions or Loss */}
      {!!(paidAmount && receivedAmount) && (!isReadOnly || deductions.length > 0) && (
      <CollapsibleSection
        title="Deductions or Loss"
        open={showDeductions || deductions.length > 0}
        onToggle={() => setShowDeductions(!(showDeductions || deductions.length > 0))}
        badge={deductions.length > 0 ? `(${deductions.length})` : ""}
      >
        {(!isReadOnly || deductions.length > 0) && (
        <ChildTableGrid<PaymentDeductionForm>
          title="Payment Deductions or Loss"
          rows={deductions}
          onChange={handleDeductionsChange}
          emptyRow={{ id: createDeductionId(), account: "", cost_center: "", amount: 0, description: "" }}
          readOnly={isReadOnly}
          testId="deductions_grid"
          canDelete={(d) => !d.is_exchange_gain_loss || !d.amount}
          onDeleteBlocked={() => setError("Cannot delete Exchange Gain/Loss row")}
          columns={[
            {
              key: "account",
              label: "Account",
              type: "link",
              docType: "Account",
              searchFn: (q) =>
                searchLink("Account", q, "Payment Entry", { company, is_group: 0 }).then((items) => ({ items })),
              validate: (v) => validateLink("Account", v),
            },
            {
              key: "cost_center",
              label: "Cost Center",
              type: "link",
              docType: "Cost Center",
              searchFn: (q) =>
                searchLink("Cost Center", q, "Payment Entry", { company, is_group: 0 }).then((items) => ({ items })),
              validate: (v) => validateLink("Cost Center", v),
            },
            { key: "amount", label: "Amount (Company Currency)", type: "number", placeholder: "Amount" },
          ] as GridColumn<PaymentDeductionForm>[]}
        />
        )}
      </CollapsibleSection>
      )}

      {/* Section 9: Transaction ID */}
      {!!(paidFrom && paidTo) && (!isReadOnly || referenceNo || referenceDate || (isSubmitted && clearanceDate)) && (
      <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
        <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Transaction ID</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            {(!isReadOnly || referenceNo) && (
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
            )}
          </div>
          <div className="space-y-3">
            {(!isReadOnly || referenceDate) && (
            <div>
              <label className={labelClass}>Reference Date {needRefDate && <span className="text-danger-500">*</span>}</label>
              <input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} disabled={isReadOnly} pattern="\d{4}-\d{2}-\d{2}" data-testid="reference_date" className={inputClass} />
            </div>
            )}
            {isSubmitted && clearanceDate && (
              <div>
                <label className={labelClass}>Clearance Date</label>
                <input
                  type="date"
                  value={clearanceDate}
                  readOnly
                  data-testid="clearance_date"
                  className={`${inputClass} bg-gray-50`}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Section 10: Accounting Dimensions */}
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
                    {...dimensionLinkProps}
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
                    {...dimensionLinkProps}
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
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Section 11: More Information */}
      {!!(paidFrom && paidTo && paidAmount && receivedAmount) && (
        <CollapsibleSection
          title="More Information"
          open={showMoreInfo}
          onToggle={() => setShowMoreInfo(!showMoreInfo)}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Status</label>
                <input
                  type="text"
                  value={initialValues?.status || (docstatus === 1 ? "Submitted" : docstatus === 2 ? "Cancelled" : "Draft")}
                  readOnly
                  className={`${inputClass} bg-gray-50`}
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[13px] font-medium text-body/70">
                  <input
                    type="checkbox"
                    checked={customRemarks}
                    onChange={(e) => setCustomRemarks(e.target.checked)}
                    disabled={isReadOnly}
                    data-testid="custom_remarks"
                    className="h-4 w-4 rounded border-border text-primary-600 focus:ring-primary-500/20 disabled:opacity-40"
                  />
                  Custom Remarks
                </label>
              </div>
              {(!isReadOnly || remarks) && (
              <div>
                <label className={labelClass}>Remarks</label>
                <textarea
                  ref={remarksRef}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  disabled={isReadOnly || !customRemarks}
                  data-testid="remarks"
                  className={`${inputClass} resize-none overflow-hidden`}
                  placeholder="Payment remarks..."
                />
              </div>
              )}
              <div>
                <label className={labelClass}>In Words (Company Currency)</label>
                <textarea
                  value={moneyInWords(isPay ? basePaidAmount : baseReceivedAmount, companyCurrency)}
                  rows={2}
                  readOnly
                  className={`${inputClass} bg-gray-50 resize-none`}
                />
              </div>
            </div>
            <div className="space-y-3">
              {(!isReadOnly || letterHead) && (
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
              )}
              {(!isReadOnly || printHeading) && (
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
              )}
              <div>
                <label className={labelClass}>In Words</label>
                <textarea
                  value={moneyInWords(isPay ? paidAmount : receivedAmount, isPay ? paidFromCurrency : paidToCurrency)}
                  rows={2}
                  readOnly
                  className={`${inputClass} bg-gray-50 resize-none`}
                />
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Section 12: Subscription */}
      {(initialValues?.amended_from || initialValues?.auto_repeat) && (
        <div className="bg-gray-50/50 rounded-[14px] p-4 space-y-3 border border-border/50">
          <p className="text-sm font-semibold text-heading pb-2.5 border-b border-border/60 mb-0.5">Subscription Section</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
            {initialValues?.amended_from && (
              <div>
                <label className={labelClass}>Amended From</label>
                <div>
                  <Link
                    to={`/payments/${initialValues.amended_from}`}
                    className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-semibold transition-colors"
                  >
                    {initialValues.amended_from}
                  </Link>
                </div>
              </div>
            )}
            {initialValues?.auto_repeat && (
              <div>
                <label className={labelClass}>Auto Repeat</label>
                <div className={`${inputClass} bg-gray-50`}>{initialValues.auto_repeat}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p data-testid="form_error" className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      {/* Footer */}
      {!hideFooter && (
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
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-50 bg-primary-600 rounded-[12px] hover:bg-primary-700 transition-all duration-200 shadow-sm"
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
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-50 bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
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
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary-50 bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : "Save as Draft"}
            </button>
          </>
        )}
      </div>
      )}

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
})
