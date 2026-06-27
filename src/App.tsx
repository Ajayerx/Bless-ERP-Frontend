import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./context/AuthContext"
import AppLayout from "./components/layout/AppLayout"
import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Customers from "./pages/Customers"
import CustomerDetail from "./pages/CustomerDetail"
import Products from "./pages/Products"
import ProductDetail from "./pages/ProductDetail"
import Inventory from "./pages/Inventory"
import Warehouses from "./modules/inventory/pages/Warehouses"
import WarehouseDetail from "./modules/inventory/pages/WarehouseDetail"
import StockTransfers from "./modules/inventory/pages/StockTransfers"
import StockTransferDetail from "./modules/inventory/pages/StockTransferDetail"
import StockCounts from "./modules/inventory/pages/StockCounts"
import StockCountDetail from "./modules/inventory/pages/StockCountDetail"
import Invoices from "./pages/Invoices"
import InvoiceDetail from "./pages/InvoiceDetail"
import CreateInvoice from "./pages/CreateInvoice"
import Payments from "./pages/Payments"
import CreatePayment from "./pages/CreatePayment"
import PaymentDetail from "./pages/PaymentDetail"
import Reports from "./pages/Reports"
import Quotations from "./pages/Quotations"
import QuotationDetail from "./pages/QuotationDetail"
import CreateQuotation from "./pages/CreateQuotation"
import SalesOrders from "./pages/SalesOrders"
import SalesOrderDetail from "./pages/SalesOrderDetail"
import CreateSalesOrder from "./pages/CreateSalesOrder"
import Contacts from "./modules/crm/pages/Contacts"
import ContactDetail from "./modules/crm/pages/ContactDetail"
import Leads from "./modules/crm/pages/Leads"
import LeadDetail from "./modules/crm/pages/LeadDetail"
import Opportunities from "./modules/crm/pages/Opportunities"
import OpportunityDetail from "./modules/crm/pages/OpportunityDetail"
import FollowUps from "./modules/crm/pages/FollowUps"
import PurchaseOrders from "./modules/purchases/pages/PurchaseOrders"
import PurchaseOrderDetail from "./modules/purchases/pages/PurchaseOrderDetail"
import CreatePurchaseOrder from "./modules/purchases/pages/CreatePurchaseOrder"
import Expenses from "./modules/accounting/pages/Expenses"
import ExpenseDetail from "./modules/accounting/pages/ExpenseDetail"
import CreateExpense from "./modules/accounting/pages/CreateExpense"
import Taxes from "./modules/accounting/pages/Taxes"
import BankAccounts from "./modules/accounting/pages/BankAccounts"
import BankAccountDetail from "./modules/accounting/pages/BankAccountDetail"
import CreateBankAccount from "./modules/accounting/pages/CreateBankAccount"
import JournalEntries from "./modules/accounting/pages/JournalEntries"
import JournalEntryDetail from "./modules/accounting/pages/JournalEntryDetail"
import CreateJournalEntry from "./modules/accounting/pages/CreateJournalEntry"
import HrmsDashboard from "./modules/hrms/pages/HrmsDashboard"
import Employees from "./modules/hrms/employees/pages/Employees"
import EmployeeDetail from "./modules/hrms/employees/pages/EmployeeDetail"
import Attendance from "./modules/hrms/attendance/pages/Attendance"
import Payroll from "./modules/hrms/payroll/pages/Payroll"
import PayrollDetail from "./modules/hrms/payroll/pages/PayrollDetail"
import Leave from "./modules/hrms/leave/pages/Leave"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/warehouses" element={<Warehouses />} />
        <Route path="inventory/warehouses/:id" element={<WarehouseDetail />} />
        <Route path="inventory/transfers" element={<StockTransfers />} />
        <Route path="inventory/transfers/:id" element={<StockTransferDetail />} />
        <Route path="inventory/counts" element={<StockCounts />} />
        <Route path="inventory/counts/:id" element={<StockCountDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<CreateInvoice />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/create" element={<CreatePayment />} />
        <Route path="payments/:id" element={<PaymentDetail />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="quotations/new" element={<CreateQuotation />} />
        <Route path="quotations/:id" element={<QuotationDetail />} />
        <Route path="sales-orders" element={<SalesOrders />} />
        <Route path="sales-orders/new" element={<CreateSalesOrder />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetail />} />
        <Route path="crm/contacts" element={<Contacts />} />
        <Route path="crm/contacts/:id" element={<ContactDetail />} />
        <Route path="crm/leads" element={<Leads />} />
        <Route path="crm/leads/:id" element={<LeadDetail />} />
        <Route path="crm/opportunities" element={<Opportunities />} />
        <Route path="crm/opportunities/:id" element={<OpportunityDetail />} />
        <Route path="crm/follow-ups" element={<FollowUps />} />
        <Route path="accounting/expenses" element={<Expenses />} />
        <Route path="accounting/expenses/new" element={<CreateExpense />} />
        <Route path="accounting/expenses/:id" element={<ExpenseDetail />} />
        <Route path="accounting/taxes" element={<Taxes />} />
        <Route path="accounting/bank-accounts" element={<BankAccounts />} />
        <Route path="accounting/bank-accounts/new" element={<CreateBankAccount />} />
        <Route path="accounting/bank-accounts/:id" element={<BankAccountDetail />} />
        <Route path="accounting/journal-entries" element={<JournalEntries />} />
        <Route path="accounting/journal-entries/new" element={<CreateJournalEntry />} />
        <Route path="accounting/journal-entries/:id" element={<JournalEntryDetail />} />
        <Route path="purchases/orders" element={<PurchaseOrders />} />
        <Route path="purchases/orders/new" element={<CreatePurchaseOrder />} />
        <Route path="purchases/orders/:id" element={<PurchaseOrderDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="hrms" element={<HrmsDashboard />} />
        <Route path="hrms/employees" element={<Employees />} />
        <Route path="hrms/employees/:id" element={<EmployeeDetail />} />
        <Route path="hrms/attendance" element={<Attendance />} />
        <Route path="hrms/payroll" element={<Payroll />} />
        <Route path="hrms/payroll/:id" element={<PayrollDetail />} />
        <Route path="hrms/leave" element={<Leave />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
