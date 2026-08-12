"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import {
  CollapsibleSection,
  useToast,
} from "@/components/ui";
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid";
import LinkSearchField from "@/components/ui/LinkSearchField";
import ReturnAgainstSearchModal from "./ReturnAgainstSearchModal";
import GetItemsFromModal from "./GetItemsFromModal";
import { type Customer } from "@/services";
import { invoiceService } from "@/services";
import { useLazyOptions, type LazyOptionsState } from "@/services/lookup-cache";
import { formatCurrency } from "@/lib/utils";
import type { EditableTaxRow, ChargeType } from "../types";
import { createEmptyTaxRow, getCurrencySmallestFraction, roundToSmallestCurrencyFraction } from "../services";
import PaymentsTable from "./PaymentsTable";

export interface InvoiceFormData {
  customer: string;
  customerName: string;
  company?: string;
  companyTaxId?: string;
  taxId?: string;
  amendedFrom?: string;
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
  contactPhone?: string;
  contactDesignation?: string;
  contactDepartment?: string;
  poNo?: string;
  poDate?: string;
  paymentTermsTemplate?: string;
  ignoreDefaultPaymentTerms?: boolean;
  paymentScheduleRows?: Array<{
    id: string;
    due_date: string;
    payment_amount: number;
  }>;
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
  partyAccountCurrency?: string;
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
  formData: InvoiceFormData;
  onChange: (data: Partial<InvoiceFormData>) => void;
  fieldErrors?: InvoiceFieldErrors;
  taxesAndChargesTemplate?: string;
  onTaxTemplateChange?: (name: string) => void;
  onSelectCustomer?: (customer: Customer) => void;
  loadingPartyDetails?: boolean;
  paymentSchedule?: Array<{
    due_date: string;
    payment_amount: number;
    outstanding: number;
  }>;
  lineItems?: React.ReactNode;
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
  totalTaxesAndChargesBase?: number;
  subtotal?: number;
  totalQuantity?: number;
  netTotal?: number;
  totalAdvance?: number;
  outstandingAmount?: number;
  onAddItems?: (items: Array<Record<string, unknown>>) => void;
  onSetWarehouse?: (warehouse: string | undefined) => void;
  mode?: "new" | "existing";
  docstatus?: number;
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
  "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed disabled:opacity-100";

const labelClass =
  "block text-xs font-semibold text-muted mb-1.5";

const errCls = (error?: string) =>
  error
    ? "border-danger-500 focus:ring-danger-500/20 focus:border-danger-500"
    : "";


function LinkField({
  doctype,
  value,
  onChange,
  searchFn,
  placeholder = "Select…",
  readOnly = false,
}: {
  doctype: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  searchFn: (query: string) => Promise<{ items: Array<{ value: string; label: string; description: string }> }>;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <LinkSearchField
      value={value ?? ""}
      onChange={onChange}
      searchFn={searchFn}
      validate={async (v) => {
        const doc = await invoiceService.validateLink(doctype, v, []);
        if (!doc || Object.keys(doc).length === 0) {
          throw new Error(`Invalid ${doctype}`);
        }
      }}
      placeholder={placeholder}
      readOnly={readOnly}
    />
  );
}

function Combobox({
  name,
  value,
  options,
  placeholder = "Select…",
  onChange,
  loading = false,
  error,
  load,
}: {
  name: string;
  value: string | undefined;
  options: string[] | LazyOptionsState<string[]>;
  placeholder?: string;
  onChange: (name: string, value: string) => void;
  loading?: boolean;
  error?: string;
  load?: () => void;
}) {
  const list = Array.isArray(options) ? options : options.value;
  const ensure = Array.isArray(options) ? undefined : options.ensure;
  const busy = loading || (!Array.isArray(options) && options.loading);
  const [query, setQuery] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ?? "");
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => o.toLowerCase().includes(q));
  }, [query, list]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (val: string) => {
    setQuery(val);
    setOpen(false);
    onChange(name, val);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        type="text"
        value={query}
        placeholder={busy ? "Loading…" : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlightIndex(0);
        }}
        onFocus={() => {
          setOpen(true);
          setHighlightIndex(0);
          load?.();
          ensure?.();
        }}
        onBlur={() => commit(query)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            if (open && filtered.length > 0 && highlightIndex >= 0) {
              e.preventDefault();
              commit(filtered[highlightIndex]);
            } else {
              commit(query);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${inputClass} ${errCls(error)}`}
      />
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-60 overflow-auto rounded-md border border-border bg-white shadow-lg">
          {busy ? (
            <div className="px-3 py-2.5 text-sm text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-muted">No results</div>
          ) : (
            filtered.map((opt, i) => (
              <button
                key={opt}
                type="button"
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt);
                }}
                className={`block w-full text-left px-3 py-2 text-sm ${
                  i === highlightIndex
                    ? "bg-primary-500/10 text-primary-600"
                    : "text-body hover:bg-muted/50"
                }`}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
    </div>
  );
}

export default function InvoiceForm({
  formData,
  onChange,
  fieldErrors,
  taxesAndChargesTemplate,
  onTaxTemplateChange,
  onSelectCustomer,
  loadingPartyDetails,
  paymentSchedule,
  lineItems,
  taxRows,
  editableTaxRows,
  onTaxRowsChange,
  companyDefaults,
  grandTotal,
  totalTaxesAndCharges,
  totalTaxesAndChargesBase,
  subtotal,
  totalQuantity,
  netTotal,
  totalAdvance,
  outstandingAmount,
  onAddItems,
  onSetWarehouse,
  mode = "new",
  docstatus = 0,
}: InvoiceFormProps) {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const isExisting = mode === "existing";
  const isReadOnly = isExisting && docstatus !== 0;

  const [currencyFraction, setCurrencyFraction] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const currency = formData.currency ?? companyDefaults?.currency;
    if (!currency) {
      setCurrencyFraction(null);
      return;
    }
    getCurrencySmallestFraction(currency).then((f) => {
      if (!cancelled) setCurrencyFraction(f);
    });
    return () => {
      cancelled = true;
    };
  }, [formData.currency, companyDefaults?.currency]);

  const namingSeriesOptions = ["ACC-SINV-.YYYY.-", "ACC-SINV-RET-.YYYY.-"];
  const applyDiscountOnOptions = ["Grand Total", "Net Total"];
  const isOpeningOptions = ["No", "Yes"];
  const chargeTypeOptions = [
    "Actual", "On Net Total", "On Previous Row Amount",
    "On Previous Row Total", "On Item Quantity",
  ];
  const currentCompany = formData.company || companyDefaults?.company;
  const currencies = useLazyOptions<string[]>(
    "sales-invoice:currencies",
    invoiceService.lookups.currencies,
    [],
  );
  const priceLists = useLazyOptions<string[]>(
    "sales-invoice:price-lists",
    invoiceService.lookups.priceLists,
    [],
  );
  const [activeGetItemsSource, setActiveGetItemsSource] = useState<typeof GET_ITEMS_SOURCES[number] | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [returnAgainstSearchOpen, setReturnAgainstSearchOpen] = useState(false);
  const [loadingAdvances, setLoadingAdvances] = useState(false);

  const handleCustomerChange = useCallback(
    async (value: string | undefined) => {
      if (!value) {
        onChange({
          customer: undefined,
          customerName: undefined,
          customerAddress: undefined,
          shippingAddressName: undefined,
          contactPerson: undefined,
        });
        return;
      }
      const doc = await invoiceService.validateLink("Customer", value, [
        "tax_id",
        "customer_name",
        "loyalty_program",
        "represents_company",
        "is_internal_customer",
      ]);
      const customer: Customer = {
        ...(doc as unknown as Customer),
        name: value,
        outstanding: 0,
      };
      if (onSelectCustomer) {
        onSelectCustomer(customer);
      } else {
        onChange({
          customer: customer.name,
          customerName: customer.customer_name,
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

  // ERPNext set_discount_amount parity (taxes_and_totals.py:701-708):
  // percentage auto-computes discount_amount against grand_total (subtotal +
  // taxes) or net_total (subtotal) depending on apply_discount_on.
  const discountBase = (applyOn: "Grand Total" | "Net Total"): number =>
    applyOn === "Net Total"
      ? (subtotal ?? 0)
      : (subtotal ?? 0) +
        (totalTaxesAndChargesBase ?? totalTaxesAndCharges ?? 0);

  const handleApplyDiscountOnChange = (
    applyOn: "Grand Total" | "Net Total",
  ) => {
    onChange({ applyDiscountOn: applyOn });
    if (formData.additionalDiscountPercentage && formData.additionalDiscountPercentage > 0) {
      onChange({
        discountAmount:
          Math.round(
            discountBase(applyOn) * (formData.additionalDiscountPercentage / 100) * 100,
          ) / 100,
      });
    }
  };

  const handleAdditionalDiscountPercentageChange = (
    value: number | undefined,
  ) => {
    onChange({ additionalDiscountPercentage: value });
    if (value && value > 0) {
      const base = discountBase(formData.applyDiscountOn ?? "Grand Total");
      onChange({
        discountAmount: Math.round(base * (value / 100) * 100) / 100,
      });
    } else {
      onChange({ discountAmount: undefined });
    }
  };

  const handleAdditionalDiscountAmountChange = (value: number | undefined) => {
    onChange({ discountAmount: value });
    if (value && value > 0) {
      onChange({ additionalDiscountPercentage: undefined });
    }
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

      <fieldset disabled={isReadOnly} className="min-w-0 space-y-4 border-0 p-0 m-0">
      {/* ==================== DETAILS TAB ==================== */}
      {activeTab === "details" && (
        <div className="space-y-4">
          {/* Section 1: Header — 3-column matching ERPNext Desk (Series new-only / Customer / Tax Id | dates | return & POS flags) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-4 border-b border-border">
              {/* Col 1: Party / Company */}
              <div className="space-y-3">
                {!isExisting && (
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
                )}
                <div>
                  <label className={labelClass}>Customer *</label>
                  <LinkSearchField
                    value={formData.customer || undefined}
                    onChange={handleCustomerChange}
                    searchFn={(q) => invoiceService.searchLink("Customer", q)}
                    placeholder={
                      loadingPartyDetails
                        ? "Loading party details…"
                        : "Search customer..."
                    }
                    disabled={loadingPartyDetails}
                    readOnly={isReadOnly}
                    suppressExternalLabelFetch={isReadOnly}
                    inputClassName={errCls(fieldErrors?.customer)}
                  />
                  {fieldErrors?.customer && (
                    <p className="text-xs text-danger-500 mt-1">{fieldErrors.customer}</p>
                  )}
                </div>
                {formData.customer && formData.taxId && (
                  <div>
                    <label className={labelClass}>Tax Id</label>
                    <input
                      type="text"
                      value={formData.taxId}
                      className={`${inputClass} bg-gray-50`}
                      readOnly
                    />
                  </div>
                )}
              </div>

              {/* Col 2: Dates (ERPNext column_break1) */}
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
              </div>

              {/* Col 3: Return & POS flags (ERPNext column_break_14) */}
              <div className="space-y-3">
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
                      readOnly={isReadOnly || !!formData.isReturn}

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
                {formData.amendedFrom && (
                  <div>
                    <label className={labelClass}>Amended From</label>
                    <div
                      className="cursor-pointer group"
                      onClick={() => navigate(`/invoices/${formData.amendedFrom}`)}
                    >
                      <input
                        type="text"
                        value={formData.amendedFrom}
                        className={`${inputClass} bg-gray-50 pointer-events-none transition-colors group-hover:border-primary-500 group-hover:bg-primary-50/50`}
                        readOnly
                        tabIndex={-1}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          {/* Section 2: Accounting Dimensions — collapsible */}
          {formData.customer && (
            <CollapsibleSection title="Accounting Dimensions" defaultOpen>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cost Center</label>
                  <LinkField
                    doctype="Cost Center"
                    value={formData.costCenter}
                    onChange={(v) => handleSelectChange("costCenter", v ?? "")}
                    searchFn={(q) => invoiceService.searchSalesLink("Cost Center", q)}
                    readOnly={isReadOnly}
                  />
                </div>
                <div>
                  <label className={labelClass}>Project</label>
                  <LinkField
                    doctype="Project"
                    value={formData.project}
                    onChange={(v) => handleProjectChange(v ?? "")}
                    searchFn={(q) => invoiceService.searchSalesLink("Project", q)}
                    placeholder="Optional"
                    readOnly={isReadOnly}
                  />
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Section 3: Currency and Price List — ERPNext layout, dep:customer */}
          {formData.customer && (
            <CollapsibleSection title="Currency and Price List" defaultOpen>
              {(() => {
                const effectiveCurrency = formData.currency ?? companyDefaults?.currency ?? "";
                const effectiveCompanyCurrency = companyDefaults?.currency ?? "";
                const showConversionRate = effectiveCurrency.length > 0 && effectiveCurrency !== effectiveCompanyCurrency;
                const effectivePlcCurrency = formData.priceListCurrency ?? effectiveCompanyCurrency;
                const showPlcRate = effectivePlcCurrency.length > 0 && effectivePlcCurrency !== effectiveCompanyCurrency;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Currency *</label>
                        <Combobox
                          name="currency"
                          value={formData.currency ?? companyDefaults?.currency ?? ""}
                          options={currencies}
                          onChange={handleSelectChange}
                                                    error={fieldErrors?.currency}
                        />
                      </div>
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
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Price List *</label>
                        <Combobox
                          name="sellingPriceList"
                          value={formData.sellingPriceList ?? companyDefaults?.defaultSellingPriceList ?? ""}
                          options={priceLists}
                          onChange={handleSelectChange}
                                                    error={fieldErrors?.sellingPriceList}
                        />
                      </div>
                      {showPlcRate && (
                        <>
                          <div>
                            <label className={labelClass}>Price List Currency</label>
                            <input
                              type="text"
                              value={effectivePlcCurrency}
                              readOnly
                              className={`${inputClass} bg-gray-50`}
                            />
                          </div>
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
                        </>
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
                    </div>
                  </div>
                );
              })()}
            </CollapsibleSection>
          )}

          {/* Section 4: Items — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3 pb-4 border-b border-border">
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
                {formData.lastScannedWarehouse && (
                  <div>
                    <label className={labelClass}>Last Scanned Warehouse</label>
                    <input
                      type="text"
                      value={formData.lastScannedWarehouse}
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
                    <LinkSearchField
                      value={formData.setWarehouse ?? ""}
                      onChange={(val) => {
                        const next = val || undefined
                        onChange({ setWarehouse: next })
                        onSetWarehouse?.(next)
                      }}
                      searchFn={(q) =>
                        invoiceService.searchWarehousesForInvoice(
                          q,
                          formData.company || companyDefaults?.company,
                        )
                      }
                      validate={async (v) => {
                        const doc = await invoiceService.validateLink("Warehouse", v, [])
                        if (!doc || Object.keys(doc).length === 0) {
                          throw new Error("Invalid Warehouse")
                        }
                      }}
                      placeholder="Select warehouse…"
                      suppressExternalLabelFetch
                      readOnly={isReadOnly}
                    />
                  </div>
                )}
                {formData.isInternalCustomer && formData.updateStock && (
                  <div>
                    <label className={labelClass}>Set Target Warehouse</label>
                    <LinkSearchField
                      value={formData.setTargetWarehouse ?? ""}
                      onChange={(val) => onChange({ setTargetWarehouse: val || undefined })}
                      searchFn={(q) =>
                        invoiceService.searchWarehousesForInvoice(
                          q,
                          formData.company || companyDefaults?.company,
                        )
                      }
                      validate={async (v) => {
                        const doc = await invoiceService.validateLink("Warehouse", v, [])
                        if (!doc || Object.keys(doc).length === 0) {
                          throw new Error("Invalid Warehouse")
                        }
                      }}
                      placeholder="Select warehouse…"
                      suppressExternalLabelFetch
                      readOnly={isReadOnly}
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
                  onClick={() => {
                    if (source.key === "Delivery Note" && !formData.customer) {
                      addToast("Please Select a Customer", "warning")
                      return
                    }
                    setActiveGetItemsSource(source)
                  }}
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
            {/* Items footer: 2-column matching ERPNext section_break_30 */}
            {subtotal != null &&
              (() => {
                const isMultiCurrency =
                  companyDefaults?.currency != null &&
                  formData.currency != null &&
                  formData.currency !== companyDefaults.currency
                const companyCurrency = companyDefaults?.currency ?? ""
                const conversionRate = formData.conversionRate ?? 1
                const toBase = (v: number) =>
                  Math.round((v ?? 0) * conversionRate * 100) / 100
                const hasDiscount =
                  (formData.discountAmount ?? 0) > 0 ||
                  (formData.additionalDiscountPercentage ?? 0) > 0
                const hasIncludedTax =
                  taxRows?.some((r) => r.included_in_print_rate) ||
                  editableTaxRows?.some((r) => r.included_in_print_rate)
                const showNetTotal = hasDiscount || hasIncludedTax
                return (
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
                      {isMultiCurrency && (
                        <>
                          <div>
                            <label className={labelClass}>Total ({companyCurrency})</label>
                            <input
                              type="text"
                              value={formatCurrency(toBase(subtotal ?? 0))}
                              className={`${inputClass} bg-gray-50`}
                              readOnly
                            />
                          </div>
                          {showNetTotal && (
                            <div>
                              <label className={labelClass}>Net Total ({companyCurrency})</label>
                              <input
                                type="text"
                                value={formatCurrency(formData.baseNetTotal ?? toBase(netTotal ?? subtotal ?? 0))}
                                className={`${inputClass} bg-gray-50`}
                                readOnly
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Total ({formData.currency ?? "CAD"})</label>
                        <input
                          type="text"
                          value={formatCurrency(subtotal ?? 0)}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                      {showNetTotal && (
                        <div>
                          <label className={labelClass}>Net Total ({formData.currency ?? "CAD"})</label>
                          <input
                            type="text"
                            value={formatCurrency(netTotal ?? subtotal ?? 0)}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
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
                    </div>
                  </div>
                )
              })()}
          </div>

          {/* Section 5: Taxes and Charges — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-heading">Taxes and Charges</h3>
            {/* Row 1: Tax Category | Shipping Rule | Incoterm — 3-column, matching ERPNext */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-3">
              <div>
                <label className={labelClass}>Tax Category</label>
                <LinkField
                  doctype="Tax Category"
                  value={formData.taxCategory}
                  onChange={(v) => handleSelectChange("taxCategory", v ?? "")}
                  searchFn={(q) => invoiceService.searchSalesLink("Tax Category", q)}
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className={labelClass}>Shipping Rule</label>
                <LinkField
                  doctype="Shipping Rule"
                  value={formData.shippingRule}
                  onChange={(v) => handleSelectChange("shippingRule", v ?? "")}
                  searchFn={(q) =>
                    invoiceService.searchSalesLink("Shipping Rule", q, [
                      ["shipping_rule_type", "=", "Selling"],
                      ["company", "=", currentCompany],
                    ])
                  }
                  readOnly={isReadOnly}
                />
              </div>
              <div>
                <label className={labelClass}>Incoterm</label>
                <LinkField
                  doctype="Incoterm"
                  value={formData.incoterm}
                  onChange={(v) => handleSelectChange("incoterm", v ?? "")}
                  searchFn={(q) => invoiceService.searchSalesLink("Incoterm", q)}
                  readOnly={isReadOnly}
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
            {/* Sales Taxes and Charges Template — Link field (ERPNext), searchable */}
            <div className="mb-3 max-w-sm">
              <label className={labelClass}>
                Sales Taxes and Charges Template
              </label>
              <LinkSearchField
                value={taxesAndChargesTemplate ?? ""}
                onChange={(v) => onTaxTemplateChange?.(v ?? "")}
                searchFn={(q) =>
                  invoiceService.searchTaxTemplates(
                    q,
                    formData.company || companyDefaults?.company,
                  )
                }
                validate={async (v) => {
                  const doc = await invoiceService.validateLink(
                    "Sales Taxes and Charges Template",
                    v,
                    [],
                  )
                  if (!doc || Object.keys(doc).length === 0) {
                    throw new Error("Invalid Sales Taxes and Charges Template")
                  }
                }}
                placeholder="Select template…"
                readOnly={isReadOnly}
              />
            </div>
            {/* Row 3: Tax table — ERPNext-style grid */}
            {(() => {
              const rows: EditableTaxRow[] = taxRows && taxRows.length > 0
                ? taxRows.map((r) => ({
                    charge_type: r.charge_type as ChargeType,
                    account_head: r.account_head,
                    description: r.description,
                    rate: r.rate,
                    tax_amount: r.tax_amount,
                    total: r.total,
                    net_amount: 0,
                    included_in_print_rate: !!r.included_in_print_rate,
                  }))
                : (editableTaxRows ?? [])
              const isEditable = !!onTaxRowsChange
              const currency = formData.currency ?? "CAD"
              const company = formData.company ?? companyDefaults?.company
              const chargeTypes = chargeTypeOptions as ChargeType[]

              const handleTaxRowsChange = (next: EditableTaxRow[]) => {
                if (!onTaxRowsChange) return
                onTaxRowsChange(next)
                next.forEach((row, i) => {
                  const old = rows[i]
                  if (
                    old &&
                    row.account_head &&
                    row.account_head !== old.account_head &&
                    row.charge_type !== "Actual"
                  ) {
                    const withDesc = next.map((r, j) =>
                      j === i ? { ...r, description: row.account_head } : r
                    )
                    invoiceService.getTaxRate(row.account_head).then((result) => {
                      if (result.tax_rate > 0 && onTaxRowsChange) {
                        onTaxRowsChange(
                          withDesc.map((r, j) =>
                            j === i
                              ? { ...r, rate: result.tax_rate, description: result.account_name || r.description }
                              : r
                          )
                        )
                      }
                    })
                  }
                })
              }

              const taxColumns: GridColumn<EditableTaxRow>[] = [
                {
                  key: "charge_type",
                  label: "Type",
                  type: "link",
                  options: chargeTypes,
                  weight: 1.4,
                },
                {
                  key: "account_head",
                  label: "Account Head",
                  type: "link",
                  searchFn: (q) => invoiceService.searchTaxAccounts(q, company),
                  docType: "Account",
                  placeholder: "Select account…",
                  disabled: (row) => !row.charge_type,
                  weight: 2.6,
                },
                {
                  key: "rate",
                  label: "Tax Rate",
                  type: "number",
                  align: "right",
                  disabled: (row) => row.charge_type === "Actual",
                  weight: 1,
                },
                {
                  key: "tax_amount",
                  label: `Amount (${currency})`,
                  type: "number",
                  align: "right",
                  disabled: (row) => row.charge_type !== "Actual",
                  formatter: (r) => formatCurrency(r.tax_amount),
                  weight: 1.4,
                },
                {
                  key: "total",
                  label: `Total (${currency})`,
                  type: "readonly",
                  align: "right",
                  formatter: (r) => formatCurrency(r.total),
                  weight: 1.4,
                },
              ]

              return (
                <ChildTableGrid<EditableTaxRow>
                  title="Sales Taxes and Charges"
                  titleClassName="text-xs font-semibold text-muted"
                  description={
                    isEditable
                      ? "Select an Account Head to auto-fill the tax rate."
                      : undefined
                  }
                  rows={rows}
                  columns={taxColumns}
                  emptyRow={createEmptyTaxRow()}
                  onChange={handleTaxRowsChange}
                  readOnly={!isEditable}
                  canDelete={() => rows.length > 1}
                  testId="taxes_grid"
                  minWidth="720px"
                />
              )
            })()}
            {/* Tax totals — transaction currency only, right side (matching ERPNext) */}
            {totalTaxesAndCharges != null && (
              <div className="mt-3">
                <div className="sm:w-1/2 ml-auto">
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
            {(() => {
              const isMultiCurrency =
                companyDefaults?.currency != null &&
                formData.currency != null &&
                formData.currency !== companyDefaults.currency
              const showRounding = !formData.disableRoundedTotal
              const conversionRate = formData.conversionRate ?? 1
              const toBase = (v: number) =>
                Math.round((v ?? 0) * conversionRate * 100) / 100
              const effectiveRoundedTotal =
                formData.roundedTotal ??
                roundToSmallestCurrencyFraction(grandTotal ?? 0, currencyFraction)
              const effectiveRoundingAdjustment =
                formData.roundingAdjustment ??
                (effectiveRoundedTotal - (grandTotal ?? 0))
              // ERPNext computes outstanding only on save; new docs show 0
              const effectiveOutstanding =
                mode === "new" ? 0 : (outstandingAmount ?? effectiveRoundedTotal)
              const effectiveTotalAdvance =
                totalAdvance ??
                formData.totalAdvance ??
                (formData.advances ?? []).reduce(
                  (sum, a) => sum + (a.allocated_amount ?? 0),
                  0,
                )
              const companyCurrency = companyDefaults?.currency ?? ""
              const docCurrency = formData.currency ?? "CAD"

              return (
                <div
                  className={`mt-3 ${
                    isMultiCurrency
                      ? "grid grid-cols-1 lg:grid-cols-2 gap-6"
                      : "sm:w-1/2 ml-auto space-y-3"
                  }`}
                >
                  {isMultiCurrency && (
                    <div className="space-y-3">
                      <div>
                        <label className={labelClass}>Grand Total ({companyCurrency})</label>
                        <input
                          type="text"
                          value={formatCurrency(formData.baseGrandTotal ?? toBase(grandTotal ?? 0))}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                      {showRounding && (
                        <div>
                          <label className={labelClass}>Rounding Adjustment ({companyCurrency})</label>
                          <input
                            type="text"
                            value={formatCurrency(formData.baseRoundingAdjustment ?? toBase(effectiveRoundingAdjustment))}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                      {showRounding && (
                        <div>
                          <label className={labelClass}>Rounded Total ({companyCurrency})</label>
                          <input
                            type="text"
                            value={formatCurrency(formData.baseRoundedTotal ?? toBase(effectiveRoundedTotal))}
                            className={`${inputClass} bg-gray-50`}
                            readOnly
                          />
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Grand Total ({docCurrency})</label>
                      <input
                        type="text"
                        value={formatCurrency(grandTotal ?? 0)}
                        className={`${inputClass} bg-gray-50 font-bold`}
                        readOnly
                      />
                    </div>
                    {showRounding && (
                      <div>
                        <label className={labelClass}>Rounding Adjustment ({docCurrency})</label>
                        <input
                          type="text"
                          value={formatCurrency(effectiveRoundingAdjustment)}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                    )}
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
                    {showRounding && (
                      <div>
                        <label className={labelClass}>Rounded Total ({docCurrency})</label>
                        <input
                          type="text"
                          value={formatCurrency(effectiveRoundedTotal)}
                          className={`${inputClass} bg-gray-50 font-bold`}
                          readOnly
                        />
                      </div>
                    )}
                    <div>
                      <label className={labelClass}>Total Advance ({docCurrency})</label>
                      <input
                        type="text"
                        value={formatCurrency(effectiveTotalAdvance ?? 0)}
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Outstanding Amount ({docCurrency})</label>
                      <input
                        type="text"
                        value={formatCurrency(effectiveOutstanding)}
                        className={`${inputClass} bg-gray-50 font-semibold`}
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
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Section 7: Additional Discount — after Totals (matching ERPNext) */}
          <CollapsibleSection title="Additional Discount">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Apply Additional Discount On</label>
                  <select
                    value={formData.applyDiscountOn ?? applyDiscountOnOptions[0] ?? ""}
                    onChange={(e) =>
                      handleApplyDiscountOnChange(
                        (e.target.value || "Grand Total") as "Grand Total" | "Net Total",
                      )
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
                    <LinkSearchField
                      value={formData.discountAccount ?? ""}
                      onChange={(val) => onChange({ discountAccount: val || undefined })}
                      searchFn={(q) =>
                        invoiceService.searchDiscountAccounts(
                          q,
                          formData.company || companyDefaults?.company,
                        )
                      }
                      validate={async (v) => {
                        const doc = await invoiceService.validateLink("Account", v, [])
                        if (!doc || Object.keys(doc).length === 0) {
                          throw new Error("Invalid Account")
                        }
                      }}
                      placeholder="Select account…"
                      suppressExternalLabelFetch
                      readOnly={isReadOnly}
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
                      handleAdditionalDiscountPercentageChange(
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    className={inputClass}
                    placeholder="0.000"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Additional Discount Amount ({formData.currency ?? "CAD"})
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.discountAmount ?? ""}
                    onChange={(e) =>
                      handleAdditionalDiscountAmountChange(
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
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
                            readOnly={isReadOnly}
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
                      <LinkSearchField
                        value={formData.customerAddress ?? ""}
                        onChange={(v) => {
                          onChange({ customerAddress: v || undefined });
                          if (v) {
                            invoiceService.validateLink("Address", v, []).then(() => {
                              invoiceService.getAddressDisplay(v).then((display) => {
                                if (display) onChange({ addressDisplay: display });
                              });
                            });
                          } else {
                            onChange({ addressDisplay: undefined });
                          }
                        }}
                        searchFn={(q) => invoiceService.searchCustomerAddresses(formData.customer, q)}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        readOnly={isReadOnly}
                      />
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
                      <LinkField
                        doctype="Territory"
                        value={formData.territory}
                        onChange={(v) => handleSelectChange("territory", v ?? "")}
                        searchFn={(q) => invoiceService.searchSalesLink("Territory", q)}
                        placeholder="Select territory…"
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>
                  {/* Right column: Contact link + display */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <LinkSearchField
                        value={formData.contactPerson ?? ""}
                        onChange={(v) => {
                          onChange({ contactPerson: v || undefined });
                          if (v) {
                            invoiceService.validateLink("Contact", v, []).then(() => {
                              invoiceService.getContactDetails(v).then((details) => {
                                onChange({
                                  contactDisplay: details.contact_display,
                                  contactEmail: details.contact_email,
                                  contactMobile: details.contact_mobile,
                                  contactPhone: details.contact_phone,
                                  contactDesignation: details.contact_designation,
                                  contactDepartment: details.contact_department,
                                });
                              });
                            });
                          } else {
                            onChange({
                              contactDisplay: undefined,
                              contactEmail: undefined,
                              contactMobile: undefined,
                              contactPhone: undefined,
                              contactDesignation: undefined,
                              contactDepartment: undefined,
                            });
                          }
                        }}
                        searchFn={(q) => invoiceService.searchCustomerContacts(formData.customer, q)}
                        placeholder="Select contact…"
                        suppressExternalLabelFetch
                        readOnly={isReadOnly}
                      />
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
                    {(formData.contactPhone || formData.contactDesignation || formData.contactDepartment) && (
                      <div className="text-xs text-muted space-y-1">
                        {formData.contactPhone && <p><span className="font-medium">Phone:</span> {formData.contactPhone}</p>}
                        {formData.contactDesignation && <p><span className="font-medium">Designation:</span> {formData.contactDesignation}</p>}
                        {formData.contactDepartment && <p><span className="font-medium">Department:</span> {formData.contactDepartment}</p>}
                      </div>
                    )}
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
                      <LinkSearchField
                        value={formData.shippingAddressName ?? ""}
                        onChange={(v) => {
                          onChange({ shippingAddressName: v || undefined });
                          if (v) {
                            invoiceService.validateLink("Address", v, []).then(() => {
                              invoiceService.getAddressDisplay(v).then((display) => {
                                if (display) onChange({ shippingAddress: display });
                              });
                            });
                          } else {
                            onChange({ shippingAddress: undefined });
                          }
                        }}
                        searchFn={(q) => invoiceService.searchCustomerAddresses(formData.customer, q)}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        readOnly={isReadOnly}
                      />
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
                      <LinkSearchField
                        value={formData.dispatchAddressName ?? ""}
                        onChange={(v) => {
                          onChange({ dispatchAddressName: v || undefined });
                          if (v) {
                            invoiceService.validateLink("Address", v, []);
                          }
                        }}
                        searchFn={(q) => invoiceService.searchCompanyAddresses(companyDefaults?.company ?? "", q)}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        readOnly={isReadOnly}
                      />
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
                      <LinkSearchField
                        value={formData.companyAddress ?? ""}
                        onChange={(v) => {
                          onChange({ companyAddress: v || undefined });
                          if (v) {
                            invoiceService.validateLink("Address", v, []).then(() => {
                              invoiceService.getAddressDisplay(v).then((display) => {
                                if (display) onChange({ companyAddressDisplay: display });
                              });
                            });
                          } else {
                            onChange({ companyAddressDisplay: undefined });
                          }
                        }}
                        searchFn={(q) => invoiceService.searchCompanyAddresses(companyDefaults?.company ?? "", q)}
                        placeholder="Select address…"
                        suppressExternalLabelFetch
                        readOnly={isReadOnly}
                      />
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
                    <LinkSearchField
                      value={formData.companyContactPerson ?? ""}
                      onChange={(v) => {
                        onChange({ companyContactPerson: v || undefined });
                        if (v) {
                          invoiceService.validateLink("Contact", v, []);
                        }
                      }}
                      searchFn={(q) => invoiceService.searchCompanyContacts(companyDefaults?.company ?? "", q)}
                      placeholder="Select contact…"
                      suppressExternalLabelFetch
                      readOnly={isReadOnly}
                    />
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
                    <LinkField
                      doctype="Account"
                      value={formData.accountForChangeAmount}
                      onChange={(v) => handleSelectChange("accountForChangeAmount", v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Account", q, [
                          ["account_type", "in", ["Cash", "Bank"]],
                          ["company", "=", currentCompany],
                          ["is_group", "=", 0],
                        ])
                      }
                      placeholder="Select account…"
                      readOnly={isReadOnly}
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
                    <LinkField
                      doctype="Account"
                      value={formData.writeOffAccount}
                      onChange={(v) => handleSelectChange("writeOffAccount", v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Account", q, [
                          ["report_type", "=", "Profit and Loss"],
                          ["is_group", "=", 0],
                          ["company", "=", currentCompany],
                        ])
                      }
                      placeholder="Select account…"
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Write Off Cost Center</label>
                    <LinkField
                      doctype="Cost Center"
                      value={formData.writeOffCostCenter}
                      onChange={(v) => handleSelectChange("writeOffCostCenter", v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Cost Center", q, [
                          ["is_group", "=", 0],
                          ["company", "=", currentCompany],
                        ])
                      }
                      placeholder="Select cost center…"
                      readOnly={isReadOnly}
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
                    <LinkField
                      doctype="Account"
                      value={formData.loyaltyRedemptionAccount}
                      onChange={(v) => handleSelectChange("loyaltyRedemptionAccount", v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Account", q, [
                          ["is_group", "=", 0],
                          ["company", "=", currentCompany],
                        ])
                      }
                      placeholder="Select account…"
                      readOnly={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Redemption Cost Center</label>
                    <LinkField
                      doctype="Cost Center"
                      value={formData.loyaltyRedemptionCostCenter}
                      onChange={(v) => handleSelectChange("loyaltyRedemptionCostCenter", v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Cost Center", q, [
                          ["is_group", "=", 0],
                          ["company", "=", currentCompany],
                        ])
                      }
                      placeholder="Select cost center…"
                      readOnly={isReadOnly}
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
                <LinkField
                  doctype="Payment Terms Template"
                  value={formData.paymentTermsTemplate}
                  onChange={(v) => handleSelectChange("paymentTermsTemplate", v ?? "")}
                  searchFn={(q) => invoiceService.searchSalesLink("Payment Terms Template", q)}
                  placeholder="Select template…"
                  readOnly={isReadOnly}
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
              <LinkField
                doctype="Terms and Conditions"
                value={formData.tcName}
                onChange={(v) => handleSelectChange("tcName", v ?? "")}
                searchFn={(q) =>
                  invoiceService.searchSalesLink("Terms and Conditions", q, [
                    ["selling", "=", 1],
                  ])
                }
                placeholder="Select template…"
                readOnly={isReadOnly}
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
                    {formData.partyAccountCurrency && (
                      <div>
                        <label className={labelClass}>Account Currency</label>
                        <input
                          type="text"
                          value={formData.partyAccountCurrency}
                          className={`${inputClass} bg-gray-50`}
                          readOnly
                        />
                      </div>
                    )}
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
                      <LinkField
                        doctype="Account"
                        value={formData.unrealizedProfitLossAccount}
                        onChange={(v) => handleSelectChange("unrealizedProfitLossAccount", v ?? "")}
                        searchFn={(q) =>
                          invoiceService.searchSalesLink("Account", q, [
                            ["root_type", "=", "Liability"],
                            ["is_group", "=", 0],
                            ["company", "=", currentCompany],
                          ])
                        }
                        placeholder="Select account…"
                        readOnly={isReadOnly}
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
                      <LinkField
                        doctype="Sales Partner"
                        value={formData.salesPartner}
                        onChange={(v) => handleSelectChange("salesPartner", v ?? "")}
                        searchFn={(q) => invoiceService.searchSalesLink("Sales Partner", q)}
                        placeholder="Select partner…"
                        readOnly={isReadOnly}
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
                      <LinkField
                        doctype="Letter Head"
                        value={formData.letterHead}
                        onChange={(v) => handleSelectChange("letterHead", v ?? "")}
                        searchFn={(q) => invoiceService.searchSalesLink("Letter Head", q)}
                        placeholder="Default…"
                        readOnly={isReadOnly}
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
                      <LinkSearchField
                        value={formData.selectPrintHeading ?? ""}
                        onChange={(v) =>
                          handleSelectChange("selectPrintHeading", v ?? "")
                        }
                        searchFn={(q) => invoiceService.searchPrintHeadings(q)}
                        validate={async (v) => {
                          const doc = await invoiceService.validateLink(
                            "Print Heading",
                            v,
                            [],
                          )
                          if (!doc || Object.keys(doc).length === 0) {
                            throw new Error("Invalid Print Heading")
                          }
                        }}
                        placeholder="Default…"
                        readOnly={isReadOnly}
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
                          readOnly={isReadOnly}
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
                      <LinkField
                        doctype="Campaign"
                        value={formData.campaign}
                        onChange={(v) => handleSelectChange("campaign", v ?? "")}
                        searchFn={(q) => invoiceService.searchSalesLink("Campaign", q)}
                        placeholder="Select campaign…"
                        readOnly={isReadOnly}
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
                      <LinkField
                        doctype="Lead Source"
                        value={formData.source}
                        onChange={(v) => handleSelectChange("source", v ?? "")}
                        searchFn={(q) => invoiceService.searchSalesLink("Lead Source", q)}
                        placeholder="Select source…"
                        readOnly={isReadOnly}
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
      </fieldset>
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
