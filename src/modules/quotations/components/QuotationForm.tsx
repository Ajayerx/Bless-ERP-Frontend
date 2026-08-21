"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  CollapsibleSection,
  Input,
  LinkSearchField,
  useToast,
} from "@/components/ui"
import { ScanBarcode } from "lucide-react"
import {
  Combobox,
  inputClass,
  labelClass,
} from "@/components/ui/form-fields"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { useAuth } from "@/context/AuthContext"
import { useCompany } from "@/context/CompanyContext"
import { useLazyOptions } from "@/services/lookup-cache"
import { quotationService, buildApplyPriceListArgs, buildDeskApplyPriceListDoc, SuppressedDuplicateError, deskRandomString } from "@/modules/quotations/services"
import { customerService } from "@/modules/customers/services"
import {
  computeTaxes,
  computeTotalForDiscountAmount,
  createEmptyTaxRow,
  getCurrencySmallestFraction,
  roundToSmallestCurrencyFraction,
  type EditableTaxRow,
} from "@/modules/invoices/services"
import { AddMultipleModal, type LineItemForm } from "@/modules/invoices/components/InvoiceLineItems"
import type { Product } from "@/services"
import type {
  CompetitorRow,
  LostReasonRow,
  PricingRuleRow,
  Quotation,
  QuotationFormData,
  QuotationItem,
  QuotationTax,
} from "@/modules/quotations/types"
import { useVisibilityRules, DEFAULT_RULES } from "@/modules/quotations/hooks/useVisibilityRules"
import { formatCurrency, formatFixed } from "@/lib/utils"

const ORDER_TYPE_OPTIONS = ["Sales", "Maintenance", "Shopping Cart"] as const

const CHILD_STD_FIELDS = new Set([
  "doctype",
  "name",
  "owner",
  "creation",
  "modified",
  "modified_by",
  "docstatus",
  "idx",
  "parent",
  "parentfield",
  "parenttype",
  "__islocal",
  "__unsaved",
  "__unedited",
  "_user_tags",
  "comments",
  "likes",
])

type QuotationFormTab = "details" | "address" | "terms" | "more_info"

export interface QuotationFormHandle {
  save: (action?: "Save" | "Update" | "Submit") => Promise<string | undefined>
  isDirty: () => boolean
}

