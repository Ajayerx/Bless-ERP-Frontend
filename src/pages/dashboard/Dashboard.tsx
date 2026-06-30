"use client"

import { motion } from "framer-motion"
import {
  DollarSign,
  Users,
  Package,
  CreditCard,
  ChevronDown,
  CalendarDays,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui/skeleton"
import KpiCard from "@/components/ui/KpiCard"
import SalesOverviewChart from "@/modules/dashboard/SalesOverviewChart"
import RecentInvoicesCard from "@/modules/dashboard/RecentInvoicesCard"
import TopCustomersCard from "@/modules/dashboard/TopCustomersCard"
import InventoryAlertsCard from "@/modules/dashboard/InventoryAlertsCard"
import RecentPaymentsCard from "@/modules/dashboard/RecentPaymentsCard"
import QuickActionsBar from "@/modules/dashboard/QuickActionsBar"
import { useDashboard } from "@/hooks/useDashboard"
import { formatCurrency } from "@/lib/utils"

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
}

const kpiConfig = [
  {
    key: "totalRevenue" as const,
    title: "Total Revenue",
    icon: <DollarSign size={20} />,
    iconBgColor: "#2563EB",
    chartColor: "#2563EB",
    trendColor: "#2563EB",
  },
  {
    key: "accountsReceivable" as const,
    title: "Accounts Receivable",
    icon: <Users size={20} />,
    iconBgColor: "#16A34A",
    chartColor: "#16A34A",
    trendColor: "#16A34A",
  },
  {
    key: "inventoryValue" as const,
    title: "Inventory Value",
    icon: <Package size={20} />,
    iconBgColor: "#F59E0B",
    chartColor: "#F59E0B",
    trendColor: "#F59E0B",
  },
  {
    key: "cashFlow" as const,
    title: "Cash Flow",
    icon: <CreditCard size={20} />,
    iconBgColor: "#7C3AED",
    chartColor: "#7C3AED",
    trendColor: "#7C3AED",
  },
]

export default function Dashboard() {
  const { data, loading } = useDashboard()

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-72" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-[16px]" />
            ))}
          </div>
          <Skeleton className="h-[400px] rounded-[16px]" />
          <div className="grid grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-[16px]" />
            ))}
          </div>
        </div>
      </>
    )
  }

  const kpis = data?.kpis

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Header */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-heading">
              Welcome back, Joseph 👋
            </h1>
            <p className="text-sm text-muted mt-1">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-[12px] text-sm font-semibold text-body hover:bg-gray-50 transition-colors shadow-sm">
            <CalendarDays size={16} className="text-muted" />
            May 12 – May 18, 2024
            <ChevronDown size={14} className="text-muted" />
          </button>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {kpiConfig.map((cfg) => {
            const metric = kpis?.[cfg.key]
            return (
              <KpiCard
                key={cfg.key}
                title={cfg.title}
                value={metric ? formatCurrency(metric.value) : "$0"}
                trend={metric?.trend ?? 0}
                icon={cfg.icon}
                iconBgColor={cfg.iconBgColor}
                chartColor={cfg.chartColor}
                trendColor={cfg.trendColor}
                sparkline={metric?.sparkline ?? []}
              />
            )
          })}
        </motion.div>

        {/* Middle: Sales Overview + Recent Invoices */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          <SalesOverviewChart data={data?.salesChart ?? []} />
          <RecentInvoicesCard data={data?.recentInvoices ?? []} />
        </motion.div>

        {/* Bottom: Top Customers + Inventory Alerts + Recent Payments */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <TopCustomersCard data={data?.topCustomers ?? []} />
          <InventoryAlertsCard data={data?.inventoryAlerts ?? []} />
          <RecentPaymentsCard data={data?.recentPayments ?? []} />
        </motion.div>

        {/* Quick Actions */}
        <motion.div variants={itemVariants}>
          <QuickActionsBar />
        </motion.div>
      </motion.div>
    </>
  )
}
