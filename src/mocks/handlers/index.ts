import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { customerHandlers } from "./customers"
import { invoiceHandlers } from "./invoices"
import { paymentHandlers } from "./payments"
import { reportHandlers } from "./reports"
import { hrmsHandlers } from "./hrms"
import { inventoryHandlers } from "./inventory"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...customerHandlers,
  ...invoiceHandlers,
  ...paymentHandlers,
  ...reportHandlers,
  ...hrmsHandlers,
  ...inventoryHandlers,
]
