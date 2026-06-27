import { useState, useEffect } from "react"
import { Save } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "@/components/ui"
import { vendorService, type Vendor, type VendorFormData } from "@/services"

interface VendorFormProps {
  open: boolean
  vendor?: Vendor | null
  onSaved: () => void
  onCancel: () => void
}

const emptyForm: VendorFormData = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  billingAddress: "",
  shippingAddress: "",
  taxId: "",
}

export default function VendorForm({ open, vendor, onSaved, onCancel }: VendorFormProps) {
  const isEdit = !!vendor
  const [form, setForm] = useState<VendorFormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name,
        contactName: vendor.contactName,
        email: vendor.email,
        phone: vendor.phone,
        billingAddress: vendor.billingAddress,
        shippingAddress: vendor.shippingAddress,
        taxId: vendor.taxId,
      })
    } else {
      setForm(emptyForm)
    }
  }, [vendor])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim()) {
      setError("Vendor name and email are required.")
      return
    }
    setSaving(true)
    try {
      if (isEdit && vendor) {
        await vendorService.update(vendor.id, form)
      } else {
        await vendorService.create(form)
      }
      onSaved()
    } catch {
      setError("Failed to save vendor. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
  const labelClass = "block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Vendor" : "Add Vendor"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update vendor information." : "Create a new vendor record."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="name" className={labelClass}>Vendor Name *</label>
              <input id="name" name="name" value={form.name} onChange={handleChange}
                className={inputClass} placeholder="Global Supplies Inc" />
            </div>
            <div>
              <label htmlFor="contactName" className={labelClass}>Contact Name</label>
              <input id="contactName" name="contactName" value={form.contactName}
                onChange={handleChange} className={inputClass} placeholder="Alice Wang" />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email *</label>
              <input id="email" name="email" type="email" value={form.email}
                onChange={handleChange} className={inputClass} placeholder="alice@company.com" />
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone</label>
              <input id="phone" name="phone" value={form.phone} onChange={handleChange}
                className={inputClass} placeholder="+1 (555) 0101" />
            </div>
            <div>
              <label htmlFor="taxId" className={labelClass}>Tax ID</label>
              <input id="taxId" name="taxId" value={form.taxId} onChange={handleChange}
                className={inputClass} placeholder="GST-XXXXXX" />
            </div>
            <div className="col-span-2">
              <label htmlFor="billingAddress" className={labelClass}>Billing Address</label>
              <textarea id="billingAddress" name="billingAddress" value={form.billingAddress}
                onChange={handleChange} rows={2} className={inputClass + " resize-none"}
                placeholder="100 Commerce Dr, Chicago, IL 60601" />
            </div>
            <div className="col-span-2">
              <label htmlFor="shippingAddress" className={labelClass}>Shipping Address</label>
              <textarea id="shippingAddress" name="shippingAddress" value={form.shippingAddress}
                onChange={handleChange} rows={2} className={inputClass + " resize-none"}
                placeholder="Same as billing" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={saving} loading={saving}>
              <Save size={16} />
              {saving ? "Saving..." : isEdit ? "Update Vendor" : "Create Vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