export interface QuotationFormProps {
  quotation?: Quotation | null
  mode?: "create" | "edit"
  onSaved?: (doc: Quotation) => void
  onSavingChange?: (saving: boolean) => void
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

// SPA display fields normalize <br> to newlines (mirrors invoice Address block).
function normalizeDisplayText(value?: string) {
  return (value ?? "").replace(/<br\s*\/?>/gi, "\n")
}

function createEmptyItem(): QuotationItem {
  return {
    name: `new-quotation-item-${deskRandomString()}`,
    item_name: "",
    item_code: "",
    qty: 0,
    uom: "",
    conversion_factor: 1,
    price_list_rate: 0,
    rate: 0,
    amount: 0,
    discount_percentage: 0,
    is_free_item: 0,
    grant_commission: 1,
  }
}

function quotationTaxesToEditable(taxes: QuotationTax[]): EditableTaxRow[] {
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

function editableToQuotationTaxes(rows: EditableTaxRow[]): QuotationTax[] {
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

export default forwardRef<QuotationFormHandle, QuotationFormProps>(
  function QuotationForm(
    {
      quotation: initialData,
      mode = initialData ? "edit" : "create",
      onSaved,
      onSavingChange,
      onDirtyChange,
    },
    ref,
  ) {
    const { companyDefaults } = useCompany()
    const { user } = useAuth()
    const { addToast } = useToast()

    const companyCurrency = companyDefaults?.currency || "CAD"
    const defaultCompany = companyDefaults?.company || ""
    const defaultPriceList = companyDefaults?.defaultSellingPriceList || "Standard Selling"

    const buildEmptyForm = (): QuotationFormData => ({
      doctype: "Quotation",
      naming_series: "SAL-QTN-.YYYY.-",
      quotation_to: "Customer",
      transaction_date: todayISO(),
      valid_till: addDaysISO(30),
      order_type: "Sales",
      company: defaultCompany,
      currency: companyCurrency,
      conversion_rate: 1,
      selling_price_list: defaultPriceList,
      price_list_currency: companyCurrency,
      plc_conversion_rate: 1,
      items: [createEmptyItem()],
      taxes: [],
      payment_schedule: [],
      lost_reasons: [],
      competitors: [],
      pricing_rules: [],
      group_same_items: 0,
      disable_rounded_total: 0,
      ignore_pricing_rule: 0,
      docstatus: 0,
      status: "Draft",
    })

    const [form, setForm] = useState<QuotationFormData>(() =>
      initialData ? { ...initialData } : buildEmptyForm(),
    )
    const [baseline, setBaseline] = useState<QuotationFormData>(() =>
      initialData ? { ...initialData } : buildEmptyForm(),
    )
    const [saving, setSaving] = useState(false)
    const [currencyFraction, setCurrencyFraction] = useState<number | null>(null)
    const baselineRef = useRef<QuotationFormData>(baseline)
    const [activeTab, setActiveTab] = useState<
      "details" | "address" | "terms" | "more_info"
    >("details")

    const currencies = useLazyOptions<string[]>(
      "quotation:currencies",
      quotationService.lookups.currencies,
      [],
    )
    const priceLists = useLazyOptions<string[]>(
      "quotation:price-lists",
      quotationService.lookups.priceLists,
      [],
    )

    // Pre-seeded for edit mode so the mount run doesn't replay the company()
    // trigger chain on an already-loaded doc (desk only fires it on change).
    const defaultsAppliedForCompany = useRef<string | null>(initialData?.company ?? null)

    useEffect(() => {
      if (initialData) {
        const next = { ...initialData }
        setForm(next)
        setBaseline(next)
        baselineRef.current = next
      }
    }, [initialData])

    // CompanyContext resolves after first paint on hard loads, so
    // buildEmptyForm() captured "" and nothing wrote it back (the Company
    // input was removed for desk parity). Write the default into form AND
    // both baselines so a pristine untouched form stays non-dirty — desk new
    // docs carry company from bootinfo defaults before any user edit.
    const companySyncedFor = useRef<string | null>(initialData?.company ?? null)
    useEffect(() => {
      if (initialData || !defaultCompany) return
      if (form.company) {
        companySyncedFor.current = form.company
        return
      }
      if (companySyncedFor.current === defaultCompany) return
      companySyncedFor.current = defaultCompany
      setForm((prev) => (prev.company ? prev : { ...prev, company: defaultCompany }))
      setBaseline((prev) => (prev.company ? prev : { ...prev, company: defaultCompany }))
      baselineRef.current = baselineRef.current.company
        ? baselineRef.current
        : { ...baselineRef.current, company: defaultCompany }
    }, [defaultCompany, form.company, initialData])

    useEffect(() => {
      const frac = getCurrencySmallestFraction(form.currency)
      frac.then((f) => {
        if (f !== currencyFraction) setCurrencyFraction(f)
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.currency])

    // Latest doc snapshot for async handlers (mirrors desk's frm.doc reads).
    const formRef = useRef(form)
    useEffect(() => {
      formRef.current = form
    }, [form])

    const inApplyPriceList = useRef(false)
    const companyAddressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const defaultTaxesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Desk TransactionController.apply_price_list(item, reset_plc_conversion)
    // (transaction.js:2018-2072): guard → mutex → call → apply parent/children.
    const runApplyPriceList = (
      docOverride?: Partial<Quotation>,
      item?: QuotationItem | null,
      resetPlcConversion = false,
    ) => {
      const base: Partial<Quotation> = { ...(docOverride ?? formRef.current) }
      if (!resetPlcConversion) {
        // Desk blanks plc_conversion_rate before building args. We drop it
        // from the payload only — blanking React state would phantom-dirty
        // a pristine form; the wire bytes stay identical.
        base.plc_conversion_rate = undefined
      }
      const args = buildApplyPriceListArgs(
        base as Partial<Quotation> & Record<string, unknown>,
        item,
      )
      // Desk sends doc = the full frappe doc dict (meta keys, defaulted child
      // numerics, null link slots) — build that envelope from our state.
      const wireDoc = buildDeskApplyPriceListDoc(base as Partial<Quotation> & Record<string, unknown>, {
        isNew: mode === "create" && !initialData,
        owner: user?.id,
      })
      const itemCount = Array.isArray(args.items) ? (args.items as unknown[]).length : 0
      if (!itemCount && !args.price_list) return
      if (inApplyPriceList.current) return
      inApplyPriceList.current = true
      quotationService
        .applyPriceList(args, wireDoc)
        .then((res) => {
          if (!res) return
          const parent = res.parent || {}
          const patch: QuotationFormData = {}
          if (parent.price_list_currency)
            patch.price_list_currency = String(parent.price_list_currency)
          const plcRate = Number(parent.plc_conversion_rate)
          if (!Number.isNaN(plcRate) && plcRate > 0) patch.plc_conversion_rate = plcRate
          setForm((prev) => (Object.keys(patch).length ? { ...prev, ...patch } : prev))
          // _set_values_for_item_list: map child values back onto rows.
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
                const row: QuotationItem = { ...items[idx] }
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

    // Setup: accounting dimensions once per mount (desk setup_accounting_dimension_triggers).
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

    // ── company() trigger chain (sales_common.js parity) ───────────────
    // validate_link on the Company value + debounced default address; on a
    // fresh new-doc also price list defaults and default taxes.
    useEffect(() => {
      const company = form.company || defaultCompany
      if (!company) return
      if (defaultsAppliedForCompany.current === company) return
      const isFirstRun = defaultsAppliedForCompany.current === null
      defaultsAppliedForCompany.current = company

      // Link control validates the auto-set Company value (link.js validate_link_and_fetch).
      quotationService.validateLink("Company", company, []).catch(() => undefined)

      // set_default_company_address — debounce 2000ms like desk.
      if (companyAddressTimer.current) clearTimeout(companyAddressTimer.current)
      companyAddressTimer.current = setTimeout(() => {
        quotationService
          .getDefaultCompanyAddress(company, formRef.current.company_address || "")
          .then((addr) => {
            setForm((prev) => ({ ...prev, company_address: addr ?? "" }))
          })
      }, 2000)

      // set_default_company_contact_person — skipped on load like desk's
      // `if (!this.is_onload)` guard (avoids overriding mapped contacts).
      if (!isFirstRun) {
        quotationService
          .getValue("Company", "default_sales_contact", { name: company })
          .then((res) => {
            const contact = res?.default_sales_contact
            setForm((prev) => ({
              ...prev,
              company_contact_person: contact ? String(contact) : "",
            }))
          })
          .catch(() => undefined)
      }

      // New-document-only defaults (__islocal guards in desk onload_post_render).
      if (mode === "create" && !initialData) {
        runApplyPriceList()

        if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current)
        defaultTaxesTimer.current = setTimeout(async () => {
          const res = await quotationService.getDefaultTaxesAndCharges(company, "")
          setForm((prev) => {
            if (!res) return prev
            if (!res.taxes_and_charges && res.taxes.length === 0) return prev
            if ((prev.taxes ?? []).length > 0) return prev
            const patch: QuotationFormData = {
              taxes_and_charges: res.taxes_and_charges || undefined,
            }
            if (res.taxes.length > 0) patch.taxes = res.taxes as unknown as QuotationTax[]
            return { ...prev, ...patch }
          })
        }, 2000)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, form.company, initialData])

    useEffect(() => {
      return () => {
        if (companyAddressTimer.current) clearTimeout(companyAddressTimer.current)
        if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current)
      }
    }, [])

    const isDirty = () => JSON.stringify(form) !== JSON.stringify(baselineRef.current)
    useEffect(() => {
      onDirtyChange?.(isDirty())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form])

    const rules = useVisibilityRules(form, DEFAULT_RULES)
    const rule = (fieldname: string) =>
      rules[fieldname] ?? { visible: true, readOnly: false, reqd: false }

    const update = (patch: QuotationFormData) => setForm((prev) => ({ ...prev, ...patch }))

    const isForeignCurrency = (form.currency || companyCurrency) !== companyCurrency

    // ── Party fetch: party_name select → get_party_details ─────────────
    const handlePartySelect = async (party: string) => {
      const company = formRef.current.company || defaultCompany
      if (!party || !company || !formRef.current.transaction_date) return
      update({ party_name: party, customer_name: "" })
      try {
        const details = await quotationService.getPartyDetails(
          formRef.current.quotation_to || "Customer",
          party,
          company,
          formRef.current.transaction_date,
          {
            priceList: formRef.current.selling_price_list,
            currency: formRef.current.currency,
            fetchPaymentTermsTemplate: true,
          },
        )
        // Desk fills via frm.set_value(r.message) (utils/party.js:114):
        // every non-null key overwrites — empty strings clear stale values
        // left by a previously selected party; nulls are skipped. Unknown
        // keys (sales_team…) are not form fields and are dropped.
        const known = new Set([
          "customer_name", "customer_group", "territory", "language",
          "tax_category", "taxes_and_charges", "payment_terms_template",
          "customer_address", "address_display", "contact_person",
          "contact_display", "contact_mobile", "contact_email",
          "shipping_address_name", "shipping_address", "currency",
          "conversion_rate", "selling_price_list", "price_list_currency",
          "plc_conversion_rate", "company_address", "company_address_display",
        ])
        const patch: QuotationFormData = { party_name: party }
        for (const [key, value] of Object.entries(details)) {
          if (!known.has(key)) continue
          if (value === null || value === undefined) continue
          ;(patch as Record<string, unknown>)[key] = value
        }
        setForm((prev) => ({ ...prev, ...patch }))
        // Desk customer()/party_name(): get_party_details callback → apply_price_list().
        runApplyPriceList({ ...formRef.current, ...patch })
      } catch {
        // party details are a best-effort fill
      }
    }

    // ── Currency change → get_exchange_rate ────────────────────────────
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
        const rate = await quotationService.getExchangeRate(
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

    // ── Address & contact handlers (auto-fill display blocks) ─────────
    const handlePartyAddressSelect = (v?: string) => {
      update({ customer_address: v ?? "" })
      if (!v) {
        update({ address_display: "" })
        return
      }
      quotationService.validateLink("Address", v, []).then(() => {
        quotationService.getAddressDisplay(v).then((display) => {
          if (display) update({ address_display: display })
        })
      }).catch(() => undefined)
    }

    const handleShippingAddressSelect = (v?: string) => {
      update({ shipping_address_name: v ?? "" })
      if (!v) {
        update({ shipping_address: "" })
        return
      }
      quotationService.validateLink("Address", v, []).then(() => {
        quotationService.getAddressDisplay(v).then((display) => {
          if (display) update({ shipping_address: display })
        })
      }).catch(() => undefined)
    }

    const handleCompanyAddressSelect = (v?: string) => {
      update({ company_address: v ?? "" })
      if (!v) {
        update({ company_address_display: "" })
        return
      }
      quotationService.validateLink("Address", v, []).then(() => {
        quotationService.getAddressDisplay(v).then((display) => {
          if (display) update({ company_address_display: display })
        })
      }).catch(() => undefined)
    }

    const handleContactSelect = (v?: string) => {
      update({ contact_person: v ?? "" })
      if (!v) {
        update({ contact_display: "", contact_mobile: "", contact_email: "" })
        return
      }
      quotationService.validateLink("Contact", v, []).then(() => {
        quotationService.getContactDetails(v).then((details) => {
          update({
            contact_display: details.contact_display ?? "",
            contact_mobile: details.contact_mobile ?? "",
            contact_email: details.contact_email ?? "",
          })
        })
      }).catch(() => undefined)
    }

    // ── Items ──────────────────────────────────────────────────────────
    // Scan Barcode → get_item_details; replaces an empty row or appends.
    const blockIfMissingParty = (): boolean => {
      const missing = [
        (form.company || defaultCompany) ? null : "Company",
        form.party_name ? null : "Customer",
      ].filter(Boolean)
      if (missing.length === 0) return false
      addToast(`Please specify: ${missing.join(", ")}. It is needed to fetch Item Details.`, "warning")
      return true
    }

    const localDocNameRef = useRef("")
    const localDocName = (): string => {
      if (formRef.current.name) return formRef.current.name
      if (mode === "create") {
        if (!localDocNameRef.current) localDocNameRef.current = `new-quotation-${deskRandomString()}`
        return localDocNameRef.current
      }
      return ""
    }

    const runItemCodeFlow = async (idx: number, itemCode: string): Promise<QuotationItem | null> => {
      const snapshot = formRef.current
      const current = snapshot.items?.[idx]
      if (!current || !itemCode) return null

      const patched: QuotationItem = {
        ...current,
        item_code: itemCode,
        weight_per_unit: 0,
        weight_uom: "",
        uom: "",
        conversion_factor: 0,
        barcode: null,
        pricing_rules: "",
      }
      const items = [...(snapshot.items ?? [])]
      items[idx] = patched
      update({ items })

      await quotationService.validateLink("Item", itemCode, []).catch(() => undefined)

      const docName = snapshot.name || localDocName()
      const doc = buildDeskApplyPriceListDoc(
        { ...snapshot, name: docName, items },
        { isNew: mode === "create" && !initialData, owner: user?.id },
      )
      const args: Record<string, unknown> = {
        item_code: itemCode,
        barcode: null,
        serial_no: undefined,
        batch_no: undefined,
        set_warehouse: undefined,
        warehouse: patched.warehouse || undefined,
        customer: snapshot.party_name || undefined,
        quotation_to: snapshot.quotation_to || undefined,
        supplier: undefined,
        currency: snapshot.currency || undefined,
        is_internal_supplier: undefined,
        is_internal_customer: undefined,
        update_stock: 0,
        conversion_rate: snapshot.conversion_rate ?? 1,
        price_list: snapshot.selling_price_list || undefined,
        price_list_currency: snapshot.price_list_currency || undefined,
        plc_conversion_rate: snapshot.plc_conversion_rate ?? 1,
        company: snapshot.company || defaultCompany,
        order_type: snapshot.order_type || undefined,
        is_pos: 0,
        is_return: 0,
        is_subcontracted: undefined,
        ignore_pricing_rule: snapshot.ignore_pricing_rule ?? 0,
        doctype: "Quotation",
        name: docName || undefined,
        project: undefined,
        qty: patched.qty || 1,
        net_rate: patched.rate || undefined,
        base_net_rate: undefined,
        stock_qty: patched.stock_qty || undefined,
        conversion_factor: 0,
        weight_per_unit: 0,
        uom: null,
        weight_uom: "",
        manufacturer: undefined,
        stock_uom: patched.stock_uom || "Nos",
        pos_profile: "",
        tax_category: snapshot.tax_category || "",
        item_tax_template: undefined,
        child_doctype: "Quotation Item",
        child_docname: patched.name || undefined,
        is_old_subcontracting_flow: undefined,
        use_serial_batch_fields: undefined,
        serial_and_batch_bundle: undefined,
      }

      const details = await quotationService.getItemDetailsDesk(doc, args)
      if (!details || typeof details !== "object") return null

      const merged: Record<string, unknown> = { ...patched }
      for (const [k, v] of Object.entries(details)) {
        if (CHILD_STD_FIELDS.has(k)) continue
        merged[k] = v
      }

      const plr = Number(merged.price_list_rate) || 0
      const marginType = String(merged.margin_type ?? "")
      const mra = Number(merged.margin_rate_or_amount) || 0
      const rateWithMargin = plr + (marginType === "Percentage" ? plr * (mra / 100) : mra)
      const discPct = Number(merged.discount_percentage) || 0
      let discountAmount = Number(merged.discount_amount) || 0
      if (discPct && !discountAmount) discountAmount = rateWithMargin * (discPct / 100)
      let rate = rateWithMargin
      if (discountAmount > 0) {
        rate = rateWithMargin - discountAmount
        merged.discount_percentage = (100 * discountAmount) / rateWithMargin
      }

      const qty = Number(merged.qty) || 0
      const convRate = Number(snapshot.conversion_rate) || 1
      merged.rate = Math.round(rate * 100) / 100
      merged.amount = Math.round(rate * qty * 100) / 100
      merged.base_net_rate = Math.round(rate * convRate * 100) / 100
      merged.stock_qty = qty * (Number(merged.conversion_factor) || 0)

      if (plr > 0 && rate > plr) {
        merged.discount_percentage = 0
        merged.margin_type = "Amount"
        merged.margin_rate_or_amount = Math.round((rate - plr) * 100) / 100
        merged.rate_with_margin = rate
      } else if (plr > 0) {
        merged.discount_percentage = Math.round((1 - rate / plr) * 100 * 100) / 100
        merged.discount_amount = Math.round((plr - rate) * 100) / 100
        merged.margin_type = ""
        merged.margin_rate_or_amount = 0
        merged.rate_with_margin = 0
      } else {
        merged.discount_percentage = 0
        merged.margin_type = ""
        merged.margin_rate_or_amount = 0
        merged.rate_with_margin = 0
      }

      const mergedRow = merged as unknown as QuotationItem
      update({ items: items.map((r, i) => (i === idx ? mergedRow : r)) })

      if (mergedRow.item_code && mergedRow.rate) {
        const tpl = await quotationService.getItemTaxTemplate({
          item_code: mergedRow.item_code,
          company: snapshot.company || defaultCompany,
          base_net_rate: Number(merged.base_net_rate) || 0,
          tax_category: snapshot.tax_category || "",
          transaction_date: snapshot.transaction_date || "",
        })
        if (tpl) {
          const withTpl = { ...mergedRow, item_tax_template: tpl }
          update({ items: (formRef.current.items ?? []).map((r, i) => (i === idx ? withTpl : r)) })
          return withTpl
        }
      }
      return mergedRow
    }

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
      const row = await runItemCodeFlow(idx, value)
      if (row?.warehouse) update({ last_scanned_warehouse: row.warehouse })
    }

    const handleItemsChange = (next: QuotationItem[]) => {
      const prev = form.items ?? []
      if (next.length !== prev.length) {
        update({ items: next })
        return
      }
      const items = [...prev]
      let changed = false
      next.forEach((row, i) => {
        const old = prev[i]
        if (!old || row === old) return
        changed = true
        const patch = { ...row } as QuotationItem

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
    }))

    // ── Taxes & totals ─────────────────────────────────────────────────
    const itemTotals = useMemo(() => {
      const items = form.items ?? []
      const total_qty = items.reduce((s, i) => s + (i.qty || 0), 0)
      const subtotal = items.reduce((s, i) => s + (i.amount || 0), 0)
      return { total_qty, subtotal }
    }, [form.items])

    const { total_qty, subtotal } = itemTotals

    // Pre-discount tax run (ERPNext initialize_taxes base pass).
    const taxRowsBase = useMemo(
      () => computeTaxes(quotationTaxesToEditable(form.taxes ?? []), subtotal, total_qty),
      [form.taxes, subtotal, total_qty],
    )
    const total_taxes_base = useMemo(
      () => taxRowsBase.reduce((sum, r) => sum + r.tax_amount, 0),
      [taxRowsBase],
    )

    const apply_discount_on = (form.apply_discount_on ?? "Grand Total") as
      | "Grand Total"
      | "Net Total"

    // Additional discount: explicit amount wins; otherwise % × base.
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

    // ERPNext get_total_for_discount_amount parity: the discount distributes
    // over net + non-Actual taxes (Grand Total) or net alone (Net Total).
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

    const rounded_total = roundToSmallestCurrencyFraction(
      taxState.grand_total,
      currencyFraction,
    )
    const rounding_adjustment = Math.round((rounded_total - taxState.grand_total) * 100) / 100
    const conversion_rate = form.conversion_rate ?? 1
    const base_grand_total = taxState.grand_total * conversion_rate
    const base_rounded_total = Math.round(base_grand_total * 100) / 100
    const base_total = Math.round(subtotal * conversion_rate * 100) / 100
    const base_net_total = Math.round(net_total * conversion_rate * 100) / 100
    const base_rounding_adjustment = Math.round((base_rounded_total - base_grand_total) * 100) / 100
    const base_discount_amount = Math.round((form.discount_amount ?? 0) * conversion_rate * 100) / 100

    const handleTaxChange = (rows: EditableTaxRow[]) => {
      update({ taxes: editableToQuotationTaxes(rows) })
    }

    // Additional-discount handlers — invoice-form parity: percentage
    // auto-computes discount_amount against grand_total (subtotal + taxes)
    // or net_total (subtotal) depending on apply_discount_on.
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
        const base = discountBase(apply_discount_on)
        update({ discount_amount: Math.round(base * (value / 100) * 100) / 100 })
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
        const result = await quotationService.getTaxesAndCharges(template)
        if (result.taxes && result.taxes.length > 0) {
          update({ taxes: result.taxes })
        }
        if (result.tax_category) update({ tax_category: result.tax_category })
      } catch {
        // template fill is best-effort
      }
    }

    // ── Payment terms template → get_payment_terms ───────────────────
    const handlePaymentTermsSelect = async (template: string) => {
      update({ payment_terms_template: template })
      if (!template) return
      try {
        const result = await quotationService.getPaymentTerms(
          template,
          form.transaction_date || todayISO(),
          taxState.grand_total,
        )
        if (result.payment_schedule.length > 0) {
          update({
            payment_schedule: result.payment_schedule as unknown as Quotation["payment_schedule"],
          })
        }
      } catch {
        // payment terms fill is best-effort
      }
    }

    // ── Terms & conditions → get_terms_and_conditions ───────────────
    const handleTcNameSelect = async (template: string) => {
      update({ tc_name: template, terms: "" })
      if (!template) return
      try {
        const docCtx: Record<string, unknown> = {
          doctype: "Quotation",
          transaction_date: form.transaction_date || todayISO(),
          valid_till: form.valid_till ?? "",
          company: form.company ?? "",
          quotation_to: form.quotation_to ?? "Customer",
          party_name: form.party_name ?? "",
          customer_name: form.customer_name ?? "",
        }
        const rendered = await quotationService.getTerms(template, docCtx)
        if (rendered) update({ terms: rendered })
      } catch {
        // terms fill is best-effort
      }
    }

    const currencyLabel = form.currency || companyCurrency

    const itemColumns: GridColumn<QuotationItem>[] = [
      {
        key: "item_code",
        label: "Item",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await quotationService.searchItemsDesk(q).catch(() => [])
          return {
            items: results.map((r) => ({
              value: r.value,
              label: r.value,
              description: r.description ?? "",
            })),
          }
        },
        placeholder: "Search item…",
        weight: 2.4,
      },
      { key: "qty", label: "Quantity", type: "number", align: "right", weight: 1 },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        weight: 1.2,
        placeholder: "0",
      },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        weight: 1.4,
        formatter: (row) => formatFixed(row.amount ?? 0, 2),
      },
    ]

    const readOnlyItemColumns: GridColumn<QuotationItem>[] = [
      { key: "item_code", label: "Item", type: "link", weight: 2.4 },
      {
        key: "qty",
        label: "Quantity",
        type: "number",
        align: "right",
        weight: 1,
        formatter: (row) => formatFixed(row.qty ?? 0, 3),
      },
      {
        key: "rate",
        label: `Rate (${currencyLabel})`,
        type: "number",
        align: "right",
        weight: 1.2,
        formatter: (row) => formatFixed(row.rate ?? 0, 2),
      },
      {
        key: "amount",
        label: `Amount (${currencyLabel})`,
        type: "readonly",
        align: "right",
        weight: 1.4,
        formatter: (row) => formatFixed(row.amount ?? 0, 2),
      },
    ]

    const taxColumns: GridColumn<EditableTaxRow>[] = [
      {
        key: "charge_type",
        label: "Type",
        type: "link",
        options: ["On Net Total", "On Previous Row Amount", "On Previous Row Total", "On Item Quantity", "Actual"],
      },
      { key: "account_head", label: "Account Head", type: "text", weight: 2 },
      {
        key: "rate",
        label: "Rate",
        type: "number",
        align: "right",
        disabled: (row) => row.charge_type === "Actual",
      },
      {
        key: "tax_amount",
        label: "Amount",
        type: "number",
        align: "right",
        disabled: (row) => row.charge_type !== "Actual",
      },
      {
        key: "total",
        label: "Row Total",
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.total ?? 0),
      },
    ]

    const paymentScheduleColumns: GridColumn<Quotation["payment_schedule"][number]>[] = [
      { key: "payment_term", label: "Payment Term", type: "text", weight: 2 },
      { key: "description", label: "Description", type: "text", weight: 3 },
      { key: "due_date", label: "Due Date", type: "date" },
      { key: "invoice_portion", label: "Portion %", type: "number", align: "right" },
      {
        key: "payment_amount",
        label: "Amount",
        type: "number",
        align: "right",
      },
    ]

    const pricingRuleColumns: GridColumn<PricingRuleRow>[] = [
      { key: "pricing_rule", label: "Pricing Rule", type: "readonly", weight: 2 },
      {
        key: "rule_applied",
        label: "Applied",
        type: "readonly",
        weight: 1,
        formatter: (row) => (row.rule_applied ? "Yes" : "No"),
      },
    ]

    const lostReasonColumns: GridColumn<LostReasonRow>[] = [
      { key: "lost_reason", label: "Lost Reason", type: "readonly", weight: 2 },
    ]

    const competitorColumns: GridColumn<CompetitorRow>[] = [
      { key: "competitor", label: "Competitor", type: "readonly", weight: 2 },
    ]

    const partyLabel = `Party (${form.quotation_to || "Customer"})`
    const partyVisible = rule("party_name").visible
    const partyLocked = rule("party_name").readOnly

    const handleSave = async (action?: "Save" | "Update" | "Submit"): Promise<string | undefined> => {
      if (saving) return undefined
      setSaving(true)
      onSavingChange?.(true)
      try {
        const doc: Record<string, unknown> = {
          ...form,
          doctype: "Quotation",
          items: (form.items ?? []).map(({ name: _n, ...rest }) => rest),
          taxes: (form.taxes ?? []).map(({ name: _n, ...rest }) => rest),
          payment_schedule: (form.payment_schedule ?? []).map(({ name: _n, ...rest }) => rest),
          lost_reasons: (form.lost_reasons ?? []).map(({ name: _n, ...rest }) => rest),
          competitors: (form.competitors ?? []).map(({ name: _n, ...rest }) => rest),
          pricing_rules: (form.pricing_rules ?? []).map(({ name: _n, ...rest }) => rest),
          total_qty,
          net_total,
          total: subtotal,
          base_total,
          base_net_total: net_total * conversion_rate,
          base_discount_amount,
          total_taxes_and_charges: taxState.total_taxes,
          base_total_taxes_and_charges: taxState.total_taxes * conversion_rate,
          grand_total: taxState.grand_total,
          base_grand_total,
          rounding_adjustment,
          rounded_total,
          base_rounding_adjustment: Math.round((base_rounded_total - base_grand_total) * 100) / 100,
          base_rounded_total,
        }
        if (mode === "edit" && initialData?.name) doc.name = initialData.name
        const saved =
          action === "Submit"
            ? await quotationService.saveDoc(doc, "Submit")
            : mode === "edit" && (initialData?.docstatus ?? 0) === 1
              ? await quotationService.saveDoc(doc, "Update")
              : await quotationService.saveDoc(doc, "Save")
        baselineRef.current = { ...form, name: saved?.name }
        setBaseline(baselineRef.current)
        onSaved?.(saved)
        return saved?.name
      } finally {
        setSaving(false)
        onSavingChange?.(false)
      }
    }

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty,
    }))

    // Desk selling_price_list(): apply_price_list() + set_dynamic_labels().
    const handlePriceListChange = (value: string) => {
      update({ selling_price_list: value })
      runApplyPriceList({ ...formRef.current, selling_price_list: value })
    }

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

    return (
      <div className="space-y-4">
        {/* Tab bar — matches Invoice form */}
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
              onClick={() => setActiveTab(tab.id as QuotationFormTab)}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Col 1: Series / Quotation To / Customer / CRM Deal */}
                <div className="space-y-3">
                  {mode === "create" && (
                    <div>
                      <label className={labelClass}>Series *</label>
                      <select
                        value={form.naming_series ?? "SAL-QTN-.YYYY.-"}
                        onChange={(e) => update({ naming_series: e.target.value })}
                        className={inputClass}
                      >
                        <option value="SAL-QTN-.YYYY.-">SAL-QTN-.YYYY.-</option>
                      </select>
                    </div>
                  )}
                  <Field label="Quotation To *" fieldname="quotation_to">
                    <LinkSearchField
                      value={form.quotation_to}
                      onChange={(v) =>
                        update({
                          quotation_to: (v ?? "") as Quotation["quotation_to"],
                          party_name: "",
                        })
                      }
                      searchFn={async (q) => {
                        const results = await quotationService.searchQuotationTo(q)
                        return {
                          items: results.map((r) => ({
                            value: r.value,
                            label: r.value,
                            description: r.description ?? "",
                          })),
                        }
                      }}
                      docType="DocType"
                      placeholder="Select party type…"
                      disabled={rule("party_name").readOnly}
                    />
                  </Field>
                  {partyVisible && (
                    <div>
                      <label className={labelClass}>
                        {partyLabel} {rule("party_name").reqd ? "*" : ""}
                      </label>
                      <LinkSearchField
                        value={form.party_name}
                        onChange={(v) => {
                          if (v !== form.party_name) void handlePartySelect(v ?? "")
                        }}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            form.quotation_to || "Customer",
                            q,
                            "Quotation",
                          )
                          return { items: results }
                        }}
                        validate={async (v) => {
                          // Desk link.js validate_link_and_fetch → POST
                          // frappe.client.validate_link with x-frappe-doctype.
                          try {
                            const doc = await quotationService.validateLink(
                              form.quotation_to || "Customer",
                              v,
                              [],
                            )
                            if (!doc || Object.keys(doc).length === 0) {
                              throw new Error(`Invalid ${form.quotation_to || "Customer"}`)
                            }
                          } catch (err) {
                            // A dedup-skipped re-check is not an invalid link.
                            if (err instanceof SuppressedDuplicateError) return
                            throw err
                          }
                        }}
                        docType={form.quotation_to || "Customer"}
                        placeholder="Select party…"
                        readOnly={partyLocked}
                        required={rule("party_name").reqd}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Frappe CRM Deal</label>
                    <Input
                      value={form.crm_deal ?? ""}
                      onChange={(e) => update({ crm_deal: e.target.value || "" })}
                      placeholder="CRM deal reference"
                    />
                  </div>
                  {form.party_name && (
                    <Field label="Customer Name" fieldname="customer_name">
                      <Input
                        value={form.customer_name ?? ""}
                        onChange={(e) => update({ customer_name: e.target.value })}
                        readOnly
                      />
                    </Field>
                  )}
                </div>
                {/* Col 2: Date / Valid Till / Company */}
                <div className="space-y-3">
                  <Field label="Date *" fieldname="transaction_date">
                    <Input
                      type="date"
                      value={form.transaction_date}
                      onChange={(e) => update({ transaction_date: e.target.value })}
                      readOnly={rule("transaction_date").readOnly}
                    />
                  </Field>
                  <Field label="Valid Till" fieldname="valid_till">
                    <Input
                      type="date"
                      value={form.valid_till}
                      onChange={(e) => update({ valid_till: e.target.value })}
                      readOnly={rule("valid_till").readOnly}
                    />
                  </Field>
                </div>
                {/* Col 3: Order Type */}
                <div className="space-y-3">
                  <Field label="Order Type *" fieldname="order_type">
                    <select
                      value={form.order_type}
                      onChange={(e) => update({ order_type: e.target.value })}
                      className={inputClass}
                    >
                      {ORDER_TYPE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            {/* ===== Currency & Price List ===== */}
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
                              // Desk conversion_rate() trigger → apply_price_list().
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
                          onChange={(_name, val) => handlePriceListChange(val)}
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
                                // Desk plc_conversion_rate() → apply_price_list(null, true).
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
                          disabled={(initialData?.docstatus ?? 0) === 1}
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
              {(initialData?.docstatus ?? 0) !== 1 && (
                <div className="mb-3">
                  <div className="relative max-w-sm">
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
                </div>
              )}
              <ChildTableGrid<QuotationItem>
                title="Items"
                description={(initialData?.docstatus ?? 0) === 1 ? undefined : "Click a row to edit its fields."}
                rows={form.items ?? []}
                columns={(initialData?.docstatus ?? 0) === 1 ? readOnlyItemColumns : itemColumns}
                emptyRow={createEmptyItem()}
                onChange={handleItemsChange}
                readOnly={(initialData?.docstatus ?? 0) === 1}
                canAdd={mode === "create" || (initialData?.docstatus ?? 0) !== 1}
                minWidth="760px"
                noTopBorder
                testId="quotation-items"
                footer={
                  (initialData?.docstatus ?? 0) !== 1 ? (
                    <AddMultipleModal
                      items={lineItemsForModal}
                      itemDetailsContext={{ customer: form.party_name || undefined }}
                      onAddItemWithQty={(product, qty) => void handleAddItemWithQty(product, qty)}
                      onBlocked={() => blockIfMissingParty()}
                    />
                  ) : undefined
                }
              />
              {/* Items footer: ERPNext-readable totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-1">
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
                  {isForeignCurrency && (
                    <div>
                      <label className={labelClass}>Total ({companyCurrency})</label>
                      <input
                        type="text"
                        value={formatCurrency(base_total)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Total ({form.currency || companyCurrency})</label>
                    <input
                      type="text"
                      value={formatCurrency(subtotal)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      Net Total ({form.currency || companyCurrency})
                    </label>
                    <input
                      type="text"
                      value={formatCurrency(net_total)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  {isForeignCurrency && (
                    <div>
                      <label className={labelClass}>Net Total ({companyCurrency})</label>
                      <input
                        type="text"
                        value={formatCurrency(base_net_total)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  )}
                  {(form.total_net_weight ?? 0) > 0 && (
                    <div>
                      <label className={labelClass}>Total Net Weight</label>
                      <input
                        type="text"
                        value={form.total_net_weight ?? 0}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== Taxes and Charges — fully shown (not collapsible, ERPNext) ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-base font-bold text-heading">Taxes and Charges</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Tax Category" fieldname="tax_category">
                  <LinkSearchField
                    value={form.tax_category ?? ""}
                    onChange={(v) => update({ tax_category: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Tax Category",
                        q,
                        "Quotation",
                        { disabled: 0 },
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Tax Category", v)
                    }}
                    docType="Tax Category"
                    placeholder="Select tax category…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Shipping Rule" fieldname="shipping_rule">
                  <LinkSearchField
                    value={form.shipping_rule ?? ""}
                    onChange={(v) => update({ shipping_rule: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Shipping Rule",
                        q,
                        "Quotation",
                        { disabled: 0 },
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Shipping Rule", v)
                    }}
                    docType="Shipping Rule"
                    placeholder="Select shipping rule…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Incoterm" fieldname="incoterm">
                  <LinkSearchField
                    value={form.incoterm ?? ""}
                    onChange={(v) => update({ incoterm: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Incoterm",
                        q,
                        "Quotation",
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Incoterm", v)
                    }}
                    docType="Incoterm"
                    placeholder="Select incoterm…"
                    clearIconMode="hover"
                  />
                </Field>
              </div>
              {form.incoterm && (
                <div className="max-w-sm">
                  <label className={labelClass}>Named Place</label>
                  <Input
                    value={form.named_place ?? ""}
                    onChange={(e) => update({ named_place: e.target.value })}
                    className={inputClass}
                  />
                </div>
              )}
              <div className="max-w-sm">
                <label className={labelClass}>Sales Taxes and Charges Template</label>
                <LinkSearchField
                  value={form.taxes_and_charges ?? ""}
                  onChange={(v) => void handleTaxesAndChargesSelect(v ?? "")}
                  searchFn={async (q) => {
                    const results = await customerService.searchLink(
                      "Sales Taxes and Charges Template",
                      q,
                      "Quotation",
                      { disabled: 0 },
                    )
                    return { items: results }
                  }}
                  docType="Sales Taxes and Charges Template"
                  placeholder="Select template…"
                  clearIconMode="hover"
                />
              </div>
              <ChildTableGrid<EditableTaxRow>
                title="Sales Taxes and Charges"
                noTopBorder
                rows={taxState.editable}
                columns={taxColumns}
                emptyRow={createEmptyTaxRow()}
                onChange={handleTaxChange}
                readOnly={(initialData?.docstatus ?? 0) === 1}
                minWidth="720px"
              />
              {(form.taxes ?? []).length > 0 && (
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

              {/* ===== Totals — fully shown (not collapsible, ERPNext) ===== */}
            <div className="space-y-3 pb-4 border-b border-border">
              <h3 className="text-base font-bold text-heading">Totals</h3>
              {(() => {
                const showRounding = !form.disable_rounded_total
                return (
                  <div
                    className={`mt-3 ${
                      isForeignCurrency
                        ? "grid grid-cols-1 lg:grid-cols-2 gap-6"
                        : "sm:w-1/2 ml-auto space-y-3"
                    }`}
                  >
                    {isForeignCurrency && (
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
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>
                          Grand Total ({form.currency || companyCurrency})
                        </label>
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
                            Rounding Adjustment ({form.currency || companyCurrency})
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
                          <label className={labelClass}>
                            Rounded Total ({form.currency || companyCurrency})
                          </label>
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
                          disabled={(initialData?.docstatus ?? 0) === 1}
                          className="h-4 w-4 rounded border-border"
                        />
                        <label htmlFor="disableRoundedTotal" className="text-sm text-body">
                          Disable Rounded Total
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* ===== Additional Discount ===== */}
            <CollapsibleSection
              title="Additional Discount"
              defaultOpen={!!(form.additional_discount_percentage || form.discount_amount)}
            >
              {/* Desk section_break_44: two columns split by column_break_46 */}
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
                      disabled={(initialData?.docstatus ?? 0) === 1}
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
                        const results = await customerService.searchLink("Coupon Code", q, "Quotation")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Coupon Code", v)
                      }}
                      docType="Coupon Code"
                      placeholder="Select coupon…"
                      clearIconMode="hover"
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
                      readOnly={(initialData?.docstatus ?? 0) === 1}
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
                        (initialData?.docstatus ?? 0) === 1 || rule("discount_amount").readOnly
                      }
                    />
                  </Field>
                  <Field label="Referral Sales Partner" fieldname="referral_sales_partner">
                    <LinkSearchField
                      value={form.referral_sales_partner ?? ""}
                      onChange={(v) => update({ referral_sales_partner: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink(
                          "Sales Partner",
                          q,
                          "Quotation",
                          { disabled: 0 },
                        )
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Sales Partner", v)
                      }}
                      docType="Sales Partner"
                      placeholder="Select sales partner…"
                      clearIconMode="hover"
                    />
                  </Field>
                </div>
              </div>
              {(form.pricing_rules ?? []).length > 0 && (
                <div className="pt-3">
                  <ChildTableGrid<PricingRuleRow>
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
            </div>
            )}

          {activeTab === "address" && (
          <div className="space-y-4">
            {/* Section 1: Billing Address — plain (non-collapsible) */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Billing Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>
                        {form.quotation_to || "Party"} Address
                      </label>
                      <LinkSearchField
                        value={form.customer_address ?? ""}
                        onChange={(v) => handlePartyAddressSelect(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Quotation",
                            form.party_name ? { link_name: form.party_name } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                      />
                    </div>
                    {form.address_display && (
                      <div>
                        <label className={labelClass}>Address</label>
                        <div
                          className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}
                        >
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
                        onChange={(v) => handleContactSelect(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Contact",
                            q,
                            "Quotation",
                            form.party_name ? { link_name: form.party_name } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select contact…"
                        suppressExternalLabelFetch
                        displayLabel={form.contact_display}
                        clearIconMode="hover"
                      />
                    </div>
                    {form.contact_display && (
                      <div>
                        <label className={labelClass}>Contact</label>
                        <div
                          className={`${inputClass} bg-gray-50 whitespace-pre-line py-2.5`}
                        >
                          {normalizeDisplayText(form.contact_display)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Shipping Address */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Shipping Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Shipping Address Name</label>
                      <LinkSearchField
                        value={form.shipping_address_name ?? ""}
                        onChange={(v) => handleShippingAddressSelect(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Quotation",
                            form.party_name ? { link_name: form.party_name } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                      />
                    </div>
                    {form.shipping_address && (
                      <div>
                        <label className={labelClass}>Shipping Address</label>
                        <div
                          className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}
                        >
                          {normalizeDisplayText(form.shipping_address)}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Contact Mobile</label>
                      <input
                        type="text"
                        value={form.contact_mobile ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Email</label>
                      <input
                        type="text"
                        value={form.contact_email ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Company Address */}
            <div className="border-b border-border last:border-b-0">
              <div className="py-3 text-base font-bold text-heading">Company Address</div>
              <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Company Address Name</label>
                      <LinkSearchField
                        value={form.company_address ?? ""}
                        onChange={(v) => handleCompanyAddressSelect(v)}
                        searchFn={async (q) => {
                          const results = await customerService.searchLink(
                            "Address",
                            q,
                            "Quotation",
                            form.company ? { link_name: form.company } : undefined,
                          )
                          return { items: results }
                        }}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        clearIconMode="hover"
                      />
                    </div>
                    {form.company_address_display && (
                      <div>
                        <label className={labelClass}>Company Address</label>
                        <div
                          className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}
                        >
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
                          "Quotation",
                          form.company ? { link_name: form.company } : undefined,
                        )
                        return { items: results }
                      }}
                      placeholder="Select contact…"
                      suppressExternalLabelFetch
                      clearIconMode="hover"
                    />
                  </div>
                </div>
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
                      "Quotation",
                      { disabled: 0 },
                    )
                    return { items: results }
                  }}
                  docType="Payment Terms Template"
                  placeholder="Select template…"
                  clearIconMode="hover"
                />
              </div>
              <ChildTableGrid<Quotation["payment_schedule"][number]>
                title="Payment Schedule"
                titleClassName="text-xs font-semibold text-muted"
                noTopBorder
                rows={form.payment_schedule ?? []}
                columns={paymentScheduleColumns}
                emptyRow={{ payment_term: "", description: "", due_date: "", invoice_portion: 0, payment_amount: 0 }}
                onChange={(rows) => update({ payment_schedule: rows })}
                readOnly={(initialData?.docstatus ?? 0) === 1}
                minWidth="720px"
              />
            </div>

            <div className="pb-4 border-b border-border space-y-3">
              <h3 className="text-base font-bold text-heading">Terms and Conditions</h3>
              <div className="max-w-sm">
                <label className={labelClass}>Terms</label>
                <LinkSearchField
                  value={form.tc_name ?? ""}
                  onChange={(v) => void handleTcNameSelect(v ?? "")}
                  searchFn={async (q) => {
                    const results = await customerService.searchLink(
                      "Terms and Conditions",
                      q,
                      "Quotation",
                      { disabled: 0 },
                    )
                    return { items: results }
                  }}
                  docType="Terms and Conditions"
                  placeholder="Select terms…"
                  clearIconMode="hover"
                />
              </div>
              <div>
                <label className={labelClass}>Terms and Conditions Details</label>
                <textarea
                  rows={4}
                  value={form.terms ?? ""}
                  onChange={(e) => update({ terms: e.target.value })}
                  readOnly={(initialData?.docstatus ?? 0) === 1}
                  className={inputClass}
                  placeholder="Enter terms, conditions, or other notes…"
                />
              </div>
            </div>
          </div>
          )}

          {activeTab === "more_info" && (
          <div className="space-y-4">
            {/* Section 1: Print Settings — collapsed */}
            <CollapsibleSection
              title="Print Settings"
              defaultOpen={!!(
                form.letter_head ||
                form.select_print_heading ||
                form.group_same_items ||
                form.language
              )}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Letter Head</label>
                  <LinkSearchField
                    value={form.letter_head ?? ""}
                    onChange={(v) => update({ letter_head: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Letter Head", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Letter Head"
                    placeholder="Select letter head…"
                    clearIconMode="hover"
                  />
                </div>
                <div>
                  <label className={labelClass}>Print Heading</label>
                  <LinkSearchField
                    value={form.select_print_heading ?? ""}
                    onChange={(v) => update({ select_print_heading: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Print Heading", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Print Heading"
                    placeholder="Select print heading…"
                    clearIconMode="hover"
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
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="checkbox"
                  id="groupSameItems"
                  checked={!!form.group_same_items}
                  onChange={(e) => update({ group_same_items: e.target.checked ? 1 : 0 })}
                  disabled={(initialData?.docstatus ?? 0) === 1}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="groupSameItems" className="text-sm text-body">
                  Group Same Items
                </label>
              </div>
            </CollapsibleSection>

            {/* Section 2: Additional Info — collapsed */}
            <CollapsibleSection
              title="Additional Info"
              defaultOpen={!!(form.campaign || form.source || form.opportunity || form.status)}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Status</label>
                  <input
                    type="text"
                    value={form.status ?? "Draft"}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                {/* Desk additional_info_section order: status → customer_group
                    → territory → campaign → source → opportunity. */}
                {form.quotation_to === "Customer" && !!form.party_name && (
                  <div>
                    <label className={labelClass}>Customer Group</label>
                    <LinkSearchField
                      value={form.customer_group ?? ""}
                      onChange={(v) => update({ customer_group: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink(
                          "Customer Group",
                          q,
                          "Quotation",
                        )
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Customer Group", v)
                      }}
                      docType="Customer Group"
                      placeholder="Select customer group…"
                      clearIconMode="hover"
                      readOnly={rule("customer_group").readOnly}
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Territory</label>
                  <LinkSearchField
                    value={form.territory ?? ""}
                    onChange={(v) => update({ territory: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Territory", q, "Quotation")
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Territory", v)
                    }}
                    docType="Territory"
                    placeholder="Select territory…"
                    clearIconMode="hover"
                  />
                </div>
                <div>
                  <label className={labelClass}>Campaign</label>
                  <LinkSearchField
                    value={form.campaign ?? ""}
                    onChange={(v) => update({ campaign: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Campaign", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Campaign"
                    placeholder="Select campaign…"
                    clearIconMode="hover"
                  />
                </div>
                <div>
                  <label className={labelClass}>Source</label>
                  <LinkSearchField
                    value={form.source ?? ""}
                    onChange={(v) => update({ source: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Lead Source", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Lead Source"
                    placeholder="Select source…"
                    clearIconMode="hover"
                  />
                </div>
                <div>
                  <label className={labelClass}>Opportunity</label>
                  <LinkSearchField
                    value={form.opportunity ?? ""}
                    onChange={(v) => update({ opportunity: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Opportunity", q, "Quotation")
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Opportunity", v)
                    }}
                    docType="Opportunity"
                    placeholder="Select opportunity…"
                    clearIconMode="hover"
                    readOnly={!!form.opportunity}
                  />
                </div>
              </div>
            </CollapsibleSection>

            {/* Section 3: Lost Reasons — collapsed, shown once lost */}
            {(form.status === "Lost" ||
              (form.lost_reasons ?? []).length > 0 ||
              (form.competitors ?? []).length > 0) && (
              <CollapsibleSection title="Lost Reasons" defaultOpen>
                <div className="max-w-sm mb-3">
                  <label className={labelClass}>Detailed Reason</label>
                  <textarea
                    rows={3}
                    value={form.order_lost_reason ?? ""}
                    onChange={(e) => update({ order_lost_reason: e.target.value })}
                    className={inputClass}
                    placeholder="Detailed reason…"
                  />
                </div>
                {(form.lost_reasons ?? []).length > 0 && (
                  <ChildTableGrid<LostReasonRow>
                    title="Lost Reasons"
                    rows={form.lost_reasons ?? []}
                    columns={lostReasonColumns}
                    emptyRow={{ lost_reason: "" }}
                    onChange={() => undefined}
                    readOnly
                    minWidth="420px"
                  />
                )}
                {(form.competitors ?? []).length > 0 && (
                  <ChildTableGrid<CompetitorRow>
                    title="Competitors"
                    rows={form.competitors ?? []}
                    columns={competitorColumns}
                    emptyRow={{ competitor: "" }}
                    onChange={() => undefined}
                    readOnly
                    minWidth="420px"
                  />
                )}
              </CollapsibleSection>
            )}
          </div>
          )}
      </div>
    )
  },
)