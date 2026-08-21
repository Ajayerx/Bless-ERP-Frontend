"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useToast, useMessageDialog, messageFromError } from "@/components/ui"
import { getCompanyDefaults } from "@/services/company"
import {
  invoiceService,
  type Customer,
  type Product,
  type TaxTemplateResult,
  type EditableTaxRow,
  type PartyDetailsResponse,
  type SalesInvoice,
  templateRowsToEditable,
  erpnextTaxesToEditable,
  invoiceTaxesToEditable,
  computeTaxes,
  computeTotalForDiscountAmount,
  formatExchangeRateError,
} from "@/services"
import type { DocInfo } from "@/modules/payments/types"
import type {
  InvoiceFormData,
  InvoiceFieldErrors,
} from "../components/InvoiceForm"
import type { LineItemForm } from "../components/InvoiceLineItems"
import { useCustomerSelection } from "./useCustomerSelection"
import { applySetWarehouseToItems } from "../utils/applySetWarehouse"
import { validateInvoice, getErrorMessages } from "../validation"

export interface InvoiceCompanyDefaults {
  company: string
  currency: string
  defaultSellingPriceList: string
  defaultReceivableAccount: string
  defaultIncomeAccount: string
  defaultCostCenter: string
  companyTaxId: string
}

const FALLBACK_TEMPLATE_NAME = "Canada GST/QST - BE"

// ERPNext ships company defaults in frappe.boot at login and never fetches them
// when a form opens. For an existing invoice we derive the light defaults the
// form needs directly from the document itself, so opening an invoice never
// triggers a company-defaults call. Full defaults are still loaded lazily by
// getCompanyDefaults() the first time a real mutation needs them (save/add-line).
function companyDefaultsFromDoc(inv: SalesInvoice): InvoiceCompanyDefaults {
  return {
    company: inv.company,
    currency: inv.currency,
    defaultSellingPriceList: inv.selling_price_list ?? "",
    defaultReceivableAccount: inv.debit_to ?? "",
    defaultIncomeAccount: inv.items?.[0]?.income_account ?? "",
    defaultCostCenter: inv.cost_center ?? inv.items?.[0]?.cost_center ?? "",
    companyTaxId: inv.company_tax_id ?? "",
  }
}

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100
}

function createEmptyLine(defaults?: {
  incomeAccount?: string
  costCenter?: string
}): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    sku: "",
    quantity: 1,
    price: 0,
    total: 0,
    uom: "Nos",
    warehouse: "",
    discountPercentage: undefined,
    discountAmount: undefined,
    marginType: undefined,
    marginRateOrAmount: undefined,
    incomeAccount: defaults?.incomeAccount || "",
    costCenter: defaults?.costCenter || "",
  }
}

function invToFormData(inv: SalesInvoice): InvoiceFormData {
  return {
    customer: inv.customer,
    customerName: inv.customer_name,
    company: inv.company,
    issueDate: inv.posting_date?.slice(0, 10) ?? "",
    dueDate: inv.due_date?.slice(0, 10) ?? "",
    postingTime: inv.posting_time,
    setPostingTime: !!inv.set_posting_time,
    updateStock: !!inv.update_stock,
    setWarehouse: inv.set_warehouse,
    setTargetWarehouse: inv.set_target_warehouse,
    customerAddress: inv.customer_address,
    addressDisplay: inv.address_display,
    shippingAddressName: inv.shipping_address_name,
    shippingAddress: inv.shipping_address,
    contactPerson: inv.contact_person,
    contactDisplay: inv.contact_display,
    contactEmail: inv.contact_email,
    contactMobile: inv.contact_mobile,
    contactPhone: inv.contact_phone,
    contactDesignation: inv.contact_designation,
    contactDepartment: inv.contact_department,
    dispatchAddressName: inv.dispatch_address_name,
    dispatchAddress: inv.dispatch_address,
    poNo: inv.po_no,
    poDate: inv.po_date?.slice(0, 10),
    paymentTermsTemplate: inv.payment_terms_template,
    currency: inv.currency,
    sellingPriceList: inv.selling_price_list,
    priceListCurrency: inv.price_list_currency,
    ignorePricingRule: inv.ignore_pricing_rule,
    applyDiscountOn: inv.apply_discount_on,
    discountAmount: inv.discount_amount,
    additionalDiscountPercentage: inv.additional_discount_percentage,
    couponCode: inv.coupon_code,
    isCashOrNonTradeDiscount: !!inv.is_cash_or_non_trade_discount,
    discountAccount: inv.additional_discount_account,
    writeOffAmount: inv.write_off_amount,
    writeOffAccount: inv.write_off_account,
    writeOffCostCenter: inv.write_off_cost_center,
    disableRoundedTotal: !!inv.disable_rounded_total,
    useCompanyDefaultCostCenterForRoundOff:
      inv.use_company_roundoff_cost_center,
    costCenter: inv.cost_center,
    project: inv.project,
    taxCategory: inv.tax_category,
    taxesAndCharges: inv.taxes_and_charges,
    partyAccountCurrency: inv.party_account_currency,
    salesPartner: inv.sales_partner,
    commissionRate: inv.commission_rate,
    salesTeam: inv.sales_team?.map((m) => ({
      id: crypto.randomUUID(),
      sales_person: m.sales_person,
      allocated_percentage: m.allocated_percentage,
      allocated_amount: m.allocated_amount,
      commission_rate: m.commission_rate,
      incentives: m.incentives,
    })),
    redeemLoyaltyPoints: !!inv.redeem_loyalty_points,
    loyaltyProgram: inv.loyalty_program,
    loyaltyPoints: inv.loyalty_points,
    loyaltyAmount: inv.loyalty_amount,
    loyaltyRedemptionAccount: inv.loyalty_redemption_account,
    loyaltyRedemptionCostCenter: inv.loyalty_redemption_cost_center,
    letterHead: inv.letter_head,
    groupSameItems: inv.group_same_items,
    selectPrintHeading: inv.select_print_heading,
    language: inv.language,
    tcName: inv.tc_name,
    terms: inv.terms,
    paymentScheduleRows: inv.payment_schedule?.map((ps) => ({
      id: crypto.randomUUID(),
      payment_term: ps.payment_term ?? "",
      description: ps.description ?? "",
      due_date: ps.due_date?.slice(0, 10) ?? "",
      invoice_portion: ps.invoice_portion ?? 0,
      payment_amount: ps.payment_amount ?? 0,
    })),
    isReturn: !!inv.is_return,
    returnAgainst: inv.return_against,
    isDebitNote: !!inv.is_debit_note,
    updateBilledAmountInSalesOrder: inv.update_billed_amount_in_sales_order,
    updateBilledAmountInDeliveryNote: inv.update_billed_amount_in_delivery_note,
    updateOutstandingForSelf: inv.update_outstanding_for_self,
    advances: inv.advances?.map((a) => ({
      id: crypto.randomUUID(),
      reference_type: a.reference_type,
      reference_name: a.reference_name,
      reference_row: a.reference_row,
      remarks: a.remarks,
      advance_amount: a.advance_amount,
      allocated_amount: a.allocated_amount,
      account: a.account,
      ref_exchange_rate: a.ref_exchange_rate,
      difference_posting_date: a.difference_posting_date,
    })),
    allocateAdvancesAutomatically: !!inv.allocate_advances_automatically,
    onlyIncludeAllocatedPayments: inv.only_include_allocated_payments,
    isPos: !!inv.is_pos,
    posProfile: inv.pos_profile,
    accountForChangeAmount: inv.account_for_change_amount,
    subscription: inv.subscription,
    fromDate: inv.from_date?.slice(0, 10),
    toDate: inv.to_date?.slice(0, 10),
    autoRepeat: inv.auto_repeat,
    debitTo: inv.debit_to,
    isOpening: inv.is_opening,
    customerGroup: inv.customer_group,
    remarks: inv.remarks,
    taxId: inv.tax_id,
    companyTaxId: inv.company_tax_id,
    amendedFrom: inv.amended_from,
    isInternalCustomer: !!inv.is_internal_customer,
    representsCompany: inv.represents_company,
    title: inv.title,
    companyAddress: inv.company_address,
    companyAddressDisplay: inv.company_address_display,
    baseGrandTotal: inv.base_grand_total,
    baseNetTotal: inv.base_net_total,
    baseTotalTaxesAndCharges: inv.base_total_taxes_and_charges,
    baseRoundingAdjustment: inv.base_rounding_adjustment,
    baseRoundedTotal: inv.base_rounded_total,
    inWords: inv.in_words,
    totalNetWeight: inv.total_net_weight,
    netTotal: inv.net_total,
    totalTaxesAndCharges: inv.total_taxes_and_charges,
    roundingAdjustment: inv.rounding_adjustment,
    roundedTotal: inv.rounded_total,
    basePaidAmount: inv.base_paid_amount,
    paidAmount: inv.paid_amount,
    baseChangeAmount: inv.base_change_amount,
    changeAmount: inv.change_amount,
    baseWriteOffAmount: inv.base_write_off_amount,
    totalAdvance: inv.total_advance,
    unrealizedProfitLossAccount: inv.unrealized_profit_loss_account,
    againstIncomeAccount: inv.against_income_account,
    totalCommission: inv.total_commission,
    status: inv.status,
  }
}

