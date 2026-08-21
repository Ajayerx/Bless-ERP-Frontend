"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  CollapsibleSection,
  useMessageDialog,
  messageFromError,
} from "@/components/ui";
import { Combobox, LinkField as SharedLinkField, inputClass, labelClass, errCls } from "@/components/ui/form-fields";
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid";
import LinkSearchField from "@/components/ui/LinkSearchField";
import ReturnAgainstSearchModal from "./ReturnAgainstSearchModal";
import { type Customer } from "@/services";
import { invoiceService } from "@/services";
import { useAuth } from "@/context/AuthContext";
import { useLazyOptions } from "@/services/lookup-cache";
import { formatCurrency, formatDateDDMMYYYY } from "@/lib/utils";
import type { EditableTaxRow, ChargeType } from "../types";
import {
  buildDeskSetMissingValuesDoc,
  createEmptyTaxRow,
  deskRandomString,
  getCurrencySmallestFraction,
  getItemisedTaxBreakupData,
  invoiceTaxesToEditable,
  roundToSmallestCurrencyFraction,
  type ItemisedTaxBreakupTaxRow,
} from "../services";
import type { LineItemForm } from "./InvoiceLineItems";
import ItemisedTaxBreakup from "./ItemisedTaxBreakup";
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
    payment_term?: string;
    description?: string;
    due_date: string;
    invoice_portion?: number;
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
    contact_no?: string;
    allocated_percentage?: number;
    allocated_amount?: number;
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
    name?: string;
    reference_type: string;
    reference_name: string;
    reference_row?: string;
    remarks?: string;
    advance_amount: number;
    allocated_amount: number;
    account?: string;
    ref_exchange_rate?: number;
    difference_posting_date?: string;
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

type AdvanceRow = NonNullable<InvoiceFormData["advances"]>[number];

const emptyAdvanceRow: AdvanceRow = {
  id: "",
  reference_name: "",
  reference_type: "",
  remarks: "",
  advance_amount: 0,
  allocated_amount: 0,
};

const readonlyPlaceholder = (label: string) => (
  <span className="text-xs text-muted">{label}</span>
);

// ERPNext renders read-only Text/SmallText display values with HTML breaks as
// real line breaks (frappe/form/formatters.js Text formatter). SPA display
// fields normalize <br> to newlines and escape any other HTML.
const normalizeDisplayText = (value?: string) =>
  (value ?? "").replace(/<br\s*\/?>/gi, "\n");

const advanceColumns: GridColumn<AdvanceRow>[] = [
  {
    key: "reference_name",
    label: "Reference Name",
    type: "readonly",
    weight: 1.2,
    render: (row) =>
      !row.reference_name ? (
        readonlyPlaceholder("Reference Name")
      ) : row.reference_type === "Payment Entry" ? (
        <Link
          to={`/payments/${encodeURIComponent(row.reference_name)}`}
          className="text-xs font-medium text-primary-600 hover:underline"
        >
          {row.reference_name}
        </Link>
      ) : (
        <span className="text-xs font-medium text-body">{row.reference_name}</span>
      ),
  },
  {
    key: "remarks",
    label: "Remarks",
    type: "readonly",
    weight: 1.1,
    formatter: (row) => (row.remarks ? row.remarks : readonlyPlaceholder("Remarks")),
  },
  {
    key: "advance_amount",
    label: "Advance amount",
    type: "readonly",
    align: "right",
    weight: 0.9,
    formatter: (row) =>
      row.advance_amount ? formatCurrency(row.advance_amount) : readonlyPlaceholder("Advance amount"),
  },
  {
    key: "allocated_amount",
    label: "Allocated amount",
    type: "number",
    align: "right",
    weight: 0.9,
    placeholder: "0.00",
  },
  {
    key: "difference_posting_date",
    label: "Difference Posting Date",
    type: "date",
    weight: 1,
    formatter: (row) => (row.difference_posting_date ? formatDateDDMMYYYY(row.difference_posting_date) : "—"),
  },
];

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
  lineItems?: React.ReactNode;
  itemLines?: LineItemForm[];
  storedTaxBreakupHtml?: string;
  taxRows?: Array<{
    charge_type: string;
    account_head: string;
    description: string;
    rate: number;
    tax_amount: number;
    total: number;
    included_in_print_rate?: boolean;
    row_id?: number;
    category?: string;
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
  onSetWarehouse?: (warehouse: string | undefined) => void;
  mode?: "new" | "existing";
  docstatus?: number;
}

const LinkField = (props: Parameters<typeof SharedLinkField>[0]) => (
  <SharedLinkField
    {...props}
    validateValue={async (v) => {
      const doc = await invoiceService.validateLink(props.doctype, v, []);
      if (!doc || Object.keys(doc).length === 0) {
        throw new Error(`Invalid ${props.doctype}`);
      }
    }}
  />
);

