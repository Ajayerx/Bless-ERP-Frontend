"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui"
import { supplierService, type SupplierFormData } from "@/services"

export default function SupplierForm() {
  const navigate = useNavigate()
  const [form, setForm] = useState<SupplierFormData>({
    name: "",
    contactName: "",
    email: "",
    phone: "",
    billingAddress: "",
    taxId: "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim()) {
      setError("Supplier name and email are required.")
      return
    }
    setSaving(true)
    try {
      await supplierService.create(form)
      navigate("/suppliers")
    } catch {
      setError("Failed to save supplier. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/suppliers")}
            className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">New Supplier</h1>
            <p className="text-sm text-muted mt-0.5">Add a new vendor to your directory.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => navigate("/suppliers")}>Cancel</Button>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label htmlFor="name" className={labelClass}>Supplier Name *</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} className={inputClass} placeholder="ABC Supply Co." />
          </div>
          <div>
            <label htmlFor="contactName" className={labelClass}>Contact Name</label>
            <input id="contactName" name="contactName" value={form.contactName} onChange={handleChange} className={inputClass} placeholder="Jane Smith" />
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>Email *</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} className={inputClass} placeholder="jane@abcsupply.com" />
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>Phone</label>
            <input id="phone" name="phone" value={form.phone} onChange={handleChange} className={inputClass} placeholder="+1 (555) 987-6543" />
          </div>
          <div>
            <label htmlFor="taxId" className={labelClass}>Tax ID</label>
            <input id="taxId" name="taxId" value={form.taxId} onChange={handleChange} className={inputClass} placeholder="XX-XXXXXXX" />
          </div>
          <div className="col-span-2">
            <label htmlFor="billingAddress" className={labelClass}>Billing Address</label>
            <textarea id="billingAddress" name="billingAddress" value={form.billingAddress} onChange={handleChange} rows={2} className={inputClass} placeholder="300 Commerce Drive, Toronto, ON" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button type="button" onClick={() => navigate("/suppliers")}
            className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Create Supplier"}
          </button>
        </div>
      </form>
    </>
  )
}
