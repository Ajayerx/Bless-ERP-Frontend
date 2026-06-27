import { authHandlers } from "./auth"
import { dashboardHandlers } from "./dashboard"
import { customerHandlers } from "./customers"
import { invoiceHandlers } from "./invoices"
import { paymentHandlers } from "./payments"
import { reportHandlers } from "./reports"

export const handlers = [
  ...authHandlers,
  ...dashboardHandlers,
  ...customerHandlers,
  ...invoiceHandlers,
  ...paymentHandlers,
  ...reportHandlers,
]
