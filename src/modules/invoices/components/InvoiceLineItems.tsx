"use client"

import { Fragment, useState, useEffect, useRef, useCallback } from "react"
import { Plus, Trash2, ChevronDown, ChevronRight, ScanBarcode, Search, X } from "lucide-react"
import { type Product } from "@/services"
import { formatCurrency } from "@/lib/utils"
import { invoiceService } from "../services"
import LinkSearchField from "@/components/ui/LinkSearchField"

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
  products?: Product[]
  warehouses?: string[]
  accounts?: string[]
  costCenters?: string[]
  itemTaxTemplates?: string[]
  productDropdowns?: Record<string, { open: boolean; search: string }>
  onUpdate?: (id: string, updates: Partial<LineItemForm>) => void
  onRemove?: (id: string) => void
  onAdd?: () => void
  onAddItemWithQty?: (product: Product, qty: number) => void
  onProductDropdownChange?: (id: string, dropdown: { open: boolean; search: string }) => void
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

const inputClass =
  "w-full px-2 py-1.5 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"

export default function InvoiceLineItems({
  items,
  readOnly = false,
  products,
  warehouses,
  accounts,
  costCenters,
  itemTaxTemplates,
  productDropdowns,
  onUpdate,
  onRemove,
  onAdd,
  onAddItemWithQty,
  onProductDropdownChange,
  onSelectProduct,
  itemDetailsContext,
}: InvoiceLineItemsProps) {
  const MARGIN_TYPE_OPTIONS: string[] = ["Percentage", "Amount"];

  if (readOnly) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider w-8">#</th>
            <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Item</th>
            <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Qty</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Rate</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            return (
              <tr key={item.id} className="border-b border-gray-50">
                <td className="py-2 text-muted text-center">{index + 1}</td>
                <td className="py-2 font-semibold text-heading">{item.productName}</td>
                <td className="py-2 text-sm text-muted">{item.description || "—"}</td>
                <td className="py-2 text-right text-muted">{item.quantity}</td>
                <td className="py-2 text-right text-muted">{formatCurrency(item.price)}</td>
                <td className="py-2 text-right font-semibold text-heading">{formatCurrency(item.total)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    )
  }

  return (
    <div className="relative overflow-x-auto">
      <div className="px-4 py-3 border-b border-border">
        <div className="relative max-w-sm">
          <ScanBarcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Scan Barcode…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val && products && onSelectProduct) {
                  const match = products.find((p) => p.item_code === val)
                  if (match) {
                    const lastLine = items[items.length - 1]
                    if (lastLine && !lastLine.productName && lastLine.quantity === 1 && lastLine.price === 0) {
                      onSelectProduct(lastLine.id, match)
                    } else {
                      onAdd?.()
                      const newId = crypto.randomUUID()
                      setTimeout(() => onSelectProduct(newId, match), 0)
                    }
                  }
                }
                ;(e.target as HTMLInputElement).value = ""
              }
            }}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider w-[4%]">#</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[22%]">Item</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[22%]">Description</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[7%]">Qty</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[12%]">Rate</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Amount</th>
              <th className="px-3 py-3 w-[5%]" />
              <th className="px-3 py-3 w-[5%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((line, index) => {
              const dropdown = productDropdowns?.[line.id]
              const filteredProducts = products?.filter(
                (p) =>
                  p.item_name?.toLowerCase().includes(dropdown?.search?.toLowerCase() ?? "") ||
                  p.item_code?.toLowerCase().includes(dropdown?.search?.toLowerCase() ?? ""),
              )

              const selectedProduct = products?.find((p) => p.item_code === line.productId)

              return (
                <LineItemRow
                  key={line.id}
                  line={line}
                  rowIndex={index + 1}
                  selectedProduct={selectedProduct}
                  filteredProducts={filteredProducts}
                  dropdown={dropdown}
                  itemsCount={items.length}
                  warehouses={warehouses}
                  accounts={accounts}
                  costCenters={costCenters}
                  itemTaxTemplates={itemTaxTemplates}
                   marginTypeOptions={MARGIN_TYPE_OPTIONS}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  onProductDropdownChange={onProductDropdownChange}
                  onSelectProduct={onSelectProduct}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-border flex items-center gap-4">
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          <Plus size={14} /> Add Row
        </button>
        <AddMultipleModal items={items} onAddItemWithQty={onAddItemWithQty} itemDetailsContext={itemDetailsContext} />
      </div>
    </div>
  )
}

type SearchResultItem = { value: string; label: string; description: string }

