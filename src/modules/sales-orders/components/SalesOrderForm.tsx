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
import { CollapsibleSection, Input, LinkSearchField, useToast } from "@/components/ui"
import { Combobox, inputClass, labelClass } from "@/components/ui/form-fields"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { useCompany } from "@/context/CompanyContext"
import { useLazyOptions } from "@/services/lookup-cache"
import {
  salesOrderService,
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

type SalesOrderFormTab = "details" | "address" | "terms" | "more_info"

export interface SalesOrderFormHandle {
  save: (action?: "Save" | "Update" | "Submit") => Promise<string | undefined>
  isDirty: () => boolean
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
    const { companyDefaults } = useCompany()
    const { addToast } = useToast()

    const companyCurrency = companyDefaults?.currency || "CAD"
    const defaultCompany = companyDefaults?.company || ""
    const defaultPriceList = companyDefaults?.defaultSellingPriceList || "Standard Selling"

    const buildEmptyForm = (): SalesOrderFormData => ({
      doctype: "Sales Order",
      naming_series: "SO-",
      customer: "",
      order_type: "Sales",
      transaction_date: todayISO(),
      delivery_date: addDaysISO(7),
      company: defaultCompany,
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
    const baselineRef = useRef<SalesOrderFormData>(baseline)
    const [activeTab, setActiveTab] = useState<SalesOrderFormTab>("details")

    const currencies = useLazyOptions<string[]>(
      "sales-order:currencies",
      salesOrderService.lookups.currencies,
      [],
    )
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
        if (!enabled) {
          setForm((prev) => ({
            ...prev,
            reserve_stock: 0,
            items: (prev.items ?? []).map((r) => ({ ...r, reserve_stock: 0 })),
          }))
        }
      })
    }, [])

    const formRef = useRef(form)
    useEffect(() => {
      formRef.current = form
    }, [form])

    // Accounting dimensions → item cost_center once per mount (desk
    // setup_accounting_dimension_triggers parity).
    useEffect(() => {
      quotationService.getAccountingDimensions().then((dims) => {
        const company = formRef.current.company || defaultCompany
        const companyDims = dims.defaultDimensionsMap?.[company]
        if (!companyDims?.cost_center) return
        setForm((prev) => {
          const items = prev.items ?? []
          let changed = false
          const next = items.map((it) => {
            if (!it.cost_center) {
              changed = true
              return { ...it, cost_center: companyDims.cost_center }
            }
            return it
          })
          return changed ? { ...prev, items: next } : prev
        })
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const isDirty = () => JSON.stringify(form) !== JSON.stringify(baselineRef.current)
    useEffect(() => {
      onDirtyChange?.(isDirty())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form])

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
          "conversion_rate", "selling_price_list", "price_list_currency",
          "plc_conversion_rate", "company_address", "company_address_display",
          "company_contact_person",
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
      if (formRef.current.customer !== party) return // stale response guard
      update(patch)
    }

    // ── Currency change → get_exchange_rate ──────────────────────────
    const handleCurrencyChange = async (currency: string) => {
      update({ currency })
      if (currency === companyCurrency) {
        update({ conversion_rate: 1, price_list_currency: companyCurrency, plc_conversion_rate: 1 })
        return
      }
      try {
        const rate = await salesOrderService.getExchangeRate(
          currency,
          companyCurrency,
          form.transaction_date || todayISO(),
        )
        setForm((prev) => ({
          ...prev,
          currency,
          conversion_rate: rate || prev.conversion_rate || 1,
          price_list_currency: currency,
          plc_conversion_rate: rate || prev.plc_conversion_rate || 1,
        }))
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
        update({ contact_display: "", contact_mobile: "", contact_email: "" })
        return
      }
      customerService.validateLink("Contact", v).then(() => {
        quotationService.getContactDetails(v).then((details) => {
          update({
            contact_display: details.contact_display ?? "",
            contact_mobile: details.contact_mobile ?? "",
            contact_email: details.contact_email ?? "",
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

    const handleTaxChange = (rows: EditableTaxRow[]) => {
      update({ taxes: editableToSalesOrderTaxes(rows) })
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

    const handlePaymentTermsSelect = async (template: string) => {
      update({ payment_terms_template: template })
      if (!template) return
      try {
        const result = await salesOrderService.getPaymentTerms(
          template,
          {
            transaction_date: form.transaction_date || todayISO(),
            grand_total: taxState.grand_total,
            base_grand_total,
            company: form.company || defaultCompany,
            customer: form.customer || "",
            currency: form.currency || companyCurrency,
          },
        )
        if (result.length > 0) {
          update({
            payment_schedule: result as unknown as SalesOrderPaymentScheduleRow[],
          })
        }
      } catch {
        // payment terms fill is best-effort
      }
    }

    const currencyLabel = form.currency || companyCurrency

    const itemColumns: GridColumn<SalesOrderItemForm>[] = [
      {
        key: "item_code",
        label: "Item",
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
        weight: 2.2,
        indicator: (row) => {
          if (!row.item_code) return undefined
          if (!row.qty && form.has_unit_price_items) return "yellow"
          const stockAvail = (row.stock_qty ?? 0) - (row.delivered_qty ?? 0)
          return stockAvail <= (row.actual_qty ?? 0) ? "green" : "orange"
        },
      },
      { key: "qty", label: "Quantity", type: "number", align: "right", weight: 1 },
      {
        key: "warehouse",
        label: "Source Warehouse",
        type: "link",
        docType: "Warehouse",
        searchFn: async (q) => {
          const results = await salesOrderService.searchWarehouses(q, form.company).catch(() => [])
          return {
            items: results.map((r) => ({ value: r.value, label: r.label, description: r.description })),
          }
        },
        placeholder: "Source Warehouse…",
        weight: 2,
      },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        weight: 1.2,
        placeholder: "0",
        prefix: "$",
        formatter: (row) => formatCurrency(row.rate ?? 0, currencyLabel),
      },
      {
        key: "delivery_date",
        label: "Delivery Date",
        type: "date",
        weight: 1.4,
      },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        weight: 1.4,
        formatter: (row) => formatCurrency(row.amount ?? 0, currencyLabel),
      },
    ]

    const readOnlyItemColumns: GridColumn<SalesOrderItemForm>[] = [
      {
        key: "item_code",
        label: "Item",
        type: "link",
        weight: 2.2,
        indicator: (row) => {
          if (!row.item_code) return undefined
          if (!row.qty && form.has_unit_price_items) return "yellow"
          const stockAvail = (row.stock_qty ?? 0) - (row.delivered_qty ?? 0)
          return stockAvail <= (row.actual_qty ?? 0) ? "green" : "orange"
        },
      },
      {
        key: "qty",
        label: "Quantity",
        type: "number",
        align: "right",
        weight: 1,
        formatter: (row) => formatFixed(row.qty ?? 0, 3),
      },
      { key: "warehouse", label: "Source Warehouse", type: "readonly", weight: 2 },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        weight: 1.2,
        formatter: (row) => formatCurrency(row.rate ?? 0, currencyLabel),
      },
      { key: "delivery_date", label: "Delivery Date", type: "date", weight: 1.4 },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        weight: 1.4,
        formatter: (row) => formatCurrency(row.amount ?? 0, currencyLabel),
      },
    ]

    const paymentScheduleColumns: GridColumn<SalesOrderPaymentScheduleRow>[] = [
      { key: "payment_term", label: "Payment Term", type: "text", weight: 2 },
      { key: "description", label: "Description", type: "text", weight: 3 },
      { key: "due_date", label: "Due Date", type: "date" },
      { key: "invoice_portion", label: "Invoice Portion", type: "number", align: "right" },
      {
        key: "payment_amount",
        label: "Payment Amount",
        type: "number",
        align: "right",
      },
    ]

    const pricingRuleColumns: GridColumn<SalesOrderPricingRuleRow>[] = [
      { key: "pricing_rule", label: "Pricing Rule", type: "readonly", weight: 2 },
      {
        key: "rule_applied",
        label: "Applied",
        type: "readonly",
        weight: 1,
        formatter: (row) => (row.rule_applied ? "Yes" : "No"),
      },
    ]

    const salesTeamColumns: GridColumn<SalesOrderSalesTeamRow>[] = [
      { key: "sales_person", label: "Sales Person", type: "text", weight: 2 },
      { key: "allocated_percentage", label: "Contribution (%)", type: "number", align: "right" },
      { key: "allocated_amount", label: "Contribution Amount", type: "number", align: "right" },
      { key: "commission_rate", label: "Commission Rate (%)", type: "number", align: "right" },
      { key: "incentives", label: "Incentives", type: "number", align: "right" },
    ]

    const handleSave = async (action?: "Save" | "Update" | "Submit"): Promise<string | undefined> => {
      const doc: Record<string, unknown> = {
        ...form,
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
      }
      if (mode === "edit" && initialData?.name) {
        doc.name = initialData.name
      } else if (!doc.name) {
        doc.__islocal = 1
        doc.name = "new-sales-order"
      }
      const saved =
        action === "Submit"
          ? await salesOrderService.saveDoc(doc, "Submit")
          : mode === "edit" && (initialData?.docstatus ?? 0) === 1
            ? await salesOrderService.saveDoc(doc, "Update")
            : await salesOrderService.saveDoc(doc, "Save")
      baselineRef.current = { ...form, name: saved?.name }
      setBaseline(baselineRef.current)
      onSaved?.(saved)
      return saved?.name
    }

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty,
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
                    {form.naming_series || "SO-"}
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
                        value={form.naming_series ?? "SO-"}
                        onChange={(e) => update({ naming_series: e.target.value })}
                        className={inputClass}
                      >
                        <option value="SO-">SO-</option>
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
                  {form.customer && (
                    <div>
                      <label className={labelClass}>Customer Name</label>
                      <input
                        type="text"
                        value={form.customer_name || form.customer}
                        readOnly
                        className={`${inputClass} bg-gray-50 font-semibold break-all`}
                      />
                    </div>
                  )}
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
                </div>
                {/* Col 2 */}
                <div className="space-y-3">
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
                  <Field label="Transaction Date *" fieldname="transaction_date">
                    {headerLocked ? (
                      <input type="date" value={form.transaction_date} readOnly className={inputClass} />
                    ) : (
                      <Input
                        type="date"
                        value={form.transaction_date}
                        onChange={(e) => {
                          const transactionDate = e.target.value
                          const items = (formRef.current.items ?? []).map((row) => ({
                            ...row,
                            delivery_date: "",
                          }))
                          update({ transaction_date: transactionDate, delivery_date: "", items })
                        }}
                        readOnly={rule("transaction_date").readOnly}
                      />
                    )}
                  </Field>
                  <Field label="Delivery Date *" fieldname="delivery_date">
                    {headerLocked ? (
                      <input type="date" value={form.delivery_date ?? ""} readOnly className={inputClass} />
                    ) : (
                      <Input
                        type="date"
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
                        readOnly={rule("delivery_date").readOnly}
                      />
                    )}
                  </Field>
                </div>
                {/* Col 3 */}
                <div className="space-y-3">
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
                  <Field label="Customer's Purchase Order" fieldname="po_no">
                    <Input
                      value={form.po_no ?? ""}
                      onChange={(e) => update({ po_no: e.target.value || "" })}
                      placeholder="PO number…"
                      readOnly={!isFieldEditable("po_no")}
                    />
                  </Field>
                  <Field label="PO Date" fieldname="po_date">
                    <Input
                      type="date"
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
                        <Combobox
                          name="currency"
                          value={form.currency || companyCurrency}
                          options={currencies}
                          onChange={(_name, val) => void handleCurrencyChange(val)}
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
                          onChange={(_name, val) => update({ selling_price_list: val })}
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
                              }}
                              readOnly={rule("plc_conversion_rate").readOnly}
                              className={inputClass}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })()}
            </CollapsibleSection>

            {/* ===== Warehouse ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4 border-b border-border">
              <div>
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
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  {stockReservationEnabled && (
                    <input
                      type="checkbox"
                      id="reserveStock"
                      checked={!!form.reserve_stock}
                      onChange={(e) => update({ reserve_stock: e.target.checked ? 1 : 0 })}
                      disabled={!isFieldEditable("reserve_stock")}
                      className="h-4 w-4 rounded border-border"
                    />
                  )}
                  <label htmlFor="reserveStock" className="text-sm text-body">
                    Reserve Stock
                  </label>
                </div>
              </div>
            </div>

            {/* ===== Items ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
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
                          {rule("base_in_words").visible && (
                            <div>
                              <label className={labelClass}>In Words ({companyCurrency})</label>
                              <input
                                type="text"
                                value={baseInWordsDisplay}
                                className={`${inputClass} bg-gray-50 font-bold`}
                                readOnly
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
                        <div className="flex items-center gap-2">
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
                        {rule("in_words").visible && (
                          <div>
                            <label className={labelClass}>In Words ({soCurrency})</label>
                            <input
                              type="text"
                              value={inWordsDisplay}
                              className={`${inputClass} bg-gray-50 font-bold`}
                              readOnly
                            />
                          </div>
                        )}
                      </div>
                    </div>
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
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Billing Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Customer Address</label>
                      <LinkSearchField
                        value={form.customer_address ?? ""}
                        onChange={(v) => void handleAddressSelect("customer_address", "address_display")(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Sales Order",
                            form.customer ? { link_name: form.customer } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                        disabled={!isFieldEditable("customer_address")}
                      />
                    </div>
                    {form.address_display && (
                      <div>
                        <label className={labelClass}>Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(form.address_display)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <LinkSearchField
                        value={form.contact_person ?? ""}
                        onChange={(v) => void handleContactSelect(v ?? "")}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Contact",
                            q,
                            "Sales Order",
                            form.customer ? { link_name: form.customer } : undefined,
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
                    {form.contact_display && (
                      <div>
                        <label className={labelClass}>Contact</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line py-2.5`}>
                          {normalizeDisplayText(form.contact_display)}
                        </div>
                      </div>
                    )}
                    {form.contact_person && (
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

            {/* Shipping Address */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Shipping Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Shipping Address</label>
                      <LinkSearchField
                        value={form.shipping_address_name ?? ""}
                        onChange={(v) => void handleAddressSelect("shipping_address_name", "shipping_address")(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Sales Order",
                            form.customer ? { link_name: form.customer } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                        disabled={!isFieldEditable("shipping_address_name")}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    {form.shipping_address && (
                      <div>
                        <label className={labelClass}>Shipping Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(form.shipping_address)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Company Address */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Company Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Company Address Name</label>
                      <LinkSearchField
                        value={form.company_address ?? ""}
                        onChange={(v) => void handleAddressSelect("company_address", "company_address_display")(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Sales Order",
                            form.company ? { link_name: form.company } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                        disabled={!isFieldEditable("company_address")}
                      />
                    </div>
                    {form.company_address_display && (
                      <div>
                        <label className={labelClass}>Company Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(form.company_address_display)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Company Contact Person</label>
                    <LinkSearchField
                      value={form.company_contact_person ?? ""}
                      onChange={(v) => update({ company_contact_person: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink(
                          "Contact",
                          q,
                          "Sales Order",
                          form.company ? { link_name: form.company } : undefined,
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
                </div>
              </div>
            </div>

            {/* Territory */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Territory</div>
              <div className="pb-4 max-w-sm space-y-3">
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
                <Field label="Dispatch Address" fieldname="dispatch_address_name">
                  <LinkSearchField
                    value={form.dispatch_address_name ?? ""}
                    onChange={(v) => void handleAddressSelect("dispatch_address_name", "dispatch_address")(v)}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Address",
                        q,
                        "Sales Order",
                        form.customer ? { link_name: form.customer } : undefined,
                      )
                      return { items: results }
                    }}
                    placeholder="Select address…"
                    suppressExternalLabelFetch
                    clearIconMode="hover"
                    disabled={!isFieldEditable("dispatch_address_name")}
                  />
                </Field>
                {form.dispatch_address && (
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
        )}

        {activeTab === "terms" && (
          <div className="space-y-4">
            <div className="pb-4 border-b border-border space-y-3">
              <h3 className="text-base font-bold text-heading">Payment Terms</h3>
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

            <div className="pb-4 border-b border-border space-y-3">
              <h3 className="text-base font-bold text-heading">Terms and Conditions</h3>
              <div className="max-w-sm">
                <label className={labelClass}>Terms</label>
                <LinkSearchField
                  value={form.tc_name ?? ""}
                  onChange={(v) => update({ tc_name: v ?? "", terms: "" })}
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
            </div>
          </div>
        )}

        {activeTab === "more_info" && (
          <div className="space-y-4">
            <CollapsibleSection title="Sales Team">
              <ChildTableGrid<SalesOrderSalesTeamRow>
                title="Sales Team"
                noTopBorder
                rows={form.sales_team ?? []}
                columns={salesTeamColumns}
                emptyRow={{ sales_person: "", allocated_percentage: 0, allocated_amount: 0, commission_rate: 0, incentives: 0 }}
                onChange={(rows) => update({ sales_team: rows })}
                readOnly={!isFieldEditable("sales_team")}
                minWidth="720px"
                canAdd={mode === "create" || isFieldEditable("sales_team")}
              />
            </CollapsibleSection>

            <CollapsibleSection title="Print Settings">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                <div className="flex items-start gap-2 pt-6">
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
            </CollapsibleSection>

            <CollapsibleSection title="Additional Info">
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
                <div>
                  <label className={labelClass}>Source</label>
                  <LinkSearchField
                    value={form.source ?? ""}
                    onChange={(v) => update({ source: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Lead Source", q, "Sales Order")
                      return { items: results }
                    }}
                    docType="Lead Source"
                    placeholder="Select source…"
                    validate={async (v) => {
                      await customerService.validateLink("Lead Source", v)
                    }}
                    clearIconMode="hover"
                    disabled={!isFieldEditable("source")}
                  />
                </div>
                <div>
                  <label className={labelClass}>Campaign</label>
                  <LinkSearchField
                    value={form.campaign ?? ""}
                    onChange={(v) => update({ campaign: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Campaign", q, "Sales Order")
                      return { items: results }
                    }}
                    docType="Campaign"
                    placeholder="Select campaign…"
                    validate={async (v) => {
                      await customerService.validateLink("Campaign", v)
                    }}
                    clearIconMode="hover"
                    disabled={!isFieldEditable("campaign")}
                  />
                </div>
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
              </div>
            </CollapsibleSection>
          </div>
        )}
      </div>
    )
  },
)
