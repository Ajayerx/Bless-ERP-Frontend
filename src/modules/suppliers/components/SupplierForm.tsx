"use client"

import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Save, Plus, Trash2, Landmark } from "lucide-react"
import { Button, Input, Select, DateInput, CollapsibleSection, Switch } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { supplierService, type SupplierFormData, type SupplierDetail, type SupplierAccountRow, type SupplierHoldType } from "@/services"

interface SupplierFormProps {
  supplierName?: string
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"
const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

const emptyForm = (): SupplierFormData => ({
  supplier_name: "",
  supplier_group: "",
  supplier_type: "Company",
  territory: "",
  country: "Canada",
  currency: "",
  is_group: false,
  disabled: false,
  on_hold: false,
  on_hold_until: "",
  hold_type: "All",
  tax_withholding_category: "",
  payment_terms: "",
  advance_account: "",
  tax_id: "",
  website: "",
  email_id: "",
  default_payable_accounts: [],
})

function searchFor(doctype: string, filters?: unknown[][]) {
  return (query: string) =>
    supplierService.searchLink(doctype, query, "Supplier", filters).then((items) => ({ items }))
}

export default function SupplierForm({ supplierName }: SupplierFormProps) {
  const navigate = useNavigate()
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [contact, setContact] = useState({
    contactFirstName: "",
    contactLastName: "",
    contactEmail: "",
    contactPhone: "",
  })
  const [address, setAddress] = useState({
    address_type: "Billing",
    address_line1: "",
    address_line2: "",
    city: "",
    state: "",
    country: "Canada",
    pincode: "",
  })
  const [existingContactName, setExistingContactName] = useState<string | undefined>()
  const [existingPrimaryAddressName, setExistingPrimaryAddressName] = useState<string | undefined>()

  const [options, setOptions] = useState<{
    supplierGroups: string[]
    supplierTypes: string[]
    territories: string[]
    countries: string[]
    currencies: string[]
    payableAccounts: string[]
    paymentTerms: string[]
    taxWithholdingCategories: string[]
  }>({
    supplierGroups: [],
    supplierTypes: [],
    territories: [],
    countries: [],
    currencies: [],
    payableAccounts: [],
    paymentTerms: [],
    taxWithholdingCategories: [],
  })

  const [loading, setLoading] = useState(!!supplierName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const loadOptions = useCallback(async () => {
    const [supplierGroups, supplierTypes, territories, countries, currencies, payableAccounts, paymentTerms, taxWithholdingCategories] = await Promise.all([
      supplierService.lookups.supplierGroups(),
      supplierService.lookups.supplierTypes(),
      supplierService.lookups.territories(),
      supplierService.lookups.countries(),
      supplierService.lookups.currencies(),
      supplierService.lookups.payableAccounts(),
      supplierService.lookups.paymentTermsTemplates(),
      supplierService.lookups.taxWithholdingCategories(),
    ])
    setOptions({
      supplierGroups,
      supplierTypes,
      territories,
      countries,
      currencies,
      payableAccounts,
      paymentTerms,
      taxWithholdingCategories,
    })
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (!supplierName) {
      setLoading(false)
      return
    }
    let cancelled = false
    supplierService.getById(supplierName).then((detail: SupplierDetail) => {
      if (cancelled) return
      setForm({
        supplier_name: detail.supplier_name,
        supplier_group: detail.supplier_group,
        supplier_type: detail.supplier_type || "Company",
        territory: detail.territory ?? "",
        country: detail.country ?? "",
        currency: detail.currency ?? "",
        is_group: !!detail.is_group,
        disabled: !!detail.disabled,
        on_hold: !!detail.on_hold,
        on_hold_until: detail.on_hold_until ?? "",
        hold_type: (detail.hold_type as SupplierHoldType) ?? "All",
        tax_withholding_category: detail.tax_withholding_category ?? "",
        payment_terms: detail.payment_terms ?? "",
        advance_account: detail.advance_account ?? "",
        tax_id: detail.tax_id ?? "",
        website: detail.website ?? "",
        email_id: detail.email_id ?? "",
        default_payable_accounts: (detail.default_payable_accounts ?? []).map((r: SupplierAccountRow) => ({
          company: r.company,
          account: r.account,
        })),
      })
      const primaryContact = detail.contacts?.find((c) => c.is_primary_contact) ?? detail.contacts?.[0]
      if (primaryContact) {
        setExistingContactName(primaryContact.name)
        setForm((prev) => ({
          ...prev,
          contactFirstName: primaryContact.first_name,
        }))
        setContact((prev) => ({
          ...prev,
          contactFirstName: primaryContact.first_name,
          contactLastName: primaryContact.last_name ?? "",
          contactEmail: primaryContact.email_id ?? "",
          contactPhone: primaryContact.mobile_no ?? "",
        }))
      }
      const primaryAddress = detail.addresses?.find((a) => a.is_primary_address) ?? detail.addresses?.[0]
      if (primaryAddress) {
        setExistingPrimaryAddressName(primaryAddress.name)
        setAddress({
          address_type: primaryAddress.address_type ?? "Billing",
          address_line1: primaryAddress.address_line1 ?? "",
          address_line2: primaryAddress.address_line2 ?? "",
          city: primaryAddress.city ?? "",
          state: primaryAddress.state ?? "",
          country: primaryAddress.country ?? "",
          pincode: primaryAddress.pincode ?? "",
        })
      }
    }).catch(() => {
      if (!cancelled) setError("Failed to load supplier.")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [supplierName])

  const updateField = (name: keyof SupplierFormData, value: unknown) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const updatePayableRow = (index: number, field: keyof SupplierAccountRow, value: string) => {
    setForm((prev) => {
      const rows = [...(prev.default_payable_accounts ?? [])]
      rows[index] = { ...rows[index], [field]: value }
      return { ...prev, default_payable_accounts: rows }
    })
  }

  const addPayableRow = () => {
    setForm((prev) => ({
      ...prev,
      default_payable_accounts: [...(prev.default_payable_accounts ?? []), { company: "", account: "" }],
    }))
  }

  const removePayableRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      default_payable_accounts: (prev.default_payable_accounts ?? []).filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.supplier_name.trim()) {
      setError("Supplier name is required.")
      return
    }
    if (!form.supplier_group.trim()) {
      setError("Supplier group is required.")
      return
    }
    if (form.on_hold) {
      if (!form.hold_type) {
        setError("Select a hold type when the supplier is on hold.")
        return
      }
      if (!form.on_hold_until) {
        setError("Set an 'On Hold Until' date when the supplier is on hold.")
        return
      }
    }

    const payload: SupplierFormData = {
      ...form,
      ...contact,
      primaryAddress: address.address_line1.trim() || address.city.trim() ? address : undefined,
      existingContactName,
      existingPrimaryAddressName,
      contactEmail: contact.contactEmail || undefined,
      contactPhone: contact.contactPhone || undefined,
    }

    setSaving(true)
    try {
      if (supplierName) {
        const updated = await supplierService.update(supplierName, payload)
        navigate(`/suppliers/${updated.name}`)
      } else {
        const created = await supplierService.create(payload)
        navigate(`/suppliers/${created.name}`)
      }
    } catch {
      setError("Failed to save supplier. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const linkField = (docType: string, doctypeLabel: string, value: string | undefined, onChange: (v?: string) => void, filters?: unknown[][]) => (
    <LinkSearchField
      value={value}
      onChange={onChange}
      searchFn={searchFor(docType, filters)}
      validate={async (v) => {
        if (v) await supplierService.validateLink(docType, v)
      }}
      placeholder={`Select ${doctypeLabel}...`}
      docType={docType}
      className="w-full"
      clearIconMode="hover"
      suppressExternalLabelFetch
    />
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted">
        Loading supplier...
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(supplierName ? `/suppliers/${supplierName}` : "/suppliers")}
            className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-heading">
              {supplierName ? "Edit Supplier" : "New Supplier"}
            </h1>
            <p className="text-sm text-muted mt-0.5">
              {supplierName ? "Update supplier details." : "Add a new vendor to your directory."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {supplierName && (
            <Button
              variant="outline"
              onClick={() => navigate(`/bank-accounts/new?party_type=Supplier&party=${encodeURIComponent(supplierName)}`)}
            >
              <Landmark size={14} />
              Bank Account
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate(supplierName ? `/suppliers/${supplierName}` : "/suppliers")}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" disabled={saving} loading={saving}>
            <Save size={16} />
            {saving ? "Saving..." : supplierName ? "Update Supplier" : "Create Supplier"}
          </Button>
        </div>
      </div>

      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
        )}

        {/* Header */}
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
          <h2 className="font-bold text-heading">Supplier Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="supplier_name" className={labelClass}>Supplier Name *</label>
              <Input id="supplier_name" value={form.supplier_name} onChange={(e) => updateField("supplier_name", e.target.value)} placeholder="ABC Supply Co." />
            </div>
            <div>
              <label className={labelClass}>Supplier Group *</label>
              {linkField("Supplier Group", "supplier group", form.supplier_group, (v) => updateField("supplier_group", v ?? ""))}
            </div>
            <div>
              <label htmlFor="supplier_type" className={labelClass}>Supplier Type</label>
              <Select id="supplier_type" value={form.supplier_type} onChange={(e) => updateField("supplier_type", e.target.value)}>
                {options.supplierTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </div>
            <div>
              <label className={labelClass}>Territory</label>
              {linkField("Territory", "territory", form.territory, (v) => updateField("territory", v ?? ""))}
            </div>
            <div>
              <label className={labelClass}>Country</label>
              {linkField("Country", "country", form.country, (v) => updateField("country", v ?? ""))}
            </div>
            <div>
              <label htmlFor="currency" className={labelClass}>Default Currency</label>
              <Select id="currency" value={form.currency} onChange={(e) => updateField("currency", e.target.value)}>
                <option value="">—</option>
                {options.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label htmlFor="website" className={labelClass}>Website</label>
              <Input id="website" value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://..." />
            </div>
            <div className="flex items-center gap-6 col-span-2">
              <label className="flex items-center gap-2 text-sm text-body">
                <Switch checked={!!form.is_group} onChange={(v) => updateField("is_group", v)} />
                Is Group
              </label>
              <label className="flex items-center gap-2 text-sm text-body">
                <Switch checked={!!form.disabled} onChange={(v) => updateField("disabled", v)} />
                Disabled
              </label>
            </div>
          </div>
        </div>

        {/* On Hold */}
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-heading">Status</h2>
            <label className="flex items-center gap-2 text-sm text-body">
              <Switch checked={!!form.on_hold} onChange={(v) => updateField("on_hold", v)} />
              On Hold
            </label>
          </div>
          {form.on_hold && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="hold_type" className={labelClass}>Hold Type *</label>
                <Select id="hold_type" value={form.hold_type} onChange={(e) => updateField("hold_type", e.target.value)}>
                  <option value="All">All</option>
                  <option value="Purchase Orders">Purchase Orders</option>
                  <option value="Purchase Invoices">Purchase Invoices</option>
                  <option value="Payments">Payments</option>
                </Select>
              </div>
              <div>
                <label htmlFor="on_hold_until" className={labelClass}>On Hold Until *</label>
                <DateInput id="on_hold_until" value={form.on_hold_until} onChange={(e) => updateField("on_hold_until", e.target.value)} className={inputClass} />
              </div>
            </div>
          )}
        </div>

        {/* Accounting */}
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
          <h2 className="font-bold text-heading">Accounting</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Payment Terms</label>
              {linkField("Payment Terms Template", "payment terms", form.payment_terms, (v) => updateField("payment_terms", v ?? ""))}
            </div>
            <div>
              <label className={labelClass}>Tax Withholding Category</label>
              {linkField("Tax Withholding Category", "tax withholding category", form.tax_withholding_category, (v) => updateField("tax_withholding_category", v ?? ""))}
            </div>
            <div>
              <label className={labelClass}>Advance Account</label>
              {linkField("Account", "advance account", form.advance_account, (v) => updateField("advance_account", v ?? ""), [["account_type", "=", "Payable"], ["root_type", "=", "Liability"], ["is_group", "=", 0]])}
            </div>
            <div>
              <label htmlFor="tax_id" className={labelClass}>Tax ID</label>
              <Input id="tax_id" value={form.tax_id} onChange={(e) => updateField("tax_id", e.target.value)} placeholder="XX-XXXXXXX" />
            </div>
          </div>

          <CollapsibleSection title={`Default Payable Accounts (${form.default_payable_accounts?.length ?? 0})`}>
            <div className="space-y-3">
              {form.default_payable_accounts?.map((row, i) => (
                <div key={i} className="grid grid-cols-2 gap-4 items-start">
                  <div>
                    <label className={labelClass}>Company</label>
                    {linkField("Company", "company", row.company, (v) => updatePayableRow(i, "company", v ?? ""))}
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className={labelClass}>Account</label>
                      {linkField("Account", "account", row.account, (v) => updatePayableRow(i, "account", v ?? ""), [["account_type", "=", "Payable"], ["root_type", "=", "Liability"], ["is_group", "=", 0]])}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removePayableRow(i)} aria-label={`Remove account row ${i + 1}`}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={addPayableRow}>
                <Plus size={14} /> Add Row
              </Button>
            </div>
          </CollapsibleSection>
        </div>

        {/* Address & Contact */}
        <div className="bg-surface rounded-[16px] border border-border shadow-card p-6 space-y-4">
          <h2 className="font-bold text-heading">Address & Contact</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact First Name" value={contact.contactFirstName} onChange={(e) => setContact((p) => ({ ...p, contactFirstName: e.target.value }))} />
            <Input label="Contact Last Name" value={contact.contactLastName} onChange={(e) => setContact((p) => ({ ...p, contactLastName: e.target.value }))} />
            <Input label="Contact Email" type="email" value={contact.contactEmail} onChange={(e) => setContact((p) => ({ ...p, contactEmail: e.target.value }))} />
            <Input label="Contact Phone" value={contact.contactPhone} onChange={(e) => setContact((p) => ({ ...p, contactPhone: e.target.value }))} />
          </div>
          <CollapsibleSection title="Primary Address">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input label="Address Line 1" value={address.address_line1} onChange={(e) => setAddress((p) => ({ ...p, address_line1: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <Input label="Address Line 2" value={address.address_line2} onChange={(e) => setAddress((p) => ({ ...p, address_line2: e.target.value }))} />
              </div>
              <Input label="City" value={address.city} onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))} />
              <Input label="State / Province" value={address.state} onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))} />
              <Input label="Country" value={address.country} onChange={(e) => setAddress((p) => ({ ...p, country: e.target.value }))} />
              <Input label="Postal Code" value={address.pincode} onChange={(e) => setAddress((p) => ({ ...p, pincode: e.target.value }))} />
            </div>
          </CollapsibleSection>
        </div>
      </form>
    </>
  )
}