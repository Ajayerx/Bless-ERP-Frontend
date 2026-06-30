"use client"

import { useState, useEffect } from "react"
import { Save, Loader2 } from "lucide-react"
import { productService } from "@/services"
import type { Product } from "@/services/products.service"

type ProductFormData = Omit<Product, "id">

interface ProductFormProps {
  product?: Product | null
  onSaved: () => void
  onCancel: () => void
}

export default function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const [form, setForm] = useState<ProductFormData>({
    sku: "",
    name: "",
    category: "",
    price: 0,
    cost: 0,
    stock: 0,
    unit: "ea",
    description: "",
    warehouse: "",
    taxable: true,
    reorderLevel: 10,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (product) {
      const { id, ...data } = product
      setForm(data)
    }
  }, [product])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "number" ? parseFloat(value) || 0 : type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.sku.trim()) {
      setError("Product name and SKU are required.")
      return
    }
    setSaving(true)
    try {
      if (product) {
        await productService.update(product.id, form)
      } else {
        await productService.create(form)
      }
      onSaved()
    } catch {
      setError("Failed to save product. Please try again.")
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
          <label htmlFor="name" className={labelClass}>Product Name *</label>
          <input id="name" name="name" value={form.name} onChange={handleChange} className={inputClass} placeholder="Widget Pro" />
        </div>
        <div>
          <label htmlFor="sku" className={labelClass}>SKU *</label>
          <input id="sku" name="sku" value={form.sku} onChange={handleChange} className={inputClass} placeholder="WGT-PRO-001" />
        </div>
        <div>
          <label htmlFor="category" className={labelClass}>Category</label>
          <input id="category" name="category" value={form.category ?? ""} onChange={handleChange} className={inputClass} placeholder="Industrial Parts" />
        </div>
        <div>
          <label htmlFor="price" className={labelClass}>Selling Price</label>
          <input id="price" name="price" type="number" min={0} step={0.01} value={form.price} onChange={handleChange} className={inputClass} placeholder="0.00" />
        </div>
        <div>
          <label htmlFor="cost" className={labelClass}>Cost Price</label>
          <input id="cost" name="cost" type="number" min={0} step={0.01} value={form.cost ?? 0} onChange={handleChange} className={inputClass} placeholder="0.00" />
        </div>
        <div>
          <label htmlFor="stock" className={labelClass}>Stock Quantity</label>
          <input id="stock" name="stock" type="number" min={0} value={form.stock} onChange={handleChange} className={inputClass} placeholder="0" />
        </div>
        <div>
          <label htmlFor="unit" className={labelClass}>Unit</label>
          <input id="unit" name="unit" value={form.unit} onChange={handleChange} className={inputClass} placeholder="ea, kg, m" />
        </div>
        <div>
          <label htmlFor="reorderLevel" className={labelClass}>Reorder Level</label>
          <input id="reorderLevel" name="reorderLevel" type="number" min={0} value={form.reorderLevel ?? 10} onChange={handleChange} className={inputClass} placeholder="10" />
        </div>
        <div>
          <label htmlFor="warehouse" className={labelClass}>Warehouse</label>
          <input id="warehouse" name="warehouse" value={form.warehouse ?? ""} onChange={handleChange} className={inputClass} placeholder="Main Warehouse" />
        </div>
        <div className="col-span-2">
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" name="description" value={form.description ?? ""} onChange={handleChange} rows={2} className={inputClass} placeholder="Product description..." />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input id="taxable" name="taxable" type="checkbox" checked={form.taxable ?? true} onChange={(e) => setForm((prev) => ({ ...prev, taxable: e.target.checked }))} className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500" />
          <label htmlFor="taxable" className="text-sm text-body">This product is taxable</label>
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
          {saving ? "Saving..." : product ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  )
}
