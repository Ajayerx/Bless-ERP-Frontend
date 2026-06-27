"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  FileText,
  Plus,
  UserPlus,
  ShoppingCart,
  ArrowLeftRight,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Ban,
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { dashboardService, invoiceService } from "@/services"
import type { DashboardData, Invoice } from "@/services"
import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils"

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
}

function MiniSparkline({ data, color }: { data: { value: number }[]; color: string }) {
  return (
    <ResponsiveContainer width={80} height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

const statusConfig: Record<string, { variant: "success" | "warning" | "danger" | "info"; icon: React.ReactNode }> = {
  paid: { variant: "success", icon: <CheckCircle2 size={14} /> },
  sent: { variant: "info", icon: <Clock size={14} /> },
  overdue: { variant: "danger", icon: <AlertTriangle size={14} /> },
  cancelled: { variant: "default", icon: <Ban size={14} /> },
  draft: { variant: "warning", icon: <FileText size={14} /> },
}

const quickActions = [
  { label: "Create Invoice", icon: FileText, color: "text-primary-600 bg-primary-50", to: "/invoices/new" },
  { label: "Add Customer", icon: UserPlus, color: "text-purple-600 bg-purple-50", to: "/customers" },
  { label: "Add Product", icon: Package, color: "text-success-600 bg-success-50", to: "/products" },
  { label: "Transfer Stock", icon: ArrowLeftRight, color: "text-info-600 bg-info-50", to: "#" },
  { label: "Record Payment", icon: CreditCard, color: "text-warning-600 bg-warning-50", to: "/payments" },
]

export default function Dashboard() {
  const [dashData, setDashData] = useState<DashboardData | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardService.get(),
      invoiceService.list({ page: 1, pageSize: 5 }),
    ])
      .then(([dash, inv]) => {
        setDashData(dash)
        setInvoices(inv.items)
      })
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-[16px]" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-[16px]" />
        </div>
      </>
    )
  }

  const kpis = dashData?.kpis
  const sparklineData = [
    { value: 280 }, { value: 310 }, { value: 265 },
    { value: 340 }, { value: 380 }, { value: 410 },
  ]

  const kpiCards = [
    {
      title: "Total Revenue",
      value: kpis?.totalRevenue ? formatCurrency(kpis.totalRevenue.value) : "$0",
      change: kpis?.totalRevenue.trend ?? 0,
      up: (kpis?.totalRevenue.trendDirection ?? "up") === "up",
      icon: DollarSign,
      color: "text-primary-600",
      bg: "bg-primary-50",
      chartColor: "#2563eb",
    },
    {
      title: "Receivables",
      value: kpis?.outstandingInvoices ? formatCurrency(kpis.outstandingInvoices.value) : "$0",
      change: Math.abs(kpis?.outstandingInvoices.trend ?? 0),
      up: (kpis?.outstandingInvoices.trendDirection ?? "down") === "down",
      icon: TrendingDown,
      color: "text-warning-600",
      bg: "bg-warning-50",
      chartColor: "#f59e0b",
    },
    {
      title: "Inventory Value",
      value: "$178,420",
      change: 3.2,
      up: true,
      icon: Package,
      color: "text-purple-600",
      bg: "bg-purple-50",
      chartColor: "#8b5cf6",
    },
    {
      title: "Cash Flow",
      value: "$42,680",
      change: 8.7,
      up: true,
      icon: TrendingUp,
      color: "text-success-600",
      bg: "bg-success-50",
      chartColor: "#22c55e",
    },
  ]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Welcome Section */}
        <motion.div
          variants={itemVariants}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold text-heading">Welcome back</h1>
            <p className="text-sm text-muted mt-1">{today}</p>
          </div>
          <button className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-[12px] hover:bg-primary-700 transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]">
            <Plus size={18} />
            New Invoice
          </button>
        </motion.div>

        {/* KPI Cards */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
        >
          {kpiCards.map((kpi) => (
            <motion.div
              key={kpi.title}
              whileHover={{ y: -4, boxShadow: "0px 8px 25px rgba(0,0,0,0.08)" }}
              className="bg-surface rounded-[16px] border border-border shadow-card p-5 transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={cn("p-2.5 rounded-[10px]", kpi.bg, kpi.color)}>
                  <kpi.icon size={20} />
                </div>
                <MiniSparkline data={sparklineData} color={kpi.chartColor} />
              </div>
              <p className="text-2xl font-bold text-heading tracking-tight">
                {kpi.value}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full",
                    kpi.up
                      ? "text-success-600 bg-success-50"
                      : "text-danger-600 bg-danger-50"
                  )}
                >
                  {kpi.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {kpi.change}%
                </span>
                <span className="text-xs text-muted">vs last month</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Charts Row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          {/* Sales Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
              <div className="flex items-center gap-2">
                {["Weekly", "Monthly", "Yearly"].map((period) => (
                  <button
                    key={period}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-[8px] transition-colors",
                      period === "Monthly"
                        ? "bg-primary-600 text-white"
                        : "text-muted hover:bg-gray-100"
                    )}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dashData?.salesOverTime ?? []}
                    margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        boxShadow: "0px 4px 12px rgba(0,0,0,0.08)",
                        padding: "8px 12px",
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      fill="url(#revenueGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <button className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
                View All <ArrowRight size={12} />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {invoices.slice(0, 5).map((inv) => {
                  const cfg = statusConfig[inv.status] ?? { variant: "default" as const, icon: <FileText size={14} /> }
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-heading">{inv.number}</p>
                        <p className="text-xs text-muted mt-0.5">{inv.customerName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-heading tabular-nums">
                          {formatCurrency(inv.total)}
                        </span>
                        <Badge variant={cfg.variant} className="gap-1">
                          {cfg.icon}
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Row */}
        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 lg:grid-cols-3 gap-5"
        >
          {/* Top Customers */}
          <Card>
            <CardHeader>
              <CardTitle>Top Customers</CardTitle>
              <button className="text-xs font-semibold text-primary-600 hover:text-primary-700">
                View All
              </button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  { name: "Acme Corp", revenue: 2879.63, initials: "AC" },
                  { name: "Delta Export Group", revenue: 8778.00, initials: "DE" },
                  { name: "Maple Leaf Industries", revenue: 7964.25, initials: "ML" },
                  { name: "Crown Royal Packaging", revenue: 6886.95, initials: "CR" },
                  { name: "Prairie Grain Co.", revenue: 6814.50, initials: "PG" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-[10px] bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                      {c.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-heading">{c.name}</p>
                    </div>
                    <span className="text-sm font-semibold text-heading tabular-nums">
                      {formatCurrency(c.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Inventory Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Alerts</CardTitle>
              <Badge variant="danger">3 low stock</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {[
                  { name: "Widget Pro", sku: "WP-100", stock: 3, threshold: 10 },
                  { name: "Welding Cable 2/0 50ft", sku: "WC-1000", stock: 8, threshold: 15 },
                  { name: "Stainless Steel Sheet", sku: "SS-1200", stock: 25, threshold: 30 },
                ].map((item) => (
                  <div key={item.sku} className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-[10px] bg-danger-50 text-danger-600 flex items-center justify-center">
                      <Package size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-heading">{item.name}</p>
                      <p className="text-xs text-muted">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold", item.stock < 10 ? "text-danger-600" : "text-warning-600")}>
                        {item.stock} units
                      </p>
                      <p className="text-xs text-muted">min: {item.threshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    className="flex flex-col items-center gap-2 p-4 rounded-[14px] border border-border hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 bg-surface"
                  >
                    <div className={cn("p-3 rounded-[10px]", action.color)}>
                      <action.icon size={20} />
                    </div>
                    <span className="text-xs font-semibold text-body text-center leading-tight">
                      {action.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </>
  )
}
