"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, ChevronDown, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CollapsibleSection } from "@/components/ui"
import { type Customer } from "@/services"
import { invoiceService } from "@/services"
import { cn, formatCurrency } from "@/lib/utils"

export interface InvoiceFormData {
  customer: string
  customerName: string
  issueDate: string
  dueDate: string
  postingTime?: string
  setPostingTime?: boolean
  // NOTE: posting_time, cost_center (invoice-level), and project are intentionally excluded
  // from the payload builder. ERPNext uses its own company defaults for these when not provided.
  // They exist here only for round-trip fidelity when loading existing invoices.
  customerAddress?: string
  shippingAddressName?: string
  contactPerson?: string
  poNo?: string
  poDate?: string
  paymentTermsTemplate?: string
  currency?: string
  sellingPriceList?: string
  priceListCurrency?: string
  ignorePricingRule?: boolean
  updateStock?: boolean
  setWarehouse?: string
  applyDiscountOn?: "Grand Total" | "Net Total"
  discountAmount?: number
  additionalDiscountPercentage?: number
  couponCode?: string
  isCashOrNonTradeDiscount?: boolean
  discountAccount?: string
  writeOffAmount?: number
  writeOffAccount?: string
  writeOffCostCenter?: string
  writeOffOutstandingAmountAutomatically?: boolean
  disableRoundedTotal?: boolean
  useCompanyDefaultCostCenterForRoundOff?: boolean
  costCenter?: string
  project?: string
  taxCategory?: string
  shippingRule?: string
  incoterm?: string
  // Sales Team
  salesPartner?: string
  commissionRate?: number
  salesTeam?: Array<{ id: string; sales_person: string; allocated_percentage?: number; commission_rate?: number; incentives?: number }>
  // Loyalty
  redeemLoyaltyPoints?: boolean
  loyaltyProgram?: string
  loyaltyPoints?: number
  loyaltyAmount?: number
  redemptionAccount?: string
  redemptionCostCenter?: string
  // Print
  letterHead?: string
  groupSameItems?: boolean
  selectPrintHeading?: string
  language?: string
  // Terms
  tcName?: string
  terms?: string
  // Returns
  isReturn?: boolean
  returnAgainst?: string
  isDebitNote?: boolean
  updateBilledAmountInSalesOrder?: boolean
  updateBilledAmountInDeliveryNote?: boolean
  updateOutstandingForSelf?: boolean
  // Advances
  advances?: Array<{ id: string; reference_type: string; reference_name: string; advance_amount: number; allocated_amount: number }>
  allocateAdvancesAutomatically?: boolean
  onlyIncludeAllocatedPayments?: boolean
  // POS
  isPos?: boolean
  posProfile?: string
  accountForChangeAmount?: string
  // Subscription
  subscription?: string
  fromDate?: string
  toDate?: string
  autoRepeat?: string
  debitTo?: string
  isOpening?: string
  customerGroup?: string
  remarks?: string
}

