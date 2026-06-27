"use client"

import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingCart,
  CreditCard,
  Package,
  Warehouse,
  ArrowLeftRight,
  ClipboardCheck,
  Phone,
  Target,
  Zap,
  UserPlus,
  ShoppingBag,
  FileCheck,
  Receipt,
  Wallet,
  Landmark,
  Banknote,
  BookOpen,
  Users2,
  CalendarDays,
  DollarSign,
  CalendarOff,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"

interface NavItem {
  label: string
  to?: string
  icon: LucideIcon
  badge?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: "Main",
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    label: "Sales",
    items: [
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Quotations", to: "/quotations", icon: FileText },
      { label: "Sales Orders", to: "/sales-orders", icon: ShoppingCart },
      { label: "Invoices", to: "/invoices", icon: Receipt },
      { label: "Payments", to: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Overview", to: "/inventory", icon: LayoutDashboard },
      { label: "Products", to: "/products", icon: Package },
      { label: "Warehouses", to: "/inventory/warehouses", icon: Warehouse },
      { label: "Stock Transfer", to: "/inventory/transfers", icon: ArrowLeftRight },
      { label: "Stock Count", to: "/inventory/counts", icon: ClipboardCheck },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", to: "/crm/contacts", icon: Phone },
      { label: "Leads", to: "/crm/leads", icon: Target },
      { label: "Opportunities", to: "/crm/opportunities", icon: Zap },
      { label: "Follow Ups", to: "/crm/follow-ups", icon: UserPlus },
    ],
  },
  {
    label: "Purchases",
    items: [
      { label: "Vendors", to: "/purchases/vendors", icon: ShoppingBag },
      { label: "Purchase Orders", to: "/purchases/orders", icon: FileCheck },
      { label: "Bills", to: "/purchases/bills", icon: Receipt },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Expenses", to: "/accounting/expenses", icon: Wallet },
      { label: "Taxes", to: "/accounting/taxes", icon: Landmark },
      { label: "Bank Accounts", to: "/accounting/bank-accounts", icon: Banknote },
      { label: "Journal Entries", to: "/accounting/journal-entries", icon: BookOpen },
    ],
  },
  {
    label: "HRMS",
    items: [
      { label: "Overview", to: "/hrms", icon: LayoutDashboard },
      { label: "Employees", to: "/hrms/employees", icon: Users2 },
      { label: "Attendance", to: "/hrms/attendance", icon: CalendarDays },
      { label: "Payroll", to: "/hrms/payroll", icon: DollarSign },
      { label: "Leave", to: "/hrms/leave", icon: CalendarOff },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Reports", to: "/reports", icon: BarChart3 },
      { label: "Settings", icon: Settings },
    ],
  },
]

export default function Sidebar() {
  const { logout } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (to?: string) => {
    if (!to) return false
    if (to === "/") return location.pathname === "/"
    return location.pathname.startsWith(to)
  }

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-border flex flex-col fixed left-0 top-0 z-30 transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        {collapsed ? (
          <div className="w-9 h-9 rounded-[10px] bg-primary-600 flex items-center justify-center text-white font-bold text-sm mx-auto shadow-sm">
            B
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              B
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-heading tracking-tight">
                BlessERP
              </span>
              <Sparkles size={14} className="text-primary-400" />
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-track]:transparent">
        {navSections.map((section, sectionIdx) => (
          <motion.div
            key={section.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIdx * 0.03, duration: 0.25 }}
          >
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.to)
                const content = (
                  <>
                    <item.icon
                      size={18}
                      className={cn(
                        "shrink-0 transition-colors",
                        active ? "text-primary-600" : "text-muted"
                      )}
                    />
                    {!collapsed && (
                      <span className="transition-colors">{item.label}</span>
                    )}
                  </>
                )

                if (item.to) {
                  return (
                    <NavLink
                      key={item.label}
                      to={item.to}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-all duration-150 relative",
                        active
                          ? "text-primary-600 bg-primary-50"
                          : "text-muted hover:bg-gray-100 hover:text-body"
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary-600 rounded-r-full" />
                      )}
                      <span className="flex items-center gap-3">{content}</span>
                    </NavLink>
                  )
                }

                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium text-muted"
                  >
                    {content}
                  </div>
                )
              })}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bottom section */}
      <div className="border-t border-border p-3 space-y-0.5 bg-sidebar">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors relative",
            isActive("/settings")
              ? "text-primary-600 bg-primary-50"
              : "text-muted hover:bg-gray-100 hover:text-body"
          )}
        >
          {isActive("/settings") && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary-600 rounded-r-full" />
          )}
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-sm font-medium text-muted hover:bg-danger-50 hover:text-danger-600 w-full transition-colors"
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[72px] w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-muted hover:text-body shadow-sm hover:shadow-md transition-all duration-200 z-10"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
