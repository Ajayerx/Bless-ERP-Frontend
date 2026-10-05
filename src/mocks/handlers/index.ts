import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { invoiceHandlers } from "./invoices"
import { paymentHandlers } from "./payments"
import { reportHandlers } from "./reports"
import { productsHandlers } from "./products"
import { frappeBankAccountHandlers } from "./frappe-bank-accounts"
import { journalEntryHandlers } from "./journal-entry"
import { salesOrderHandlers } from "./sales_orders"
import { salesOrderListHandlers } from "./sales-orders-list"
import { salesOrderFormHandlers } from "./sales-orders-form"
import { quotationHandlers } from "./quotations"
import { contactHandlers } from "./contacts"
import { opportunityHandlers } from "./opportunities"
import { settingsHandlers } from "./settings"
import { purchaseOrderHandlers } from "./purchase-order"
import { purchaseInvoiceHandlers } from "./purchase-invoice"
import { notificationHandlers } from "./notifications"
import { hrmsHandlers } from "./hrms"
import { frappeAuthHandlers } from "./frappe-auth"
import { frappeSettingsHandlers } from "./frappe-settings"
import { frappeCustomerHandlers } from "./frappe-customers"
import { frappeSupplierHandlers } from "./frappe-suppliers"
import { frappeClientHandlers } from "./frappe-client"
import { frappeLookupHandlers } from "./frappe-lookups"
import { activityHandlers } from "./activity"
import { invoiceMakeHandlers } from "./invoice-make"
import { getItemsHandlers } from "./get-items"
import { reconciliationHandlers } from "./reconciliation"
import { bankReconciliationHandlers } from "./bank_reconciliation"
import { emailTemplateHandlers } from "./email-templates"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...productsHandlers,
  ...paymentHandlers,
  ...invoiceHandlers,
  ...reportHandlers,
  ...frappeBankAccountHandlers,
  ...journalEntryHandlers,
  ...salesOrderHandlers,
  ...salesOrderListHandlers,
  ...salesOrderFormHandlers,
  ...quotationHandlers,
  ...contactHandlers,
  ...opportunityHandlers,
  ...settingsHandlers,
  ...purchaseOrderHandlers,
  ...purchaseInvoiceHandlers,
  ...hrmsHandlers,
  ...notificationHandlers,
  // Reconciliation (method + Bank Transaction resource) — before the generic
  // /api/resource catch-all so Bank Transaction isn't swallowed by lookups.
  ...reconciliationHandlers,
  ...bankReconciliationHandlers,
  // Email Template CRUD + get_email_template — before frappeLookupHandlers, whose
  // /api/resource wildcard would otherwise swallow the Email Template resource.
  ...emailTemplateHandlers,
  // Frappe REST handlers — more specific first, wildcard last
  ...frappeAuthHandlers,
  ...frappeSettingsHandlers,
  ...frappeCustomerHandlers,
  ...frappeSupplierHandlers,
  ...frappeClientHandlers,
  ...frappeLookupHandlers,
  ...activityHandlers,
  ...invoiceMakeHandlers,
  ...getItemsHandlers,
]
