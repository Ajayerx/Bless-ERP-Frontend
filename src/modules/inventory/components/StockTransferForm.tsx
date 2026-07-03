"use client"

import { useState, useEffect } from "react"
import { Save, Loader2, Plus, X } from "lucide-react"
import { inventoryService } from "@/modules/inventory/services"
import type { StockTransfer, StockTransferItem } from "@/modules/inventory/types"

interface StockTransferFormProps {
  transfer?: StockTransfer | null
  onSaved: () => void
  onCancel: () => void
}

export default function StockTransferForm({ transfer, onSaved, onCancel }: StockTransferFormProps) {
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    fromWarehouseId: "",
    toWarehouseId: "",
    notes: "",
    items: [] as Omit<StockTransferItem, "productId" | "sku">[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    inventoryService.listWarehouses({ pageSize: 100 }).then((res) => {
      setWarehouses(res.items.map((w) => ({ id: w.id, name: w.name })))
    })
  }, [])

  useEffect(() => {
    if (transfer) {
      setForm({
        fromWarehouseId: transfer.fromWarehouseId,
        toWarehouseId: transfer.toWarehouseId,
        notes: transfer.notes,
        items: transfer.items.map((i) => ({ productName: i.productName, quantity: i.quantity, unit: i.unit })),
      })
    }
  }, [transfer])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { productName: "", quantity: 1, unit: "ea" }],
    }))
  }

  const removeItem = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }

  const updateItem = (idx: number, field: string, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.fromWarehouseId || !form.toWarehouseId) {
      setError("Please select both source and destination warehouses.")
      return
    }
    if (form.fromWarehouseId === form.toWarehouseId) {
      setError("Source and destination warehouses must be different.")
      return
    }
    if (form.items.length === 0) {
      setError("Add at least one item to transfer.")
      return
    }
    setSaving(true)
    try {
      if (transfer) {
        await inventoryService.updateWarehouse(transfer.id, form)
      } else {
        await inventoryService.createTransfer(form)
      }
      onSaved()
    } catch {
      setError("Failed to save stock transfer. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="fromWarehouseId" className={labelClass}>From Warehouse *</label>
          <select id="fromWarehouseId" name="fromWarehouseId" value={form.fromWarehouseId} onChange={handleChange} className={inputClass}>
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="toWarehouseId" className={labelClass}>To Warehouse *</label>
          <select id="toWarehouseId" name="toWarehouseId" value={form.toWarehouseId} onChange={handleChange} className={inputClass}>
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="notes" className={labelClass}>Notes</label>
          <textarea id="notes" name="notes" value={form.notes} onChange={handleChange} rows={2} className={inputClass} placeholder="Optional notes about this transfer..." />
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Transfer Items</p>
          <button type="button" onClick={addItem}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">
            <Plus size={14} /> Add Item
          </button>
        </div>

        {form.items.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center border border-dashed border-border rounded-[12px]">
            No items added yet. Click "Add Item" to add products to transfer.
          </p>
        ) : (
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-[12px]">
                <input
                  placeholder="Product name"
                  value={item.productName}
                  onChange={(e) => updateItem(idx, "productName", e.target.value)}
                  className="flex-1 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, "quantity", parseInt(e.target.value) || 0)}
                  className="w-20 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body text-right focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <input
                  placeholder="Unit"
                  value={item.unit}
                  onChange={(e) => updateItem(idx, "unit", e.target.value)}
                  className="w-20 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button type="button" onClick={() => removeItem(idx)}
                  className="p-2 text-muted hover:text-danger-600 transition-colors">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : transfer ? "Update Transfer" : "Create Transfer"}
        </button>
      </div>
    </form>
  )
}
