"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, XCircle, DollarSign, FileEdit, Plus, ChevronDown, Trash2, Receipt, AlertTriangle, Save, FileText } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Badge, Skeleton, Button } from "@/components/ui";
import { getCompanyDefaults } from "@/services/company";
import {
  invoiceService,
  type SalesInvoice,
  type Product,
  type TaxTemplateResult,
  type EditableTaxRow,
  type PartyDetailsResponse,
  templateRowsToEditable,
  erpnextTaxesToEditable,
  computeTaxes,
  computeTotalForDiscountAmount,
  formatExchangeRateError,
} from "@/services";
import type {
  SalesInvoiceSalesTeam,
  SalesInvoiceItem,
  SalesInvoiceAdvance,
} from "../types";
import InvoiceForm, { type InvoiceFormData, type InvoiceFieldErrors } from "../components/InvoiceForm";
import LoyaltyProgramDialog from "../components/LoyaltyProgramDialog";
import { useCustomerSelection } from "../hooks/useCustomerSelection";
import InvoiceLineItems, {
  type LineItemForm,
} from "../components/InvoiceLineItems";
import { applySetWarehouseToItems } from "../utils/applySetWarehouse";
import InvoicePDFButton from "../components/InvoicePDFButton";
import RecordPaymentDialog from "../components/RecordPaymentDialog";
import {
  validateInvoice,
  getErrorMessages,
} from "../validation";
import { formatDate } from "@/lib/utils";

const statusVariant: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  Paid: "success",
  Unpaid: "warning",
  Draft: "default",
  Overdue: "danger",
  Cancelled: "default",
  Submitted: "info",
};

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100;
}

