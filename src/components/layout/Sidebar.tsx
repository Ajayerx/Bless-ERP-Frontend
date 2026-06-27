"use client"

import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  TrendingUp,
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
      { label: "Quotations", icon: FileText },
      { label: "Sales Orders", icon: ShoppingCart },
      { label: "Invoices", to: "/invoices", icon: Receipt },
      { label: "Payments", to: "/payments", icon: CreditCard },
    ],
  },
  {
    label: "Inventory",
    items: [
      { label: "Products", icon: Package },
      { label: "Warehouses", icon: Warehouse },
      { label: "Stock Transfer", icon: ArrowLeftRight },
      { label: "Stock Count", icon: ClipboardCheck },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", icon: Phone },
      { label: "Leads", icon: Target },
      { label: "Opportunities", icon: Zap },
      { label: "Follow Ups", icon: UserPlus },
    ],
  },
  {
    label: "Purchases",
    items: [
      { label: "Vendors", icon: ShoppingBag },
      { label: "Purchase Orders", icon: FileCheck },
      { label: "Bills", icon: Receipt },
    ],
  },
  {
    label: "Accounting",
    items: [
      { label: "Expenses", icon: Wallet },
      { label: "Taxes", icon: Landmark },
      { label: "Bank Accounts", icon: Banknote },
      { label: "Journal Entries", icon: BookOpen },
    ],
  },
  {
    label: "HRMS",
    items: [
      { label: "Employees", icon: Users2 },
      { label: "Attendance", icon: CalendarDays },
      { label: "Payroll", icon: DollarSign },
      { label: "Leave", icon: CalendarOff },
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
  const { logout, user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(
    navSections.map((s) => s.label)
  )

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label)
        ? prev.filter((l) => l !== label)
        : [...prev, label]
    )
  }

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
          <div className="w-9 h-9 rounded-[10px] bg-primary-600 flex items-center justify-center text-white font-bold text-sm mx-auto">
            B
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
              B
            </div>
            <span className="text-lg font-bold text-heading tracking-tight">
              BlessERP
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1">
        {navSections.map((section) => {
          const isExpanded = expandedSections.includes(section.label)
          const hasActiveChild = section.items.some((item) => isActive(item.to))

          return (
            <div key={section.label}>
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider hover:text-body transition-colors rounded-lg",
                    hasActiveChild && "text-primary-600"
                  )}
                >
                  {section.label}
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown size={12} />
                  </motion.div>
                </button>
              )}

              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-0.5 pb-1">
                      {section.items.map((item) => {
                        const active = isActive(item.to)
                        return (
                          <div key={item.label}>
                            {item.to ? (
                              <NavLink
                                to={item.to}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 group relative",
                                  active
                                    ? "bg-primary-50 text-primary-600"
                                    : "text-muted hover:bg-gray-100 hover:text-body"
                                )}
                              >
                                <item.icon
                                  size={18}
                                  className={cn(
                                    "shrink-0 transition-colors",
                                    active && "text-primary-600"
                                  )}
                                />
                                {!collapsed && (
                                  <>
                                    <span>{item.label}</span>
                                    {item.badge && (
                                      <span className="ml-auto bg-primary-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                        {item.badge}
                                      </span>
                                    )}
                                  </>
                                )}
                                {active && !collapsed && (
                                  <motion.div
                                    layoutId="sidebar-active"
                                    className="absolute inset-0 rounded-[10px] bg-primary-50 -z-10"
                                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                  />
                                )}
                              </NavLink>
                            ) : (
                              <div
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors cursor-not-allowed",
                                  "text-muted opacity-50"
                                )}
                                title="Coming soon"
                              >
                                <item.icon size={18} className="shrink-0" />
                                {!collapsed && (
                                  <span>{item.label}</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Bottom section */}
      <div className="border-t border-border p-3 space-y-0.5">
        <NavLink
          to="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-colors",
            isActive("/settings")
              ? "bg-primary-50 text-primary-600"
              : "text-muted hover:bg-gray-100 hover:text-body"
          )}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium text-muted hover:bg-danger-50 hover:text-danger-600 w-full transition-colors"
        >
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center text-muted hover:text-body shadow-sm transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  )
}
