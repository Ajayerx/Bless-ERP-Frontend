import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  CreditCard,
  Package,
  Warehouse,
  ShoppingBag,
  Building2,
  ArrowLeftRight,
  ClipboardCheck,
  UserPlus,
  TrendingUp,
  Bell,
  Wallet,
  Truck,
  ShoppingCart,
  Landmark,
  Banknote,
  BookOpen,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { useSidebar } from "@/context/SidebarContext";

interface NavItem {
  label: string;
  to?: string;
  icon: LucideIcon;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "SALES",
    items: [
      { label: "Sales Orders", to: "/sales-orders", icon: ShoppingBag },
      { label: "Customers", to: "/customers", icon: Users },
      { label: "Invoices", to: "/invoices", icon: FileText },
      { label: "Payments", to: "/payments", icon: CreditCard },
      { label: "Quotations", to: "/quotations", icon: Receipt },
    ],
  },
  {
    label: "INVENTORY",
    items: [
      { label: "Products", to: "/products", icon: Package },
      { label: "Stock Levels", to: "/inventory", icon: Warehouse },
      { label: "Warehouses", to: "/inventory/warehouses", icon: Building2 },
      { label: "Stock Transfer", to: "/inventory/transfers", icon: ArrowLeftRight },
      { label: "Stock Count", to: "/inventory/counts", icon: ClipboardCheck },
    ],
  },
  {
    label: "CRM",
    items: [
      { label: "Contacts", to: "/contacts", icon: UserPlus },
      { label: "Opportunities", to: "/opportunities", icon: TrendingUp },
    ],
  },
  {
    label: "ACCOUNTING",
    items: [
      { label: "Expenses", to: "/expenses", icon: Wallet },
      { label: "Suppliers", to: "/suppliers", icon: Truck },
      { label: "Bills", to: "/bills", icon: Receipt },
      { label: "Purchases", to: "/purchases", icon: ShoppingCart },
      { label: "Taxes", to: "/taxes", icon: Landmark },
      { label: "Bank Accounts", to: "/bank-accounts", icon: Banknote },
      { label: "Journal Entries", to: "/journal-entries", icon: BookOpen },
    ],
  },
  {
    label: "REPORTS",
    items: [
      { label: "Sales Report", to: "/reports/sales", icon: BarChart3 },
      { label: "Accounts Receivable", to: "/reports/ar", icon: DollarSign },
      { label: "Inventory Report", to: "/reports/inventory", icon: Package },
      { label: "Profit & Loss", to: "/reports/profit-loss", icon: TrendingUp },
      { label: "Balance Sheet", to: "/reports/balance-sheet", icon: BookOpen },
      { label: "GST Summary", to: "/reports/gst", icon: Landmark },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { label: "Settings", to: "/settings", icon: Settings },
    ],
  },
];

// Renders tooltip at body level to avoid overflow clipping
function PortalTooltip({
  label,
  anchorEl,
}: {
  label: string;
  anchorEl: HTMLElement | null;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    setPos({
      top: rect.top + rect.height / 2,
      left: rect.right + 12,
    });
  }, [anchorEl]);

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, transform: "translateY(-50%)" }}
    >
      <div className="bg-gray-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-[8px] whitespace-nowrap shadow-lg">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        {label}
      </div>
    </div>,
    document.body,
  );
}

