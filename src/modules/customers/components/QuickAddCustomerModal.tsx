"use client"
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { apiClient } from "@/services/api-client"
import { customerService } from "@/modules/customers/services"
import { contactService } from "@/services"
import type { AddressInput } from "@/modules/customers/services"

interface Props {
  open: boolean
  onClose: () => void
}

function hasAnyValue(obj: Record<string, string | undefined>): boolean {
  return Object.values(obj).some((v) => v && v.trim().length > 0)
}

export default function QuickAddCustomerModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState("")
  const [customerType, setCustomerType] = useState<"Company" | "Individual" | "Partnership">("Company")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [addrLine1, setAddrLine1] = useState("")
  const [addrLine2, setAddrLine2] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [pincode, setPincode] = useState("")
  const [country, setCountry] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const reset = () => {
    setCustomerName("")
    setCustomerType("Company")
    setFirstName("")
    setLastName("")
    setEmail("")
    setMobile("")
    setAddrLine1("")
    setAddrLine2("")
    setCity("")
    setState("")
    setPincode("")
    setCountry("")
    setError("")
    setSaving(false)
  }

  const handleSave = async () => {
    setError("")
    if (!customerName.trim()) {
      setError("Customer Name is required.")
      return
    }

    setSaving(true)
    try {
      const row = await customerService.create({
        customer_name: customerName.trim(),
        customer_type: customerType,
        customer_group: "",
        territory: "",
        so_required: false,
        dn_required: false,
        is_frozen: false,
        disabled: false,
        is_internal_customer: false,
      })

      const patch: Record<string, string> = {}
      const contactFilled = hasAnyValue({ firstName, lastName, email, mobile })
      const addressFilled = hasAnyValue({ addrLine1, city, country })

      if (contactFilled) {
        const contact = await contactService.create({
          first_name: firstName || customerName.trim(),
          last_name: lastName || "",
          email_ids: email ? [{ email_id: email, is_primary: 1 }] : [],
          phone_nos: mobile ? [{ phone: mobile, is_primary_mobile_no: 1 }] : [],
          links: [{ link_doctype: "Customer", link_name: row.name }],
          is_primary_contact: true,
          is_billing_contact: false,
        })
        patch.customer_primary_contact = contact.name
      }

      if (addressFilled) {
        try {
          const addrInput: AddressInput = {
            address_line1: addrLine1,
            address_line2: addrLine2 || undefined,
            city: city,
            state: state || undefined,
            country: country,
            pincode: pincode || undefined,
          }
          const addr = await customerService.createAddress(
            row.name,
            "Billing",
            addrInput
          )
          patch.customer_primary_address = addr.name
        } catch (e) {
          console.error("Failed to create address, contact back-fill still proceeds", e)
        }
      }

      if (Object.keys(patch).length > 0) {
        await apiClient<Record<string, unknown>>(
          `/resource/Customer/${encodeURIComponent(row.name)}`,
          { method: "PUT", body: JSON.stringify(patch) }
        )
      }

      reset()
      onClose()
      navigate(`/customers/${row.name}`)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create customer."
      )
    } finally {
      setSaving(false)
    }
  }

  const handleEditFullForm = () => {
    reset()
    onClose()
    navigate("/customers/new", {
      state: { customer_name: customerName.trim() || undefined, customer_type: customerType },
    })
  }

  const inputClass =
    "w-full px-3 py-2 bg-white border border-border rounded-[10px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
  const labelClass = "block text-xs font-semibold text-muted mb-1 uppercase tracking-wider"
  const sectionLabel = "text-sm font-semibold text-heading mb-3"

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Add Customer" size="lg">
      <div className="max-h-[65vh] overflow-y-auto space-y-5">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className={labelClass}>Customer Name *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputClass}
              placeholder="John Doe / Acme Corp"
              autoFocus
            />
          </div>
          <div>
            <label className={labelClass}>Customer Type *</label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
              className={inputClass}
            >
              <option value="Company">Company</option>
              <option value="Individual">Individual</option>
              <option value="Partnership">Partnership</option>
            </select>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className={sectionLabel}>Primary Contact Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>First Name</label>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Last Name</label>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Id</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Mobile Number</label>
              <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className={sectionLabel}>Primary Address Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Address Line 1</label>
              <input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Address Line 2</label>
              <input value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>City / Town</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>State / Province</label>
              <input value={state} onChange={(e) => setState(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>ZIP / Postal Code</label>
              <input value={pincode} onChange={(e) => setPincode(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <ModalFooter>
        <button
          type="button"
          onClick={handleEditFullForm}
          className="px-4 py-2 text-sm font-semibold text-muted bg-white border border-border rounded-[10px] hover:bg-gray-50 transition-colors"
        >
          Edit Full Form
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-[10px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </ModalFooter>
    </Modal>
  )
}
