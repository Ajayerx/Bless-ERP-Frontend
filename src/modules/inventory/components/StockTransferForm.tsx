"use client"

import { useState, useEffect } from "react"
import { Plus, X } from "lucide-react"
import { inventoryService, inventoryLookups } from "@/modules/inventory/services"
import type { StockTransfer, StockTransferItem } from "@/modules/inventory/types"

interface StockTransferFormProps {
  transfer?: StockTransfer | null
  onSaved: (name: string) => void
  onCancel: () => void
  onSavingChange?: (saving: boolean) => void
}

export default function StockTransferForm({ transfer, onSaved, onSavingChange }: StockTransferFormProps) {
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [form, setForm] = useState({
    company: "",
    from_warehouse: "",
    to_warehouse: "",
    posting_date: new Date().toISOString().slice(0, 10),
    remarks: "",
    items: [] as StockTransferItem[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    onSavingChange?.(saving)
  }, [saving, onSavingChange])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      inventoryLookups.companies(),
      inventoryService.listWarehouses({ pageSize: 100 }).then((r) => r.items.map((w) => w.name)),
    ]).then(([cos, whs]) => {
      if (!cancelled) {
        setCompanies(cos)
        setWarehouses(whs)
      }
    }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dropdown options.") })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (transfer) {
      setForm({
        company: transfer.company,
        from_warehouse: transfer.from_warehouse ?? "",
        to_warehouse: transfer.to_warehouse ?? "",
        posting_date: transfer.posting_date,
        remarks: transfer.remarks ?? "",
        items: transfer.items.map((i) => ({ ...i })),
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
      items: [...prev.items, { item_code: "", qty: 1, uom: "Nos" }],
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
    if (!form.company) { setError("Company is required."); return }
    if (!form.from_warehouse) { setError("Source warehouse is required."); return }
    if (!form.to_warehouse) { setError("Destination warehouse is required."); return }
    if (form.from_warehouse === form.to_warehouse) { setError("Source and destination must be different."); return }
    if (form.items.length === 0) { setError("Add at least one item."); return }
    for (const item of form.items) {
      if (!item.item_code.trim()) { setError("All items need an item code."); return }
      if (item.qty <= 0) { setError("Quantities must be greater than zero."); return }
    }
    setSaving(true)
    try {
      if (transfer) {
        const updated = await inventoryService.createTransfer({
          ...form,
          items: form.items.map((i) => ({ ...i, s_warehouse: form.from_warehouse, t_warehouse: form.to_warehouse })),
        })
        onSaved(updated.name)
      } else {
        const created = await inventoryService.createTransfer({
          ...form,
          items: form.items.map((i) => ({ ...i, s_warehouse: form.from_warehouse, t_warehouse: form.to_warehouse })),
        })
        onSaved(created.name)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save stock transfer.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <form id="stock-transfer-form" onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="company" className={labelClass}>Company *</label>
          <select id="company" name="company" value={form.company} onChange={handleChange} className={inputClass} disabled={!!transfer}>
            <option value="">Select company...</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="posting_date" className={labelClass}>Posting Date</label>
          <input id="posting_date" name="posting_date" type="date" value={form.posting_date} onChange={handleChange} className={inputClass} />
        </div>
        <div>
          <label htmlFor="from_warehouse" className={labelClass}>From Warehouse *</label>
          <select id="from_warehouse" name="from_warehouse" value={form.from_warehouse} onChange={handleChange} className={inputClass}>
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="to_warehouse" className={labelClass}>To Warehouse *</label>
          <select id="to_warehouse" name="to_warehouse" value={form.to_warehouse} onChange={handleChange} className={inputClass}>
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label htmlFor="remarks" className={labelClass}>Remarks</label>
          <textarea id="remarks" name="remarks" value={form.remarks} onChange={handleChange} rows={2} className={inputClass} placeholder="Optional notes..." />
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
            No items added yet.
          </p>
        ) : (
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-[12px]">
                <input
                  placeholder="Item Code"
                  value={item.item_code}
                  onChange={(e) => updateItem(idx, "item_code", e.target.value)}
                  className="flex-[2] px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <input
                  type="number"
                  min={1}
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body text-right focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <input
                  placeholder="UOM"
                  value={item.uom}
                  onChange={(e) => updateItem(idx, "uom", e.target.value)}
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
    </form>
  )
}
