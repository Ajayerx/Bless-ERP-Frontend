export { authService } from "./auth.service"
export type { AuthService, AuthResponse, LoginRequest, User } from "./auth.service"
export { dashboardService } from "./dashboard.service"
export type {
  DashboardData,
  KpiMetric,
  SalesMonth,
  ActivityItem,
  TopCustomer,
  InventoryAlert,
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
} from "./invoices.service"
export { paymentService } from "./payments.service"
export type {
  Payment,
  PaymentListResponse,
  RecordPaymentData,
} from "./payments.service"
export { reportService } from "./reports.service"
export type { TaxSummary, TaxBreakdownRow, SalesSummary, StockReport, StockReportItem } from "./reports.service"
export { productService } from "./products.service"
export type { Product, ProductListResponse } from "./products.service"
export { quotationService } from "./quotations.service"
export type { Quotation, QuotationListResponse, QuotationFormData } from "./quotations.service"
export { salesOrderService } from "./sales-orders.service"
export type { SalesOrder, SalesOrderListResponse, SalesOrderFormData } from "./sales-orders.service"
export { apiClient, ApiError } from "./api-client"