function invToFormData(inv: SalesInvoice): InvoiceFormData {
  return {
    customer: inv.customer,
    customerName: inv.customer_name,
    company: inv.company,
    issueDate: inv.posting_date?.slice(0, 10) ?? "",
    dueDate: inv.due_date?.slice(0, 10) ?? "",
    postingTime: inv.posting_time,
    setPostingTime: !!inv.set_posting_time,
    updateStock: !!inv.update_stock,
    setWarehouse: inv.set_warehouse,
    setTargetWarehouse: inv.set_target_warehouse,
    customerAddress: inv.customer_address,
    addressDisplay: inv.address_display,
    shippingAddressName: inv.shipping_address_name,
    shippingAddress: inv.shipping_address,
    contactPerson: inv.contact_person,
    contactDisplay: inv.contact_display,
    contactEmail: inv.contact_email,
    contactMobile: inv.contact_mobile,
    contactPhone: inv.contact_phone,
    contactDesignation: inv.contact_designation,
    contactDepartment: inv.contact_department,
    dispatchAddressName: inv.dispatch_address_name,
    dispatchAddress: inv.dispatch_address,
    poNo: inv.po_no,
    poDate: inv.po_date?.slice(0, 10),
    paymentTermsTemplate: inv.payment_terms_template,
    currency: inv.currency,
    sellingPriceList: inv.selling_price_list,
    priceListCurrency: inv.price_list_currency,
    ignorePricingRule: inv.ignore_pricing_rule,
    applyDiscountOn: inv.apply_discount_on,
    discountAmount: inv.discount_amount,
    additionalDiscountPercentage: inv.additional_discount_percentage,
    couponCode: inv.coupon_code,
    isCashOrNonTradeDiscount: !!inv.is_cash_or_non_trade_discount,
    discountAccount: inv.additional_discount_account,
    writeOffAmount: inv.write_off_amount,
    writeOffAccount: inv.write_off_account,
    writeOffCostCenter: inv.write_off_cost_center,
    disableRoundedTotal: !!inv.disable_rounded_total,
    useCompanyDefaultCostCenterForRoundOff:
      inv.use_company_roundoff_cost_center,
    costCenter: inv.cost_center,
    project: inv.project,
    taxCategory: inv.tax_category,
    taxesAndCharges: inv.taxes_and_charges,
    partyAccountCurrency: inv.party_account_currency,
    salesPartner: inv.sales_partner,
    commissionRate: inv.commission_rate,
    salesTeam: inv.sales_team?.map((m: SalesInvoiceSalesTeam) => ({
      id: crypto.randomUUID(),
      sales_person: m.sales_person,
      allocated_percentage: m.allocated_percentage,
      commission_rate: m.commission_rate,
      incentives: m.incentives,
    })),
    redeemLoyaltyPoints: !!inv.redeem_loyalty_points,
    loyaltyProgram: inv.loyalty_program,
    loyaltyPoints: inv.loyalty_points,
    loyaltyAmount: inv.loyalty_amount,
    loyaltyRedemptionAccount: inv.loyalty_redemption_account,
    loyaltyRedemptionCostCenter: inv.loyalty_redemption_cost_center,
    letterHead: inv.letter_head,
    groupSameItems: inv.group_same_items,
    selectPrintHeading: inv.select_print_heading,
    language: inv.language,
    tcName: inv.tc_name,
    terms: inv.terms,
    paymentScheduleRows: inv.payment_schedule?.map((ps) => ({
      id: crypto.randomUUID(),
      due_date: ps.due_date?.slice(0, 10) ?? "",
      payment_amount: ps.payment_amount ?? 0,
    })),
    isReturn: !!inv.is_return,
    returnAgainst: inv.return_against,
    isDebitNote: !!inv.is_debit_note,
    updateBilledAmountInSalesOrder: inv.update_billed_amount_in_sales_order,
    updateBilledAmountInDeliveryNote: inv.update_billed_amount_in_delivery_note,
    updateOutstandingForSelf: inv.update_outstanding_for_self,
    advances: inv.advances?.map((a: SalesInvoiceAdvance) => ({
      id: crypto.randomUUID(),
      reference_type: a.reference_type,
      reference_name: a.reference_name,
      advance_amount: a.advance_amount,
      allocated_amount: a.allocated_amount,
    })),
    allocateAdvancesAutomatically: !!inv.allocate_advances_automatically,
    onlyIncludeAllocatedPayments: inv.only_include_allocated_payments,
    isPos: !!inv.is_pos,
    posProfile: inv.pos_profile,
    accountForChangeAmount: inv.account_for_change_amount,
    subscription: inv.subscription,
    fromDate: inv.from_date?.slice(0, 10),
    toDate: inv.to_date?.slice(0, 10),
    autoRepeat: inv.auto_repeat,
    debitTo: inv.debit_to,
    isOpening: inv.is_opening,
    customerGroup: inv.customer_group,
    remarks: inv.remarks,
    taxId: inv.tax_id,
    companyTaxId: inv.company_tax_id,
    amendedFrom: inv.amended_from,
    isInternalCustomer: !!inv.is_internal_customer,
    representsCompany: inv.represents_company,
    title: inv.title,
    companyAddress: inv.company_address,
    companyAddressDisplay: inv.company_address_display,
    territory: inv.customer_group ? undefined : undefined,
    baseGrandTotal: inv.base_grand_total,
    baseNetTotal: inv.base_net_total,
    baseTotalTaxesAndCharges: inv.base_total_taxes_and_charges,
    baseRoundingAdjustment: inv.base_rounding_adjustment,
    baseRoundedTotal: inv.base_rounded_total,
    inWords: inv.in_words,
    totalNetWeight: inv.total_net_weight,
    netTotal: inv.net_total,
    totalTaxesAndCharges: inv.total_taxes_and_charges,
    roundingAdjustment: inv.rounding_adjustment,
    roundedTotal: inv.rounded_total,
    basePaidAmount: inv.base_paid_amount,
    paidAmount: inv.paid_amount,
    baseChangeAmount: inv.base_change_amount,
    changeAmount: inv.change_amount,
    baseWriteOffAmount: inv.base_write_off_amount,
    totalAdvance: inv.total_advance,
    unrealizedProfitLossAccount: inv.unrealized_profit_loss_account,
    againstIncomeAccount: inv.against_income_account,
    totalCommission: inv.total_commission,
  };
}

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [formData, setFormData] = useState<InvoiceFormData>(() => ({
    customer: "",
    customerName: "",
    issueDate: "",
    dueDate: "",
  }));
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({});
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
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [plcConversionRate, setPlcConversionRate] = useState<number>(1);
  const [editableTaxRows, setEditableTaxRows] = useState<EditableTaxRow[]>([]);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);

  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const lineItemsRef = useRef(lineItems);
  lineItemsRef.current = lineItems;

  const defaultTaxesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePartyDetailsApplied = useCallback(
    (details: PartyDetailsResponse) => {
      if (editableTaxRows.length > 0) return;
      const company = companyDefaults?.company ?? formDataRef.current.company ?? "";
      if (!company) return;
      if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current);
      defaultTaxesTimer.current = setTimeout(() => {
        invoiceService
          .getDefaultTaxesAndCharges(company, details.taxes_and_charges || "")
          .then((res) => {
            if (res && (res.taxes_and_charges || res.taxes.length)) {
              setTaxTemplate({
                name: res.taxes_and_charges || "",
                doctype: "Sales Taxes and Charges Template",
                rows: [],
              });
              if (res.taxes.length) {
                setEditableTaxRows(erpnextTaxesToEditable(res.taxes));
              }
            }
          });
      }, 2000);
    },
    [companyDefaults, editableTaxRows.length],
  );

  const {
    handleSelectCustomer,
    loadingPartyDetails,
    loyaltyProgramOptions,
    clearLoyaltyProgramOptions,
  } = useCustomerSelection({
    setFormData,
    formDataRef,
    companyDefaults,
    setConversionRate,
    setPlcConversionRate,
    setError,
    onPartyDetailsApplied: handlePartyDetailsApplied,
  });

  useEffect(() => {
    return () => {
      if (defaultTaxesTimer.current) clearTimeout(defaultTaxesTimer.current);
    };
  }, []);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    invoiceService.getById(id).then(setInvoice).catch(() => null).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    Promise.all([
      invoiceService.getById(id),
      invoiceService.getDefaultTaxTemplate(),
      getCompanyDefaults(),
    ])
      .then(([inv, tmpl, defaults]) => {
        setInvoice(inv);
        setTaxTemplate(tmpl);
        setCompanyDefaults(defaults);
        setFormData(invToFormData(inv));
        setConversionRate(inv.conversion_rate ?? 1);
        setPlcConversionRate(inv.plc_conversion_rate ?? 1);
        setFormData((prev) => ({
          ...prev,
          conversionRate: inv.conversion_rate ?? 1,
          plcConversionRate: inv.plc_conversion_rate ?? 1,
          companyTaxId: defaults.companyTaxId || prev.companyTaxId,
        }));
        if (inv.taxes_and_charges) {
          invoiceService
            .getTaxTemplateDetails(inv.taxes_and_charges)
            .then((td) => {
              if (td) setTaxTemplate(td);
            })
            .catch(() => {});
        }
        setLineItems(
          (inv.items ?? []).map((item: SalesInvoiceItem) => ({
            id: crypto.randomUUID(),
            productId: item.item_code,
            productName: item.item_name || item.item_code,
            description: item.description || undefined,
            sku: item.item_code,
            quantity: item.qty,
            price: item.rate,
            total: item.amount ?? calcTotal(item.qty, item.rate),
            uom: item.uom || "Nos",
            warehouse: item.warehouse || "",
            discountPercentage: item.discount_percentage ?? undefined,
            discountAmount: item.discount_amount ?? undefined,
            marginType: item.margin_type || undefined,
            marginRateOrAmount: item.margin_rate_or_amount ?? undefined,
            itemTaxTemplate: item.item_tax_template || undefined,
            batchNo: item.batch_no || undefined,
            serialNo: item.serial_no || undefined,
            enableDeferredRevenue: item.enable_deferred_revenue ?? false,
            serviceStartDate: item.service_start_date?.slice(0, 10),
            serviceEndDate: item.service_end_date?.slice(0, 10),
            grantCommission: item.grant_commission !== false,
            pageBreak: item.page_break ?? false,
            incomeAccount: item.income_account || "",
            costCenter: item.cost_center || "",
          })),
        );
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async () => {
    if (!id) return;
    setSubmitting(true);
    setError("");
    try {
      await invoiceService.submit(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit invoice");
    } finally { setSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!id) return;
    setSubmitting(true);
    setError("");
    try {
      await invoiceService.cancel(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel invoice");
    } finally { setSubmitting(false); }
  };

  const handleAmend = async () => {
    if (!id) return;
    setSubmitting(true);
    setError("");
    try {
      const amended = await invoiceService.amend(id);
      navigate(`/invoices/${amended.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to amend invoice");
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Delete this invoice? This action cannot be undone.")) return;
    setDeleting(true);
    setError("");
    try {
      await invoiceService.delete(id);
      navigate("/invoices");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete invoice");
    } finally { setDeleting(false); }
  };

  const handleCreateAction = async (action: () => Promise<{ doctype: string; name: string }>) => {
    if (!id) return;
    setSubmitting(true);
    setCreateDropdownOpen(false);
    try {
      const result = await action();
      navigate(`/${result.doctype.toLowerCase().replace(/\s+/g, "-")}/${result.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally { setSubmitting(false); }
  };

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

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        productId: "",
        productName: "",
        sku: "",
        quantity: 1,
        price: 0,
        total: 0,
        uom: "Nos",
        warehouse: "",
        incomeAccount: companyDefaults?.defaultIncomeAccount || "",
        costCenter: companyDefaults?.defaultCostCenter || "",
        discountPercentage: undefined,
        discountAmount: undefined,
        marginType: undefined,
        marginRateOrAmount: undefined,
      },
    ]);
  };

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
        id: crypto.randomUUID(),
        productId: product.item_code,
        productName: product.item_name,
        description: product.description || undefined,
        sku: product.item_code,
        quantity: qty,
        price: product.standard_rate,
        total: calcTotal(qty, product.standard_rate),
        uom: product.stock_uom || "Nos",
        warehouse: product.default_warehouse || "",
        incomeAccount: product.income_account || companyDefaults?.defaultIncomeAccount || "",
        costCenter: product.cost_center || companyDefaults?.defaultCostCenter || "",
        discountPercentage: undefined,
        discountAmount: undefined,
        marginType: undefined,
        marginRateOrAmount: undefined,
      };
      if (prev.length === 1 && !prev[0].productId && prev[0].quantity === 1 && prev[0].price === 0) {
        return [newRow];
      }
      return [...prev, newRow];
    });
  };

  const removeLine = (lineId: string) =>
    setLineItems((prev) => prev.filter((l) => l.id !== lineId));

  const handleAddItems = (fetchedItems: Array<Record<string, unknown>>) => {
    if (!fetchedItems.length) return;
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
      }));
      if (prev.length === 1 && !prev[0].productId && prev[0].quantity === 1 && prev[0].price === 0) {
        return newItems;
      }
      return [...prev, ...newItems];
    });
  };

  const updateLine = (lineId: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...updates };
        next.total = calcTotal(next.quantity, next.price);
        return next;
      }),
    );

  const handleSetWarehouse = useCallback(
    (warehouse: string | undefined) => {
      void applySetWarehouseToItems(lineItems, updateLine, warehouse)
    },
    [lineItems],
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
        name: id,
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
      actualQty: itemDetails?.actual_qty as number | undefined,
      projectedQty: itemDetails?.projected_qty as number | undefined,
      reservedQty: itemDetails?.reserved_qty as number | undefined,
      incomeAccount,
      costCenter,
      discountPercentage: undefined,
      discountAmount: undefined,
      marginType: undefined,
      marginRateOrAmount: undefined,
    });
  };

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0);
  const totalQuantity = lineItems.reduce((sum, l) => sum + l.quantity, 0);

  // First pass: taxes without discount (ERPNext recomputes after applying it)
  const taxRowsBase = computeTaxes(editableTaxRows, subtotal, totalQuantity);
  const totalTaxesAndChargesBase = taxRowsBase.reduce(
    (sum, r) => sum + r.tax_amount,
    0,
  );

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
        : subtotal + totalTaxesAndChargesBase;
    additionalDiscount =
      Math.round(base * (formData.additionalDiscountPercentage / 100) * 100) /
      100;
  }

  const isCashOrNonTrade =
    formData.applyDiscountOn === "Grand Total" &&
    formData.isCashOrNonTradeDiscount;

  // ERPNext distributes the discount over get_total_for_discount_amount()
  // (grand total minus Actual/On Item Quantity taxes). Net Total mode uses
  // the subtotal directly.
  const totalForDiscount =
    formData.applyDiscountOn === "Net Total"
      ? subtotal
      : computeTotalForDiscountAmount(
          taxRowsBase,
          subtotal,
          totalTaxesAndChargesBase,
        );

  const netTotal =
    isCashOrNonTrade || !totalForDiscount
      ? subtotal
      : Math.round(
          (subtotal - additionalDiscount * (subtotal / totalForDiscount)) * 100,
        ) / 100;

  // Final pass: taxes with the discount applied
  const taxRows = computeTaxes(editableTaxRows, subtotal, totalQuantity, {
    netTotal,
    applyDiscountOn: formData.applyDiscountOn,
    isCashOrNonTradeDiscount: formData.isCashOrNonTradeDiscount,
  });
  // ERPNext total_taxes_and_charges is the sum of the discounted per-row
  // contributions (tax_amount_after_discount_amount), not the displayed
  // pre-discount tax_amount.
  const totalTaxesAndCharges = taxRows.reduce(
    (sum, r) => sum + (r.tax_amount_after_discount_amount ?? 0),
    0,
  );

  const grandTotal = isCashOrNonTrade
    ? Math.round((subtotal + totalTaxesAndCharges - additionalDiscount) * 100) /
      100
    : formData.applyDiscountOn === "Grand Total"
      ? Math.round(
          (subtotal + totalTaxesAndChargesBase - additionalDiscount) * 100,
        ) / 100
      : Math.round((netTotal + totalTaxesAndCharges) * 100) / 100;

  const handleSave = async () => {
    if (!id) return;
    const fd = formDataRef.current;
    const li = lineItemsRef.current;
    const errors = validateInvoice(fd, li, companyDefaults);
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
      await invoiceService.update(id, {
        customer: fd.customer,
        company: companyDefaults?.company || "",
        posting_date: fd.issueDate,
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
        debit_to: companyDefaults?.defaultReceivableAccount || "",
        party_account_currency: fd.partyAccountCurrency || undefined,
        customer_address: fd.customerAddress || undefined,
        shipping_address_name: fd.shippingAddressName || undefined,
        contact_person: fd.contactPerson || undefined,
        po_no: fd.poNo || undefined,
        po_date: fd.poDate || undefined,
        payment_terms_template: fd.paymentTermsTemplate || undefined,
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
        disable_rounded_total: fd.disableRoundedTotal,
        use_company_roundoff_cost_center:
          fd.useCompanyDefaultCostCenterForRoundOff,
        tax_category: fd.taxCategory || undefined,
        shipping_rule: fd.shippingRule || undefined,
        incoterm: fd.incoterm || undefined,
        named_place: fd.namedPlace || undefined,
        sales_partner: fd.salesPartner || undefined,
        commission_rate: fd.commissionRate,
        sales_team: fd.salesTeam?.map((m) => ({
          sales_person: m.sales_person,
          allocated_percentage: m.allocated_percentage,
          commission_rate: m.commission_rate,
          incentives: m.incentives,
        })),
        redeem_loyalty_points: fd.redeemLoyaltyPoints,
        loyalty_program: fd.loyaltyProgram || undefined,
        loyalty_points: fd.loyaltyPoints,
        loyalty_amount: fd.loyaltyAmount,
        loyalty_redemption_account: fd.loyaltyRedemptionAccount || undefined,
        loyalty_redemption_cost_center: fd.loyaltyRedemptionCostCenter || undefined,
        letter_head: fd.letterHead || undefined,
        group_same_items: fd.groupSameItems,
        select_print_heading: fd.selectPrintHeading || undefined,
        language: fd.language || undefined,
        tc_name: fd.tcName || undefined,
        terms: fd.terms || undefined,
        is_return: !!fd.isReturn,
        return_against: fd.returnAgainst || undefined,
        is_debit_note: !!fd.isDebitNote,
        update_billed_amount_in_sales_order:
          fd.updateBilledAmountInSalesOrder,
        update_billed_amount_in_delivery_note:
          fd.updateBilledAmountInDeliveryNote,
        update_outstanding_for_self: fd.updateOutstandingForSelf,
        allocate_advances_automatically: fd.allocateAdvancesAutomatically,
        only_include_allocated_payments: fd.onlyIncludeAllocatedPayments,
        advances: fd.advances?.map((a) => ({
          reference_type: a.reference_type,
          reference_name: a.reference_name,
          advance_amount: a.advance_amount,
          allocated_amount: a.allocated_amount,
        })),
        is_pos: !!fd.isPos,
        pos_profile: fd.posProfile || undefined,
        account_for_change_amount: fd.accountForChangeAmount || undefined,
        cash_bank_account: fd.cashBankAccount || undefined,
        payments: fd.payments?.map((p) => ({
          mode_of_payment: p.mode_of_payment,
          amount: p.amount,
          account: p.account || undefined,
        })),
        subscription: fd.subscription || undefined,
        from_date: fd.fromDate || undefined,
        to_date: fd.toDate || undefined,
        auto_repeat: fd.autoRepeat || undefined,
        remarks: fd.remarks || undefined,
        campaign: fd.campaign || undefined,
        source: fd.source || undefined,
        dispatch_address_name: fd.dispatchAddressName || undefined,
        company_address: fd.companyAddress || undefined,
        company_contact_person: fd.companyContactPerson || undefined,
        tax_id: fd.taxId || undefined,
        company_tax_id: fd.companyTaxId || undefined,
        is_internal_customer: !!fd.isInternalCustomer,
        represents_company: fd.representsCompany || undefined,
        inter_company_invoice_reference: fd.interCompanyInvoiceReference || undefined,
        is_discounted: !!fd.isDiscounted,
        is_opening: fd.isOpening || undefined,
        customer_group: fd.customerGroup || undefined,
        title: fd.title || undefined,
        naming_series: undefined,
        set_posting_time: true,
        posting_time: fd.postingTime || undefined,
        cost_center: fd.costCenter || undefined,
        unrealized_profit_loss_account: fd.unrealizedProfitLossAccount || undefined,
        against_income_account: fd.againstIncomeAccount || undefined,
        taxes_and_charges: fd.taxesAndCharges || undefined,
        taxes: taxRows.map((r) => ({
          charge_type: r.charge_type,
          account_head: r.account_head,
          rate: r.rate,
          description: r.description,
          included_in_print_rate: r.included_in_print_rate,
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
      });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center text-muted py-24">Invoice not found.</div>
      </>
    );
  }

  const isDraft = invoice.docstatus === 0;
  const isSubmitted = invoice.docstatus === 1;
  const isCancelled = invoice.docstatus === 2;

  const canCreatePayment = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) !== 0;
  const canCreateReturn = invoice.docstatus === 1 && !invoice.is_return;
  const canCreateDeliveryNote = invoice.docstatus === 1 && !invoice.is_return && !invoice.update_stock;
  const canCreatePaymentRequest = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0;
  const canCreateInvoiceDiscounting = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0;
  const canCreateDunning = invoice.docstatus === 1 && (invoice.outstanding_amount ?? 0) > 0;
  const canCreateInterCompanyPI = invoice.docstatus === 1 && !!invoice.is_internal_customer;
  const canCreateMaintenanceSchedule = invoice.docstatus === 1;
  const canDelete = invoice.docstatus === 0;

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
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

        <div className="flex items-center justify-between">
          <Link
            to="/invoices"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors"
          >
            <ArrowLeft size={15} /> Back to Invoices
          </Link>
          <div className="flex items-center gap-3">
            {(canCreatePayment || canCreateReturn || canCreateDeliveryNote || canCreatePaymentRequest || canCreateInvoiceDiscounting || canCreateDunning || canCreateInterCompanyPI || canCreateMaintenanceSchedule) && (
              <div className="relative">
                <Button
                  size="sm"
                  onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
                  className="flex items-center gap-1"
                >
                  <Plus size={14} /> Create <ChevronDown size={12} />
                </Button>
                {createDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setCreateDropdownOpen(false)} />
                    <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-border rounded-lg shadow-xl py-1">
                      {canCreatePayment && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makePaymentEntry(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <DollarSign size={14} /> Payment
                        </button>
                      )}
                      {canCreateReturn && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeSalesReturn(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Return / Credit Note
                        </button>
                      )}
                      {canCreateDeliveryNote && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeDeliveryNote(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileEdit size={14} /> Delivery Note
                        </button>
                      )}
                      {canCreatePaymentRequest && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makePaymentRequest(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <DollarSign size={14} /> Payment Request
                        </button>
                      )}
                      {canCreateInvoiceDiscounting && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeInvoiceDiscounting(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Receipt size={14} /> Invoice Discounting
                        </button>
                      )}
                      {canCreateDunning && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeDunning(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <AlertTriangle size={14} /> Dunning
                        </button>
                      )}
                      {canCreateInterCompanyPI && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeInterCompanyPurchaseInvoice(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Inter-Company Purchase Invoice
                        </button>
                      )}
                      {canCreateMaintenanceSchedule && (
                        <button
                          onClick={() => handleCreateAction(() => invoiceService.makeMaintenanceSchedule(invoice.name))}
                          className="w-full text-left px-4 py-2.5 text-sm text-body hover:bg-gray-50 flex items-center gap-2"
                        >
                          <FileText size={14} /> Maintenance Schedule
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            {isDraft && (
              <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
                <Save size={14} /> {saving ? "Saving..." : "Save Changes"}
              </Button>
            )}
            {isDraft && (
              <Button size="sm" onClick={handleSubmit} loading={submitting}>
                <CheckCircle2 size={14} /> Submit
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
                <Trash2 size={14} /> Delete
              </Button>
            )}
            {isSubmitted && (
              <Button variant="danger" size="sm" onClick={handleCancel} loading={submitting}>
                <XCircle size={14} /> Cancel
              </Button>
            )}
            {isCancelled && (
              <Button variant="secondary" size="sm" onClick={handleAmend} loading={submitting}>
                <FileEdit size={14} /> Amend
              </Button>
            )}
            <InvoicePDFButton invoice={invoice} />
          </div>
        </div>

        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[12px] bg-primary-50 text-primary-600 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-heading">{invoice.name}</h1>
              <p className="text-sm text-muted">{formatDate(invoice.posting_date)}</p>
            </div>
          </div>
          <Badge variant={statusVariant[invoice.status] ?? "default"} className="px-3 py-1 text-sm">
            {invoice.status?.toUpperCase()}
          </Badge>
        </div>

        <div className="bg-white rounded-2xl shadow-card p-6">
          <InvoiceForm
            formData={formData}
            mode="existing"
            docstatus={invoice.docstatus}
            onChange={(updates) => {
              if ("customer" in updates && !updates.customer) {
                clearLoyaltyProgramOptions();
              }
              setFormData((prev) => {
                const next = { ...prev, ...updates };
                if ("isReturn" in updates) {
                  next.namingSeries = updates.isReturn
                    ? "ACC-SINV-RET-.YYYY.-"
                    : "ACC-SINV-.YYYY.-";
                }
                return next;
              });
              if ("currency" in updates && updates.currency !== formData.currency) {
                const newCurrency = updates.currency || companyDefaults?.currency || "";
                const companyCurrency = companyDefaults?.currency || "";
                const postingDate = formData.issueDate || new Date().toISOString().slice(0, 10);
                if (newCurrency && newCurrency !== companyCurrency) {
                  invoiceService.getExchangeRate(newCurrency, companyCurrency, postingDate).then((rate) => {
                    if (rate === 0) {
                      setError(formatExchangeRateError(newCurrency, companyCurrency, postingDate));
                    }
                    setConversionRate(rate);
                    setFormData((prev) => ({ ...prev, conversionRate: rate }));
                  });
                } else {
                  setConversionRate(1);
                  setFormData((prev) => ({ ...prev, conversionRate: 1 }));
                }
              }
              if ("sellingPriceList" in updates && updates.sellingPriceList !== formData.sellingPriceList) {
                const newPriceList = updates.sellingPriceList || "";
                const companyCurrency = companyDefaults?.currency || "";
                const postingDate = formData.issueDate || new Date().toISOString().slice(0, 10);
                if (newPriceList) {
                  invoiceService.getDoc("Price List", newPriceList).then((doc) => {
                    const plcCurrency = (doc.currency as string) || "";
                    setFormData((prev) => ({ ...prev, priceListCurrency: plcCurrency || undefined }));
                    if (plcCurrency && plcCurrency !== companyCurrency) {
                      invoiceService.getExchangeRate(plcCurrency, companyCurrency, postingDate).then((rate) => {
                        if (rate === 0) {
                          setError(formatExchangeRateError(plcCurrency, companyCurrency, postingDate));
                        }
                        setPlcConversionRate(rate);
                        setFormData((prev) => ({ ...prev, plcConversionRate: rate }));
                      });
                    } else {
                      setPlcConversionRate(1);
                      setFormData((prev) => ({ ...prev, plcConversionRate: 1 }));
                    }
                  });
                }
              }
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
            paymentSchedule={invoice?.payment_schedule}
            taxRows={taxRows}
            editableTaxRows={editableTaxRows}
            onTaxRowsChange={isDraft ? setEditableTaxRows : undefined}
            taxesAndChargesTemplate={taxTemplate?.name ?? ""}
            onTaxTemplateChange={isDraft ? handleTaxTemplateChange : undefined}
            onSelectCustomer={isDraft ? handleSelectCustomer : undefined}
            loadingPartyDetails={loadingPartyDetails}
            companyDefaults={companyDefaults}
            grandTotal={grandTotal}
            subtotal={subtotal}
            totalTaxesAndCharges={totalTaxesAndCharges}
            totalTaxesAndChargesBase={totalTaxesAndChargesBase}
            totalQuantity={totalQuantity}
            netTotal={netTotal}
            onAddItems={isDraft ? handleAddItems : undefined}
            onSetWarehouse={isDraft ? handleSetWarehouse : undefined}
            lineItems={
              <InvoiceLineItems
                items={lineItems}
                readOnly={!isDraft}
                customer={formData.customer}
                company={formData.company || companyDefaults?.company}
                currency={formData.currency || companyDefaults?.currency || "CAD"}
                taxCategory={formData.taxCategory}
                postingDate={formData.issueDate}
                onUpdate={updateLine}
                onRemove={removeLine}
                onAdd={addLine}
                onAddItemWithQty={addItemWithQty}
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
          />
        </div>

        <LoyaltyProgramDialog
          open={loyaltyProgramOptions.length > 1}
          customer={formData.customer || ""}
          programs={loyaltyProgramOptions}
          onClose={clearLoyaltyProgramOptions}
        />

        <RecordPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          invoice={invoice}
          onPaymentComplete={load}
        />
      </motion.div>
    </>
  );
}
