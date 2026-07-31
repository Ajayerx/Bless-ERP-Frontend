"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  CollapsibleSection,
} from "@/components/ui";
import LinkSearchField from "@/components/ui/LinkSearchField";
import ReturnAgainstSearchModal from "./ReturnAgainstSearchModal";
import GetItemsFromModal from "./GetItemsFromModal";
import { type Customer } from "@/services";
import { invoiceService } from "@/services";
import { cn, formatCurrency } from "@/lib/utils";
import type { EditableTaxRow, ChargeType } from "../types";
import type { AccountInfo } from "../services";
import { createEmptyTaxRow } from "../services";
import PaymentsTable from "./PaymentsTable";

export interface InvoiceFormData {
  customer: string;
  customerName: string;
  company?: string;
  companyTaxId?: string;
  taxId?: string;
  namingSeries?: string;
  issueDate: string;
  dueDate: string;
  postingTime?: string;
  setPostingTime?: boolean;
  customerAddress?: string;
  addressDisplay?: string;
  shippingAddressName?: string;
  shippingAddress?: string;
  dispatchAddressName?: string;
  dispatchAddress?: string;
  contactPerson?: string;
  contactDisplay?: string;
  contactMobile?: string;
  contactEmail?: string;
  poNo?: string;
  poDate?: string;
  paymentTermsTemplate?: string;
  ignoreDefaultPaymentTerms?: boolean;
  currency?: string;
  conversionRate?: number;
  sellingPriceList?: string;
  priceListCurrency?: string;
  plcConversionRate?: number;
  ignorePricingRule?: boolean;
  updateStock?: boolean;
  setWarehouse?: string;
  setTargetWarehouse?: string;
  lastScannedWarehouse?: string;
  applyDiscountOn?: "Grand Total" | "Net Total";
  discountAmount?: number;
  additionalDiscountPercentage?: number;
  couponCode?: string;
  isCashOrNonTradeDiscount?: boolean;
  discountAccount?: string;
  writeOffAmount?: number;
  writeOffAccount?: string;
  writeOffCostCenter?: string;
  writeOffOutstandingAmountAutomatically?: boolean;
  disableRoundedTotal?: boolean;
  useCompanyDefaultCostCenterForRoundOff?: boolean;
  costCenter?: string;
  project?: string;
  taxCategory?: string;
  taxesAndCharges?: string;
  shippingRule?: string;
  incoterm?: string;
  namedPlace?: string;
  // applyTds removed — does not exist on Sales Invoice
  salesPartner?: string;
  commissionRate?: number;
  totalCommission?: number;
  salesTeam?: Array<{
    id: string;
    sales_person: string;
    allocated_percentage?: number;
    commission_rate?: number;
    incentives?: number;
  }>;
  redeemLoyaltyPoints?: boolean;
  loyaltyProgram?: string;
  loyaltyPoints?: number;
  loyaltyAmount?: number;
  loyaltyRedemptionAccount?: string;
  loyaltyRedemptionCostCenter?: string;
  letterHead?: string;
  groupSameItems?: boolean;
  selectPrintHeading?: string;
  language?: string;
  tcName?: string;
  terms?: string;
  isReturn?: boolean;
  isConsolidated?: boolean;
  returnAgainst?: string;
  isDebitNote?: boolean;
  updateBilledAmountInSalesOrder?: boolean;
  updateBilledAmountInDeliveryNote?: boolean;
  updateOutstandingForSelf?: boolean;
  advances?: Array<{
    id: string;
    reference_type: string;
    reference_name: string;
    advance_amount: number;
    allocated_amount: number;
  }>;
  allocateAdvancesAutomatically?: boolean;
  onlyIncludeAllocatedPayments?: boolean;
  totalAdvance?: number;
  isPos?: boolean;
  posProfile?: string;
  accountForChangeAmount?: string;
  cashBankAccount?: string;
  payments?: Array<{
    id: string;
    mode_of_payment: string;
    amount: number;
    account?: string;
  }>;
  overrideTaxWithholdingEntries?: boolean;
  taxWithholdingEntries?: Array<{
    id: string;
    tax_withholding_group: string;
    amount: number;
  }>;
  subscription?: string;
  fromDate?: string;
  toDate?: string;
  autoRepeat?: string;
  debitTo?: string;
  isOpening?: string;
  customerGroup?: string;
  remarks?: string;
  scanBarcode?: string;
  companyAddress?: string;
  companyAddressDisplay?: string;
  companyContactPerson?: string;
  territory?: string;
  unrealizedProfitLossAccount?: string;
  againstIncomeAccount?: string;
  title?: string;
  status?: string;
  isInternalCustomer?: boolean;
  representsCompany?: string;
  interCompanyInvoiceReference?: string;
  isDiscounted?: boolean;
  campaign?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  basePaidAmount?: number;
  paidAmount?: number;
  baseChangeAmount?: number;
  changeAmount?: number;
  baseWriteOffAmount?: number;
  baseGrandTotal?: number;
  baseNetTotal?: number;
  baseTotalTaxesAndCharges?: number;
  baseRoundingAdjustment?: number;
  baseRoundedTotal?: number;
  totalNetWeight?: number;
  inWords?: string;
  netTotal?: number;
  totalTaxesAndCharges?: number;
  roundingAdjustment?: number;
  roundedTotal?: number;
  timeSheets?: Array<{
    id: string;
    activity_type: string;
    description: string;
    billing_hours: number;
    billing_amount: number;
  }>;
}

export interface InvoiceFieldErrors {
  customer?: string;
  company?: string;
  postingDate?: string;
  dueDate?: string;
  currency?: string;
  conversionRate?: string;
  sellingPriceList?: string;
  plcConversionRate?: string;
  debitTo?: string;
  items?: string;
  itemRows?: Record<
    number,
    { itemCode?: string; qty?: string; rate?: string; uoM?: string }
  >;
  returnAgainst?: string;
  posPayments?: string;
}

