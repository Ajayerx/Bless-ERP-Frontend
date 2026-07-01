import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { customerHandlers } from "./customers"
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
import { quotationHandlers } from "./quotations"
import { contactHandlers } from "./contacts"
import { opportunityHandlers } from "./opportunities"
import { settingsHandlers } from "./settings"
import { purchaseOrderHandlers } from "./purchase_orders"
import { inventoryHandlers } from "./inventory"
import { hrmsHandlers } from "./hrms"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...customerHandlers,
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
  ...quotationHandlers,
  ...contactHandlers,
  ...opportunityHandlers,
  ...settingsHandlers,
  ...purchaseOrderHandlers,
  ...inventoryHandlers,
  ...hrmsHandlers,
]
