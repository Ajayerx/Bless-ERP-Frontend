import { useState, useEffect } from "react"
import { Save, Loader2 } from "lucide-react"
import { productService, type ProductDetail, type ProductFormData } from "@/services"

interface ProductFormProps {
  product?: ProductDetail | null
  onSaved: () => void
  onCancel: () => void
}

const emptyForm: ProductFormData = {
  item_code: "",
  item_name: "",
  item_group: "",
  stock_uom: "Nos",
  standard_rate: 0,
  valuation_rate: 0,
  opening_stock: 0,
  description: "",
  brand: "",
  image: "",
  is_stock_item: true,
  disabled: false,
  weight_per_unit: 0,
  weight_uom: "",
  company: "",
  default_warehouse: "",
}

export default function ProductForm({ product, onSaved, onCancel }: ProductFormProps) {
  const isEdit = !!product
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [loadingLookups, setLoadingLookups] = useState(true)
  const [itemGroups, setItemGroups] = useState<string[]>([])
  const [uoms, setUoms] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      setLoadingLookups(true)
      try {
        const [groups, uomList, brandList, whList, compList] = await Promise.all([
          productService.lookups.itemGroups(),
          productService.lookups.uoms(),
          productService.lookups.brands(),
          productService.lookups.warehouses(),
          productService.lookups.companies(),
        ])
        if (cancelled) return
        setItemGroups(groups)
        setUoms(uomList)
        setBrands(brandList)
        setWarehouses(whList)
        setCompanies(compList)
      } catch {
        if (!cancelled) setError("Failed to load dropdown options.")
      } finally {
        if (!cancelled) setLoadingLookups(false)
      }
    }
    loadLookups()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!product) {
      setForm(emptyForm)
      return
    }
    setForm({
      item_code: product.item_code,
      item_name: product.item_name,
      item_group: product.item_group ?? "",
      stock_uom: product.stock_uom,
      standard_rate: product.standard_rate,
      valuation_rate: product.valuation_rate ?? 0,
      opening_stock: product.opening_stock ?? 0,
      description: product.description ?? "",
      brand: product.brand ?? "",
      image: product.image ?? "",
      is_stock_item: !!product.is_stock_item,
      disabled: !!product.disabled,
      weight_per_unit: product.weight_per_unit ?? 0,
      weight_uom: product.weight_uom ?? "",
      company: product.item_defaults[0]?.company ?? "",
      default_warehouse: product.default_warehouse ?? "",
    })
  }, [product])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
            ? parseFloat(value) || 0
            : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!form.item_name.trim()) {
      setError("Product name is required.")
      return
    }
    if (!form.item_code.trim()) {
      setError("Item code is required.")
      return
    }

    setSaving(true)
    try {
      if (isEdit && product) {
        await productService.update(product.name, form)
      } else {
        await productService.create(form)
      }
      onSaved()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save product. Please try again."
      )
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass =
    "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  const LinkSelect = ({
    name, value, options, placeholder = "Select…",
  }: {
    name: string; value: string | undefined; options: string[]; placeholder?: string
  }) => (
    <select
      name={name}
      value={value ?? ""}
      onChange={handleChange}
      className={inputClass}
      disabled={loadingLookups}
    >
      <option value="">{loadingLookups ? "Loading…" : placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  )

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="item_name" className={labelClass}>Product Name *</label>
          <input
            id="item_name" name="item_name" value={form.item_name} onChange={handleChange}
            className={inputClass} placeholder="Widget Pro"
          />
        </div>
        <div>
          <label htmlFor="item_code" className={labelClass}>Item Code *</label>
          <input
            id="item_code" name="item_code" value={form.item_code} onChange={handleChange}
            className={inputClass} placeholder="WGT-PRO-001"
          />
        </div>
        <div>
          <label className={labelClass}>Item Group</label>
          <LinkSelect name="item_group" value={form.item_group} options={itemGroups} placeholder="Select a group" />
        </div>
        <div>
          <label className={labelClass}>Unit of Measure</label>
          <LinkSelect name="stock_uom" value={form.stock_uom} options={uoms} placeholder="Nos, kg, m…" />
        </div>
        <div>
          <label className={labelClass}>Brand</label>
          <LinkSelect name="brand" value={form.brand} options={brands} placeholder="Select a brand" />
        </div>
        <div className="col-span-2">
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea
            id="description" name="description" value={form.description} onChange={handleChange}
            rows={2} className={inputClass} placeholder="Product description..."
          />
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-heading mb-3">Pricing</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="standard_rate" className={labelClass}>Selling Price</label>
            <input
              id="standard_rate" name="standard_rate" type="number" min={0} step={0.01}
              value={form.standard_rate} onChange={handleChange}
              className={inputClass} placeholder="0.00"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            id="is_stock_item" name="is_stock_item" type="checkbox"
            checked={form.is_stock_item}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="is_stock_item" className="text-sm text-body font-semibold">Maintain stock for this item</label>
        </div>

        {form.is_stock_item && (
          <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-[12px] p-4 border border-border">
            <p className="col-span-2 text-xs font-semibold text-muted uppercase tracking-wider">Initial Stock Setup</p>
            <div>
              <label className={labelClass}>Company</label>
              <LinkSelect name="company" value={form.company} options={companies} placeholder="Select company" />
            </div>
            <div>
              <label className={labelClass}>Default Warehouse *</label>
              <LinkSelect name="default_warehouse" value={form.default_warehouse} options={warehouses} placeholder="Select warehouse" />
            </div>
            <div>
              <label htmlFor="opening_stock" className={labelClass}>Opening Stock Qty</label>
              <input
                id="opening_stock" name="opening_stock" type="number" min={0} step={1}
                value={form.opening_stock} onChange={handleChange}
                className={inputClass} placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="valuation_rate" className={labelClass}>Valuation Rate (per unit)</label>
              <input
                id="valuation_rate" name="valuation_rate" type="number" min={0} step={0.01}
                value={form.valuation_rate} onChange={handleChange}
                className={inputClass} placeholder="0.00"
              />
              <p className="text-[11px] text-muted mt-1">ERPNext uses this rate to create the opening stock Stock Entry.</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <input
            id="disabled" name="disabled" type="checkbox"
            checked={form.disabled}
            onChange={handleChange}
            className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="disabled" className="text-sm text-body">Disabled (inactive item)</label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button" onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit" disabled={saving || loadingLookups}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Saving..." : isEdit ? "Update Product" : "Create Product"}
        </button>
      </div>
    </form>
  )
}
