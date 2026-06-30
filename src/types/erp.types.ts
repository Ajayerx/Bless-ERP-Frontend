// ERPNext field mapping types for future API integration
// These map ERPNext doctype fields to the frontend interface fields

export interface ERPNextFieldMap {
  [frontendField: string]: string  // ERPNext API field path
}

// Mapping from frontend Customer → ERPNext Customer doctype
export const CUSTOMER_FIELD_MAP: ERPNextFieldMap = {
  name: "customer_name",
  contactName: "contact_display",
  email: "email_id",
  phone: "mobile_no",
  billingAddress: "primary_address",
  shippingAddress: "shipping_address",
  taxId: "tax_id",
  creditLimit: "credit_limit",
}

// Mapping from frontend Product → ERPNext Item doctype
export const PRODUCT_FIELD_MAP: ERPNextFieldMap = {
  name: "item_name",
  sku: "item_code",
  description: "description",
  price: "standard_rate",
  cost: "valuation_rate",
  stock: "actual_qty",
  unit: "stock_uom",
}

// Mapping from frontend Invoice → ERPNext Sales Invoice
export const INVOICE_FIELD_MAP: ERPNextFieldMap = {
  number: "name",
  customerId: "customer",
  customerName: "customer_name",
  issueDate: "posting_date",
  dueDate: "due_date",
  status: "status",
  total: "grand_total",
  subtotal: "total",
  gst: "gst",
  qst: "qst",
}
