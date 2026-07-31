"use client";

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button, Skeleton } from "@/components/ui";
import { getCompanyDefaults } from "@/services/company";
import {
  invoiceService,
  customerService,
  productService,
  type Customer,
  type Product,
  type TaxTemplateResult,
  type EditableTaxRow,
  type AccountInfo,
  templateRowsToEditable,
  computeTaxes,
} from "@/services";
import InvoiceForm, { type InvoiceFormData, type InvoiceFieldErrors } from "../components/InvoiceForm";
import InvoiceLineItems, {
  type LineItemForm,
} from "../components/InvoiceLineItems";
import InvoiceTotals from "../components/InvoiceTotals";
import {
  validateInvoice,
  getErrorMessages,
} from "../validation";

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100;
}

function createEmptyLine(defaults?: {
  incomeAccount?: string;
  costCenter?: string;
}): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    sku: "",
    quantity: 1,
    price: 0,
    total: 0,
    uom: "Nos",
    warehouse: "",
    discountPercentage: undefined,
    marginType: undefined,
    marginRateOrAmount: undefined,
    incomeAccount: defaults?.incomeAccount || "",
    costCenter: defaults?.costCenter || "",
  };
}

function toFormData(d: Partial<InvoiceFormData>): InvoiceFormData {
  return {
    customer: d.customer ?? "",
    customerName: d.customerName ?? "",
    company: d.company,
    companyTaxId: d.companyTaxId,
    taxId: d.taxId,
    namingSeries: d.namingSeries,
    issueDate: d.issueDate ?? new Date().toISOString().slice(0, 10),
    dueDate:
      d.dueDate ??
      (() => {
        const dt = new Date();
        dt.setDate(dt.getDate() + 30);
        return dt.toISOString().slice(0, 10);
      })(),
    setPostingTime: d.setPostingTime,
    postingTime: d.postingTime ?? (() => {
      const now = new Date();
      return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    })(),
    updateStock: d.updateStock,
    setWarehouse: d.setWarehouse,
    setTargetWarehouse: d.setTargetWarehouse,
    customerAddress: d.customerAddress,
    addressDisplay: d.addressDisplay,
    shippingAddressName: d.shippingAddressName,
    shippingAddress: d.shippingAddress,
    contactPerson: d.contactPerson,
    contactDisplay: d.contactDisplay,
    contactEmail: d.contactEmail,
    contactMobile: d.contactMobile,
    dispatchAddressName: d.dispatchAddressName,
    dispatchAddress: d.dispatchAddress,
    companyAddress: d.companyAddress,
    companyAddressDisplay: d.companyAddressDisplay,
    companyContactPerson: d.companyContactPerson,
    poNo: d.poNo,
    poDate: d.poDate,
    paymentTermsTemplate: d.paymentTermsTemplate,
    ignoreDefaultPaymentTerms: d.ignoreDefaultPaymentTerms,
    currency: d.currency,
    conversionRate: d.conversionRate,
    sellingPriceList: d.sellingPriceList,
    priceListCurrency: d.priceListCurrency,
    plcConversionRate: d.plcConversionRate,
    ignorePricingRule: d.ignorePricingRule,
    applyDiscountOn: d.applyDiscountOn ?? "Grand Total",
    discountAmount: d.discountAmount,
    additionalDiscountPercentage: d.additionalDiscountPercentage,
    couponCode: d.couponCode,
    isCashOrNonTradeDiscount: d.isCashOrNonTradeDiscount,
    discountAccount: d.discountAccount,
    writeOffAmount: d.writeOffAmount,
    writeOffAccount: d.writeOffAccount,
    writeOffCostCenter: d.writeOffCostCenter,
    writeOffOutstandingAmountAutomatically:
      d.writeOffOutstandingAmountAutomatically,
    disableRoundedTotal: d.disableRoundedTotal,
    useCompanyDefaultCostCenterForRoundOff:
      d.useCompanyDefaultCostCenterForRoundOff,
    costCenter: d.costCenter,
    project: d.project,
    taxCategory: d.taxCategory,
    shippingRule: d.shippingRule,
    incoterm: d.incoterm,
    namedPlace: d.namedPlace,
    // applyTds removed — not a Sales Invoice field
    // Sales Team
    salesPartner: d.salesPartner,
    commissionRate: d.commissionRate,
    salesTeam: d.salesTeam,
    // Loyalty
    redeemLoyaltyPoints: d.redeemLoyaltyPoints,
    loyaltyProgram: d.loyaltyProgram,
    loyaltyPoints: d.loyaltyPoints,
    loyaltyAmount: d.loyaltyAmount,
    loyaltyRedemptionAccount: d.loyaltyRedemptionAccount,
    loyaltyRedemptionCostCenter: d.loyaltyRedemptionCostCenter,
    // Print
    letterHead: d.letterHead,
    groupSameItems: d.groupSameItems,
    selectPrintHeading: d.selectPrintHeading,
    language: d.language,
    // Terms
    tcName: d.tcName,
    terms: d.terms,
    // Returns
    isReturn: d.isReturn,
    returnAgainst: d.returnAgainst,
    isDebitNote: d.isDebitNote,
    updateBilledAmountInSalesOrder: d.updateBilledAmountInSalesOrder,
    updateBilledAmountInDeliveryNote: d.updateBilledAmountInDeliveryNote,
    updateOutstandingForSelf: d.updateOutstandingForSelf,
    // Advances
    advances: d.advances,
    allocateAdvancesAutomatically: d.allocateAdvancesAutomatically,
    onlyIncludeAllocatedPayments: d.onlyIncludeAllocatedPayments,
    // POS
    isPos: d.isPos,
    posProfile: d.posProfile,
    accountForChangeAmount: d.accountForChangeAmount,
    cashBankAccount: d.cashBankAccount,
    payments: d.payments,
    // Tax Withholding
    overrideTaxWithholdingEntries: d.overrideTaxWithholdingEntries,
    taxWithholdingEntries: d.taxWithholdingEntries,
    // Subscription
    subscription: d.subscription,
    fromDate: d.fromDate,
    toDate: d.toDate,
    autoRepeat: d.autoRepeat,
    debitTo: d.debitTo,
    isOpening: d.isOpening,
    remarks: d.remarks,
    // Additional Info
    title: d.title,
    status: d.status,
    isInternalCustomer: d.isInternalCustomer,
    representsCompany: d.representsCompany,
    interCompanyInvoiceReference: d.interCompanyInvoiceReference,
    isDiscounted: d.isDiscounted,
    // fetch_from fields (party)
    customerGroup: d.customerGroup,
    taxesAndCharges: d.taxesAndCharges,
    // UTM Analytics
    utmSource: d.utmSource,
    utmMedium: d.utmMedium,
    utmCampaign: d.utmCampaign,
    utmContent: d.utmContent,
  };
}

