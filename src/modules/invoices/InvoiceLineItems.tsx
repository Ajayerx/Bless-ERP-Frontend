"use client"

import { Plus, Trash2 } from "lucide-react"
import { type Product } from "@/services"
import { formatCurrency } from "@/lib/utils"
import { Card, CardHeader, CardTitle } from "@/components/ui"

export interface LineItemForm {
  id: string
  productId?: string
  productName: string
  sku?: string
  quantity: number
  price: number
  taxRate?: number
  taxLabel?: string
  total: number
}

interface InvoiceLineItemsProps {
  items: LineItemForm[]
  readOnly?: boolean
  products?: Product[]
  productDropdowns?: Record<string, { open: boolean; search: string }>
  onUpdate?: (id: string, updates: Partial<LineItemForm>) => void
  onRemove?: (id: string) => void
  onAdd?: () => void
  onProductDropdownChange?: (id: string, dropdown: { open: boolean; search: string }) => void
  onSelectProduct?: (lineId: string, product: Product) => void
}

const GST_RATE = 0.05
const QST_RATE = 0.09975

export default function InvoiceLineItems({
  items,
  readOnly = false,
  products,
  productDropdowns,
  onUpdate,
  onRemove,
  onAdd,
  onProductDropdownChange,
  onSelectProduct,
}: InvoiceLineItemsProps) {
  if (readOnly) {
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Item</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Qty</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Price</th>
            <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-50">
              <td className="py-2 font-semibold text-heading">{item.productName}</td>
              <td className="py-2 text-right text-muted">{item.quantity}</td>
              <td className="py-2 text-right text-muted">{formatCurrency(item.price)}</td>
              <td className="py-2 text-right font-semibold text-heading">{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Line Items</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[30%]">Product</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">SKU</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">Qty</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Price</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">Tax</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Total</th>
              <th className="px-3 py-3 w-[7%]" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((line) => {
              const dropdown = productDropdowns?.[line.id]
              const filteredProducts = products?.filter(
                (p) =>
                  p.name.toLowerCase().includes(dropdown?.search?.toLowerCase() ?? "") ||
                  p.sku.toLowerCase().includes(dropdown?.search?.toLowerCase() ?? ""),
              )

              return (
                <tr key={line.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-6 py-2.5">
                    <div className="relative">
                      <input
                        type="text"
                        value={line.productName}
                        onChange={(e) => {
                          onUpdate?.(line.id, { productName: e.target.value, productId: "", sku: "" })
                          onProductDropdownChange?.(line.id, { open: true, search: e.target.value })
                        }}
                        onFocus={() => onProductDropdownChange?.(line.id, { open: true, search: line.productName ?? "" })}
                        placeholder="Search product..."
                        className="w-full px-3 py-2 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      />
                      {dropdown?.open && (
                        <div className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-[12px] shadow-xl max-h-40 overflow-y-auto">
                          {filteredProducts?.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted">No products found</p>
                          ) : (
                            filteredProducts?.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectProduct?.(line.id, p)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 text-body transition-colors"
                              >
                                <span className="font-medium">{p.name}</span>
                                <span className="text-xs text-muted ml-2">{p.sku}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-sm text-muted">{line.sku}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => onUpdate?.(line.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-16 px-2 py-1.5 text-sm text-right border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
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
                  <td className="px-3 py-2.5">
                    <select
                      value={`${line.taxRate}`}
                      onChange={(e) => {
                        const rate = parseFloat(e.target.value)
                        onUpdate?.(line.id, { taxRate: rate, taxLabel: rate === GST_RATE ? "GST" : "QST" })
                      }}
                      className="w-full px-2 py-1.5 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                    >
                      <option value={GST_RATE}>GST 5%</option>
                      <option value={QST_RATE}>QST 9.975%</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="text-sm font-semibold tabular-nums text-heading">{formatCurrency(line.total)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onRemove?.(line.id)}
                      disabled={items.length <= 1}
                      className="p-1.5 rounded-[8px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 border-t border-border">
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
        >
          <Plus size={14} /> Add Item
        </button>
      </div>
    </Card>
  )
}
