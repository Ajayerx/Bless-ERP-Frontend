"use client"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { customerService } from "@/modules/customers/services"

interface Props {
  open: boolean
  onClose: () => void
}

export default function QuickAddCustomerModal({ open, onClose }: Props) {
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState("")
  const [customerType, setCustomerType] = useState<"Company" | "Individual" | "Partnership">("Company")
  const [customerGroup, setCustomerGroup] = useState("")
  const [territory, setTerritory] = useState("")
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
  const [loadingLookups, setLoadingLookups] = useState(true)
  const [customerGroups, setCustomerGroups] = useState<string[]>([])
  const [territories, setTerritories] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      setLoadingLookups(true)
      try {
        const [groups, terrs] = await Promise.all([
          customerService.lookups.customerGroups(),
          customerService.lookups.territories(),
        ])
        if (cancelled) return
        setCustomerGroups(groups)
        setTerritories(terrs)
        setCustomerGroup((prev) => prev || (groups.length > 0 ? groups[0] : ""))
        setTerritory((prev) => prev || (terrs.length > 0 ? terrs[0] : ""))
      } catch {
        if (!cancelled) setError("Failed to load dropdown options.")
      } finally {
        if (!cancelled) setLoadingLookups(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [open])

  const reset = () => {
    setCustomerName("")
    setCustomerType("Company")
    setCustomerGroup("")
    setTerritory("")
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
    if (!customerGroup) {
      setError("Customer Group is required.")
      return
    }
    if (!territory) {
      setError("Territory is required.")
      return
    }

    setSaving(true)
    try {
      const contactFilled = [firstName, lastName, email, mobile].some((v) => v && v.trim().length > 0)
      const addressFilled = [addrLine1, city, country].some((v) => v && v.trim().length > 0)

      await customerService.create({
        customer_name: customerName.trim(),
        customer_type: customerType,
        customer_group: customerGroup,
        territory: territory,
        contactEmail: contactFilled ? email || undefined : undefined,
        contactPhone: contactFilled ? mobile || undefined : undefined,
        billingAddress: addressFilled ? {
          address_line1: addrLine1,
          address_line2: addrLine2 || undefined,
          city,
          state: state || undefined,
          country,
          pincode: pincode || undefined,
        } : undefined,
        so_required: false,
        dn_required: false,
        is_frozen: false,
        disabled: false,
        is_internal_customer: false,
      })

      reset()
      onClose()
      navigate(`/customers/${customerName.trim()}`)
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
          <div>
            <label className={labelClass}>Customer Group *</label>
            <select
              value={customerGroup}
              onChange={(e) => setCustomerGroup(e.target.value)}
              className={inputClass}
              disabled={loadingLookups}
            >
              <option value="">{loadingLookups ? "Loading..." : "Select group"}</option>
              {customerGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Territory *</label>
            <select
              value={territory}
              onChange={(e) => setTerritory(e.target.value)}
              className={inputClass}
              disabled={loadingLookups}
            >
              <option value="">{loadingLookups ? "Loading..." : "Select territory"}</option>
              {territories.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
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
          disabled={saving || loadingLookups}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-[10px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </ModalFooter>
    </Modal>
  )
}
