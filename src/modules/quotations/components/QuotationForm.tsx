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
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
    const navigate = useNavigate()
    const { companyDefaults } = useCompany()

    const companyCurrency = companyDefaults?.currency || "CAD"
    const defaultCompany = companyDefaults?.company || ""
    const defaultPriceList = companyDefaults?.defaultSellingPriceList || "Standard Selling"

    const buildEmptyForm = (): QuotationFormData => ({
      doctype: "Quotation",
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
      { key: "rate", label: "Rate", type: "number", align: "right" },
      { key: "discount_percentage", label: "Disc %", type: "number", align: "right" },
      {
        key: "amount",
        label: "Amount",
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.amount ?? 0),
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
      { key: "rate", label: "Rate", type: "number", align: "right" },
      { key: "tax_amount", label: "Amount", type: "number", align: "right" },
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/quotations")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">
                {mode === "create" ? "New Quotation" : `Quotation ${initialData?.name ?? ""}`}
              </h1>
              <p className="text-sm text-muted mt-0.5">
                {mode === "create" ? "Create a new customer quotation." : "Update an existing quotation."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/quotations")}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} data-testid="quotation-save">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : mode === "create" ? "Save Draft" : "Save"}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="sellings" className="w-full">
          <TabsList>
            <TabsTrigger value="sellings">Sellings</TabsTrigger>
            <TabsTrigger value="address">Address &amp; Contact</TabsTrigger>
            <TabsTrigger value="terms">Terms</TabsTrigger>
            <TabsTrigger value="more_info">More Info</TabsTrigger>
          </TabsList>

          <TabsContent value="sellings" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Party</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="Quotation To" fieldname="quotation_to">
                <Select
                  value={form.quotation_to}
                  onChange={(e) => update({ quotation_to: e.target.value as Quotation["quotation_to"], party_name: "" })}
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
                  <label className={labelClass}>{partyLabel}</label>
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
              {customerGroupVisible && (
                <div>
                  <label className={labelClass}>Customer Group</label>
                  <Input
                    value={form.customer_group ?? ""}
                    onChange={(e) => update({ customer_group: e.target.value })}
                    readOnly={rule("customer_group").readOnly}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates & Company</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Transaction Date" fieldname="transaction_date">
                  <Input
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => update({ transaction_date: e.target.value })}
                  />
                </Field>
                <Field label="Valid Till" fieldname="valid_till">
                  <Input
                    type="date"
                    value={form.valid_till}
                    onChange={(e) => update({ valid_till: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Order Type" fieldname="order_type">
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
              <Field label="Company" fieldname="company">
                <Input
                  value={form.company}
                  onChange={(e) => update({ company: e.target.value })}
                />
              </Field>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Currency & Price List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Field label="Currency" fieldname="currency">
                <Select
                  value={form.currency}
                  onChange={(e) => void handleCurrencyChange(e.target.value)}
                >
                  <option value="CAD">CAD — Canadian Dollar</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                </Select>
              </Field>
              <Field label="Conversion Rate" fieldname="conversion_rate">
                <Input
                  type="number"
                  step="any"
                  value={form.conversion_rate ?? 1}
                  onChange={(e) => update({ conversion_rate: Number(e.target.value) || 0 })}
                  readOnly={!isForeignCurrency}
                />
              </Field>
              <Field label="Selling Price List" fieldname="selling_price_list">
                <Input
                  value={form.selling_price_list}
                  onChange={(e) => update({ selling_price_list: e.target.value })}
                />
              </Field>
              <Field label="Price List Currency" fieldname="price_list_currency">
                <Input value={form.price_list_currency} readOnly />
              </Field>
              <Field label="PLC Conversion Rate" fieldname="plc_conversion_rate">
                <Input type="number" step="any" value={form.plc_conversion_rate ?? 1} readOnly />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card className="p-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
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
              minWidth="960px"
              testId="quotation-items"
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <Card className="lg:col-span-3 p-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Taxes and Charges</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Totals({form.currency || companyCurrency})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rule("total_qty").visible && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total Quantity</span>
                  <span className="font-semibold text-heading tabular-nums">{total_qty}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Net Total</span>
                <span className="font-semibold text-heading tabular-nums">
                  {formatCurrency(net_total)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Taxes</span>
                <span className="text-body tabular-nums">
                  {formatCurrency(taxState.total_taxes)}
                </span>
              </div>
              <div className="flex justify-between text-base border-t border-border pt-2">
                <span className="font-bold text-heading">Grand Total</span>
                <span className="font-bold text-heading tabular-nums">
                  {formatCurrency(taxState.grand_total)}
                </span>
              </div>
              {rule("rounding_adjustment").visible && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Rounding Adjustment</span>
                  <span className="text-body tabular-nums">{formatCurrency(rounding_adjustment)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted">Rounded Total</span>
                <span className="font-semibold text-heading tabular-nums">
                  {formatCurrency(rounded_total)}
                </span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  checked={!!form.disable_rounded_total}
                  onCheckedChange={(checked) =>
                    update({ disable_rounded_total: checked ? 1 : 0 })
                  }
                  disabled={(initialData?.docstatus ?? 0) === 1}
                />
                <label className={labelClass}>Disable Rounded Total</label>
              </div>
              {isForeignCurrency && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Base Grand Total ({companyCurrency})</span>
                  <span className="font-semibold text-heading tabular-nums">
                    {formatCurrency(base_grand_total)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </TabsContent>

          <TabsContent value="address" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Address</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Field label={`${form.quotation_to || "Party"} Address`} fieldname="customer_address">
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
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Field label="Contact Mobile" fieldname="contact_mobile">
                    <Input value={form.contact_mobile ?? ""} readOnly />
                  </Field>
                  <Field label="Contact Email" fieldname="contact_email">
                    <Input value={form.contact_email ?? ""} readOnly />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="terms" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Terms and Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="more_info" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Printing &amp; Language</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                  />
                  <label className={labelClass}>Group Same Items</label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>More Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
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
                      docType="Opportunity"
                      placeholder="Select opportunity…"
                      clearIconMode="hover"
                    />
                  </Field>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </>
    )
  },
)