"use client"

import { useState, useEffect } from "react"
import { Save, Loader2, Plus, X } from "lucide-react"
import { apiClient } from "@/services/api-client"
import { inventoryService, inventoryLookups } from "@/modules/inventory/services"
import type { StockCount } from "@/modules/inventory/types"
import { cn } from "@/lib/utils"

interface StockCountFormProps {
  count?: StockCount | null
  onSaved: (name: string) => void
  onCancel: () => void
}

export default function StockCountForm({ count, onSaved, onCancel }: StockCountFormProps) {
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [form, setForm] = useState({
    company: "",
    warehouse: "",
    posting_date: new Date().toISOString().slice(0, 10),
    items: [] as Array<{ item_code: string; warehouse: string; qty: number; valuation_rate?: number }>,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [systemItems, setSystemItems] = useState<Map<string, { actual_qty: number; valuation_rate: number }>>(new Map())
  const [binLoadError, setBinLoadError] = useState(false)

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
    if (count) {
      setForm({
        company: count.company,
        warehouse: count.set_warehouse ?? "",
        posting_date: count.posting_date,
        items: count.items.map((i) => ({
          item_code: i.item_code,
          warehouse: i.warehouse,
          qty: i.qty,
          valuation_rate: i.valuation_rate,
        })),
      })
      setSystemItems(new Map(count.items.map((i) => [
        i.item_code,
        { actual_qty: i.current_qty ?? 0, valuation_rate: i.current_valuation_rate ?? 0 },
      ])))
    }
  }, [count])

  useEffect(() => {
    if (count) return
    if (!form.warehouse) { setSystemItems(new Map()); return }
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(["item_code", "actual_qty", "valuation_rate"]))
    qp.set("filters", JSON.stringify([["warehouse", "=", form.warehouse]]))
    qp.set("limit_page_length", "0")
    apiClient<Array<{ item_code: string; actual_qty: number; valuation_rate: number }>>(`/resource/Bin?${qp.toString()}`)
      .then((rows) => { setSystemItems(new Map(rows.map((r) => [r.item_code, { actual_qty: r.actual_qty, valuation_rate: r.valuation_rate }]))); setBinLoadError(false) })
      .catch(() => { setSystemItems(new Map()); setBinLoadError(true) })
  }, [form.warehouse, count])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { item_code: "", warehouse: prev.warehouse, qty: 0, valuation_rate: undefined }],
    }))
  }

  const removeItem = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }

  const updateItem = (idx: number, field: string, value: string | number | undefined) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.company) { setError("Company is required."); return }
    if (!form.warehouse) { setError("Warehouse is required."); return }
    if (form.items.length === 0) { setError("Add at least one item to count."); return }
    for (const item of form.items) {
      if (!item.item_code.trim()) { setError("All items need an item code."); return }
    }
    setSaving(true)
    try {
      const items = form.items.map((i) => ({
        ...i,
        warehouse: i.warehouse || form.warehouse,
      }))
      if (count) {
        const updated = await inventoryService.createCount({
          company: form.company,
          set_warehouse: form.warehouse,
          items,
          posting_date: form.posting_date,
        })
        onSaved(updated.name)
      } else {
        const created = await inventoryService.createCount({
          company: form.company,
          set_warehouse: form.warehouse,
          items,
          posting_date: form.posting_date,
        })
        onSaved(created.name)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save stock count.")
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
      {binLoadError && (
        <p className="text-sm text-warning-600 bg-warning-50 border border-warning-100 px-3 py-2.5 rounded-[10px]">Could not load system stock data for the selected warehouse. Expected quantities may not be available.</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="company" className={labelClass}>Company *</label>
          <select id="company" name="company" value={form.company} onChange={handleChange} className={inputClass} disabled={!!count}>
            <option value="">Select company...</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="posting_date" className={labelClass}>Posting Date</label>
          <input id="posting_date" name="posting_date" type="date" value={form.posting_date} onChange={handleChange} className={inputClass} />
        </div>
        <div className="col-span-2">
          <label htmlFor="warehouse" className={labelClass}>Warehouse *</label>
          <select id="warehouse" name="warehouse" value={form.warehouse} onChange={handleChange} className={inputClass}>
            <option value="">Select warehouse...</option>
            {warehouses.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">Items to Count</p>
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
            {form.items.map((item, idx) => {
              const systemBin = systemItems.get(item.item_code)
              const currentQty = systemBin?.actual_qty ?? 0
              const variance = item.qty - currentQty
              return (
              <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-[12px]">
                <input
                  placeholder="Item Code"
                  value={item.item_code}
                  onChange={(e) => updateItem(idx, "item_code", e.target.value)}
                  className="flex-[1.5] px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <div className="w-20 px-3 py-2 bg-gray-100 rounded-[10px] text-xs text-muted text-center tabular-nums">
                  {item.item_code && systemBin ? currentQty : "—"}
                </div>
                <input
                  type="number"
                  min={0}
                  placeholder="Actual Qty"
                  value={item.qty}
                  onChange={(e) => updateItem(idx, "qty", parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body text-right focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                {item.item_code && systemBin ? (
                  <span className={cn(
                    "w-20 text-sm font-semibold tabular-nums text-right",
                    variance === 0 ? "text-success-600" : "text-danger-600"
                  )}>
                    {variance > 0 ? "+" : ""}{variance}
                  </span>
                ) : (
                  <span className="w-20 text-xs text-muted text-right">—</span>
                )}
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Rate"
                  value={item.valuation_rate ?? ""}
                  onChange={(e) => updateItem(idx, "valuation_rate", e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-24 px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body text-right focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                />
                <button type="button" onClick={() => removeItem(idx)}
                  className="p-2 text-muted hover:text-danger-600 transition-colors">
                  <X size={16} />
                </button>
              </div>
              )
            })}
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
          {saving ? "Saving..." : count ? "Update Count" : "Create Stock Count"}
        </button>
      </div>
    </form>
  )
}