export default function InvoiceForm({
  formData,
  onChange,
  fieldErrors,
  taxesAndChargesTemplate,
  onTaxTemplateChange,
  onSelectCustomer,
  loadingPartyDetails,
  lineItems,
  itemLines,
  storedTaxBreakupHtml,
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
  onSetWarehouse,
  mode = "new",
  docstatus = 0,
}: InvoiceFormProps) {
  const navigate = useNavigate();

  const isExisting = mode === "existing";
  const isReadOnly = isExisting && docstatus !== 0;
  const isSubmitted = isExisting && docstatus === 1;
  const isCancelled = isExisting && docstatus === 2;

  // ERPNext allow_on_submit (sales_invoice.json): these fields stay editable
  // even when the document is Submitted/Paid. Everything else is frozen and
  // saving re-submits via on_update_after_submit keeping docstatus = 1.
  const SUBMIT_EDITABLE = new Set<string>([
    "letterHead",
    "selectPrintHeading",
    "dispatchAddressName",
    "discountAccount",
    "fromDate",
    "toDate",
    "groupSameItems",
    "isOpening",
    "poNo",
    "poDate",
    "costCenter",
    "project",
    "accountForChangeAmount",
    "writeOffAccount",
    "loyaltyRedemptionAccount",
    "salesTeam",
  ]);
  const fieldLocked = (key: string) =>
    isReadOnly && !(isSubmitted && SUBMIT_EDITABLE.has(key));

  const [currencyFraction, setCurrencyFraction] = useState<number | null>(null);
  useEffect(() => {
    // Read-only (submitted/paid/cancelled): ERPNext stores rounding on the doc
    // (rounded_total / in_words), so no client-side fraction fetch is needed on
    // open. The totals render uses formData.roundedTotal when present.
    if (isReadOnly) {
      setCurrencyFraction(null);
      return;
    }
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
  }, [formData.currency, companyDefaults?.currency, isReadOnly]);

  // ERPNext "Tax Breakup": live per-item breakdown, computed from the current
  // line items + recomputed tax rows. Shown only when the doc has no stored
  // `other_charges_calculation` HTML (ERPNext renders that stored HTML instead).
  const breakupRows = useMemo(
    () =>
      getItemisedTaxBreakupData(
        (itemLines ?? []).map((line) => ({
          itemCode: line.productId ?? line.sku ?? "",
          itemName: line.productName,
          qty: line.quantity,
          netAmount: line.netAmount ?? line.total,
        })),
        (taxRows ?? []).map(
          (r): ItemisedTaxBreakupTaxRow => ({
            charge_type: r.charge_type as ChargeType,
            description: r.description,
            rate: r.rate,
            tax_amount: r.tax_amount,
            row_id: r.row_id,
            category: r.category,
          }),
        ),
      ),
    [itemLines, taxRows],
  );

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
  const [activeTab, setActiveTab] = useState("details");
  const [returnAgainstSearchOpen, setReturnAgainstSearchOpen] = useState(false);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [focusCustomer, setFocusCustomer] = useState(false);
  const redemptionFactorRef = useRef<number | null>(null);
  const { showMessage } = useMessageDialog();
  const { user } = useAuth();
  // Desk keeps the local doc name fixed across re-fires of set_pos_data.
  const localDocNameRef = useRef<string | null>(null);
  // r.message from set_missing_values (print_format, skip_default_payment…),
  // stashed like desk's frm for later print/payment defaults.
  const posMessageRef = useRef<{
    print_format?: string;
    allow_edit_rate?: boolean;
    allow_edit_discount?: boolean;
    campaign?: string;
    allow_print_before_pay?: boolean;
    skip_default_payment?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!focusCustomer || activeTab !== "details") return;
    const el = document.getElementById("customer-field");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.querySelector("input")?.focus();
    setFocusCustomer(false);
  }, [focusCustomer, activeTab]);

  const handleRequireCustomer = useCallback(() => {
    if (formData.customer) return;
    setFocusCustomer(true);
    setActiveTab("details");
  }, [formData.customer]);

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

  const handleGetAdvances = useCallback(async (overrides?: {
    isAuto?: boolean;
    onlyInclude?: boolean;
    ignoreReturn?: boolean;
  }) => {
    if (!formData.customer || !companyDefaults?.company) return
    if (formData.isReturn && !overrides?.ignoreReturn) return
    setLoadingAdvances(true)
    try {
      const conversionRate = formData.conversionRate ?? 1
      const gTotal = grandTotal ?? 0
      const baseGrandTotal = formData.baseGrandTotal ?? Math.round(gTotal * conversionRate * 100) / 100
      const roundedTotal = formData.roundedTotal ?? gTotal
      const baseRoundedTotal = formData.baseRoundedTotal ?? baseGrandTotal
      const auto = overrides?.isAuto ?? !!formData.allocateAdvancesAutomatically
      const onlyInclude = overrides?.onlyInclude ?? !!formData.onlyIncludeAllocatedPayments
      const doc: Record<string, unknown> = {
        customer: formData.customer,
        company: companyDefaults.company,
        posting_date: formData.issueDate,
        set_posting_time: !!formData.setPostingTime,
        posting_time: formData.postingTime,
        currency: formData.currency || companyDefaults.currency || "",
        conversion_rate: conversionRate,
        debit_to: formData.debitTo || companyDefaults.defaultReceivableAccount || "",
        party_account_currency: formData.partyAccountCurrency,
        company_currency: companyDefaults.currency,
        grand_total: gTotal,
        base_grand_total: baseGrandTotal,
        rounded_total: roundedTotal,
        base_rounded_total: baseRoundedTotal,
        total_advance:
          formData.totalAdvance ??
          (formData.advances ?? []).reduce((sum, a) => sum + (a.allocated_amount ?? 0), 0),
        allocate_advances_automatically: auto,
        only_include_allocated_payments: onlyInclude,
        is_return: !!formData.isReturn,
        items: [] as Array<Record<string, unknown>>,
      }
      const rows = await invoiceService.setAdvances(doc)
      const mapped = rows.map((a) => ({
        id: crypto.randomUUID(),
        name: a.reference_name,
        reference_type: a.reference_type,
        reference_name: a.reference_name,
        reference_row: a.reference_row,
        remarks: a.remarks,
        advance_amount: a.advance_amount,
        allocated_amount: a.allocated_amount,
        account: a.account,
        ref_exchange_rate: a.ref_exchange_rate,
        difference_posting_date: a.difference_posting_date,
      }))
      onChange({
        advances: mapped,
        totalAdvance: mapped.reduce((sum, a) => sum + (a.allocated_amount ?? 0), 0),
      })
    } catch (e) {
      showMessage(messageFromError(e, "Failed to load advances"))
    } finally {
      setLoadingAdvances(false)
    }
  }, [formData, companyDefaults, grandTotal, onChange, showMessage])

  // Port of sales_invoice.js set_pos_data: checking "Include Payment (POS)"
  // runs frm.call({doc, method:"set_missing_values"}) against the full desk
  // doc envelope, merges the mutated doc back into the form, then pulls the
  // template's tax rows via get_taxes_and_charges (transaction.js
  // taxes_and_charges trigger, incl. its shipping_rule add_child branch).
  const runPosChain = useCallback(
    async (overrides?: { posProfile?: string }): Promise<boolean> => {
      const company = companyDefaults?.company || formData.company;
      if (!company) {
        showMessage("Please set Company to enable POS");
        return false;
      }
      if (!localDocNameRef.current) {
        localDocNameRef.current = `new-sales-invoice-${deskRandomString()}`;
      }
      const posProfile = overrides?.posProfile ?? formData.posProfile;
      const formForDoc: Record<string, unknown> = {
        ...formData,
        name: localDocNameRef.current,
        company,
        isPos: true,
        allocateAdvancesAutomatically: false,
        ...(posProfile ? { posProfile } : {}),
      };
      try {
        const res = await invoiceService.setMissingValues(
          buildDeskSetMissingValuesDoc(formForDoc, {
            isNew: !isExisting,
            owner: user?.id,
            totals: { subtotal, netTotal, grandTotal, totalTaxesAndCharges, totalQuantity },
          }),
          !!formData.isReturn,
        );
        posMessageRef.current = res.message ?? null;
        // frappe.model.sync(data.docs): merge the mutated doc back.
        const updated = res.docs?.[0];
        const str = (k: string): string | undefined => {
          const v = updated?.[k];
          return typeof v === "string" && v !== "" ? v : undefined;
        };
        const num = (k: string): number | undefined =>
          typeof updated?.[k] === "number" ? (updated[k] as number) : undefined;
        const patch: Partial<InvoiceFormData> = { isPos: true };
        if (updated) {
          Object.assign(patch, {
            debitTo: str("debit_to"),
            partyAccountCurrency: str("party_account_currency"),
            dueDate: str("due_date"),
            taxesAndCharges: str("taxes_and_charges"),
            cashBankAccount: str("cash_bank_account"),
            accountForChangeAmount: str("account_for_change_amount"),
            customerGroup: str("customer_group"),
            territory: str("territory"),
            customerAddress: str("customer_address"),
            addressDisplay: str("address_display"),
            shippingAddressName: str("shipping_address_name"),
            shippingAddress: str("shipping_address"),
            contactPerson: str("contact_person"),
            contactDisplay: str("contact_display"),
            contactEmail: str("contact_email"),
            contactMobile: str("contact_mobile"),
            taxCategory: str("tax_category"),
            paymentTermsTemplate: str("payment_terms_template"),
            paidAmount: num("paid_amount"),
            basePaidAmount: num("base_paid_amount"),
            changeAmount: num("change_amount"),
            baseChangeAmount: num("base_change_amount"),
            writeOffAmount: num("write_off_amount"),
            baseWriteOffAmount: num("base_write_off_amount"),
            outstandingAmount: num("outstanding_amount"),
          });
          if (overrides?.posProfile !== undefined) patch.posProfile = overrides.posProfile;
          const payRows = Array.isArray(updated.payments) ? updated.payments : [];
          if (payRows.length > 0) {
            patch.payments = payRows.map((p) => {
              const row = p as Record<string, unknown>;
              return {
                id: crypto.randomUUID(),
                mode_of_payment: String(row.mode_of_payment ?? ""),
                amount: Number(row.amount ?? 0),
                ...(typeof row.account === "string" && row.account ? { account: row.account } : {}),
              };
            });
          }
        }
        // transaction.js taxes_and_charges trigger: fetch the template's rows
        // and either append (shipping_rule with existing taxes) or replace.
        const template = str("taxes_and_charges") ?? formData.taxesAndCharges;
        if (template && onTaxRowsChange) {
          const rows = await invoiceService.getTaxesAndCharges(template);
          const mapped = invoiceTaxesToEditable(rows);
          if (formData.shippingRule && (editableTaxRows ?? []).length > 0) {
            onTaxRowsChange([...(editableTaxRows ?? []), ...mapped]);
          } else {
            onTaxRowsChange(mapped);
          }
        }
        onChange(patch);
        return true;
      } catch (e) {
        showMessage(messageFromError(e, "Failed to set POS data"));
        return false;
      }
    },
    [
      formData,
      companyDefaults,
      subtotal,
      netTotal,
      grandTotal,
      totalTaxesAndCharges,
      totalQuantity,
      editableTaxRows,
      onTaxRowsChange,
      onChange,
      showMessage,
      isExisting,
      user?.id,
    ],
  );

  const handleIsPosChange = useCallback(
    async (checked: boolean) => {
      if (!checked) {
        // Desk's unchecked branch does no network call — just refreshes.
        onChange({ isPos: false });
        return;
      }
      await runPosChain();
    },
    [onChange, runPosChain],
  );

  const handlePosProfileSelect = useCallback(
    async (value: string | undefined) => {
      // Desk's pos_profile trigger clears taxes then reruns the whole chain.
      if (onTaxRowsChange) onTaxRowsChange([]);
      if (!value) {
        onChange({ posProfile: undefined });
        return;
      }
      await runPosChain({ posProfile: value });
    },
    [onChange, onTaxRowsChange, runPosChain],
  );

  const handleAllocateAdvancesChange = useCallback((checked: boolean) => {
    onChange({ allocateAdvancesAutomatically: checked })
    if (checked) void handleGetAdvances({ isAuto: true, ignoreReturn: true })
  }, [onChange, handleGetAdvances])

  const handleOnlyAllocatedPaymentsChange = useCallback((checked: boolean) => {
    onChange({ onlyIncludeAllocatedPayments: checked })
    void handleGetAdvances({ isAuto: true, onlyInclude: checked, ignoreReturn: true })
  }, [onChange, handleGetAdvances])

  const handleAdvancesGridChange = useCallback(
    (rows: AdvanceRow[]) => {
      const next = rows.map((r) => (r.id ? r : { ...r, id: crypto.randomUUID() }))
      onChange({
        advances: next,
        totalAdvance: next.reduce((sum, a) => sum + (a.allocated_amount ?? 0), 0),
      })
    },
    [onChange],
  )

  // Byte-parity with transaction.js payment_terms_template(): selecting a
  // template fetches the full Payment Schedule from get_payment_terms and
  // replaces the rows.
  const handlePaymentTermsTemplateChange = useCallback(
    async (value: string) => {
      onChange({ paymentTermsTemplate: value || undefined })
      if (!value || formData.isPos || formData.isReturn) return
      const gTotal = grandTotal ?? 0
      const conversionRate = formData.conversionRate ?? 1
      const baseGrandTotal =
        formData.baseGrandTotal ?? Math.round(gTotal * conversionRate * 100) / 100
      const roundedTotal = formData.roundedTotal ?? gTotal
      const baseRoundedTotal = formData.baseRoundedTotal ?? baseGrandTotal
      const schedule = await invoiceService.getPaymentTerms(
        value,
        formData.issueDate,
        roundedTotal,
        baseRoundedTotal,
      )
      if (!schedule) return
      const rows = schedule.map((s) => ({
        id: crypto.randomUUID(),
        payment_term: s.payment_term ?? "",
        description: s.description ?? "",
        due_date: s.due_date?.slice(0, 10) ?? formData.dueDate ?? formData.issueDate,
        invoice_portion: s.invoice_portion ?? 0,
        payment_amount: s.payment_amount ?? 0,
      }))
      onChange({ paymentScheduleRows: rows })
    },
    [formData, grandTotal, onChange],
  )

  // Byte-parity with transaction.js payment_term(): picking a Payment Term in
  // the schedule grid auto-fills the row's description/portion/amount/due date.
  const handlePaymentTermSelect = useCallback(
    async (rowId: string, term: string) => {
      if (!term) return
      const gTotal = grandTotal ?? 0
      const conversionRate = formData.conversionRate ?? 1
      const baseGrandTotal =
        formData.baseGrandTotal ?? Math.round(gTotal * conversionRate * 100) / 100
      const roundedTotal = formData.roundedTotal ?? gTotal
      const baseRoundedTotal = formData.baseRoundedTotal ?? baseGrandTotal
      const details = await invoiceService.getPaymentTermDetails(
        term,
        formData.issueDate,
        roundedTotal,
        baseRoundedTotal,
      )
      if (!details) return
      onChange({
        paymentScheduleRows: (formData.paymentScheduleRows ?? []).map((r) =>
          r.id === rowId
            ? {
                ...r,
                payment_term: term,
                description: (details.description as string) ?? r.description,
                due_date:
                  ((details.due_date as string) ?? "")?.slice(0, 10) || r.due_date,
                invoice_portion: (details.invoice_portion as number) ?? r.invoice_portion,
                payment_amount: (details.payment_amount as number) ?? r.payment_amount,
              }
            : r,
        ),
      })
    },
    [formData, grandTotal, onChange],
  )

  // Byte-parity with erpnext.utils.get_terms(): selecting a Terms template
  // renders it server-side and fills the terms text.
  const handleTcNameChange = useCallback(
    async (value: string) => {
      onChange({ tcName: value || undefined })
      if (!value) return
      const gTotal = grandTotal ?? 0
      const conversionRate = formData.conversionRate ?? 1
      const baseGrandTotal =
        formData.baseGrandTotal ?? Math.round(gTotal * conversionRate * 100) / 100
      const doc: Record<string, unknown> = {
        customer: formData.customer,
        customer_name: formData.customerName,
        company: companyDefaults?.company,
        posting_date: formData.issueDate,
        due_date: formData.dueDate,
        currency: formData.currency || companyDefaults?.currency,
        grand_total: gTotal,
        base_grand_total: baseGrandTotal,
        rounded_total: formData.roundedTotal ?? gTotal,
        base_rounded_total: formData.baseRoundedTotal ?? baseGrandTotal,
        net_total: formData.netTotal ?? 0,
        total: formData.netTotal ?? 0,
      }
      const rendered = await invoiceService.getTermsAndConditions(value, doc)
      if (rendered != null) onChange({ terms: rendered })
    },
    [formData, companyDefaults, grandTotal, onChange],
  )

  const applyLoyaltyPoints = useCallback(
    (points: number, factor: number) => {
      const loyaltyAmount = Math.round(points * factor * 100) / 100
      const effectiveTotalAdvance =
        totalAdvance ??
        formData.totalAdvance ??
        (formData.advances ?? []).reduce((sum, a) => sum + (a.allocated_amount ?? 0), 0)
      const remainingAmount =
        (grandTotal ?? 0) - effectiveTotalAdvance - (formData.writeOffAmount ?? 0)
      if (grandTotal && remainingAmount < loyaltyAmount) {
        const redeemablePoints = Math.floor(remainingAmount / factor)
        showMessage(`You can only redeem max ${redeemablePoints} points in this order.`)
        return
      }
      onChange({ loyaltyAmount })
    },
    [grandTotal, totalAdvance, formData.totalAdvance, formData.advances, formData.writeOffAmount, onChange, showMessage],
  )

  const handleLoyaltyPointsChange = useCallback(
    (points: number | undefined) => {
      onChange({ loyaltyPoints: points })
      if (points == null) return
      const factor = redemptionFactorRef.current
      if (factor != null) {
        applyLoyaltyPoints(points, factor)
        return
      }
      invoiceService
        .getRedeemptionFactor(formData.loyaltyProgram || "")
        .then((f) => {
          redemptionFactorRef.current = f
          applyLoyaltyPoints(points, f)
        })
        .catch((e) => showMessage(messageFromError(e, "Failed to get redemption factor")))
    },
    [formData.loyaltyProgram, onChange, applyLoyaltyPoints, showMessage],
  )

  const handleRedeemLoyaltyChange = useCallback(
    async (checked: boolean) => {
      onChange({ redeemLoyaltyPoints: checked })
      if (!checked) {
        redemptionFactorRef.current = null
        return
      }
      if (!formData.customer) return
      try {
        const details = await invoiceService.getLoyaltyProgramDetails({
          customer: formData.customer,
          loyalty_program: formData.loyaltyProgram || undefined,
          expiry_date: formData.issueDate,
          company: companyDefaults?.company,
        })
        onChange({
          loyaltyRedemptionAccount: (details?.expense_account as string) || "",
          loyaltyRedemptionCostCenter: (details?.cost_center as string) || "",
        })
        redemptionFactorRef.current =
          typeof details?.conversion_factor === "number" ? details.conversion_factor : null
      } catch (e) {
        redemptionFactorRef.current = null
        showMessage(messageFromError(e, "Failed to load loyalty program details"))
      }
    },
    [formData.customer, formData.loyaltyProgram, formData.issueDate, companyDefaults, onChange, showMessage],
  )

  const salesTeam = formData.salesTeam ?? [];

  const amountEligibleForCommission = (subtotal ?? 0);

  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  // ERPNext selling_controller.calculate_contribution() parity:
  // allocated_amount = amount_eligible_for_commission * allocated_percentage / 100.
  const computeAllocatedAmount = (percentage?: number) =>
    roundTo2((amountEligibleForCommission * (percentage ?? 0)) / 100);

  // ERPNext sales_common.js calculate_incentive(): incentives =
  // allocated_amount * commission_rate / 100 (only when allocated_amount > 0).
  const computeIncentives = (allocatedAmount: number, commissionRate?: number) =>
    allocatedAmount > 0
      ? roundTo2((allocatedAmount * (commissionRate ?? 0)) / 100)
      : 0;

  // ERPNext calculate_commission(): total_commission =
  // amount_eligible_for_commission * commission_rate / 100.
  const computeTotalCommission = (rate?: number) =>
    roundTo2((amountEligibleForCommission * (rate ?? 0)) / 100);

  const recomputeSalesTeamRow = (row: (typeof salesTeam)[number]) => {
    const allocatedAmount = computeAllocatedAmount(row.allocated_percentage);
    return {
      ...row,
      allocated_amount: allocatedAmount,
      incentives: computeIncentives(allocatedAmount, row.commission_rate),
    };
  };

  // Generic grid change: keeps allocated_amount derived from Contribution (%)
  // but preserves manual Incentives edits — ERPNext only recomputes incentives
  // when a driver cell changes (see handleSalesTeamCellChange).
  const handleSalesTeamChange = (rows: typeof salesTeam) => {
    onChange({
      salesTeam: rows.map((r) => {
        const withId = r.id ? r : { ...r, id: crypto.randomUUID() };
        return {
          ...withId,
          allocated_amount: computeAllocatedAmount(withId.allocated_percentage),
        };
      }),
    });
  };

  // ERPNext allocated_percentage handler (sales_common.js:243-259): changes to
  // Contribution (%) recompute the row's allocated_amount + incentives.
  const handleSalesTeamCellChange = (
    index: number,
    key: keyof NonNullable<InvoiceFormData["salesTeam"]>[number],
    value: unknown,
  ) => {
    if (key !== "allocated_percentage") return;
    const row = salesTeam[index];
    if (!row || !row.id) return;
    onChange({
      salesTeam: salesTeam.map((m) =>
        m.id === row.id
          ? recomputeSalesTeamRow({
              ...row,
              [key]: typeof value === "number" ? value : Number(value) || 0,
            })
          : m,
      ),
    });
  };

  // ERPNext sales_common.js sales_person handler: picking a Sales Person
  // fetches its commission_rate (fetch_from sales_person.commission_rate) and
  // recomputes allocated_amount + incentives via calculate_incentive().
  const handleSalesPersonSelected = async (id: string, value: string) => {
    if (!value) return;
    const res = await invoiceService.getValue("Sales Person", "commission_rate", {
      name: value,
    });
    const commissionRate = Number(res.commission_rate) || 0;
    onChange({
      salesTeam: salesTeam.map((m) =>
        m.id === id
          ? recomputeSalesTeamRow({
              ...m,
              sales_person: value,
              commission_rate: commissionRate,
            })
          : m,
      ),
    });
  };

  // ERPNext fetch_from: sales_partner.commission_rate (sales_invoice.json).
  // Selecting a Sales Partner fetches its commission_rate and total_commission
  // (selling_controller.py / sales_common.js calculate_commission) recomputes.
  const handleSalesPartnerChange = async (value: string) => {
    onChange({ salesPartner: value || undefined });
    if (!value) {
      onChange({ commissionRate: undefined, totalCommission: undefined });
      return;
    }
    const res = await invoiceService.getValue("Sales Partner", "commission_rate", {
      name: value,
    });
    const rate = Number(res.commission_rate) || undefined;
    onChange({
      commissionRate: rate,
      totalCommission: rate != null ? computeTotalCommission(rate) : undefined,
    });
  };

  // ERPNext commission_rate() handler (sales_common.js:224-226): editing the
  // percentage forwards total_commission = amount_eligible * rate / 100.
  const handleCommissionRateChange = (value: number | undefined) => {
    onChange({
      commissionRate: value,
      totalCommission: value != null ? computeTotalCommission(value) : undefined,
    });
  };

  // ERPNext total_commission() handler (sales_common.js:228-241): editing the
  // amount reverse-computes commission_rate = total * 100 / amount_eligible.
  const handleTotalCommissionChange = (value: number | undefined) => {
    onChange({ totalCommission: value });
    if (value != null && amountEligibleForCommission > 0) {
      onChange({
        commissionRate: roundTo2((value * 100) / amountEligibleForCommission),
      });
    } else {
      onChange({ commissionRate: undefined });
    }
  };

  // ERPNext debit_to Link: selecting an account also fetches its currency
  // (useCustomerSelection.ts debit_to get_value chain).
  const handleDebitToChange = async (value: string) => {
    onChange({ debitTo: value || undefined });
    if (!value) {
      onChange({ partyAccountCurrency: undefined });
      return;
    }
    const res = await invoiceService.getValue("Account", "account_currency", {
      name: value,
    });
    const accountCurrency = res.account_currency;
    if (typeof accountCurrency === "string" && accountCurrency) {
      onChange({ partyAccountCurrency: accountCurrency });
    }
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

      <fieldset disabled={isCancelled} className="min-w-0 space-y-4 border-0 p-0 m-0">
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
                <div id="customer-field">
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
                    readOnly={fieldLocked("issueDate") || !formData.setPostingTime}
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
                    readOnly={fieldLocked("postingTime") || !formData.setPostingTime}
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
                    disabled={fieldLocked("setPostingTime")}
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
                    readOnly={fieldLocked("dueDate")}
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
                    onChange={(e) => void handleIsPosChange(e.target.checked)}
                    disabled={fieldLocked("isPos")}
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
                    <LinkSearchField
                      value={formData.posProfile || undefined}
                      onChange={(v) => void handlePosProfileSelect(v)}
                      searchFn={(q) =>
                        invoiceService.searchPosProfiles(q, companyDefaults?.company || formData.company)
                      }
                      placeholder="Search POS profile..."
                      readOnly={fieldLocked("posProfile")}
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
                    disabled={fieldLocked("isReturn")}
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
                      disabled={fieldLocked("updateOutstandingForSelf")}
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
                        disabled={fieldLocked("updateBilledAmountInSalesOrder")}
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
                        disabled={fieldLocked("updateBilledAmountInDeliveryNote")}
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
                    disabled={fieldLocked("isDebitNote")}
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
            <CollapsibleSection
              title="Accounting Dimensions"
              defaultOpen={!!(formData.costCenter || formData.project)}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Cost Center</label>
                  <LinkField
                    doctype="Cost Center"
                    value={formData.costCenter}
                    onChange={(v) => handleSelectChange("costCenter", v ?? "")}
                    searchFn={(q) => invoiceService.searchSalesLink("Cost Center", q)}
                    readOnly={fieldLocked("costCenter")}
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
                    readOnly={fieldLocked("project")}
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
                          disabled={fieldLocked("currency")}
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
                            readOnly={fieldLocked("conversionRate")}
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
                          disabled={fieldLocked("sellingPriceList")}
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
                              readOnly={fieldLocked("plcConversionRate")}
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
                          disabled={fieldLocked("ignorePricingRule")}
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
                    readOnly={fieldLocked("scanBarcode")}
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
                    disabled={fieldLocked("updateStock")}
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
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3">
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
          <div className="space-y-3 pb-4 border-b border-border">
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
                  readOnly={fieldLocked("namedPlace")}
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
            {/* ERPNext "Tax Breakup" lives near the end of the Details tab (see below). */}
          </div>

          {/* Section 6: Totals — always visible (not collapsible, matching ERPNext) */}
          <div className="space-y-3 pb-4 border-b border-border">
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
                          disabled={fieldLocked("disableRoundedTotal")}
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
          <CollapsibleSection
            title="Additional Discount"
            defaultOpen={!!(
              formData.additionalDiscountPercentage != null ||
              formData.discountAmount != null ||
              !!formData.isCashOrNonTradeDiscount
            )}
          >
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
                    disabled={fieldLocked("applyDiscountOn")}
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
                      disabled={fieldLocked("isCashOrNonTradeDiscount")}
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
                      readOnly={fieldLocked("discountAccount")}
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
                    readOnly={fieldLocked("additionalDiscountPercentage")}
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
                    readOnly={fieldLocked("discountAmount")}
                    className={inputClass}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Section 9: Time Sheets — collapsible, in Main body (ERPNext) */}
          <CollapsibleSection
            title="Time Sheet List"
            defaultOpen={(formData.timeSheets?.length ?? 0) > 0}
          >
            {(() => {
              const timeSheetRows = formData.timeSheets ?? [];
              const timeSheetColumns: GridColumn<(typeof timeSheetRows)[number]>[] = [
                {
                  key: "activity_type",
                  label: "Activity Type",
                  type: "link",
                  searchFn: (q) => invoiceService.searchActivityTypes(q),
                  placeholder: "Select activity type…",
                  weight: 1.6,
                },
                {
                  key: "description",
                  label: "Description",
                  type: "text",
                  placeholder: "Description",
                  weight: 2.4,
                },
                {
                  key: "billing_hours",
                  label: "Billing Hours",
                  type: "number",
                  align: "right",
                  weight: 1,
                },
                {
                  key: "billing_amount",
                  label: "Billing Amount",
                  type: "number",
                  align: "right",
                  weight: 1.2,
                },
              ];
              const emptyTimeSheet = {
                id: crypto.randomUUID(),
                activity_type: "",
                description: "",
                billing_hours: 0,
                billing_amount: 0,
              };
              return (
                <ChildTableGrid<(typeof timeSheetRows)[number]>
                  title="Time Sheet List"
                  titleClassName="text-xs font-semibold text-muted"
                  rows={timeSheetRows}
                  columns={timeSheetColumns}
                  emptyRow={emptyTimeSheet}
                  onChange={(rows) => onChange({ timeSheets: rows })}
                  readOnly={isReadOnly}
                  testId="timesheets_grid"
                  minWidth="560px"
                />
              );
            })()}
          </CollapsibleSection>

          {/* ERPNext "Tax Breakup" — last section of the Details tab. Stored
              server HTML when present, otherwise the live computed itemised
              breakdown rendered as a proper table. */}
          <ItemisedTaxBreakup
            rows={breakupRows}
            storedHtml={storedTaxBreakupHtml}
            isReturn={!!formData.isReturn}
          />

        </div>
      )}

      {/* ==================== ADDRESS & CONTACT TAB ==================== */}
      {activeTab === "addressContact" && (
        <div className="space-y-4">
          {/* Section 1: Billing Address — plain (non-collapsible), matches ERPNext */}
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Billing Address</div>
                <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column: Address link + display */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Customer Address</label>
                      <LinkSearchField
                        value={formData.customerAddress ?? ""}
                        onMouseDownCapture={(e) => {
                          if (!formData.customer) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRequireCustomer();
                          }
                        }}
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
                    {formData.addressDisplay && (
                      <div>
                        <label className={labelClass}>Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(formData.addressDisplay)}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Right column: Contact link + display */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <LinkSearchField
                        value={formData.contactPerson ?? ""}
                        onMouseDownCapture={(e) => {
                          if (!formData.customer) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRequireCustomer();
                          }
                        }}
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
                        displayLabel={formData.contactDisplay}
                        readOnly={isReadOnly}
                      />
                    </div>
                    {formData.contactDisplay && (
                      <div>
                        <label className={labelClass}>Contact</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line py-2.5`}>
                          {normalizeDisplayText(formData.contactDisplay)}
                        </div>
                      </div>
                    )}
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
                </div>
                </div>
              </div>

              {/* Section 2: Shipping Address — plain (non-collapsible), matches ERPNext */}
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Shipping Address</div>
                <div className="pb-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Left column: Shipping address */}
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Shipping Address Name</label>
                      <LinkSearchField
                        value={formData.shippingAddressName ?? ""}
                        onMouseDownCapture={(e) => {
                          if (!formData.customer) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRequireCustomer();
                          }
                        }}
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
                    {formData.shippingAddress && (
                      <div>
                        <label className={labelClass}>Shipping Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(formData.shippingAddress)}
                        </div>
                      </div>
                    )}
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
                        readOnly={fieldLocked("dispatchAddressName")}
                      />
                    </div>
                    {formData.dispatchAddress && (
                      <div>
                        <label className={labelClass}>Dispatch Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(formData.dispatchAddress)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                </div>
              </div>

              {/* Section 3: Company Address — plain (non-collapsible), matches ERPNext */}
              <div className="border-b border-border last:border-b-0">
                <div className="py-3 text-base font-bold text-heading">Company Address</div>
                <div className="pb-4 space-y-3">
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
                    {formData.companyAddressDisplay && (
                      <div>
                        <label className={labelClass}>Company Address</label>
                        <div className={`${inputClass} bg-gray-50 whitespace-pre-line min-h-[76px] py-2.5`}>
                          {normalizeDisplayText(formData.companyAddressDisplay)}
                        </div>
                      </div>
                    )}
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
                </div>
              </div>
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

          {/* Paid Amount — ERPNext section_break_84 (after Payments grid, before advances);
              plain section, no collapsible, field top-right; base hidden when
              doc currency == company currency (transaction.js:1564-1569) */}
          {(formData.isPos || formData.redeemLoyaltyPoints) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {formData.currency &&
              companyDefaults?.currency &&
              formData.currency !== companyDefaults.currency ? (
                <div>
                  <label className={labelClass}>
                    Paid Amount ({companyDefaults.currency})
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(formData.basePaidAmount ?? 0)}
                    className={`${inputClass} bg-gray-50`}
                    readOnly
                  />
                </div>
              ) : (
                <div />
              )}
              <div>
                <label className={labelClass}>
                  Paid Amount ({formData.currency ?? "CAD"})
                </label>
                <input
                  type="text"
                  value={formatCurrency(formData.paidAmount ?? 0)}
                  className={`${inputClass} bg-gray-50`}
                  readOnly
                />
              </div>
            </div>
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
                      readOnly={fieldLocked("accountForChangeAmount")}
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
                      disabled={fieldLocked("writeOffOutstandingAmountAutomatically")}
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
                      readOnly={fieldLocked("writeOffAccount")}
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

          {/* Advance Payments */}
          {!formData.isPos && (
              <CollapsibleSection
                title="Advance Payments"
                defaultOpen={!!(
                  !!formData.allocateAdvancesAutomatically ||
                  !!formData.onlyIncludeAllocatedPayments ||
                  (formData.advances?.length ?? 0) > 0
                )}
              >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="allocateAdvancesPayments"
                  checked={!!formData.allocateAdvancesAutomatically}
                  onChange={(e) => handleAllocateAdvancesChange(e.target.checked)}
                  disabled={fieldLocked("allocateAdvancesAutomatically")}
                  className="h-4 w-4 rounded border-border"
                />
                <label htmlFor="allocateAdvancesPayments" className="text-sm text-body">
                  Allocate Advances Automatically (FIFO)
                </label>
              </div>
              {!formData.allocateAdvancesAutomatically && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void handleGetAdvances()}
                    disabled={loadingAdvances}
                    className="px-3 py-2 text-xs font-semibold text-primary-600 border border-primary-200 rounded-[10px] hover:bg-primary-50 transition-colors disabled:opacity-50"
                  >
                    {loadingAdvances ? "Loading…" : "Get Advances Received"}
                  </button>
                </div>
              )}
              {formData.allocateAdvancesAutomatically && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="onlyAllocatedPayments"
                      checked={!!formData.onlyIncludeAllocatedPayments}
                      onChange={(e) => handleOnlyAllocatedPaymentsChange(e.target.checked)}
                      disabled={fieldLocked("onlyIncludeAllocatedPayments")}
                      className="h-4 w-4 rounded border-border"
                    />
                    <label htmlFor="onlyAllocatedPayments" className="text-sm text-body">
                      Only Include Allocated Payments
                    </label>
                  </div>
                  <p className="pl-6 text-xs text-muted">
                    Advance payments allocated against orders will only be fetched
                  </p>
                </div>
              )}
              <div className="mt-3">
                <ChildTableGrid<AdvanceRow>
                  title="Advance Payments"
                  titleClassName="text-xs font-semibold text-muted"
                  rows={formData.advances ?? []}
                  columns={advanceColumns}
                  emptyRow={emptyAdvanceRow}
                  onChange={handleAdvancesGridChange}
                  readOnly={isReadOnly}
                  testId="advances_grid"
                  minWidth="900px"
                />
              </div>
            </CollapsibleSection>
          )}

          {/* Loyalty Points Redemption */}
          <CollapsibleSection
            title="Loyalty Points Redemption"
            defaultOpen={!!formData.redeemLoyaltyPoints}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="redeemLoyaltyPayments"
                checked={!!formData.redeemLoyaltyPoints}
                onChange={(e) => handleRedeemLoyaltyChange(e.target.checked)}
                disabled={fieldLocked("redeemLoyaltyPoints")}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="redeemLoyaltyPayments" className="text-sm text-body">
                Redeem Loyalty Points
              </label>
            </div>
            {formData.redeemLoyaltyPoints && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Loyalty Points</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.loyaltyPoints ?? ""}
                      onChange={(e) =>
                        handleLoyaltyPointsChange(
                          e.target.value ? parseInt(e.target.value) : undefined,
                        )
                      }
                      readOnly={fieldLocked("loyaltyPoints")}
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
                      readOnly={fieldLocked("loyaltyRedemptionAccount")}
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
        </div>
      )}

      {/* ==================== TERMS TAB ==================== */}
      {activeTab === "terms" && (
        <div>
          {!formData.isPos && !formData.isReturn && (
            <div className="border-b border-border">
              <div className="py-3 text-base font-bold text-heading">Payment Terms</div>
              <div className="pb-4 space-y-3">
                <div className="max-w-sm">
                  <label className={labelClass}>Payment Terms Template</label>
                  <LinkField
                    doctype="Payment Terms Template"
                    value={formData.paymentTermsTemplate}
                    onChange={(v) => void handlePaymentTermsTemplateChange(v ?? "")}
                    searchFn={(q) => invoiceService.searchSalesLink("Payment Terms Template", q)}
                    placeholder="Select template…"
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="space-y-1.5">
                  {(() => {
                    const dueDateDefault =
                      formData.dueDate || formData.issueDate || new Date().toISOString().slice(0, 10)
                    const rows = formData.paymentScheduleRows ?? []
                    const columns: GridColumn<(typeof rows)[number]>[] = [
                      {
                        key: "payment_term",
                        label: "Payment Term",
                        type: "link",
                        weight: 1,
                        searchFn: (q) => invoiceService.searchPaymentTerms(q),
                        onSelect: (row, v) => void handlePaymentTermSelect(row.id, v),
                        docType: "Payment Term",
                        placeholder: "Select term…",
                      },
                      {
                        key: "description",
                        label: "Description",
                        type: "text",
                        weight: 1,
                        placeholder: "Description",
                      },
                      {
                        key: "due_date",
                        label: "Due Date",
                        type: "date",
                        weight: 1,
                        formatter: (r) =>
                          r.due_date ? new Date(r.due_date).toLocaleDateString() : "—",
                      },
                      {
                        key: "invoice_portion",
                        label: "Invoice Portion",
                        type: "number",
                        align: "right",
                        weight: 1,
                        formatter: (r) => `${r.invoice_portion ?? 0}%`,
                      },
                      {
                        key: "payment_amount",
                        label: "Payment Amount",
                        type: "number",
                        align: "right",
                        weight: 1,
                        placeholder: "0.00",
                        formatter: (r) => formatCurrency(r.payment_amount ?? 0),
                      },
                    ]
                    return (
                      <ChildTableGrid<(typeof rows)[number]>
                        title="Payment Schedule"
                        titleClassName="text-xs font-semibold text-muted"
                        rows={rows}
                        columns={columns}
                        emptyRow={{
                          id: crypto.randomUUID(),
                          due_date: dueDateDefault,
                          payment_amount: 0,
                        }}
                        onChange={(next) =>
                          onChange({
                            paymentScheduleRows: next.map((r) =>
                              r.id ? r : { ...r, id: crypto.randomUUID() },
                            ),
                          })
                        }
                        readOnly={isReadOnly}
                        testId="payment_schedule_grid"
                        minWidth="720px"
                      />
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          <div className="border-b border-border last:border-b-0">
            <div className="py-3 text-base font-bold text-heading">Terms and Conditions</div>
              <div className="pb-4 space-y-3">
                <div className="max-w-sm">
                  <label className={labelClass}>Terms</label>
                  <LinkField
                    doctype="Terms and Conditions"
                    value={formData.tcName}
                    onChange={(v) => void handleTcNameChange(v ?? "")}
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
                  readOnly={isReadOnly}
                  placeholder="Enter payment terms, conditions, or other notes…"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MORE INFO TAB ==================== */}
      {activeTab === "moreInfo" && (
        <div className="space-y-4">
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
                      readOnly={fieldLocked("poNo")}
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
                      readOnly={fieldLocked("poDate")}
                      className={inputClass}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 2: Accounting Details — 2-column */}
              {/* ERPNext: collapsible section, open while debit_to (reqd) is
                  missing, collapses once filled (layout.js missing-mandatory
                  rule). key remounts so filling debit_to collapses it live. */}
              <CollapsibleSection
                key={formData.debitTo || "no-debit-to"}
                title="Accounting Details"
                defaultOpen={!formData.debitTo}
              >
                <div className="space-y-3">
                  <div>
                    <label className={labelClass}>Debit To</label>
                    <LinkField
                      doctype="Account"
                      value={formData.debitTo ?? ""}
                      onChange={(v) => handleDebitToChange(v ?? "")}
                      searchFn={(q) =>
                        invoiceService.searchSalesLink("Account", q, [
                          ["account_type", "=", "Receivable"],
                          ["is_group", "=", 0],
                          ["company", "=", currentCompany],
                        ])
                      }
                      placeholder="Select account…"
                      readOnly={isReadOnly}
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
                      disabled={fieldLocked("isOpening")}
                    >
                      {isOpeningOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
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
                        onChange={(v) => handleSalesPartnerChange(v ?? "")}
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
                          handleCommissionRateChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          )
                        }
                        className={inputClass}
                        placeholder="0.00"
                        readOnly={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Total Commission</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={formData.totalCommission ?? ""}
                        onChange={(e) =>
                          handleTotalCommissionChange(
                            e.target.value
                              ? parseFloat(e.target.value)
                              : undefined,
                          )
                        }
                        className={inputClass}
                        placeholder="0.00"
                        readOnly={isReadOnly}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 5: Sales Team */}
              <CollapsibleSection
                title="Sales Team"
                defaultOpen={salesTeam.length > 0}
              >
                {(() => {
                  const rowT = (null as unknown) as NonNullable<
                    InvoiceFormData["salesTeam"]
                  >[number];
                  const salesTeamColumns: GridColumn<typeof rowT>[] = [
                    {
                      key: "sales_person",
                      label: "Sales Person",
                      type: "link",
                      weight: 1.4,
                      searchFn: (q) => invoiceService.searchSalesTeamPersons(q),
                      docType: "Sales Person",
                      onSelect: (row, value) =>
                        handleSalesPersonSelected(row.id, value),
                      placeholder: "Select Sales Person",
                    },
                    {
                      key: "allocated_percentage",
                      label: "Contribution (%)",
                      type: "number",
                      align: "right",
                      placeholder: "0.00",
                    },
                    {
                      key: "allocated_amount",
                      label: "Contribution to Net Total",
                      type: "readonly",
                      align: "right",
                      formatter: (r) => formatCurrency(r.allocated_amount ?? 0),
                    },
                    {
                      key: "commission_rate",
                      label: "Commission Rate",
                      type: "readonly",
                      align: "right",
                      formatter: (r) =>
                        r.commission_rate != null && r.commission_rate !== 0
                          ? `${r.commission_rate}%`
                          : "—",
                    },
                    {
                      key: "incentives",
                      label: "Incentives",
                      type: "number",
                      align: "right",
                      placeholder: "0.00",
                    },
                  ];
                  return (
                    <ChildTableGrid
                      title="Sales Contributions and Incentives"
                      rows={salesTeam}
                      columns={salesTeamColumns}
                      emptyRow={{
                        id: crypto.randomUUID(),
                        sales_person: "",
                        contact_no: "",
                        allocated_percentage: 0,
                        allocated_amount: 0,
                        commission_rate: 0,
                        incentives: 0,
                      }}
                      onChange={handleSalesTeamChange}
                      onCellChange={handleSalesTeamCellChange}
                      readOnly={fieldLocked("salesTeam")}
                      minWidth="720px"
                      testId="sales_team_grid"
                    />
                  );
                })()}
              </CollapsibleSection>

              {/* Section 6: Print Settings */}
              <CollapsibleSection
                title="Print Settings"
                defaultOpen={!!(
                  formData.letterHead ||
                  formData.selectPrintHeading ||
                  formData.language ||
                  !!formData.groupSameItems
                )}
              >
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
                        readOnly={fieldLocked("letterHead")}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="groupSameItemsMoreInfo"
                        checked={!!formData.groupSameItems}
                        onChange={(e) => onChange({ groupSameItems: e.target.checked })}
                        disabled={fieldLocked("groupSameItems")}
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
                        readOnly={fieldLocked("selectPrintHeading")}
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
                        className={`${inputClass} bg-gray-50`}
                        readOnly
                        placeholder="en"
                      />
                    </div>
</div>
              </div>
              </CollapsibleSection>

{/* Section 7: Subscription — 2-column */}
              <CollapsibleSection
                title="Subscription"
                defaultOpen={!!(formData.subscription || formData.fromDate || formData.toDate)}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className={labelClass}>Subscription</label>
                      <LinkField
                        doctype="Subscription"
                        value={formData.subscription ?? ""}
                        onChange={(v) => onChange({ subscription: v ?? undefined })}
                        searchFn={(q) =>
                          invoiceService.searchSalesLink("Subscription", q)
                        }
                        placeholder="Select subscription…"
                        readOnly={isReadOnly}
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
                        readOnly={fieldLocked("fromDate")}
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
readOnly={fieldLocked("toDate")}
                          className={inputClass}
                        />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 8: Additional Info — 2-column, depends_on customer (ERPNext) */}
              {formData.customer && (
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
                        readOnly={fieldLocked("remarks")}
                        rows={2}
                        className={inputClass}
                        placeholder="Invoice remarks…"
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
              )}
            </>
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
