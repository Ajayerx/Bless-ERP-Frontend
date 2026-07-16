"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Save } from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button, Skeleton } from "@/components/ui";
import { getCompanyDefaults } from "@/services/company";
import { DEFAULT_GST_RATE, DEFAULT_QST_RATE } from "@/services/tax-template";
import {
  invoiceService,
  customerService,
  type Customer,
  type SalesInvoice,
  type Product,
} from "@/services";
import type {
  SalesInvoiceSalesTeam,
  SalesInvoiceItem,
  SalesInvoiceAdvance,
} from "../types";
import InvoiceForm, { type InvoiceFormData, type InvoiceFieldErrors } from "../components/InvoiceForm";
import InvoiceLineItems, {
  type LineItemForm,
} from "../components/InvoiceLineItems";
import InvoiceTotals from "../components/InvoiceTotals";
import {
  validateInvoice,
  getValidationSummary,
} from "../validation";

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
    setPostingTime: inv.set_posting_time,
    updateStock: !!inv.update_stock,
    setWarehouse: inv.set_warehouse,
    setTargetWarehouse: inv.set_target_warehouse,
    customerAddress: inv.customer_address,
    shippingAddressName: inv.shipping_address_name,
    contactPerson: inv.contact_person,
    dispatchAddressName: inv.dispatch_address_name,
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
    isCashOrNonTradeDiscount: inv.is_cash_or_non_trade_discount,
    discountAccount: inv.additional_discount_account,
    writeOffAmount: inv.write_off_amount,
    writeOffAccount: inv.write_off_account,
    writeOffCostCenter: inv.write_off_cost_center,
    disableRoundedTotal: inv.disable_rounded_total,
    useCompanyDefaultCostCenterForRoundOff:
      inv.use_company_roundoff_cost_center,
    costCenter: inv.cost_center,
    project: inv.project,
    taxCategory: inv.tax_category,
    taxesAndCharges: inv.taxes_and_charges,
    salesPartner: inv.sales_partner,
    commissionRate: inv.commission_rate,
    salesTeam: inv.sales_team?.map((m: SalesInvoiceSalesTeam) => ({
      id: crypto.randomUUID(),
      sales_person: m.sales_person,
      allocated_percentage: m.allocated_percentage,
      commission_rate: m.commission_rate,
      incentives: m.incentives,
    })),
    redeemLoyaltyPoints: inv.redeem_loyalty_points,
    loyaltyProgram: inv.loyalty_program,
    loyaltyPoints: inv.loyalty_points,
    loyaltyAmount: inv.loyalty_amount,
    redemptionAccount: inv.redemption_account,
    redemptionCostCenter: inv.redemption_cost_center,
    letterHead: inv.letter_head,
    groupSameItems: inv.group_same_items,
    selectPrintHeading: inv.select_print_heading,
    language: inv.language,
    tcName: inv.tc_name,
    terms: inv.terms,
    isReturn: inv.is_return,
    returnAgainst: inv.return_against,
    isDebitNote: inv.is_debit_note,
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
    allocateAdvancesAutomatically: inv.allocate_advances_automatically,
    onlyIncludeAllocatedPayments: inv.only_include_allocated_payments,
    isPos: inv.is_pos,
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
    // fetch_from fields
    taxId: inv.tax_id,
    companyTaxId: inv.company_tax_id,
    isInternalCustomer: !!inv.is_internal_customer,
    representsCompany: inv.represents_company,
    title: inv.title,
    companyAddress: inv.company_address,
    companyAddressDisplay: inv.company_address_display,
    territory: inv.customer_group ? undefined : undefined, // not directly on SalesInvoice
    // Base currency fields (ERPNext-computed)
    baseGrandTotal: inv.base_grand_total,
    baseNetTotal: inv.base_net_total,
    baseTotalTaxesAndCharges: inv.base_total_taxes_and_charges,
    baseRoundingAdjustment: inv.base_rounding_adjustment,
    baseRoundedTotal: inv.base_rounded_total,
    inWords: inv.base_in_words,
    totalNetWeight: inv.total_net_weight,
    netTotal: inv.net_total,
    totalTaxesAndCharges: inv.total_taxes_and_charges,
    roundingAdjustment: inv.rounding_adjustment,
    roundedTotal: inv.rounded_total,
    // Payments (ERPNext-computed)
    basePaidAmount: inv.base_paid_amount,
    paidAmount: inv.paid_amount,
    baseChangeAmount: inv.base_change_amount,
    changeAmount: inv.change_amount,
    baseWriteOffAmount: inv.base_write_off_amount,
    // Advances
    totalAdvance: inv.total_advance,
    // Accounting Details
    unrealizedProfitLossAccount: inv.unrealized_profit_loss_account,
    againstIncomeAccount: inv.against_income_account,
    // Sales team
    totalCommission: inv.total_commission,
  };
}

