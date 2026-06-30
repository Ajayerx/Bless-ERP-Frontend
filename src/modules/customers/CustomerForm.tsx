import { useState, useEffect } from "react"
import { Save, Loader2 } from "lucide-react"
import { customerService, type Customer, type CustomerFormData } from "../../services"

interface CustomerFormProps {
  customer?: Customer | null
  onSaved: () => void
  onCancel: () => void
}

const emptyForm: CustomerFormData = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  billingAddress: "",
  shippingAddress: "",
  taxId: "",
  creditLimit: 0,
}

export default function CustomerForm({ customer, onSaved, onCancel }: CustomerFormProps) {
  const isEdit = !!customer
  const [form, setForm] = useState<CustomerFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name,
        contactName: customer.contactName,
        email: customer.email,
        phone: customer.phone,
        billingAddress: customer.billingAddress,
        shippingAddress: customer.shippingAddress,
        taxId: customer.taxId,
        creditLimit: customer.creditLimit,
      })
    }
  }, [customer])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: name === "creditLimit" ? Number(value) : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim()) {
      setError("Customer name and email are required.")
      return
    }
    setSaving(true)
    try {
      if (isEdit && customer) {
        await customerService.update(customer.id, form)
      } else {
        await customerService.create(form)
      }
      onSaved()
    } catch {
      setError("Failed to save customer. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

  const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label htmlFor="name" className={labelClass}>
            Customer Name *
          </label>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={handleChange}
            className={inputClass}
            placeholder="Acme Corp"
          />
        </div>

        <div>
          <label htmlFor="contactName" className={labelClass}>
            Contact Name
          </label>
          <input
            id="contactName"
            name="contactName"
            value={form.contactName}
            onChange={handleChange}
            className={inputClass}
            placeholder="John Anderson"
          />
        </div>

        <div>
          <label htmlFor="email" className={labelClass}>
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
            placeholder="john@company.com"
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className={inputClass}
            placeholder="+1 (555) 123-4567"
          />
        </div>

        <div>
          <label htmlFor="taxId" className={labelClass}>
            Tax ID
          </label>
          <input
            id="taxId"
            name="taxId"
            value={form.taxId}
            onChange={handleChange}
            className={inputClass}
            placeholder="XX-XXXXXXX"
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="billingAddress" className={labelClass}>
            Billing Address
          </label>
          <textarea
            id="billingAddress"
            name="billingAddress"
            value={form.billingAddress}
            onChange={handleChange}
            rows={2}
            className={inputClass}
            placeholder="1200 Main Street, Suite 400, New York, NY 10001"
          />
        </div>

        <div className="col-span-2">
          <label htmlFor="shippingAddress" className={labelClass}>
            Shipping Address
          </label>
          <textarea
            id="shippingAddress"
            name="shippingAddress"
            value={form.shippingAddress}
            onChange={handleChange}
            rows={2}
            className={inputClass}
            placeholder="Same as billing"
          />
        </div>

        <div>
          <label htmlFor="creditLimit" className={labelClass}>
            Credit Limit
          </label>
          <input
            id="creditLimit"
            name="creditLimit"
            type="number"
            min={0}
            value={form.creditLimit}
            onChange={handleChange}
            className={inputClass}
            placeholder="50000"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {saving
            ? "Saving..."
            : isEdit
              ? "Update Customer"
              : "Create Customer"}
        </button>
      </div>
    </form>
  )
}
