"use client"

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { Link2, ArrowRight, AlertCircle } from "lucide-react"
import { DateInput, Input, LinkSearchField, CollapsibleSection, Button, Modal, ModalFooter } from "@/components/ui"
import { Combobox, inputClass, labelClass } from "@/components/ui/form-fields"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"
import { useLazyOptions } from "@/services/lookup-cache"
import { useDocstatusLock } from "@/hooks/useDocstatusLock"
import { billService, type PurchaseInvoiceDoc, type PurchaseInvoiceItemForm, type PurchaseInvoiceTaxFormRow, type PurchaseInvoiceFormData } from "@/services"
import { formatCurrency, todayISO as localTodayISO } from "@/lib/utils"

const DEFAULT_COMPANY = "Bless Erp"
const FALLBACK_CURRENCIES = ["CAD", "USD", "EUR"]
const FALLBACK_PRICE_LISTS = ["Standard Buying", "Standard Selling"]
const FALLBACK_WAREHOUSES = ["Main Warehouse", "Cold Storage"]
const FALLBACK_COST_CENTERS = ["Main - BE", "Operations - BE", "Sales - BE"]

const round2 = (value: number): number => Math.round(value * 100) / 100

function rand(): string {
  return Math.random().toString(36).slice(2, 10)
}

function todayISO(): string {
  return localTodayISO()
}

function addDaysISO(days: number): string {
  return localTodayISO(days)
}

function createEmptyItem(warehouse = ""): PurchaseInvoiceItemForm {
  return {
    name: `new-purchase-invoice-item-${rand()}`,
    item_code: "",
    item_name: "",
    uom: "Nos",
    conversion_factor: 1,
    qty: 1,
    price_list_rate: 0,
    rate: 0,
    amount: 0,
    discount_percentage: 0,
    warehouse: warehouse || undefined,
  }
}

function createDefaultTaxRows(): PurchaseInvoiceTaxFormRow[] {
  return [
    {
      name: `new-purchase-invoice-tax-${rand()}`,
      charge_type: "On Net Total",
      account_head: "GST - BE",
      rate: 13,
      tax_amount: 0,
      total: 0,
      description: "GST 13%",
      included_in_print_rate: 0,
    },
  ]
}

const TAX_TEMPLATE_OPTIONS = ["PTC - Default", "PTC - Zero Rated"]

function templateTaxRows(template: string | undefined): PurchaseInvoiceTaxFormRow[] | null {
  if (!template) return null
  if (template === "PTC - Zero Rated") {
    return [
      {
        name: `new-purchase-invoice-tax-${rand()}`,
        charge_type: "On Net Total",
        account_head: "GST - BE",
        rate: 0,
        tax_amount: 0,
        total: 0,
        description: "Zero Rated",
        included_in_print_rate: 0,
      },
    ]
  }
  return createDefaultTaxRows()
}

const BASE_CURRENCY = "CAD"

interface PurchaseInvoicePaymentScheduleRow {
  name?: string
  payment_term?: string
  description?: string
  due_date?: string
  invoice_portion?: number
  payment_amount?: number
  [key: string]: unknown
}

const paymentScheduleColumns: GridColumn<PurchaseInvoicePaymentScheduleRow>[] = [
  { key: "payment_term", label: "Payment Term", type: "text" },
  { key: "description", label: "Description", type: "text" },
  { key: "due_date", label: "Due Date", type: "date" },
  { key: "invoice_portion", label: "Invoice Portion", type: "number", align: "right" },
  { key: "payment_amount", label: "Payment Amount", type: "number", align: "right" },
]

export interface PurchaseInvoiceFormHandle {
  save: (action?: "Save" | "Submit") => Promise<string | undefined>
  isDirty: () => boolean
}

export interface PurchaseInvoiceFormProps {
  doc?: PurchaseInvoiceDoc | null
  mode?: "create" | "edit"
  onSaved?: (doc: PurchaseInvoiceDoc | null) => void
  onDirtyChange?: (dirty: boolean) => void
}