interface InvoiceFormProps {
  customers: Customer[]
  formData: InvoiceFormData
  onChange: (data: Partial<InvoiceFormData>) => void
  warehouses?: string[]
  taxesAndChargesTemplates?: string[]
  taxesAndChargesTemplate?: string
  onTaxTemplateChange?: (name: string) => void
  onSelectCustomer?: (customer: Customer) => void
  loadingPartyDetails?: boolean
  paymentSchedule?: Array<{ due_date: string; payment_amount: number; outstanding: number }>
  lineItems?: React.ReactNode
  totals?: React.ReactNode
  taxRows?: Array<{
    charge_type: string
    account_head: string
    description: string
    rate: number
    tax_amount: number
    total: number
  }>
  conversionRate?: number
  plcConversionRate?: number
  onConversionRateChange?: (rate: number) => void
  onPlcConversionRateChange?: (rate: number) => void
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

const labelClass = "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider"

function LinkSelect({
  name,
  value,
  options,
  placeholder = "Select…",
  onChange,
  loading = false,
}: {
  name: string
  value: string | undefined
  options: string[]
  placeholder?: string
  onChange: (name: string, value: string) => void
  loading?: boolean
}) {
  return (
    <select
      name={name}
      value={value ?? ""}
      onChange={(e) => onChange(name, e.target.value)}
      className={inputClass}
      disabled={loading}
    >
      <option value="">{loading ? "Loading…" : placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  )
}

export default function InvoiceForm({ customers, formData, onChange, warehouses, taxesAndChargesTemplates, taxesAndChargesTemplate, onTaxTemplateChange, onSelectCustomer, loadingPartyDetails, paymentSchedule, lineItems, totals, taxRows, conversionRate, plcConversionRate, onConversionRateChange, onPlcConversionRateChange }: InvoiceFormProps) {
  const [search, setSearch] = useState(formData.customerName || "")
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [loadingLookups, setLoadingLookups] = useState(false)
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<string[]>([])
  const [taxCategories, setTaxCategories] = useState<string[]>([])
  const [couponCodes, setCouponCodes] = useState<string[]>([])
  const [accounts, setAccounts] = useState<string[]>([])
  const [costCenters, setCostCenters] = useState<string[]>([])
  const [terms, setTerms] = useState<string[]>([])
  const [letterHeads, setLetterHeads] = useState<string[]>([])
  const [salesPartners, setSalesPartners] = useState<string[]>([])
  const [salesPersons, setSalesPersons] = useState<string[]>([])
  const [loyaltyPrograms, setLoyaltyPrograms] = useState<string[]>([])
  const [printHeadings, setPrintHeadings] = useState<string[]>([])
  const [shippingRules, setShippingRules] = useState<string[]>([])
  const [incoterms, setIncoterms] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("details")
  const [addresses, setAddresses] = useState<string[]>([])
  const [contacts, setContacts] = useState<string[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)

  useEffect(() => {
    setSearch(formData.customerName || "")
  }, [formData.customerName])

  useEffect(() => {
    if (!formData.customer) { setAddresses([]); setContacts([]); return }
    setLoadingAddresses(true)
    Promise.all([
      invoiceService.lookups.addresses(formData.customer),
      invoiceService.lookups.contacts(formData.customer),
    ]).then(([addrs, ctrs]) => {
      setAddresses(addrs.map((a: { name: string }) => a.name))
      setContacts(ctrs.map((c: { name: string }) => c.name))
    }).catch(() => { setAddresses([]); setContacts([]) })
      .finally(() => setLoadingAddresses(false))
  }, [formData.customer])

  useEffect(() => {
    setLoadingLookups(true)
    Promise.all([
      invoiceService.lookups.paymentTermsTemplates(),
      invoiceService.lookups.taxCategories(),
      invoiceService.lookups.couponCodes(),
      invoiceService.lookups.accounts(),
      invoiceService.lookups.costCenters(),
      invoiceService.lookups.terms(),
      invoiceService.lookups.letterHeads(),
      invoiceService.lookups.salesPartners(),
      invoiceService.lookups.salesPersons(),
      invoiceService.lookups.loyaltyPrograms(),
      invoiceService.lookups.printHeadings(),
      invoiceService.lookups.shippingRules(),
      invoiceService.lookups.incoterms(),
    ]).then(([ptt, tc, cc, ac, cst, trm, lh, sp, sP, lp, ph, shr, inc]) => {
      setPaymentTermsTemplates(ptt)
      setTaxCategories(tc)
      setCouponCodes(cc)
      setAccounts(ac)
      setCostCenters(cst)
      setTerms(trm)
      setLetterHeads(lh)
      setSalesPartners(sp)
      setSalesPersons(sP)
      setLoyaltyPrograms(lp)
      setPrintHeadings(ph)
      setShippingRules(shr)
      setIncoterms(inc)
    }).finally(() => setLoadingLookups(false))
  }, [])

  const filtered = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()),
  )

  const selectCustomer = useCallback((c: Customer) => {
    setSearch(c.customer_name)
    setDropdownOpen(false)
    if (onSelectCustomer) {
      onSelectCustomer(c)
    } else {
      onChange({
        customer: c.name,
        customerName: c.customer_name,
        customerAddress: c.customer_primary_address || undefined,
        shippingAddressName: c.customer_primary_address || undefined,
        contactPerson: c.customer_primary_contact || undefined,
      })
    }
  }, [onChange, onSelectCustomer])

