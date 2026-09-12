"use client"

/**
 * Full editable Sales Order form — "Create Sales Order from a submitted
 * quotation" parity with ERPNext's Sales Order desk form. Mirrors the
 * QuotationForm structure (ERPNext 3-column header, child-grid items +
 * 3-column footer, editable taxes + ItemisedTaxBreakup, collapsible
 * sections) but drives the field set from $SALES_ORDER_FIELD_META via
 * $useSalesOrderVisibilityRules (hide/show / readOnly / reqd per field with
 * docstatus awareness) and persists through $salesOrderService.saveDoc.
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useNavigate } from "react-router-dom"
import { CollapsibleSection, DateInput, Input, LinkSearchField, useToast } from "@/components/ui"
import { Combobox, inputClass, labelClass } from "@/components/ui/form-fields"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { getLinkFilters } from "@/config/link-filters.config"
import { useCompany } from "@/context/CompanyContext"
import { useLazyOptions } from "@/services/lookup-cache"
import {
  salesOrderService,
  buildApplyPriceListArgs,
  buildDeskApplyPriceListDoc,
  deskRandomString,
  type SalesOrderPartyDetails,
} from "@/modules/sales-orders/services"
import { customerService } from "@/modules/customers/services"
import {
  applyDiscountToItemNetAmounts,
  computeTaxes,
  computeTotalForDiscountAmount,
  getCurrencySmallestFraction,
  getItemisedTaxBreakupData,
  getItemisedTaxBreakupRowsFromDetail,
  roundToSmallestCurrencyFraction,
  type ChargeType,
  type EditableTaxRow,
  type ItemisedTaxBreakupTaxRow,
} from "@/modules/invoices/services"
import { AddMultipleModal, type LineItemForm } from "@/modules/invoices/components/InvoiceLineItems"
import ItemisedTaxBreakup from "@/modules/invoices/components/ItemisedTaxBreakup"
import SalesTaxesChargesTable from "@/modules/invoices/components/SalesTaxesChargesTable"
import { moneyInWords } from "@/modules/payments/utils/moneyInWords"
import { quotationService } from "@/modules/quotations/services"
import { isFilledItemRow } from "@/modules/sales-orders/utils/items"
import { ScanBarcode } from "lucide-react"
import type { AccountingDimension } from "@/services"
import type { Product } from "@/services"
import type {
  SalesOrderDoc,
  SalesOrderFormData,
  SalesOrderItemForm,
  SalesOrderTax,
  SalesOrderPaymentScheduleRow,
  SalesOrderPricingRuleRow,
  SalesOrderSalesTeamRow,
} from "../types"
import {
  useSalesOrderVisibilityRules,
  SALES_ORDER_EMPTY_HIDE_EXEMPT,
  salesOrderResolveField,
  SALES_ORDER_DEFAULT_FIELD_STATE,
} from "../hooks/useVisibilityRules"
import { formatCurrency, formatFixed } from "@/lib/utils"

const ORDER_TYPE_OPTIONS = ["Sales", "Maintenance", "Shopping Cart"] as const

const round2 = (value: number): number => Math.round(value * 100) / 100

// ERPNext parity (sales_common.js calculate_contribution / calculate_incentive):
// each Sales Team row's allocated_amount = amount_eligible * allocated_percentage / 100,
// and incentives = allocated_amount * commission_rate / 100 (only once the row has an
// allocated_amount, matching frappe's `if (row.allocated_amount)` guard). Rows without
// an allocated_percentage are left untouched.
const recomputeSalesTeamRows = (
  rows: SalesOrderSalesTeamRow[],
  amountEligible: number,
): SalesOrderSalesTeamRow[] =>
  rows.map((row) => {
    if (!row.allocated_percentage) return row
    const allocated_amount = round2((amountEligible * row.allocated_percentage) / 100)
    const incentives = allocated_amount
      ? round2((allocated_amount * (row.commission_rate ?? 0)) / 100)
      : (row.incentives ?? 0)
    return { ...row, allocated_amount, incentives }
  })

type SalesOrderFormTab = "details" | "address" | "terms" | "more_info"

export interface SalesOrderFormHandle {
  save: (action?: "Save" | "Update" | "Submit") => Promise<string | undefined>
  isDirty: () => boolean
  addItems: (items: SalesOrderItemForm[]) => void
}

export interface SalesOrderFormProps {
  doc?: SalesOrderDoc | null
  mode?: "create" | "edit"
  onSaved?: (doc: SalesOrderDoc) => void
  onDirtyChange?: (dirty: boolean) => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

// Field names excluded from the submitted-Sales-Order diff: the computed
// header totals (derived from the item edit / the current form calculation)
// and server-managed bookkeeping/status values. Everything else, including
// the editable allow_on_submit headers, is a real user change we must flag.
const SUBMITTED_DIFF_IGNORED_FIELDS = new Set([
  "doctype",
  "name",
  "owner",
  "creation",
  "modified",
  "modified_by",
  "docstatus",
  "idx",
  "__islocal",
  "__unsaved",
  "_assign",
  "_comments",
  "_liked_by",
  "_user_tags",
  "status",
  "billing_status",
  "delivery_status",
  "per_delivered",
  "per_billed",
  "per_picked",
  "advance_paid",
  "total_qty",
  "total_net_weight",
  "net_total",
  "base_net_total",
  "total",
  "base_total",
  "grand_total",
  "base_grand_total",
  "rounding_adjustment",
  "rounded_total",
  "base_rounding_adjustment",
  "base_rounded_total",
  "total_taxes_and_charges",
  "base_total_taxes_and_charges",
  "amount_eligible_for_commission",
  "total_commission",
  "discount_amount",
  "base_discount_amount",
  "other_charges_calculation",
  "in_words",
  "base_in_words",
])

function numEq(a: unknown, b: unknown): boolean {
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9
  return a === b
}

// ERPNext locks a submitted Sales Order: only child item qty/rate may change
// (update_child_qty_rate). A whole-doc re-save (savedocs with action
// "Update") re-submits the document server-side, which the bench rejects with
// a child-doctype permission 403. Diff the live form against the last-loaded
// baseline so we can persist exactly the item changes and explain everything
// else instead of hitting the doomed re-submit path.
function diffSubmittedForm(
  form: SalesOrderFormData,
  baseline: SalesOrderFormData | null,
): { removed: string[]; updatedItems: Array<{ docname?: string; item_code: string; qty: number; rate: number; uom?: string; conversion_factor?: number }>; nonItemFields: string[] } {
  const removed: string[] = []
  const updatedItems: Array<{ docname?: string; item_code: string; qty: number; rate: number; uom?: string; conversion_factor?: number }> = []
  const nonItemFields: string[] = []

  const baseItems = baseline?.items ?? []
  const baseByName = new Map<string, SalesOrderItemForm>()
  for (const row of baseItems) {
    if (row.name) baseByName.set(row.name, row)
  }

  const currentNames = new Set<string>()
  for (const row of form.items ?? []) {
    if (row.name) currentNames.add(row.name)
    const base = row.name ? baseByName.get(row.name) : undefined
    const changed =
      !base ||
      !numEq(base.qty, row.qty) ||
      !numEq(base.rate, row.rate) ||
      !numEq(base.conversion_factor, row.conversion_factor) ||
      (base.uom ?? "") !== (row.uom ?? "")
    if (changed) {
      updatedItems.push({
        docname: row.name,
        item_code: row.item_code ?? "",
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        uom: row.uom,
        conversion_factor: Number(row.conversion_factor) || 1,
      })
    }
  }
  for (const row of baseItems) {
    if (row.name && !currentNames.has(row.name)) {
      removed.push(row.item_code || row.name)
    }
  }

  const base = (baseline ?? {}) as Record<string, unknown>
  const keys = new Set([...Object.keys(base), ...Object.keys(form as unknown as Record<string, unknown>)])
  for (const key of keys) {
    if (key === "items") continue
    if (SUBMITTED_DIFF_IGNORED_FIELDS.has(key)) continue
    const baseVal = (base as Record<string, unknown>)[key]
    const formVal = (form as unknown as Record<string, unknown>)[key]
    if (JSON.stringify(baseVal) !== JSON.stringify(formVal)) {
      nonItemFields.push(key)
    }
  }

  return { removed, updatedItems, nonItemFields }
}

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function normalizeDisplayText(value?: string): string {
  return (value ?? "").replace(/<br\s*\/?>/gi, "\n")
}

function createEmptyItem(): SalesOrderItemForm {
  return {
    name: `new-sales-order-item-${deskRandomString()}`,
    item_name: "",
    item_code: "",
    qty: 1,
    uom: "",
    conversion_factor: 1,
    price_list_rate: 0,
    rate: 0,
    amount: 0,
    discount_percentage: 0,
    reserve_stock: 1,
    delivered_by_supplier: 0,
    is_free_item: 0,
    grant_commission: 0,
  }
}

function soTaxesToEditable(taxes: SalesOrderTax[]): EditableTaxRow[] {
  return taxes.map((t) => ({
    charge_type: (t.charge_type || "On Net Total") as EditableTaxRow["charge_type"],
    account_head: t.account_head,
    description: t.description ?? "",
    rate: t.rate ?? 0,
    tax_amount: t.tax_amount ?? 0,
    net_amount: 0,
    total: t.total ?? 0,
    included_in_print_rate: !!t.included_in_print_rate,
  }))
}

function editableToSalesOrderTaxes(rows: EditableTaxRow[]): SalesOrderTax[] {
  return rows.map((r) => ({
    charge_type: r.charge_type,
    account_head: r.account_head,
    rate: r.rate,
    tax_amount: r.tax_amount,
    total: r.total,
    description: r.description,
    included_in_print_rate: r.included_in_print_rate ? 1 : 0,
  }))
}

export default forwardRef<SalesOrderFormHandle, SalesOrderFormProps>(
  function SalesOrderForm(
    {
      doc: initialData,
      mode = initialData ? "edit" : "create",
      onSaved,
      onDirtyChange,
    },
    ref,
  ) {
    const { companyDefaults, companies } = useCompany()
    const { addToast } = useToast()

    const companyCurrency = companyDefaults?.currency || "CAD"
    const defaultCompany = companyDefaults?.company || ""
    const defaultPriceList = companyDefaults?.defaultSellingPriceList || "Standard Selling"

    // ERPNext parity: erpnext.hide_company — when the user has access to
    // exactly one company, the Company field is pre-set to it and hidden.
    const companyNames = companies.map((c) => c.name)
    const singleCompany = companyNames.length === 1
    const effectiveDefaultCompany = singleCompany ? companyNames[0] : defaultCompany

    const buildEmptyForm = (): SalesOrderFormData => ({
      doctype: "Sales Order",
      naming_series: "SAL-ORD-.YYYY.-",
      customer: "",
      order_type: "Sales",
      transaction_date: todayISO(),
      delivery_date: addDaysISO(7),
      company: effectiveDefaultCompany,
      currency: companyCurrency,
      conversion_rate: 1,
      selling_price_list: defaultPriceList,
      price_list_currency: companyCurrency,
      plc_conversion_rate: 1,
      reserve_stock: 0,
      skip_delivery_note: 0,
      has_unit_price_items: 0,
      items: [createEmptyItem()],
      taxes: [],
      payment_schedule: [],
      pricing_rules: [],
      packed_items: [],
      sales_team: [],
      total_qty: 0,
      base_total: 0,
      base_net_total: 0,
      total: 0,
      net_total: 0,
      base_total_taxes_and_charges: 0,
      total_taxes_and_charges: 0,
      base_grand_total: 0,
      base_rounding_adjustment: 0,
      base_rounded_total: 0,
      base_in_words: "",
      grand_total: 0,
      rounding_adjustment: 0,
      rounded_total: 0,
      in_words: "",
      advance_paid: 0,
      per_delivered: 0,
      per_billed: 0,
      disable_rounded_total: 0,
      ignore_pricing_rule: 0,
      group_same_items: 0,
      docstatus: 0,
      status: "Draft",
    })

    const [form, setForm] = useState<SalesOrderFormData>(() =>
      initialData ? { ...initialData } : buildEmptyForm(),
    )
    const [baseline, setBaseline] = useState<SalesOrderFormData>(() =>
      initialData ? { ...initialData } : buildEmptyForm(),
    )
    const [currencyFraction, setCurrencyFraction] = useState<number | null>(null)
    const [stockReservationEnabled, setStockReservationEnabled] = useState<boolean>(true)
    const [dimensions, setDimensions] = useState<AccountingDimension[]>([])
    const baselineRef = useRef<SalesOrderFormData>(baseline)
    const [activeTab, setActiveTab] = useState<SalesOrderFormTab>("details")

    const priceLists = useLazyOptions<string[]>(
      "sales-order:price-lists",
      salesOrderService.lookups.priceLists,
      [],
    )

    useEffect(() => {
      if (initialData) {
        const next = { ...initialData }
        setForm(next)
        setBaseline(next)
        baselineRef.current = next
      }
    }, [initialData])

    useEffect(() => {
      const frac = getCurrencySmallestFraction(form.currency)
      frac.then((f) => {
        if (f !== currencyFraction) setCurrencyFraction(f)
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.currency])

    // ERPNext parity: gate `reserve_stock` on the server feature flag
    // (erpnext ... get_stock_reservation_status).
    useEffect(() => {
      salesOrderService.getStockReservationStatus().then((enabled) => {
        setStockReservationEnabled(enabled)
        // Only default new-docs: mutating an existing (submitted/draft) doc
        // here would dirty it against baseline and force the Update button.
        if (!enabled && mode === "create") {
          setForm((prev) => ({
            ...prev,
            reserve_stock: 0,
            items: (prev.items ?? []).map((r) => ({ ...r, reserve_stock: 0 })),
          }))
        }
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const formRef = useRef(form)
    useEffect(() => {
      formRef.current = form
    }, [form])

    const inApplyPriceList = useRef(false)
    const companyAddressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const defaultsAppliedForCompany = useRef<string | null>(null)

    // Accounting dimensions → store dimension list + populate header & item
    // defaults once per mount (desk setup_accounting_dimension_triggers parity).
    useEffect(() => {
      quotationService.getAccountingDimensions().then((dims) => {
        // Store all configured dimensions for dynamic rendering
        if (dims.dimensionFilters?.length) {
          setDimensions(
            dims.dimensionFilters.map((d) => ({
              fieldname: d.fieldname,
              document_type: d.document_type,
              label: d.label,
            })),
          )
        }

        // Only auto-fill defaults on fresh new-docs; patching an existing doc
        // here would permanently dirty it against baseline (and thus always
        // show the submitted-UPDATE button).
        if (mode !== "create") return

        const company = formRef.current.company || defaultCompany
        const companyDims = dims.defaultDimensionsMap?.[company]
        if (!companyDims) return

        // Auto-populate header-level cost_center and project from defaults
        // (InvoiceForm parity — sets both header and item-level defaults).
        setForm((prev) => {
          const patch: Record<string, unknown> = {}
          let changed = false

          if (companyDims.cost_center && !prev.cost_center) {
            patch.cost_center = companyDims.cost_center
            changed = true
          }
          if (companyDims.project && !prev.project) {
            patch.project = companyDims.project
            changed = true
          }

          const items = prev.items ?? []
          const nextItems = items.map((it) => {
            if (!it.cost_center && companyDims.cost_center) {
              return { ...it, cost_center: companyDims.cost_center }
            }
            return it
          })
          if (nextItems.some((it, i) => it !== items[i])) {
            patch.items = nextItems
            changed = true
          }

          return changed ? { ...prev, ...patch } : prev
        })
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Desk TransactionController.apply_price_list(item, reset_plc_conversion)
    // (transaction.js:2018-2072): guard → mutex → call → apply parent/children.
    const runApplyPriceList = (
      docOverride?: Partial<SalesOrderDoc>,
      _item?: SalesOrderItemForm | null,
      resetPlcConversion = false,
    ) => {
      const base: Partial<SalesOrderDoc> = { ...(docOverride ?? formRef.current) }
      if (!resetPlcConversion) {
        base.plc_conversion_rate = undefined
      }
      const args = buildApplyPriceListArgs(
        base as Partial<SalesOrderDoc> & Record<string, unknown>,
      )
      const wireDoc = buildDeskApplyPriceListDoc(base as Partial<SalesOrderDoc> & Record<string, unknown>, {
        isNew: mode === "create" && !initialData,
      })
      const itemCount = Array.isArray(args.items) ? (args.items as unknown[]).length : 0
      if (!itemCount && !args.price_list) return
      if (inApplyPriceList.current) return
      inApplyPriceList.current = true
      salesOrderService
        .applyPriceList(args, wireDoc)
        .then((res) => {
          if (!res) return
          const parent = res.parent || {}
          const patch: SalesOrderFormData = {}
          if (parent.price_list_currency)
            patch.price_list_currency = String(parent.price_list_currency)
          const plcRate = Number(parent.plc_conversion_rate)
          if (!Number.isNaN(plcRate) && plcRate > 0) patch.plc_conversion_rate = plcRate
          setForm((prev) => (Object.keys(patch).length ? { ...prev, ...patch } : prev))
          const children = res.children ?? []
          if (children.length > 0) {
            setForm((prev) => {
              const items = [...(prev.items ?? [])]
              for (const child of children) {
                const c = child as Record<string, unknown>
                const idx = items.findIndex(
                  (it) =>
                    (!!c.child_docname && !!it.name && it.name === c.child_docname) ||
                    (!c.child_docname && !!it.item_code && it.item_code === c.item_code),
                )
                if (idx < 0) continue
                const row: SalesOrderItemForm = { ...items[idx] }
                for (const [key, value] of Object.entries(c)) {
                  if (
                    key === "doctype" ||
                    key === "name" ||
                    key === "free_item_data" ||
                    key === "child_docname" ||
                    key === "item_code"
                  ) {
                    continue
                  }
                  ;(row as unknown as Record<string, unknown>)[key] = value
                }
                if (c.price_list_rate !== undefined) row.rate = Number(c.price_list_rate)
                const discounted =
                  (row.rate || 0) - ((row.rate || 0) * (row.discount_percentage || 0)) / 100
                row.amount = Math.round(discounted * (row.qty || 0) * 100) / 100
                items[idx] = row
              }
              return { ...prev, items }
            })
          }
        })
        .finally(() => {
          inApplyPriceList.current = false
        })
    }

    // ── company() trigger chain (sales_common.js parity) ───────────────
    // validate_link on the Company value + debounced default address; on a
    // fresh new-doc also price list defaults and default taxes.
    useEffect(() => {
      const company = form.company || defaultCompany
      if (!company) return
      if (defaultsAppliedForCompany.current === company) return
      defaultsAppliedForCompany.current = company

      salesOrderService.validateLink("Company", company, []).catch(() => undefined)

      // ERPNext parity: the debounced default-address fetch is a company
      // *trigger* — it only fires when the user actually changes the Company.
      // Auto-refilling it on load would silently dirty an untouched doc (and
      // thus show the submitted UPDATE button after ~2s without any edit).
      const companyChanged = initialData
        ? company !== String(initialData.company ?? "")
        : true

      if (!companyChanged) return

      if (companyAddressTimer.current) clearTimeout(companyAddressTimer.current)
      companyAddressTimer.current = setTimeout(() => {
        salesOrderService
          .getDefaultCompanyAddress(company, formRef.current.company_address || "")
          .then((addr) => {
            setForm((prev) => ({ ...prev, company_address: addr ?? "" }))
          })
      }, 2000)

      if (mode === "create" && !initialData) {
        runApplyPriceList()

        salesOrderService.getDefaultTaxesAndCharges(company, "").then((res) => {
          setForm((prev) => {
            if (!res) return prev
            if (!res.taxes_and_charges && res.taxes.length === 0) return prev
            if ((prev.taxes ?? []).length > 0) return prev
            const patch: SalesOrderFormData = {
              taxes_and_charges: res.taxes_and_charges || undefined,
            }
            if (res.taxes.length > 0) patch.taxes = res.taxes as unknown as SalesOrderTax[]
            return { ...prev, ...patch }
          })
        })
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, form.company, initialData])

    useEffect(() => {
      return () => {
        if (companyAddressTimer.current) clearTimeout(companyAddressTimer.current)
      }
    }, [])

    const isDirty = () => JSON.stringify(form) !== JSON.stringify(baselineRef.current)
    useEffect(() => {
      onDirtyChange?.(isDirty())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, baseline])

    const isLocal = mode === "create" || !initialData?.name
    const baseRules = useSalesOrderVisibilityRules(form, undefined, isLocal)
    const docstatus = initialData?.docstatus ?? 0

    const rule = (fieldname: string) =>
      salesOrderResolveField(
        baseRules[fieldname] ?? SALES_ORDER_DEFAULT_FIELD_STATE,
        (form as unknown as Record<string, unknown>)[fieldname],
        docstatus,
        SALES_ORDER_EMPTY_HIDE_EXEMPT.has(fieldname),
      )

    const isFieldEditable = (fieldname: string): boolean => {
      if (docstatus === 0) return true
      if (docstatus === 2) return false
      return rule(fieldname).allowOnSubmit
    }

    const update = (patch: SalesOrderFormData) => setForm((prev) => ({ ...prev, ...patch }))

    const navigate = useNavigate()

    // ── Party (customer) select → get_party_details ──────────────────
    const handleCustomerSelect = async (party: string) => {
      if (!party) return
      update({ customer: party, customer_name: "" })
      const company = formRef.current.company || defaultCompany
      const transactionDate = formRef.current.transaction_date
      if (!company || !transactionDate) return
      let patch: SalesOrderFormData = { customer: party }
      try {
        const details: SalesOrderPartyDetails = await salesOrderService.getPartyDetails(
          "Customer",
          party,
          company,
          transactionDate,
          {
            priceList: formRef.current.selling_price_list,
            currency: formRef.current.currency,
            fetchPaymentTermsTemplate: true,
          },
        )
        const known = new Set([
          "customer_name", "customer_group", "territory", "language",
          "tax_category", "taxes_and_charges", "payment_terms_template",
          "customer_address", "address_display", "contact_person",
          "contact_display", "contact_mobile", "contact_phone", "contact_email",
          "shipping_address_name", "shipping_address", "currency",
          "shipping_contact_person", "shipping_contact_display", "shipping_contact_mobile",
          "conversion_rate", "selling_price_list", "price_list_currency",
          "plc_conversion_rate", "company_address", "company_address_display",
          "company_contact_person",
          // ERPNext fetch_from: customer.is_internal_customer / represents_company
          "is_internal_customer", "represents_company",
        ])
        for (const [key, value] of Object.entries(details)) {
          if (!known.has(key)) continue
          if (value === null || value === undefined) continue
          ;(patch as Record<string, unknown>)[key] = value
        }
      } catch {
        // party details fetch is best-effort
      }
      if (!(patch.customer_name ?? "").toString().trim()) {
        try {
          const res = await salesOrderService.getValue("Customer", "customer_name", { name: party })
          if (typeof res.customer_name === "string" && res.customer_name.trim()) {
            patch = { ...patch, customer_name: res.customer_name }
          }
        } catch {
          // fall back to customer code only
        }
      }
      // ERPNext parity: sales_order.js `frm.add_fetch("customer", "tax_id", "tax_id")`
      // auto-fetches the customer's Tax Id (shown only when the customer has one).
      try {
        const res = await salesOrderService.getValue("Customer", "tax_id", { name: party })
        if (typeof res.tax_id === "string" && res.tax_id.trim()) {
          patch = { ...patch, tax_id: res.tax_id }
        }
      } catch {
        // tax id is best-effort
      }
      if (formRef.current.customer !== party) return // stale response guard
      update(patch)
      // Desk customer()/party_name(): get_party_details callback → apply_price_list().
      runApplyPriceList({ ...formRef.current, ...patch })
    }

    // ── Currency change → get_exchange_rate ──────────────────────────
    // Desk currency(): fetch rate → set conversion_rate → conversion_rate()
    // trigger fires apply_price_list().
    const handleCurrencyChange = async (currency: string) => {
      update({ currency })
      if (currency === companyCurrency) {
        update({ conversion_rate: 1, price_list_currency: companyCurrency, plc_conversion_rate: 1 })
        runApplyPriceList({
          ...formRef.current,
          currency,
          conversion_rate: 1,
          price_list_currency: companyCurrency,
        })
        return
      }
      try {
        const rate = await salesOrderService.getExchangeRate(
          currency,
          companyCurrency,
          form.transaction_date || todayISO(),
        )
        const effectiveRate = rate || form.conversion_rate || 1
        setForm((prev) => ({
          ...prev,
          currency,
          conversion_rate: rate || prev.conversion_rate,
          price_list_currency: currency,
          plc_conversion_rate: rate || prev.plc_conversion_rate,
        }))
        runApplyPriceList({
          ...formRef.current,
          currency,
          conversion_rate: effectiveRate,
          price_list_currency: currency,
        })
      } catch {
        // keep prior conversion rate on failure
      }
    }

    // ── Address / contact display fills ──────────────────────────────
    const handleAddressSelect = (field: string, displayField: string) => async (v?: string) => {
      update({ [field]: v ?? "", [displayField]: "" })
      if (!v) return
      customerService.validateLink("Address", v).then(() => {
        quotationService.getAddressDisplay(v).then((display) => {
          if (display) update({ [displayField]: display })
        })
      }).catch(() => undefined)
    }

    const handleContactSelect = async (v?: string) => {
      update({ contact_person: v ?? "" })
      if (!v) {
        update({ contact_display: "", contact_mobile: "", contact_phone: "", contact_email: "" })
        return
      }
      customerService.validateLink("Contact", v).then(() => {
        quotationService.getContactDetails(v).then((details) => {
          update({
            contact_display: details.contact_display ?? "",
            contact_mobile: details.contact_mobile ?? "",
            contact_phone: details.contact_phone ?? "",
            contact_email: details.contact_email ?? "",
          })
        })
      }).catch(() => undefined)
    }

    const handleShippingContactSelect = async (v?: string) => {
      update({ shipping_contact_person: v ?? "" })
      if (!v) {
        update({ shipping_contact_display: "", shipping_contact_mobile: "" })
        return
      }
      customerService.validateLink("Contact", v).then(() => {
        quotationService.getContactDetails(v).then((details) => {
          update({
            shipping_contact_display: details.contact_display ?? "",
            shipping_contact_mobile: details.contact_mobile ?? "",
          })
        })
      }).catch(() => undefined)
    }

    // ── Item flow: item_code selection → get_item_details ────────────
    const blockIfMissingParty = (): boolean => {
      const missing = [
        (form.company || defaultCompany) ? null : "Company",
        form.customer ? null : "Customer",
      ].filter(Boolean)
      if (missing.length === 0) return false
      addToast(`Please specify: ${missing.join(", ")}. It is needed to fetch Item Details.`, "warning")
      return true
    }

    const runItemCodeFlow = async (idx: number, itemCode: string) => {
      const snapshot = formRef.current
      const current = snapshot.items?.[idx]
      if (!current || !itemCode) return

      const patched: SalesOrderItemForm = {
        ...current,
        item_code: itemCode,
        uom: "",
        conversion_factor: 0,
        price_list_rate: 0,
        rate: 0,
        amount: 0,
        warehouse: current.warehouse || snapshot.set_warehouse || "",
        reserve_stock: 0,
      }
      const items = [...(snapshot.items ?? [])]
      items[idx] = patched
      update({ items })

      const docPayload: Record<string, unknown> = {
        ...snapshot,
        name: snapshot.name || `new-sales-order-${deskRandomString()}`,
        doctype: "Sales Order",
        items,
        __islocal: mode === "create" && !initialData?.name ? 1 : 0,
        docstatus: snapshot.docstatus ?? 0,
      }
      const args: Record<string, unknown> = {
        item_code: itemCode,
        barcode: null,
        serial_no: undefined,
        batch_no: undefined,
        set_warehouse: snapshot.set_warehouse || undefined,
        warehouse: patched.warehouse || undefined,
        customer: snapshot.customer || undefined,
        currency: snapshot.currency || undefined,
        conversion_rate: snapshot.conversion_rate ?? 1,
        price_list: snapshot.selling_price_list || undefined,
        price_list_currency: snapshot.price_list_currency || undefined,
        plc_conversion_rate: snapshot.plc_conversion_rate ?? 1,
        company: snapshot.company || defaultCompany,
        order_type: snapshot.order_type || undefined,
        ignore_pricing_rule: snapshot.ignore_pricing_rule ?? 0,
        doctype: "Sales Order",
        name: docPayload.name || undefined,
        qty: patched.qty || 1,
        net_rate: patched.rate || undefined,
        stock_qty: patched.stock_qty || undefined,
        conversion_factor: 0,
        weight_per_unit: patched.weight_per_unit || 0,
        uom: null,
        stock_uom: patched.stock_uom || "Nos",
        tax_category: snapshot.tax_category || "",
        item_tax_template: undefined,
        child_doctype: "Sales Order Item",
        child_docname: patched.name || undefined,
        transaction_date: snapshot.transaction_date || todayISO(),
        delivery_date: snapshot.delivery_date || "",
        is_pos: 0,
        is_return: 0,
        is_subcontracted: undefined,
        update_stock: 0,
      }

      const details = await salesOrderService.getItemDetailsDesk(docPayload, args)
      if (!details || typeof details !== "object") return

      setForm((prev) => {
        const nextItems = [...(prev.items ?? [])]
        const target = { ...nextItems[idx] }
        const ignored = new Set([
          "item_code", "doctype", "name", "parent", "parentfield",
          "parenttype", "idx", "child_docname",
        ])
        for (const [k, v] of Object.entries(details)) {
          if (ignored.has(k)) continue
          if (v === undefined || v === null) continue
          ;(target as unknown as Record<string, unknown>)[k] = v
        }
        const plr = Number(target.price_list_rate) || 0
        const discPct = Number(target.discount_percentage) || 0
        const rate = plr - (plr * discPct) / 100
        target.rate = Math.round(rate * 10000) / 10000
        target.amount = Math.round((target.rate || 0) * (target.qty || 0) * 100) / 100
        // ERPNext parity: copy delivery_date from parent (or first row) to child row
        if (!target.delivery_date) {
          target.delivery_date = prev.delivery_date || nextItems[0]?.delivery_date || ""
        }
        nextItems[idx] = target
        return { ...prev, items: nextItems }
      })
    }

    const handleItemsChange = (next: SalesOrderItemForm[]) => {
      const prev = form.items ?? []
      if (next.length !== prev.length) {
        // ERPNext parity: when a new row is added, copy parent's project & delivery_date
        if (next.length > prev.length) {
          const parentProject = formRef.current.project || ""
          const parentDeliveryDate = formRef.current.delivery_date || prev[0]?.delivery_date || ""
          const patched = next.map((row, i) =>
            i >= prev.length
              ? { ...row, project: row.project || parentProject, delivery_date: row.delivery_date || parentDeliveryDate }
              : row,
          )
          update({ items: patched })
        } else {
          update({ items: next })
        }
        return
      }
      const items = [...prev]
      let changed = false
      next.forEach((row, i) => {
        const old = prev[i]
        if (!old || row === old) return
        changed = true
        const patch = { ...row } as SalesOrderItemForm
        if (row.item_code !== old.item_code) {
          if (row.item_code && !old.item_code) {
            if (blockIfMissingParty()) {
              patch.item_code = ""
              patch.item_name = ""
            } else {
              void runItemCodeFlow(i, row.item_code)
            }
          } else if (!row.item_code && old.item_code) {
            patch.item_name = ""
          }
        }
        if (row.qty !== old.qty) patch.qty = Math.max(0, Number(row.qty) || 0)
        if (row.rate !== old.rate) patch.rate = Math.max(0, Number(row.rate) || 0)
        if (patch.qty !== old.qty || patch.rate !== old.rate) {
          patch.amount = Math.round((patch.rate || 0) * (patch.qty || 0) * 100) / 100
        }
        if (row.delivery_date !== old.delivery_date) {
          patch.delivery_date = row.delivery_date
          // ERPNext parity: when parent has no delivery_date, propagate child date to all rows
          if (row.delivery_date && !formRef.current.delivery_date) {
            next.forEach((_row, j) => {
              if (j !== i) items[j] = { ...items[j], delivery_date: row.delivery_date } as SalesOrderItemForm
            })
          }
        }
        items[i] = patch
      })
      if (changed) update({ items })
    }

    const handleAddItemWithQty = async (product: Product, qty: number) => {
      if (blockIfMissingParty()) return
      const items = [...(formRef.current.items ?? [])]
      const existingIdx = items.findIndex((i) => i.item_code === product.item_code)
      if (existingIdx >= 0) {
        const row = items[existingIdx]
        const newQty = (row.qty || 0) + qty
        const rate = Number(row.rate) || 0
        items[existingIdx] = { ...row, qty: newQty, amount: Math.round(rate * newQty * 100) / 100 }
        update({ items })
        return
      }
      let idx = items.findIndex((i) => !i.item_code && !i.item_name)
      if (idx < 0) {
        items.push(createEmptyItem())
        idx = items.length - 1
      }
      items[idx] = { ...items[idx], qty }
      update({ items })
      await runItemCodeFlow(idx, product.item_code)
    }

    // Scan Barcode → get_item_details; replaces an empty row or appends.
    const handleScanBarcode = async (barcode: string) => {
      const value = (barcode ?? "").trim()
      if (!value) return
      if (blockIfMissingParty()) return
      const items = [...(formRef.current.items ?? [])]
      let idx = items.findIndex((i) => !i.item_code && !i.item_name)
      if (idx < 0) {
        items.push(createEmptyItem())
        idx = items.length - 1
      }
      update({ items })
      await runItemCodeFlow(idx, value)
      const row = formRef.current.items?.[idx]
      if (row?.warehouse) update({ last_scanned_warehouse: row.warehouse })
    }

    const lineItemsForModal: LineItemForm[] = (form.items ?? []).map((i, idx) => ({
      id: String(idx),
      productId: i.item_code || "",
      productName: i.item_name || "",
      quantity: i.qty ?? 1,
      price: i.rate ?? 0,
      total: i.amount ?? 0,
      uom: i.uom,
      warehouse: i.warehouse,
      conversionFactor: i.conversion_factor,
      discountPercentage: i.discount_percentage,
    }))

    // ── Taxes & totals ────────────────────────────────────────────────
    const itemTotals = useMemo(() => {
      const items = form.items ?? []
      const total_qty = items.reduce((s, i) => s + (i.qty || 0), 0)
      const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
      const total_net_weight = items.reduce((s, i) => s + (i.total_weight || 0), 0)
      return { total_qty, subtotal, total_net_weight }
    }, [form.items])

    const { total_qty, subtotal, total_net_weight } = itemTotals

    const taxRowsBase = useMemo(
      () => computeTaxes(soTaxesToEditable(form.taxes ?? []), subtotal, total_qty),
      [form.taxes, subtotal, total_qty],
    )
    const total_taxes_base = useMemo(
      () => taxRowsBase.reduce((sum, r) => sum + r.tax_amount, 0),
      [taxRowsBase],
    )

    const apply_discount_on = (form.apply_discount_on ?? "Grand Total") as
      | "Grand Total"
      | "Net Total"

    let additional_discount = 0
    {
      const da = form.discount_amount ?? 0
      if (da > 0) {
        additional_discount = da
      } else if ((form.additional_discount_percentage ?? 0) > 0) {
        const base =
          apply_discount_on === "Net Total" ? subtotal : subtotal + total_taxes_base
        additional_discount =
          Math.round(base * ((form.additional_discount_percentage ?? 0) / 100) * 100) / 100
      }
    }

    const total_for_discount =
      apply_discount_on === "Net Total"
        ? subtotal
        : computeTotalForDiscountAmount(taxRowsBase, subtotal, total_taxes_base)

    const net_total =
      !total_for_discount
        ? subtotal
        : Math.round(
            (subtotal - additional_discount * (subtotal / total_for_discount)) * 100,
          ) / 100

    const taxState = useMemo(() => {
      const computed = computeTaxes(taxRowsBase, subtotal, total_qty, {
        netTotal: net_total,
        applyDiscountOn: apply_discount_on,
      })
      const total_taxes = computed.reduce(
        (s, r) => s + (r.tax_amount_after_discount_amount ?? 0),
        0,
      )
      const grand_total =
        apply_discount_on === "Grand Total"
          ? Math.round((subtotal + total_taxes_base - additional_discount) * 100) / 100
          : Math.round((net_total + total_taxes) * 100) / 100
      return { editable: taxRowsBase, computed, total_taxes, grand_total }
    }, [
      taxRowsBase,
      subtotal,
      total_qty,
      net_total,
      apply_discount_on,
      total_taxes_base,
      additional_discount,
    ])

    const breakupRows = useMemo(() => {
      const parseItemTaxRate = (raw?: string): Record<string, number> | undefined => {
        if (!raw) return undefined
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>
          const out: Record<string, number> = {}
          for (const [head, rate] of Object.entries(parsed)) {
            const num = typeof rate === "number" ? rate : parseFloat(String(rate))
            if (Number.isFinite(num)) out[head] = num
          }
          return Object.keys(out).length ? out : undefined
        } catch {
          return undefined
        }
      }

      const rawNetAmounts = (form.items ?? []).map((it) => it.amount ?? 0)
      const discounted = applyDiscountToItemNetAmounts(rawNetAmounts, {
        discountAmount: additional_discount,
        applyDiscountOn: apply_discount_on,
        netTotal: subtotal,
        taxRows: taxRowsBase,
        totalTaxesAndChargesBase: total_taxes_base,
        discountedNetTotal: net_total,
      })

      const soItems = (form.items ?? []).map((it, idx) => ({
        itemCode: it.item_code || "",
        itemName: it.item_name,
        netAmount: discounted.netAmounts[idx] ?? it.amount ?? 0,
      }))
      const taxes = form.taxes ?? []
      const hasStoredDetail = taxes.some((t) => !!t.item_wise_tax_detail)
      if (hasStoredDetail) {
        return getItemisedTaxBreakupRowsFromDetail(
          taxes.map((t) => ({
            description: t.description || t.account_head,
            category: t.category,
            item_wise_tax_detail: t.item_wise_tax_detail,
          })),
          soItems,
          form.conversion_rate ?? 1,
        )
      }
      return getItemisedTaxBreakupData(
        soItems.map((it, idx) => ({
          ...it,
          qty: (form.items ?? [])[idx]?.qty ?? 0,
          itemTaxRate: parseItemTaxRate((form.items ?? [])[idx]?.item_tax_rate),
        })),
        taxes.map(
          (t): ItemisedTaxBreakupTaxRow => ({
            charge_type: (t.charge_type || "On Net Total") as ChargeType,
            description: t.description || t.account_head,
            account_head: t.account_head || "",
            rate: t.rate ?? 0,
            tax_amount: t.tax_amount ?? 0,
            category: t.category || "Total",
            row_id: t.row_id,
          }),
        ),
        { netTotal: discounted.netAmounts.reduce((s, n) => s + n, 0), conversionRate: form.conversion_rate ?? 1 },
      )
    }, [form.items, form.taxes, net_total, form.conversion_rate, additional_discount, apply_discount_on, subtotal, taxRowsBase, total_taxes_base])

    const rounded_total = roundToSmallestCurrencyFraction(taxState.grand_total, currencyFraction)
    const rounding_adjustment = Math.round((rounded_total - taxState.grand_total) * 100) / 100
    const conversion_rate = form.conversion_rate ?? 1
    const base_grand_total = taxState.grand_total * conversion_rate
    const base_rounded_total = Math.round(base_grand_total * 100) / 100
    const base_total = Math.round(subtotal * conversion_rate * 100) / 100
    const base_net_total = Math.round(net_total * conversion_rate * 100) / 100
    const base_rounding_adjustment = Math.round((base_rounded_total - base_grand_total) * 100) / 100
    const base_discount_amount = Math.round((form.discount_amount ?? 0) * conversion_rate * 100) / 100

    // ── Commission (ERPNext calculate_commission parity) ──────────────
    // amount_eligible_for_commission = Σ item.base_net_amount over items with
    // grant_commission; total_commission = amount_eligible * rate / 100.
    const amountEligibleForCommission = useMemo(() => {
      const conv = form.conversion_rate ?? 1
      return (form.items ?? []).reduce(
        (sum, item) =>
          item.grant_commission
            ? sum + (item.base_net_amount ?? item.base_amount ?? round2((item.amount ?? 0) * conv))
            : sum,
        0,
      )
    }, [form.items, form.conversion_rate])

    const totalCommission = useMemo(
      () => round2((amountEligibleForCommission * (form.commission_rate ?? 0)) / 100),
      [amountEligibleForCommission, form.commission_rate],
    )

    // Keep Sales Team allocated_amount / incentives live whenever the eligible
    // amount moves (it is derived from the items grid / exchange rate).
    useEffect(() => {
      setForm((prev) => {
        const rows = prev.sales_team ?? []
        if (!rows.some((r) => r.allocated_percentage)) return prev
        const next = recomputeSalesTeamRows(rows, amountEligibleForCommission)
        return JSON.stringify(next) === JSON.stringify(rows) ? prev : { ...prev, sales_team: next }
      })
    }, [amountEligibleForCommission])

    const handleTaxChange = (rows: EditableTaxRow[]) => {
      update({ taxes: editableToSalesOrderTaxes(rows) })
    }

    // ERPNext fetch_from parity: picking a Sales Partner hits
    // frappe.model.utils.get_fetch_values and copies commission_rate over. The
    // field carries fetch_if_empty=1, so it is only applied when the rate is
    // still empty — a manually-entered rate is never overwritten. Clearing the
    // partner leaves the rate untouched (ERPNext does the same).
    const handleSalesPartnerChange = async (value: string | undefined) => {
      update({ sales_partner: value ?? "" })
      if (!value) return
      const fetchValues = await salesOrderService.getFetchValues("Sales Order", "sales_partner", value)
      const fetched = Number(fetchValues?.commission_rate)
      const currentRate = form.commission_rate ?? 0
      if (!Number.isNaN(fetched) && !currentRate && fetched !== currentRate) {
        update({ commission_rate: fetched })
      }
    }

    // ERPNext sales_common.js: commission_rate > 100 is clamped to 100 and
    // "Commission Rate cannot be greater than 100" is thrown.
    const handleCommissionRateChange = (value: number | undefined) => {
      const raw = value ?? 0
      if (raw > 100) {
        addToast("Commission Rate cannot be greater than 100", "warning")
        update({ commission_rate: 100 })
        return
      }
      update({ commission_rate: raw })
    }

    // ERPNext sales_common.js update_auto_repeat_reference parity: posts the
    // Auto Repeat + this Sales Order name and alerts on the result ("success" →
    // green alert, anything else → error).
    const handleUpdateAutoRepeatReference = async () => {
      if (!form.auto_repeat) return
      try {
        const result = await salesOrderService.updateAutoRepeatReference(
          form.auto_repeat,
          form.name ?? "",
        )
        if (result === "success") {
          addToast("Auto repeat document updated", "success")
        } else {
          addToast("An error occurred during the update process", "error")
        }
      } catch {
        addToast("An error occurred during the update process", "error")
      }
    }

    const discountBase = (applyOn: "Grand Total" | "Net Total"): number =>
      applyOn === "Net Total" ? subtotal : subtotal + total_taxes_base

    const handleApplyDiscountOnChange = (applyOn: "Grand Total" | "Net Total") => {
      update({ apply_discount_on: applyOn })
      if ((form.additional_discount_percentage ?? 0) > 0) {
        update({
          discount_amount:
            Math.round(
              discountBase(applyOn) * ((form.additional_discount_percentage ?? 0) / 100) * 100,
            ) / 100,
        })
      }
    }

    const handleAdditionalDiscountPercentageChange = (value: number | undefined) => {
      update({ additional_discount_percentage: value })
      if (value && value > 0) {
        update({ discount_amount: Math.round(discountBase(apply_discount_on) * (value / 100) * 100) / 100 })
      } else {
        update({ discount_amount: undefined })
      }
    }

    const handleAdditionalDiscountAmountChange = (value: number | undefined) => {
      update({ discount_amount: value })
      if (value && value > 0) {
        update({ additional_discount_percentage: undefined })
      }
    }

    const handleTaxesAndChargesSelect = async (template: string) => {
      update({ taxes_and_charges: template })
      if (!template) return
      try {
        const result = await salesOrderService.getTaxesAndCharges(template)
        if (result.taxes && result.taxes.length > 0) {
          update({ taxes: result.taxes })
        }
        if (result.tax_category) update({ tax_category: result.tax_category })
      } catch {
        // template fill is best-effort
      }
    }

    const handlePaymentTermsSelect = async (template: string, postingDate?: string) => {
      // Byte-parity with transaction.js payment_terms_template(): fetch the
      // full Payment Schedule from get_payment_terms (amounts based on the
      // rounded total, like ERPNext) and replace the rows.
      update({ payment_terms_template: template })
      if (!template) return
      try {
        const result = await salesOrderService.getPaymentTerms(
          template,
          postingDate || form.transaction_date || todayISO(),
          rounded_total || taxState.grand_total,
          base_rounded_total || base_grand_total,
        )
        if (result) {
          const rows: SalesOrderPaymentScheduleRow[] = result.map((s) => ({
            payment_term: String(s.payment_term ?? ""),
            description: String(s.description ?? ""),
            due_date: String(s.due_date ?? "").slice(0, 10),
            invoice_portion: Number(s.invoice_portion ?? 0) || 0,
            payment_amount: Number(s.payment_amount ?? 0) || 0,
            base_payment_amount:
              s.base_payment_amount != null ? Number(s.base_payment_amount) || 0 : undefined,
            due_date_based_on:
              s.due_date_based_on != null ? String(s.due_date_based_on) : undefined,
            credit_days: s.credit_days != null ? Number(s.credit_days) : undefined,
            credit_months: s.credit_months != null ? Number(s.credit_months) : undefined,
            mode_of_payment: s.mode_of_payment != null ? String(s.mode_of_payment) : undefined,
          }))
          update({ payment_schedule: rows })
        }
      } catch {
        // payment terms fill is best-effort
      }
    }

    const handlePaymentTermSelect = async (row: SalesOrderPaymentScheduleRow, term: string) => {
      // Byte-parity with transaction.js payment_term(): picking a Payment
      // Term in the schedule grid auto-fills the row's schedule fields.
      if (!term) return
      try {
        const details = await salesOrderService.getPaymentTermDetails(
          term,
          form.transaction_date || todayISO(),
          rounded_total || taxState.grand_total,
          base_rounded_total || base_grand_total,
        )
        if (!details) return
        update({
          payment_schedule: (form.payment_schedule ?? []).map((r) =>
            r === row
              ? {
                  ...r,
                  payment_term: term,
                  description: (details.description as string | undefined) ?? r.description,
                  due_date: String(details.due_date ?? "").slice(0, 10) || r.due_date,
                  invoice_portion:
                    details.invoice_portion != null
                      ? Number(details.invoice_portion)
                      : r.invoice_portion,
                  payment_amount:
                    details.payment_amount != null ? Number(details.payment_amount) : r.payment_amount,
                  base_payment_amount:
                    details.base_payment_amount != null
                      ? Number(details.base_payment_amount)
                      : r.base_payment_amount,
                  due_date_based_on:
                    details.due_date_based_on != null
                      ? String(details.due_date_based_on)
                      : r.due_date_based_on,
                  credit_days:
                    details.credit_days != null ? Number(details.credit_days) : r.credit_days,
                  credit_months:
                    details.credit_months != null ? Number(details.credit_months) : r.credit_months,
                  mode_of_payment:
                    details.mode_of_payment != null
                      ? String(details.mode_of_payment)
                      : r.mode_of_payment,
                }
              : r,
          ),
        })
      } catch {
        // payment term detail fill is best-effort
      }
    }

    const handleTermsSelect = async (template: string) => {
      // Byte-parity with erpnext.utils.get_terms(): selecting a Terms
      // template renders it server-side and fills the terms field. Clearing
      // the template leaves the rendered terms intact (ERPNext no-ops).
      update({ tc_name: template })
      if (!template) return
      try {
        const doc: Record<string, unknown> = {
          customer: form.customer,
          customer_name: form.customer_name,
          company: form.company || defaultCompany,
          transaction_date: form.transaction_date || todayISO(),
          currency: form.currency || companyCurrency,
          conversion_rate,
          grand_total: taxState.grand_total,
          base_grand_total,
          rounded_total,
          base_rounded_total,
        }
        const rendered = await salesOrderService.getTermsAndConditions(template, doc)
        if (rendered != null) update({ terms: rendered })
      } catch {
        // terms fill is best-effort
      }
    }

    const currencyLabel = form.currency || companyCurrency

    const itemColumns: GridColumn<SalesOrderItemForm>[] = [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await salesOrderService.searchItemsDesk(q).catch(() => [])
          return {
            items: results.map((r) => ({
              value: r.value,
              label: r.value,
              description: r.description ?? "",
            })),
          }
        },
        placeholder: "Search item…",
        indicator: (row) => {
          if (!row.item_code) return undefined
          const stockAvail = (row.stock_qty ?? 0) - (row.delivered_qty ?? 0)
          return stockAvail <= (row.actual_qty ?? 0) ? "green" : "red"
        },
      },
      {
        key: "delivery_date",
        label: "Delivery Date",
        type: "date",
        weight: 1.4,
      },
      { key: "qty", label: "Quantity", type: "number", align: "right" },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        placeholder: "0",
        prefix: "$",
        formatter: (row) => formatCurrency(row.rate ?? 0, currencyLabel),
      },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.amount ?? 0, currencyLabel),
      },
    ]

    const readOnlyItemColumns: GridColumn<SalesOrderItemForm>[] = [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        indicator: (row) => {
          if (!row.item_code) return undefined
          const stockAvail = (row.stock_qty ?? 0) - (row.delivered_qty ?? 0)
          return stockAvail <= (row.actual_qty ?? 0) ? "green" : "red"
        },
      },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
      {
        key: "qty",
        label: "Quantity",
        type: "number",
        align: "right",
        formatter: (row) => formatFixed(row.qty ?? 0, 3),
      },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        formatter: (row) => formatCurrency(row.rate ?? 0, currencyLabel),
      },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.amount ?? 0, currencyLabel),
      },
    ]

    const paymentScheduleColumns: GridColumn<SalesOrderPaymentScheduleRow>[] = [
      {
        key: "payment_term",
        label: "Payment Term",
        type: "link",
        docType: "Payment Term",
        searchFn: async (q) => {
          const results = await customerService.searchLink("Payment Term", q, "Sales Order")
          return { items: results }
        },
        onSelect: (row, value) => void handlePaymentTermSelect(row, value),
      },
      { key: "description", label: "Description", type: "text" },
      { key: "due_date", label: "Due Date", type: "date" },
      {
        key: "invoice_portion",
        label: "Invoice Portion",
        type: "number",
        align: "right",
        formatter: (row) => `${row.invoice_portion ?? 0}%`,
      },
      {
        key: "payment_amount",
        label: "Payment Amount",
        type: "number",
        align: "right",
        formatter: (row) => formatCurrency(row.payment_amount ?? 0, currencyLabel),
      },
    ]

    const pricingRuleColumns: GridColumn<SalesOrderPricingRuleRow>[] = [
      { key: "pricing_rule", label: "Pricing Rule", type: "readonly" },
      {
        key: "rule_applied",
        label: "Applied",
        type: "readonly",
        formatter: (row) => (row.rule_applied ? "Yes" : "No"),
      },
    ]

    // ERPNext sales_team.json parity: sales_person is a required Link to
    // Sales Person; allocated_amount is read-only currency; commission_rate is
    // read-only data fetched from the Sales Person (fetch_from
    // "sales_person.commission_rate", fetch_if_empty=1); incentives is editable.
    const salesTeamColumns: GridColumn<SalesOrderSalesTeamRow>[] = [
      {
        key: "sales_person",
        label: "Sales Person",
        type: "link",
        docType: "Sales Person",
        searchFn: async (q) => ({
          items: await customerService.searchLink(
            "Sales Person",
            q,
            "Sales Team",
            getLinkFilters("Sales Team", "sales_person")
          ),
        }),
      },
      { key: "allocated_percentage", label: "Contribution (%)", type: "number", align: "right" },
      {
        key: "allocated_amount",
        label: "Contribution to Net Total",
        type: "readonly",
        align: "right",
        formatter: (row) =>
          row.allocated_amount
            ? formatCurrency(row.allocated_amount, currencyLabel)
            : <span className="text-muted">Contribution to Net Total</span>,
      },
      {
        key: "commission_rate",
        label: "Commission Rate",
        type: "readonly",
        align: "right",
        formatter: (row) =>
          row.commission_rate
            ? String(row.commission_rate)
            : <span className="text-muted">Commission Rate</span>,
      },
      { key: "incentives", label: "Incentives", type: "number", align: "right" },
    ]

    const handleSave = async (action?: "Save" | "Update" | "Submit"): Promise<string | undefined> => {
      const submitted = mode === "edit" && (initialData?.docstatus ?? 0) === 1
      if (submitted) {
        // A submitted Sales Order cannot be re-saved as a whole document:
        // savedocs action "Update" re-submits it server-side and the bench
        // rejects that with a child-doctype permission 403 (PermissionError:
        // No permission for Sales Order Item). ERPNext itself only allows
        // child item qty/rate edits after submit, via update_child_qty_rate.
        if (action === "Submit") {
          throw new Error("This Sales Order is already submitted.")
        }
        const baseline = baselineRef.current
        if (baseline) {
          const diff = diffSubmittedForm(form, baseline)
          if (diff.removed.length > 0) {
            throw new Error(
              `Items cannot be removed from a submitted Sales Order: ${diff.removed.join(", ")}.`,
            )
          }
          if (diff.updatedItems.length > 0) {
            if (diff.nonItemFields.length > 0) {
              throw new Error(
                `Submitted Sales Orders are locked after submission. Only item quantity/rate can be changed (Update Items) — locked field(s): ${diff.nonItemFields.join(", ")}.`,
              )
            }
            await salesOrderService.updateChildQtyRate(initialData?.name ?? "", diff.updatedItems)
            baselineRef.current = { ...form, name: initialData?.name }
            setBaseline(baselineRef.current)
            onSaved?.(initialData as unknown as SalesOrderDoc)
            return initialData?.name
          }
          if (diff.nonItemFields.length > 0) {
            throw new Error(
              `Submitted Sales Orders are locked after submission — the server rejects re-saving a submitted order. Locked field(s): ${diff.nonItemFields.join(", ")}. Use "Update Items" for item quantity/rate, or amend the order.`,
            )
          }
        }
        return initialData?.name
      }

      const doc: Record<string, unknown> = {
        ...form,
        // Flatten accounting_dimensions into top-level fields (ERPNext parity —
        // custom dimensions like department/branch are stored as top-level doctype
        // fields, not nested under an accounting_dimensions key).
        ...(form.accounting_dimensions ?? {}),
        doctype: "Sales Order",
        items: (form.items ?? []).map(({ name: _n, ...rest }) => rest),
        taxes: (form.taxes ?? []).map(({ name: _n, ...rest }) => rest),
        payment_schedule: (form.payment_schedule ?? []).map(({ name: _n, ...rest }) => rest),
        pricing_rules: (form.pricing_rules ?? []).map(({ name: _n, ...rest }) => rest),
        packed_items: (form.packed_items ?? []).map(({ name: _n, ...rest }) => rest),
        sales_team: (form.sales_team ?? []).map(({ name: _n, ...rest }) => rest),
        total_qty,
        total_net_weight,
        net_total,
        total: subtotal,
        base_total,
        base_net_total: Math.round(net_total * conversion_rate * 100) / 100,
        base_discount_amount,
        total_taxes_and_charges: taxState.total_taxes,
        base_total_taxes_and_charges: Math.round(taxState.total_taxes * conversion_rate * 100) / 100,
        grand_total: taxState.grand_total,
        base_grand_total,
        rounding_adjustment,
        rounded_total,
        base_rounding_adjustment,
        base_rounded_total,
        amount_eligible_for_commission: amountEligibleForCommission,
        total_commission: totalCommission,
      }
      if (mode === "edit" && initialData?.name) {
        doc.name = initialData.name
      } else if (!doc.name) {
        doc.__islocal = 1
        doc.name = "new-sales-order"
      }
      const saved =
        action === "Submit" ? await salesOrderService.saveDoc(doc, "Submit") : await salesOrderService.saveDoc(doc, "Save")
      baselineRef.current = { ...form, name: saved?.name }
      setBaseline(baselineRef.current)
      onSaved?.(saved)
      return saved?.name
    }

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty,
      addItems: (newItems: SalesOrderItemForm[]) => {
        setForm((prev) => ({
          ...prev,
          items: [...(prev.items ?? []).filter(isFilledItemRow), ...newItems],
        }))
      },
    }))

    const Field = ({
      label,
      children,
      fieldname,
      className = "",
    }: {
      label: string
      children: ReactNode
      fieldname: string
      className?: string
    }) => {
      const r = rule(fieldname)
      if (!r.visible) return null
      return (
        <div className={className}>
          <label className={labelClass}>{label}</label>
          {children}
        </div>
      )
    }

    const headerLocked = docstatus !== 0

    return (
      <div className="space-y-4">
        <div className="flex border-b border-border gap-0">
          {[
            { id: "details", label: "Details" },
            { id: "address", label: "Address & Contact" },
            { id: "terms", label: "Terms" },
            { id: "more_info", label: "More Info" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SalesOrderFormTab)}
              className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-muted hover:text-body"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "details" && (
          <div className="space-y-4">
            {/* Section 1: Header — ERPNext 3-column layout */}
            <div className="pb-4 border-b border-border">
              {mode !== "create" && (
                <div className="mb-3">
                  <label className={labelClass}>Series</label>
                  <div className="font-medium text-sm py-1.5">
                    {form.naming_series || "SAL-ORD-.YYYY.-"}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Col 1 */}
                <div className="space-y-3">
                  {mode === "create" && (
                    <div>
                      <label className={labelClass}>Series *</label>
                      <select
                        value={form.naming_series ?? "SAL-ORD-.YYYY.-"}
                        onChange={(e) => update({ naming_series: e.target.value })}
                        className={inputClass}
                      >
                        <option value="SAL-ORD-.YYYY.-">SAL-ORD-.YYYY.-</option>
                      </select>
                    </div>
                  )}
                  <Field label="Customer *" fieldname="customer">
                    {headerLocked ? (
                      <a
                        href={`/customers/${encodeURIComponent(form.customer ?? "")}`}
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/customers/${encodeURIComponent(form.customer ?? "")}`)
                        }}
                        className={`${inputClass} block bg-gray-50 font-semibold text-primary cursor-pointer break-all`}
                      >
                        {form.customer_name || form.customer}
                      </a>
                    ) : (
                      <LinkSearchField
                        value={form.customer}
                        onChange={(v) => {
                          if (v !== form.customer) void handleCustomerSelect(v ?? "")
                        }}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink("Customer", q, "Sales Order")
                          return { items: results }
                        }}
                        validate={async (v) => {
                          await customerService.validateLink("Customer", v)
                        }}
                        docType="Customer"
                        placeholder="Select customer…"
                        required={rule("customer").reqd}
                      />
                    )}
                  </Field>
                  {form.tax_id && (
                    <div>
                      <label className={labelClass}>Tax ID</label>
                      <input
                        type="text"
                        value={form.tax_id}
                        readOnly
                        className={`${inputClass} bg-gray-50`}
                      />
                    </div>
                  )}
                  <Field label="Order Type *" fieldname="order_type">
                    {headerLocked ? (
                      <input type="text" value={form.order_type} readOnly className={inputClass} />
                    ) : (
                      <select
                        value={form.order_type}
                        onChange={(e) => update({ order_type: e.target.value as SalesOrderDoc["order_type"] })}
                        className={inputClass}
                      >
                        {ORDER_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>
                {/* Col 2 */}
                <div className="space-y-3">
                  <Field label="Date *" fieldname="transaction_date">
                    {headerLocked ? (
                      <input type="date" value={form.transaction_date} readOnly className={inputClass} />
                    ) : (
                      <DateInput
                        value={form.transaction_date}
                        onChange={(e) => {
                          const transactionDate = e.target.value
                          const items = (formRef.current.items ?? []).map((row) => ({
                            ...row,
                            delivery_date: "",
                          }))
                          update({ transaction_date: transactionDate, delivery_date: "", items })
                          if (form.payment_terms_template && transactionDate) {
                            // Byte-parity with transaction.js recalculate_terms():
                            // re-fetch the Payment Schedule on date change.
                            void handlePaymentTermsSelect(form.payment_terms_template, transactionDate)
                          }
                        }}
                        readOnly={rule("transaction_date").readOnly}
                      />
                    )}
                  </Field>
                  <Field label="Delivery Date *" fieldname="delivery_date">
                    <DateInput
                      value={form.delivery_date ?? ""}
                      min={form.transaction_date || ""}
                      onChange={(e) => {
                        const deliveryDate = e.target.value
                        const items = (formRef.current.items ?? []).map((row) => ({
                          ...row,
                          delivery_date: deliveryDate || row.delivery_date,
                        }))
                        update({ delivery_date: deliveryDate, items })
                      }}
                      readOnly={!isFieldEditable("delivery_date")}
                    />
                  </Field>
                </div>
                {/* Col 3 */}
                <div className="space-y-3">
                  {!singleCompany && (
                    <div>
                      <label className={labelClass}>Company *</label>
                      {headerLocked ? (
                        <input type="text" value={form.company} readOnly className={inputClass} />
                      ) : (
                        <LinkSearchField
                          value={form.company}
                          onChange={(v) => update({ company: v ?? "" })}
                          searchFn={async (q) => {
                            const results = await customerService.searchLink("Company", q, "Sales Order")
                            return { items: results }
                          }}
                          validate={async (v) => {
                            await customerService.validateLink("Company", v)
                          }}
                          docType="Company"
                          placeholder="Select company…"
                          required={rule("company").reqd}
                        />
                      )}
                    </div>
                  )}
                  <Field label="Customer's Purchase Order" fieldname="po_no">
                    <Input
                      value={form.po_no ?? ""}
                      onChange={(e) => update({ po_no: e.target.value || "" })}
                      placeholder="PO number…"
                      readOnly={!isFieldEditable("po_no")}
                    />
                  </Field>
                  <Field label="Customer's Purchase Order Date" fieldname="po_date">
                    <DateInput
                      value={form.po_date ?? ""}
                      onChange={(e) => update({ po_date: e.target.value })}
                      readOnly={!isFieldEditable("po_date")}
                    />
                  </Field>
                  {form.amended_from && (
                    <div>
                      <label className={labelClass}>Amended From</label>
                      <input
                        type="text"
                        value={form.amended_from}
                        readOnly
                        onClick={() => navigate(`/sales-orders/${encodeURIComponent(form.amended_from ?? "")}`)}
                        title="Open amended sales order"
                        className={`${inputClass} bg-gray-50 text-primary cursor-pointer`}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== Accounting Dimensions ===== */}
            {(() => {
              const readDim = (fn: string): string =>
                ((form as unknown as Record<string, unknown>)[fn] as string) ?? ""
              const hasDimValue =
                !!form.cost_center ||
                !!form.project ||
                (dimensions.length > 0 &&
                  dimensions.some(
                    (d) => !!readDim(d.fieldname) || !!form.accounting_dimensions?.[d.fieldname],
                  ))
              // ERPNext parity: on submitted/cancelled orders the collapsible section
              // is hidden entirely when no dimension holds a value.
              if (docstatus > 0 && !hasDimValue) return null
              return (
                <CollapsibleSection title="Accounting Dimensions" defaultOpen={hasDimValue}>
                  {dimensions.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {dimensions.map((d) => {
                        const fieldname = d.fieldname
                        const docType = d.document_type
                        const label =
                          docType === "Cost Center"
                            ? "Cost Center"
                            : docType === "Project"
                              ? "Project"
                              : d.label || docType
                        // Cost Center and Project are top-level fields; all other
                        // dimensions go into accounting_dimensions record.
                        const isBuiltin = fieldname === "cost_center" || fieldname === "project"
                        // Loaded docs carry dims as top-level fields (flattening happens
                        // only on save); fall back to the nested map for in-draft edits.
                        const currentValue = isBuiltin
                          ? readDim(fieldname)
                          : readDim(fieldname) || (form.accounting_dimensions?.[fieldname] ?? "")
                        const handleDimChange = (v?: string) => {
                          if (isBuiltin) {
                            update({ [fieldname]: v ?? "" } as SalesOrderFormData)
                          } else {
                            update({
                              accounting_dimensions: {
                                ...(form.accounting_dimensions ?? {}),
                                [fieldname]: v ?? "",
                              },
                            })
                          }
                        }
                        if (isBuiltin && !rule(fieldname).visible) return null
                        return (
                          <div key={fieldname}>
                            <label className={labelClass}>{label}</label>
                            <LinkSearchField
                              value={currentValue}
                              onChange={handleDimChange}
                              searchFn={async (q) => {
                                const results = await customerService.searchLink(docType, q, "Sales Order")
                                return { items: results }
                              }}
                              validate={async (v) => {
                                await customerService.validateLink(docType, v)
                              }}
                              docType={docType}
                              placeholder={`Select ${label.toLowerCase()}…`}
                              clearIconMode="hover"
                              disabled={!isFieldEditable(fieldname)}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {rule("cost_center").visible && (
                        <div>
                          <label className={labelClass}>Cost Center</label>
                          <LinkSearchField
                            value={form.cost_center ?? ""}
                            onChange={(v) => update({ cost_center: v ?? "" })}
                            searchFn={async (q) => {
                              const results = await customerService.searchLink("Cost Center", q, "Sales Order")
                              return { items: results }
                            }}
                            validate={async (v) => {
                              await customerService.validateLink("Cost Center", v)
                            }}
                            docType="Cost Center"
                            placeholder="Select cost center…"
                            clearIconMode="hover"
                            disabled={!isFieldEditable("cost_center")}
                          />
                        </div>
                      )}
                      {rule("project").visible && (
                        <div>
                          <label className={labelClass}>Project</label>
                          <LinkSearchField
                            value={form.project ?? ""}
                            onChange={(v) => update({ project: v ?? "" })}
                            searchFn={async (q) => {
                              const results = await customerService.searchLink("Project", q, "Sales Order")
                              return { items: results }
                            }}
                            validate={async (v) => {
                              await customerService.validateLink("Project", v)
                            }}
                            docType="Project"
                            placeholder="Select project…"
                            clearIconMode="hover"
                            disabled={!isFieldEditable("project")}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CollapsibleSection>
              )
            })()}

            {/* ===== Currency and Price List ===== */}
            <CollapsibleSection title="Currency and Price List">
              {(() => {
                const effectiveCurrency = form.currency || companyCurrency
                const showConversionRate =
                  effectiveCurrency.length > 0 && effectiveCurrency !== companyCurrency
                const effectivePlcCurrency = form.price_list_currency || companyCurrency
                const showPlcRate =
                  effectivePlcCurrency.length > 0 && effectivePlcCurrency !== companyCurrency
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Currency *</label>
                        <LinkSearchField
                          value={form.currency || companyCurrency}
                          onChange={(v) => {
                            if (v) void handleCurrencyChange(v)
                          }}
                          searchFn={async (q) => ({
                            items: await customerService.searchLink("Currency", q, "Sales Order"),
                          })}
                          validate={async (v) => {
                            await customerService.validateLink("Currency", v)
                          }}
                          docType="Currency"
                          placeholder="Select currency…"
                          clearIconMode="hover"
                          disabled={rule("currency").readOnly}
                        />
                      </div>
                      {showConversionRate && (
                        <div>
                          <label className={labelClass}>Exchange Rate *</label>
                          <input
                            type="number"
                            min={0}
                            step={0.00000001}
                            value={form.conversion_rate ?? 1}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 1
                              update({ conversion_rate: v })
                              runApplyPriceList({ ...formRef.current, conversion_rate: v })
                            }}
                            readOnly={rule("conversion_rate").readOnly}
                            className={inputClass}
                          />
                          <p className="text-xs text-muted mt-1">
                            1 {effectiveCurrency} = {form.conversion_rate ?? 1} {companyCurrency}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Price List *</label>
                        <Combobox
                          name="selling_price_list"
                          value={form.selling_price_list || defaultPriceList}
                          options={priceLists}
                          onChange={(_name, val) => { update({ selling_price_list: val }); runApplyPriceList({ ...formRef.current, selling_price_list: val }) }}
                          disabled={rule("selling_price_list").readOnly}
                        />
                      </div>
                      {showPlcRate && (
                        <>
                          <div>
                            <label className={labelClass}>Price List Currency</label>
                            <input
                              type="text"
                              value={effectivePlcCurrency}
                              readOnly
                              className={`${inputClass} bg-gray-50`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Price List Exchange Rate *</label>
                            <input
                              type="number"
                              min={0}
                              step={0.00000001}
                              value={form.plc_conversion_rate ?? 1}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value) || 1
                                update({ plc_conversion_rate: v })
                                runApplyPriceList(
                                  { ...formRef.current, plc_conversion_rate: v },
                                  null,
                                  true,
                                )
                              }}
                              readOnly={rule("plc_conversion_rate").readOnly}
                              className={inputClass}
                            />
                            <p className="text-xs text-muted mt-1">
                              1 {effectivePlcCurrency} = {form.plc_conversion_rate ?? 1}{" "}
                              {companyCurrency}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ignorePricingRule"
                          checked={!!form.ignore_pricing_rule}
                          onChange={(e) => update({ ignore_pricing_rule: e.target.checked ? 1 : 0 })}
                          disabled={!isFieldEditable("ignore_pricing_rule")}
                          className="h-4 w-4 rounded border-border"
                        />
                        <label htmlFor="ignorePricingRule" className="text-sm text-body">
                          Ignore Pricing Rule
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </CollapsibleSection>

            {/* ===== Items ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-base font-bold text-heading">Items</h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isFieldEditable("scan_barcode") || !!form.scan_barcode ? (
                  <div>
                    <label className={labelClass}>Scan Barcode</label>
                    {isFieldEditable("scan_barcode") ? (
                      <div className="relative">
                        <ScanBarcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="text"
                          placeholder="Scan Barcode…"
                          className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              const val = (e.target as HTMLInputElement).value
                              ;(e.target as HTMLInputElement).value = ""
                              void handleScanBarcode(val)
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={form.scan_barcode}
                        readOnly
                        className={`${inputClass} bg-gray-50`}
                      />
                    )}
                  </div>
                ) : null}
                {rule("set_warehouse").visible && <div>
                  <label className={labelClass}>Set Warehouse</label>
                <LinkSearchField
                  value={form.set_warehouse ?? ""}
                  onChange={(v) => update({ set_warehouse: v ?? "" })}
                  searchFn={async (q) => {
                    const results = await customerService.searchLink("Warehouse", q, "Sales Order")
                    return { items: results }
                  }}
                  validate={async (v) => {
                    await customerService.validateLink("Warehouse", v)
                  }}
                  docType="Warehouse"
                  placeholder="Select warehouse…"
                  clearIconMode="hover"
                  disabled={!isFieldEditable("set_warehouse")}
                />
              </div>}
              <div className="flex items-end pb-2">
                {stockReservationEnabled && rule("reserve_stock").visible && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="reserveStock"
                      checked={!!form.reserve_stock}
                      onChange={(e) => update({ reserve_stock: e.target.checked ? 1 : 0 })}
                      disabled={!isFieldEditable("reserve_stock")}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="reserveStock" className="text-sm text-body">
                      Reserve Stock
                    </label>
                  </div>
                )}
              </div>
              </div>

              <ChildTableGrid<SalesOrderItemForm>
                title="Items"
                description={!isFieldEditable("items") ? undefined : "Click a row to edit its fields."}
                rows={form.items ?? []}
                columns={!isFieldEditable("items") ? readOnlyItemColumns : itemColumns}
                emptyRow={createEmptyItem()}
                onChange={handleItemsChange}
                readOnly={!isFieldEditable("items")}
                canAdd={mode === "create" || isFieldEditable("items")}
                minWidth="760px"
                noTopBorder
                testId="sales-order-items"
                footer={
                  isFieldEditable("items") ? (
                    <AddMultipleModal
                      items={lineItemsForModal}
                      itemDetailsContext={{ customer: form.customer || undefined }}
                      onAddItemWithQty={(product, qty) => void handleAddItemWithQty(product, qty)}
                      onBlocked={() => blockIfMissingParty()}
                    />
                  ) : undefined
                }
              />
              {/* Items footer: ERPNext-readable totals (3-column layout). */}
              {(() => {
                const currency = form.currency || companyCurrency
                const isMultiCurrency = currency !== companyCurrency
                const hasDiscount = !!(
                  form.discount_amount || form.additional_discount_percentage
                )
                const hasIncludedTax = (form.taxes ?? []).some(
                  (t) => t.included_in_print_rate === 1,
                )
                const showNetTotal = hasDiscount || hasIncludedTax
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-1">
                    {/* Col 1: Total Quantity, Total Net Weight */}
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Total Quantity</label>
                        <input
                          type="text"
                          value={total_qty}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                      {total_net_weight > 0 && (
                        <div>
                          <label className={labelClass}>Total Net Weight</label>
                          <input
                            type="text"
                            value={total_net_weight}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                    {/* Col 2: company-currency totals */}
                    <div className="space-y-3">
                      {isMultiCurrency && (
                        <>
                          <div>
                            <label className={labelClass}>Total ({companyCurrency})</label>
                            <input
                              type="text"
                              value={formatCurrency(base_total)}
                              className={`${inputClass} bg-gray-50`}
                              readOnly
                            />
                          </div>
                          {showNetTotal && (
                            <div>
                              <label className={labelClass}>
                                Net Total ({companyCurrency})
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(base_net_total)}
                                className={`${inputClass} bg-gray-50`}
                                readOnly
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Col 3: transaction-currency totals */}
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Total ({currency})</label>
                        <input
                          type="text"
                          value={formatCurrency(subtotal)}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                      {showNetTotal && (
                        <div>
                          <label className={labelClass}>Net Total ({currency})</label>
                          <input
                            type="text"
                            value={formatCurrency(net_total)}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ===== Taxes and Charges ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-base font-bold text-heading">Taxes and Charges</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Tax Category" fieldname="tax_category">
                  <LinkSearchField
                    value={form.tax_category ?? ""}
                    onChange={(v) => update({ tax_category: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Tax Category", q, "Sales Order", { disabled: 0 })
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Tax Category", v)
                    }}
                    docType="Tax Category"
                    placeholder="Select tax category…"
                    clearIconMode="hover"
                    disabled={!isFieldEditable("tax_category")}
                  />
                </Field>
                <Field label="Shipping Rule" fieldname="shipping_rule">
                  <LinkSearchField
                    value={form.shipping_rule ?? ""}
                    onChange={(v) => update({ shipping_rule: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Shipping Rule", q, "Sales Order", { disabled: 0 })
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Shipping Rule", v)
                    }}
                    docType="Shipping Rule"
                    placeholder="Select shipping rule…"
                    clearIconMode="hover"
                    disabled={!isFieldEditable("shipping_rule")}
                  />
                </Field>
                <Field label="Incoterm" fieldname="incoterm">
                  <LinkSearchField
                    value={form.incoterm ?? ""}
                    onChange={(v) => update({ incoterm: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Incoterm", q, "Sales Order")
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Incoterm", v)
                    }}
                    docType="Incoterm"
                    placeholder="Select incoterm…"
                    clearIconMode="hover"
                    fetchLabelOnMount
                    disabled={!isFieldEditable("incoterm")}
                  />
                </Field>
              </div>
              <div className="max-w-sm">
                <Field label="Named Place" fieldname="named_place">
                  <Input
                    value={form.named_place ?? ""}
                    onChange={(e) => update({ named_place: e.target.value })}
                    className={inputClass}
                    readOnly={!isFieldEditable("named_place")}
                  />
                </Field>
              </div>
              <div className="max-w-sm">
                <label className={labelClass}>Sales Taxes and Charges Template</label>
                <LinkSearchField
                  value={form.taxes_and_charges ?? ""}
                  onChange={(v) => void handleTaxesAndChargesSelect(v ?? "")}
                  searchFn={async (q) => {
                    const results = await customerService.searchLink(
                      "Sales Taxes and Charges Template",
                      q,
                      "Sales Order",
                      { disabled: 0 },
                    )
                    return { items: results }
                  }}
                  docType="Sales Taxes and Charges Template"
                  placeholder="Select template…"
                  validate={async (v) => {
                    await customerService.validateLink("Sales Taxes and Charges Template", v)
                  }}
                  clearIconMode="hover"
                  disabled={!isFieldEditable("taxes_and_charges")}
                />
              </div>
              <SalesTaxesChargesTable
                rows={taxState.computed}
                currency={currencyLabel}
                company={form.company || defaultCompany}
                onChange={handleTaxChange}
                readOnly={!isFieldEditable("taxes")}
                noTopBorder
              />
              {taxState.total_taxes != null && (
                <div className="mt-3">
                  <div className="sm:w-1/2 ml-auto">
                    <label className={labelClass}>Total Taxes and Charges</label>
                    <input
                      type="text"
                      value={formatCurrency(taxState.total_taxes)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ===== Totals ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-base font-bold text-heading">Totals</h3>
              {(() => {
                const showRounding = !form.disable_rounded_total
                const soCurrency = form.currency || companyCurrency
                const inWordsDisplay =
                  form.in_words || moneyInWords(rounded_total, soCurrency)
                const baseInWordsDisplay =
                  form.base_in_words || moneyInWords(base_rounded_total, companyCurrency)
                // ERPNext parity: in_words has no depends_on — visibility is driven by the
                // stored value on submitted/cancelled docs and by the computed words on drafts.
                const showInWords =
                  docstatus > 0 ? !!form.in_words?.trim() : inWordsDisplay.trim().length > 0
                const showBaseInWords =
                  docstatus > 0 ? !!form.base_in_words?.trim() : baseInWordsDisplay.trim().length > 0
                return (
                  <div className="mt-3 lg:w-1/2 lg:ml-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {soCurrency !== companyCurrency && (
                        <div className="space-y-3">
                          <div>
                            <label className={labelClass}>Grand Total ({companyCurrency})</label>
                            <input
                              type="text"
                              value={formatCurrency(base_grand_total)}
                              className={`${inputClass} bg-gray-50`}
                              readOnly
                            />
                          </div>
                          {showRounding && (
                            <div>
                              <label className={labelClass}>
                                Rounding Adjustment ({companyCurrency})
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(base_rounding_adjustment)}
                                className={`${inputClass} bg-gray-50`}
                                readOnly
                              />
                            </div>
                          )}
                          {showRounding && (
                            <div>
                              <label className={labelClass}>
                                Rounded Total ({companyCurrency})
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(base_rounded_total)}
                                className={`${inputClass} bg-gray-50`}
                                readOnly
                              />
                            </div>
                          )}
                          {showBaseInWords && (
                            <div>
                              <label className={labelClass}>In Words ({companyCurrency})</label>
                              <textarea
                                value={baseInWordsDisplay}
                                rows={2}
                                readOnly
                                className={`${inputClass} bg-gray-50 font-bold resize-none`}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      <div
                        className={
                          soCurrency === companyCurrency
                            ? "space-y-3 lg:col-span-2"
                            : "space-y-3"
                        }
                      >
                        <div>
                          <label className={labelClass}>Grand Total ({soCurrency})</label>
                          <input
                            type="text"
                            value={formatCurrency(taxState.grand_total)}
                            className={`${inputClass} bg-gray-50 font-bold`}
                            readOnly
                          />
                        </div>
                        {showRounding && (
                          <div>
                            <label className={labelClass}>
                              Rounding Adjustment ({soCurrency})
                            </label>
                            <input
                              type="text"
                              value={formatCurrency(rounding_adjustment)}
                              className={`${inputClass} bg-gray-50`}
                              readOnly
                            />
                          </div>
                        )}
                        {showRounding && (
                          <div>
                            <label className={labelClass}>Rounded Total ({soCurrency})</label>
                            <input
                              type="text"
                              value={formatCurrency(rounded_total)}
                              className={`${inputClass} bg-gray-50 font-bold`}
                              readOnly
                            />
                          </div>
                        )}
                        {showInWords && (
                          <div>
                            <label className={labelClass}>In Words ({soCurrency})</label>
                            <textarea
                              value={inWordsDisplay}
                              rows={2}
                              readOnly
                              className={`${inputClass} bg-gray-50 font-bold resize-none`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {rule("advance_paid").visible && (
                      <div className="mt-3">
                        <label className={labelClass}>Advance Paid ({soCurrency})</label>
                        <input
                          type="text"
                          value={formatCurrency(Number(form.advance_paid ?? 0) || 0, soCurrency)}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                    )}
                    {rule("disable_rounded_total").visible && (
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="disableRoundedTotal"
                          checked={!!form.disable_rounded_total}
                          onChange={(e) =>
                            update({ disable_rounded_total: e.target.checked ? 1 : 0 })
                          }
                          disabled={!isFieldEditable("disable_rounded_total")}
                          className="h-4 w-4 rounded border-border"
                        />
                        <label htmlFor="disableRoundedTotal" className="text-sm text-body">
                          Disable Rounded Total
                        </label>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* ===== Additional Discount ===== */}
            <CollapsibleSection title="Additional Discount">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Field label="Apply Additional Discount On" fieldname="apply_discount_on">
                    <select
                      value={apply_discount_on}
                      onChange={(e) =>
                        handleApplyDiscountOnChange(
                          (e.target.value || "Grand Total") as "Grand Total" | "Net Total",
                        )
                      }
                      disabled={!isFieldEditable("apply_discount_on")}
                      className={inputClass}
                    >
                      <option value="Grand Total">Grand Total</option>
                      <option value="Net Total">Net Total</option>
                    </select>
                  </Field>
                  <Field label="Coupon Code" fieldname="coupon_code">
                    <LinkSearchField
                      value={form.coupon_code ?? ""}
                      onChange={(v) => update({ coupon_code: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Coupon Code", q, "Sales Order")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Coupon Code", v)
                      }}
                      docType="Coupon Code"
                      placeholder="Select coupon…"
                      clearIconMode="hover"
                      disabled={!isFieldEditable("coupon_code")}
                    />
                  </Field>
                </div>
                <div className="space-y-3">
                  <Field label="Additional Discount Percentage" fieldname="additional_discount_percentage">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      value={form.additional_discount_percentage ?? ""}
                      onChange={(e) =>
                        handleAdditionalDiscountPercentageChange(
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      readOnly={!isFieldEditable("additional_discount_percentage")}
                    />
                  </Field>
                  <Field
                    label={`Additional Discount Amount (${form.currency || companyCurrency})`}
                    fieldname="discount_amount"
                  >
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.discount_amount ?? ""}
                      onChange={(e) =>
                        handleAdditionalDiscountAmountChange(
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      readOnly={
                        !isFieldEditable("discount_amount") || rule("discount_amount").readOnly
                      }
                    />
                  </Field>
                </div>
              </div>
              {(form.pricing_rules ?? []).length > 0 && (
                <div className="pt-3">
                  <ChildTableGrid<SalesOrderPricingRuleRow>
                    title="Pricing Rules"
                    rows={form.pricing_rules ?? []}
                    columns={pricingRuleColumns}
                    emptyRow={{ pricing_rule: "", rule_applied: 0 }}
                    onChange={() => undefined}
                    readOnly
                    minWidth="420px"
                  />
                </div>
              )}
            </CollapsibleSection>
            {/* ===== Tax Breakup — after Additional Discount (ERPNext field order) ===== */}
            {mode !== "create" && (
              <ItemisedTaxBreakup
                rows={breakupRows}
                storedHtml={form.other_charges_calculation}
              />
            )}
          </div>
        )}

        {activeTab === "address" && (
          <div className="space-y-4">
            {/* Billing Address */}
            {(rule("customer_address").visible ||
              rule("address_display").visible ||
              rule("territory").visible ||
              rule("contact_person").visible ||
              rule("contact_display").visible ||
              rule("contact_phone").visible ||
              rule("contact_mobile").visible) && (
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Billing Address</div>
                <div className="pb-4 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {rule("customer_address").visible && (
                        <div>
                          <label className={labelClass}>Customer Address</label>
                          <LinkSearchField
                            value={form.customer_address ?? ""}
                            onChange={(v) => void handleAddressSelect("customer_address", "address_display")(v)}
                            searchFn={async (q) => {
                              if (!form.customer) return { items: [] }
                              const results = await salesOrderService.searchAddressesDesk(
                                q,
                                "Customer",
                                form.customer,
                              )
                              return { items: results }
                            }}
                            placeholder="Select address…"
                            suppressExternalLabelFetch
                            clearIconMode="hover"
                            disabled={!isFieldEditable("customer_address")}
                          />
                        </div>
                      )}
                      {rule("address_display").visible && form.address_display && (
                        <div>
                          <label className={labelClass}>Address</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                            {normalizeDisplayText(form.address_display)}
                          </div>
                        </div>
                      )}
                      {rule("territory").visible && (
                        <Field label="Territory" fieldname="territory">
                          <LinkSearchField
                            value={form.territory ?? ""}
                            onChange={(v) => update({ territory: v ?? "" })}
                            searchFn={async (q) => {
                              const results = await customerService.searchLink("Territory", q, "Sales Order")
                              return { items: results }
                            }}
                            validate={async (v) => {
                              await customerService.validateLink("Territory", v)
                            }}
                            docType="Territory"
                            placeholder="Select territory…"
                            clearIconMode="hover"
                            disabled={!isFieldEditable("territory")}
                          />
                        </Field>
                      )}
                    </div>
                    <div className="space-y-3">
                      {rule("contact_person").visible && (
                        <div>
                          <label className={labelClass}>Contact Person</label>
                          <LinkSearchField
                            value={form.contact_person ?? ""}
                            onChange={(v) => void handleContactSelect(v ?? "")}
                            searchFn={async (q) => {
                              if (!form.customer) return { items: [] }
                              const results = await salesOrderService.searchContactsDesk(
                                q,
                                "Customer",
                                form.customer,
                              )
                              return { items: results }
                            }}
                            placeholder="Select contact…"
                            suppressExternalLabelFetch
                            displayLabel={form.contact_display}
                            clearIconMode="hover"
                            disabled={!isFieldEditable("contact_person")}
                          />
                        </div>
                      )}
                      {rule("contact_display").visible && form.contact_display && (
                        <div>
                          <label className={labelClass}>Contact</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line py-2.5`}>
                            {normalizeDisplayText(form.contact_display)}
                          </div>
                        </div>
                      )}
                      {rule("contact_phone").visible && form.contact_phone && (
                        <div>
                          <label className={labelClass}>Phone</label>
                          <input
                            type="text"
                            value={form.contact_phone}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                      {rule("contact_mobile").visible && form.contact_mobile && (
                        <div>
                          <label className={labelClass}>Mobile No</label>
                          <input
                            type="text"
                            value={form.contact_mobile ?? ""}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Shipping Address */}
            {(rule("shipping_address_name").visible ||
              rule("shipping_address").visible ||
              rule("shipping_contact_person").visible ||
              rule("shipping_contact_display").visible ||
              rule("shipping_contact_mobile").visible ||
              rule("dispatch_address_name").visible ||
              rule("dispatch_address").visible) && (
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Shipping Address</div>
                <div className="pb-4 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {rule("shipping_address_name").visible && (
                        <div>
                          <label className={labelClass}>Shipping Address Name</label>
                          <LinkSearchField
                            value={form.shipping_address_name ?? ""}
                            onChange={(v) => void handleAddressSelect("shipping_address_name", "shipping_address")(v)}
                            searchFn={async (q) => {
                              if (!form.customer) return { items: [] }
                              const results = await salesOrderService.searchAddressesDesk(
                                q,
                                "Customer",
                                form.customer,
                              )
                              return { items: results }
                            }}
                            placeholder="Select address…"
                            suppressExternalLabelFetch
                            clearIconMode="hover"
                            disabled={!isFieldEditable("shipping_address_name")}
                          />
                        </div>
                      )}
                      {rule("shipping_address").visible && form.shipping_address && (
                        <div>
                          <label className={labelClass}>Shipping Address</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                            {normalizeDisplayText(form.shipping_address)}
                          </div>
                        </div>
                      )}
                      {rule("shipping_contact_person").visible && (
                        <div>
                          <label className={labelClass}>Shipping Contact Person</label>
                          <LinkSearchField
                            value={form.shipping_contact_person ?? ""}
                            onChange={(v) => void handleShippingContactSelect(v ?? "")}
                            searchFn={async (q) => {
                              if (!form.customer) return { items: [] }
                              const results = await salesOrderService.searchContactsDesk(
                                q,
                                "Customer",
                                form.customer,
                              )
                              return { items: results }
                            }}
                            placeholder="Select contact…"
                            suppressExternalLabelFetch
                            displayLabel={form.shipping_contact_display}
                            clearIconMode="hover"
                            disabled={!isFieldEditable("shipping_contact_person")}
                          />
                        </div>
                      )}
                      {rule("shipping_contact_display").visible && form.shipping_contact_display && (
                        <div>
                          <label className={labelClass}>Shipping Contact</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line py-2.5`}>
                            {normalizeDisplayText(form.shipping_contact_display)}
                          </div>
                        </div>
                      )}
                      {rule("shipping_contact_mobile").visible && form.shipping_contact_mobile && (
                        <div>
                          <label className={labelClass}>Shipping Contact Mobile No</label>
                          <input
                            type="text"
                            value={form.shipping_contact_mobile}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {rule("dispatch_address_name").visible && (
                        <div>
                          <label className={labelClass}>Dispatch Address Name</label>
                          <LinkSearchField
                            value={form.dispatch_address_name ?? ""}
                            onChange={(v) => void handleAddressSelect("dispatch_address_name", "dispatch_address")(v)}
                            searchFn={async (q) => {
                              // Byte-parity with queries.js dispatch_address_query:
                              // Company-linked addresses, unfiltered for drop-ship.
                              const isDropShip =
                                (form.items ?? []).some((i) => i.delivered_by_supplier)
                              if (!isDropShip && !form.company) return { items: [] }
                              const results = await salesOrderService.searchAddressesDesk(
                                q,
                                isDropShip ? undefined : "Company",
                                isDropShip ? undefined : form.company || undefined,
                              )
                              return { items: results }
                            }}
                            placeholder="Select address…"
                            suppressExternalLabelFetch
                            clearIconMode="hover"
                            disabled={!isFieldEditable("dispatch_address_name")}
                          />
                        </div>
                      )}
                      {rule("dispatch_address").visible && form.dispatch_address && (
                        <div>
                          <label className={labelClass}>Dispatch Address</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                            {normalizeDisplayText(form.dispatch_address)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Company Address */}
            {(rule("company_address").visible ||
              rule("company_address_display").visible ||
              rule("company_contact_person").visible) && (
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Company Address</div>
                <div className="pb-4 space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      {rule("company_address").visible && (
                        <div>
                          <label className={labelClass}>Company Address Name</label>
                          <LinkSearchField
                            value={form.company_address ?? ""}
                            onChange={(v) => void handleAddressSelect("company_address", "company_address_display")(v)}
                            searchFn={async (q) => {
                              // Byte-parity with queries.js company_address_query:
                              // Company-linked addresses, unfiltered for drop-ship.
                              const isDropShip =
                                (form.items ?? []).some((i) => i.delivered_by_supplier)
                              if (!isDropShip && !form.company) return { items: [] }
                              const results = await salesOrderService.searchAddressesDesk(
                                q,
                                isDropShip ? undefined : "Company",
                                isDropShip ? undefined : form.company || undefined,
                              )
                              return { items: results }
                            }}
                            placeholder="Select address…"
                            suppressExternalLabelFetch
                            clearIconMode="hover"
                            disabled={!isFieldEditable("company_address")}
                          />
                        </div>
                      )}
                      {rule("company_address_display").visible && form.company_address_display && (
                        <div>
                          <label className={labelClass}>Company Address</label>
                          <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                            {normalizeDisplayText(form.company_address_display)}
                          </div>
                        </div>
                      )}
                    </div>
                    {rule("company_contact_person").visible && (
                      <div>
                        <label className={labelClass}>Company Contact Person</label>
                        <LinkSearchField
                          value={form.company_contact_person ?? ""}
                          onChange={(v) => update({ company_contact_person: v ?? "" })}
                          searchFn={async (q) => {
                            if (!form.company) return { items: [] }
                            const results = await salesOrderService.searchContactsDesk(
                              q,
                              "Company",
                              form.company,
                            )
                            return { items: results }
                          }}
                          placeholder="Select contact…"
                          validate={async (v) => {
                            await customerService.validateLink("Contact", v)
                          }}
                          suppressExternalLabelFetch
                          clearIconMode="hover"
                          disabled={!isFieldEditable("company_contact_person")}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "terms" && (
          <div className="space-y-4">
            {(rule("payment_terms_template").visible || (form.payment_schedule?.length ?? 0) > 0) && (
              <div className="pb-4 border-b border-border space-y-3">
                <h3 className="text-base font-bold text-heading">Payment Terms</h3>
                {rule("payment_terms_template").visible && (
                  <div className="max-w-sm">
                    <label className={labelClass}>Payment Terms Template</label>
                    <LinkSearchField
                      value={form.payment_terms_template ?? ""}
                      onChange={(v) => void handlePaymentTermsSelect(v ?? "")}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink(
                          "Payment Terms Template",
                          q,
                          "Sales Order",
                        )
                        return { items: results }
                      }}
                      docType="Payment Terms Template"
                      placeholder="Select template…"
                      validate={async (v) => {
                        await customerService.validateLink("Payment Terms Template", v)
                      }}
                      clearIconMode="hover"
                      disabled={!isFieldEditable("payment_terms_template")}
                    />
                  </div>
                )}
                <ChildTableGrid<SalesOrderPaymentScheduleRow>
                  title="Payment Schedule"
                  titleClassName="text-xs font-semibold text-muted"
                  noTopBorder
                  rows={form.payment_schedule ?? []}
                  columns={paymentScheduleColumns}
                  emptyRow={{ payment_term: "", description: "", due_date: "", invoice_portion: 0, payment_amount: 0 }}
                  onChange={(rows) => update({ payment_schedule: rows })}
                  readOnly={!isFieldEditable("payment_schedule")}
                  minWidth="720px"
                />
              </div>
            )}

            {(rule("tc_name").visible || rule("terms").visible) && (
              <div className="pb-4 border-b border-border space-y-3">
                <h3 className="text-base font-bold text-heading">Terms and Conditions</h3>
                {rule("tc_name").visible && (
                  <div className="max-w-sm">
                    <label className={labelClass}>Terms</label>
                    <LinkSearchField
                      value={form.tc_name ?? ""}
                      onChange={(v) => void handleTermsSelect(v ?? "")}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink(
                          "Terms and Conditions",
                          q,
                          "Sales Order",
                          { disabled: 0 },
                        )
                        return { items: results }
                      }}
                      docType="Terms and Conditions"
                      placeholder="Select terms…"
                      validate={async (v) => {
                        await customerService.validateLink("Terms and Conditions", v)
                      }}
                      clearIconMode="hover"
                      disabled={!isFieldEditable("tc_name")}
                    />
                  </div>
                )}
                {rule("terms").visible && (
                  <div>
                    <label className={labelClass}>Terms and Conditions Details</label>
                    <textarea
                      rows={4}
                      value={form.terms ?? ""}
                      onChange={(e) => update({ terms: e.target.value })}
                      readOnly={!isFieldEditable("terms")}
                      className={inputClass}
                      placeholder="Enter terms, conditions, or other notes…"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "more_info" && (
          <div className="space-y-4">
            {/* ── Status (ERPNext: status, per_delivered, per_billed, per_picked) ── */}
            <CollapsibleSection title="Status">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Status</label>
                  <input
                    type="text"
                    value={form.status ?? "Draft"}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                {rule("per_delivered").visible && (
                  <div>
                    <label className={labelClass}>% Delivered</label>
                    <input
                      type="text"
                      value={form.per_delivered ?? 0}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                {rule("per_billed").visible && (
                  <div>
                    <label className={labelClass}>% Amount Billed</label>
                    <input
                      type="text"
                      value={form.per_billed ?? 0}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                {rule("per_picked").visible && (
                  <div>
                    <label className={labelClass}>% Picked</label>
                    <input
                      type="text"
                      value={form.per_picked ?? 0}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* ── Commission (ERPNext: sales_partner [left col], amount_eligible_for_commission, commission_rate, total_commission [right col]) ── */}
            <CollapsibleSection title="Commission">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rule("sales_partner").visible && (
                  <div>
                    <Field label="Sales Partner" fieldname="sales_partner">
                      <LinkSearchField
                        value={form.sales_partner ?? ""}
                        onChange={handleSalesPartnerChange}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink("Sales Partner", q, "Sales Order")
                          return { items: results }
                        }}
                        validate={async (v) => {
                          await customerService.validateLink("Sales Partner", v)
                        }}
                        docType="Sales Partner"
                        placeholder="Select sales partner…"
                        clearIconMode="hover"
                        disabled={!isFieldEditable("sales_partner")}
                      />
                    </Field>
                  </div>
                )}
                <div className="space-y-4 sm:col-start-2">
                  {rule("amount_eligible_for_commission").visible && (
                    <Field label="Amount Eligible for Commission" fieldname="amount_eligible_for_commission">
                      <input
                        type="text"
                        value={formatCurrency(amountEligibleForCommission, companyCurrency)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </Field>
                  )}
                  {rule("commission_rate").visible && (
                    <Field label="Commission Rate" fieldname="commission_rate">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={form.commission_rate ?? ""}
                        onChange={(e) =>
                          handleCommissionRateChange(e.target.value ? Number(e.target.value) : 0)
                        }
                        readOnly={!isFieldEditable("commission_rate")}
                      />
                    </Field>
                  )}
                  {rule("total_commission").visible && (
                    <Field label="Total Commission" fieldname="total_commission">
                      <input
                        type="text"
                        value={formatCurrency(totalCommission, companyCurrency)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </Field>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            {/* ── Sales Team (ERPNext: sales_team child table) ── */}
            <CollapsibleSection title="Sales Team">
              <ChildTableGrid<SalesOrderSalesTeamRow>
                title="Sales Team"
                noTopBorder
                rows={form.sales_team ?? []}
                columns={salesTeamColumns}
                emptyRow={{ sales_person: "", allocated_percentage: 0, allocated_amount: 0, commission_rate: 0, incentives: 0 }}
                onChange={(rows) => {
                  const prevRows = form.sales_team ?? []
                  update({ sales_team: recomputeSalesTeamRows(rows, amountEligibleForCommission) })
                  // sales_team.json fetch_from parity: the row's commission_rate
                  // is fetched from sales_person.commission_rate (fetch_if_empty=1),
                  // so selecting a Sales Person copies that person's rate in, but
                  // only when the row is still empty — a rate already set (e.g. from
                  // a previous person) is never overwritten, exactly like ERPNext.
                  rows.forEach((row, i) => {
                    const before = prevRows[i]
                    if (!before || row.sales_person === before.sales_person) return
                    const person = row.sales_person
                    if (!person) return
                    void salesOrderService
                      .getFetchValues("Sales Team", "sales_person", person)
                      .then((fetchValues) => {
                        const fetched = Number(fetchValues?.commission_rate)
                        if (Number.isNaN(fetched)) return
                        const cur = formRef.current.sales_team?.[i]
                        if (!cur) return
                        if (cur.commission_rate && cur.commission_rate !== 0) return
                        update({
                          sales_team: recomputeSalesTeamRows(
                            (formRef.current.sales_team ?? []).map((r, j) =>
                              j === i ? { ...r, commission_rate: fetched } : r,
                            ),
                            amountEligibleForCommission,
                          ),
                        })
                      })
                  })
                }}
                readOnly={!isFieldEditable("sales_team")}
                minWidth="720px"
                canAdd={mode === "create" || isFieldEditable("sales_team")}
              />
            </CollapsibleSection>

            {/* ── Loyalty Points (hidden section in ERPNext) ── */}
            {(rule("loyalty_points").visible || rule("loyalty_amount").visible) && (
              <CollapsibleSection title="Loyalty Points">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Field label="Loyalty Points" fieldname="loyalty_points">
                    <input
                      type="text"
                      value={form.loyalty_points ?? 0}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </Field>
                  <Field label="Loyalty Amount" fieldname="loyalty_amount">
                    <input
                      type="text"
                      value={formatCurrency(form.loyalty_amount ?? 0, companyCurrency)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </Field>
                </div>
              </CollapsibleSection>
            )}

            {/* ── Auto Repeat (ERPNext: auto_repeat, from_date, to_date, update_auto_repeat_reference) ── */}
            {/* ── Auto Repeat Section (ERPNext: from_date, to_date | auto_repeat, update_auto_repeat_reference) ── */}
            <CollapsibleSection title="Auto Repeat">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Field label="From Date" fieldname="from_date">
                    <DateInput
                      value={form.from_date ?? ""}
                      onChange={(e) => update({ from_date: e.target.value })}
                      readOnly={!isFieldEditable("from_date")}
                    />
                  </Field>
                  <Field label="To Date" fieldname="to_date">
                    <DateInput
                      value={form.to_date ?? ""}
                      onChange={(e) => update({ to_date: e.target.value })}
                      readOnly={!isFieldEditable("to_date")}
                    />
                  </Field>
                </div>
                <div className="space-y-4">
                  <Field label="Auto Repeat" fieldname="auto_repeat">
                    <LinkSearchField
                      value={form.auto_repeat ?? ""}
                      onChange={(v) => update({ auto_repeat: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Auto Repeat", q, "Sales Order")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Auto Repeat", v)
                      }}
                      docType="Auto Repeat"
                      placeholder="Select auto repeat…"
                      clearIconMode="hover"
                      disabled={!isFieldEditable("auto_repeat")}
                    />
                  </Field>
                  {form.auto_repeat && (
                    <Field label="Update Auto Repeat Reference" fieldname="update_auto_repeat_reference">
                      <button
                        type="button"
                        onClick={handleUpdateAutoRepeatReference}
                        disabled={!isFieldEditable("update_auto_repeat_reference")}
                        className={`${inputClass} bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        Update Auto Repeat Reference
                      </button>
                    </Field>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            {/* ── Print Settings (ERPNext column order: letter_head, group_same_items | select_print_heading, language) ── */}
            <CollapsibleSection title="Print Settings">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Letter Head</label>
                    <LinkSearchField
                      value={form.letter_head ?? ""}
                      onChange={(v) => update({ letter_head: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Letter Head", q, "Sales Order")
                        return { items: results }
                      }}
                      docType="Letter Head"
                      placeholder="Select letter head…"
                      validate={async (v) => {
                        await customerService.validateLink("Letter Head", v)
                      }}
                      clearIconMode="hover"
                      disabled={!isFieldEditable("letter_head")}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="groupSameItems"
                      checked={!!form.group_same_items}
                      onChange={(e) => update({ group_same_items: e.target.checked ? 1 : 0 })}
                      disabled={!isFieldEditable("group_same_items")}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="groupSameItems" className="text-sm text-body">
                      Group Same Items
                    </label>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Print Heading</label>
                    <LinkSearchField
                      value={form.select_print_heading ?? ""}
                      onChange={(v) => update({ select_print_heading: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Print Heading", q, "Sales Order")
                        return { items: results }
                      }}
                      docType="Print Heading"
                      placeholder="Select print heading…"
                      validate={async (v) => {
                        await customerService.validateLink("Print Heading", v)
                      }}
                      clearIconMode="hover"
                      disabled={!isFieldEditable("select_print_heading")}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Print Language</label>
                    <input
                      type="text"
                      value={form.language ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* ── Additional Info (new ERPNext layout: is_internal_customer | source, campaign) ── */}
            <CollapsibleSection title="Additional Info">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isInternalCustomer"
                      checked={!!form.is_internal_customer}
                      onChange={(e) => update({ is_internal_customer: e.target.checked ? 1 : 0 })}
                      disabled={!isFieldEditable("is_internal_customer") || rule("is_internal_customer").readOnly}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="isInternalCustomer" className="text-sm text-body">
                      Is Internal Customer
                    </label>
                  </div>
                  {form.represents_company && (
                    <div>
                      <label className={labelClass}>Represents Company</label>
                      <input
                        type="text"
                        value={form.represents_company}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <Field label="Source" fieldname="source">
                    <LinkSearchField
                      value={form.source ?? ""}
                      onChange={(v) => update({ source: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Lead Source", q, "Sales Order")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Lead Source", v)
                      }}
                      docType="Lead Source"
                      placeholder="Select source…"
                      clearIconMode="hover"
                      disabled={!isFieldEditable("source")}
                    />
                  </Field>
                  {form.inter_company_order_reference && (
                    <div>
                      <label className={labelClass}>Inter Company Order Reference</label>
                      <input
                        type="text"
                        value={form.inter_company_order_reference}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  )}
                  <Field label="Campaign" fieldname="campaign">
                    <LinkSearchField
                      value={form.campaign ?? ""}
                      onChange={(v) => update({ campaign: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Campaign", q, "Sales Order")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Campaign", v)
                      }}
                      docType="Campaign"
                      placeholder="Select campaign…"
                      clearIconMode="hover"
                      disabled={!isFieldEditable("campaign")}
                    />
                  </Field>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    )
  },
)