function NavItemWrapper({
  children,
  label,
  collapsed,
}: {
  children: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => collapsed && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
      <AnimatePresence>
        {collapsed && hovered && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.1 }}
          >
            <PortalTooltip label={label} anchorEl={ref.current} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function navLinkClass(active: boolean, collapsed: boolean) {
  return cn(
    "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 relative",
    collapsed && "justify-center px-2",
    active
      ? "bg-primary-50 text-primary-600"
      : "text-muted hover:bg-gray-100 hover:text-body",
  );
}

function iconClass(active: boolean) {
  return cn("shrink-0 transition-colors", active && "text-primary-600");
}

export default function Sidebar() {
  const { logout } = useAuth();
  const location = useLocation();
  const { collapsed, setCollapsed } = useSidebar();
  const [expandedSections, setExpandedSections] = useState<string[]>(
    navSections.map((s) => s.label),
  );

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  };

  const isActive = (to?: string) => {
    if (!to) return false;
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  const dashboardActive = isActive("/");

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-border flex flex-col fixed left-0 top-0 z-30 transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Header — B logo is the only toggle, no arrow */}
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "w-9 h-9 rounded-[10px] bg-primary-600 flex items-center justify-center text-white font-bold text-sm hover:bg-primary-700 active:scale-95 transition-all",
            !collapsed && "mr-3",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          B
        </button>

        {/* BlessERP text — only shown when expanded */}
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="text-lg font-bold text-heading tracking-tight whitespace-nowrap overflow-hidden"
            >
              BlessERP
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-1">
        {/* Dashboard — standalone at the top */}
        <NavItemWrapper label="Dashboard" collapsed={collapsed}>
          <NavLink
            to="/"
            className={navLinkClass(dashboardActive, collapsed)}
          >
            <LayoutDashboard size={18} className={iconClass(dashboardActive)} />
            {!collapsed && <span>Dashboard</span>}
            {dashboardActive && !collapsed && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-[10px] bg-primary-50 -z-10"
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 30,
                }}
              />
            )}
          </NavLink>
        </NavItemWrapper>

        {/* Sectioned nav items */}
        {navSections.map((section) => {
          const isExpanded = expandedSections.includes(section.label);

          // Find the best-matching route to avoid double-highlighting
          // (e.g., /inventory should not highlight when /inventory/warehouses is active)
          const matchingItems = section.items
            .filter((item) => item.to && (location.pathname === item.to || location.pathname.startsWith(item.to + "/")))
            .sort((a, b) => (b.to?.length ?? 0) - (a.to?.length ?? 0));
          const activeItemTo = matchingItems[0]?.to;
          const hasActiveChild = activeItemTo !== undefined;

          return (
            <div key={section.label}>
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1.5 text-xs font-semibold text-muted uppercase tracking-wider hover:text-body transition-colors rounded-lg",
                    hasActiveChild && "text-primary-600",
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
                {(isExpanded || collapsed) && (
                  <motion.div
                    initial={collapsed ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-visible"
                  >
                    <div className="space-y-0.5 pb-1">
                      {section.items.map((item) => {
                        const active = item.to === activeItemTo;

                        const baseClass = cn(
                          "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium transition-all duration-200 relative",
                          collapsed && "justify-center px-2",
                          active
                            ? "bg-primary-50 text-primary-600"
                            : "text-muted hover:bg-gray-100 hover:text-body",
                        );

                        const iconEl = (
                          <item.icon
                            size={18}
                            className={cn(
                              "shrink-0 transition-colors",
                              active && "text-primary-600",
                            )}
                          />
                        );

                        const inner = item.to ? (
                          <NavLink to={item.to} className={baseClass}>
                            {iconEl}
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
                                transition={{
                                  type: "spring",
                                  stiffness: 380,
                                  damping: 30,
                                }}
                              />
                            )}
                          </NavLink>
                        ) : (
                          <div
                            className={cn(
                              baseClass,
                              "cursor-not-allowed opacity-40",
                            )}
                          >
                            {iconEl}
                            {!collapsed && <span>{item.label}</span>}
                          </div>
                        );

                        return (
                          <NavItemWrapper
                            key={item.label}
                            label={item.label}
                            collapsed={collapsed}
                          >
                            {inner}
                          </NavItemWrapper>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Bottom: Logout only */}
      <div className="border-t border-border p-3 space-y-0.5">
        <NavItemWrapper label="Logout" collapsed={collapsed}>
          <button
            onClick={logout}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-[10px] text-sm font-medium text-muted hover:bg-danger-50 hover:text-danger-600 w-full transition-colors",
              collapsed && "justify-center px-2",
            )}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </button>
        </NavItemWrapper>
      </div>
    </aside>
  );
}
