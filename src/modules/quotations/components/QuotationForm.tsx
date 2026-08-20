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
  Checkbox,
  Input,
  LinkSearchField,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { useCompany } from "@/context/CompanyContext"
import { quotationService } from "@/modules/quotations/services"
import { customerService } from "@/modules/customers/services"
import {
  computeTaxes,
  createEmptyTaxRow,
  getCurrencySmallestFraction,
  roundToSmallestCurrencyFraction,
  type EditableTaxRow,
} from "@/modules/invoices/services"
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
import { formatCurrency } from "@/lib/utils"

const QUOTATION_TO_OPTIONS = ["Customer", "Lead", "Prospect"] as const
const ORDER_TYPE_OPTIONS = ["Sales", "Maintenance", "Shopping Cart"] as const

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

function createEmptyItem(): QuotationItem {
  return {
    item_name: "",
    item_code: "",
    qty: 1,
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
      if (!party || !form.company || !form.transaction_date) return
      update({ party_name: party, customer_name: "" })
      try {
        const details = await quotationService.getPartyDetails(
          form.quotation_to || "Customer",
          party,
          form.company,
          form.transaction_date,
          { fetchPaymentTermsTemplate: true },
        )
        setForm((prev) => ({
          ...prev,
          party_name: party,
          customer_name: details.customer_name ?? prev.customer_name,
          customer_group: details.customer_group ?? prev.customer_group,
          currency: details.currency ?? prev.currency,
          conversion_rate: details.conversion_rate ?? prev.conversion_rate,
          selling_price_list: details.selling_price_list ?? prev.selling_price_list,
          price_list_currency: details.price_list_currency ?? prev.price_list_currency,
          plc_conversion_rate: details.plc_conversion_rate ?? prev.plc_conversion_rate,
          tax_category: details.tax_category ?? prev.tax_category,
          taxes_and_charges: details.taxes_and_charges ?? prev.taxes_and_charges,
          payment_terms_template: details.payment_terms_template ?? prev.payment_terms_template,
          customer_address: details.customer_address ?? prev.customer_address,
          address_display: details.address_display ?? prev.address_display,
          contact_person: details.contact_person ?? prev.contact_person,
          contact_display: details.contact_display ?? prev.contact_display,
          contact_mobile: details.contact_mobile ?? prev.contact_mobile,
          contact_email: details.contact_email ?? prev.contact_email,
          shipping_address_name: details.shipping_address_name ?? prev.shipping_address_name,
          shipping_address: details.shipping_address ?? prev.shipping_address,
        }))
      } catch {
        // party details are a best-effort fill
      }
    }

    // ── Currency change → get_exchange_rate ────────────────────────────
    const handleCurrencyChange = async (currency: string) => {
      update({ currency })
      if (currency === companyCurrency) {
        update({ conversion_rate: 1, price_list_currency: companyCurrency, plc_conversion_rate: 1 })
        return
      }
      try {
        const rate = await quotationService.getExchangeRate(
          currency,
          companyCurrency,
          form.transaction_date || todayISO(),
        )
        setForm((prev) => ({
          ...prev,
          currency,
          conversion_rate: rate || prev.conversion_rate,
          price_list_currency: currency,
          plc_conversion_rate: rate || prev.plc_conversion_rate,
        }))
      } catch {
        // keep prior conversion rate on failure
      }
    }

    // ── Items ──────────────────────────────────────────────────────────
    const updateItem = (idx: number, item: QuotationItem) =>
      setForm((prev) => {
        const items = [...(prev.items ?? [])]
        items[idx] = item
        return { ...prev, items }
      })

    const handleItemCellChange = (idx: number, key: keyof QuotationItem, value: unknown) => {
      const item = { ...(form.items?.[idx] ?? createEmptyItem()) } as QuotationItem
      ;(item as Record<keyof QuotationItem, unknown>)[key] = value as QuotationItem[typeof key]
      switch (key) {
        case "qty":
        case "rate":
        case "discount_percentage":
          if (item.rate > 0 && item.qty > 0) {
            const discounted = item.rate - (item.rate * (item.discount_percentage || 0)) / 100
            item.amount = Math.round(discounted * item.qty * 100) / 100
          } else {
            item.amount = 0
          }
          break
        default:
          break
      }
      updateItem(idx, item)
    }

    const handleItemSelect = async (row: QuotationItem, itemCode: string) => {
      if (!itemCode || !form.company) return
      try {
        const details = await quotationService.getItemDetails(
          {
            item_code: itemCode,
            qty: form.items?.[form.items.indexOf(row)]?.qty ?? 1,
            price_list: form.selling_price_list,
            currency: form.currency,
          },
          form.company,
        )
        const idx = form.items?.indexOf(row)
        if (idx === undefined || idx < 0) return
        const next = { ...row, ...details } as QuotationItem
        next.amount = Math.round((next.rate ?? 0) * (next.qty ?? 0) * 100) / 100
        updateItem(idx, next)
      } catch {
        // item details are a best-effort fill
      }
    }

    // ── Taxes & totals ─────────────────────────────────────────────────
    const itemTotals = useMemo(() => {
      const items = form.items ?? []
      const total_qty = items.reduce((s, i) => s + (i.qty || 0), 0)
      const net_total = items.reduce((s, i) => s + (i.amount || 0), 0)
      return { total_qty, net_total }
    }, [form.items])

    const { total_qty, net_total } = itemTotals

    const taxState = useMemo(() => {
      const editable = quotationTaxesToEditable(form.taxes ?? [])
      const computed = computeTaxes(editable, net_total, total_qty)
      const total_taxes = computed.reduce((s, r) => s + r.tax_amount, 0)
      const grand_total = net_total + total_taxes
      return { editable, computed, total_taxes, grand_total }
    }, [form.taxes, net_total, total_qty])

    const rounded_total = roundToSmallestCurrencyFraction(
      taxState.grand_total,
      currencyFraction,
    )
    const rounding_adjustment = Math.round((rounded_total - taxState.grand_total) * 100) / 100
    const conversion_rate = form.conversion_rate ?? 1
    const base_grand_total = taxState.grand_total * conversion_rate
    const base_rounded_total = Math.round(base_grand_total * 100) / 100
    const base_total = Math.round(net_total * conversion_rate * 100) / 100
    const base_net_total = base_total
    const base_total_taxes_and_charges =
      Math.round(taxState.total_taxes * conversion_rate * 100) / 100
    const base_rounding_adjustment = Math.round((base_rounded_total - base_grand_total) * 100) / 100
    const base_discount_amount = Math.round((form.discount_amount ?? 0) * conversion_rate * 100) / 100

    const handleTaxChange = (rows: EditableTaxRow[]) => {
      update({ taxes: editableToQuotationTaxes(rows) })
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

    const itemColumns: GridColumn<QuotationItem>[] = [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await customerService.searchLink(
            "Item",
            q,
            "Quotation",
            { disabled: 0, has_variants: 0 },
          )
          return { items: results }
        },
        onSelect: (row, value) => {
          void handleItemSelect(row, value ?? "")
        },
        validate: async (v) => {
          await customerService.validateLink("Item", v)
        },
      },
      { key: "item_name", label: "Item Name", type: "readonly", weight: 2 },
      { key: "qty", label: "Qty", type: "number", align: "right" },
      {
        key: "uom",
        label: "UOM",
        type: "link",
        options: ["Nos", "Kg", "L", "Box", "Bag", "Dozen"],
      },
      { key: "conversion_factor", label: "Conv. Factor", type: "number", align: "right" },
      {
        key: "price_list_rate",
        label: "Price List Rate",
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.price_list_rate ?? 0),
      },
      { key: "rate", label: "Rate", type: "number", align: "right" },
      { key: "discount_percentage", label: "Disc %", type: "number", align: "right" },
      {
        key: "amount",
        label: "Amount",
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.amount ?? 0),
      },
      {
        key: "warehouse",
        label: "Warehouse",
        type: "link",
        docType: "Warehouse",
        searchFn: async (q) => {
          const results = await customerService.searchLink("Warehouse", q, "Quotation", {
            disabled: 0,
          })
          return { items: results }
        },
        validate: async (v) => customerService.validateLink("Warehouse", v),
      },
      { key: "delivery_date", label: "Delivery Date", type: "date" },
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
    const customerGroupVisible = rule("customer_group").visible

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
          total: net_total,
          base_total: net_total * conversion_rate,
          base_net_total: net_total * conversion_rate,
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

    const labelClass = "text-xs font-semibold text-muted"

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
      <>
        <Tabs defaultValue="sellings" className="w-full">
          <TabsList>
            <TabsTrigger value="sellings">Sellings</TabsTrigger>
            <TabsTrigger value="address">Address &amp; Contact</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="more_info">More Info</TabsTrigger>
          </TabsList>

          <TabsContent value="sellings" className="space-y-6">
            {/* ===== Customer section ===== */}
            <div className="pb-4 border-b border-border space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {mode === "create" && (
                  <Field label="Naming Series *" fieldname="naming_series">
                    <Select
                      value={form.naming_series ?? "SAL-QTN-.YYYY.-"}
                      onChange={(e) => update({ naming_series: e.target.value })}
                    >
                      <option value="SAL-QTN-.YYYY.-">SAL-QTN-.YYYY.-</option>
                    </Select>
                  </Field>
                )}
                <Field label="Quotation To *" fieldname="quotation_to">
                  <Select
                    value={form.quotation_to}
                    onChange={(e) =>
                      update({
                        quotation_to: e.target.value as Quotation["quotation_to"],
                        party_name: "",
                      })
                    }
                    disabled={rule("party_name").readOnly}
                  >
                    {QUOTATION_TO_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
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
                        await customerService.validateLink(form.quotation_to || "Customer", v)
                      }}
                      docType={form.quotation_to || "Customer"}
                      placeholder="Select party…"
                      readOnly={partyLocked}
                      required={rule("party_name").reqd}
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Transaction Date *" fieldname="transaction_date">
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
                <Field label="Order Type *" fieldname="order_type">
                  <Select
                    value={form.order_type}
                    onChange={(e) => update({ order_type: e.target.value })}
                  >
                    {ORDER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Company *" fieldname="company">
                  <LinkSearchField
                    value={form.company}
                    onChange={(v) => update({ company: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Company",
                        q,
                        "Quotation",
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Company", v)
                    }}
                    docType="Company"
                    placeholder="Search company…"
                  />
                </Field>
                {customerGroupVisible && (
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
              </div>
            </div>

            {/* ===== Currency & Price List ===== */}
            <CollapsibleSection title="Currency and Price List" defaultOpen>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Currency *" fieldname="currency">
                  <LinkSearchField
                    value={form.currency}
                    onChange={(v) => void handleCurrencyChange(v ?? "")}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Currency",
                        q,
                        "Quotation",
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Currency", v)
                    }}
                    docType="Currency"
                    placeholder="Search currency…"
                    required={rule("currency").reqd}
                  />
                </Field>
                <Field label="Conversion Rate *" fieldname="conversion_rate">
                  <Input
                    type="number"
                    step="any"
                    value={form.conversion_rate ?? 1}
                    onChange={(e) => update({ conversion_rate: Number(e.target.value) || 0 })}
                    readOnly={rule("conversion_rate").readOnly || !isForeignCurrency}
                  />
                </Field>
                <Field label="Selling Price List *" fieldname="selling_price_list">
                  <LinkSearchField
                    value={form.selling_price_list}
                    onChange={(v) => update({ selling_price_list: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink(
                        "Price List",
                        q,
                        "Quotation",
                      )
                      return { items: results }
                    }}
                    validate={async (v) => {
                      await customerService.validateLink("Price List", v)
                    }}
                    docType="Price List"
                    placeholder="Search price list…"
                    required={rule("selling_price_list").reqd}
                  />
                </Field>
                <Field label="Price List Currency *" fieldname="price_list_currency">
                  <Input value={form.price_list_currency} readOnly />
                </Field>
                <Field label="PLC Conversion Rate *" fieldname="plc_conversion_rate">
                  <Input
                    type="number"
                    step="any"
                    value={form.plc_conversion_rate ?? 1}
                    onChange={(e) => update({ plc_conversion_rate: Number(e.target.value) || 0 })}
                  />
                </Field>
              </div>
            </CollapsibleSection>

            {/* ===== Items ===== */}
            <div className="pb-4 border-b border-border">
              <div className="mb-3">
                <h3 className="text-base font-bold text-heading">Items *</h3>
              </div>
              <ChildTableGrid<QuotationItem>
                title=""
                noTopBorder
                rows={form.items ?? []}
                columns={itemColumns}
                emptyRow={createEmptyItem()}
                onChange={(rows) => update({ items: rows })}
                onCellChange={handleItemCellChange}
                canAdd={mode === "create" || (initialData?.docstatus ?? 0) !== 1}
                readOnly={(initialData?.docstatus ?? 0) === 1}
                minWidth="760px"
                testId="quotation-items"
              />
            </div>

            {/* ===== Taxes & Charges + Totals ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <div>
                    <label className={labelClass}>Taxes and Charges Template</label>
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
                </div>
                <ChildTableGrid<EditableTaxRow>
                  title=""
                  noTopBorder
                  rows={taxState.editable}
                  columns={taxColumns}
                  emptyRow={createEmptyTaxRow()}
                  onChange={handleTaxChange}
                  readOnly={(initialData?.docstatus ?? 0) === 1}
                  minWidth="720px"
                />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-border">
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
                  <Field label="Named Place" fieldname="named_place">
                    <Input
                      value={form.named_place ?? ""}
                      onChange={(e) => update({ named_place: e.target.value })}
                      readOnly={!form.incoterm}
                    />
                  </Field>
                </div>
              </div>

              <div className="lg:col-span-2 space-y-2">
                <h3 className="text-base font-bold text-heading mb-2">
                  Totals ({form.currency || companyCurrency})
                </h3>
                {rule("total_qty").visible && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Total Quantity</span>
                    <span className="font-semibold text-heading tabular-nums">{total_qty}</span>
                  </div>
                )}
                {rule("total_net_weight").visible && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Total Net Weight</span>
                    <span className="font-semibold text-heading tabular-nums">
                      {form.total_net_weight ?? 0}
                    </span>
                  </div>
                )}
                {isForeignCurrency && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Base Total ({companyCurrency})</span>
                      <span className="text-body tabular-nums">
                        {formatCurrency(base_total)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Base Net Total ({companyCurrency})</span>
                      <span className="text-body tabular-nums">
                        {formatCurrency(base_net_total)}
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Net Total</span>
                  <span className="font-semibold text-heading tabular-nums">
                    {formatCurrency(net_total)}
                  </span>
                </div>
                {isForeignCurrency && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Base Taxes ({companyCurrency})</span>
                    <span className="text-body tabular-nums">
                      {formatCurrency(base_total_taxes_and_charges)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Taxes</span>
                  <span className="text-body tabular-nums">
                    {formatCurrency(taxState.total_taxes)}
                  </span>
                </div>
                {isForeignCurrency && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Base Grand Total ({companyCurrency})</span>
                    <span className="text-body tabular-nums">
                      {formatCurrency(base_grand_total)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base border-t border-border pt-2">
                  <span className="font-bold text-heading">Grand Total</span>
                  <span className="font-bold text-heading tabular-nums">
                    {formatCurrency(taxState.grand_total)}
                  </span>
                </div>
                {isForeignCurrency && rule("base_rounding_adjustment").visible && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Base Rounding Adj. ({companyCurrency})</span>
                    <span className="text-body tabular-nums">
                      {formatCurrency(base_rounding_adjustment)}
                    </span>
                  </div>
                )}
                {rule("rounding_adjustment").visible && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Rounding Adjustment</span>
                    <span className="text-body tabular-nums">
                      {formatCurrency(rounding_adjustment)}
                    </span>
                  </div>
                )}
                {isForeignCurrency && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Base Rounded Total ({companyCurrency})</span>
                    <span className="text-body tabular-nums">
                      {formatCurrency(base_rounded_total)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Rounded Total</span>
                  <span className="font-semibold text-heading tabular-nums">
                    {formatCurrency(rounded_total)}
                  </span>
                </div>
                {rule("base_in_words").visible && isForeignCurrency && (
                  <div className="text-xs text-muted italic pt-1">
                    {form.base_in_words}
                  </div>
                )}
                {rule("in_words").visible && (
                  <div className="text-xs text-body italic pt-1">{form.in_words}</div>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    checked={!!form.disable_rounded_total}
                    onCheckedChange={(checked) =>
                      update({ disable_rounded_total: checked ? 1 : 0 })
                    }
                    disabled={(initialData?.docstatus ?? 0) === 1}
                    id="disableRoundedTotal"
                  />
                  <label className={labelClass} htmlFor="disableRoundedTotal">
                    Disable Rounded Total
                  </label>
                </div>
              </div>
            </div>

            {/* ===== Additional Discount ===== */}
            <CollapsibleSection title="Additional Discount">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Apply Discount On" fieldname="apply_discount_on">
                  <Select
                    value={form.apply_discount_on ?? ""}
                    onChange={(e) => update({ apply_discount_on: e.target.value || undefined })}
                  >
                    <option value="">—</option>
                    <option value="Grand Total">Grand Total</option>
                    <option value="Net Total">Net Total</option>
                  </Select>
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
                <Field label="Additional Discount (%)" fieldname="additional_discount_percentage">
                  <Input
                    type="number"
                    step="any"
                    value={form.additional_discount_percentage ?? ""}
                    onChange={(e) =>
                      update({ additional_discount_percentage: Number(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field label="Discount Amount" fieldname="discount_amount">
                  <Input
                    type="number"
                    step="any"
                    value={form.discount_amount ?? ""}
                    onChange={(e) => update({ discount_amount: Number(e.target.value) || 0 })}
                    readOnly={rule("discount_amount").readOnly}
                  />
                </Field>
                <Field label={`Base Discount Amount (${companyCurrency})`} fieldname="base_discount_amount">
                  <Input type="number" step="any" value={base_discount_amount || ""} readOnly />
                </Field>
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
          </TabsContent>

          <TabsContent value="address" className="space-y-6">
            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">Address</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field
                  label={`${form.quotation_to || "Party"} Address`}
                  fieldname="customer_address"
                >
                  <LinkSearchField
                    value={form.customer_address ?? ""}
                    onChange={(v) => update({ customer_address: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Address", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Address"
                    placeholder="Select address…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Address Display" fieldname="address_display">
                  <Textarea
                    rows={4}
                    value={form.address_display ?? ""}
                    onChange={(e) => update({ address_display: e.target.value })}
                    readOnly
                  />
                </Field>
                <Field label="Shipping Address" fieldname="shipping_address_name">
                  <LinkSearchField
                    value={form.shipping_address_name ?? ""}
                    onChange={(v) => update({ shipping_address_name: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Address", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Address"
                    placeholder="Select shipping address…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Shipping Address Display" fieldname="shipping_address">
                  <Textarea
                    rows={4}
                    value={form.shipping_address ?? ""}
                    onChange={(e) => update({ shipping_address: e.target.value })}
                    readOnly
                  />
                </Field>
                <Field label="Company Address" fieldname="company_address">
                  <LinkSearchField
                    value={form.company_address ?? ""}
                    onChange={(v) => update({ company_address: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Address", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Address"
                    placeholder="Select company address…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Company Address Display" fieldname="company_address_display">
                  <Textarea
                    rows={4}
                    value={form.company_address_display ?? ""}
                    onChange={(e) => update({ company_address_display: e.target.value })}
                    readOnly
                  />
                </Field>
              </div>
            </div>

            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">Contact</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Field label="Contact Person" fieldname="contact_person">
                  <LinkSearchField
                    value={form.contact_person ?? ""}
                    onChange={(v) => update({ contact_person: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Contact", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Contact"
                    placeholder="Select contact…"
                    clearIconMode="hover"
                  />
                </Field>
                <Field label="Contact Display" fieldname="contact_display">
                  <Input value={form.contact_display ?? ""} readOnly />
                </Field>
                <Field label="Contact Mobile" fieldname="contact_mobile">
                  <Input value={form.contact_mobile ?? ""} readOnly />
                </Field>
                <Field label="Contact Email" fieldname="contact_email">
                  <Input value={form.contact_email ?? ""} readOnly />
                </Field>
                <Field label="Company Contact Person" fieldname="company_contact_person">
                  <LinkSearchField
                    value={form.company_contact_person ?? ""}
                    onChange={(v) => update({ company_contact_person: v ?? "" })}
                    searchFn={async (q) => {
                      const results = await customerService.searchLink("Contact", q, "Quotation")
                      return { items: results }
                    }}
                    docType="Contact"
                    placeholder="Select company contact…"
                    clearIconMode="hover"
                  />
                </Field>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="terms" className="space-y-6">
            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">Payment Terms</h3>
              <div>
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
                noTopBorder
                rows={form.payment_schedule ?? []}
                columns={paymentScheduleColumns}
                emptyRow={{ payment_term: "", description: "", due_date: "", invoice_portion: 0, payment_amount: 0 }}
                onChange={(rows) => update({ payment_schedule: rows })}
                readOnly={(initialData?.docstatus ?? 0) === 1}
                minWidth="720px"
              />
            </div>

            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">Terms and Conditions</h3>
              <div className="lg:max-w-xl">
                <label className={labelClass}>Terms Template</label>
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
              <Field label="Terms" fieldname="terms">
                <Textarea
                  rows={5}
                  value={form.terms ?? ""}
                  onChange={(e) => update({ terms: e.target.value })}
                  readOnly={(initialData?.docstatus ?? 0) === 1}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="more_info" className="space-y-6">
            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">Printing &amp; Language</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Letter Head" fieldname="letter_head">
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
                </Field>
                <Field label="Print Heading" fieldname="select_print_heading">
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
                </Field>
                <Field label="Language" fieldname="language">
                  <Input
                    value={form.language ?? ""}
                    onChange={(e) => update({ language: e.target.value })}
                    readOnly
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={!!form.group_same_items}
                  onCheckedChange={(checked) => update({ group_same_items: checked ? 1 : 0 })}
                  disabled={(initialData?.docstatus ?? 0) === 1}
                  id="groupSameItems"
                />
                <label className={labelClass} htmlFor="groupSameItems">
                  Group Same Items
                </label>
              </div>
            </div>

            {(form.status === "Lost" ||
              (form.lost_reasons ?? []).length > 0 ||
              (form.competitors ?? []).length > 0) && (
              <div className="pb-4 border-b border-border space-y-4">
                <h3 className="text-base font-bold text-heading">Lost</h3>
                <div className="lg:max-w-xl">
                  <Field label="Order Lost Reason" fieldname="order_lost_reason">
                    <LinkSearchField
                      value={form.order_lost_reason ?? ""}
                      onChange={(v) => update({ order_lost_reason: v ?? "" })}
                      searchFn={async (q) => {
                        const results = await customerService.searchLink("Lost Reason", q, "Quotation")
                        return { items: results }
                      }}
                      validate={async (v) => {
                        await customerService.validateLink("Lost Reason", v)
                      }}
                      docType="Lost Reason"
                      placeholder="Select lost reason…"
                      clearIconMode="hover"
                    />
                  </Field>
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
              </div>
            )}

            <div className="pb-4 border-b border-border space-y-4">
              <h3 className="text-base font-bold text-heading">More Information</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Field label="Campaign" fieldname="campaign">
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
                </Field>
                <Field label="Source" fieldname="source">
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
                </Field>
                <Field label="Opportunity" fieldname="opportunity">
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
                </Field>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </>
    )
  },
)