import type { InvoiceFormData } from "./components/InvoiceForm";
import type { LineItemForm } from "./components/InvoiceLineItems";

export interface InvoiceValidationErrors {
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
    { itemCode?: string; qty?: string; rate?: string; uom?: string }
  >;
  returnAgainst?: string;
  posPayments?: string;
}

const hasValue = (v: string | undefined | null): boolean =>
  typeof v === "string" ? v.trim().length > 0 : !!v;

export function validateInvoice(
  formData: InvoiceFormData,
  lineItems: LineItemForm[],
  companyDefaults: {
    company: string;
    currency: string;
    defaultSellingPriceList: string;
    defaultReceivableAccount: string;
  } | null,
): InvoiceValidationErrors {
  const errors: InvoiceValidationErrors = {};

  const effectiveCompany = formData.company || companyDefaults?.company;
  const effectiveCurrency = formData.currency || companyDefaults?.currency;
  const effectivePriceList =
    formData.sellingPriceList || companyDefaults?.defaultSellingPriceList;
  const effectiveDebitTo =
    formData.debitTo || companyDefaults?.defaultReceivableAccount;

  if (!hasValue(effectiveCompany)) {
    errors.company = "Company is required";
  }

  if (!hasValue(formData.customer)) {
    errors.customer = "Customer is required";
  }

  if (!hasValue(formData.issueDate)) {
    errors.postingDate = "Posting Date is required";
  }

  if (!formData.isReturn && !formData.isDebitNote) {
    if (!hasValue(formData.dueDate)) {
      errors.dueDate = "Payment Due Date is required";
    } else if (hasValue(formData.issueDate) && formData.dueDate < formData.issueDate) {
      errors.dueDate = "Due Date cannot be before Posting Date";
    }
  }

  if (!hasValue(effectiveCurrency)) {
    errors.currency = "Currency is required";
  }

  if (hasValue(formData.customer)) {
    if (formData.conversionRate === undefined || formData.conversionRate === null || formData.conversionRate <= 0) {
      errors.conversionRate = "Exchange Rate is required and must be greater than 0";
    }

    if (!hasValue(effectivePriceList)) {
      errors.sellingPriceList = "Price List is required";
    }

    if (formData.plcConversionRate === undefined || formData.plcConversionRate === null || formData.plcConversionRate <= 0) {
      errors.plcConversionRate = "Price List Exchange Rate is required and must be greater than 0";
    }
  }

  if (!hasValue(effectiveDebitTo)) {
    errors.debitTo = "Debit To account is required";
  }

  if (!lineItems || lineItems.length === 0) {
    errors.items = "At least one item is required";
  } else {
    const itemErrors: Record<
      number,
      { itemCode?: string; qty?: string; rate?: string; uom?: string }
    > = {};
    let hasItemErrors = false;

    for (let i = 0; i < lineItems.length; i++) {
      const row = lineItems[i];
      const rowErr: { itemCode?: string; qty?: string; rate?: string; uom?: string } = {};

      const hasItem = hasValue(row.sku) || hasValue(row.productName);

      if (!hasItem) {
        rowErr.itemCode = "Item is required";
      }
      if (row.quantity < 1) {
        rowErr.qty = "Qty must be ≥ 1";
      }
      if (row.price < 0) {
        rowErr.rate = "Rate cannot be negative";
      }
      if (hasItem && !hasValue(row.uom)) {
        rowErr.uom = "UOM is required";
      }

      if (rowErr.itemCode || rowErr.qty || rowErr.rate || rowErr.uom) {
        itemErrors[i] = rowErr;
        hasItemErrors = true;
      }
    }

    if (hasItemErrors) {
      errors.itemRows = itemErrors;
    }
  }

  if (formData.isReturn && !hasValue(formData.returnAgainst)) {
    errors.returnAgainst = "Return Against is required for credit notes";
  } else if (formData.isDebitNote && !hasValue(formData.returnAgainst)) {
    errors.returnAgainst = "Adjustment Against is required for debit notes";
  }

  if (
    formData.isPos &&
    (!formData.payments || formData.payments.length === 0)
  ) {
    errors.posPayments = "At least one payment is required for POS invoices";
  }

  return errors;
}

export function countErrors(errors: InvoiceValidationErrors): number {
  let count = 0;
  if (errors.customer) count++;
  if (errors.company) count++;
  if (errors.postingDate) count++;
  if (errors.dueDate) count++;
  if (errors.currency) count++;
  if (errors.conversionRate) count++;
  if (errors.sellingPriceList) count++;
  if (errors.plcConversionRate) count++;
  if (errors.debitTo) count++;
  if (errors.items) count++;
  if (errors.returnAgainst) count++;
  if (errors.posPayments) count++;
  if (errors.itemRows) {
    for (const row of Object.values(errors.itemRows)) {
      if (row.itemCode) count++;
      if (row.qty) count++;
      if (row.rate) count++;
      if (row.uom) count++;
    }
  }
  return count;
}

export function getValidationSummary(errors: InvoiceValidationErrors): string {
  const total = countErrors(errors);
  if (total === 0) return "";
  return `Please fix ${total} validation error${total === 1 ? "" : "s"} before saving.`;
}

export function getErrorMessages(errors: InvoiceValidationErrors): string[] {
  const msgs: string[] = [];
  if (errors.customer) msgs.push(errors.customer);
  if (errors.company) msgs.push(errors.company);
  if (errors.postingDate) msgs.push(errors.postingDate);
  if (errors.dueDate) msgs.push(errors.dueDate);
  if (errors.currency) msgs.push(errors.currency);
  if (errors.conversionRate) msgs.push(errors.conversionRate);
  if (errors.sellingPriceList) msgs.push(errors.sellingPriceList);
  if (errors.plcConversionRate) msgs.push(errors.plcConversionRate);
  if (errors.debitTo) msgs.push(errors.debitTo);
  if (errors.items) msgs.push(errors.items);
  if (errors.returnAgainst) msgs.push(errors.returnAgainst);
  if (errors.posPayments) msgs.push(errors.posPayments);
  if (errors.itemRows) {
    for (const [idx, row] of Object.entries(errors.itemRows)) {
      const rowNum = Number(idx) + 1;
      if (row.itemCode) msgs.push(`Row ${rowNum}: ${row.itemCode}`);
      if (row.qty) msgs.push(`Row ${rowNum}: ${row.qty}`);
      if (row.rate) msgs.push(`Row ${rowNum}: ${row.rate}`);
      if (row.uom) msgs.push(`Row ${rowNum}: ${row.uom}`);
    }
  }
  return msgs;
}
