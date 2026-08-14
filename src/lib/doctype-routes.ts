// Routes for the doctypes a GL row / Version can reference, so Voucher No and
// Document Name render as links that land on the right module (mirroring
// ERPNext's dynamic-link form control).
export const DOCTYPE_ROUTES: Record<string, string> = {
  "Payment Entry": "/payments",
  "Sales Invoice": "/invoices",
  "Purchase Invoice": "/invoices",
  "Journal Entry": "/journal-entries",
  "Sales Order": "/sales-orders",
  "Purchase Order": "/purchases",
  Quotation: "/quotations",
  "Delivery Note": "/invoices",
}