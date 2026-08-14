// Infrastructure
export { apiClient, ApiError } from "./api-client"
export { authService } from "./auth.service"
export type { AuthService, User } from "./auth.service"
export type { TaxTemplateResult, TaxRow } from "./tax-template"
export {
  getValue,
  getAccountingDimensions,
} from "./frappe-client"
export type {
  LinkValidationResult,
  AccountingDimension,
  AccountingDimensionsResult,
  CompanyFetchFields,
} from "./frappe-client"

// Module re-exports
export { dashboardService } from "@/modules/dashboard/services"
export type { DashboardData, KpiMetric, SalesDay, RecentInvoice, TopCustomer, InventoryAlert, RecentPayment, TodaySales, LowStockItem, CustomerActivity } from "@/modules/dashboard/services"
export { todoService } from "@/modules/dashboard/services/todo.service"
export type { TodoItem } from "@/modules/dashboard/services/todo.service"
export { notificationService, timeAgo } from "@/modules/dashboard/services/notification.service"
export type { NotificationItem } from "@/modules/dashboard/services/notification.service"
export { eventService } from "@/modules/dashboard/services/event.service"
export type { CalendarEvent } from "@/modules/dashboard/services/event.service"

export { customerService, fetchFieldOptions, searchLink, validateLink, getPartyDetails } from "@/modules/customers/services"
export type {
  Customer, CustomerFormData, CustomerListResponse, CustomerDetail, TransactionCounts,
  AddressInput, AllowedCompanyRow, CreditLimitRow, PartyAccountRow, SalesTeamRow, PortalUserRow, SupplierNumberRow,
} from "@/modules/customers/services"

export { invoiceService, templateRowsToEditable, invoiceTaxesToEditable, erpnextTaxesToEditable, computeTaxes, computeTotalForDiscountAmount, createEmptyTaxRow, formatExchangeRateError } from "@/modules/invoices/services"
export type { SalesInvoice, SalesInvoiceFormData, SalesInvoiceItem, SalesInvoiceTax, SalesInvoiceListResponse, EditableTaxRow, ChargeType, AccountInfo, PartyDetailsResponse } from "@/modules/invoices/services"

export { paymentService, allocateAmountToReferences, savePaymentRaw, setMatchedPaymentRequests, buildTimelineItems, 
fieldLabel } from "@/modules/payments/services"
export type { PaymentEntry, PaymentEntryListResponse, RecordPaymentData, InvoiceAllocation, PaymentDeductionForm, LedgerPreviewData, LedgerPreviewColumn, PaymentComment, PaymentActivityItem, ActivityMessageSegment, ReferenceDetails, PaymentEntryDocSnapshot, UnreconcileAllocation, PaymentAfterSaveResult, VersionDoc } from "@/modules/payments/services"

export { reportService } from "@/modules/reports/services"
export type { TaxSummary, TaxBreakdownRow, TaxTransactionRow, TaxSideSummary, NetRemittance, SalesReport, ARReport, InventoryReport, ProfitLoss, BalanceSheet, GeneralLedgerColumn, GeneralLedgerRow, GeneralLedgerFilters, GeneralLedgerReport } from "@/modules/reports/services"

export { productService } from "@/modules/products/services"
export type {
  Product, Product as ProductItem, ProductDetail, ProductListResponse,
  ProductListParams, ProductFormData, WarehouseStock,
} from "@/modules/products/services"

export { supplierService } from "@/modules/suppliers/services"
export type { Supplier, SupplierFormData, SupplierListResponse } from "@/modules/suppliers/services"

export { expenseService } from "@/modules/expenses/services"
export type { Expense, ExpenseFormData, ExpenseListResponse } from "@/modules/expenses/services"

export { billService } from "@/modules/bills/services"
export type { Bill, BillListResponse, BillFormData } from "@/modules/bills/services"

export { bankAccountService } from "@/modules/bank_accounts/services"
export type { BankAccount, BankAccountListResponse, BankAccountFormData } from "@/modules/bank_accounts/services"

export { journalEntryService } from "@/modules/journal_entries/services"
export type { JournalEntry, JournalEntryListResponse, JournalEntryFormData } from "@/modules/journal_entries/services"

export { salesOrderService } from "@/modules/sales-orders/services"
export type { SalesOrder, SalesOrderItem, SalesOrderListResponse } from "@/modules/sales-orders/services"

export { quotationService } from "@/modules/quotations/services"
export type { Quotation, QuotationItem, QuotationFormData, QuotationListResponse } from "@/modules/quotations/services"

export { contactService } from "@/modules/contacts/services"
export type { Contact, ContactListResponse, ContactFormData } from "@/modules/contacts/services"

export { opportunityService } from "@/modules/opportunities/services"
export type { Opportunity, OpportunityFormData, OpportunityListResponse } from "@/modules/opportunities/services"

export { settingsService } from "@/modules/settings/services"
export type { Settings, CompanyInfo, TaxConfig, AppDefaults, AppUser, UserProfile, NotificationPreferences, SecuritySettings, AppearanceSettings } from "@/modules/settings/services"

export { purchaseOrderService } from "@/modules/purchases/services"
export type { PurchaseOrder, PurchaseOrderListResponse, PurchaseOrderFormData } from "@/modules/purchases/services"

export { vendorService } from "@/modules/vendors/services"
export type { Vendor, VendorFormData, VendorListResponse } from "@/modules/vendors/services"

export { leadService } from "@/modules/leads/services"
export type { Lead, LeadFormData, LeadListResponse } from "@/modules/leads/services"

export { followUpService } from "@/modules/followups/services"
export type { FollowUp, FollowUpListResponse } from "@/modules/followups/services"

export { accountingService } from "@/modules/accounting/services"
