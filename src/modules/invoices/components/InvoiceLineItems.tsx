"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Plus, ScanBarcode, Search, X } from "lucide-react"
import { type Product } from "@/services"
import { formatFixed } from "@/lib/utils"
import { useToast } from "@/components/ui"
import { invoiceService } from "../services"
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid"

export interface LineItemForm {
  id: string
  productId?: string
  productName: string
  description?: string
  sku?: string
  quantity: number
  price: number
  total: number
  uom?: string
  warehouse?: string
  actualQty?: number
  projectedQty?: number
  reservedQty?: number
  discountPercentage?: number
  discountAmount?: number
  marginType?: "Percentage" | "Amount"
  marginRateOrAmount?: number
  itemTaxTemplate?: string
  batchNo?: string
  serialNo?: string
  enableDeferredRevenue?: boolean
  serviceStartDate?: string
  serviceEndDate?: string
  weightPerUnit?: number
  totalWeight?: number
  grantCommission?: boolean
  pageBreak?: boolean
  stockUom?: string
  conversionFactor?: number
  priceListRate?: number
  netRate?: number
  netAmount?: number
  baseRate?: number
  baseAmount?: number
  incomeAccount?: string
  costCenter?: string
}

interface InvoiceLineItemsProps {
  items: LineItemForm[]
  readOnly?: boolean
  customer?: string
  company?: string
  currency?: string
  taxCategory?: string
  postingDate?: string
  onUpdate?: (id: string, updates: Partial<LineItemForm>) => void
  onRemove?: (id: string) => void
  onAdd?: () => void
  onAddItemWithQty?: (product: Product, qty: number) => void
  onSelectProduct?: (lineId: string, product: Product) => void
  itemDetailsContext?: {
    currency?: string;
    conversion_rate?: number;
    selling_price_list?: string;
    price_list_currency?: string;
    plc_conversion_rate?: number;
    customer?: string;
    is_pos?: number;
    is_return?: number;
  }
}

function makeEmptyLine(): LineItemForm {
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
  }
}

function missingPartyMessage(company?: string, customer?: string): string | null {
  const missing = [
    company ? null : "Company",
    customer ? null : "Customer",
  ].filter(Boolean)
  if (missing.length === 0) return null
  return `Please specify: ${missing.join(", ")}. It is needed to fetch Item Details.`
}