function buildApplyPriceListArgs(
  fd: InvoiceFormData,
  li: LineItemForm[],
  defaults: InvoiceCompanyDefaults | null,
): Record<string, unknown> {
  return {
    items: li
      .filter((l) => l.productId || l.sku)
      .map((l) => ({
        doctype: "Sales Invoice Item",
        name: l.id,
        child_docname: l.id,
        item_code: l.sku || l.productId,
        qty: l.quantity,
        stock_qty: l.quantity,
        uom: l.uom,
        stock_uom: l.stockUom || l.uom,
        warehouse: l.warehouse,
        price_list_rate: l.priceListRate ?? l.price,
        conversion_factor: l.conversionFactor ?? 1,
        discount_percentage: l.discountPercentage ?? 0,
        discount_amount: l.discountAmount ?? 0,
      })),
    customer: fd.customer || "",
    customer_group: fd.customerGroup || "",
    territory: fd.territory || "",
    currency: fd.currency || defaults?.currency,
    conversion_rate: fd.conversionRate ?? 1,
    price_list: fd.sellingPriceList || defaults?.defaultSellingPriceList || "",
    price_list_currency: fd.priceListCurrency || defaults?.currency,
    plc_conversion_rate: fd.plcConversionRate ?? 1,
    company: fd.company || defaults?.company || "",
    transaction_date: fd.issueDate || new Date().toISOString().slice(0, 10),
    campaign: fd.campaign,
    sales_partner: fd.salesPartner,
    ignore_pricing_rule: fd.ignorePricingRule,
    doctype: "Sales Invoice",
    name: "new-sales-invoice-1",
    is_return: fd.isReturn ? 1 : 0,
    update_stock: fd.updateStock ? 1 : 0,
    pos_profile: fd.posProfile || "",
    coupon_code: fd.couponCode,
    is_internal_customer: fd.isInternalCustomer ? 1 : 0,
  }
}

export type InvoiceWorkspaceMode = "new" | "existing"

export interface UseInvoiceWorkspaceOptions {
  mode: InvoiceWorkspaceMode
  id?: string
}

export interface InvoiceWorkspace {
  mode: InvoiceWorkspaceMode
  id?: string
  invoice: SalesInvoice | null
  docinfo: DocInfo | null
  loading: boolean
  saving: boolean
  submitting: boolean
  deleting: boolean
  dirty: boolean
  isDraft: boolean
  isSubmitted: boolean
  isCancelled: boolean
  editable: boolean
  formData: InvoiceFormData
  lineItems: LineItemForm[]
  companyDefaults: InvoiceCompanyDefaults | null
  taxTemplate: TaxTemplateResult | null
  conversionRate: number
  plcConversionRate: number
  editableTaxRows: EditableTaxRow[]
  fieldErrors: InvoiceFieldErrors
  error: string
  errorMessages: string[]
  taxRows: ReturnType<typeof computeTaxes>
  taxRowsBase: ReturnType<typeof computeTaxes>
  totalTaxesAndCharges: number
  totalTaxesAndChargesBase: number
  subtotal: number
  totalQuantity: number
  netTotal: number
  grandTotal: number
  handleFormChange: (updates: Partial<InvoiceFormData>) => void
  handleSave: () => Promise<void>
  handleSubmit: () => Promise<void>
  handleCancel: () => Promise<void>
  handleAmend: () => Promise<void>
  handleDelete: () => Promise<void>
  handleTaxTemplateChange: (templateName: string) => Promise<void>
  handleTaxRowsChange: (rows: EditableTaxRow[]) => void
  handleSelectCustomer: (customer: Customer) => void
  loadingPartyDetails: boolean
  loyaltyProgramOptions: string[]
  clearLoyaltyProgramOptions: () => void
  addLine: () => void
  addItemWithQty: (product: Product, qty: number) => void
  removeLine: (lineId: string) => void
  updateLine: (lineId: string, updates: Partial<LineItemForm>) => void
  handleAddItems: (items: Array<Record<string, unknown>>) => void
  handleSetWarehouse: (warehouse: string | undefined) => void
  selectProduct: (lineId: string, product: Product) => Promise<void>
  reload: () => Promise<void>
  canCreatePayment: boolean
  canCreateReturn: boolean
  canDelete: boolean
  anyCreate: boolean
}