  const handleSelectChange = useCallback((name: string, value: string) => {
    onChange({ [name]: value || undefined } as unknown as Partial<InvoiceFormData>)
  }, [onChange])

  const salesTeam = formData.salesTeam ?? []

  const addSalesTeamMember = () => {
    onChange({ salesTeam: [...salesTeam, { id: crypto.randomUUID(), sales_person: "", allocated_percentage: 100, commission_rate: 0, incentives: 0 }] })
  }

  const updateSalesTeamMember = (id: string, updates: Partial<(typeof salesTeam)[number]>) => {
    onChange({ salesTeam: salesTeam.map((m) => m.id === id ? { ...m, ...updates } : m) })
  }

  const removeSalesTeamMember = (id: string) => {
    onChange({ salesTeam: salesTeam.filter((m) => m.id !== id) })
  }

  return (
    <div className="space-y-4">
      {/* Full ERPNext parity scope (explicit decision):
          - 5-tab structure: Details, Payments, Address & Contact, Terms, More Info
          - All standard ERPNext Sales Invoice sections included:
            Additional Discount, Write Off, Sales Team, Loyalty Points,
            Print Settings, Returns/Credit Note, Subscription, POS
          - Excluded sections documented in comments below */}
      {/* Tab bar */}
      <div className="flex border-b border-border gap-0">
        {[
          { id: "details", label: "Details" },
          { id: "payments", label: "Payments" },
          { id: "addressContact", label: "Address & Contact" },
          { id: "terms", label: "Terms" },
          { id: "moreInfo", label: "More Info" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-muted hover:text-body"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== Details Tab ==================== */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Section 1: Header */}
          <CollapsibleSection title="Header" defaultOpen>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className={labelClass}>Customer *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true) }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder={loadingPartyDetails ? "Loading party details…" : "Search customer..."}
                    disabled={loadingPartyDetails}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[14px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all disabled:bg-gray-50 disabled:opacity-70"
                  />
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  {dropdownOpen && (
                    <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-muted">No customers found</p>
                      ) : (
                        filtered.map((c) => (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => selectCustomer(c)}
                            className={cn(
                              "w-full text-left px-4 py-2.5 text-sm transition-colors",
                              c.name === formData.customer ? "bg-primary-50 text-primary-700 font-semibold" : "text-body hover:bg-gray-50",
                            )}
                          >
                            <span className="font-medium">{c.customer_name}</span>
                            <span className="text-xs text-muted ml-2">{c.customer_type}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Invoice Date *</label>
                  <input type="date" value={formData.issueDate} onChange={(e) => onChange({ issueDate: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Due Date</label>
                  <input type="date" value={formData.dueDate} onChange={(e) => onChange({ dueDate: e.target.value })} className={inputClass} />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setPostingTime"
                    checked={!!formData.setPostingTime}
                    onChange={(e) => onChange({ setPostingTime: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="setPostingTime" className="text-sm text-body">Set Posting Time</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateStock"
                    checked={!!formData.updateStock}
                    onChange={(e) => onChange({ updateStock: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="updateStock" className="text-sm text-body">Update Stock</label>
                </div>
                {formData.updateStock && (
                  <div>
                    <label className={labelClass}>Source Warehouse</label>
                    <LinkSelect name="setWarehouse" value={formData.setWarehouse} options={warehouses ?? []} placeholder="Select warehouse…" onChange={handleSelectChange} />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Customer's PO No.</label>
                  <input type="text" value={formData.poNo ?? ""} onChange={(e) => onChange({ poNo: e.target.value || undefined })} className={inputClass} placeholder="PO-12345" />
                </div>
                <div>
                  <label className={labelClass}>PO Date</label>
                  <input type="date" value={formData.poDate ?? ""} onChange={(e) => onChange({ poDate: e.target.value || undefined })} className={inputClass} />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 1.5: Accounting Dimensions */}
          <CollapsibleSection title="Accounting Dimensions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Cost Center</label>
                <LinkSelect name="costCenter" value={formData.costCenter} options={costCenters} placeholder="Select…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
              <div>
                <label className={labelClass}>Project</label>
                <input type="text" value={formData.project ?? ""} onChange={(e) => onChange({ project: e.target.value || undefined })} className={inputClass} placeholder="Optional" />
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 1.6: Currency and Price List */}
          {formData.customer && (
            <CollapsibleSection title="Currency and Price List" defaultOpen>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Currency</label>
                  <input type="text" value={formData.currency ?? ""} onChange={(e) => onChange({ currency: e.target.value || undefined })} className={inputClass} placeholder="CAD" />
                </div>
                <div>
                  <label className={labelClass}>Price List</label>
                  <input type="text" value={formData.sellingPriceList ?? ""} onChange={(e) => onChange({ sellingPriceList: e.target.value || undefined })} className={inputClass} placeholder="Standard Selling" />
                </div>
                <div>
                  <label className={labelClass}>Price List Currency</label>
                  <input type="text" value={formData.priceListCurrency ?? ""} onChange={(e) => onChange({ priceListCurrency: e.target.value || undefined })} className={inputClass} placeholder="CAD" />
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Conversion Rate</label>
                  <input type="number" min={0} step={0.000001} value={conversionRate ?? 1} onChange={(e) => onConversionRateChange?.(parseFloat(e.target.value) || 1)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>PLC Conversion Rate</label>
                  <input type="number" min={0} step={0.000001} value={plcConversionRate ?? 1} onChange={(e) => onPlcConversionRateChange?.(parseFloat(e.target.value) || 1)} className={inputClass} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input type="checkbox" id="ignorePricingRule" checked={!!formData.ignorePricingRule} onChange={(e) => onChange({ ignorePricingRule: e.target.checked })} className="h-4 w-4 rounded border-border" />
                  <label htmlFor="ignorePricingRule" className="text-sm text-body">Ignore Pricing Rule</label>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Section 2: Line Items */}
          <CollapsibleSection title="Line Items" defaultOpen>
            {lineItems}
          </CollapsibleSection>

          {/* Section 3: Taxes and Charges */}
          <CollapsibleSection title="Taxes and Charges" defaultOpen>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className={labelClass}>Tax Category</label>
                <LinkSelect name="taxCategory" value={formData.taxCategory} options={taxCategories} placeholder="Select…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
              <div>
                <label className={labelClass}>Taxes and Charges Template</label>
                <select
                  value={taxesAndChargesTemplate ?? ""}
                  onChange={(e) => onTaxTemplateChange?.(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Select template…</option>
                  {taxesAndChargesTemplates?.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Shipping Rule</label>
                <LinkSelect name="shippingRule" value={formData.shippingRule} options={shippingRules} placeholder="Select…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelClass}>Incoterm</label>
                <LinkSelect name="incoterm" value={formData.incoterm} options={incoterms} placeholder="Select…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
            </div>
            {taxRows && taxRows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Type</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Account Head</th>
                      <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Rate</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Tax Amount</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxRows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 text-heading">{row.charge_type}</td>
                        <td className="py-2 text-heading">{row.account_head}</td>
                        <td className="py-2 text-muted">{row.description}</td>
                        <td className="py-2 text-right text-muted">{row.rate}%</td>
                        <td className="py-2 text-right font-semibold text-heading">{formatCurrency(row.tax_amount)}</td>
                        <td className="py-2 text-right text-heading">{formatCurrency(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-muted">No taxes configured. A default tax template will be applied on save.</p>
            )}
          </CollapsibleSection>

          {/* Section 4: Totals */}
          <CollapsibleSection title="Totals" defaultOpen>
            {totals}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="disableRoundedTotal" checked={!!formData.disableRoundedTotal} onChange={(e) => onChange({ disableRoundedTotal: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="disableRoundedTotal" className="text-sm text-body">Disable Rounded Total</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="useCompanyDefaultCC" checked={!!formData.useCompanyDefaultCostCenterForRoundOff} onChange={(e) => onChange({ useCompanyDefaultCostCenterForRoundOff: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="useCompanyDefaultCC" className="text-sm text-body">Use Company default Cost Center for Round off</label>
            </div>
          </CollapsibleSection>

          {/* Section 5: Additional Discount (collapsed by default) */}
          <CollapsibleSection title="Additional Discount">
            <div>
              <label className={labelClass}>Apply Discount On</label>
              <select value={formData.applyDiscountOn ?? ""} onChange={(e) => onChange({ applyDiscountOn: (e.target.value || undefined) as "Grand Total" | "Net Total" | undefined })} className={inputClass}>
                <option value="">None</option>
                <option value="Grand Total">Grand Total</option>
                <option value="Net Total">Net Total</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Discount Amount</label>
                <input type="number" min={0} step={0.01} value={formData.discountAmount ?? ""} onChange={(e) => onChange({ discountAmount: e.target.value ? parseFloat(e.target.value) : undefined })} className={inputClass} placeholder="0.00" />
              </div>
              <div>
                <label className={labelClass}>Discount %</label>
                <input type="number" min={0} max={100} step={0.01} value={formData.additionalDiscountPercentage ?? ""} onChange={(e) => onChange({ additionalDiscountPercentage: e.target.value ? parseFloat(e.target.value) : undefined })} className={inputClass} placeholder="0.00" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Coupon Code</label>
              <LinkSelect name="couponCode" value={formData.couponCode} options={couponCodes} placeholder="Select coupon…" onChange={handleSelectChange} loading={loadingLookups} />
            </div>
            {formData.applyDiscountOn === "Grand Total" && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isCashOrNonTrade" checked={!!formData.isCashOrNonTradeDiscount} onChange={(e) => onChange({ isCashOrNonTradeDiscount: e.target.checked })} className="h-4 w-4 rounded border-border" />
                <label htmlFor="isCashOrNonTrade" className="text-sm text-body">Is Cash or Non Trade Discount</label>
              </div>
            )}
            {formData.isCashOrNonTradeDiscount && (
              <div>
                <label className={labelClass}>Discount Account *</label>
                <LinkSelect name="discountAccount" value={formData.discountAccount} options={accounts} placeholder="Select account…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* ==================== Payments Tab (stubbed) ==================== */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Advance payments and payment recording will be built in Week 5. The fields below are pre-positioned for structural parity with ERPNext.
          </p>

          <CollapsibleSection title="POS">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isPos" checked={!!formData.isPos} onChange={(e) => onChange({ isPos: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="isPos" className="text-sm text-body font-semibold">Is POS Invoice</label>
            </div>
            {formData.isPos && (
              <>
                <div>
                  <label className={labelClass}>POS Profile</label>
                  <input type="text" value={formData.posProfile ?? ""} onChange={(e) => onChange({ posProfile: e.target.value || undefined })} className={inputClass} placeholder="POS-…" />
                </div>
                <div>
                  <label className={labelClass}>Change Account</label>
                  <input type="text" value={formData.accountForChangeAmount ?? ""} onChange={(e) => onChange({ accountForChangeAmount: e.target.value || undefined })} className={inputClass} placeholder="Optional" />
                </div>
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Advances">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="allocateAdvances" checked={!!formData.allocateAdvancesAutomatically} onChange={(e) => onChange({ allocateAdvancesAutomatically: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="allocateAdvances" className="text-sm text-body">Allocate Advances Automatically</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="onlyAllocated" checked={!!formData.onlyIncludeAllocatedPayments} onChange={(e) => onChange({ onlyIncludeAllocatedPayments: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="onlyAllocated" className="text-sm text-body">Only Include Allocated Payments</label>
            </div>
          </CollapsibleSection>

          {formData.isPos && (
            <CollapsibleSection title="Write Off">
              <div>
                <label className={labelClass}>Write Off Amount</label>
                <input type="number" min={0} step={0.01} value={formData.writeOffAmount ?? ""} onChange={(e) => onChange({ writeOffAmount: e.target.value ? parseFloat(e.target.value) : undefined })} className={inputClass} placeholder="0.00" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="writeOffAuto" checked={!!formData.writeOffOutstandingAmountAutomatically} onChange={(e) => onChange({ writeOffOutstandingAmountAutomatically: e.target.checked })} className="h-4 w-4 rounded border-border" />
                <label htmlFor="writeOffAuto" className="text-sm text-body">Write Off Outstanding Amount Automatically</label>
              </div>
              <div>
                <label className={labelClass}>Write Off Account</label>
                <LinkSelect name="writeOffAccount" value={formData.writeOffAccount} options={accounts} placeholder="Select account…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
              <div>
                <label className={labelClass}>Write Off Cost Center</label>
                <LinkSelect name="writeOffCostCenter" value={formData.writeOffCostCenter} options={costCenters} placeholder="Select cost center…" onChange={handleSelectChange} loading={loadingLookups} />
              </div>
            </CollapsibleSection>
          )}

          {/* Stubbed sections — to be implemented in Week 5:
              - Get Advances Received button / Advances table
              - Record Payment modal trigger
              - Paid Amount / Change Amount display */}
        </div>
      )}

      {/* ==================== Address & Contact Tab ==================== */}
      {activeTab === "addressContact" && (
        <div className="space-y-4">
          {formData.customer ? (
            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Customer Address</label>
                    <select value={formData.customerAddress ?? ""} onChange={(e) => onChange({ customerAddress: e.target.value || undefined })} className={inputClass} disabled={loadingAddresses}>
                      <option value="">{loadingAddresses ? "Loading…" : "Select address…"}</option>
                      {addresses.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Shipping Address</label>
                    <select value={formData.shippingAddressName ?? ""} onChange={(e) => onChange({ shippingAddressName: e.target.value || undefined })} className={inputClass} disabled={loadingAddresses}>
                      <option value="">{loadingAddresses ? "Loading…" : "Select address…"}</option>
                      {addresses.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Contact Person</label>
                    <select value={formData.contactPerson ?? ""} onChange={(e) => onChange({ contactPerson: e.target.value || undefined })} className={inputClass} disabled={loadingAddresses}>
                      <option value="">{loadingAddresses ? "Loading…" : "Select contact…"}</option>
                      {contacts.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted">Select a customer first.</p>
          )}
        </div>
      )}

      {/* ==================== Terms Tab ==================== */}
      {activeTab === "terms" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Payment Terms</CardTitle></CardHeader>
            <CardContent>
              <LinkSelect name="paymentTermsTemplate" value={formData.paymentTermsTemplate} options={paymentTermsTemplates} placeholder="Select template…" onChange={handleSelectChange} loading={loadingLookups} />
            </CardContent>
          </Card>

          {paymentSchedule && paymentSchedule.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Payment Schedule</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Due Date</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Amount</th>
                      <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentSchedule.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2 text-heading">{new Date(row.due_date).toLocaleDateString()}</td>
                        <td className="py-2 text-right text-heading">{formatCurrency(row.payment_amount)}</td>
                        <td className="py-2 text-right text-heading">{formatCurrency(row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          <CollapsibleSection title="Terms and Conditions">
            <div>
              <label className={labelClass}>Terms Template</label>
              <LinkSelect name="tcName" value={formData.tcName} options={terms} placeholder="Select template…" onChange={handleSelectChange} loading={loadingLookups} />
            </div>
            <div>
              <label className={labelClass}>Terms</label>
              <textarea
                value={formData.terms ?? ""}
                onChange={(e) => onChange({ terms: e.target.value || undefined })}
                rows={4}
                className={inputClass}
                placeholder="Enter payment terms, conditions, or other notes…"
              />
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ==================== More Info Tab ==================== */}
      {activeTab === "moreInfo" && (
        <div className="space-y-4">
          <CollapsibleSection title="Sales Team">
            <div>
              <label className={labelClass}>Sales Partner</label>
              <LinkSelect name="salesPartner" value={formData.salesPartner} options={salesPartners} placeholder="Select partner…" onChange={handleSelectChange} loading={loadingLookups} />
            </div>
            <div>
              <label className={labelClass}>Commission Rate (%)</label>
              <input type="number" min={0} max={100} step={0.01} value={formData.commissionRate ?? ""} onChange={(e) => onChange({ commissionRate: e.target.value ? parseFloat(e.target.value) : undefined })} className={inputClass} placeholder="0.00" />
            </div>
            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className={labelClass}>Sales Team Members</span>
                <button type="button" onClick={addSalesTeamMember} className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1">
                  <Plus size={12} /> Add
                </button>
              </div>
              {salesTeam.length === 0 ? (
                <p className="text-xs text-muted">No team members added.</p>
              ) : (
                <div className="space-y-2">
                  {salesTeam.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_70px_70px_auto] gap-1.5 items-start">
                      <select
                        value={m.sales_person}
                        onChange={(e) => updateSalesTeamMember(m.id, { sales_person: e.target.value })}
                        className={`${inputClass} text-xs py-1.5`}
                      >
                        <option value="">Select person</option>
                        {salesPersons.map((sp) => (
                          <option key={sp} value={sp}>{sp}</option>
                        ))}
                      </select>
                      <input type="number" min={0} max={100} step={0.01} value={m.allocated_percentage ?? ""} onChange={(e) => updateSalesTeamMember(m.id, { allocated_percentage: e.target.value ? parseFloat(e.target.value) : undefined })} className={`${inputClass} text-xs py-1.5 text-right`} placeholder="%" />
                      <input type="number" min={0} step={0.01} value={m.incentives ?? ""} onChange={(e) => updateSalesTeamMember(m.id, { incentives: e.target.value ? parseFloat(e.target.value) : undefined })} className={`${inputClass} text-xs py-1.5 text-right`} placeholder="$" />
                      <button type="button" onClick={() => removeSalesTeamMember(m.id)} className="p-1.5 text-muted hover:text-danger-600 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Loyalty Points">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="redeemLoyalty" checked={!!formData.redeemLoyaltyPoints} onChange={(e) => onChange({ redeemLoyaltyPoints: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="redeemLoyalty" className="text-sm text-body">Redeem Loyalty Points</label>
            </div>
            {formData.redeemLoyaltyPoints && (
              <>
                <div>
                  <label className={labelClass}>Loyalty Program</label>
                  <LinkSelect name="loyaltyProgram" value={formData.loyaltyProgram} options={loyaltyPrograms} placeholder="Select…" onChange={handleSelectChange} loading={loadingLookups} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Loyalty Points</label>
                    <input type="number" min={0} value={formData.loyaltyPoints ?? ""} onChange={(e) => onChange({ loyaltyPoints: e.target.value ? parseInt(e.target.value) : undefined })} className={inputClass} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelClass}>Loyalty Amount</label>
                    <input type="number" min={0} step={0.01} value={formData.loyaltyAmount ?? ""} onChange={(e) => onChange({ loyaltyAmount: e.target.value ? parseFloat(e.target.value) : undefined })} className={inputClass} placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Redemption Account</label>
                  <LinkSelect name="redemptionAccount" value={formData.redemptionAccount} options={accounts} placeholder="Select account…" onChange={handleSelectChange} loading={loadingLookups} />
                </div>
                <div>
                  <label className={labelClass}>Redemption Cost Center</label>
                  <LinkSelect name="redemptionCostCenter" value={formData.redemptionCostCenter} options={costCenters} placeholder="Select cost center…" onChange={handleSelectChange} loading={loadingLookups} />
                </div>
              </>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Print Settings">
            <div>
              <label className={labelClass}>Letter Head</label>
              <LinkSelect name="letterHead" value={formData.letterHead} options={letterHeads} placeholder="Default…" onChange={handleSelectChange} loading={loadingLookups} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="groupSameItems" checked={!!formData.groupSameItems} onChange={(e) => onChange({ groupSameItems: e.target.checked })} className="h-4 w-4 rounded border-border" />
              <label htmlFor="groupSameItems" className="text-sm text-body">Group Same Items</label>
            </div>
            <div>
              <label className={labelClass}>Print Heading</label>
              <LinkSelect name="selectPrintHeading" value={formData.selectPrintHeading} options={printHeadings} placeholder="Default…" onChange={handleSelectChange} loading={loadingLookups} />
            </div>
            <div>
              <label className={labelClass}>Language</label>
              <input type="text" value={formData.language ?? ""} onChange={(e) => onChange({ language: e.target.value || undefined })} className={inputClass} placeholder="en" />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Returns / Credit Note">
            {!formData.isDebitNote && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isReturn" checked={!!formData.isReturn} onChange={(e) => onChange({ isReturn: e.target.checked })} className="h-4 w-4 rounded border-border" />
                <label htmlFor="isReturn" className="text-sm text-body font-semibold">Is Return (Credit Note)</label>
              </div>
            )}
            {!formData.isReturn && (
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isDebitNote" checked={!!formData.isDebitNote} onChange={(e) => onChange({ isDebitNote: e.target.checked })} className="h-4 w-4 rounded border-border" />
                <label htmlFor="isDebitNote" className="text-sm text-body font-semibold">Is Rate Adjustment Entry (Debit Note)</label>
              </div>
            )}

            {formData.isReturn && (
              <>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="updateBilledSO" checked={!!formData.updateBilledAmountInSalesOrder} onChange={(e) => onChange({ updateBilledAmountInSalesOrder: e.target.checked })} className="h-4 w-4 rounded border-border" />
                  <label htmlFor="updateBilledSO" className="text-sm text-body">Update Billed Amount in Sales Order</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="updateBilledDN" checked={formData.updateBilledAmountInDeliveryNote ?? true} onChange={(e) => onChange({ updateBilledAmountInDeliveryNote: e.target.checked })} className="h-4 w-4 rounded border-border" />
                  <label htmlFor="updateBilledDN" className="text-sm text-body">Update Billed Amount in Delivery Note</label>
                </div>
                {formData.returnAgainst && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="updateOutstanding" checked={formData.updateOutstandingForSelf ?? true} onChange={(e) => onChange({ updateOutstandingForSelf: e.target.checked })} className="h-4 w-4 rounded border-border" />
                    <label htmlFor="updateOutstanding" className="text-sm text-body">Update Outstanding for Self</label>
                  </div>
                )}
              </>
            )}

            {formData.isDebitNote && (
              <div>
                <label className={labelClass}>Return Against</label>
                <input type="text" value={formData.returnAgainst ?? ""} onChange={(e) => onChange({ returnAgainst: e.target.value || undefined })} className={inputClass} placeholder="Original invoice name" />
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection title="Subscription">
            <div>
              <label className={labelClass}>Subscription</label>
              <input type="text" value={formData.subscription ?? ""} onChange={(e) => onChange({ subscription: e.target.value || undefined })} className={inputClass} placeholder="Linked subscription" readOnly />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>From Date</label>
                <input type="date" value={formData.fromDate ?? ""} onChange={(e) => onChange({ fromDate: e.target.value || undefined })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>To Date</label>
                <input type="date" value={formData.toDate ?? ""} onChange={(e) => onChange({ toDate: e.target.value || undefined })} className={inputClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Auto Repeat</label>
              <input type="text" value={formData.autoRepeat ?? ""} onChange={(e) => onChange({ autoRepeat: e.target.value || undefined })} className={inputClass} placeholder="auto-repeat-id" readOnly />
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Accounting Details">
            <div>
              <label className={labelClass}>Debit To (Read Only)</label>
              <input type="text" value={formData.debitTo ?? "Debtors - BE"} className={inputClass} readOnly />
            </div>
            <div>
              <label className={labelClass}>Is Opening Entry</label>
              <select value={formData.isOpening ?? "No"} onChange={(e) => onChange({ isOpening: e.target.value })} className={inputClass} disabled>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Customer Group</label>
              <input type="text" value={formData.customerGroup ?? ""} className={inputClass} readOnly placeholder="Set on Customer" />
            </div>
            <div>
              <label className={labelClass}>Remarks</label>
              <textarea value={formData.remarks ?? ""} onChange={(e) => onChange({ remarks: e.target.value || undefined })} rows={2} className={inputClass} placeholder="Invoice remarks…" />
            </div>
          </CollapsibleSection>

          {/* Excluded from More Info tab (confirmed not in use on this instance):
              - Timesheets   → service/billable-hours feature, not applicable to BlessERP's goods-only model
              - Packed Items → Product Bundles not in use
              - Pricing Rules table → read-only display of applied rules, low priority
              - Tax Breakup → not configured on any tax template, low priority */}
        </div>
      )}
    </div>
  )
}
