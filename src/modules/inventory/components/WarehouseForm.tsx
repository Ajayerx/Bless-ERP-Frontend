"use client"

import { useState, useEffect } from "react"
import { inventoryService, inventoryLookups } from "@/modules/inventory/services"
import type { Warehouse } from "@/modules/inventory/types"

type WarehouseFormData = {
  warehouse_name: string
  company: string
  parent_warehouse: string
  warehouse_type: string
  is_group: boolean
  disabled: boolean
  account: string
  address_line_1: string
  address_line_2: string
  city: string
  state: string
  pin: string
  phone_no: string
  mobile_no: string
  email_id: string
}

interface WarehouseFormProps {
  warehouse?: Warehouse | null
  onSaved: (name: string) => void
  onCancel: () => void
  onSavingChange?: (saving: boolean) => void
}

export default function WarehouseForm({ warehouse, onSaved, onSavingChange }: WarehouseFormProps) {
  const [form, setForm] = useState<WarehouseFormData>({
    warehouse_name: "",
    company: "",
    parent_warehouse: "",
    warehouse_type: "",
    is_group: false,
    disabled: false,
    account: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    state: "",
    pin: "",
    phone_no: "",
    mobile_no: "",
    email_id: "",
  })
  const [companies, setCompanies] = useState<string[]>([])
  const [parentWarehouses, setParentWarehouses] = useState<string[]>([])
  const [warehouseTypes, setWarehouseTypes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    onSavingChange?.(saving)
  }, [saving, onSavingChange])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      inventoryLookups.companies(),
      inventoryService.listWarehouses({ pageSize: 100 }).then((r) => r.items.filter((w) => w.is_group).map((w) => w.name)),
      inventoryLookups.warehouseTypes(),
    ]).then(([cos, whs, wts]) => {
      if (!cancelled) {
        setCompanies(cos)
        setParentWarehouses(whs)
        setWarehouseTypes(wts)
      }
    }).catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load dropdown options.") })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (warehouse) {
      setForm({
        warehouse_name: warehouse.warehouse_name,
        company: warehouse.company,
        parent_warehouse: warehouse.parent_warehouse ?? "",
        warehouse_type: warehouse.warehouse_type ?? "",
        is_group: warehouse.is_group === 1,
        disabled: warehouse.disabled === 1,
        account: warehouse.account ?? "",
        address_line_1: warehouse.address_line_1 ?? "",
        address_line_2: warehouse.address_line_2 ?? "",
        city: warehouse.city ?? "",
        state: warehouse.state ?? "",
        pin: warehouse.pin ?? "",
        phone_no: warehouse.phone_no ?? "",
        mobile_no: warehouse.mobile_no ?? "",
        email_id: warehouse.email_id ?? "",
      })
    }
  }, [warehouse])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.warehouse_name.trim()) {
      setError("Warehouse name is required.")
      return
    }
    if (!form.company) {
      setError("Company is required.")
      return
    }
    setSaving(true)
    try {
      const payload = {
        warehouse_name: form.warehouse_name.trim(),
        parent_warehouse: form.parent_warehouse || undefined,
        warehouse_type: form.warehouse_type || undefined,
        is_group: form.is_group ? 1 : 0,
        disabled: form.disabled ? 1 : 0,
        account: form.account || undefined,
        address_line_1: form.address_line_1 || undefined,
        address_line_2: form.address_line_2 || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pin: form.pin || undefined,
        phone_no: form.phone_no || undefined,
        mobile_no: form.mobile_no || undefined,
        email_id: form.email_id || undefined,
      }
      if (warehouse) {
        const updated = await inventoryService.updateWarehouse(warehouse.name, payload as any)
        onSaved(updated.name)
      } else {
        const created = await inventoryService.createWarehouse({
          ...payload,
          company: form.company,
        } as any)
        onSaved(created.name)
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to save warehouse. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <form id="warehouse-form" onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="warehouse_name" className={labelClass}>Warehouse Name *</label>
          <input id="warehouse_name" name="warehouse_name" value={form.warehouse_name} onChange={handleChange} className={inputClass} placeholder="Main Warehouse" />
        </div>
        <div>
          <label htmlFor="company" className={labelClass}>Company *</label>
          <select id="company" name="company" value={form.company} onChange={handleChange} className={inputClass} disabled={!!warehouse}>
            <option value="">Select company...</option>
            {companies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="parent_warehouse" className={labelClass}>Parent Warehouse</label>
          <select id="parent_warehouse" name="parent_warehouse" value={form.parent_warehouse} onChange={handleChange} className={inputClass}>
            <option value="">None (root)</option>
            {parentWarehouses.filter((w) => w !== warehouse?.name).map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="warehouse_type" className={labelClass}>Warehouse Type</label>
          <select id="warehouse_type" name="warehouse_type" value={form.warehouse_type} onChange={handleChange} className={inputClass}>
            <option value="">Select type...</option>
            {warehouseTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-end gap-6 pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="is_group" checked={form.is_group} onChange={handleChange} className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500/20" />
            <span className="text-sm font-semibold text-body">Is Group</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="disabled" checked={form.disabled} onChange={handleChange} className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500/20" />
            <span className="text-sm font-semibold text-body">Disabled</span>
          </label>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Address</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="address_line_1" className={labelClass}>Address Line 1</label>
            <input id="address_line_1" name="address_line_1" value={form.address_line_1} onChange={handleChange} className={inputClass} placeholder="123 Main St" />
          </div>
          <div className="col-span-2">
            <label htmlFor="address_line_2" className={labelClass}>Address Line 2</label>
            <input id="address_line_2" name="address_line_2" value={form.address_line_2} onChange={handleChange} className={inputClass} placeholder="Suite 100" />
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>City</label>
            <input id="city" name="city" value={form.city} onChange={handleChange} className={inputClass} placeholder="New York" />
          </div>
          <div>
            <label htmlFor="state" className={labelClass}>State</label>
            <input id="state" name="state" value={form.state} onChange={handleChange} className={inputClass} placeholder="NY" />
          </div>
          <div>
            <label htmlFor="pin" className={labelClass}>PIN Code</label>
            <input id="pin" name="pin" value={form.pin} onChange={handleChange} className={inputClass} placeholder="10001" />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Contact</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone_no" className={labelClass}>Phone</label>
            <input id="phone_no" name="phone_no" value={form.phone_no} onChange={handleChange} className={inputClass} placeholder="+1 555-0001" />
          </div>
          <div>
            <label htmlFor="mobile_no" className={labelClass}>Mobile</label>
            <input id="mobile_no" name="mobile_no" value={form.mobile_no} onChange={handleChange} className={inputClass} placeholder="+1 555-0002" />
          </div>
          <div className="col-span-2">
            <label htmlFor="email_id" className={labelClass}>Email</label>
            <input id="email_id" name="email_id" value={form.email_id} onChange={handleChange} className={inputClass} placeholder="warehouse@example.com" />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Accounting</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="account" className={labelClass}>Account</label>
            <input id="account" name="account" value={form.account} onChange={handleChange} className={inputClass} placeholder="Auto-created on submit" readOnly />
          </div>
        </div>
      </div>
    </form>
  )
}