export default function InvoiceLineItems({
  items,
  readOnly = false,
  customer,
  company,
  currency = "CAD",
  taxCategory,
  postingDate,
  onUpdate,
  onRemove,
  onAdd,
  onAddItemWithQty,
  onSelectProduct,
  itemDetailsContext,
}: InvoiceLineItemsProps) {
  const { addToast } = useToast()

  const blockIfMissingParty = useCallback((): boolean => {
    const msg = missingPartyMessage(company, customer)
    if (msg) {
      addToast(msg, "warning")
      return true
    }
    return false
  }, [company, customer, addToast])

  const searchItems = useCallback(
    (q: string) =>
      invoiceService.searchItems(q, 0, 20, customer).then((res) => ({
        items: res.items.map((i) => ({
          value: i.value,
          label: i.value,
          description: [i.label !== i.value ? i.label : "", i.description]
            .filter(Boolean)
            .join(", "),
        })),
      })),
    [customer],
  )

  const handleBarcodeScan = useCallback(
    async (raw: string) => {
      const val = raw.trim()
      if (!val) return
      if (blockIfMissingParty()) return
      const details = await invoiceService.getItemDetails(val, itemDetailsContext)
      if (!details || !details.item_name) {
        addToast(`No item found for barcode: ${val}`, "warning")
        return
      }
      const product: Product = {
        name: val,
        item_code: val,
        item_name: (details?.item_name as string) || val,
        item_group: (details?.item_group as string) || "",
        stock_uom: (details?.stock_uom as string) || "Nos",
        standard_rate:
          (details?.price_list_rate as number) ||
          (details?.standard_rate as number) ||
          0,
        effective_cost: null,
        stock: 0,
        stock_value: 0,
        default_warehouse: details?.default_warehouse as string | undefined,
        income_account: details?.income_account as string | undefined,
        cost_center: details?.cost_center as string | undefined,
        description: (details?.description as string) || "",
      }
      const lastLine = items[items.length - 1]
      if (
        lastLine &&
        !lastLine.sku &&
        lastLine.quantity === 1 &&
        lastLine.price === 0
      ) {
        onSelectProduct?.(lastLine.id, product)
      } else {
        onAdd?.()
        const newId = crypto.randomUUID()
        setTimeout(() => onSelectProduct?.(newId, product), 0)
      }
    },
    [
      blockIfMissingParty,
      itemDetailsContext,
      items,
      onAdd,
      onSelectProduct,
      addToast,
    ],
  )

  const readOnlyColumns: GridColumn<LineItemForm>[] = [
    { key: "sku", label: "Item", type: "link", weight: 2.4 },
    {
      key: "quantity",
      label: "Quantity",
      type: "number",
      align: "right",
      weight: 1,
      formatter: (r) => formatFixed(r.quantity, 3),
    },
    {
      key: "price",
      label: `Rate (${currency})`,
      type: "number",
      align: "right",
      weight: 1.2,
      formatter: (r) => formatFixed(r.price, 2),
    },
    {
      key: "total",
      label: `Amount (${currency})`,
      type: "readonly",
      align: "right",
      weight: 1.4,
      formatter: (r) => formatFixed(r.total, 2),
    },
  ]

  const columns: GridColumn<LineItemForm>[] = [
    {
      key: "sku",
      label: "Item",
      type: "link",
      searchFn: searchItems,
      docType: "Item",
      placeholder: "Search item…",
      weight: 2.4,
    },
    { key: "quantity", label: "Quantity", type: "number", align: "right", weight: 1 },
    {
      key: "price",
      label: `Rate (${currency})`,
      type: "number",
      align: "right",
      weight: 1.2,
      placeholder: "0",
    },
    {
      key: "total",
      label: `Amount (${currency})`,
      type: "readonly",
      align: "right",
      weight: 1.4,
      formatter: (r) => formatFixed(r.total, 2),
    },
  ]

  const handleChange = useCallback(
    (next: LineItemForm[]) => {
      if (!onUpdate) return
      const prev = items
      if (next.length > prev.length) {
        onAdd?.()
        return
      }
      if (next.length < prev.length) {
        const nextIds = new Set(next.map((r) => r.id))
        for (const r of prev) {
          if (!nextIds.has(r.id)) onRemove?.(r.id)
        }
        return
      }

      next.forEach((row, i) => {
        const old = prev[i]
        if (!old || row.id !== old.id) return
        const patch: Partial<LineItemForm> = {}

        if (row.sku !== old.sku) {
          if (row.sku && !old.sku) {
            if (blockIfMissingParty()) {
              patch.sku = ""
              patch.productName = ""
            } else {
              onSelectProduct?.(row.id, {
                name: row.sku,
                item_code: row.sku,
                item_name: row.sku,
                stock_uom: "Nos",
                standard_rate: 0,
                effective_cost: null,
                stock: 0,
                stock_value: 0,
              })
            }
          } else if (!row.sku && old.sku) {
            patch.sku = ""
            patch.productName = ""
            patch.productId = ""
          }
        }

        if (row.quantity !== old.quantity) patch.quantity = Math.max(1, Number(row.quantity) || 1)

        if (row.price !== old.price) {
          patch.price = Math.max(0, Number(row.price) || 0)
          if (row.sku && row.price > 0) {
            invoiceService
              .getItemTaxTemplate({
                item_code: row.sku,
                company,
                base_net_rate: row.price,
                tax_category: taxCategory,
                item_tax_template: row.itemTaxTemplate,
                posting_date: postingDate,
                transaction_date: postingDate,
              })
              .then((tpl) => {
                if (tpl && onUpdate) onUpdate(row.id, { itemTaxTemplate: tpl })
              })
          }
        }

        if (Object.keys(patch).length) onUpdate(row.id, patch)
      })
    },
    [items, onUpdate, onAdd, onRemove, onSelectProduct, blockIfMissingParty, company, taxCategory, postingDate],
  )

  return (
    <div className="relative">
      {!readOnly && (
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
                  handleBarcodeScan(val)
                }
              }}
            />
          </div>
        </div>
      )}

      <ChildTableGrid<LineItemForm>
        title="Items"
        description={readOnly ? undefined : "Click a row to edit its fields."}
        rows={items}
        columns={readOnly ? readOnlyColumns : columns}
        emptyRow={makeEmptyLine()}
        onChange={handleChange}
        readOnly={readOnly}
        testId="items_grid"
        minWidth="760px"
        footer={
          !readOnly ? (
            <AddMultipleModal
              items={items}
              onAddItemWithQty={onAddItemWithQty}
              itemDetailsContext={itemDetailsContext}
              onBlocked={() => blockIfMissingParty()}
            />
          ) : undefined
        }
      />
    </div>
  )
}

