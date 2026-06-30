import {
  FileText,
  UserPlus,
  Package,
  CreditCard,
  Wallet,
  ArrowLeftRight,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

const actions = [
  {
    label: "Create Invoice",
    icon: FileText,
    color: "#2563EB",
    to: "/invoices/new",
  },
  {
    label: "Add Customer",
    icon: UserPlus,
    color: "#16A34A",
    to: "/customers/new",
  },
  {
    label: "Add Product",
    icon: Package,
    color: "#F59E0B",
    to: "/products/new",
  },
  {
    label: "Record Payment",
    icon: CreditCard,
    color: "#7C3AED",
    to: "/payments",
  },
  {
    label: "Add Expense",
    icon: Wallet,
    color: "#E11D48",
    to: "/expenses/new",
  },
  {
    label: "Stock Transfer",
    icon: ArrowLeftRight,
    color: "#0D9488",
    to: "#",
  },
]

export default function QuickActionsBar() {
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => {
            if (action.to !== "#") navigate(action.to)
          }}
          className="flex items-center gap-3 px-4 py-3.5 bg-surface border border-border rounded-[12px] hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left"
        >
          <div
            className="w-10 h-10 rounded-[9px] flex items-center justify-center text-white shrink-0"
            style={{ backgroundColor: action.color }}
          >
            <action.icon size={16} />
          </div>
          <span className="text-sm font-semibold text-body leading-tight">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  )
}