interface InvoiceFormProps {
  customers: Customer[];
  formData: InvoiceFormData;
  onChange: (data: Partial<InvoiceFormData>) => void;
  fieldErrors?: InvoiceFieldErrors;
  warehouses?: string[];
  taxesAndChargesTemplates?: string[];
  taxesAndChargesTemplate?: string;
  onTaxTemplateChange?: (name: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  loadingPartyDetails?: boolean;
  paymentSchedule?: Array<{
    due_date: string;
    payment_amount: number;
    outstanding: number;
  }>;
  paymentScheduleRows?: Array<{
    id: string;
    due_date: string;
    payment_amount: number;
  }>;
  lineItems?: React.ReactNode;
  totals?: React.ReactNode;
  taxRows?: Array<{
    charge_type: string;
    account_head: string;
    description: string;
    rate: number;
    tax_amount: number;
    total: number;
    included_in_print_rate?: boolean;
  }>;
  editableTaxRows?: EditableTaxRow[];
  onTaxRowsChange?: (rows: EditableTaxRow[]) => void;
  taxAccounts?: AccountInfo[];
  companyDefaults?: {
    company: string;
    currency: string;
    defaultSellingPriceList: string;
    defaultReceivableAccount: string;
    defaultIncomeAccount: string;
    defaultCostCenter: string;
    companyTaxId: string;
  } | null;
  grandTotal?: number;
  totalTaxesAndCharges?: number;
  subtotal?: number;
  totalQuantity?: number;
  totalAdvance?: number;
  outstandingAmount?: number;
  onAddItems?: (items: Array<Record<string, unknown>>) => void;
}

const GET_ITEMS_SOURCES = [
  {
    key: "Sales Order",
    doctype: "Sales Order",
    method: "erpnext.selling.doctype.sales_order.sales_order.make_sales_invoice",
    childFieldname: "items",
  },
  {
    key: "Quotation",
    doctype: "Quotation",
    method: "erpnext.selling.doctype.quotation.quotation.make_sales_invoice",
    childFieldname: "items",
  },
  {
    key: "Delivery Note",
    doctype: "Delivery Note",
    method: "erpnext.stock.doctype.delivery_note.delivery_note.make_sales_invoice",
    childFieldname: "items",
  },
] as const;

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200";

const labelClass =
  "block text-xs font-semibold text-muted mb-1.5";

const errCls = (error?: string) =>
  error
    ? "border-danger-500 focus:ring-danger-500/20 focus:border-danger-500"
    : "";


function LinkSelect({
  name,
  value,
  options,
  placeholder = "Select…",
  onChange,
  loading = false,
  error,
}: {
  name: string;
  value: string | undefined;
  options: string[];
  placeholder?: string;
  onChange: (name: string, value: string) => void;
  loading?: boolean;
  error?: string;
}) {
  return (
    <div>
      <select
        name={name}
        value={value ?? ""}
        onChange={(e) => onChange(name, e.target.value)}
        className={`${inputClass} ${errCls(error)}`}
        disabled={loading}
      >
        <option value="">{loading ? "Loading…" : placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
    </div>
  );
}

export default function InvoiceForm({
  customers,
  formData,
  onChange,
  fieldErrors,
  warehouses,
  taxesAndChargesTemplates,
  taxesAndChargesTemplate,
  onTaxTemplateChange,
  onSelectCustomer,
  loadingPartyDetails,
  paymentSchedule,
  lineItems,
  totals,
  taxRows,
  editableTaxRows,
  onTaxRowsChange,
  taxAccounts,
  companyDefaults,
  grandTotal,
  totalTaxesAndCharges,
  subtotal,
  totalQuantity,
  totalAdvance,
  outstandingAmount,
  onAddItems,
}: InvoiceFormProps) {
  const [search, setSearch] = useState(formData.customerName || "");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [loadingLookups, setLoadingLookups] = useState(false);
  const [paymentTermsTemplates, setPaymentTermsTemplates] = useState<string[]>(
    [],
  );
  const [taxCategories, setTaxCategories] = useState<string[]>([]);
  const [_couponCodes, setCouponCodes] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [terms, setTerms] = useState<string[]>([]);
  const [letterHeads, setLetterHeads] = useState<string[]>([]);
  const [salesPartners, setSalesPartners] = useState<string[]>([]);
  const [salesPersons, setSalesPersons] = useState<string[]>([]);
  const [_loyaltyPrograms, setLoyaltyPrograms] = useState<string[]>([]);
  const [printHeadings, setPrintHeadings] = useState<string[]>([]);
  const [shippingRules, setShippingRules] = useState<string[]>([]);
  const [incoterms, setIncoterms] = useState<string[]>([]);
  const [_taxWithholdingGroups, setTaxWithholdingGroups] = useState<string[]>(
    [],
  );
  const [_modeOfPayments, setModeOfPayments] = useState<string[]>([]);
  const [_companies, setCompanies] = useState<string[]>([]);
  const [territories, setTerritories] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [projects, setProjects] = useState<string[]>([]);
  const [namingSeriesOptions, setNamingSeriesOptions] = useState<string[]>(["ACC-SINV-.YYYY.-", "ACC-SINV-RET-.YYYY.-"]);
  const [applyDiscountOnOptions, setApplyDiscountOnOptions] = useState<string[]>(["Grand Total", "Net Total"]);
  const [isOpeningOptions, setIsOpeningOptions] = useState<string[]>(["No", "Yes"]);
  const [chargeTypeOptions, setChargeTypeOptions] = useState<string[]>([
    "Actual", "On Net Total", "On Previous Row Amount",
    "On Previous Row Total", "On Item Quantity",
  ]);
  const [activeGetItemsSource, setActiveGetItemsSource] = useState<typeof GET_ITEMS_SOURCES[number] | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [companyAddresses, setCompanyAddresses] = useState<string[]>([]);
  const [companyContacts, setCompanyContacts] = useState<string[]>([]);
  const [returnAgainstSearchOpen, setReturnAgainstSearchOpen] = useState(false);
  const [loadingAdvances, setLoadingAdvances] = useState(false);

  useEffect(() => {
    setSearch(formData.customerName || "");
  }, [formData.customerName]);

  useEffect(() => {
    if (costCenters.length > 0 && formData.costCenter && !costCenters.includes(formData.costCenter)) {
      onChange({ costCenter: "" });
    }
  }, [costCenters]);

  useEffect(() => {
    if (!formData.customer) {
      setAddresses([]);
      setContacts([]);
      setCompanyAddresses([]);
      setCompanyContacts([]);
      return;
    }
    setLoadingAddresses(true);
    const company = companyDefaults?.company;
    Promise.all([
      invoiceService.lookups.addresses(formData.customer),
      invoiceService.lookups.contacts(formData.customer),
      company ? invoiceService.lookups.companyAddresses(company) : Promise.resolve([]),
      company ? invoiceService.lookups.companyContacts(company) : Promise.resolve([]),
    ])
      .then(([addrs, ctrs, coAddrs, coCtrs]) => {
        setAddresses(addrs.map((a: { name: string }) => a.name));
        setContacts(ctrs.map((c: { name: string }) => c.name));
        setCompanyAddresses(coAddrs.map((a: { name: string }) => a.name));
        setCompanyContacts(coCtrs.map((c: { name: string }) => c.name));
      })
      .catch(() => {
        setAddresses([]);
        setContacts([]);
        setCompanyAddresses([]);
        setCompanyContacts([]);
      })
      .finally(() => setLoadingAddresses(false));
  }, [formData.customer, companyDefaults?.company]);

  const prevCustomerAddress = useRef(formData.customerAddress);
  useEffect(() => {
    if (formData.customerAddress && formData.customerAddress !== prevCustomerAddress.current) {
      invoiceService.getAddressDisplay(formData.customerAddress).then((display) => {
        if (display) onChange({ addressDisplay: display });
      });
    } else if (!formData.customerAddress) {
      onChange({ addressDisplay: undefined });
    }
    prevCustomerAddress.current = formData.customerAddress;
  }, [formData.customerAddress]);

  const prevShippingAddress = useRef(formData.shippingAddressName);
  useEffect(() => {
    if (formData.shippingAddressName && formData.shippingAddressName !== prevShippingAddress.current) {
      invoiceService.getAddressDisplay(formData.shippingAddressName).then((display) => {
        if (display) onChange({ shippingAddress: display });
      });
    } else if (!formData.shippingAddressName) {
      onChange({ shippingAddress: undefined });
    }
    prevShippingAddress.current = formData.shippingAddressName;
  }, [formData.shippingAddressName]);

  const prevContactPerson = useRef(formData.contactPerson);
  useEffect(() => {
    if (formData.contactPerson && formData.contactPerson !== prevContactPerson.current) {
      invoiceService.getContactDetails(formData.contactPerson).then((details) => {
        onChange({
          contactDisplay: details.contact_display,
          contactEmail: details.contact_email,
          contactMobile: details.contact_mobile,
        });
      });
    } else if (!formData.contactPerson) {
      onChange({ contactDisplay: undefined, contactEmail: undefined, contactMobile: undefined });
    }
    prevContactPerson.current = formData.contactPerson;
  }, [formData.contactPerson]);

  const prevCompanyAddress = useRef(formData.companyAddress);
  useEffect(() => {
    if (formData.companyAddress && formData.companyAddress !== prevCompanyAddress.current) {
      invoiceService.getAddressDisplay(formData.companyAddress).then((display) => {
        if (display) onChange({ companyAddressDisplay: display });
      });
    } else if (!formData.companyAddress) {
      onChange({ companyAddressDisplay: undefined });
    }
    prevCompanyAddress.current = formData.companyAddress;
  }, [formData.companyAddress]);

  useEffect(() => {
    setLoadingLookups(true);
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
      invoiceService.lookups.taxWithholdingGroups(),
      invoiceService.lookups.modeOfPayments(),
      invoiceService.lookups.companies(),
      invoiceService.lookups.territories(),
      invoiceService.lookups.campaigns(),
      invoiceService.lookups.sources(),
      invoiceService.lookups.projects(),
    ])
      .then(
        ([ptt, tc, cc, ac, cst, trm, lh, sp, sP, lp, ph, shr, inc, thg, mop, co, ter, cam, src, proj]) => {
          setPaymentTermsTemplates(ptt);
          setTaxCategories(tc);
          setCouponCodes(cc);
          setAccounts(ac);
          setCostCenters(cst);
          setTerms(trm);
          setLetterHeads(lh);
          setSalesPartners(sp);
          setSalesPersons(sP);
          setLoyaltyPrograms(lp);
          setPrintHeadings(ph);
          setShippingRules(shr);
          setIncoterms(inc);
          setTaxWithholdingGroups(thg);
          setModeOfPayments(mop);
          setCompanies(co);
          setTerritories(ter);
          setCampaigns(cam);
          setSources(src);
          setProjects(proj);
        },
      )
      .finally(() => setLoadingLookups(false));
  }, []);

  const filtered = customers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selectCustomer = useCallback(
    (c: Customer) => {
      setSearch(c.customer_name);
      setDropdownOpen(false);
      if (onSelectCustomer) {
        onSelectCustomer(c);
      } else {
        onChange({
          customer: c.name,
          customerName: c.customer_name,
          customerAddress: c.customer_primary_address || undefined,
          shippingAddressName: c.customer_primary_address || undefined,
          contactPerson: c.customer_primary_contact || undefined,
        });
      }
    },
    [onChange, onSelectCustomer],
  );

  const handleSelectChange = useCallback(
    (name: string, value: string) => {
      onChange({
        [name]: value || undefined,
      } as unknown as Partial<InvoiceFormData>);
    },
    [onChange],
  );

  const handleProjectChange = useCallback(async (value: string) => {
    onChange({ project: value || undefined } as unknown as Partial<InvoiceFormData>)
    if (!value) return
    const project = await invoiceService.getProject(value)
    if (project?.is_auto_fetch_timesheet_enabled) {
      const timesheetData = await invoiceService.fetchTimesheetData({ project: value, from_time: "", to_time: "" })
      if (Array.isArray(timesheetData) && timesheetData.length > 0) {
        const mapped = timesheetData.map((ts) => ({
          id: crypto.randomUUID(),
          activity_type: (ts.activity_type as string) || "",
          description: (ts.description as string) || "",
          billing_hours: (ts.billing_hours as number) || 0,
          billing_amount: (ts.billing_amount as number) || 0,
        }))
        onChange({ timeSheets: mapped })
      }
    }
  }, [onChange])

