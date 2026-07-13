"use client"

import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { getCompanyDefaults } from "@/services/company"
import { DEFAULT_GST_RATE, DEFAULT_QST_RATE, DEFAULT_TAX_TEMPLATE_NAME } from "@/services/tax-template"
import { invoiceService, customerService, productService, type Customer, type Product } from "@/services"
import InvoiceForm, { type InvoiceFormData } from "../components/InvoiceForm"
import InvoiceLineItems, { type LineItemForm } from "../components/InvoiceLineItems"
import InvoiceTotals from "../components/InvoiceTotals"

function calcTotal(qty: number, price: number): number {
  return Math.round(qty * price * 100) / 100
}

function createEmptyLine(defaults?: { incomeAccount?: string; costCenter?: string }): LineItemForm {
  return {
    id: crypto.randomUUID(),
    productId: "", productName: "", sku: "",
    quantity: 1, price: 0, total: 0,
    uom: "Nos", warehouse: "",
    discountPercentage: undefined,
    marginType: undefined,
    marginRateOrAmount: undefined,
    incomeAccount: defaults?.incomeAccount || "",
    costCenter: defaults?.costCenter || "",
  }
}

function toFormData(d: Partial<InvoiceFormData>): InvoiceFormData {
  return {
    customer: d.customer ?? "",
    customerName: d.customerName ?? "",
    issueDate: d.issueDate ?? new Date().toISOString().slice(0, 10),
    dueDate: d.dueDate ?? (() => { const dt = new Date(); dt.setDate(dt.getDate() + 30); return dt.toISOString().slice(0, 10) })(),
    setPostingTime: d.setPostingTime,
    updateStock: d.updateStock,
    setWarehouse: d.setWarehouse,
    customerAddress: d.customerAddress,
    shippingAddressName: d.shippingAddressName,
    contactPerson: d.contactPerson,
    poNo: d.poNo,
    poDate: d.poDate,
    paymentTermsTemplate: d.paymentTermsTemplate,
    currency: d.currency,
    sellingPriceList: d.sellingPriceList,
    priceListCurrency: d.priceListCurrency,
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
    writeOffOutstandingAmountAutomatically: d.writeOffOutstandingAmountAutomatically,
    disableRoundedTotal: d.disableRoundedTotal,
    useCompanyDefaultCostCenterForRoundOff: d.useCompanyDefaultCostCenterForRoundOff,
    costCenter: d.costCenter,
    project: d.project,
    taxCategory: d.taxCategory,
    shippingRule: d.shippingRule,
    incoterm: d.incoterm,
    // Sales Team
    salesPartner: d.salesPartner,
    commissionRate: d.commissionRate,
    salesTeam: d.salesTeam,
    // Loyalty
    redeemLoyaltyPoints: d.redeemLoyaltyPoints,
    loyaltyProgram: d.loyaltyProgram,
    loyaltyPoints: d.loyaltyPoints,
    loyaltyAmount: d.loyaltyAmount,
    redemptionAccount: d.redemptionAccount,
    redemptionCostCenter: d.redemptionCostCenter,
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
    // Subscription
    subscription: d.subscription,
    fromDate: d.fromDate,
    toDate: d.toDate,
    autoRepeat: d.autoRepeat,
    debitTo: d.debitTo,
    isOpening: d.isOpening,
    customerGroup: d.customerGroup,
    remarks: d.remarks,
  }
}

