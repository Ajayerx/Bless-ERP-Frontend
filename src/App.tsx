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
import Invoices from "./pages/Invoices"
import InvoiceDetail from "./pages/InvoiceDetail"
import CreateInvoice from "./pages/CreateInvoice"
import Payments from "./pages/Payments"
import CreatePayment from "./pages/CreatePayment"
import PaymentDetail from "./pages/PaymentDetail"
import Reports from "./pages/Reports"
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
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<CreateInvoice />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="payments" element={<Payments />} />
        <Route path="payments/create" element={<CreatePayment />} />
        <Route path="payments/:id" element={<PaymentDetail />} />
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