function AddMultipleModal({
  items,
  onAddItemWithQty,
  itemDetailsContext,
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
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [qtyPrompt, setQtyPrompt] = useState<{ item: SearchResultItem; qty: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const PAGE = 20

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await invoiceService.searchItems(q, 0, PAGE)
      setResults(res.items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

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
        className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-body transition-colors"
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

function LineItemRow({
  line,
  rowIndex,
  selectedProduct,
  filteredProducts,
  dropdown,
  itemsCount,
  warehouses,
  accounts,
  costCenters,
  itemTaxTemplates,
  marginTypeOptions,
  onUpdate,
  onRemove,
  onProductDropdownChange,
  onSelectProduct,
}: {
  line: LineItemForm
  rowIndex: number
  selectedProduct?: Product
  filteredProducts?: Product[]
  dropdown?: { open: boolean; search: string }
  itemsCount: number
  warehouses?: string[]
  accounts?: string[]
  costCenters?: string[]
  itemTaxTemplates?: string[]
  marginTypeOptions?: string[]
  onUpdate?: (id: string, updates: Partial<LineItemForm>) => void
  onRemove?: (id: string) => void
  onProductDropdownChange?: (id: string, dropdown: { open: boolean; search: string }) => void
  onSelectProduct?: (lineId: string, product: Product) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const hasBatch = !!selectedProduct?.has_batch_no
  const hasSerial = !!selectedProduct?.has_serial_no

  return (
    <Fragment>
      <tr className="hover:bg-gray-50/30 transition-colors group">
        <td className="px-3 py-2.5 text-center">
          <span className="text-xs text-muted">{rowIndex}</span>
        </td>
        <td className="px-3 py-2.5">
          <LinkSearchField
            value={line.productName}
            onChange={(val) => {
              if (val) {
                onSelectProduct?.(line.id, {
                  name: val,
                  item_code: val,
                  item_name: val,
                  stock_uom: "Nos",
                  standard_rate: 0,
                  effective_cost: null,
                  stock: 0,
                  stock_value: 0,
                })
              } else {
                onUpdate?.(line.id, { productName: "", productId: "", sku: "" })
              }
            }}
            searchFn={(q) => invoiceService.searchItems(q, 0, 20)}
            placeholder="Search product..."
            inputClassName="px-3 py-2 text-sm"
          />
        </td>
        <td className="px-3 py-2.5">
          <input
            type="text"
            value={line.description ?? ""}
            onChange={(e) => onUpdate?.(line.id, { description: e.target.value || undefined })}
            className="w-full px-2 py-1.5 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"
            placeholder="Optional description"
          />
        </td>
        <td className="px-3 py-2.5">
          <input
            type="number"
            min={1}
            value={line.quantity}
            onChange={(e) => {
              const qty = Math.max(1, parseInt(e.target.value) || 1)
              onUpdate?.(line.id, { quantity: qty })
            }}
            className="w-14 px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </td>
        <td className="px-3 py-2.5">
          <input
            type="number"
            min={0}
            step={0.01}
            value={line.price}
            onChange={(e) => onUpdate?.(line.id, { price: Math.max(0, parseFloat(e.target.value) || 0) })}
            className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="text-sm font-semibold tabular-nums text-heading">{formatCurrency(line.total)}</span>
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            type="button"
            onClick={() => onRemove?.(line.id)}
            disabled={itemsCount <= 1}
            className="p-1.5 rounded-[8px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </td>
        <td className="px-3 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-[6px] text-muted hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50/50 px-6 py-3 border-t border-border/50">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">SKU</label>
                <input
                  type="text"
                  value={line.sku ?? ""}
                  onChange={(e) => onUpdate?.(line.id, { sku: e.target.value || undefined })}
                  className={inputClass}
                  placeholder="Item code"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">UOM</label>
                <LinkSearchField
                  value={line.uom}
                  onChange={(val) => onUpdate?.(line.id, { uom: val || undefined })}
                  searchFn={(q) => invoiceService.searchUOMs(q)}
                  placeholder="Nos"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Warehouse</label>
                <LinkSearchField
                  value={line.warehouse}
                  onChange={(val) => onUpdate?.(line.id, { warehouse: val || undefined })}
                  searchFn={(q) => invoiceService.searchWarehouses(q)}
                  placeholder="Select warehouse…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={line.discountPercentage ?? ""}
                  onChange={(e) => {
                    const pct = e.target.value ? Math.min(100, Math.max(0, parseFloat(e.target.value))) : undefined
                    const amt = pct !== undefined ? Math.round(line.price * (pct / 100) * 100) / 100 : undefined
                    onUpdate?.(line.id, { discountPercentage: pct, discountAmount: amt })
                  }}
                  placeholder="0%"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Discount Amount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.discountAmount ?? ""}
                  onChange={(e) => {
                    const amt = e.target.value ? parseFloat(e.target.value) : undefined
                    const pct = amt !== undefined && line.price > 0 ? Math.round((amt / line.price) * 10000) / 100 : undefined
                    onUpdate?.(line.id, { discountAmount: amt, discountPercentage: pct })
                  }}
                  className={inputClass}
                  placeholder="Auto from %"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Margin Type</label>
                <select
                  value={line.marginType ?? ""}
                  onChange={(e) => onUpdate?.(line.id, { marginType: (e.target.value || undefined) as "Percentage" | "Amount" | undefined })}
                  className={inputClass}
                >
                  <option value="">None</option>
                  {(marginTypeOptions ?? ["Percentage", "Amount"]).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Margin Rate/Amount</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={line.marginRateOrAmount ?? ""}
                  onChange={(e) => onUpdate?.(line.id, { marginRateOrAmount: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Item Tax Template</label>
                <LinkSearchField
                  value={line.itemTaxTemplate}
                  onChange={(val) => onUpdate?.(line.id, { itemTaxTemplate: val || undefined })}
                  searchFn={(q) => invoiceService.searchItemTaxTemplates(q)}
                  placeholder="None"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Stock UOM</label>
                <input
                  type="text"
                  value={line.stockUom ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Conversion Factor</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={line.conversionFactor ?? 1}
                  onChange={(e) => onUpdate?.(line.id, { conversionFactor: parseFloat(e.target.value) || 1 })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Price List Rate</label>
                <input
                  type="number"
                  value={line.priceListRate ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Net Rate</label>
                <input
                  type="number"
                  value={line.netRate ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Net Amount</label>
                <input
                  type="number"
                  value={line.netAmount ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Base Rate</label>
                <input
                  type="number"
                  value={line.baseRate ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Base Amount</label>
                <input
                  type="number"
                  value={line.baseAmount ?? ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>

              {(hasBatch || hasSerial) && (
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    {hasBatch ? "Batch No" : "Serial No"}
                  </label>
                  <textarea
                    value={hasBatch ? (line.batchNo ?? "") : (line.serialNo ?? "")}
                    onChange={(e) => {
                      const val = e.target.value || undefined
                      if (hasBatch) onUpdate?.(line.id, { batchNo: val })
                      if (hasSerial) onUpdate?.(line.id, { serialNo: val })
                    }}
                    className={`${inputClass} min-h-[60px]`}
                    placeholder={hasBatch ? "One per line, or comma separated" : "Enter serial numbers"}
                    rows={2}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Weight / Unit</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={selectedProduct?.weight_per_unit ?? line.weightPerUnit ?? ""}
                    readOnly
                    className={`${inputClass} bg-gray-100`}
                  />
                  <span className="text-xs text-muted whitespace-nowrap">{selectedProduct?.weight_uom ?? ""}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Total Weight</label>
                <input
                  type="number"
                  value={selectedProduct && selectedProduct.weight_per_unit ? line.quantity * selectedProduct.weight_per_unit : ""}
                  readOnly
                  className={`${inputClass} bg-gray-100`}
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id={`deferred-${line.id}`}
                  checked={!!line.enableDeferredRevenue}
                  onChange={(e) => onUpdate?.(line.id, { enableDeferredRevenue: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor={`deferred-${line.id}`} className="text-sm text-body whitespace-nowrap">Deferred Revenue</label>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id={`commission-${line.id}`}
                  checked={line.grantCommission !== false}
                  onChange={(e) => onUpdate?.(line.id, { grantCommission: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor={`commission-${line.id}`} className="text-sm text-body whitespace-nowrap">Grant Commission</label>
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id={`pagebreak-${line.id}`}
                  checked={!!line.pageBreak}
                  onChange={(e) => onUpdate?.(line.id, { pageBreak: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor={`pagebreak-${line.id}`} className="text-sm text-body whitespace-nowrap">Page Break</label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Income Account</label>
                <LinkSearchField
                  value={line.incomeAccount}
                  onChange={(val) => onUpdate?.(line.id, { incomeAccount: val || undefined })}
                  searchFn={(q) => invoiceService.searchAccounts(q)}
                  placeholder="Select account…"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Cost Center</label>
                <LinkSearchField
                  value={line.costCenter}
                  onChange={(val) => onUpdate?.(line.id, { costCenter: val || undefined })}
                  searchFn={(q) => invoiceService.searchCostCenters(q)}
                  placeholder="Select cost center…"
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