export default function CreateInvoice() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState<InvoiceFormData>(toFormData({}))
  const [lineItems, setLineItems] = useState<LineItemForm[]>([createEmptyLine()])
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productDropdowns, setProductDropdowns] = useState<Record<string, { open: boolean; search: string }>>({})
  const [warehouses, setWarehouses] = useState<string[]>([])
  const [accounts, setAccounts] = useState<string[]>([])
  const [costCenters, setCostCenters] = useState<string[]>([])
  const [itemTaxTemplates, setItemTaxTemplates] = useState<string[]>([])
  const [taxesAndChargesTemplates, setTaxesAndChargesTemplates] = useState<string[]>([])
  const [taxTemplate, setTaxTemplate] = useState<{ name: string; gstRate: number; qstRate: number } | null>(null)
  const [companyDefaults, setCompanyDefaults] = useState<{ company: string; currency: string; defaultSellingPriceList: string; defaultReceivableAccount: string; defaultIncomeAccount: string; defaultCostCenter: string } | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingPartyDetails, setLoadingPartyDetails] = useState(false)
  const [conversionRate, setConversionRate] = useState<number>(1)
  const [plcConversionRate, setPlcConversionRate] = useState<number>(1)

  const gstRate = taxTemplate?.gstRate ?? DEFAULT_GST_RATE
  const qstRate = taxTemplate?.qstRate ?? DEFAULT_QST_RATE
  const defaultTaxTemplate = taxTemplate?.name ?? DEFAULT_TAX_TEMPLATE_NAME

  useEffect(() => {
    Promise.all([
      customerService.list({ pageSize: 100 }),
      productService.list({ pageSize: 100 }),
      invoiceService.getDefaultTaxTemplate(),
      invoiceService.lookups.warehouses(),
      invoiceService.lookups.accounts(),
      invoiceService.lookups.costCenters(),
      invoiceService.lookups.itemTaxTemplates(),
      invoiceService.lookups.taxesAndChargesTemplates(),
      getCompanyDefaults(),
    ]).then(([custRes, prodRes, tmpl, wh, ac, cst, itt, tac, defaults]) => {
      setCustomers(custRes.items)
      setProducts(prodRes.items)
      setTaxTemplate(tmpl)
      setWarehouses(wh)
      setAccounts(ac)
      setCostCenters(cst)
      setItemTaxTemplates(itt)
      setTaxesAndChargesTemplates(tac)
      setCompanyDefaults(defaults)
      setLineItems((prev) => prev.map((line, i) =>
        i === 0 && !line.incomeAccount && !line.costCenter
          ? { ...line, incomeAccount: defaults.defaultIncomeAccount || "", costCenter: defaults.defaultCostCenter || "" }
          : line
      ))
    }).catch(() => {
      setError("Failed to load data")
    }).finally(() => {
      setLoading(false)
    })
  }, [])

  // Conditional cascade: when set_warehouse changes, apply to lines that have no warehouse set
  const prevSetWarehouse = useRef(formData.setWarehouse)
  useEffect(() => {
    if (formData.setWarehouse && formData.setWarehouse !== prevSetWarehouse.current) {
      setLineItems((prev) =>
        prev.map((line) =>
          !line.warehouse ? { ...line, warehouse: formData.setWarehouse! } : line,
        ),
      )
    }
    prevSetWarehouse.current = formData.setWarehouse
  }, [formData.setWarehouse])

  const handleTaxTemplateChange = async (templateName: string) => {
    if (!templateName) return
    try {
      const result = await invoiceService.getTaxTemplateDetails(templateName)
      if (result) {
        setTaxTemplate(result)
      }
    } catch {
      // keep existing rates on failure
    }
  }

  const handleSelectCustomer = async (customer: Customer) => {
    setFormData((prev) => ({
      ...prev,
      customer: customer.name,
      customerName: customer.customer_name,
      customerAddress: customer.customer_primary_address || undefined,
      shippingAddressName: customer.customer_primary_address || undefined,
      contactPerson: customer.customer_primary_contact || undefined,
    }))
    if (!companyDefaults) return
    setLoadingPartyDetails(true)
    try {
      const details = await invoiceService.getPartyDetails(
        customer.name,
        companyDefaults.company,
        formData.issueDate,
      )
      setFormData((prev) => ({
        ...prev,
        paymentTermsTemplate: details.payment_terms_template || prev.paymentTermsTemplate,
        customerAddress: details.customer_address || prev.customerAddress,
        shippingAddressName: details.shipping_address_name || prev.shippingAddressName,
        contactPerson: details.contact_person || prev.contactPerson,
        debitTo: details.debit_to || prev.debitTo,
        currency: details.currency || prev.currency,
        sellingPriceList: details.selling_price_list || prev.sellingPriceList,
        priceListCurrency: details.price_list_currency || prev.priceListCurrency,
        dueDate: details.due_date || prev.dueDate,
      }))

      // Fetch exchange rates when currencies differ from company currency
      const partyCurrency = details.currency
      const priceListCurrency = details.price_list_currency
      const companyCurrency = companyDefaults.currency
      const postingDate = formData.issueDate || new Date().toISOString().slice(0, 10)

      if (partyCurrency && partyCurrency !== companyCurrency) {
        const rate = await invoiceService.getExchangeRate(partyCurrency, companyCurrency, postingDate)
        // TODO: handle rate === 0 (no Currency Exchange record, external API returned nothing).
        // Do NOT silently fall back to 1 — that would cause incorrect amounts.
        // Decided behavior TBD after checking what ERPNext Desk does in this case.
        setConversionRate(rate)
      } else {
        setConversionRate(1)
      }

      if (priceListCurrency && priceListCurrency !== companyCurrency) {
        const plcRate = await invoiceService.getExchangeRate(priceListCurrency, companyCurrency, postingDate)
        // TODO: same 0.0 handling needed — see above
        setPlcConversionRate(plcRate)
      } else {
        setPlcConversionRate(1)
      }
    } catch {
      // fallback: keep basic fields set above, don't block the form
    } finally {
      setLoadingPartyDetails(false)
    }
  }

  // Recalculate due date when payment terms template or posting date changes (only if customer is set)
  const prevPaymentTemplate = useRef(formData.paymentTermsTemplate)
  const prevIssueDate = useRef(formData.issueDate)
  useEffect(() => {
    if (!formData.customer || !companyDefaults) return
    const templateChanged = formData.paymentTermsTemplate !== prevPaymentTemplate.current
    const dateChanged = formData.issueDate !== prevIssueDate.current
    if (!templateChanged && !dateChanged) {
      prevPaymentTemplate.current = formData.paymentTermsTemplate
      prevIssueDate.current = formData.issueDate
      return
    }
    prevPaymentTemplate.current = formData.paymentTermsTemplate
    prevIssueDate.current = formData.issueDate
    invoiceService
      .getDueDate(formData.issueDate, formData.customer, companyDefaults.company, formData.paymentTermsTemplate)
      .then((d) => {
        if (d) setFormData((prev) => ({ ...prev, dueDate: d }))
      })
      .catch(() => {})
  }, [formData.paymentTermsTemplate, formData.issueDate, formData.customer, companyDefaults])

  const addLine = () => setLineItems((prev) => [...prev, createEmptyLine({
    incomeAccount: companyDefaults?.defaultIncomeAccount,
    costCenter: companyDefaults?.defaultCostCenter,
  })])

  const removeLine = (id: string) =>
    setLineItems((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev))

  const updateLine = (id: string, updates: Partial<LineItemForm>) =>
    setLineItems((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...updates }
        next.total = calcTotal(next.quantity, next.price)
        return next
      }),
    )

  const selectProduct = (lineId: string, product: Product) => {
    updateLine(lineId, {
      productId: product.item_code,
      productName: product.item_name,
      description: product.description || undefined,
      sku: product.item_code,
      price: product.standard_rate,
      uom: product.stock_uom || "Nos",
      warehouse: product.default_warehouse || "",
      incomeAccount: product.income_account || companyDefaults?.defaultIncomeAccount || "",
      costCenter: product.cost_center || companyDefaults?.defaultCostCenter || "",
      discountPercentage: undefined,
      discountAmount: undefined,
      marginType: undefined,
      marginRateOrAmount: undefined,
    })
    setProductDropdowns((prev) => ({ ...prev, [lineId]: { open: false, search: "" } }))
  }

  const subtotal = lineItems.reduce((sum, l) => sum + l.total, 0)
  const gstAmount = Math.round(subtotal * gstRate * 100) / 100
  const qstAmount = Math.round(subtotal * qstRate * 100) / 100
  const totalTaxesAndCharges = Math.round((gstAmount + qstAmount) * 100) / 100
  const combinedTaxRate = gstRate + qstRate

  // Compute additional discount
  let additionalDiscount = 0
  if (formData.discountAmount && formData.discountAmount > 0) {
    additionalDiscount = formData.discountAmount
  } else if (formData.additionalDiscountPercentage && formData.additionalDiscountPercentage > 0) {
    const base = formData.applyDiscountOn === "Net Total" ? subtotal : subtotal + totalTaxesAndCharges
    additionalDiscount = Math.round(base * (formData.additionalDiscountPercentage / 100) * 100) / 100
  }

  const grandTotal = Math.round((subtotal + totalTaxesAndCharges - additionalDiscount) * 100) / 100

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
  ]

  // Excluded from payload (ERPNext uses company defaults): posting_time, cost_center, project
  const buildPayload = () => ({
    customer: formData.customer,
    company: companyDefaults?.company || "",
    posting_date: formData.issueDate,
    due_date: formData.dueDate,
    currency: formData.currency || companyDefaults?.currency || "",
    conversion_rate: conversionRate,
    selling_price_list: formData.sellingPriceList || companyDefaults?.defaultSellingPriceList || "",
    price_list_currency: formData.priceListCurrency || companyDefaults?.currency || "",
    plc_conversion_rate: plcConversionRate,
    ignore_pricing_rule: formData.ignorePricingRule,
    update_stock: formData.updateStock,
    set_warehouse: formData.setWarehouse || undefined,
    debit_to: companyDefaults?.defaultReceivableAccount || "",
    taxes_and_charges: taxTemplate?.name || defaultTaxTemplate,
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
    write_off_outstanding_amount_automatically: formData.writeOffOutstandingAmountAutomatically,
    tax_category: formData.taxCategory || undefined,
    shipping_rule: formData.shippingRule || undefined,
    incoterm: formData.incoterm || undefined,
    disable_rounded_total: formData.disableRoundedTotal,
    use_company_roundoff_cost_center: formData.useCompanyDefaultCostCenterForRoundOff,
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
    update_billed_amount_in_sales_order: formData.updateBilledAmountInSalesOrder,
    update_billed_amount_in_delivery_note: formData.updateBilledAmountInDeliveryNote,
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
    // Subscription
    subscription: formData.subscription || undefined,
    from_date: formData.fromDate || undefined,
    to_date: formData.toDate || undefined,
    auto_repeat: formData.autoRepeat || undefined,
    remarks: formData.remarks || undefined,
    items: lineItems.map((li) => {
      const amt = li.quantity * li.price
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
        income_account: li.incomeAccount || companyDefaults?.defaultIncomeAccount || undefined,
        cost_center: li.costCenter || companyDefaults?.defaultCostCenter || undefined,
      }
    }),
  })

  const handleSaveDraft = async () => {
    if (!formData.customer) return
    setSaving(true)
    setError("")
    try {
      const created = await invoiceService.create(buildPayload())
      navigate(`/invoices/${created.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAndSubmit = async () => {
    if (!formData.customer) return
    setSaving(true)
    setError("")
    try {
      const created = await invoiceService.create(buildPayload())
      await invoiceService.submit(created.name)
      navigate(`/invoices/${created.name}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invoice")
    } finally {
      setSaving(false)
    }
  }

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
              <p className="text-sm text-muted mt-0.5">Create a new sales invoice.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate("/invoices")}>Cancel</Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || !formData.customer}
              loading={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={handleSaveAndSubmit}
              disabled={saving || !formData.customer}
              loading={saving}
            >
              <CheckCircle2 size={16} />
              {saving ? "Saving..." : "Save & Submit"}
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
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
        <InvoiceForm
          customers={customers}
          formData={formData}
          onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
          warehouses={warehouses}
          taxesAndChargesTemplates={taxesAndChargesTemplates}
          taxesAndChargesTemplate={taxTemplate?.name ?? ""}
          onTaxTemplateChange={handleTaxTemplateChange}
          onSelectCustomer={handleSelectCustomer}
          loadingPartyDetails={loadingPartyDetails}
          taxRows={taxRows}
          conversionRate={conversionRate}
          plcConversionRate={plcConversionRate}
          onConversionRateChange={setConversionRate}
          onPlcConversionRateChange={setPlcConversionRate}
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
              onProductDropdownChange={(id, dropdown) => setProductDropdowns((prev) => ({ ...prev, [id]: dropdown }))}
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
        )}
      </motion.div>
    </>
  )
}