export default function CreateInvoice() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState<InvoiceFormData>(toFormData({}));
  const [lineItems, setLineItems] = useState<LineItemForm[]>([
    createEmptyLine(),
  ]);

  // Refs to always read latest state in async handlers (avoids stale closures)
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productDropdowns, setProductDropdowns] = useState<
    Record<string, { open: boolean; search: string }>
  >({});
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [costCenters, setCostCenters] = useState<string[]>([]);
  const [itemTaxTemplates, setItemTaxTemplates] = useState<string[]>([]);
  const [taxesAndChargesTemplates, setTaxesAndChargesTemplates] = useState<
    string[]
  >([]);
  const [taxTemplate, setTaxTemplate] = useState<TaxTemplateResult | null>(null);
  const [companyDefaults, setCompanyDefaults] = useState<{
    company: string;
    currency: string;
    defaultSellingPriceList: string;
    defaultReceivableAccount: string;
    defaultIncomeAccount: string;
    defaultCostCenter: string;
    companyTaxId: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadingPartyDetails, setLoadingPartyDetails] = useState(false);
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [plcConversionRate, setPlcConversionRate] = useState<number>(1);
  const [editableTaxRows, setEditableTaxRows] = useState<EditableTaxRow[]>([]);

  // Fallback template name if template hasn't loaded yet
  const FALLBACK_TEMPLATE_NAME = "Canada GST/QST - BE";

  const defaultTaxTemplate = taxTemplate?.name ?? FALLBACK_TEMPLATE_NAME;

  useEffect(() => {
    Promise.all([
      customerService.list({ pageSize: 100 }),
      productService.list({ pageSize: 100 }),
      invoiceService.getDefaultTaxTemplate(),
      invoiceService.lookups.warehouses(),
      invoiceService.lookups.taxAccounts(),
      invoiceService.lookups.costCenters(),
      invoiceService.lookups.itemTaxTemplates(),
      invoiceService.lookups.taxesAndChargesTemplates(),
      getCompanyDefaults(),
    ])
      .then(([custRes, prodRes, tmpl, wh, ac, cst, itt, tac, defaults]) => {
        setCustomers(custRes.items);
        setProducts(prodRes.items);
        setTaxTemplate(tmpl);
        setEditableTaxRows(templateRowsToEditable(tmpl?.rows ?? []));
        setWarehouses(wh);
        setAccounts(ac);
        setCostCenters(cst);
        setItemTaxTemplates(itt);
        setTaxesAndChargesTemplates(tac);
        setCompanyDefaults(defaults);
        setFormData((prev) => ({
          ...prev,
          company: defaults.company,
          companyTaxId: defaults.companyTaxId || prev.companyTaxId,
        }));
        setLineItems((prev) =>
          prev.map((line, i) =>
            i === 0 && !line.incomeAccount && !line.costCenter
              ? {
                  ...line,
                  incomeAccount: defaults.defaultIncomeAccount || "",
                  costCenter: defaults.defaultCostCenter || "",
                }
              : line,
          ),
        );
      })
      .catch(() => {
        setError("Failed to load data");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Conditional cascade: when set_warehouse changes, apply to lines that have no warehouse set
  const prevSetWarehouse = useRef(formData.setWarehouse);
  useEffect(() => {
    if (
      formData.setWarehouse &&
      formData.setWarehouse !== prevSetWarehouse.current
    ) {
      setLineItems((prev) =>
        prev.map((line) =>
          !line.warehouse
            ? { ...line, warehouse: formData.setWarehouse! }
            : line,
        ),
      );
    }
    prevSetWarehouse.current = formData.setWarehouse;
  }, [formData.setWarehouse]);

  const handleTaxTemplateChange = async (templateName: string) => {
    if (!templateName) return;
    try {
      const result = await invoiceService.getTaxTemplateDetails(templateName);
      if (result) {
        setTaxTemplate(result);
        setEditableTaxRows(templateRowsToEditable(result.rows));
      }
    } catch {
      // keep existing rates on failure
    }
  };

  const handleSelectCustomer = async (customer: Customer) => {
    setFormData((prev) => ({
      ...prev,
      customer: customer.name,
      customerName: customer.customer_name,
      customerAddress: customer.customer_primary_address || undefined,
      shippingAddressName: customer.customer_primary_address || undefined,
      contactPerson: customer.customer_primary_contact || undefined,
      // fetch_from: customer.* auto-link fields
      taxId: customer.tax_id || undefined,
      language: customer.language || undefined,
      loyaltyProgram: customer.loyalty_program || undefined,
      isInternalCustomer: !!customer.is_internal_customer,
      representsCompany: customer.represents_company || undefined,
    }));
    if (!companyDefaults) return;
    setLoadingPartyDetails(true);
    try {
      const details = await invoiceService.getPartyDetails(
        customer.name,
        companyDefaults.company,
        formData.issueDate,
      );
      setFormData((prev) => ({
        ...prev,
        paymentTermsTemplate:
          details.payment_terms_template || prev.paymentTermsTemplate,
        customerAddress: details.customer_address || prev.customerAddress,
        addressDisplay: details.address_display || prev.addressDisplay,
        shippingAddressName:
          details.shipping_address_name || prev.shippingAddressName,
        shippingAddress: details.shipping_address || prev.shippingAddress,
        contactPerson: details.contact_person || prev.contactPerson,
        contactDisplay: details.contact_display || prev.contactDisplay,
        contactEmail: details.contact_email || prev.contactEmail,
        contactMobile: details.contact_mobile || prev.contactMobile,
        debitTo: details.debit_to || prev.debitTo,
        currency: details.currency || prev.currency,
        sellingPriceList: details.selling_price_list || prev.sellingPriceList,
        priceListCurrency:
          details.price_list_currency || prev.priceListCurrency,
        dueDate: details.due_date || prev.dueDate,
        // fetch_from: customer.* fields from party details API
        taxId: details.tax_id || prev.taxId,
        language: details.language || prev.language,
        territory: details.territory || prev.territory,
        customerGroup: details.customer_group || prev.customerGroup,
        taxCategory: details.tax_category || prev.taxCategory,
        taxesAndCharges: details.taxes_and_charges || prev.taxesAndCharges,
        // Company address from party details
        companyAddress: details.company_address || prev.companyAddress,
        companyAddressDisplay: details.company_address_display || prev.companyAddressDisplay,
      }));

      // Fetch exchange rates when currencies differ from company currency
      const partyCurrency = details.currency;
      const priceListCurrency = details.price_list_currency;
      const companyCurrency = companyDefaults.currency;
      const postingDate =
        formData.issueDate || new Date().toISOString().slice(0, 10);

      if (partyCurrency && partyCurrency !== companyCurrency) {
        const rate = await invoiceService.getExchangeRate(
          partyCurrency,
          companyCurrency,
          postingDate,
        );
        // TODO: handle rate === 0 (no Currency Exchange record, external API returned nothing).
        // Do NOT silently fall back to 1 — that would cause incorrect amounts.
        // Decided behavior TBD after checking what ERPNext Desk does in this case.
        setConversionRate(rate);
        setFormData((prev) => ({ ...prev, conversionRate: rate }));
      } else {
        setConversionRate(1);
        setFormData((prev) => ({ ...prev, conversionRate: 1 }));
      }

      if (priceListCurrency && priceListCurrency !== companyCurrency) {
        const plcRate = await invoiceService.getExchangeRate(
          priceListCurrency,
          companyCurrency,
          postingDate,
        );
        // TODO: same 0.0 handling needed — see above
        setPlcConversionRate(plcRate);
        setFormData((prev) => ({ ...prev, plcConversionRate: plcRate }));
      } else {
        setPlcConversionRate(1);
        setFormData((prev) => ({ ...prev, plcConversionRate: 1 }));
      }
    } catch {
      // fallback: keep basic fields set above, don't block the form
    } finally {
      setLoadingPartyDetails(false);
    }
  };

  // Recalculate due date when payment terms template or posting date changes (only if customer is set)
  const prevPaymentTemplate = useRef(formData.paymentTermsTemplate);
  const prevIssueDate = useRef(formData.issueDate);
  useEffect(() => {
    if (!formData.customer || !companyDefaults) return;
    const templateChanged =
      formData.paymentTermsTemplate !== prevPaymentTemplate.current;
    const dateChanged = formData.issueDate !== prevIssueDate.current;
    if (!templateChanged && !dateChanged) {
      prevPaymentTemplate.current = formData.paymentTermsTemplate;
      prevIssueDate.current = formData.issueDate;
      return;
    }
    prevPaymentTemplate.current = formData.paymentTermsTemplate;
    prevIssueDate.current = formData.issueDate;
    invoiceService
      .getDueDate(
        formData.issueDate,
        formData.customer,
        companyDefaults.company,
        formData.paymentTermsTemplate,
      )
      .then((d) => {
        if (d) setFormData((prev) => ({ ...prev, dueDate: d }));
      })
      .catch(() => {});
  }, [
    formData.paymentTermsTemplate,
    formData.issueDate,
    formData.customer,
    companyDefaults,
  ]);

  const addLine = () =>
    setLineItems((prev) => [
      ...prev,
      createEmptyLine({
        incomeAccount: companyDefaults?.defaultIncomeAccount,
        costCenter: companyDefaults?.defaultCostCenter,
      }),
    ]);

  const addItemWithQty = (product: Product, qty: number) => {
    setLineItems((prev) => {
      const existing = prev.find((l) => l.productId === product.item_code);
      if (existing) {
        const newQty = existing.quantity + qty;
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: newQty, total: calcTotal(newQty, l.price) }
            : l
        );
      }
      const newRow = {
        ...createEmptyLine({
          incomeAccount: companyDefaults?.defaultIncomeAccount,
          costCenter: companyDefaults?.defaultCostCenter,
        }),
        productId: product.item_code,
        productName: product.item_name,
        description: product.description || undefined,
        sku: product.item_code,
        price: product.standard_rate,
        uom: product.stock_uom || "Nos",
        warehouse: product.default_warehouse || "",
        incomeAccount: product.income_account || companyDefaults?.defaultIncomeAccount || "",
        costCenter: product.cost_center || companyDefaults?.defaultCostCenter || "",
        quantity: qty,
        total: calcTotal(qty, product.standard_rate),
      };
      if (prev.length === 1 && !prev[0].productId && prev[0].quantity === 1 && prev[0].price === 0) {
        return [newRow];
      }
      return [...prev, newRow];
    });
  };

  const removeLine = (id: string) =>
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((l) => l.id !== id) : prev,
    );

  const handleAddItems = (fetchedItems: Array<Record<string, unknown>>) => {
    if (!fetchedItems.length) return
    setLineItems((prev) => {
      const newItems = fetchedItems.map((item) => ({
        id: crypto.randomUUID(),
        productId: (item.item_code as string) || (item.item_code as string),
        productName: (item.item_name as string) || "",
        description: (item.description as string) || undefined,
        sku: item.item_code as string,
        quantity: Number(item.qty ?? item.stock_qty ?? 1),
        price: Number(item.rate ?? 0),
        total: Number(item.amount ?? 0),
        uom: (item.uom as string) || (item.stock_uom as string) || "Nos",
        warehouse: (item.warehouse as string) || (item.t_warehouse as string) || "",
        discountPercentage: item.discount_percentage ? Number(item.discount_percentage) : undefined,
        discountAmount: item.discount_amount ? Number(item.discount_amount) : undefined,
        marginType: item.margin_type as "Percentage" | "Amount" | undefined,
        marginRateOrAmount: item.margin_rate_or_amount ? Number(item.margin_rate_or_amount) : undefined,
        itemTaxTemplate: (item.item_tax_template as string) || undefined,
        batchNo: (item.batch_no as string) || undefined,
        serialNo: (item.serial_no as string) || undefined,
        enableDeferredRevenue: item.enable_deferred_revenue === 1 || item.enable_deferred_revenue === true,
        serviceStartDate: (item.service_start_date as string) || undefined,
        serviceEndDate: (item.service_end_date as string) || undefined,
        weightPerUnit: item.weight_per_unit ? Number(item.weight_per_unit) : undefined,
        totalWeight: item.total_weight ? Number(item.total_weight) : undefined,
        incomeAccount: (item.income_account as string) || companyDefaults?.defaultIncomeAccount || "",
        costCenter: (item.cost_center as string) || companyDefaults?.defaultCostCenter || "",
        stockUom: (item.stock_uom as string) || undefined,
        conversionFactor: item.conversion_factor ? Number(item.conversion_factor) : undefined,
        priceListRate: item.price_list_rate ? Number(item.price_list_rate) : undefined,
        netRate: item.net_rate ? Number(item.net_rate) : undefined,
        netAmount: item.net_amount ? Number(item.net_amount) : undefined,
        baseRate: item.base_rate ? Number(item.base_rate) : undefined,
        baseAmount: item.base_amount ? Number(item.base_amount) : undefined,
      }))
      if (prev.length === 1 && !prev[0].productId && prev[0].quantity === 1 && prev[0].price === 0) {
        return newItems
      }
      return [...prev, ...newItems]
    })
  }

  const updateLine = (id: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...updates };
        next.total = calcTotal(next.quantity, next.price);
        return next;
      }),
    );

  const selectProduct = async (lineId: string, product: Product) => {
    let incomeAccount = product.income_account || companyDefaults?.defaultIncomeAccount || "";
    let costCenter = product.cost_center || companyDefaults?.defaultCostCenter || "";
    let itemDetails: Record<string, unknown> | null = null;
    try {
      itemDetails = await invoiceService.getItemDetails(product.item_code, {
        currency: formData.currency || companyDefaults?.currency,
        conversion_rate: formData.conversionRate ?? conversionRate,
        selling_price_list: formData.sellingPriceList || companyDefaults?.defaultSellingPriceList,
        price_list_currency: formData.priceListCurrency || companyDefaults?.currency,
        plc_conversion_rate: formData.plcConversionRate ?? plcConversionRate,
        customer: formData.customer,
        is_pos: formData.isPos ? 1 : 0,
        is_return: formData.isReturn ? 1 : 0,
      });
      if (itemDetails) {
        incomeAccount = (itemDetails.income_account as string) || incomeAccount;
        costCenter = (itemDetails.cost_center as string) || costCenter;
      }
    } catch {
      // fall back to product/company defaults
    }
    const rate = (itemDetails?.price_list_rate as number) || product.standard_rate;
    updateLine(lineId, {
      productId: product.item_code,
      productName: product.item_name,
      description: product.description || undefined,
      sku: product.item_code,
      price: rate,
      uom: (itemDetails?.uom as string) || product.stock_uom || "Nos",
      warehouse: (itemDetails?.warehouse as string) || product.default_warehouse || "",
      incomeAccount,
      costCenter,
      discountPercentage: undefined,
      discountAmount: undefined,
      marginType: undefined,
      marginRateOrAmount: undefined,
    });
    setProductDropdowns((prev) => ({
      ...prev,
      [lineId]: { open: false, search: "" },
    }));
  };

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0);
  const totalQuantity = lineItems.reduce((sum, l) => sum + l.quantity, 0);

  // Compute taxes from editable rows
  const taxRows = computeTaxes(editableTaxRows, subtotal, totalQuantity);
  const totalTaxesAndCharges = taxRows.reduce((sum, r) => sum + r.tax_amount, 0);

  // Compute additional discount
  let additionalDiscount = 0;
  if (formData.discountAmount && formData.discountAmount > 0) {
    additionalDiscount = formData.discountAmount;
  } else if (
    formData.additionalDiscountPercentage &&
    formData.additionalDiscountPercentage > 0
  ) {
    const base =
      formData.applyDiscountOn === "Net Total"
        ? subtotal
        : subtotal + totalTaxesAndCharges;
    additionalDiscount =
      Math.round(base * (formData.additionalDiscountPercentage / 100) * 100) /
      100;
  }

  const grandTotal =
    Math.round((subtotal + totalTaxesAndCharges - additionalDiscount) * 100) /
    100;

  // ERPNext-style rounding: round to nearest 0.01 (smallest currency fraction for CAD)
  const roundedTotal = Math.round(grandTotal * 100) / 100;
  const roundingAdjustment = roundedTotal - grandTotal;

  // Tax lines for InvoiceTotals display
  const taxLinesForDisplay = taxRows.map((r) => ({
    label: r.description || r.account_head,
    amount: r.tax_amount,
  }));

  const buildPayload = () => {
    const fd = formDataRef.current;
    const li = lineItemsRef.current;
    return {
    customer: fd.customer,
    company: fd.company || companyDefaults?.company || "",
    posting_date: fd.issueDate,
    posting_time: fd.postingTime || undefined,
    set_posting_time: 1,
    due_date: fd.dueDate,
    currency: fd.currency || companyDefaults?.currency || "",
    conversion_rate: fd.conversionRate ?? conversionRate,
    selling_price_list:
      fd.sellingPriceList ||
      companyDefaults?.defaultSellingPriceList ||
      "",
    price_list_currency:
      fd.priceListCurrency || companyDefaults?.currency || "",
    plc_conversion_rate: fd.plcConversionRate ?? plcConversionRate,
    ignore_pricing_rule: fd.ignorePricingRule,
    update_stock: fd.updateStock,
    set_warehouse: fd.setWarehouse || undefined,
    set_target_warehouse: fd.setTargetWarehouse || undefined,
    debit_to: fd.debitTo || companyDefaults?.defaultReceivableAccount || "",
    cost_center: fd.costCenter || undefined,
    project: fd.project || undefined,
    taxes_and_charges: taxTemplate?.name || defaultTaxTemplate,
    taxes: taxRows.map((r) => ({
      charge_type: r.charge_type,
      account_head: r.account_head,
      rate: r.rate,
      description: r.description,
      included_in_print_rate: r.included_in_print_rate,
    })),
    customer_address: fd.customerAddress || undefined,
    shipping_address_name: fd.shippingAddressName || undefined,
    contact_person: fd.contactPerson || undefined,
    po_no: fd.poNo || undefined,
    po_date: fd.poDate || undefined,
    payment_terms_template: fd.paymentTermsTemplate || null,
    apply_discount_on: fd.applyDiscountOn || undefined,
    discount_amount: fd.discountAmount,
    additional_discount_percentage: fd.additionalDiscountPercentage,
    coupon_code: fd.couponCode || undefined,
    is_cash_or_non_trade_discount: fd.isCashOrNonTradeDiscount,
    additional_discount_account: fd.discountAccount || undefined,
    write_off_amount: fd.writeOffAmount,
    write_off_account: fd.writeOffAccount || undefined,
    write_off_cost_center: fd.writeOffCostCenter || undefined,
    write_off_outstanding_amount_automatically:
      fd.writeOffOutstandingAmountAutomatically,
    tax_category: fd.taxCategory || undefined,
    shipping_rule: fd.shippingRule || undefined,
    incoterm: fd.incoterm || undefined,
    named_place: fd.namedPlace || undefined,
    // apply_tds removed — not a Sales Invoice field
    disable_rounded_total: fd.disableRoundedTotal,
    use_company_roundoff_cost_center:
      fd.useCompanyDefaultCostCenterForRoundOff,
    // Sales Team
    sales_partner: fd.salesPartner || undefined,
    commission_rate: fd.commissionRate,
    sales_team: fd.salesTeam?.map((m) => ({
      sales_person: m.sales_person,
      allocated_percentage: m.allocated_percentage,
      commission_rate: m.commission_rate,
      incentives: m.incentives,
    })),
    // Loyalty
    redeem_loyalty_points: fd.redeemLoyaltyPoints,
    loyalty_program: fd.loyaltyProgram || undefined,
    loyalty_points: fd.loyaltyPoints,
    loyalty_amount: fd.loyaltyAmount,
    loyalty_redemption_account: fd.loyaltyRedemptionAccount || undefined,
    loyalty_redemption_cost_center: fd.loyaltyRedemptionCostCenter || undefined,
    // Print
    letter_head: fd.letterHead || undefined,
    group_same_items: fd.groupSameItems,
    select_print_heading: fd.selectPrintHeading || undefined,
    language: fd.language || undefined,
    // Terms
    tc_name: fd.tcName || undefined,
    terms: fd.terms || undefined,
    // Returns
    is_return: fd.isReturn ? 1 : 0,
    return_against: fd.returnAgainst || undefined,
    is_debit_note: fd.isDebitNote ? 1 : 0,
    update_billed_amount_in_sales_order:
      fd.updateBilledAmountInSalesOrder,
    update_billed_amount_in_delivery_note:
      fd.updateBilledAmountInDeliveryNote,
    update_outstanding_for_self: fd.updateOutstandingForSelf,
    // Advances
    allocate_advances_automatically: fd.allocateAdvancesAutomatically,
    only_include_allocated_payments: fd.onlyIncludeAllocatedPayments,
    advances: fd.advances?.map((a) => ({
      reference_type: a.reference_type,
      reference_name: a.reference_name,
      advance_amount: a.advance_amount,
      allocated_amount: a.allocated_amount,
    })),
    // POS
    is_pos: fd.isPos ? 1 : 0,
    pos_profile: fd.posProfile || undefined,
    account_for_change_amount: fd.accountForChangeAmount || undefined,
    cash_bank_account: fd.cashBankAccount || undefined,
    payments: fd.payments?.map((p) => ({
      mode_of_payment: p.mode_of_payment,
      amount: p.amount,
      account: p.account || undefined,
    })),
    // Tax Withholding
    override_tax_withholding_entries: fd.overrideTaxWithholdingEntries,
    // Subscription
    subscription: fd.subscription || undefined,
    from_date: fd.fromDate || undefined,
    to_date: fd.toDate || undefined,
    auto_repeat: fd.autoRepeat || undefined,
    remarks: fd.remarks || undefined,
    // Address & Contact
    dispatch_address_name: fd.dispatchAddressName || undefined,
    company_address: fd.companyAddress || undefined,
    company_contact_person: fd.companyContactPerson || undefined,
    territory: fd.territory || undefined,
    // Accounting Details
    unrealized_profit_loss_account:
      fd.unrealizedProfitLossAccount || undefined,
    against_income_account: fd.againstIncomeAccount || undefined,
    // Additional Info
    title: fd.title || undefined,
    tax_id: fd.taxId || undefined,
    company_tax_id: fd.companyTaxId || undefined,
    is_internal_customer: fd.isInternalCustomer ? 1 : 0,
    represents_company: fd.representsCompany || undefined,
    inter_company_invoice_reference:
      fd.interCompanyInvoiceReference || undefined,
    is_discounted: fd.isDiscounted ? 1 : 0,
    campaign: fd.campaign || undefined,
    source: fd.source || undefined,
    // UTM Analytics
    utm_source: fd.utmSource || undefined,
    utm_medium: fd.utmMedium || undefined,
    utm_campaign: fd.utmCampaign || undefined,
    utm_content: fd.utmContent || undefined,
    // Time Sheets
    timesheets: fd.timeSheets?.map((ts) => ({
      activity_type: ts.activity_type,
      description: ts.description || undefined,
      billing_hours: ts.billing_hours,
      billing_amount: ts.billing_amount,
    })),
    items: li.map((item) => {
      const amt = item.quantity * item.price;
      const rate = fd.conversionRate ?? conversionRate ?? 1;
      return {
        item_code: item.sku || item.productName,
        item_name: item.productName,
        description: item.description || undefined,
        qty: item.quantity,
        uom: item.uom,
        conversion_factor: item.conversionFactor ?? 1,
        rate: item.price,
        amount: amt,
        base_rate: item.price * rate,
        base_amount: amt * rate,
        warehouse: item.warehouse || undefined,
        discount_percentage: item.discountPercentage ?? 0,
        discount_amount: item.discountAmount ?? 0,
        margin_type: item.marginType || undefined,
        margin_rate_or_amount: item.marginRateOrAmount ?? 0,
        item_tax_template: item.itemTaxTemplate || undefined,
        batch_no: item.batchNo || undefined,
        serial_no: item.serialNo || undefined,
        enable_deferred_revenue: item.enableDeferredRevenue ?? false,
        service_start_date: item.serviceStartDate || undefined,
        service_end_date: item.serviceEndDate || undefined,
        grant_commission: item.grantCommission !== false,
        page_break: item.pageBreak ?? false,
        income_account:
          item.incomeAccount ||
          companyDefaults?.defaultIncomeAccount ||
          undefined,
        cost_center:
          item.costCenter || companyDefaults?.defaultCostCenter || undefined,
      };
    }),
    payment_schedule: fd.paymentScheduleRows?.map((ps) => ({
      due_date: ps.due_date || fd.dueDate,
      payment_amount: ps.payment_amount,
    })),
  };
  }

  const handleSaveDraft = async () => {
    const errors = validateInvoice(formData, lineItems, companyDefaults);
    setFieldErrors(errors);
    const msgs = getErrorMessages(errors);
    if (msgs.length > 0) {
      setErrorMessages(msgs);
      return;
    }
    setSaving(true);
    setError("");
    setErrorMessages([]);
    setFieldErrors({});
    try {
      const created = await invoiceService.create(buildPayload());
      navigate(`/invoices/${created.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndSubmit = async () => {
    const errors = validateInvoice(formData, lineItems, companyDefaults);
    setFieldErrors(errors);
    const msgs = getErrorMessages(errors);
    if (msgs.length > 0) {
      setErrorMessages(msgs);
      return;
    }
    setSaving(true);
    setError("");
    setErrorMessages([]);
    setFieldErrors({});
    try {
      const created = await invoiceService.create(buildPayload());
      await invoiceService.submit(created.name);
      navigate(`/invoices/${created.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/invoices")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">New Invoice</h1>
              <p className="text-sm text-muted mt-0.5">
                Create a new sales invoice.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/invoices")}>
              Cancel
            </Button>
            {loadingPartyDetails && (
              <span className="text-xs text-muted animate-pulse">Loading party details...</span>
            )}
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || loadingPartyDetails}
              loading={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handleSaveAndSubmit}
              disabled={saving || loadingPartyDetails}
              loading={saving}
            >
              <CheckCircle2 size={16} />
              {saving ? "Saving..." : "Save & Submit"}
            </Button>
          </div>
        </div>

        {errorMessages.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            <p className="font-semibold mb-1">Please fix the following:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errorMessages.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <InvoiceForm
            customers={customers}
            formData={formData}
            onChange={(updates) => {
              setFormData((prev) => {
                const next = { ...prev, ...updates };
                if ("isReturn" in updates) {
                  next.namingSeries = updates.isReturn
                    ? "ACC-SINV-RET-.YYYY.-"
                    : "ACC-SINV-.YYYY.-";
                }
                return next;
              });
              if (fieldErrors) {
                const cleared = { ...fieldErrors };
                for (const key of Object.keys(updates)) {
                    const fieldMap: Record<string, keyof InvoiceFieldErrors> = {
                      customer: "customer",
                      company: "company",
                      issueDate: "postingDate",
                      dueDate: "dueDate",
                      currency: "currency",
                      conversionRate: "conversionRate",
                      sellingPriceList: "sellingPriceList",
                      plcConversionRate: "plcConversionRate",
                      debitTo: "debitTo",
                      returnAgainst: "returnAgainst",
                    };
                  const fieldKey = fieldMap[key];
                  if (fieldKey && cleared[fieldKey]) {
                    delete cleared[fieldKey];
                  }
                }
                setFieldErrors(cleared);
                if (Object.keys(cleared).length === 0) { setError(""); setErrorMessages([]); }
              }
            }}
            fieldErrors={fieldErrors}
            warehouses={warehouses}
            taxesAndChargesTemplates={taxesAndChargesTemplates}
            taxesAndChargesTemplate={taxTemplate?.name ?? ""}
            onTaxTemplateChange={handleTaxTemplateChange}
            onSelectCustomer={handleSelectCustomer}
            loadingPartyDetails={loadingPartyDetails}
            taxRows={taxRows}
            editableTaxRows={editableTaxRows}
            onTaxRowsChange={setEditableTaxRows}
            taxAccounts={accounts}
            companyDefaults={companyDefaults}
            grandTotal={grandTotal}
            subtotal={subtotal}
            totalTaxesAndCharges={totalTaxesAndCharges}
            totalQuantity={lineItems.reduce(
              (sum, l) => sum + (l.quantity ?? 0),
              0,
            )}
            onAddItems={handleAddItems}
            lineItems={
              <InvoiceLineItems
                items={lineItems}
                products={products}
                warehouses={warehouses}
                accounts={accounts}
                costCenters={costCenters}
                itemTaxTemplates={itemTaxTemplates}
                productDropdowns={productDropdowns}
                onUpdate={updateLine}
                onRemove={removeLine}
                onAdd={addLine}
                onAddItemWithQty={addItemWithQty}
                onProductDropdownChange={(id, dropdown) =>
                  setProductDropdowns((prev) => ({ ...prev, [id]: dropdown }))
                }
                onSelectProduct={selectProduct}
                itemDetailsContext={{
                  currency: formData.currency || companyDefaults?.currency,
                  conversion_rate: formData.conversionRate ?? conversionRate,
                  selling_price_list: formData.sellingPriceList || companyDefaults?.defaultSellingPriceList,
                  price_list_currency: formData.priceListCurrency || companyDefaults?.currency,
                  plc_conversion_rate: formData.plcConversionRate ?? plcConversionRate,
                  customer: formData.customer,
                  is_pos: formData.isPos ? 1 : 0,
                  is_return: formData.isReturn ? 1 : 0,
                }}
              />
            }
            totals={
              <InvoiceTotals
                variant="inline"
                subtotal={subtotal}
                totalTaxesAndCharges={totalTaxesAndCharges}
                discountAmount={additionalDiscount}
                grandTotal={grandTotal}
                roundingAdjustment={roundingAdjustment}
                roundedTotal={roundedTotal}
                taxLines={taxLinesForDisplay}
              />
            }
          />
        )}
      </motion.div>
    </>
  );
}