  const handleGetAdvances = useCallback(async () => {
    if (!formData.customer || !companyDefaults?.company) return
    setLoadingAdvances(true)
    try {
      const advances = await invoiceService.getUnallocatedAdvances(
        formData.customer,
        companyDefaults.company,
        formData.issueDate,
      )
      if (advances.length > 0) {
        const mapped = advances.map((a) => ({
          id: crypto.randomUUID(),
          reference_type: a.reference_type,
          reference_name: a.reference_name,
          advance_amount: a.advance_amount,
          allocated_amount: a.allocated_amount,
        }))
        onChange({ advances: mapped })
      }
    } catch {
      // silent
    } finally {
      setLoadingAdvances(false)
    }
  }, [formData.customer, formData.issueDate, companyDefaults, onChange])

  const salesTeam = formData.salesTeam ?? [];

  const addSalesTeamMember = () => {
    onChange({
      salesTeam: [
        ...salesTeam,
        {
          id: crypto.randomUUID(),
          sales_person: "",
          allocated_percentage: 100,
          commission_rate: 0,
          incentives: 0,
        },
      ],
    });
  };

  const updateSalesTeamMember = (
    id: string,
    updates: Partial<(typeof salesTeam)[number]>,
  ) => {
    onChange({
      salesTeam: salesTeam.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    });
  };

  const removeSalesTeamMember = (id: string) => {
    onChange({ salesTeam: salesTeam.filter((m) => m.id !== id) });
  };