export function useInvoiceWorkspace({
  mode,
  id,
}: UseInvoiceWorkspaceOptions): InvoiceWorkspace {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { addToast } = useToast()
  const { showMessage } = useMessageDialog()

  const [invoice, setInvoice] = useState<SalesInvoice | null>(null)
  const [docinfo, setDocinfo] = useState<DocInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<InvoiceFormData>(() =>
    mode === "new"
      ? {
          customer: "",
          customerName: "",
          company: "",
          issueDate: new Date().toISOString().slice(0, 10),
          dueDate: (() => {
            const dt = new Date()
            dt.setDate(dt.getDate() + 30)
            return dt.toISOString().slice(0, 10)
          })(),
          postingTime: (() => {
            const now = new Date()
            return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
          })(),
        }
      : {
          customer: "",
          customerName: "",
          issueDate: "",
          dueDate: "",
        },
  )
  const [lineItems, setLineItems] = useState<LineItemForm[]>(() =>
    mode === "new" ? [createEmptyLine()] : [],
  )
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState("")
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({})
  const [taxTemplate, setTaxTemplate] = useState<TaxTemplateResult | null>(null)
  const [companyDefaults, setCompanyDefaults] =
    useState<InvoiceCompanyDefaults | null>(null)
  const [conversionRate, setConversionRate] = useState<number>(1)
  const [plcConversionRate, setPlcConversionRate] = useState<number>(1)
  const [editableTaxRows, setEditableTaxRows] = useState<EditableTaxRow[]>([])

  const formDataRef = useRef(formData)
  formDataRef.current = formData
  const lineItemsRef = useRef(lineItems)
  lineItemsRef.current = lineItems

  const defaultTaxesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const markDirty = useCallback(() => setDirty(true), [])
  const resetDirty = useCallback(() => setDirty(false), [])

  const handlePartyDetailsApplied = useCallback(
    (details: PartyDetailsResponse) => {
      if (editableTaxRows.length > 0) return
      const company = companyDefaults?.company ?? formDataRef.current.company ?? ""
      if (!company) return
      if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current)
      defaultTaxesTimer.current = setTimeout(() => {
        invoiceService
          .getDefaultTaxesAndCharges(company, details.taxes_and_charges || "")
          .then((res) => {
            if (res && (res.taxes_and_charges || res.taxes.length)) {
              setTaxTemplate({
                name: res.taxes_and_charges || "",
                doctype: "Sales Taxes and Charges Template",
                rows: [],
              })
              if (res.taxes.length) {
                setEditableTaxRows(erpnextTaxesToEditable(res.taxes))
              }
            }
          })
      }, 2000)
    },
    [companyDefaults, editableTaxRows.length],
  )

  const {
    handleSelectCustomer,
    loadingPartyDetails,
    loyaltyProgramOptions,
    clearLoyaltyProgramOptions,
  } = useCustomerSelection({
    setFormData,
    formDataRef,
    companyDefaults,
    setConversionRate,
    setPlcConversionRate,
    setError,
    onPartyDetailsApplied: handlePartyDetailsApplied,
  })

  const wrappedHandleSelectCustomer = useCallback(
    (customer: Customer) => {
      markDirty()
      void handleSelectCustomer(customer)
    },
    [handleSelectCustomer, markDirty],
  )

  useEffect(() => {
    return () => {
      if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current)
    }
  }, [])

  const applyPriceListToForm = useCallback(
    async (args: Record<string, unknown>) => {
      const result = await invoiceService.applyPriceList(args, {})
      if (!result) return
      const parent = result.parent || {}
      const children = result.children || []
      if (parent.price_list_currency) {
        const plc = String(parent.price_list_currency)
        setFormData((prev) => ({ ...prev, priceListCurrency: plc }))
      }
      const plcRate =
        parent.plc_conversion_rate != null
          ? Number(parent.plc_conversion_rate)
          : NaN
      if (!Number.isNaN(plcRate) && plcRate > 0) {
        setPlcConversionRate(plcRate)
        setFormData((prev) => ({ ...prev, plcConversionRate: plcRate }))
      }
      if (children.length) {
        setLineItems((prev) =>
          prev.map((l) => {
            const child = children.find(
              (c) => c.child_docname === l.id || c.name === l.id,
            )
            if (!child) return l
            const rate =
              child.price_list_rate != null ? Number(child.price_list_rate) : NaN
            if (Number.isNaN(rate)) return l
            return { ...l, price: rate, priceListRate: rate, total: calcTotal(l.quantity, rate) }
          }),
        )
      }
    },
    [],
  )

  const loadFreshInvoiceDefaults = useCallback(
    (defaults: InvoiceCompanyDefaults | null) => {
      if (!defaults?.company) return
      const company = defaults.company

      invoiceService.getAccountingDimensions().then((dims) => {
        const companyDims = dims.defaultDimensionsMap?.[company]
        if (!companyDims) return
        if (companyDims.cost_center) {
          setFormData((prev) => ({ ...prev, costCenter: companyDims.cost_center }))
          setLineItems((prev) =>
            prev.map((l) =>
              !l.costCenter ? { ...l, costCenter: companyDims.cost_center } : l,
            ),
          )
        }
        if (companyDims.project) {
          setFormData((prev) => ({ ...prev, project: companyDims.project }))
        }
      })

      void applyPriceListToForm(
        buildApplyPriceListArgs(
          {
            ...formDataRef.current,
            company,
            currency: formDataRef.current.currency || defaults.currency,
            sellingPriceList:
              formDataRef.current.sellingPriceList ||
              defaults.defaultSellingPriceList,
            issueDate:
              formDataRef.current.issueDate ||
              new Date().toISOString().slice(0, 10),
          },
          lineItemsRef.current,
          defaults,
        ),
      )

      invoiceService.getDefaultCompanyAddress(company, "").then((addr) => {
        if (addr) {
          setFormData((prev) => ({ ...prev, companyAddress: addr }))
        }
      })

      invoiceService.getDefaultTaxesAndCharges(company, "").then((res) => {
        if (res && (res.taxes_and_charges || res.taxes.length)) {
          setTaxTemplate({
            name: res.taxes_and_charges || "",
            doctype: "Sales Taxes and Charges Template",
            rows: [],
          })
          if (res.taxes.length) {
            setEditableTaxRows(erpnextTaxesToEditable(res.taxes))
          }
        }
      })
    },
    [applyPriceListToForm],
  )

  useEffect(() => {
    if (mode === "existing") {
      if (!id) return
      let cancelled = false

      // ERPNext-parity open: a single frappe.desk.form.load.getdoc call returns
      // the full doclist AND docinfo (comments/versions/assignments/tags). No
      // tax-template or company-defaults calls fire on open — taxes are read
      // from the doc's own child table and defaults are derived from the doc.
      invoiceService
        .getDocWithInfo("Sales Invoice", id)
        .then(({ docs, docinfo: rawDocinfo }) => {
          if (cancelled) return
          const inv = docs[0]
          if (!inv) {
            setError("Failed to load invoice")
            return
          }
          setInvoice(inv)
          setDocinfo(rawDocinfo ?? null)
          setCompanyDefaults(companyDefaultsFromDoc(inv))
          setConversionRate(inv.conversion_rate ?? 1)
          setPlcConversionRate(inv.plc_conversion_rate ?? 1)
          setFormData((prev) => ({
            ...invToFormData(inv),
            conversionRate: inv.conversion_rate ?? 1,
            plcConversionRate: inv.plc_conversion_rate ?? 1,
            companyTaxId: inv.company_tax_id || prev.companyTaxId,
          }))
          setTaxTemplate(
            inv.taxes_and_charges
              ? {
                  name: inv.taxes_and_charges,
                  doctype: "Sales Taxes and Charges Template",
                  rows: [],
                }
              : null,
          )
          setEditableTaxRows(invoiceTaxesToEditable(inv.taxes ?? []))
          setLineItems(
            (inv.items ?? []).map((item) => ({
              id: crypto.randomUUID(),
              productId: item.item_code,
              productName: item.item_name || item.item_code,
              description: item.description || undefined,
              sku: item.item_code,
              quantity: item.qty,
              price: item.rate,
              total: item.amount ?? calcTotal(item.qty, item.rate),
              uom: item.uom || "Nos",
              warehouse: item.warehouse || "",
              discountPercentage: item.discount_percentage ?? undefined,
              discountAmount: item.discount_amount ?? undefined,
              marginType: item.margin_type || undefined,
              marginRateOrAmount: item.margin_rate_or_amount ?? undefined,
              itemTaxTemplate: item.item_tax_template || undefined,
              batchNo: item.batch_no || undefined,
              serialNo: item.serial_no || undefined,
              enableDeferredRevenue: item.enable_deferred_revenue ?? false,
              serviceStartDate: item.service_start_date?.slice(0, 10),
              serviceEndDate: item.service_end_date?.slice(0, 10),
              grantCommission: item.grant_commission !== false,
              pageBreak: item.page_break ?? false,
              incomeAccount: item.income_account || "",
              costCenter: item.cost_center || "",
            })),
          )
          resetDirty()
        })
        .catch(() => {
          if (!cancelled) setError("Failed to load invoice")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
      return () => {
        cancelled = true
      }
    } else {
      const stateCopy = location.state as { copyFrom?: SalesInvoice } | null
      const copyFrom = stateCopy?.copyFrom
      const isReturnParam = searchParams.get("is_return") === "1"
      const returnAgainst = searchParams.get("return_against")

      const sourcePromise: Promise<SalesInvoice | null> = copyFrom
        ? Promise.resolve(copyFrom)
        : isReturnParam && returnAgainst
          ? invoiceService.getById(returnAgainst).catch(() => null)
          : Promise.resolve(null)

      Promise.all([getCompanyDefaults(), sourcePromise])
        .then(([defaults, source]) => {
          setCompanyDefaults(defaults)
          if (source) {
            const negate = isReturnParam || !!source.is_return
            const form = invToFormData(source)
            setFormData({
              ...form,
              issueDate: negate
                ? new Date().toISOString().slice(0, 10)
                : form.issueDate,
              isReturn: negate,
              returnAgainst: negate ? source.name : source.return_against,
              amendedFrom: undefined,
            })
            setLineItems(
              (source.items ?? []).map((item) => {
                const qty = negate ? -Math.abs(item.qty ?? 0) : item.qty
                return {
                  id: crypto.randomUUID(),
                  productId: item.item_code,
                  productName: item.item_name || item.item_code,
                  description: item.description || undefined,
                  sku: item.item_code,
                  quantity: qty,
                  price: item.rate,
                  total: item.amount ?? calcTotal(qty, item.rate),
                  uom: item.uom || "Nos",
                  warehouse: item.warehouse || "",
                  discountPercentage: item.discount_percentage ?? undefined,
                  discountAmount: item.discount_amount ?? undefined,
                  marginType: item.margin_type || undefined,
                  marginRateOrAmount: item.margin_rate_or_amount ?? undefined,
                  itemTaxTemplate: item.item_tax_template || undefined,
                  batchNo: item.batch_no || undefined,
                  serialNo: item.serial_no || undefined,
                  enableDeferredRevenue: item.enable_deferred_revenue ?? false,
                  serviceStartDate: item.service_start_date?.slice(0, 10),
                  serviceEndDate: item.service_end_date?.slice(0, 10),
                  grantCommission: item.grant_commission !== false,
                  pageBreak: item.page_break ?? false,
                  incomeAccount: item.income_account || "",
                  costCenter: item.cost_center || "",
                }
              }),
            )
            if (source.taxes_and_charges) {
              invoiceService
                .getTaxTemplateDetails(source.taxes_and_charges)
                .then((td) => {
                  if (td) setTaxTemplate(td)
                })
                .catch(() => {})
            }
            setDirty(true)
          } else {
            setFormData((prev) => ({
              ...prev,
              company: defaults.company,
              companyTaxId: defaults.companyTaxId || prev.companyTaxId,
            }))
            setLineItems((prev) =>
              prev.map((line, i) =>
                i === 0 && !line.incomeAccount && !line.costCenter
                  ? {
                      ...line,
                      incomeAccount: defaults.defaultIncomeAccount || "",
                      costCenter: defaults.defaultCostCenter || "",
                    }
                  : line,
              ),
            )
            loadFreshInvoiceDefaults(defaults)
          }
        })
        .catch(() => {
          setError("Failed to load data")
        })
        .finally(() => {
          setLoading(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, id])

  const prevSetWarehouse = useRef(formData.setWarehouse)
  useEffect(() => {
    if (mode !== "new") return
    if (
      formData.setWarehouse &&
      formData.setWarehouse !== prevSetWarehouse.current
    ) {
      setLineItems((prev) =>
        prev.map((line) =>
          !line.warehouse ? { ...line, warehouse: formData.setWarehouse! } : line,
        ),
      )
    }
    prevSetWarehouse.current = formData.setWarehouse
  }, [formData.setWarehouse, mode])

  const prevPaymentTemplate = useRef(formData.paymentTermsTemplate)
  const prevIssueDate = useRef(formData.issueDate)
  useEffect(() => {
    if (mode !== "new") return
    if (!formData.customer || !companyDefaults) return
    const templateChanged =
      formData.paymentTermsTemplate !== prevPaymentTemplate.current
    const dateChanged = formData.issueDate !== prevIssueDate.current
    if (!templateChanged && !dateChanged) {
      prevPaymentTemplate.current = formData.paymentTermsTemplate
      prevIssueDate.current = formData.issueDate
      return
    }
    prevPaymentTemplate.current = formData.paymentTermsTemplate
    prevIssueDate.current = formData.issueDate
    invoiceService
      .getDueDate(
        formData.issueDate,
        formData.customer,
        companyDefaults.company,
        formData.paymentTermsTemplate,
      )
      .then((d) => {
        if (d) setFormData((prev) => ({ ...prev, dueDate: d }))
      })
      .catch(() => {})
  }, [
    formData.paymentTermsTemplate,
    formData.issueDate,
    formData.customer,
    companyDefaults,
    mode,
  ])

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await invoiceService.getById(id)
      setInvoice(inv)
      // The getdoc-bundled docinfo predates the mutation; drop it so the
      // timeline/meta panel refetch docinfo fresh instead of showing stale
      // comments/versions (ERPNext also reloads docinfo after save).
      setDocinfo(null)
      resetDirty()
    } catch {
      /* keep current invoice on error */
    } finally {
      setLoading(false)
    }
  }, [id, resetDirty])

  const handleFormChange = (updates: Partial<InvoiceFormData>) => {
    if ("customer" in updates && !updates.customer) {
      clearLoyaltyProgramOptions()
    }
    setFormData((prev) => {
      const next = { ...prev, ...updates }
      if ("isReturn" in updates) {
        next.namingSeries = updates.isReturn
          ? "ACC-SINV-RET-.YYYY.-"
          : "ACC-SINV-.YYYY.-"
      }
      return next
    })
    if (
      "currency" in updates &&
      updates.currency !== formData.currency
    ) {
      const newCurrency = updates.currency || companyDefaults?.currency || ""
      const companyCurrency = companyDefaults?.currency || ""
      const postingDate =
        formData.issueDate || new Date().toISOString().slice(0, 10)
      if (newCurrency && newCurrency !== companyCurrency) {
        invoiceService
          .getExchangeRate(newCurrency, companyCurrency, postingDate)
          .then((rate) => {
            if (rate === 0) {
              setError(formatExchangeRateError(newCurrency, companyCurrency, postingDate))
            }
            setConversionRate(rate)
            setFormData((prev) => ({ ...prev, conversionRate: rate }))
          })
      } else {
        setConversionRate(1)
        setFormData((prev) => ({ ...prev, conversionRate: 1 }))
      }
    }
    if (
      "sellingPriceList" in updates &&
      updates.sellingPriceList !== formData.sellingPriceList
    ) {
      const newPriceList = updates.sellingPriceList || ""
      if (newPriceList) {
        if (mode === "new") {
          void applyPriceListToForm(
            buildApplyPriceListArgs(
              { ...formDataRef.current, sellingPriceList: newPriceList },
              lineItemsRef.current,
              companyDefaults,
            ),
          )
        } else {
          const companyCurrency = companyDefaults?.currency || ""
          const postingDate =
            formData.issueDate || new Date().toISOString().slice(0, 10)
          invoiceService.getDoc("Price List", newPriceList).then((doc) => {
            const plcCurrency = (doc.currency as string) || ""
            setFormData((prev) => ({
              ...prev,
              priceListCurrency: plcCurrency || undefined,
            }))
            if (plcCurrency && plcCurrency !== companyCurrency) {
              invoiceService
                .getExchangeRate(plcCurrency, companyCurrency, postingDate)
                .then((rate) => {
                  if (rate === 0) {
                    setError(
                      formatExchangeRateError(plcCurrency, companyCurrency, postingDate),
                    )
                  }
                  setPlcConversionRate(rate)
                  setFormData((prev) => ({ ...prev, plcConversionRate: rate }))
                })
            } else {
              setPlcConversionRate(1)
              setFormData((prev) => ({ ...prev, plcConversionRate: 1 }))
            }
          })
        }
      }
    }
    if (fieldErrors) {
      const cleared = { ...fieldErrors }
      for (const key of Object.keys(updates)) {
        const fieldMap: Record<string, keyof InvoiceFieldErrors> = {
          customer: "customer",
          company: "company",
          issueDate: "postingDate",
          dueDate: "dueDate",
          currency: "currency",
          conversionRate: "conversionRate",
          sellingPriceList: "sellingPriceList",
          plcConversionRate: "plcConversionRate",
          debitTo: "debitTo",
          returnAgainst: "returnAgainst",
        }
        const fieldKey = fieldMap[key]
        if (fieldKey && cleared[fieldKey]) {
          delete cleared[fieldKey]
        }
      }
      setFieldErrors(cleared)
      if (Object.keys(cleared).length === 0) {
        setError("")
        setErrorMessages([])
      }
    }
    markDirty()
  }

  const handleTaxTemplateChange = async (templateName: string) => {
    if (!templateName) return
    try {
      const result = await invoiceService.getTaxTemplateDetails(templateName)
      if (result) {
        setTaxTemplate(result)
        setEditableTaxRows(templateRowsToEditable(result.rows))
      }
    } catch {
      // keep existing rates on failure
    }
    markDirty()
  }

  const handleTaxRowsChange = useCallback(
    (rows: EditableTaxRow[]) => {
      setEditableTaxRows(rows)
      markDirty()
    },
    [markDirty],
  )

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      createEmptyLine({
        incomeAccount: companyDefaults?.defaultIncomeAccount,
        costCenter: companyDefaults?.defaultCostCenter,
      }),
    ])
    markDirty()
  }

  const addItemWithQty = (product: Product, qty: number) => {
    setLineItems((prev) => {
      const existing = prev.find((l) => l.productId === product.item_code)
      if (existing) {
        const newQty = existing.quantity + qty
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: newQty, total: calcTotal(newQty, l.price) }
            : l,
        )
      }
      const accountingDefaults = {
        incomeAccount: companyDefaults?.defaultIncomeAccount,
        costCenter: companyDefaults?.defaultCostCenter,
      }
      const newRow = {
        ...createEmptyLine(accountingDefaults),
        productId: product.item_code,
        productName: product.item_name,
        description: product.description || undefined,
        sku: product.item_code,
        price: product.standard_rate,
        uom: product.stock_uom || "Nos",
        warehouse: product.default_warehouse || "",
        incomeAccount:
          product.income_account ||
          companyDefaults?.defaultIncomeAccount ||
          "",
        costCenter:
          product.cost_center || companyDefaults?.defaultCostCenter || "",
        quantity: qty,
        total: calcTotal(qty, product.standard_rate),
      }
      if (
        prev.length === 1 &&
        !prev[0].productId &&
        prev[0].quantity === 1 &&
        prev[0].price === 0
      ) {
        return [newRow]
      }
      return [...prev, newRow]
    })
    markDirty()
  }

  const removeLine = (lineId: string) => {
    setLineItems((prev) => prev.filter((l) => l.id !== lineId))
    markDirty()
  }

  const handleAddItems = (fetchedItems: Array<Record<string, unknown>>) => {
    if (!fetchedItems.length) return
    setLineItems((prev) => {
      const newItems = fetchedItems.map((item) => ({
        id: crypto.randomUUID(),
        productId: item.item_code as string,
        productName: (item.item_name as string) || "",
        description: (item.description as string) || undefined,
        sku: item.item_code as string,
        quantity: Number(item.qty ?? item.stock_qty ?? 1),
        price: Number(item.rate ?? 0),
        total: Number(item.amount ?? 0),
        uom: (item.uom as string) || (item.stock_uom as string) || "Nos",
        warehouse:
          (item.warehouse as string) || (item.t_warehouse as string) || "",
        discountPercentage: item.discount_percentage
          ? Number(item.discount_percentage)
          : undefined,
        discountAmount: item.discount_amount
          ? Number(item.discount_amount)
          : undefined,
        marginType: item.margin_type as "Percentage" | "Amount" | undefined,
        marginRateOrAmount: item.margin_rate_or_amount
          ? Number(item.margin_rate_or_amount)
          : undefined,
        itemTaxTemplate: (item.item_tax_template as string) || undefined,
        batchNo: (item.batch_no as string) || undefined,
        serialNo: (item.serial_no as string) || undefined,
        enableDeferredRevenue:
          item.enable_deferred_revenue === 1 ||
          item.enable_deferred_revenue === true,
        serviceStartDate: (item.service_start_date as string) || undefined,
        serviceEndDate: (item.service_end_date as string) || undefined,
        weightPerUnit: item.weight_per_unit
          ? Number(item.weight_per_unit)
          : undefined,
        totalWeight: item.total_weight ? Number(item.total_weight) : undefined,
        incomeAccount:
          (item.income_account as string) ||
          companyDefaults?.defaultIncomeAccount ||
          "",
        costCenter:
          (item.cost_center as string) ||
          companyDefaults?.defaultCostCenter ||
          "",
        stockUom: (item.stock_uom as string) || undefined,
        conversionFactor: item.conversion_factor
          ? Number(item.conversion_factor)
          : undefined,
        priceListRate: item.price_list_rate
          ? Number(item.price_list_rate)
          : undefined,
        netRate: item.net_rate ? Number(item.net_rate) : undefined,
        netAmount: item.net_amount ? Number(item.net_amount) : undefined,
        baseRate: item.base_rate ? Number(item.base_rate) : undefined,
        baseAmount: item.base_amount ? Number(item.base_amount) : undefined,
      }))
      if (
        prev.length === 1 &&
        !prev[0].productId &&
        prev[0].quantity === 1 &&
        prev[0].price === 0
      ) {
        return newItems
      }
      return [...prev, ...newItems]
    })
    markDirty()
  }

  const updateLine = (lineId: string, updates: Partial<LineItemForm>) => {
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l
        const next = { ...l, ...updates }
        next.total = calcTotal(next.quantity, next.price)
        return next
      }),
    )
    markDirty()
  }

  const handleSetWarehouse = useCallback(
    (warehouse: string | undefined) => {
      void applySetWarehouseToItems(lineItems, updateLine, warehouse)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lineItems],
  )

  const selectProduct = async (lineId: string, product: Product) => {
    let incomeAccount =
      product.income_account || companyDefaults?.defaultIncomeAccount || ""
    let costCenter =
      product.cost_center || companyDefaults?.defaultCostCenter || ""
    let itemDetails: Record<string, unknown> | null = null
    try {
      itemDetails = await invoiceService.getItemDetails(product.item_code, {
        currency: formData.currency || companyDefaults?.currency,
        conversion_rate: formData.conversionRate ?? conversionRate,
        selling_price_list:
          formData.sellingPriceList || companyDefaults?.defaultSellingPriceList,
        price_list_currency: formData.priceListCurrency || companyDefaults?.currency,
        plc_conversion_rate: formData.plcConversionRate ?? plcConversionRate,
        customer: formData.customer,
        is_pos: formData.isPos ? 1 : 0,
        is_return: formData.isReturn ? 1 : 0,
        name: id,
      })
      if (itemDetails) {
        incomeAccount = (itemDetails.income_account as string) || incomeAccount
        costCenter = (itemDetails.cost_center as string) || costCenter
      }
    } catch {
      // fall back to product/company defaults
    }
    const rate = (itemDetails?.price_list_rate as number) || product.standard_rate
    updateLine(lineId, {
      productId: product.item_code,
      productName: product.item_name,
      description: product.description || undefined,
      sku: product.item_code,
      price: rate,
      uom: (itemDetails?.uom as string) || product.stock_uom || "Nos",
      warehouse: (itemDetails?.warehouse as string) || product.default_warehouse || "",
      actualQty: itemDetails?.actual_qty as number | undefined,
      projectedQty: itemDetails?.projected_qty as number | undefined,
      reservedQty: itemDetails?.reserved_qty as number | undefined,
      incomeAccount,
      costCenter,
      discountPercentage: undefined,
      discountAmount: undefined,
      marginType: undefined,
      marginRateOrAmount: undefined,
    })
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0)
  const totalQuantity = lineItems.reduce((sum, l) => sum + l.quantity, 0)

  const taxRowsBase = useMemo(
    () => computeTaxes(editableTaxRows, subtotal, totalQuantity),
    [editableTaxRows, subtotal, totalQuantity],
  )
  const totalTaxesAndChargesBase = taxRowsBase.reduce(
    (sum, r) => sum + r.tax_amount,
    0,
  )

  let additionalDiscount = 0
  if (formData.discountAmount && formData.discountAmount > 0) {
    additionalDiscount = formData.discountAmount
  } else if (
    formData.additionalDiscountPercentage &&
    formData.additionalDiscountPercentage > 0
  ) {
    const base =
      formData.applyDiscountOn === "Net Total"
        ? subtotal
        : subtotal + totalTaxesAndChargesBase
    additionalDiscount =
      Math.round(base * (formData.additionalDiscountPercentage / 100) * 100) /
      100
  }

  const isCashOrNonTrade =
    formData.applyDiscountOn === "Grand Total" &&
    formData.isCashOrNonTradeDiscount

  const totalForDiscount =
    formData.applyDiscountOn === "Net Total"
      ? subtotal
      : computeTotalForDiscountAmount(
          taxRowsBase,
          subtotal,
          totalTaxesAndChargesBase,
        )

  const netTotal =
    isCashOrNonTrade || !totalForDiscount
      ? subtotal
      : Math.round(
          (subtotal - additionalDiscount * (subtotal / totalForDiscount)) * 100,
        ) / 100

  const taxRows = useMemo(
    () =>
      computeTaxes(editableTaxRows, subtotal, totalQuantity, {
        netTotal,
        applyDiscountOn: formData.applyDiscountOn,
        isCashOrNonTradeDiscount: formData.isCashOrNonTradeDiscount,
      }),
    [
      editableTaxRows,
      subtotal,
      totalQuantity,
      netTotal,
      formData.applyDiscountOn,
      formData.isCashOrNonTradeDiscount,
    ],
  )

  const totalTaxesAndCharges = taxRows.reduce(
    (sum, r) => sum + (r.tax_amount_after_discount_amount ?? 0),
    0,
  )

  const grandTotal = isCashOrNonTrade
    ? Math.round((subtotal + totalTaxesAndCharges - additionalDiscount) * 100) /
      100
    : formData.applyDiscountOn === "Grand Total"
      ? Math.round(
          (subtotal + totalTaxesAndChargesBase - additionalDiscount) * 100,
        ) / 100
      : Math.round((netTotal + totalTaxesAndCharges) * 100) / 100

  const buildPayload = () => {
    const fd = formDataRef.current
    const li = lineItemsRef.current
    return {
      customer: fd.customer,
      company: fd.company || companyDefaults?.company || "",
      posting_date: fd.issueDate,
      posting_time: fd.postingTime || undefined,
      set_posting_time: true,
      due_date: fd.dueDate,
      currency: fd.currency || companyDefaults?.currency || "",
      conversion_rate: fd.conversionRate ?? conversionRate,
      selling_price_list:
        fd.sellingPriceList || companyDefaults?.defaultSellingPriceList || "",
      price_list_currency: fd.priceListCurrency || companyDefaults?.currency || "",
      plc_conversion_rate: fd.plcConversionRate ?? plcConversionRate,
      ignore_pricing_rule: fd.ignorePricingRule,
      update_stock: fd.updateStock,
      set_warehouse: fd.setWarehouse || undefined,
      set_target_warehouse: fd.setTargetWarehouse || undefined,
      debit_to: fd.debitTo || companyDefaults?.defaultReceivableAccount || "",
      party_account_currency: fd.partyAccountCurrency || undefined,
      cost_center: fd.costCenter || undefined,
      project: fd.project || undefined,
      taxes_and_charges:
        fd.taxesAndCharges ||
        (mode === "new"
          ? taxTemplate?.name || FALLBACK_TEMPLATE_NAME
          : undefined),
      taxes: taxRows.map((r) => ({
        charge_type: r.charge_type,
        account_head: r.account_head,
        rate: r.rate,
        description: r.description,
        included_in_print_rate: r.included_in_print_rate,
      })),
      customer_address: fd.customerAddress || undefined,
      shipping_address_name: fd.shippingAddressName || undefined,
      contact_person: fd.contactPerson || undefined,
      po_no: fd.poNo || undefined,
      po_date: fd.poDate || undefined,
      payment_terms_template: fd.paymentTermsTemplate || undefined,
      apply_discount_on: fd.applyDiscountOn || undefined,
      discount_amount: fd.discountAmount,
      additional_discount_percentage: fd.additionalDiscountPercentage,
      coupon_code: fd.couponCode || undefined,
      is_cash_or_non_trade_discount: fd.isCashOrNonTradeDiscount,
      additional_discount_account: fd.discountAccount || undefined,
      write_off_amount: fd.writeOffAmount,
      write_off_account: fd.writeOffAccount || undefined,
      write_off_cost_center: fd.writeOffCostCenter || undefined,
      write_off_outstanding_amount_automatically:
        fd.writeOffOutstandingAmountAutomatically,
      disable_rounded_total: fd.disableRoundedTotal,
      use_company_roundoff_cost_center:
        fd.useCompanyDefaultCostCenterForRoundOff,
      tax_category: fd.taxCategory || undefined,
      shipping_rule: fd.shippingRule || undefined,
      incoterm: fd.incoterm || undefined,
      named_place: fd.namedPlace || undefined,
      sales_partner: fd.salesPartner || undefined,
      commission_rate: fd.commissionRate,
      total_commission: fd.totalCommission || undefined,
      sales_team: fd.salesTeam?.map((m) => ({
        sales_person: m.sales_person,
        allocated_percentage: m.allocated_percentage,
        allocated_amount: m.allocated_amount,
        commission_rate: m.commission_rate,
        incentives: m.incentives,
      })),
      redeem_loyalty_points: fd.redeemLoyaltyPoints,
      loyalty_program: fd.loyaltyProgram || undefined,
      loyalty_points: fd.loyaltyPoints,
      loyalty_amount: fd.loyaltyAmount,
      loyalty_redemption_account: fd.loyaltyRedemptionAccount || undefined,
      loyalty_redemption_cost_center: fd.loyaltyRedemptionCostCenter || undefined,
      letter_head: fd.letterHead || undefined,
      group_same_items: fd.groupSameItems,
      select_print_heading: fd.selectPrintHeading || undefined,
      language: fd.language || undefined,
      tc_name: fd.tcName || undefined,
      terms: fd.terms || undefined,
      is_return: !!fd.isReturn,
      return_against: fd.returnAgainst || undefined,
      is_debit_note: !!fd.isDebitNote,
      update_billed_amount_in_sales_order: fd.updateBilledAmountInSalesOrder,
      update_billed_amount_in_delivery_note: fd.updateBilledAmountInDeliveryNote,
      update_outstanding_for_self: fd.updateOutstandingForSelf,
      allocate_advances_automatically: fd.allocateAdvancesAutomatically,
      only_include_allocated_payments: fd.onlyIncludeAllocatedPayments,
      advances: fd.advances?.map((a) => ({
        reference_type: a.reference_type,
        reference_name: a.reference_name,
        reference_row: a.reference_row,
        remarks: a.remarks,
        advance_amount: a.advance_amount,
        allocated_amount: a.allocated_amount,
        account: a.account,
        ref_exchange_rate: a.ref_exchange_rate,
        difference_posting_date: a.difference_posting_date,
      })),
      is_pos: !!fd.isPos,
      pos_profile: fd.posProfile || undefined,
      account_for_change_amount: fd.accountForChangeAmount || undefined,
      cash_bank_account: fd.cashBankAccount || undefined,
      payments: fd.payments?.map((p) => ({
        mode_of_payment: p.mode_of_payment,
        amount: p.amount,
        account: p.account || undefined,
      })),
      subscription: fd.subscription || undefined,
      from_date: fd.fromDate || undefined,
      to_date: fd.toDate || undefined,
      auto_repeat: fd.autoRepeat || undefined,
      remarks: fd.remarks || undefined,
      campaign: fd.campaign || undefined,
      source: fd.source || undefined,
      dispatch_address_name: fd.dispatchAddressName || undefined,
      company_address: fd.companyAddress || undefined,
      company_contact_person: fd.companyContactPerson || undefined,
      territory: fd.territory || undefined,
      tax_id: fd.taxId || undefined,
      company_tax_id: fd.companyTaxId || undefined,
      is_internal_customer: !!fd.isInternalCustomer,
      represents_company: fd.representsCompany || undefined,
      inter_company_invoice_reference: fd.interCompanyInvoiceReference || undefined,
      is_discounted: !!fd.isDiscounted,
      is_opening: fd.isOpening || undefined,
      customer_group: fd.customerGroup || undefined,
      title: fd.title || undefined,
      unrealized_profit_loss_account: fd.unrealizedProfitLossAccount || undefined,
      against_income_account: fd.againstIncomeAccount || undefined,
      utm_source: fd.utmSource || undefined,
      utm_medium: fd.utmMedium || undefined,
      utm_campaign: fd.utmCampaign || undefined,
      utm_content: fd.utmContent || undefined,
      timesheets: fd.timeSheets?.map((ts) => ({
        activity_type: ts.activity_type,
        description: ts.description || undefined,
        billing_hours: ts.billing_hours,
        billing_amount: ts.billing_amount,
      })),
      items: li.map((item) => {
        const amt = item.quantity * item.price
        const rate = fd.conversionRate ?? conversionRate ?? 1
        return {
          item_code: item.sku || item.productName,
          item_name: item.productName,
          description: item.description || undefined,
          qty: item.quantity,
          uom: item.uom,
          conversion_factor: item.conversionFactor ?? 1,
          rate: item.price,
          amount: amt,
          base_rate: item.price * rate,
          base_amount: amt * rate,
          warehouse: item.warehouse || undefined,
          discount_percentage: item.discountPercentage ?? 0,
          discount_amount: item.discountAmount ?? 0,
          margin_type: item.marginType || undefined,
          margin_rate_or_amount: item.marginRateOrAmount ?? 0,
          item_tax_template: item.itemTaxTemplate || undefined,
          batch_no: item.batchNo || undefined,
          serial_no: item.serialNo || undefined,
          enable_deferred_revenue: item.enableDeferredRevenue ?? false,
          service_start_date: item.serviceStartDate || undefined,
          service_end_date: item.serviceEndDate || undefined,
          grant_commission: item.grantCommission !== false,
          page_break: item.pageBreak ?? false,
          income_account:
            item.incomeAccount ||
            companyDefaults?.defaultIncomeAccount ||
            undefined,
          cost_center:
            item.costCenter || companyDefaults?.defaultCostCenter || undefined,
        }
      }),
      payment_schedule: fd.paymentScheduleRows?.map((ps) => ({
        payment_term: ps.payment_term || undefined,
        description: ps.description || undefined,
        due_date: ps.due_date || fd.dueDate,
        invoice_portion: ps.invoice_portion ?? undefined,
        payment_amount: ps.payment_amount,
      })),
    }
  }

  const buildSubmitUpdatePayload = () => {
    const fd = formDataRef.current
    return {
      letter_head: fd.letterHead || undefined,
      select_print_heading: fd.selectPrintHeading || undefined,
      dispatch_address_name: fd.dispatchAddressName || undefined,
      additional_discount_account: fd.discountAccount || undefined,
      from_date: fd.fromDate || undefined,
      to_date: fd.toDate || undefined,
      group_same_items: fd.groupSameItems,
      is_opening: fd.isOpening || undefined,
      po_no: fd.poNo || undefined,
      po_date: fd.poDate || undefined,
      cost_center: fd.costCenter || undefined,
      project: fd.project || undefined,
      account_for_change_amount: fd.accountForChangeAmount || undefined,
      write_off_account: fd.writeOffAccount || undefined,
      loyalty_redemption_account: fd.loyaltyRedemptionAccount || undefined,
      sales_team: fd.salesTeam?.map((m) => ({
        sales_person: m.sales_person,
        allocated_percentage: m.allocated_percentage,
        allocated_amount: m.allocated_amount,
        commission_rate: m.commission_rate,
        incentives: m.incentives,
      })),
    }
  }

  const handleSave = async () => {
    const fd = formDataRef.current
    const li = lineItemsRef.current
    const errors = validateInvoice(fd, li, companyDefaults)
    setFieldErrors(errors)
    const msgs = getErrorMessages(errors)
    if (msgs.length > 0) {
      setErrorMessages(msgs)
      return
    }
    setSaving(true)
    setError("")
    setErrorMessages([])
    setFieldErrors({})
    try {
      if (mode === "new" && !id) {
        const created = await invoiceService.create(buildPayload())
        resetDirty()
        navigate(`/invoices/${created.name}`)
      } else if (id) {
        if (isSubmitted) {
          // Submitted/Paid: only allow_on_submit fields can change. Send a slim
          // payload so ERPNext keeps docstatus=1 and runs on_update_after_submit.
          await invoiceService.updateSubmitted(id, buildSubmitUpdatePayload())
        } else {
          await invoiceService.update(id, buildPayload())
        }
        resetDirty()
        await reload()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save invoice")
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      await invoiceService.submit(id)
      resetDirty()
      await reload()
      addToast(`Submitted ${id} successfully`, "success")
    } catch (e) {
      const msg = messageFromError(e, "Failed to submit invoice")
      setError(typeof msg === "string" ? msg : msg.message)
      showMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      await invoiceService.cancel(id)
      await reload()
      addToast(`Cancelled ${id} successfully`, "success")
    } catch (e) {
      const msg = messageFromError(e, "Failed to cancel invoice")
      setError(typeof msg === "string" ? msg : msg.message)
      showMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAmend = async () => {
    if (!id) return
    setSubmitting(true)
    setError("")
    try {
      const amended = await invoiceService.amend(id)
      navigate(`/invoices/${amended.name}`)
      showMessage(`Amended ${id} — new draft ${amended.name} created.`)
    } catch (e) {
      const msg = messageFromError(e, "Failed to amend invoice")
      setError(typeof msg === "string" ? msg : msg.message)
      showMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!window.confirm("Delete this invoice? This action cannot be undone.")) return
    setDeleting(true)
    setError("")
    try {
      await invoiceService.delete(id)
      navigate("/invoices")
      addToast(`Deleted ${id} successfully`, "success")
    } catch (e) {
      const msg = messageFromError(e, "Failed to delete invoice")
      setError(typeof msg === "string" ? msg : msg.message)
      showMessage(msg)
    } finally {
      setDeleting(false)
    }
  }

  const isDraft = (invoice?.docstatus ?? 0) === 0
  const isSubmitted = (invoice?.docstatus ?? 0) === 1
  const isCancelled = (invoice?.docstatus ?? 0) === 2
  const editable = mode === "new" || isDraft

  const canCreatePayment =
    isSubmitted && (invoice?.outstanding_amount ?? 0) !== 0
  const canCreateReturn = isSubmitted && !invoice?.is_return
  const canDelete = isDraft && mode === "existing"

  const anyCreate = [canCreatePayment, canCreateReturn].some(Boolean)

  return {
    mode,
    id,
    invoice,
    docinfo,
    loading,
    saving,
    submitting,
    deleting,
    dirty,
    isDraft,
    isSubmitted,
    isCancelled,
    editable,
    formData,
    lineItems,
    companyDefaults,
    taxTemplate,
    conversionRate,
    plcConversionRate,
    editableTaxRows,
    fieldErrors,
    error,
    errorMessages,
    taxRows,
    taxRowsBase,
    totalTaxesAndCharges,
    totalTaxesAndChargesBase,
    subtotal,
    totalQuantity,
    netTotal,
    grandTotal,
    handleFormChange,
    handleSave,
    handleSubmit,
    handleCancel,
    handleAmend,
    handleDelete,
    handleTaxTemplateChange,
    handleTaxRowsChange,
    handleSelectCustomer: wrappedHandleSelectCustomer,
    loadingPartyDetails,
    loyaltyProgramOptions,
    clearLoyaltyProgramOptions,
    addLine,
    addItemWithQty,
    removeLine,
    updateLine,
    handleAddItems,
    handleSetWarehouse,
    selectProduct,
    reload,
    canCreatePayment,
    canCreateReturn,
    canDelete,
    anyCreate,
  }
}