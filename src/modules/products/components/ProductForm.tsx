import { useState, useEffect } from "react"
import { productService, type ProductDetail, type ProductFormData } from "@/services"

interface ProductFormProps {
  product?: ProductDetail | null
  onSaved: () => void
  onCancel: () => void
  onSavingChange?: (saving: boolean) => void
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
  is_sales_item: true,
  is_purchase_item: true,
  disabled: false,
  has_batch_no: false,
  has_serial_no: false,
  has_variants: false,
  valuation_method: "",
  end_of_life: "",
  warranty_period: "",
  allow_negative_stock: false,
  purchase_uom: "",
  sales_uom: "",
  max_discount: 0,
  safety_stock: 0,
  min_order_qty: 0,
  lead_time_days: 0,
  weight_per_unit: 0,
  weight_uom: "",
  company: "",
  default_warehouse: "",
  income_account: "",
  cost_center: "",
  default_price_list: "",
}

export default function ProductForm({ product, onSaved, onSavingChange }: ProductFormProps) {
  const isEdit = !!product
  const [form, setForm] = useState<ProductFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    onSavingChange?.(saving)
  }, [saving, onSavingChange])

  const [loadingLookups, setLoadingLookups] = useState(true)
  const [itemGroups, setItemGroups] = useState<string[]>([])
  const [uoms, setUoms] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [companies, setCompanies] = useState<string[]>([])
  const [accounts, setAccounts] = useState<string[]>([])
  const [costCenters, setCostCenters] = useState<string[]>([])
  const [priceLists, setPriceLists] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function loadLookups() {
      setLoadingLookups(true)
      try {
        const [groups, uomList, brandList, whList, compList, acctList, ccList, plList] = await Promise.all([
          productService.lookups.itemGroups(),
          productService.lookups.uoms(),
          productService.lookups.brands(),
          productService.lookups.warehouses(),
          productService.lookups.companies(),
          productService.lookups.accounts(),
          productService.lookups.costCenters(),
          productService.lookups.priceLists(),
        ])
        if (cancelled) return
        setItemGroups(groups)
        setUoms(uomList)
        setBrands(brandList)
        setWarehouses(whList)
        setCompanies(compList)
        setAccounts(acctList)
        setCostCenters(ccList)
        setPriceLists(plList)
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
      is_sales_item: product.is_sales_item !== 0,
      is_purchase_item: product.is_purchase_item !== 0,
      disabled: !!product.disabled,
      has_batch_no: !!product.has_batch_no,
      has_serial_no: !!product.has_serial_no,
      has_variants: !!product.has_variants,
      valuation_method: product.valuation_method ?? "",
      end_of_life: product.end_of_life ?? "",
      warranty_period: product.warranty_period ?? "",
      allow_negative_stock: !!product.allow_negative_stock,
      purchase_uom: product.purchase_uom ?? "",
      sales_uom: product.sales_uom ?? "",
      max_discount: product.max_discount ?? 0,
      safety_stock: product.safety_stock ?? 0,
      min_order_qty: product.min_order_qty ?? 0,
      lead_time_days: product.lead_time_days ?? 0,
      weight_per_unit: product.weight_per_unit ?? 0,
      weight_uom: product.weight_uom ?? "",
      company: product.item_defaults[0]?.company ?? "",
      default_warehouse: product.default_warehouse ?? "",
      income_account: product.income_account ?? product.item_defaults[0]?.income_account ?? "",
      cost_center: product.cost_center ?? product.item_defaults[0]?.cost_center ?? "",
      default_price_list: product.item_defaults[0]?.default_price_list ?? "",
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
    <form id="product-form" onSubmit={handleSubmit} className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
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
        {!isEdit ? (
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
        ) : (
          <p className="text-xs text-muted bg-gray-50 border border-border rounded-[10px] px-3 py-2">
            Selling price is managed via <span className="font-medium">Item Price</span> records.
          </p>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-center gap-2 mb-3">
          <input
            id="is_stock_item" name="is_stock_item" type="checkbox"
            checked={form.is_stock_item}
            onChange={handleChange}
            disabled={isEdit}
            className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <label htmlFor="is_stock_item" className="text-sm text-body font-semibold">Maintain stock for this item</label>
        </div>
        {isEdit && (
          <p className="text-[11px] text-muted mb-3 -mt-1">Cannot be changed after a stock transaction exists.</p>
        )}

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
              <label className={labelClass}>Income Account</label>
              <LinkSelect name="income_account" value={form.income_account} options={accounts} placeholder="Select income account" />
            </div>
            <div>
              <label className={labelClass}>Cost Center</label>
              <LinkSelect name="cost_center" value={form.cost_center} options={costCenters} placeholder="Select cost center" />
            </div>
            <div>
              <label className={labelClass}>Default Price List</label>
              <LinkSelect name="default_price_list" value={form.default_price_list} options={priceLists} placeholder="Select price list" />
            </div>
            {!isEdit && (
              <div>
                <label htmlFor="opening_stock" className={labelClass}>Opening Stock Qty</label>
                <input
                  id="opening_stock" name="opening_stock" type="number" min={0} step={1}
                  value={form.opening_stock} onChange={handleChange}
                  className={inputClass} placeholder="0"
                />
              </div>
            )}
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
        <h3 className="text-sm font-semibold text-heading mb-3">Sales & Purchase</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <input
              id="is_sales_item" name="is_sales_item" type="checkbox"
              checked={form.is_sales_item} onChange={handleChange}
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_sales_item" className="text-sm text-body">Allow in Sales</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="is_purchase_item" name="is_purchase_item" type="checkbox"
              checked={form.is_purchase_item} onChange={handleChange}
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_purchase_item" className="text-sm text-body">Allow in Purchase</label>
          </div>
          <div>
            <label className={labelClass}>Sales UOM</label>
            <LinkSelect name="sales_uom" value={form.sales_uom} options={uoms} placeholder="Same as Stock UOM" />
          </div>
          <div>
            <label className={labelClass}>Purchase UOM</label>
            <LinkSelect name="purchase_uom" value={form.purchase_uom} options={uoms} placeholder="Same as Stock UOM" />
          </div>
          <div>
            <label htmlFor="max_discount" className={labelClass}>Max Discount %</label>
            <input
              id="max_discount" name="max_discount" type="number" min={0} step={0.01}
              value={form.max_discount} onChange={handleChange}
              className={inputClass} placeholder="0"
            />
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-sm font-semibold text-heading mb-3">Inventory Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Valuation Method</label>
            <select name="valuation_method" value={form.valuation_method} onChange={handleChange} className={inputClass}>
              <option value="">Default (from Stock Settings)</option>
              <option value="FIFO">FIFO</option>
              <option value="Moving Average">Moving Average</option>
              <option value="LIFO">LIFO</option>
              <option value="Standard Cost">Standard Cost</option>
            </select>
          </div>
          <div>
            <label htmlFor="end_of_life" className={labelClass}>End of Life</label>
            <input
              id="end_of_life" name="end_of_life" type="date"
              value={form.end_of_life} onChange={handleChange}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="warranty_period" className={labelClass}>Warranty Period (days)</label>
            <input
              id="warranty_period" name="warranty_period"
              value={form.warranty_period} onChange={handleChange}
              className={inputClass} placeholder="e.g. 365"
            />
          </div>
          <div>
            <label htmlFor="safety_stock" className={labelClass}>Safety Stock</label>
            <input
              id="safety_stock" name="safety_stock" type="number" min={0} step={1}
              value={form.safety_stock} onChange={handleChange}
              className={inputClass} placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="min_order_qty" className={labelClass}>Min Order Qty</label>
            <input
              id="min_order_qty" name="min_order_qty" type="number" min={0} step={1}
              value={form.min_order_qty} onChange={handleChange}
              className={inputClass} placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="lead_time_days" className={labelClass}>Lead Time (days)</label>
            <input
              id="lead_time_days" name="lead_time_days" type="number" min={0} step={1}
              value={form.lead_time_days} onChange={handleChange}
              className={inputClass} placeholder="0"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="has_batch_no" name="has_batch_no" type="checkbox"
              checked={form.has_batch_no} onChange={handleChange}
              disabled={isEdit}
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="has_batch_no" className="text-sm text-body">Batch Tracking</label>
          </div>
          {isEdit && (
            <p className="text-[11px] text-muted col-span-2 -mt-2">Cannot be changed after a stock transaction exists.</p>
          )}
          <div className="flex items-center gap-2">
            <input
              id="has_serial_no" name="has_serial_no" type="checkbox"
              checked={form.has_serial_no} onChange={handleChange}
              disabled={isEdit}
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="has_serial_no" className="text-sm text-body">Serial Number Tracking</label>
          </div>
          {isEdit && (
            <p className="text-[11px] text-muted col-span-2 -mt-2">Cannot be changed after a stock transaction exists.</p>
          )}
          <div className="flex items-center gap-2">
            <input
              id="allow_negative_stock" name="allow_negative_stock" type="checkbox"
              checked={form.allow_negative_stock} onChange={handleChange}
              className="w-4 h-4 rounded border-border text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="allow_negative_stock" className="text-sm text-body">Allow Negative Stock</label>
          </div>
        </div>
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
    </form>
  )
}
