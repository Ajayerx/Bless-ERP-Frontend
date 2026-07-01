import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import AppLayout from "./components/layout/AppLayout";
import { Login } from "./pages/auth";
import { Dashboard } from "./pages/dashboard";
import { Customers, NewCustomer, CustomerDetail, EditCustomer } from "./pages/customers";
import { Products, NewProduct, ProductDetail, EditProduct } from "./pages/products";
import { Invoices, InvoiceDetail, CreateInvoice, EditInvoice } from "./pages/invoices";
import { Payments, PaymentDetail } from "./pages/payments";
import { SalesReportPage, ARReportPage, InventoryReportPage, ProfitLossPage, BalanceSheetPage, GSTSummaryPage } from "./pages/reports";
import { Expenses, NewExpense, ExpenseDetail, EditExpense } from "./pages/expenses";
import { Suppliers, NewSupplier, SupplierDetail, EditSupplier } from "./pages/suppliers";
import { Bills, BillDetail, CreateBill, EditBill } from "./pages/bills";
import { Purchases, PurchaseDetail, CreatePurchaseOrder, EditPurchaseOrder } from "./pages/purchases";
import { Quotations, NewQuotation, QuotationDetail, EditQuotation } from "./pages/quotations";
import { SalesOrders, SalesOrderDetail } from "./pages/sales-orders";
import { Taxes } from "./pages/taxes";
import { Settings } from "./pages/settings";
import { Contacts, NewContact, ContactDetail, EditContact } from "./pages/contacts";
import { Opportunities, NewOpportunity, OpportunityDetail, EditOpportunity } from "./pages/opportunities";
import { BankAccounts, NewBankAccount, BankAccountDetail, EditBankAccount } from "./pages/bank-accounts";
import { JournalEntries, NewJournalEntry, JournalEntryDetail, EditJournalEntry } from "./pages/journal-entries";
import {
  StockLevels,
  Warehouses,
  WarehouseDetail,
  NewWarehouse,
  EditWarehouse,
  StockTransfers,
  StockTransferDetail,
  NewStockTransfer,
  StockCounts,
  StockCountDetail,
  NewStockCount,
} from "./pages/inventory";
import HrmsDashboard from "./modules/hrms/pages/HrmsDashboard";
import Employees from "./modules/hrms/employees/pages/Employees";
import EmployeeDetail from "./modules/hrms/employees/pages/EmployeeDetail";
import Attendance from "./modules/hrms/attendance/pages/Attendance";
import Leave from "./modules/hrms/leave/pages/Leave";
import Payroll from "./modules/hrms/payroll/pages/Payroll";
import PayrollDetail from "./modules/hrms/payroll/pages/PayrollDetail";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuth();

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
            <ErrorBoundary>
              <AppLayout />
            </ErrorBoundary>
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/new" element={<NewCustomer />} />
        <Route path="customers/:id" element={<CustomerDetail />} />
        <Route path="customers/:id/edit" element={<EditCustomer />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<NewProduct />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="products/:id/edit" element={<EditProduct />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<CreateInvoice />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<EditInvoice />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/:id" element={<PaymentDetail />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="quotations/new" element={<NewQuotation />} />
        <Route path="quotations/:id" element={<QuotationDetail />} />
        <Route path="quotations/:id/edit" element={<EditQuotation />} />
        <Route path="sales-orders" element={<SalesOrders />} />
        <Route path="sales-orders/:id" element={<SalesOrderDetail />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="suppliers/new" element={<NewSupplier />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="suppliers/:id/edit" element={<EditSupplier />} />
        <Route path="bills" element={<Bills />} />
        <Route path="bills/new" element={<CreateBill />} />
        <Route path="bills/:id" element={<BillDetail />} />
        <Route path="bills/:id/edit" element={<EditBill />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="purchases/new" element={<CreatePurchaseOrder />} />
        <Route path="purchases/:id" element={<PurchaseDetail />} />
        <Route path="purchases/:id/edit" element={<EditPurchaseOrder />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expenses/new" element={<NewExpense />} />
        <Route path="expenses/:id" element={<ExpenseDetail />} />
        <Route path="expenses/:id/edit" element={<EditExpense />} />
        <Route path="taxes" element={<Taxes />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="contacts/new" element={<NewContact />} />
        <Route path="contacts/:id" element={<ContactDetail />} />
        <Route path="contacts/:id/edit" element={<EditContact />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="opportunities/new" element={<NewOpportunity />} />
        <Route path="opportunities/:id" element={<OpportunityDetail />} />
        <Route path="opportunities/:id/edit" element={<EditOpportunity />} />
        <Route path="bank-accounts" element={<BankAccounts />} />
        <Route path="bank-accounts/new" element={<NewBankAccount />} />
        <Route path="bank-accounts/:id" element={<BankAccountDetail />} />
        <Route path="bank-accounts/:id/edit" element={<EditBankAccount />} />
        <Route path="journal-entries" element={<JournalEntries />} />
        <Route path="journal-entries/new" element={<NewJournalEntry />} />
        <Route path="journal-entries/:id" element={<JournalEntryDetail />} />
        <Route path="journal-entries/:id/edit" element={<EditJournalEntry />} />
        <Route path="inventory" element={<StockLevels />} />
        <Route path="inventory/warehouses" element={<Warehouses />} />
        <Route path="inventory/warehouses/new" element={<NewWarehouse />} />
        <Route path="inventory/warehouses/:id" element={<WarehouseDetail />} />
        <Route path="inventory/warehouses/:id/edit" element={<EditWarehouse />} />
        <Route path="inventory/transfers" element={<StockTransfers />} />
        <Route path="inventory/transfers/new" element={<NewStockTransfer />} />
        <Route path="inventory/transfers/:id" element={<StockTransferDetail />} />
        <Route path="inventory/counts" element={<StockCounts />} />
        <Route path="inventory/counts/new" element={<NewStockCount />} />
        <Route path="inventory/counts/:id" element={<StockCountDetail />} />
        <Route path="hrms" element={<HrmsDashboard />} />
        <Route path="hrms/employees" element={<Employees />} />
        <Route path="hrms/employees/:id" element={<EmployeeDetail />} />
        <Route path="hrms/attendance" element={<Attendance />} />
        <Route path="hrms/leave" element={<Leave />} />
        <Route path="hrms/payroll" element={<Payroll />} />
        <Route path="hrms/payroll/:id" element={<PayrollDetail />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reports/sales" element={<SalesReportPage />} />
        <Route path="reports/ar" element={<ARReportPage />} />
        <Route path="reports/inventory" element={<InventoryReportPage />} />
        <Route path="reports/profit-loss" element={<ProfitLossPage />} />
        <Route path="reports/balance-sheet" element={<BalanceSheetPage />} />
        <Route path="reports/gst" element={<GSTSummaryPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