export default forwardRef<PurchaseInvoiceFormHandle, PurchaseInvoiceFormProps>(
  function PurchaseInvoiceForm({ doc: initialData, mode = initialData ? "edit" : "create", onSaved, onDirtyChange }, ref) {
    const buildEmptyForm = (): PurchaseInvoiceFormData => ({
      doctype: "Purchase Invoice",
      naming_series: "ACC-PINV-.YYYY.-",
      supplier: "",
      supplier_name: "",
      posting_date: todayISO(),
      due_date: addDaysISO(15),
      company: DEFAULT_COMPANY,
      currency: "CAD",
      conversion_rate: 1,
      buying_price_list: "Standard Buying",
      price_list_currency: "CAD",
      plc_conversion_rate: 1,
      set_warehouse: "Main Warehouse",
      items: [createEmptyItem("Main Warehouse")],
      taxes: createDefaultTaxRows(),
      payment_schedule: [],
      total_qty: 0,
      total: 0,
      net_total: 0,
      total_taxes_and_charges: 0,
      grand_total: 0,
      rounded_total: 0,
      discount_amount: 0,
      outstanding_amount: 0,
      paid_amount: 0,
      docstatus: 0,
      status: "Draft",
    })

    const [form, setForm] = useState<PurchaseInvoiceFormData>(() =>
      initialData ? ({ ...initialData } as PurchaseInvoiceFormData) : buildEmptyForm(),
    )
    const [baseline, setBaseline] = useState<PurchaseInvoiceFormData>(() =>
      initialData ? ({ ...initialData } as PurchaseInvoiceFormData) : buildEmptyForm(),
    )
    const baselineRef = useRef<PurchaseInvoiceFormData>(baseline)
    const formRef = useRef(form)
    useEffect(() => {
      formRef.current = form
    }, [form])

    // Get Items From Purchase Order modal state
    const [getItemsOpen, setGetItemsOpen] = useState(false)
    const [selectedPO, setSelectedPO] = useState("")
    const [mapping, setMapping] = useState(false)
    const [mapError, setMapError] = useState("")

    const companies = useLazyOptions<string[]>(
      "purchase-invoice:companies",
      billService.lookups.companies,
      [],
    )
    const currencies = useLazyOptions<string[]>(
      "purchase-invoice:currencies",
      billService.lookups.currencies,
      [],
    )
    const priceLists = useLazyOptions<string[]>(
      "purchase-invoice:price-lists",
      billService.lookups.buyingPriceLists,
      [],
    )
    const warehouses = useLazyOptions<string[]>(
      "purchase-invoice:warehouses",
      billService.lookups.warehouses,
      [],
    )
    const costCenters = useLazyOptions<string[]>(
      "purchase-invoice:cost-centers",
      billService.lookups.costCenters,
      [],
    )

    useEffect(() => {
      if (initialData) {
        const next: PurchaseInvoiceFormData = {
          ...initialData,
          items: Array.isArray(initialData.items) ? initialData.items.map((r) => ({ ...r } as PurchaseInvoiceItemForm)) : [createEmptyItem(initialData.set_warehouse)],
          taxes: Array.isArray(initialData.taxes) ? initialData.taxes.map((r) => ({ ...r } as PurchaseInvoiceTaxFormRow)) : createDefaultTaxRows(),
        } as PurchaseInvoiceFormData
        setForm(next)
        setBaseline(next)
        baselineRef.current = next
      }
    }, [initialData])

    const currencyOptions = useMemo(
      () => Array.from(new Set([...(currencies.value || []), ...FALLBACK_CURRENCIES])),
      [currencies.value],
    )
    const priceListOptions = useMemo(
      () => Array.from(new Set([...(priceLists.value || []), ...FALLBACK_PRICE_LISTS])),
      [priceLists.value],
    )
    const warehouseOptions = useMemo(
      () => Array.from(new Set([...(warehouses.value || []), ...FALLBACK_WAREHOUSES])),
      [warehouses.value],
    )
    const costCenterOptions = useMemo(
      () => Array.from(new Set([...(costCenters.value || []), ...FALLBACK_COST_CENTERS])),
      [costCenters.value],
    )
    const companyOptions = useMemo(
      () => Array.from(new Set([...(companies.value || []), DEFAULT_COMPANY])),
      [companies.value],
    )

    const update = (patch: Partial<PurchaseInvoiceFormData>) => setForm((prev) => ({ ...prev, ...patch }))

    const isDirty = () => JSON.stringify(formRef.current) !== JSON.stringify(baselineRef.current)
    useEffect(() => {
      onDirtyChange?.(isDirty())
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form, baseline])

    const handleSupplierSelect = async (party: string) => {
      update({ supplier: party, supplier_name: party })
      if (!party) {
        update({ supplier: "", supplier_name: "" })
        return
      }
      try {
        const res = await billService.getValue("Supplier", "supplier_name", { name: party })
        const name = typeof res.supplier_name === "string" && res.supplier_name.trim() ? res.supplier_name : party
        if (formRef.current.supplier === party) update({ supplier_name: name })
      } catch {
        // keep the code as the display name
      }
    }

    const handleItemsChange = (next: PurchaseInvoiceItemForm[]) => {
      const items = next.map((row) => {
        const qty = Number(row.qty) || 0
        const rate = Number(row.rate) || 0
        const amount = round2(qty * rate)
        return Math.abs((row.amount ?? 0) - amount) > 0.001 ? { ...row, qty, rate, amount } : row
      })
      update({ items })
    }

    const handleTaxesChange = (next: PurchaseInvoiceTaxFormRow[]) => {
      update({ taxes: next })
    }

    // Currency → exchange rate (buying: base = company currency CAD).
    const handleCurrencyChange = (currency: string) => {
      const effective = currency || BASE_CURRENCY
      update({
        currency: effective,
        price_list_currency: effective,
        conversion_rate: effective === BASE_CURRENCY ? 1 : (form.conversion_rate ?? 1),
        plc_conversion_rate: effective === BASE_CURRENCY ? 1 : (form.plc_conversion_rate ?? 1),
      })
      if (!effective || effective === BASE_CURRENCY) return
      void billService
        .getExchangeRate(effective, BASE_CURRENCY, form.posting_date || todayISO())
        .then((rate) => {
          if (rate > 0 && formRef.current.currency === effective) {
            update({ conversion_rate: rate, plc_conversion_rate: rate })
          }
        })
        .catch(() => null)
    }

    // Item code selection → erpnext.stock.get_item_details (buying): enrich the
    // selected row with description / rate / warehouse / expense account.
    const handleItemSelect = async (row: PurchaseInvoiceItemForm, itemCode: string) => {
      if (!itemCode) return
      const args: Record<string, unknown> = {
        item_code: itemCode,
        doctype: "Purchase Invoice",
        company: form.company || DEFAULT_COMPANY,
        conversion_rate: form.conversion_rate ?? 1,
        transaction_date: form.posting_date || todayISO(),
        posting_date: form.posting_date || todayISO(),
        price_list: form.buying_price_list || "Standard Buying",
        qty: Number(row.qty ?? 1) || 1,
        uom: row.uom || "Nos",
        warehouse: row.warehouse || form.set_warehouse || "",
        cost_center: form.cost_center || "",
      }
      const details = await billService.getItemDetailsDesk(formRef.current as unknown as Record<string, unknown>, args)
      if (!details) return
      const nextItems = (formRef.current.items ?? []).map((r) => {
        if (r.name !== row.name) return r
        const qty = Number(details.qty ?? r.qty ?? 1) || 1
        const rate = Number(details.rate ?? r.rate ?? 0) || 0
        return {
          ...r,
          item_code: itemCode,
          item_name: String(details.item_name ?? r.item_name ?? ""),
          description:
            typeof details.description === "string" && details.description ? details.description : r.description,
          uom: String(details.uom ?? r.uom ?? "Nos"),
          conversion_factor: Number(details.conversion_factor) || 1,
          price_list_rate: Number(details.price_list_rate ?? rate) || 0,
          rate,
          amount: round2(qty * rate),
          warehouse: String(details.warehouse ?? r.warehouse ?? ""),
          cost_center: String(details.cost_center ?? r.cost_center ?? ""),
          expense_account: String(details.expense_account ?? r.expense_account ?? ""),
        }
      })
      update({ items: nextItems })
    }

    const computedGrandTotal = () => {
      const items = formRef.current.items ?? []
      const net = round2(items.reduce((s, i) => s + (Number(i.amount) || 0), 0))
      const taxes = round2((formRef.current.taxes ?? []).reduce((s, t) => s + (Number(t.tax_amount) || 0), 0))
      return round2(net + taxes)
    }

    // Payment terms template → get_payment_terms → payment schedule.
    const handlePaymentTermsSelect = async (template: string) => {
      update({ payment_terms_template: template })
      if (!template) return
      try {
        const result = await billService.getPaymentTerms(template, form.posting_date || todayISO(), computedGrandTotal())
        if (result.payment_schedule.length > 0) {
          update({ payment_schedule: result.payment_schedule })
        }
      } catch {
        // payment terms fill is best-effort
      }
    }

    // Terms & conditions → get_terms_and_conditions.
    const handleTcNameSelect = async (template: string) => {
      update({ tc_name: template, terms: "" })
      if (!template) return
      try {
        const docCtx: Record<string, unknown> = {
          doctype: "Purchase Invoice",
          posting_date: form.posting_date || todayISO(),
          due_date: form.due_date ?? "",
          company: form.company ?? "",
          supplier: form.supplier ?? "",
          supplier_name: form.supplier_name ?? "",
        }
        const rendered = await billService.getTerms(template, docCtx)
        if (rendered) update({ terms: rendered })
      } catch {
        // terms fill is best-effort
      }
    }

    // ── Get Items From Purchase Order (open_mapped_doc → prefilled PI) ──
    const handleMapItems = async () => {
      if (!selectedPO) {
        setMapError("Select a purchase order first.")
        return
      }
      setMapping(true)
      setMapError("")
      try {
        const mapped = await billService.getItemsFromPurchaseOrder(selectedPO)
        const rows = (Array.isArray(mapped?.items) ? mapped.items : []).map((it) => ({
          name: `new-purchase-invoice-item-${rand()}`,
          item_code: String(it.item_code ?? ""),
          item_name: String(it.item_name ?? it.item_code ?? ""),
          uom: String(it.uom ?? "Nos"),
          conversion_factor: Number(it.conversion_factor) || 1,
          qty: Number(it.qty) || 0,
          rate: Number(it.rate) || 0,
          amount: Number(it.amount) || 0,
          warehouse: formRef.current.set_warehouse,
          cost_center: formRef.current.cost_center,
          purchase_order: selectedPO,
          purchase_order_item: String(it.purchase_order_item ?? ""),
        }))
        if (rows.length === 0) {
          setMapError("No items to get from the selected purchase order.")
          return
        }
        update({
          ...(mapped?.supplier ? { supplier: mapped.supplier, supplier_name: mapped.supplier_name || mapped.supplier } : {}),
          ...(mapped?.company ? { company: mapped.company } : {}),
          ...(mapped?.currency ? { currency: mapped.currency, price_list_currency: mapped.currency } : {}),
          purchase_order: selectedPO,
          items: rows,
        })
        setGetItemsOpen(false)
        setSelectedPO("")
      } catch (err) {
        setMapError(err instanceof Error ? err.message : "Failed to get items from the purchase order.")
      } finally {
        setMapping(false)
      }
    }

    const itemColumns: GridColumn<PurchaseInvoiceItemForm>[] = [
      {
        key: "item_code",
        label: "Item Code",
        type: "link",
        docType: "Item",
        searchFn: async (q) => {
          const results = await billService.searchLink("Item", q, "Purchase Invoice").catch(() => [])
          return {
            items: results.map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })),
          }
        },
        validate: async (v) => {
          await billService.validateLink("Item", v)
        },
        onSelect: (row, v) => void handleItemSelect(row, v),
        placeholder: "Search item…",
      },
      { key: "item_name", label: "Item Name", type: "text", placeholder: "Item name…" },
      { key: "uom", label: "UOM", type: "text" },
      {
        key: "qty",
        label: "Qty",
        type: "number",
        align: "right",
        formatter: (row) => String(row.qty ?? 0),
      },
      {
        key: "rate",
        label: `Rate (${form.currency || "CAD"})`,
        type: "number",
        align: "right",
        prefix: "$",
        formatter: (row) => formatCurrency(row.rate ?? 0),
      },
      {
        key: "amount",
        label: `Amount (${form.currency || "CAD"})`,
        type: "readonly",
        align: "right",
        formatter: (row) => formatCurrency(row.amount ?? 0),
      },
    ]

    const totals = useMemo(() => {
      const items = form.items ?? []
      const total_qty = items.reduce((s, i) => s + (Number(i.qty) || 0), 0)
      const net_total = round2(items.reduce((s, i) => s + (Number(i.amount) || 0), 0))
      const taxes = (form.taxes ?? []).map((tax) => {
        const rate = Number(tax.rate) || 0
        const tax_amount = tax.charge_type === "On Net Total" ? round2(net_total * (rate / 100)) : (Number(tax.tax_amount) || 0)
        return { ...tax, tax_amount, total: net_total + tax_amount }
      })
      const total_taxes_and_charges = round2(taxes.reduce((s, t) => s + (t.tax_amount || 0), 0))
      const grand_total = round2(net_total + total_taxes_and_charges)
      return { total_qty, net_total, taxes, total_taxes_and_charges, grand_total }
    }, [form.items, form.taxes])

    const handleSave = async (action?: "Save" | "Submit"): Promise<string | undefined> => {
      if (mode === "edit" && (initialData?.docstatus ?? 0) === 1 && action === "Submit") {
        throw new Error("This Purchase Invoice is already submitted.")
      }
      const items = (form.items ?? []).filter(
        (r) => (r.item_code || "").trim() || (r.item_name || "").trim(),
      )
      if (items.length === 0) {
        throw new Error("Add at least one item before saving.")
      }
      if (!form.supplier) {
        throw new Error("Supplier is required.")
      }
      const { net_total, taxes, total_taxes_and_charges, grand_total, total_qty } = totals
      const conversion_rate = form.conversion_rate ?? 1
      const outstanding = action === "Submit" ? grand_total : (form.outstanding_amount ?? 0)
      const doc: Record<string, unknown> = {
        ...form,
        doctype: "Purchase Invoice",
        items: items.map(({ name: _n, ...rest }) => rest),
        taxes: taxes.map(({ name: _n, ...rest }) => rest),
        payment_schedule: (form.payment_schedule ?? []).map(({ name: _n, ...rest }) => rest),
        total_qty,
        base_total: round2(net_total * conversion_rate),
        base_net_total: round2(net_total * conversion_rate),
        total: net_total,
        net_total,
        total_taxes_and_charges,
        base_total_taxes_and_charges: round2(total_taxes_and_charges * conversion_rate),
        grand_total,
        base_grand_total: round2(grand_total * conversion_rate),
        rounding_adjustment: 0,
        rounded_total: grand_total,
        base_rounding_adjustment: 0,
        base_rounded_total: round2(grand_total * conversion_rate),
        outstanding_amount: outstanding,
        paid_amount: action === "Submit" ? 0 : (form.paid_amount ?? 0),
      }
      if (mode === "edit" && initialData?.name) {
        doc.name = initialData.name
      } else if (!doc.name) {
        doc.__islocal = 1
        doc.name = "new-purchase-invoice"
      }
      const saved =
        action === "Submit"
          ? await billService.saveDoc(doc, "Submit")
          : await billService.saveDoc(doc, "Save")
      baselineRef.current = { ...form, name: saved?.name } as PurchaseInvoiceFormData
      setBaseline(baselineRef.current)
      onSaved?.(saved ?? null)
      return saved?.name
    }

    useImperativeHandle(ref, () => ({
      save: handleSave,
      isDirty,
    }))

    const { locked: headerLocked, fieldVisible } = useDocstatusLock({
      docstatus: initialData?.docstatus,
      mode,
    })
    const currencyLabel = form.currency || "CAD"

    return (
      <div className="space-y-6">
        {/* Section 0: Get Items From Purchase Order modal */}
        <Modal
          open={getItemsOpen}
          onClose={() => {
            setGetItemsOpen(false)
            setMapError("")
          }}
          title="Get Items From Purchase Order"
          description="Select an open purchase order to pull its items into this bill."
        >
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Purchase Order</label>
              <LinkSearchField
                value={selectedPO}
                onChange={(v) => {
                  setSelectedPO(v ?? "")
                  setMapError("")
                }}
                searchFn={async (q) => ({
                  items: await billService.searchLink("Purchase Order", q, "Purchase Invoice"),
                })}
                docType="Purchase Order"
                placeholder="Search purchase orders…"
                required
                inputClassName="bg-white"
              />
            </div>
            {mapError && (
              <div className="flex items-start gap-2 text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{mapError}</p>
              </div>
            )}
            <p className="text-xs text-muted">Only un-billed purchase orders are shown. Items are copied as new lines.</p>
          </div>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setGetItemsOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleMapItems()} loading={mapping}>
              <ArrowRight size={14} /> Get Items
            </Button>
          </ModalFooter>
        </Modal>

        {/* Section 1: Header */}
        <div className="pb-4 border-b border-border">
          {mode !== "create" && (
            <div className="mb-3">
              <label className={labelClass}>Series</label>
              <div className="font-medium text-sm py-1.5">{form.naming_series || "ACC-PINV-.YYYY.-"}</div>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Col 1: Supplier */}
            <div className="space-y-3">
              {mode === "create" && (
                <div>
                  <label className={labelClass}>Series *</label>
                  <select
                    value={form.naming_series ?? "ACC-PINV-.YYYY.-"}
                    onChange={(e) => update({ naming_series: e.target.value })}
                    disabled={headerLocked}
                    className={inputClass}
                    data-testid="pi-naming-series"
                  >
                    <option value="ACC-PINV-.YYYY.-">ACC-PINV-.YYYY.-</option>
                  </select>
                </div>
              )}
              <div>
                <label className={labelClass}>Supplier *</label>
                {headerLocked ? (
                  <input type="text" value={form.supplier} readOnly className={`${inputClass} bg-gray-50`} />
                ) : (
                  <LinkSearchField
                    value={form.supplier}
                    onChange={(v) => void handleSupplierSelect(v ?? "")}
                    searchFn={async (q) => ({
                      items: await billService.searchLink("Supplier", q, "Purchase Invoice"),
                    })}
                    validate={async (v) => {
                      await billService.validateLink("Supplier", v)
                    }}
                    docType="Supplier"
                    placeholder="Select supplier…"
                    required
                    inputClassName="bg-white"
                  />
                )}
              </div>
              <div>
                <label className={labelClass}>Supplier Name</label>
                <Input
                  value={form.supplier_name ?? ""}
                  onChange={(e) => update({ supplier_name: e.target.value })}
                  placeholder="Supplier name…"
                  readOnly={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Company *</label>
                {headerLocked ? (
                  <input type="text" value={form.company} readOnly className={`${inputClass} bg-gray-50`} />
                ) : (
                  <Combobox
                    name="company"
                    value={form.company || DEFAULT_COMPANY}
                    options={companyOptions}
                    onChange={(_n, v) => update({ company: v })}
                    load={companies.ensure}
                    loading={companies.loading}
                  />
                )}
              </div>
            </div>
            {/* Col 2: Dates */}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Posting Date *</label>
                <DateInput
                  value={form.posting_date ?? ""}
                  onChange={(e) => update({ posting_date: e.target.value })}
                  readOnly={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Due Date *</label>
                <DateInput
                  value={form.due_date ?? ""}
                  min={form.posting_date || ""}
                  onChange={(e) => update({ due_date: e.target.value })}
                  readOnly={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Currency *</label>
                <Combobox
                  name="currency"
                  value={form.currency || "CAD"}
                  options={currencyOptions}
                  onChange={(_n, v) => handleCurrencyChange(v)}
                  load={currencies.ensure}
                  loading={currencies.loading}
                  disabled={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Set Warehouse</label>
                <Combobox
                  name="set_warehouse"
                  value={form.set_warehouse ?? ""}
                  options={warehouseOptions}
                  onChange={(_n, v) =>
                    update({
                      set_warehouse: v,
                      items: (form.items ?? []).map((r) => ({ ...r, warehouse: v || r.warehouse })),
                    })
                  }
                  load={warehouses.ensure}
                  loading={warehouses.loading}
                  disabled={headerLocked}
                />
              </div>
            </div>
            {/* Col 3: Cost Center / Price List */}
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Price List *</label>
                <Combobox
                  name="buying_price_list"
                  value={form.buying_price_list || "Standard Buying"}
                  options={priceListOptions}
                  onChange={(_n, v) => update({ buying_price_list: v })}
                  load={priceLists.ensure}
                  loading={priceLists.loading}
                  disabled={headerLocked}
                />
              </div>
              <div>
                <label className={labelClass}>Cost Center</label>
                <Combobox
                  name="cost_center"
                  value={form.cost_center ?? ""}
                  options={costCenterOptions}
                  onChange={(_n, v) =>
                    update({
                      cost_center: v,
                      items: (form.items ?? []).map((r) => ({ ...r, cost_center: v || r.cost_center })),
                    })
                  }
                  load={costCenters.ensure}
                  loading={costCenters.loading}
                  disabled={headerLocked}
                />
              </div>
              <CollapsibleSection title="Supplier Contact">
                <div className="grid grid-cols-1 gap-3 pt-1">
                  {fieldVisible("contact_person", form.contact_person) && (
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <Input value={form.contact_person ?? ""} onChange={(e) => update({ contact_person: e.target.value })} placeholder="Contact person…" readOnly={headerLocked} />
                    </div>
                  )}
                  {fieldVisible("contact_email", form.contact_email) && (
                  <div>
                    <label className={labelClass}>Contact Email</label>
                    <Input value={form.contact_email ?? ""} onChange={(e) => update({ contact_email: e.target.value })} placeholder="Email…" readOnly={headerLocked} />
                  </div>
                  )}
                  {fieldVisible("address_display", form.address_display) && (
                  <div>
                    <label className={labelClass}>Supplier Address</label>
                    <textarea
                      value={form.address_display ?? ""}
                      onChange={(e) => update({ address_display: e.target.value })}
                      rows={3}
                      readOnly={headerLocked}
                      className={inputClass}
                      placeholder="Address…"
                    />
                  </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </div>
        </div>

        {/* Section 2: Items */}
        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-heading">Items</h3>
            {!headerLocked && (
              <Button variant="outline" size="sm" onClick={() => setGetItemsOpen(true)}>
                <Link2 size={14} /> Get Items From Purchase Order
              </Button>
            )}
          </div>
          <ChildTableGrid<PurchaseInvoiceItemForm>
            title="Items"
            description="Click a row to edit its fields."
            rows={form.items ?? []}
            columns={itemColumns}
            emptyRow={createEmptyItem(form.set_warehouse)}
            onChange={handleItemsChange}
            readOnly={headerLocked}
            canAdd={!headerLocked}
            minWidth="760px"
            noTopBorder
            testId="purchase-invoice-items"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-1">
            <div>
              <label className={labelClass}>Total Quantity</label>
              <input type="text" value={totals.total_qty} readOnly className={`${inputClass} bg-gray-50`} />
            </div>
            <div>
              <label className={labelClass}>Total ({currencyLabel})</label>
              <input type="text" value={formatCurrency(totals.net_total)} readOnly className={`${inputClass} bg-gray-50`} />
            </div>
          </div>
        </div>

        {/* Section 3: Taxes and Charges */}
        <div className="space-y-3 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-heading">Taxes and Charges</h3>
          <div className="max-w-sm">
            <label className={labelClass}>Purchase Taxes and Charges Template</label>
            {headerLocked ? (
              <input type="text" value={form.taxes_and_charges ?? ""} readOnly className={`${inputClass} bg-gray-50`} />
            ) : (
              <Combobox
                name="taxes_and_charges"
                value={form.taxes_and_charges ?? ""}
                options={TAX_TEMPLATE_OPTIONS}
                onChange={(_n, v) => {
                  const rows = templateTaxRows(v)
                  update({
                    taxes_and_charges: v,
                    ...(rows ? { taxes: rows } : {}),
                  })
                }}
                placeholder="Select template…"
              />
            )}
          </div>
          <div className="overflow-x-auto rounded-[10px] border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border bg-surface-muted">
                  <th className="px-3 py-2 font-semibold">Charge</th>
                  <th className="px-3 py-2 font-semibold">Account Head</th>
                  <th className="px-3 py-2 font-semibold text-right">Rate (%)</th>
                  <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(totals.taxes ?? []).map((tax, idx) => (
                  <tr key={tax.name ?? idx} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <select
                        value={tax.charge_type}
                        disabled={headerLocked}
                        onChange={(e) => {
                          const next = totals.taxes.map((t, i) => (i === idx ? { ...t, charge_type: e.target.value as PurchaseInvoiceTaxFormRow["charge_type"] } : t))
                          handleTaxesChange(next)
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded-[8px] focus:outline-none bg-white disabled:bg-gray-50"
                      >
                        <option value="On Net Total">On Net Total</option>
                        <option value="On Item Total">On Item Total</option>
                        <option value="Actual">Actual</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={tax.account_head ?? ""}
                        disabled={headerLocked}
                        onChange={(e) => {
                          const next = totals.taxes.map((t, i) => (i === idx ? { ...t, account_head: e.target.value } : t))
                          handleTaxesChange(next)
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-border rounded-[8px] focus:outline-none bg-white disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={tax.rate ?? 0}
                        disabled={headerLocked}
                        onChange={(e) => {
                          const next = totals.taxes.map((t, i) => (i === idx ? { ...t, rate: Number(e.target.value) || 0 } : t))
                          handleTaxesChange(next)
                        }}
                        className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[8px] focus:outline-none bg-white disabled:bg-gray-50"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-heading tabular-nums">
                      {formatCurrency(tax.tax_amount ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleTaxesChange((totals.taxes ?? []).filter((_, i) => i !== idx))}
                        disabled={headerLocked || (totals.taxes ?? []).length <= 1}
                        className="p-1.5 rounded-[8px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        aria-label="Remove tax"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!headerLocked && (
            <button
              type="button"
              onClick={() => handleTaxesChange([...(totals.taxes ?? []), createDefaultTaxRows()[0]])}
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
            >
              + Add Tax
            </button>
          )}
          <div className="sm:w-1/2 sm:ml-auto">
            <label className={labelClass}>Total Taxes and Charges</label>
            <input
              type="text"
              value={formatCurrency(totals.total_taxes_and_charges)}
              readOnly
              className={`${inputClass} bg-gray-50`}
            />
          </div>
        </div>

        {/* Section 4: Payment Terms + Terms & Conditions */}
        <div className="space-y-3 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-heading">Payment Terms</h3>
          {fieldVisible("payment_terms_template", form.payment_terms_template) && (
          <div className="max-w-sm">
            <label className={labelClass}>Payment Terms Template</label>
            {headerLocked ? (
              <input type="text" value={form.payment_terms_template ?? ""} readOnly className={`${inputClass} bg-gray-50`} />
            ) : (
              <LinkSearchField
                value={form.payment_terms_template ?? ""}
                onChange={(v) => void handlePaymentTermsSelect(v ?? "")}
                searchFn={async (q) => ({
                  items: (await billService.searchLink("Payment Terms Template", q, "Purchase Invoice").catch(() => []))
                    .map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })),
                })}
                validate={async (v) => {
                  await billService.validateLink("Payment Terms Template", v)
                }}
                docType="Payment Terms Template"
                placeholder="Select template…"
                suppressExternalLabelFetch
                inputClassName="bg-white"
              />
            )}
          </div>
          )}
          <ChildTableGrid<PurchaseInvoicePaymentScheduleRow>
            title="Payment Schedule"
            titleClassName="text-xs font-semibold text-muted"
            noTopBorder
            rows={(form.payment_schedule ?? []) as PurchaseInvoicePaymentScheduleRow[]}
            columns={paymentScheduleColumns}
            emptyRow={{ payment_term: "", description: "", due_date: "", invoice_portion: 0, payment_amount: 0 }}
            onChange={(rows) => update({ payment_schedule: rows as Array<Record<string, unknown>> })}
            readOnly={headerLocked}
            canAdd={!headerLocked}
            minWidth="720px"
          />
        </div>

        <div className="space-y-3 pb-4 border-b border-border">
          <h3 className="text-base font-bold text-heading">Terms and Conditions</h3>
          {fieldVisible("tc_name", form.tc_name) && (
          <div className="max-w-sm">
            <label className={labelClass}>Terms</label>
            {headerLocked ? (
              <input type="text" value={form.tc_name ?? ""} readOnly className={`${inputClass} bg-gray-50`} />
            ) : (
              <LinkSearchField
                value={form.tc_name ?? ""}
                onChange={(v) => void handleTcNameSelect(v ?? "")}
                searchFn={async (q) => ({
                  items: (await billService.searchLink("Terms and Conditions", q, "Purchase Invoice", { disabled: 0 }).catch(() => []))
                    .map((r) => ({ value: r.value, label: r.label || r.value, description: r.description ?? "" })),
                })}
                validate={async (v) => {
                  await billService.validateLink("Terms and Conditions", v)
                }}
                docType="Terms and Conditions"
                placeholder="Select terms…"
                suppressExternalLabelFetch
                inputClassName="bg-white"
              />
            )}
          </div>
          )}
          {fieldVisible("terms", form.terms) && (
          <div>
            <label className={labelClass}>Terms and Conditions Details</label>
            <textarea
              rows={4}
              value={form.terms ?? ""}
              onChange={(e) => update({ terms: e.target.value })}
              readOnly={headerLocked}
              className={inputClass}
              placeholder="Enter terms, conditions, or other notes…"
            />
          </div>
          )}
        </div>

        {/* Section 5: Totals */}
        <div className="space-y-3">
          <h3 className="text-base font-bold text-heading">Totals</h3>
          <div className="lg:w-1/2 lg:ml-auto space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Net Total ({currencyLabel})</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totals.net_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Total Taxes and Charges ({currencyLabel})</span>
              <span className="font-semibold text-heading tabular-nums">{formatCurrency(totals.total_taxes_and_charges)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="font-bold text-heading">Grand Total ({currencyLabel})</span>
              <span className="font-bold text-heading tabular-nums">{formatCurrency(totals.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
)