export default function EditInvoice() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<SalesInvoice | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [formData, setFormData] = useState<InvoiceFormData>(() => ({
    customer: "",
    customerName: "",
    issueDate: "",
    dueDate: "",
  }));
  const [lineItems, setLineItems] = useState<LineItemForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InvoiceFieldErrors>({});
  const [productDropdowns, setProductDropdowns] = useState<
    Record<string, { open: boolean; search: string }>
  >({});
  const [taxTemplate, setTaxTemplate] = useState<{
    name: string;
    gstRate: number;
    qstRate: number;
  } | null>(null);
  const [companyDefaults, setCompanyDefaults] = useState<{
    company: string;
    currency: string;
    defaultSellingPriceList: string;
    defaultReceivableAccount: string;
    defaultIncomeAccount: string;
    defaultCostCenter: string;
    companyTaxId: string;
  } | null>(null);
  // Previously hardcoded to 1 in handleSave regardless of what the invoice actually had —
  // now initialized from the loaded invoice once it arrives (see the Promise.all().then() below),
  // so re-saving an existing multi-currency invoice no longer silently resets its exchange rate.
  const [conversionRate, setConversionRate] = useState<number>(1);
  const [plcConversionRate, setPlcConversionRate] = useState<number>(1);

  const gstRate = taxTemplate?.gstRate ?? DEFAULT_GST_RATE;
  const qstRate = taxTemplate?.qstRate ?? DEFAULT_QST_RATE;

  useEffect(() => {
    if (!id) return;

    const loadProducts = async (): Promise<Product[]> => {
      try {
        const { productService } = await import("@/services");
        const res = await productService.list({ pageSize: 100 });
        return res.items;
      } catch {
        return [];
      }
    };

    Promise.all([
      invoiceService.getById(id),
      customerService.list({ pageSize: 100 }),
      loadProducts(),
      invoiceService.getDefaultTaxTemplate(),
      invoiceService.lookups.warehouses(),
      getCompanyDefaults(),
    ])
      .then(([inv, custRes, prods, tmpl, wh, defaults]) => {
        setInvoice(inv);
        setCustomers(custRes.items);
        setProducts(prods);
        setTaxTemplate(tmpl);
        setWarehouses(wh);
        setCompanyDefaults(defaults);
        setFormData((prev) => ({
          ...prev,
          companyTaxId: defaults.companyTaxId || prev.companyTaxId,
        }));
        setFormData(invToFormData(inv));
        setConversionRate(inv.conversion_rate ?? 1);
        setPlcConversionRate(inv.plc_conversion_rate ?? 1);
        setFormData((prev) => ({
          ...prev,
          conversionRate: inv.conversion_rate ?? 1,
          plcConversionRate: inv.plc_conversion_rate ?? 1,
        }));
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
    setLineItems((prev) =>
      prev.length > 1 ? prev.filter((l) => l.id !== lineId) : prev,
    );

  const updateLine = (lineId: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        const next = { ...l, ...updates };
        next.total = calcTotal(next.quantity, next.price);
        return next;
      }),
    );

  const selectProduct = (lineId: string, product: Product) => {
    updateLine(lineId, {
      productId: product.item_code,
      productName: product.item_name,
      description: product.description || undefined,
      sku: product.item_code,
      price: product.standard_rate,
      uom: product.stock_uom || "Nos",
      warehouse: product.default_warehouse || "",
      incomeAccount:
        product.income_account || companyDefaults?.defaultIncomeAccount || "",
      costCenter:
        product.cost_center || companyDefaults?.defaultCostCenter || "",
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
  const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
  const qstAmount = Math.round(subtotal * qstRate * 100) / 100;
  const totalTaxesAndCharges = Math.round((gstAmount + qstAmount) * 100) / 100;
  const combinedTaxRate = gstRate + qstRate;

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

  // Build tax rows for the read-only Taxes and Charges section
  const taxRows = [
    {
      charge_type: "On Net Total",
      account_head: `GST - ${companyDefaults?.company?.split(" ")[0] ?? "BE"}`,
      description: `GST (${(gstRate * 100).toFixed(1)}%)`,
      rate: gstRate * 100,
      tax_amount: gstAmount,
      total: subtotal + gstAmount,
    },
    {
      charge_type: "On Net Total",
      account_head: `QST - ${companyDefaults?.company?.split(" ")[0] ?? "BE"}`,
      description: `QST (${(qstRate * 100).toFixed(3)}%)`,
      rate: qstRate * 100,
      tax_amount: qstAmount,
      total: subtotal + gstAmount + qstAmount,
    },
  ];

  const handleSave = async () => {
    if (!id) return;
    const errors = validateInvoice(formData, lineItems, companyDefaults);
    setFieldErrors(errors);
    const msg = getValidationSummary(errors);
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError("");
    setFieldErrors({});
    // Excluded from payload (ERPNext uses company defaults): posting_time, cost_center, project
    try {
      await invoiceService.update(id, {
        customer: formData.customer,
        company: companyDefaults?.company || "",
        posting_date: formData.issueDate,
        due_date: formData.dueDate,
        currency: formData.currency || companyDefaults?.currency || "",
        conversion_rate: formData.conversionRate ?? conversionRate,
        selling_price_list:
          formData.sellingPriceList ||
          companyDefaults?.defaultSellingPriceList ||
          "",
        price_list_currency:
          formData.priceListCurrency || companyDefaults?.currency || "",
        plc_conversion_rate: formData.plcConversionRate ?? plcConversionRate,
        ignore_pricing_rule: formData.ignorePricingRule,
        update_stock: formData.updateStock,
        set_warehouse: formData.setWarehouse || undefined,
        set_target_warehouse: formData.setTargetWarehouse || undefined,
        debit_to: companyDefaults?.defaultReceivableAccount || "",
        customer_address: formData.customerAddress || undefined,
        shipping_address_name: formData.shippingAddressName || undefined,
        contact_person: formData.contactPerson || undefined,
        po_no: formData.poNo || undefined,
        po_date: formData.poDate || undefined,
        payment_terms_template: formData.paymentTermsTemplate || undefined,
        apply_discount_on: formData.applyDiscountOn || undefined,
        discount_amount: formData.discountAmount,
        additional_discount_percentage: formData.additionalDiscountPercentage,
        coupon_code: formData.couponCode || undefined,
        is_cash_or_non_trade_discount: formData.isCashOrNonTradeDiscount,
        additional_discount_account: formData.discountAccount || undefined,
        write_off_amount: formData.writeOffAmount,
        write_off_account: formData.writeOffAccount || undefined,
        write_off_cost_center: formData.writeOffCostCenter || undefined,
        write_off_outstanding_amount_automatically:
          formData.writeOffOutstandingAmountAutomatically,
        disable_rounded_total: formData.disableRoundedTotal,
        use_company_roundoff_cost_center:
          formData.useCompanyDefaultCostCenterForRoundOff,
        tax_category: formData.taxCategory || undefined,
        tax_withholding_category: undefined, // ERPNext-managed
        shipping_rule: formData.shippingRule || undefined,
        incoterm: formData.incoterm || undefined,
        named_place: formData.namedPlace || undefined,
        apply_tds: formData.applyTds,
        // Sales Team
        sales_partner: formData.salesPartner || undefined,
        commission_rate: formData.commissionRate,
        sales_team: formData.salesTeam?.map((m) => ({
          sales_person: m.sales_person,
          allocated_percentage: m.allocated_percentage,
          commission_rate: m.commission_rate,
          incentives: m.incentives,
        })),
        // Loyalty
        redeem_loyalty_points: formData.redeemLoyaltyPoints,
        loyalty_program: formData.loyaltyProgram || undefined,
        loyalty_points: formData.loyaltyPoints,
        loyalty_amount: formData.loyaltyAmount,
        redemption_account: formData.redemptionAccount || undefined,
        redemption_cost_center: formData.redemptionCostCenter || undefined,
        // Print
        letter_head: formData.letterHead || undefined,
        group_same_items: formData.groupSameItems,
        select_print_heading: formData.selectPrintHeading || undefined,
        language: formData.language || undefined,
        // Terms
        tc_name: formData.tcName || undefined,
        terms: formData.terms || undefined,
        // Returns
        is_return: formData.isReturn,
        return_against: formData.returnAgainst || undefined,
        is_debit_note: formData.isDebitNote,
        update_billed_amount_in_sales_order:
          formData.updateBilledAmountInSalesOrder,
        update_billed_amount_in_delivery_note:
          formData.updateBilledAmountInDeliveryNote,
        update_outstanding_for_self: formData.updateOutstandingForSelf,
        // Advances
        allocate_advances_automatically: formData.allocateAdvancesAutomatically,
        only_include_allocated_payments: formData.onlyIncludeAllocatedPayments,
        advances: formData.advances?.map((a) => ({
          reference_type: a.reference_type,
          reference_name: a.reference_name,
          advance_amount: a.advance_amount,
          allocated_amount: a.allocated_amount,
        })),
        // POS
        is_pos: formData.isPos,
        pos_profile: formData.posProfile || undefined,
        account_for_change_amount: formData.accountForChangeAmount || undefined,
        cash_bank_account: formData.cashBankAccount || undefined,
        payments: formData.payments?.map((p) => ({
          mode_of_payment: p.mode_of_payment,
          amount: p.amount,
          account: p.account || undefined,
        })),
        // Subscription
        subscription: formData.subscription || undefined,
        from_date: formData.fromDate || undefined,
        to_date: formData.toDate || undefined,
        auto_repeat: formData.autoRepeat || undefined,
        remarks: formData.remarks || undefined,
        campaign: formData.campaign || undefined,
        source: formData.source || undefined,
        // Address & Contact
        dispatch_address_name: formData.dispatchAddressName || undefined,
        company_address: formData.companyAddress || undefined,
        // fetch_from fields
        tax_id: formData.taxId || undefined,
        company_tax_id: formData.companyTaxId || undefined,
        is_internal_customer: formData.isInternalCustomer,
        represents_company: formData.representsCompany || undefined,
        title: formData.title || undefined,
        naming_series: undefined, // ERPNext-managed
        set_posting_time: formData.setPostingTime,
        posting_time: formData.postingTime || undefined,
        // Accounting Details
        unrealized_profit_loss_account: formData.unrealizedProfitLossAccount || undefined,
        against_income_account: formData.againstIncomeAccount || undefined,
        // Tax template
        taxes_and_charges: formData.taxesAndCharges || undefined,
        items: lineItems.map((li) => {
          const amt = li.quantity * li.price;
          return {
            item_code: li.sku || li.productName,
            item_name: li.productName,
            description: li.description || undefined,
            qty: li.quantity,
            uom: li.uom,
            conversion_factor: 1,
            rate: li.price,
            amount: amt,
            base_rate: li.price,
            base_amount: amt,
            warehouse: li.warehouse || undefined,
            discount_percentage: li.discountPercentage ?? 0,
            discount_amount: li.discountAmount ?? 0,
            margin_type: li.marginType || undefined,
            margin_rate_or_amount: li.marginRateOrAmount ?? 0,
            item_tax_template: li.itemTaxTemplate || undefined,
            batch_no: li.batchNo || undefined,
            serial_no: li.serialNo || undefined,
            enable_deferred_revenue: li.enableDeferredRevenue ?? false,
            service_start_date: li.serviceStartDate || undefined,
            service_end_date: li.serviceEndDate || undefined,
            grant_commission: li.grantCommission !== false,
            page_break_before: li.pageBreak ?? false,
            income_account:
              li.incomeAccount ||
              companyDefaults?.defaultIncomeAccount ||
              undefined,
            cost_center:
              li.costCenter || companyDefaults?.defaultCostCenter || undefined,
          };
        }),
      });
      navigate(`/invoices/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save invoice");
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
              onClick={() => navigate(`/invoices/${id}`)}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Edit Invoice</h1>
              <p className="text-sm text-muted mt-0.5">{id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/invoices/${id}`)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={16} /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-[14px] text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <InvoiceForm
              customers={customers}
              formData={formData}
              onChange={(updates) => {
                setFormData((prev) => ({ ...prev, ...updates }));
                if (fieldErrors) {
                  const cleared = { ...fieldErrors };
                  for (const key of Object.keys(updates)) {
                    const fieldMap: Record<string, keyof InvoiceFieldErrors> = {
                      customer: "customer",
                      company: "company",
                      issueDate: "postingDate",
                      dueDate: "dueDate",
                      currency: "currency",
                      sellingPriceList: "sellingPriceList",
                      debitTo: "debitTo",
                      returnAgainst: "returnAgainst",
                    };
                    const fieldKey = fieldMap[key];
                    if (fieldKey && cleared[fieldKey]) {
                      delete cleared[fieldKey];
                    }
                  }
                  setFieldErrors(cleared);
                  if (Object.keys(cleared).length === 0) setError("");
                }
              }}
              fieldErrors={fieldErrors}
              paymentSchedule={invoice?.payment_schedule}
              taxRows={taxRows}
              warehouses={warehouses}
              companyDefaults={companyDefaults}
              grandTotal={grandTotal}
              subtotal={subtotal}
              totalTaxesAndCharges={totalTaxesAndCharges}
              totalQuantity={lineItems.reduce(
                (sum, l) => sum + (l.quantity ?? 0),
                0,
              )}
              lineItems={
                <InvoiceLineItems
                  items={lineItems}
                  products={products}
                  warehouses={warehouses}
                  productDropdowns={productDropdowns}
                  onUpdate={updateLine}
                  onRemove={removeLine}
                  onAdd={addLine}
                  onAddItemWithQty={addItemWithQty}
                  onProductDropdownChange={(lid, dd) =>
                    setProductDropdowns((prev) => ({ ...prev, [lid]: dd }))
                  }
                  onSelectProduct={selectProduct}
                  taxRate={combinedTaxRate}
                />
              }
              totals={
                <InvoiceTotals
                  variant="inline"
                  subtotal={subtotal}
                  totalTaxesAndCharges={totalTaxesAndCharges}
                  discountAmount={additionalDiscount}
                  grandTotal={grandTotal}
                  gst={gstAmount}
                  qst={qstAmount}
                  gstLabel={`GST (${(gstRate * 100).toFixed(1)}%)`}
                  qstLabel={`QST (${(qstRate * 100).toFixed(3)}%)`}
                />
              }
            />
          </>
        )}
      </motion.div>
    </>
  );
}