type SearchResultItem = { value: string; label: string; description: string }

function AddMultipleModal({
  items,
  onAddItemWithQty,
  itemDetailsContext,
  onBlocked,
}: {
  items: LineItemForm[]
  onAddItemWithQty?: (product: Product, qty: number) => void
  itemDetailsContext?: {
    currency?: string;
    conversion_rate?: number;
    selling_price_list?: string;
    price_list_currency?: string;
    plc_conversion_rate?: number;
    customer?: string;
    is_pos?: number;
    is_return?: number;
  }
  onBlocked?: () => boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [qtyPrompt, setQtyPrompt] = useState<{ item: SearchResultItem; qty: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const PAGE = 20

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await invoiceService.searchItems(q, 0, PAGE, itemDetailsContext?.customer)
      setResults(res.items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [itemDetailsContext?.customer])

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setToast(null)
      setQtyPrompt(null)
      doSearch("")
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [open, doSearch])

  const handleSearch = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 300)
  }

  const handleSelectItem = (item: SearchResultItem) => {
    setQtyPrompt({ item, qty: 1 })
  }

  const handleSetQty = async () => {
    if (!qtyPrompt || !onAddItemWithQty) return
    if (onBlocked?.()) return
    const { item, qty } = qtyPrompt
    const details = await invoiceService.getItemDetails(item.value, itemDetailsContext)
    const product: Product = {
      name: item.value,
      item_code: item.value,
      item_name: (details?.item_name as string) || item.label,
      item_group: (details?.item_group as string) || "",
      stock_uom: (details?.stock_uom as string) || "Nos",
      standard_rate: (details?.price_list_rate as number) || (details?.standard_rate as number) || 0,
      effective_cost: null,
      stock: 0,
      stock_value: 0,
      default_warehouse: details?.default_warehouse as string | undefined,
      income_account: details?.income_account as string | undefined,
      cost_center: details?.cost_center as string | undefined,
      description: (details?.description as string) || "",
    }
    onAddItemWithQty(product, qty)
    const existing = items.find((i) => i.productId === item.value)
    setToast(existing ? `Updated ${item.value} qty to ${existing.quantity + qty}` : `Added ${item.value} (${qty})`)
    setTimeout(() => setToast(null), 3000)
    setQtyPrompt(null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[8px] bg-[#7c7c7c] px-2 py-1 text-xs text-white hover:bg-[#696969] transition-colors"
      >
        <Plus size={14} /> Add Multiple
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative bg-surface border border-border rounded-[14px] shadow-2xl w-full max-w-[520px] max-h-[80vh] flex flex-col mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-base font-semibold text-heading">Select Item</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-heading transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-5 pt-4 pb-2">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Beginning with"
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-2" style={{ maxHeight: "50vh" }}>
              {loading && results.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">Searching…</div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">No items found</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {results.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-50/50 rounded-[8px] transition-colors"
                    >
                      <div className="text-sm font-semibold text-heading">{item.value}</div>
                      <div className="text-xs text-muted mt-0.5">
                        {item.label}{item.description ? `, ${item.description}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border flex items-center justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-semibold bg-gray-100 text-heading rounded-[10px] hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>

          {toast && (
            <div className="fixed top-5 right-5 z-[60] px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-[10px] shadow-lg">
              {toast}
            </div>
          )}
        </div>
      )}

      {qtyPrompt && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setQtyPrompt(null)} />
          <div className="relative bg-surface border border-border rounded-[14px] shadow-2xl w-[340px] p-5">
            <h4 className="text-sm font-semibold text-heading mb-1">Set Quantity</h4>
            <p className="text-xs text-muted mb-3">{qtyPrompt.item.value} — {qtyPrompt.item.label}</p>
            <input
              type="number"
              min={0.01}
              step="any"
              value={qtyPrompt.qty}
              onChange={(e) => setQtyPrompt((p) => p ? { ...p, qty: parseFloat(e.target.value) || 1 } : p)}
              className="w-full px-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 mb-4"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSetQty() }}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSetQty}
                className="px-4 py-2 text-sm font-semibold bg-primary-600 text-white rounded-[10px] hover:bg-primary-700 transition-colors"
              >
                Set Quantity
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
