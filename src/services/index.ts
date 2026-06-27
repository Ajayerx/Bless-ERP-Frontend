export { authService } from "./auth.service"
export type { AuthService, AuthResponse, LoginRequest, User } from "./auth.service"
export { dashboardService } from "./dashboard.service"
export type {
  DashboardData,
  KpiMetric,
  SalesMonth,
  ActivityItem,
} from "./dashboard.service"
export { customerService } from "./customers.service"
export type {
  Customer,
  CustomerFormData,
  CustomerListResponse,
} from "./customers.service"
export { invoiceService } from "./invoices.service"
export type {
  Invoice,
  InvoiceFormData,
  InvoiceListResponse,
  LineItem,
  Product,
} from "./invoices.service"
export { paymentService } from "./payments.service"
export type {
  Payment,
  PaymentListResponse,
  RecordPaymentData,
} from "./payments.service"
export { reportService } from "./reports.service"
export type { TaxSummary, TaxBreakdownRow } from "./reports.service"
export { apiClient, ApiError } from "./api-client"
