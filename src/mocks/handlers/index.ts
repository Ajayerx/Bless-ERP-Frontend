import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { invoiceHandlers } from "./invoices"
import { paymentHandlers } from "./payments"
import { reportHandlers } from "./reports"
import { productsHandlers } from "./products"
import { supplierHandlers } from "./suppliers"
import { expenseHandlers } from "./expenses"
import { billHandlers } from "./bills"
import { bankAccountHandlers } from "./bank_accounts"
import { journalEntryHandlers } from "./journal_entries"
import { salesOrderHandlers } from "./sales_orders"
import { salesOrderListHandlers } from "./sales-orders-list"
import { salesOrderFormHandlers } from "./sales-orders-form"
import { quotationHandlers } from "./quotations"
import { contactHandlers } from "./contacts"
import { opportunityHandlers } from "./opportunities"
import { settingsHandlers } from "./settings"
import { purchaseOrderHandlers } from "./purchase_orders"
import { notificationHandlers } from "./notifications"
import { hrmsHandlers } from "./hrms"
import { frappeAuthHandlers } from "./frappe-auth"
import { frappeSettingsHandlers } from "./frappe-settings"
import { frappeCustomerHandlers } from "./frappe-customers"
import { frappeClientHandlers } from "./frappe-client"
import { frappeLookupHandlers } from "./frappe-lookups"
import { activityHandlers } from "./activity"
import { invoiceMakeHandlers } from "./invoice-make"
import { getItemsHandlers } from "./get-items"
import { reconciliationHandlers } from "./reconciliation"
import { bankReconciliationHandlers } from "./bank_reconciliation"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...productsHandlers,
  ...paymentHandlers,
  ...invoiceHandlers,
  ...reportHandlers,
  ...supplierHandlers,
  ...expenseHandlers,
  ...billHandlers,
  ...bankAccountHandlers,
  ...journalEntryHandlers,
  ...salesOrderHandlers,
  ...salesOrderListHandlers,
  ...salesOrderFormHandlers,
  ...quotationHandlers,
  ...contactHandlers,
  ...opportunityHandlers,
  ...settingsHandlers,
  ...purchaseOrderHandlers,
  ...hrmsHandlers,
  ...notificationHandlers,
  // Reconciliation (method + Bank Transaction resource) — before the generic
  // /api/resource catch-all so Bank Transaction isn't swallowed by lookups.
  ...reconciliationHandlers,
  ...bankReconciliationHandlers,
  // Frappe REST handlers — more specific first, wildcard last
  ...frappeAuthHandlers,
  ...frappeSettingsHandlers,
  ...frappeCustomerHandlers,
  ...frappeClientHandlers,
  ...frappeLookupHandlers,
  ...activityHandlers,
  ...invoiceMakeHandlers,
  ...getItemsHandlers,
]