  return (
    <div className="space-y-4">
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

      {/* ==================== DETAILS TAB ==================== */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Section 1: Header — 2-column matching ERPNext Desk */}
          {/* Section 1: Header — always visible, not collapsible */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Col 1: Party / Company */}
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Series *</label>
                  <select
                    value={formData.namingSeries ?? namingSeriesOptions[0] ?? ""}
                    onChange={(e) => onChange({ namingSeries: e.target.value })}
                    className={inputClass}
                  >
                    {namingSeriesOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Company *</label>
                  <input
                    type="text"
                    value={companyDefaults?.company ?? formData.company ?? ""}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Customer *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setDropdownOpen(true);
                      }}
                      onFocus={() => setDropdownOpen(true)}
                      placeholder={
                        loadingPartyDetails
                          ? "Loading party details…"
                          : "Search customer..."
                      }
                      disabled={loadingPartyDetails}
                      className={`w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all disabled:bg-gray-50 disabled:opacity-70 ${errCls(fieldErrors?.customer)}`}
                    />
                    <Search
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    <ChevronDown
                      size={15}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
                    />
                    {dropdownOpen && (
                      <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                        {filtered.length === 0 ? (
                          <p className="px-4 py-3 text-sm text-muted">
                            No customers found
                          </p>
                        ) : (
                          filtered.map((c) => (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => selectCustomer(c)}
                              className={cn(
                                "w-full text-left px-4 py-2.5 text-sm transition-colors",
                                c.name === formData.customer
                                  ? "bg-primary-50 text-primary-700 font-semibold"
                                  : "text-body hover:bg-gray-50",
                              )}
                            >
                              <span className="font-medium">
                                {c.customer_name}
                              </span>
                              <span className="text-xs text-muted ml-2">
                                {c.customer_type}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  {fieldErrors?.customer && (
                    <p className="text-xs text-danger-500 mt-1">{fieldErrors.customer}</p>
                  )}
                </div>
                {formData.customer && (
                  <div>
                    <label className={labelClass}>Customer Name</label>
                    <input
                      type="text"
                      value={formData.customerName ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                {formData.customer && (
                  <div>
                    <label className={labelClass}>Company Tax ID</label>
                    <input
                      type="text"
                      value={formData.companyTaxId ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>

              {/* Col 2: Dates + Flags (matching ERPNext right column) */}
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Posting Date *</label>
                  <input
                    type="date"
                    value={formData.issueDate}
                    onChange={(e) => onChange({ issueDate: e.target.value })}
                    readOnly={!formData.setPostingTime}
                    className={`${inputClass} ${!formData.setPostingTime ? "bg-gray-50" : ""} ${errCls(fieldErrors?.postingDate)}`}
                  />
                  {fieldErrors?.postingDate && (
                    <p className="text-xs text-danger-500 mt-1">{fieldErrors.postingDate}</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Posting Time</label>
                  <input
                    type="time"
                    value={formData.postingTime ?? ""}
                    onChange={(e) => onChange({ postingTime: e.target.value })}
                    readOnly={!formData.setPostingTime}
                    className={`${inputClass} ${!formData.setPostingTime ? "bg-gray-50" : ""}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="setPostingTime"
                    checked={!!formData.setPostingTime}
                    onChange={(e) =>
                      onChange({ setPostingTime: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="setPostingTime" className="text-sm text-body">
                    Edit Posting Date and Time
                  </label>
                </div>
                <div>
                  <label className={labelClass}>Payment Due Date *</label>
                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => onChange({ dueDate: e.target.value })}
                    className={`${inputClass} ${errCls(fieldErrors?.dueDate)}`}
                  />
                  {fieldErrors?.dueDate && (
                    <p className="text-xs text-danger-500 mt-1">{fieldErrors.dueDate}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPos"
                    checked={!!formData.isPos}
                    onChange={(e) => onChange({ isPos: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label
                    htmlFor="isPos"
                    className="text-sm text-body font-semibold"
                  >
                    Include Payment (POS)
                  </label>
                </div>
                {formData.isPos && (
                  <div>
                    <label className={labelClass}>POS Profile</label>
                    <input
                      type="text"
                      value={formData.posProfile ?? ""}
                      onChange={(e) =>
                        onChange({ posProfile: e.target.value || undefined })
                      }
                      className={inputClass}
                      placeholder="POS-…"
                    />
                  </div>
                )}
                {formData.isPos && formData.isConsolidated && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isConsolidated"
                      checked={!!formData.isConsolidated}
                      onChange={(e) =>
                        onChange({ isConsolidated: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border"
                      disabled
                    />
                    <label htmlFor="isConsolidated" className="text-sm text-body">
                      Is Consolidated
                    </label>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isReturn"
                    checked={!!formData.isReturn}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onChange({
                        isReturn: checked,
                        isDebitNote: checked ? false : formData.isDebitNote,
                      });
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="isReturn" className="text-sm text-body">
                    Is Return (Credit Note)
                  </label>
                </div>
                {(!!formData.returnAgainst || !!formData.isDebitNote || !!formData.isReturn) && (
                  <div>
                    <LinkSearchField
                      label={formData.isDebitNote ? "Adjustment Against" : "Return Against"}
                      value={formData.returnAgainst}
                      onChange={(val) => onChange({ returnAgainst: val || undefined })}
                      searchFn={(q) => invoiceService.searchSalesInvoices(q, formData.customer ? { customer: formData.customer } : undefined)}
                      onCreateNew={() => window.open("/invoices/new", "_blank")}
                      onAdvancedSearch={() => setReturnAgainstSearchOpen(true)}
                      readOnly={!!formData.isReturn}

                    />
                  </div>
                )}
                {formData.isReturn && formData.returnAgainst && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="updateOutstandingForSelf"
                      checked={!!formData.updateOutstandingForSelf}
                      onChange={(e) =>
                        onChange({
                          updateOutstandingForSelf: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <label
                      htmlFor="updateOutstandingForSelf"
                      className="text-sm text-body"
                    >
                      Update Outstanding for Self
                    </label>
                  </div>
                )}
                {formData.isReturn && (
                  <>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="updateBilledSO"
                        checked={!!formData.updateBilledAmountInSalesOrder}
                        onChange={(e) =>
                          onChange({
                            updateBilledAmountInSalesOrder: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <label
                        htmlFor="updateBilledSO"
                        className="text-sm text-body"
                      >
                        Update Billed Amount in Sales Order
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="updateBilledDN"
                        checked={
                          formData.updateBilledAmountInDeliveryNote ?? true
                        }
                        onChange={(e) =>
                          onChange({
                            updateBilledAmountInDeliveryNote: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      <label
                        htmlFor="updateBilledDN"
                        className="text-sm text-body"
                      >
                        Update Billed Amount in Delivery Note
                      </label>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isDebitNote"
                    checked={!!formData.isDebitNote}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onChange({
                        isDebitNote: checked,
                        isReturn: checked ? false : formData.isReturn,
                      });
                    }}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label
                    htmlFor="isDebitNote"
                    className="text-sm text-body"
                  >
                    Is Rate Adjustment Entry (Debit Note)
                  </label>
                </div>
              </div>
            </div>
          {/* Section 2: Accounting Dimensions — 2-column, always visible */}
          {formData.customer && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Cost Center</label>
                <LinkSelect
                  name="costCenter"
                  value={formData.costCenter}
                  options={costCenters}
                  placeholder="Select…"
                  onChange={handleSelectChange}
                  loading={loadingLookups}
                />
              </div>
              <div>
                <label className={labelClass}>Project</label>
                <LinkSelect
                  name="project"
                  value={formData.project}
                  options={projects}
                  placeholder="Optional"
                  onChange={(_, val) => handleProjectChange(val)}
                  loading={loadingLookups}
                />
              </div>
            </div>
          )}

          {/* Section 3: Currency and Price List — 2-column, dep:customer */}
          {formData.customer && (
            <CollapsibleSection title="Currency and Price List" defaultOpen>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Currency *</label>
                  <input
                    type="text"
                    value={formData.currency ?? companyDefaults?.currency ?? ""}
                    onChange={(e) =>
                      onChange({ currency: e.target.value || undefined })
                    }
                    className={`${inputClass} ${errCls(fieldErrors?.currency)}`}
                    placeholder={companyDefaults?.currency ?? "CAD"}
                  />
                  {fieldErrors?.currency && (
                    <p className="text-xs text-danger-500 mt-1">{fieldErrors.currency}</p>
                  )}
                </div>
                {(() => {
                  const effectiveCurrency = formData.currency ?? companyDefaults?.currency ?? "";
                  const effectiveCompanyCurrency = companyDefaults?.currency ?? "";
                  const showConversionRate = effectiveCurrency.length > 0 && effectiveCurrency !== effectiveCompanyCurrency;
                  const effectivePlcCurrency = formData.priceListCurrency ?? effectiveCompanyCurrency;
                  const showPlcRate = effectivePlcCurrency.length > 0 && effectivePlcCurrency !== effectiveCompanyCurrency;
                  return (
                    <>
                      {showConversionRate && (
                        <div>
                          <label className={labelClass}>Exchange Rate *</label>
                          <input
                            type="number"
                            min={0}
                            step={0.00000001}
                            value={formData.conversionRate ?? 1}
                            onChange={(e) =>
                              onChange({ conversionRate: parseFloat(e.target.value) || 1 })
                            }
                            className={`${inputClass} ${errCls(fieldErrors?.conversionRate)}`}
                          />
                          {fieldErrors?.conversionRate && (
                            <p className="text-xs text-danger-500 mt-1">{fieldErrors.conversionRate}</p>
                          )}
                          <p className="text-xs text-muted mt-1">
                            1 {effectiveCurrency} = {formData.conversionRate ?? 1} {effectiveCompanyCurrency}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className={labelClass}>Price List *</label>
                        <input
                          type="text"
                          value={
                            formData.sellingPriceList ??
                            companyDefaults?.defaultSellingPriceList ??
                            ""
                          }
                          onChange={(e) =>
                            onChange({ sellingPriceList: e.target.value || undefined })
                          }
                          className={`${inputClass} ${errCls(fieldErrors?.sellingPriceList)}`}
                          placeholder={
                            companyDefaults?.defaultSellingPriceList ??
                            "Standard Selling"
                          }
                        />
                        {fieldErrors?.sellingPriceList && (
                          <p className="text-xs text-danger-500 mt-1">{fieldErrors.sellingPriceList}</p>
                        )}
                      </div>
                      <div>
                        <label className={labelClass}>Price List Currency</label>
                        <input
                          type="text"
                          value={
                            formData.priceListCurrency ??
                            companyDefaults?.currency ??
                            ""
                          }
                          readOnly
                          className={`${inputClass} bg-gray-50`}
                        />
                      </div>
                      {showPlcRate && (
                        <div>
                          <label className={labelClass}>Price List Exchange Rate *</label>
                          <input
                            type="number"
                            min={0}
                            step={0.00000001}
                            value={formData.plcConversionRate ?? 1}
                            onChange={(e) =>
                              onChange({ plcConversionRate: parseFloat(e.target.value) || 1 })
                            }
                            className={`${inputClass} ${errCls(fieldErrors?.plcConversionRate)}`}
                          />
                          {fieldErrors?.plcConversionRate && (
                            <p className="text-xs text-danger-500 mt-1">{fieldErrors.plcConversionRate}</p>
                          )}
                          <p className="text-xs text-muted mt-1">
                            1 {effectivePlcCurrency} = {formData.plcConversionRate ?? 1} {effectiveCompanyCurrency}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="ignorePricingRule"
                          checked={!!formData.ignorePricingRule}
                          onChange={(e) =>
                            onChange({ ignorePricingRule: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                        <label htmlFor="ignorePricingRule" className="text-sm text-body">
                          Ignore Pricing Rule
                        </label>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CollapsibleSection>
          )}

          {/* Section 4: Items — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-heading">Items</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-3">
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Scan Barcode</label>
                  <input
                    type="text"
                    value={formData.scanBarcode ?? ""}
                    onChange={(e) =>
                      onChange({ scanBarcode: e.target.value || undefined })
                    }
                    className={inputClass}
                    placeholder="Scan barcode…"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="updateStock"
                    checked={!!formData.updateStock}
                    onChange={(e) => onChange({ updateStock: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="updateStock" className="text-sm text-body">
                    Update Stock
                  </label>
                </div>
                {formData.updateStock && (
                  <div>
                    <label className={labelClass}>Last Scanned Warehouse</label>
                    <input
                      type="text"
                      value={formData.lastScannedWarehouse ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {formData.updateStock && (
                  <div>
                    <label className={labelClass}>Source Warehouse</label>
                    <LinkSelect
                      name="setWarehouse"
                      value={formData.setWarehouse}
                      options={warehouses ?? []}
                      placeholder="Select warehouse…"
                      onChange={handleSelectChange}
                    />
                  </div>
                )}
                {formData.isInternalCustomer && formData.updateStock && (
                  <div>
                    <label className={labelClass}>Set Target Warehouse</label>
                    <LinkSelect
                      name="setTargetWarehouse"
                      value={formData.setTargetWarehouse}
                      options={warehouses ?? []}
                      placeholder="Select warehouse…"
                      onChange={handleSelectChange}
                    />
                  </div>
                )}
              </div>
            </div>
            {/* Get Items From buttons — matching ERPNext */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-semibold text-muted">Get Items From:</span>
              {GET_ITEMS_SOURCES.map((source) => (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => setActiveGetItemsSource(source)}
                  className="px-3 py-1.5 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
                >
                  {source.key}
                </button>
              ))}
            </div>

            {activeGetItemsSource && (
              <GetItemsFromModal
                open={!!activeGetItemsSource}
                onOpenChange={(open) => { if (!open) setActiveGetItemsSource(null) }}
                sourceDoctype={activeGetItemsSource.doctype}
                method={activeGetItemsSource.method}
                title={`Get Items from ${activeGetItemsSource.key}`}
                childFieldname={activeGetItemsSource.childFieldname}
                customer={formData.customer}
                company={formData.company}
                formData={formData as unknown as Record<string, unknown>}
                onItemsFetched={(fetchedItems) => {
                  onAddItems?.(fetchedItems)
                  setActiveGetItemsSource(null)
                }}
              />
            )}
            {lineItems}
            {/* Items footer: 2-column matching ERPNext */}
            {subtotal != null && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/50">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Total Quantity</label>
                    <input
                      type="text"
                      value={totalQuantity ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Base Net Total ({companyDefaults?.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.baseNetTotal ?? subtotal ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Net Total ({formData.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(subtotal ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Total ({formData.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(subtotal ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Taxes and Charges — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-heading">Taxes and Charges</h3>
            {/* Row 1: Sales Taxes and Charges Template — full width (first, matching ERPNext) */}
            <div className="mb-3">
              <label className={labelClass}>
                Sales Taxes and Charges Template
              </label>
              <select
                value={taxesAndChargesTemplate ?? ""}
                onChange={(e) => onTaxTemplateChange?.(e.target.value)}
                className={inputClass}
              >
                <option value="">Select template…</option>
                {taxesAndChargesTemplates?.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {/* Apply TDS removed — field does not exist on Sales Invoice.
                Use tax_withholding_category instead if TDS on sales is needed. */}
            {/* Row 2: Tax Category | Shipping Rule | Incoterm — 3-column */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className={labelClass}>Tax Category</label>
                <LinkSelect
                  name="taxCategory"
                  value={formData.taxCategory}
                  options={taxCategories}
                  placeholder="Select…"
                  onChange={handleSelectChange}
                  loading={loadingLookups}
                />
              </div>
              <div>
                <label className={labelClass}>Shipping Rule</label>
                <LinkSelect
                  name="shippingRule"
                  value={formData.shippingRule}
                  options={shippingRules}
                  placeholder="Select…"
                  onChange={handleSelectChange}
                  loading={loadingLookups}
                />
              </div>
              <div>
                <label className={labelClass}>Incoterm</label>
                <LinkSelect
                  name="incoterm"
                  value={formData.incoterm}
                  options={incoterms}
                  placeholder="Select…"
                  onChange={handleSelectChange}
                  loading={loadingLookups}
                />
              </div>
            </div>
            {/* Named Place (conditional on Incoterm) */}
            {formData.incoterm && (
              <div className="mb-3">
                <label className={labelClass}>Named Place</label>
                <input
                  type="text"
                  value={formData.namedPlace ?? ""}
                  onChange={(e) =>
                    onChange({ namedPlace: e.target.value || undefined })
                  }
                  className={inputClass}
                  placeholder="Port of loading…"
                />
              </div>
            )}
            {/* Row 3: Tax table — ERPNext-style editable grid */}
            {(() => {
              const rows = taxRows && taxRows.length > 0
                ? taxRows.map((r) => ({
                    charge_type: r.charge_type as ChargeType,
                    account_head: r.account_head,
                    description: r.description,
                    rate: r.rate,
                    tax_amount: r.tax_amount,
                    total: r.total,
                    included_in_print_rate: !!r.included_in_print_rate,
                  }))
                : (editableTaxRows ?? [])
              const isEditable = !!onTaxRowsChange
              const currency = formData.currency ?? "CAD"
              const chargeTypes = chargeTypeOptions as ChargeType[]

              const updateRow = (idx: number, patch: Partial<EditableTaxRow>) => {
                if (!onTaxRowsChange) return
                const next = rows.map((r, i) => i === idx ? { ...r, ...patch } : r)
                onTaxRowsChange(next)
              }
              const deleteRow = (idx: number) => {
                if (!onTaxRowsChange || rows.length <= 1) return
                onTaxRowsChange(rows.filter((_, i) => i !== idx))
              }
              const addRow = () => {
                if (!onTaxRowsChange) return
                onTaxRowsChange([...rows, createEmptyTaxRow()])
              }

              const handleAccountSelect = async (idx: number, account: AccountInfo) => {
                updateRow(idx, {
                  account_head: account.name,
                  description: account.account_name || account.name,
                })
                if (rows[idx].charge_type !== "Actual") {
                  const result = await invoiceService.getTaxRate(account.name)
                  if (result.tax_rate > 0) {
                    updateRow(idx, {
                      rate: result.tax_rate,
                      description: result.account_name || account.name,
                    })
                  }
                }
              }

              return (
                <>
                  {rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            <th className="px-2 py-2 text-center text-xs font-semibold text-muted uppercase tracking-wider w-[4%]">#</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[14%]">Type</th>
                            <th className="px-2 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wider w-[20%]">Account Head</th>
                            <th className="px-2 py-2 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[10%]">Rate (%)</th>
                            <th className="px-2 py-2 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Amount ({currency})</th>
                            <th className="px-2 py-2 text-right text-xs font-semibold text-muted uppercase tracking-wider w-[13%]">Total</th>
                            {isEditable && <th className="px-2 py-2 w-[4%]" />}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => {
                            const isActual = row.charge_type === "Actual"
                            const isRefRow = row.charge_type === "On Previous Row Amount" || row.charge_type === "On Previous Row Total"
                            return (
                              <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/30">
                                <td className="px-2 py-2 text-center text-muted text-xs">{i + 1}</td>
                                <td className="px-2 py-2">
                                  {isEditable ? (
                                    <select
                                      value={row.charge_type}
                                      onChange={(e) => updateRow(i, { charge_type: e.target.value as ChargeType })}
                                      className="w-full px-2 py-1.5 text-sm border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    >
                                      {chargeTypes.map((ct) => (
                                        <option key={ct} value={ct}>{ct}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-sm text-heading">{row.charge_type}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  {isEditable ? (
                                    <LinkSearchField
                                      value={row.account_head}
                                      onChange={(val) => {
                                        if (val) {
                                          updateRow(i, { account_head: val, description: val })
                                          if (rows[i]?.charge_type !== "Actual") {
                                            invoiceService.getTaxRate(val).then((result) => {
                                              if (result.tax_rate > 0) {
                                                updateRow(i, { rate: result.tax_rate, description: result.account_name || val })
                                              }
                                            })
                                          }
                                        } else {
                                          updateRow(i, { account_head: "", description: "", rate: 0 })
                                        }
                                      }}
                                      searchFn={(q) => invoiceService.searchAccounts(q)}
                                      placeholder={row.charge_type ? "Select account…" : "Select Charge Type first"}
                                      disabled={!row.charge_type}
                                    />
                                  ) : (
                                    <span className="text-sm text-heading">{row.account_head || "—"}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  {isEditable && !isActual ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.001}
                                      value={row.rate}
                                      onChange={(e) => updateRow(i, { rate: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    />
                                  ) : (
                                    <span className="text-sm text-muted tabular-nums">{row.rate}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  {isEditable && isActual ? (
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={row.tax_amount}
                                      onChange={(e) => updateRow(i, { tax_amount: parseFloat(e.target.value) || 0 })}
                                      className="w-full px-2 py-1.5 text-sm text-right border border-border rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-white"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-heading tabular-nums">{formatCurrency(row.tax_amount)}</span>
                                  )}
                                </td>
                                <td className="px-2 py-2 text-right">
                                  <span className="text-sm text-heading tabular-nums">{formatCurrency(row.total)}</span>
                                </td>
                                {isEditable && (
                                  <td className="px-2 py-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => deleteRow(i)}
                                      disabled={rows.length <= 1}
                                      className="p-1 rounded-[6px] text-muted hover:text-danger-600 hover:bg-danger-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted">
                      No taxes configured. Select a template or add tax rows manually.
                    </p>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={addRow}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-[8px] transition-colors"
                    >
                      <Plus size={13} />
                      Add Row
                    </button>
                  )}
                </>
              )
            })()}
            {/* Tax totals — transaction currency only */}
            {totalTaxesAndCharges != null && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <div>
                  <label className={labelClass}>Total Taxes and Charges</label>
                  <input
                    type="text"
                    value={formatCurrency(totalTaxesAndCharges)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 6: Totals — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-heading">Totals</h3>
            {totals}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-3">
              {/* Left: Invoice currency */}
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Net Total ({formData.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.netTotal ?? subtotal ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Taxes and Charges ({formData.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.totalTaxesAndCharges ?? totalTaxesAndCharges ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                {formData.totalNetWeight != null && formData.totalNetWeight > 0 && (
                  <div>
                    <label className={labelClass}>Total Net Weight</label>
                    <input
                      type="text"
                      value={formData.totalNetWeight}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Grand Total ({formData.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(grandTotal ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                {grandTotal != null && grandTotal > 0 && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="disableRoundedTotal"
                      checked={!!formData.disableRoundedTotal}
                      onChange={(e) =>
                        onChange({ disableRoundedTotal: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <label
                      htmlFor="disableRoundedTotal"
                      className="text-sm text-body"
                    >
                      Disable Rounded Total
                    </label>
                  </div>
                )}
                {!formData.disableRoundedTotal && (
                  <div>
                    <label className={labelClass}>Rounding Adjustment ({formData.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(
                        formData.roundingAdjustment ?? (Math.round((grandTotal ?? 0) * 100) / 100) - (grandTotal ?? 0),
                      )}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                {!formData.disableRoundedTotal && (
                  <div>
                    <label className={labelClass}>Rounded Total ({formData.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.roundedTotal ?? (Math.round((grandTotal ?? 0) * 100) / 100))}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Total Advance ({formData.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(totalAdvance ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Outstanding Amount ({formData.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(outstandingAmount ?? (formData.roundedTotal ?? (Math.round((grandTotal ?? 0) * 100) / 100)))}
                    className={`${inputClass} bg-gray-50 font-semibold`}
                    readOnly
                  />
                </div>
                {formData.inWords && (
                  <div>
                    <label className={labelClass}>In Words</label>
                    <input
                      type="text"
                      value={formData.inWords}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>
              {/* Right: Company currency */}
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Net Total ({companyDefaults?.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.baseNetTotal ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Total Taxes and Charges ({companyDefaults?.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.baseTotalTaxesAndCharges ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Grand Total ({companyDefaults?.currency ?? "CAD"})</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.baseGrandTotal ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="useCompanyDefaultCC"
                    checked={!!formData.useCompanyDefaultCostCenterForRoundOff}
                    onChange={(e) =>
                      onChange({
                        useCompanyDefaultCostCenterForRoundOff: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <label
                    htmlFor="useCompanyDefaultCC"
                    className="text-sm text-body"
                  >
                    Use Company default Cost Center for Round off
                  </label>
                </div>
                {!formData.disableRoundedTotal && (
                  <div>
                    <label className={labelClass}>Rounding Adjustment ({companyDefaults?.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.baseRoundingAdjustment ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
                {!formData.disableRoundedTotal && (
                  <div>
                    <label className={labelClass}>Rounded Total ({companyDefaults?.currency ?? "CAD"})</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.baseRoundedTotal ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 7: Additional Discount — 2-column */}
          <CollapsibleSection title="Additional Discount">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Apply Additional Discount On</label>
                  <select
                    value={formData.applyDiscountOn ?? applyDiscountOnOptions[0] ?? ""}
                    onChange={(e) =>
                      onChange({ applyDiscountOn: e.target.value || undefined })
                    }
                    className={inputClass}
                  >
                    {applyDiscountOnOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                {formData.applyDiscountOn === "Grand Total" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isCashOrNonTrade"
                      checked={!!formData.isCashOrNonTradeDiscount}
                      onChange={(e) =>
                        onChange({ isCashOrNonTradeDiscount: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="isCashOrNonTrade" className="text-sm text-body">
                      Is Cash or Non Trade Discount
                    </label>
                  </div>
                )}
                {formData.isCashOrNonTradeDiscount && (
                  <div>
                    <label className={labelClass}>Discount Account</label>
                    <input
                      type="text"
                      value={formData.discountAccount ?? ""}
                      onChange={(e) =>
                        onChange({ discountAccount: e.target.value || undefined })
                      }
                      className={inputClass}
                      placeholder="Enter account…"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Additional Discount Percentage</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={formData.additionalDiscountPercentage ?? ""}
                    onChange={(e) =>
                      onChange({
                        additionalDiscountPercentage: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className={inputClass}
                    placeholder="0.000"
                  />
                </div>
                <div>
                  <label className={labelClass}>Additional Discount Amount</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.discountAmount ?? ""}
                    onChange={(e) =>
                      onChange({
                        discountAmount: e.target.value
                          ? parseFloat(e.target.value)
                          : undefined,
                      })
                    }
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={labelClass}>Coupon Code</label>
                  <input
                    type="text"
                    value={formData.couponCode ?? ""}
                    onChange={(e) =>
                      onChange({ couponCode: e.target.value || undefined })
                    }
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>



          {/* Section 8: Tax Breakup — collapsed, read-only */}
          <CollapsibleSection title="Tax Breakup">
            {(() => {
              const rows = taxRows && taxRows.length > 0
                ? taxRows
                : (editableTaxRows ?? [])
              const currency = formData.currency ?? "CAD"
              if (rows.length === 0) {
                return <p className="text-xs text-muted">No tax data available.</p>
              }
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-xs font-semibold text-muted">#</th>
                        <th className="text-left py-2 text-xs font-semibold text-muted">Account Head</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted">Rate (%)</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted">Tax Amount ({currency})</th>
                        <th className="text-right py-2 text-xs font-semibold text-muted">Total ({currency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 text-muted">{i + 1}</td>
                          <td className="py-2 text-heading">{row.account_head || "—"}</td>
                          <td className="py-2 text-right text-heading tabular-nums">{row.rate}</td>
                          <td className="py-2 text-right text-heading tabular-nums">{formatCurrency(row.tax_amount ?? 0)}</td>
                          <td className="py-2 text-right text-heading tabular-nums">{formatCurrency(row.total ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </CollapsibleSection>

          {/* Section 9: Time Sheets — collapsible, in Main body (ERPNext) */}
          <CollapsibleSection title="Time Sheet List">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">No.</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Activity Type</th>
                    <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">Description</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Billing Hours</th>
                    <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">Billing Amount</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.timeSheets ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted text-xs">No Data</td>
                    </tr>
                  ) : (
                    (formData.timeSheets ?? []).map((ts, i) => (
                      <tr key={ts.id} className="border-b border-gray-50">
                        <td className="py-1.5 text-muted">{i + 1}</td>
                        <td className="py-1.5">
                          <LinkSearchField
                            value={ts.activity_type}
                            onChange={(val) => {
                              const updated = (formData.timeSheets ?? []).map(
                                (r) => r.id === ts.id ? { ...r, activity_type: val || "" } : r,
                              )
                              onChange({ timeSheets: updated })
                            }}
                            searchFn={(q) => invoiceService.searchActivityTypes(q)}

                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="text"
                            value={ts.description}
                            onChange={(e) => {
                              const updated = (formData.timeSheets ?? []).map(
                                (r) => r.id === ts.id ? { ...r, description: e.target.value } : r,
                              )
                              onChange({ timeSheets: updated })
                            }}
                            className={`${inputClass} text-xs py-1.5`}
                            placeholder="Description"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={ts.billing_hours || ""}
                            onChange={(e) => {
                              const updated = (formData.timeSheets ?? []).map(
                                (r) => r.id === ts.id
                                  ? { ...r, billing_hours: e.target.value ? parseFloat(e.target.value) : 0 }
                                  : r,
                              )
                              onChange({ timeSheets: updated })
                            }}
                            className={`${inputClass} text-xs py-1.5 text-right`}
                            placeholder="0"
                          />
                        </td>
                        <td className="py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={ts.billing_amount || ""}
                            onChange={(e) => {
                              const updated = (formData.timeSheets ?? []).map(
                                (r) => r.id === ts.id
                                  ? { ...r, billing_amount: e.target.value ? parseFloat(e.target.value) : 0 }
                                  : r,
                              )
                              onChange({ timeSheets: updated })
                            }}
                            className={`${inputClass} text-xs py-1.5 text-right`}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.timeSheets ?? []).filter((r) => r.id !== ts.id)
                              onChange({ timeSheets: updated })
                            }}
                            className="p-1.5 text-muted hover:text-danger-600 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => {
                const entries = formData.timeSheets ?? []
                onChange({
                  timeSheets: [
                    ...entries,
                    { id: crypto.randomUUID(), activity_type: "", description: "", billing_hours: 0, billing_amount: 0 },
                  ],
                })
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1 mt-2"
            >
              <Plus size={12} /> Add Row
            </button>
          </CollapsibleSection>

        </div>
      )}

      {/* ==================== ADDRESS & CONTACT TAB ==================== */}
      {activeTab === "addressContact" && (
        <div className="space-y-4">
          {formData.customer ? (
            <>
              {/* Section 1: Billing Address — matches ERPNext layout exactly */}
              <CollapsibleSection title="Billing Address" defaultOpen>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column: Address link + display */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Customer Address</label>
                      <select
                        value={formData.customerAddress ?? ""}
                        onChange={(e) =>
                          onChange({
                            customerAddress: e.target.value || undefined,
                          })
                        }
                        className={inputClass}
                        disabled={loadingAddresses}
                      >
                        <option value="">
                          {loadingAddresses ? "Loading…" : "Select address…"}
                        </option>
                        {addresses.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Address</label>
                      <textarea
                        value={formData.addressDisplay ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        rows={3}
                        placeholder="Address display"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Territory</label>
                      <LinkSelect
                        name="territory"
                        value={formData.territory}
                        options={territories}
                        placeholder="Select territory…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                  </div>
                  {/* Right column: Contact link + display */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <select
                        value={formData.contactPerson ?? ""}
                        onChange={(e) =>
                          onChange({ contactPerson: e.target.value || undefined })
                        }
                        className={inputClass}
                        disabled={loadingAddresses}
                      >
                        <option value="">
                          {loadingAddresses ? "Loading…" : "Select contact…"}
                        </option>
                        {contacts.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Contact</label>
                      <textarea
                        value={formData.contactDisplay ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        rows={3}
                        placeholder="Contact display"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 2: Shipping Address — matches ERPNext layout */}
              <CollapsibleSection title="Shipping Address">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column: Shipping address */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Shipping Address Name</label>
                      <select
                        value={formData.shippingAddressName ?? ""}
                        onChange={(e) =>
                          onChange({
                            shippingAddressName: e.target.value || undefined,
                          })
                        }
                        className={inputClass}
                        disabled={loadingAddresses}
                      >
                        <option value="">
                          {loadingAddresses ? "Loading…" : "Select address…"}
                        </option>
                        {addresses.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Shipping Address</label>
                      <textarea
                        value={formData.shippingAddress ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        rows={3}
                        placeholder="Shipping address display"
                      />
                    </div>
                  </div>
                  {/* Right column: Dispatch address (filtered by Company, not Customer) */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Dispatch Address Name</label>
                      <select
                        value={formData.dispatchAddressName ?? ""}
                        onChange={(e) =>
                          onChange({
                            dispatchAddressName: e.target.value || undefined,
                          })
                        }
                        className={inputClass}
                        disabled={loadingAddresses}
                      >
                        <option value="">
                          {loadingAddresses ? "Loading…" : "Select address…"}
                        </option>
                        {companyAddresses.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Dispatch Address</label>
                      <textarea
                        value={formData.dispatchAddress ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        rows={3}
                        placeholder="Dispatch address display"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 3: Company Address — matches ERPNext layout */}
              <CollapsibleSection title="Company Address">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column: Company address (filtered by Company) */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Company Address Name</label>
                      <select
                        value={formData.companyAddress ?? ""}
                        onChange={(e) =>
                          onChange({
                            companyAddress: e.target.value || undefined,
                          })
                        }
                        className={inputClass}
                        disabled={loadingAddresses}
                      >
                        <option value="">
                          {loadingAddresses ? "Loading…" : "Select address…"}
                        </option>
                        {companyAddresses.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Company Address</label>
                      <textarea
                        value={formData.companyAddressDisplay ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        rows={3}
                        placeholder="Company address display"
                      />
                    </div>
                  </div>
                  {/* Right column: Company contact (filtered by Company) */}
                  <div>
                    <label className={labelClass}>Company Contact Person</label>
                    <select
                      value={formData.companyContactPerson ?? ""}
                      onChange={(e) =>
                        onChange({
                          companyContactPerson: e.target.value || undefined,
                        })
                      }
                      className={inputClass}
                      disabled={loadingAddresses}
                    >
                      <option value="">
                        {loadingAddresses ? "Loading…" : "Select contact…"}
                      </option>
                      {companyContacts.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <p className="text-sm text-muted">Select a customer first.</p>
          )}
        </div>
      )}

      {/* ==================== PAYMENTS TAB ==================== */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* POS Payments Table */}
          {formData.isPos && (
            <CollapsibleSection title="Payments">
              <PaymentsTable
                payments={formData.payments ?? []}
                modes={_modeOfPayments}
                accounts={accounts}
                grandTotal={grandTotal}
                company={companyDefaults?.company}
                onChange={(rows) => onChange({ payments: rows })}
              />
            </CollapsibleSection>
          )}

          {/* Paid Amount */}
          {(formData.isPos || formData.redeemLoyaltyPoints) && (
            <CollapsibleSection title="Paid Amount">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Base Paid Amount</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.basePaidAmount ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div>
                  <label className={labelClass}>Paid Amount</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.paidAmount ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Changes — 2-column, dep:is_pos */}
          {formData.isPos && (
            <CollapsibleSection title="Changes">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Base Change Amount</label>
                  <input
                    type="text"
                    value={formatCurrency(formData.baseChangeAmount ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Change Amount</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.changeAmount ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Account for Change Amount</label>
                    <LinkSelect
                      name="accountForChangeAmount"
                      value={formData.accountForChangeAmount}
                      options={accounts}
                      placeholder="Select account…"
                      onChange={handleSelectChange}
                      loading={loadingLookups}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Write Off — depends_on: is_pos (ERPNext Payments tab) */}
          {formData.isPos && (
            <CollapsibleSection title="Write Off Amount">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Write Off Amount</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={formData.writeOffAmount ?? ""}
                      onChange={(e) =>
                        onChange({
                          writeOffAmount: e.target.value
                            ? parseFloat(e.target.value)
                            : undefined,
                        })
                      }
                      readOnly={!!formData.writeOffOutstandingAmountAutomatically}
                      className={`${inputClass}${formData.writeOffOutstandingAmountAutomatically ? " bg-gray-50" : ""}`}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Base Write Off Amount</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.baseWriteOffAmount ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="writeOffAutoPayments"
                      checked={!!formData.writeOffOutstandingAmountAutomatically}
                      onChange={(e) =>
                        onChange({
                          writeOffOutstandingAmountAutomatically: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="writeOffAutoPayments" className="text-sm text-body">
                      Write Off Outstanding Amount
                    </label>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Write Off Account</label>
                    <LinkSelect
                      name="writeOffAccount"
                      value={formData.writeOffAccount}
                      options={accounts}
                      placeholder="Select account…"
                      onChange={handleSelectChange}
                      loading={loadingLookups}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Write Off Cost Center</label>
                    <LinkSelect
                      name="writeOffCostCenter"
                      value={formData.writeOffCostCenter}
                      options={costCenters}
                      placeholder="Select cost center…"
                      onChange={handleSelectChange}
                      loading={loadingLookups}
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Loyalty Points Redemption */}
          <CollapsibleSection title="Loyalty Points Redemption">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="redeemLoyaltyPayments"
                checked={!!formData.redeemLoyaltyPoints}
                onChange={(e) =>
                  onChange({ redeemLoyaltyPoints: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="redeemLoyaltyPayments" className="text-sm text-body">
                Redeem Loyalty Points
              </label>
            </div>
            {formData.redeemLoyaltyPoints && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Loyalty Points</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.loyaltyPoints ?? ""}
                      onChange={(e) =>
                        onChange({
                          loyaltyPoints: e.target.value
                            ? parseInt(e.target.value)
                            : undefined,
                        })
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Loyalty Amount</label>
                    <input
                      type="text"
                      value={formatCurrency(formData.loyaltyAmount ?? 0)}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Loyalty Program</label>
                    <input
                      type="text"
                      value={formData.loyaltyProgram ?? ""}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Redemption Account</label>
                    <LinkSelect
                      name="loyaltyRedemptionAccount"
                      value={formData.loyaltyRedemptionAccount}
                      options={accounts}
                      placeholder="Select account…"
                      onChange={handleSelectChange}
                      loading={loadingLookups}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Redemption Cost Center</label>
                    <LinkSelect
                      name="loyaltyRedemptionCostCenter"
                      value={formData.loyaltyRedemptionCostCenter}
                      options={costCenters}
                      placeholder="Select cost center…"
                      onChange={handleSelectChange}
                      loading={loadingLookups}
                    />
                  </div>
                </div>
              </div>
            )}
          </CollapsibleSection>

          {/* Advance Payments */}
          <CollapsibleSection title="Advance Payments">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allocateAdvancesPayments"
                checked={!!formData.allocateAdvancesAutomatically}
                onChange={(e) =>
                  onChange({ allocateAdvancesAutomatically: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="allocateAdvancesPayments" className="text-sm text-body">
                Allocate Advances Automatically
              </label>
            </div>
            {!formData.allocateAdvancesAutomatically && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleGetAdvances}
                  disabled={loadingAdvances}
                  className="px-3 py-2 text-xs font-semibold text-primary-600 border border-primary-200 rounded-[10px] hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  {loadingAdvances ? "Loading…" : "Get Advances Received"}
                </button>
              </div>
            )}
            {formData.allocateAdvancesAutomatically && (
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="onlyAllocatedPayments"
                  checked={!!formData.onlyIncludeAllocatedPayments}
                  onChange={(e) =>
                    onChange({ onlyIncludeAllocatedPayments: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="onlyAllocatedPayments" className="text-sm text-body">
                  Only Include Allocated Payments
                </label>
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* ==================== TERMS TAB ==================== */}
      {activeTab === "terms" && (
        <div className="space-y-4">
          {!formData.isPos && !formData.isReturn && (
            <>
              <CollapsibleSection title="Payment Terms">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="checkbox"
                    id="ignoreDefaultPaymentTerms"
                    checked={!!formData.ignoreDefaultPaymentTerms}
                    onChange={(e) =>
                      onChange({ ignoreDefaultPaymentTerms: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-border"
                  />
                  <label htmlFor="ignoreDefaultPaymentTerms" className="text-sm text-body">
                    Ignore Default Payment Terms
                  </label>
                </div>
                <LinkSelect
                  name="paymentTermsTemplate"
                  value={formData.paymentTermsTemplate}
                  options={paymentTermsTemplates}
                  placeholder="Select template…"
                  onChange={handleSelectChange}
                  loading={loadingLookups}
                />
              </CollapsibleSection>

              {/* Read-only Payment Schedule (from loaded invoice, not editable) */}
              {paymentSchedule && paymentSchedule.length > 0 && (
                <CollapsibleSection title="Payment Schedule">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                          Due Date
                        </th>
                        <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                          Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentSchedule.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 text-heading">
                            {new Date(row.due_date).toLocaleDateString()}
                          </td>
                          <td className="py-2 text-right text-heading">
                            {formatCurrency(row.payment_amount)}
                          </td>
                          <td className="py-2 text-right text-heading">
                            {formatCurrency(row.outstanding)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CollapsibleSection>
              )}
              {/* Editable Payment Schedule (from form data) */}
              {formData.paymentScheduleRows && (
                <CollapsibleSection title="Payment Schedule">
                  <div className="space-y-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.paymentScheduleRows.map((row, i) => (
                          <tr key={row.id} className="border-b border-gray-50">
                            <td className="py-1.5 pr-2">
                              <input
                                type="date"
                                value={row.due_date}
                                onChange={(e) => {
                                  const updated = [...formData.paymentScheduleRows!]
                                  updated[i] = { ...updated[i], due_date: e.target.value }
                                  onChange({ paymentScheduleRows: updated })
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-border rounded-[8px] text-sm text-body"
                              />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={row.payment_amount || ""}
                                onChange={(e) => {
                                  const updated = [...formData.paymentScheduleRows!]
                                  updated[i] = {
                                    ...updated[i],
                                    payment_amount: e.target.value ? parseFloat(e.target.value) : 0,
                                  }
                                  onChange({ paymentScheduleRows: updated })
                                }}
                                className="w-full px-2 py-1.5 bg-white border border-border rounded-[8px] text-sm text-body text-right"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="py-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formData.paymentScheduleRows!.filter((_, idx) => idx !== i)
                                  onChange({ paymentScheduleRows: updated })
                                }}
                                className="p-1.5 text-muted hover:text-danger-600 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      onClick={() => {
                        const dueDate = formData.dueDate || formData.issueDate || new Date().toISOString().slice(0, 10)
                        const newRow = { id: crypto.randomUUID(), due_date: dueDate, payment_amount: 0 }
                        onChange({
                          paymentScheduleRows: [...(formData.paymentScheduleRows || []), newRow],
                        })
                      }}
                      className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      <Plus size={12} /> Add Row
                    </button>
                  </div>
                </CollapsibleSection>
              )}
            </>
          )}

          <CollapsibleSection title="Terms and Conditions">
            <div>
              <label className={labelClass}>Terms</label>
              <LinkSelect
                name="tcName"
                value={formData.tcName}
                options={terms}
                placeholder="Select template…"
                onChange={handleSelectChange}
                loading={loadingLookups}
              />
            </div>
            <div>
              <label className={labelClass}>Terms and Conditions Details</label>
              <textarea
                value={formData.terms ?? ""}
                onChange={(e) =>
                  onChange({ terms: e.target.value || undefined })
                }
                rows={4}
                className={inputClass}
                placeholder="Enter payment terms, conditions, or other notes…"
              />
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ==================== MORE INFO TAB ==================== */}
      {activeTab === "moreInfo" && (
        <div className="space-y-4">
          {formData.customer ? (
            <>
              {/* Section 1: Customer PO Details — 2-column */}
              <CollapsibleSection
                title="Customer PO Details"
                defaultOpen={!!formData.poNo}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Customer's Purchase Order</label>
                    <input
                      type="text"
                      value={formData.poNo ?? ""}
                      onChange={(e) =>
                        onChange({ poNo: e.target.value || undefined })
                      }
                      className={inputClass}
                      placeholder="PO Number"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Customer's Purchase Order Date</label>
                    <input
                      type="date"
                      value={formData.poDate ?? ""}
                      onChange={(e) =>
                        onChange({ poDate: e.target.value || undefined })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 2: Accounting Details — 2-column */}
              <CollapsibleSection title="Accounting Details">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Debit To</label>
                      <input
                        type="text"
                        value={formData.debitTo ?? "Debtors - BE"}
                        className={`${inputClass} bg-gray-50 ${errCls(fieldErrors?.debitTo)}`}
                        readOnly
                      />
                      {fieldErrors?.debitTo && (
                        <p className="text-xs text-danger-500 mt-1">{fieldErrors.debitTo}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Is Opening Entry</label>
                      <select
                        value={formData.isOpening ?? isOpeningOptions[0] ?? ""}
                        onChange={(e) => onChange({ isOpening: e.target.value })}
                        className={inputClass}
                        disabled
                      >
                        {isOpeningOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Unrealized Profit / Loss Account</label>
                      <LinkSelect
                        name="unrealizedProfitLossAccount"
                        value={formData.unrealizedProfitLossAccount}
                        options={accounts}
                        placeholder="Select account…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 3: Remarks */}
              <CollapsibleSection title="Remarks">
                <div>
                  <textarea
                    value={formData.remarks ?? ""}
                    onChange={(e) =>
                      onChange({ remarks: e.target.value || undefined })
                    }
                    rows={3}
                    className={inputClass}
                    placeholder="Remarks…"
                  />
                </div>
              </CollapsibleSection>

              {/* Section 4: Commission — 2-column */}
              <CollapsibleSection
                title="Commission"
                defaultOpen={!!formData.salesPartner}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Sales Partner</label>
                      <LinkSelect
                        name="salesPartner"
                        value={formData.salesPartner}
                        options={salesPartners}
                        placeholder="Select partner…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Amount Eligible for Commission
                      </label>
                      <input
                        type="text"
                        value={formatCurrency(subtotal ?? 0)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Commission Rate (%)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={formData.commissionRate ?? ""}
                        onChange={(e) =>
                          onChange({
                            commissionRate: e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          })
                        }
                        className={inputClass}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Total Commission</label>
                      <input
                        type="text"
                        value={formatCurrency(
                          ((formData.commissionRate ?? 0) / 100) * (subtotal ?? 0),
                        )}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 5: Print Settings */}
              <CollapsibleSection title="Print Settings">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Letter Head</label>
                      <LinkSelect
                        name="letterHead"
                        value={formData.letterHead}
                        options={letterHeads}
                        placeholder="Default…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="groupSameItemsMoreInfo"
                        checked={!!formData.groupSameItems}
                        onChange={(e) => onChange({ groupSameItems: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      <label htmlFor="groupSameItemsMoreInfo" className="text-sm text-body">
                        Group Same Items
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Print Heading</label>
                      <LinkSelect
                        name="selectPrintHeading"
                        value={formData.selectPrintHeading}
                        options={printHeadings}
                        placeholder="Default…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Print Language</label>
                      <input
                        type="text"
                        value={formData.language ?? ""}
                        onChange={(e) =>
                          onChange({ language: e.target.value || undefined })
                        }
                        className={inputClass}
                        placeholder="en"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>



              {/* Section 6: Sales Team */}
              <CollapsibleSection
                title="Sales Team"
                defaultOpen={salesTeam.length > 0}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={labelClass}>Sales Team Members</span>
                  <button
                    type="button"
                    onClick={addSalesTeamMember}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                {salesTeam.length === 0 ? (
                  <p className="text-xs text-muted">No team members added.</p>
                ) : (
                  <div className="space-y-2">
                    {salesTeam.map((m) => (
                      <div
                        key={m.id}
                        className="grid grid-cols-[1fr_70px_70px_auto] gap-1.5 items-start"
                      >
                        <LinkSearchField
                          value={m.sales_person}
                          onChange={(val) =>
                            updateSalesTeamMember(m.id, {
                              sales_person: val || "",
                            })
                          }
                          searchFn={(q) => invoiceService.searchSalesPersons(q)}
                          placeholder="Select person"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={m.allocated_percentage ?? ""}
                          onChange={(e) =>
                            updateSalesTeamMember(m.id, {
                              allocated_percentage: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                          className={`${inputClass} text-xs py-1.5 text-right`}
                          placeholder="%"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={m.incentives ?? ""}
                          onChange={(e) =>
                            updateSalesTeamMember(m.id, {
                              incentives: e.target.value
                                ? parseFloat(e.target.value)
                                : undefined,
                            })
                          }
                          className={`${inputClass} text-xs py-1.5 text-right`}
                          placeholder="$"
                        />
                        <button
                          type="button"
                          onClick={() => removeSalesTeamMember(m.id)}
                          className="p-1.5 text-muted hover:text-danger-600 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 7: Subscription — 2-column */}
              <CollapsibleSection title="Subscription">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Subscription</label>
                      <input
                        type="text"
                        value={formData.subscription ?? ""}
                        onChange={(e) =>
                          onChange({ subscription: e.target.value || undefined })
                        }
                        className={inputClass}
                        placeholder="Linked subscription"
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelClass}>From Date</label>
                      <input
                        type="date"
                        value={formData.fromDate ?? ""}
                        onChange={(e) =>
                          onChange({ fromDate: e.target.value || undefined })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>To Date</label>
                      <input
                        type="date"
                        value={formData.toDate ?? ""}
                        onChange={(e) =>
                          onChange({ toDate: e.target.value || undefined })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Auto Repeat</label>
                      <input
                        type="text"
                        value={formData.autoRepeat ?? ""}
                        onChange={(e) =>
                          onChange({ autoRepeat: e.target.value || undefined })
                        }
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        placeholder="auto-repeat-id"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 8: Additional Info — 2-column, dep:customer */}
              <CollapsibleSection title="Additional Info">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Status</label>
                      <input
                        type="text"
                        value={formData.status ?? "Draft"}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Inter Company Invoice Reference
                      </label>
                      <input
                        type="text"
                        value={formData.interCompanyInvoiceReference ?? ""}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Campaign</label>
                      <LinkSelect
                        name="campaign"
                        value={formData.campaign}
                        options={campaigns}
                        placeholder="Select campaign…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                    {formData.isInternalCustomer && (
                      <div>
                        <label className={labelClass}>Represents Company</label>
                        <input
                          type="text"
                          value={formData.representsCompany ?? ""}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>Source</label>
                      <LinkSelect
                        name="source"
                        value={formData.source}
                        options={sources}
                        placeholder="Select source…"
                        onChange={handleSelectChange}
                        loading={loadingLookups}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isInternalCustomer"
                        checked={!!formData.isInternalCustomer}
                        className="h-4 w-4 rounded border-border"
                        readOnly
                      />
                      <label
                        htmlFor="isInternalCustomer"
                        className="text-sm text-body"
                      >
                        Is Internal Customer
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDiscounted"
                        checked={!!formData.isDiscounted}
                        className="h-4 w-4 rounded border-border"
                        readOnly
                      />
                      <label
                        htmlFor="isDiscounted"
                        className="text-sm text-body"
                      >
                        Is Discounted
                      </label>
                    </div>
                    <div>
                      <label className={labelClass}>Remarks</label>
                      <textarea
                        value={formData.remarks ?? ""}
                        onChange={(e) =>
                          onChange({ remarks: e.target.value || undefined })
                        }
                        rows={2}
                        className={inputClass}
                        placeholder="Invoice remarks…"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            </>
          ) : (
            <p className="text-sm text-muted">Select a customer first.</p>
          )}
        </div>
      )}
      <ReturnAgainstSearchModal
        open={returnAgainstSearchOpen}
        onOpenChange={setReturnAgainstSearchOpen}
        onSelect={(name) => onChange({ returnAgainst: name })}
        onCreateNew={() => window.open("/invoices/new", "_blank")}
        customer={formData.customer}
        company={formData.company}
      />
    </div>
  );
}
