"use client"
import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { Input, Select, Button, LinkSearchField, useToast } from "@/components/ui"
import { customerService, searchLink, validateLink, type Customer } from "@/services"

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (customer: Customer) => void
}

const CUSTOMER_TYPE_OPTIONS = ["Company", "Individual", "Partnership"]

export default function QuickAddCustomerModal({ open, onClose, onCreated }: Props) {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [customerName, setCustomerName] = useState("")
  const [customerType, setCustomerType] = useState("Company")
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

  const hasContactInfo = email.trim().length > 0 || mobile.trim().length > 0

  const addressFilled =
    addrLine1.trim().length > 0 || city.trim().length > 0 || country.trim().length > 0

  const validate = (): string | null => {
    if (!customerName.trim()) return "Customer Name is required."
    if (addressFilled) {
      if (!addrLine1.trim()) return "Address Line 1 is required when an address is provided."
      if (!city.trim()) return "City is required when an address is provided."
      if (!country.trim()) return "Country is required when an address is provided."
    }
    return null
  }

  const handleSave = async () => {
    setError("")
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    try {
      const created = await customerService.quickCreate({
        customer_name: customerName.trim(),
        customer_type: customerType || "",
        customer_group: "",
        territory: "",
        contactFirstName: customerType === "Company" ? (firstName || undefined) : undefined,
        contactLastName: customerType === "Company" ? (lastName || undefined) : undefined,
        contactEmail: hasContactInfo ? email || undefined : undefined,
        contactPhone: hasContactInfo ? mobile || undefined : undefined,
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

      addToast(`${customerName.trim()} saved`, "success")
      reset()
      onClose()
      onCreated?.(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer.")
    } finally {
      setSaving(false)
    }
  }

  const handleEditFullForm = () => {
    const stateData: Record<string, unknown> = {
      customer_name: customerName.trim() || undefined,
      customer_type: customerType || undefined,
    }
    if (firstName && customerType === "Company") stateData.contactFirstName = firstName
    if (lastName && customerType === "Company") stateData.contactLastName = lastName
    if (hasContactInfo) {
      if (email) stateData.contactEmail = email
      if (mobile) stateData.contactPhone = mobile
    }
    if (addressFilled) {
      stateData.billingAddress = {
        address_line1: addrLine1,
        address_line2: addrLine2 || undefined,
        city,
        state: state || undefined,
        country,
        pincode: pincode || undefined,
      }
    }
    onClose()
    navigate("/customers/new", { state: stateData })
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault()
        handleSaveRef.current()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Add Customer" size="lg">
      <div className="max-h-[65vh] overflow-y-auto space-y-5">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px]">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-[10px] text-xs text-blue-700">
          <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-[11px] font-mono">Ctrl+Enter</kbd>
          to save
        </div>

        <div className="space-y-4">
          <Input
            label="Customer Name *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="John Doe / Acme Corp"
            autoFocus
          />
          <Select
            label="Customer Type *"
            value={customerType}
            onChange={(e) => setCustomerType(e.target.value)}
          >
            {CUSTOMER_TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold text-heading mb-3">Primary Contact Details</p>
          <div className="grid grid-cols-2 gap-4">
            {customerType === "Company" && (
              <>
                <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </>
            )}
            <Input label="Email Id" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Mobile Number" type="tel" maxLength={15} value={mobile} onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold text-heading mb-3">Primary Address Details</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Address Line 1" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Input label="Address Line 2" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} />
            </div>
            <Input label="ZIP Code" value={pincode} onChange={(e) => setPincode(e.target.value)} />
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input label="State/Province" value={state} onChange={(e) => setState(e.target.value)} />
            <LinkSearchField
              label="Country"
              value={country}
              onChange={(v) => setCountry(v ?? "")}
              searchFn={(q) => searchLink("Country", q, "Customer").then((items) => ({ items }))}
              validate={(v) => validateLink("Country", v)}
              docType="Country"
            />
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={handleEditFullForm}>
          Edit Full Form
        </Button>
        <Button onClick={handleSave} disabled={saving} loading={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
