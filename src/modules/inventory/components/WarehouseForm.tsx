"use client"

import { useState, useEffect } from "react"
import { Save, Loader2 } from "lucide-react"
import { inventoryService } from "@/modules/inventory/services"
import type { Warehouse } from "@/modules/inventory/types"

type WarehouseFormData = {
  name: string
  location: string
  capacity: number
  status: Warehouse["status"]
}

interface WarehouseFormProps {
  warehouse?: Warehouse | null
  onSaved: () => void
  onCancel: () => void
}

export default function WarehouseForm({ warehouse, onSaved, onCancel }: WarehouseFormProps) {
  const [form, setForm] = useState<WarehouseFormData>({
    name: "",
    location: "",
    capacity: 1000,
    status: "active",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (warehouse) {
      setForm({
        name: warehouse.name,
        location: warehouse.location,
        capacity: warehouse.capacity,
        status: warehouse.status,
      })
    }
  }, [warehouse])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim()) {
      setError("Warehouse name is required.")
      return
    }
    setSaving(true)
    try {
      if (warehouse) {
        await inventoryService.updateWarehouse(warehouse.id, form)
      } else {
        await inventoryService.createWarehouse(form)
      }
      onSaved()
    } catch {
      setError("Failed to save warehouse. Please try again.")
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
        <div className="col-span-2">
          <label htmlFor="name" className={labelClass}>Warehouse Name *</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} className={inputClass} placeholder="Main Warehouse" />
        </div>
        <div className="col-span-2">
          <label htmlFor="location" className={labelClass}>Location</label>
          <input id="location" name="location" value={form.location} onChange={handleChange} className={inputClass} placeholder="123 Industrial Ave, City" />
        </div>
        <div>
          <label htmlFor="capacity" className={labelClass}>Capacity (units)</label>
          <input id="capacity" name="capacity" type="number" min={1} value={form.capacity} onChange={handleChange} className={inputClass} placeholder="1000" />
        </div>
        <div>
          <label htmlFor="status" className={labelClass}>Status</label>
          <select id="status" name="status" value={form.status} onChange={handleChange} className={inputClass}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : warehouse ? "Update Warehouse" : "Create Warehouse"}
        </button>
      </div>
    </form>
  )
}
