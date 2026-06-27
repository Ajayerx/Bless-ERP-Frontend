import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { customerHandlers } from "./customers"
import { invoiceHandlers } from "./invoices"
import { paymentHandlers } from "./payments"
import { reportHandlers } from "./reports"
import { hrmsHandlers } from "./hrms"
import { inventoryHandlers } from "./inventory"
import { quotationHandlers } from "./quotations"
import { salesOrderHandlers } from "./sales-orders"
import { crmHandlers } from "./crm"
import { purchaseOrderHandlers } from "./purchases"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...customerHandlers,
  ...invoiceHandlers,
  ...paymentHandlers,
  ...reportHandlers,
  ...hrmsHandlers,
  ...inventoryHandlers,
  ...quotationHandlers,
  ...salesOrderHandlers,
  ...crmHandlers,
  ...purchaseOrderHandlers,
]
