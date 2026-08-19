"use client"

import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable"
import {
  DollarSign,
  Users,
  Package,
  CreditCard,
  SlidersHorizontal,
} from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Skeleton } from "@/components/ui/skeleton"
import KpiCard from "@/components/ui/KpiCard"
import SalesOverviewChart from "../components/SalesOverviewChart"
import RecentInvoicesCard from "../components/RecentInvoicesCard"
import TopCustomersCard from "../components/TopCustomersCard"
import InventoryAlertsCard from "../components/InventoryAlertsCard"
import RecentPaymentsCard from "../components/RecentPaymentsCard"
import QuickActionsBar from "../components/QuickActionsBar"
import PendingOrdersWidget from "../components/PendingOrdersWidget"
import LowStockWidget from "../components/LowStockWidget"
import TasksWidget from "../components/TasksWidget"
import CalendarWidget from "../components/CalendarWidget"
import NotificationsWidget from "../components/NotificationsWidget"
import CustomerActivitiesWidget from "../components/CustomerActivitiesWidget"
import SortableWidget from "../components/SortableWidget"
import { useDashboard } from "../hooks/useDashboard"
import DateRangeSelector, { type DatePreset, presetLabels } from "../components/DateRangeSelector"
import WidgetSettingsPanel from "../components/WidgetSettingsPanel"
import { useDashboardWidgets } from "../hooks/useDashboardWidgets"
import { useKpiVisibility } from "../hooks/useKpiVisibility"
import { useAuth } from "@/context/AuthContext"
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
  {
    key: "todaySales" as const,
    title: "Today's Sales",
    icon: <DollarSign size={20} />,
    iconBgColor: "#0891B2",
    chartColor: "#0891B2",
    trendColor: "#0891B2",
  },
]

export default function Dashboard() {
  const [datePreset, setDatePreset] = useState<DatePreset>("this_week")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [widgetSettingsOpen, setWidgetSettingsOpen] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const { data, loading } = useDashboard(startDate, endDate)
  const { user } = useAuth()
  const { orderedWidgets, isVisible, toggleWidget, reorderWidgets, resetWidgets, getWidgetSize, availableWidgets } = useDashboardWidgets()
  const { isKpiVisible, toggleKpi } = useKpiVisibility()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  )

  const handleDateChange = useCallback((preset: DatePreset, sd: string, ed: string) => {
    setDatePreset(preset)
    setStartDate(sd)
    setEndDate(ed)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const visibleList = orderedWidgets.filter((w) => isVisible(w.id))
    const oldIndex = visibleList.findIndex((w) => w.id === active.id)
    const newIndex = visibleList.findIndex((w) => w.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderWidgets(oldIndex, newIndex)
    }
  }, [orderedWidgets, isVisible, reorderWidgets])

  const handleDragStart = useCallback((event: { active: { id: string | number } }) => {
    setActiveDragId(String(event.active.id))
  }, [])

  const kpis = data?.kpis

  function renderWidgetContent(id: string) {
    switch (id) {
      case "kpiCards": {
        const visibleKpis = kpiConfig.filter((cfg) => isKpiVisible(cfg.key))
        const gridCols = visibleKpis.length <= 3
          ? "lg:grid-cols-3"
          : visibleKpis.length <= 4
            ? "lg:grid-cols-4"
            : "lg:grid-cols-3"
        return (
          <motion.div variants={itemVariants} className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-5`}>
            {visibleKpis.map((cfg) => {
              let value: number
              let trend: number
              let sparkline: number[]
              if (cfg.key === "todaySales") {
                value = data?.todaySales?.amount ?? 0
                trend = data?.todaySales?.percentChange ?? 0
                sparkline = data?.todaySales?.sparkline ?? []
              } else {
                const metric = kpis?.[cfg.key as keyof typeof kpis]
                value = metric?.value ?? 0
                trend = metric?.trend ?? 0
                sparkline = metric?.sparkline ?? []
              }
              return (
                <KpiCard
                  key={cfg.key}
                  title={cfg.title}
                  value={formatCurrency(value)}
                  trend={trend}
                  icon={cfg.icon}
                  iconBgColor={cfg.iconBgColor}
                  chartColor={cfg.chartColor}
                  trendColor={cfg.trendColor}
                  sparkline={sparkline}
                />
              )
            })}
          </motion.div>
        )
      }
      case "salesChart":
        return <SalesOverviewChart data={data?.salesChart ?? []} periodLabel={presetLabels[datePreset]} />
      case "recentInvoices":
        return <RecentInvoicesCard data={data?.recentInvoices ?? []} />
      case "topCustomers":
        return <TopCustomersCard data={data?.topCustomers ?? []} />
      case "inventoryAlerts":
        return <InventoryAlertsCard data={data?.inventoryAlerts ?? []} />
      case "recentPayments":
        return <RecentPaymentsCard data={data?.recentPayments ?? []} />
      case "quickActions":
        return <QuickActionsBar />
      case "pendingOrders":
        return <PendingOrdersWidget />
      case "lowStock":
        return <LowStockWidget data={data?.lowStockItems} loading={loading} />
      case "tasks":
        return <TasksWidget />
      case "calendar":
        return <CalendarWidget />
      case "notifications":
        return <NotificationsWidget />
      case "customerActivities":
        return <CustomerActivitiesWidget data={data?.activities} loading={loading} />
      default:
        return null
    }
  }

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

  const visibleOrdered = orderedWidgets.filter((w) => isVisible(w.id))
  const widgetIds = visibleOrdered.map((w) => w.id)

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
              Welcome back, {user?.name ?? "there"} 👋
            </h1>
            <p className="text-sm text-muted mt-1">
              Here&apos;s what&apos;s happening with your business today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWidgetSettingsOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-[12px] text-sm font-semibold text-body hover:bg-gray-50 transition-colors shadow-sm"
            >
              <SlidersHorizontal size={14} />
              Customize
            </button>
            <DateRangeSelector value={datePreset} onChange={handleDateChange} />
          </div>
        </motion.div>

        {/* Draggable Widget Grid */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-5"
            >
              {visibleOrdered.map((w) => (
                <SortableWidget key={w.id} id={w.id} size={getWidgetSize(w.id)}>
                  {renderWidgetContent(w.id)}
                </SortableWidget>
              ))}
            </motion.div>
          </SortableContext>

          <DragOverlay>
            {activeDragId ? (
              <div className="rounded-[16px] shadow-xl ring-2 ring-primary-500/20 opacity-90 bg-surface">
                {renderWidgetContent(activeDragId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        <WidgetSettingsPanel
          open={widgetSettingsOpen}
          onOpenChange={setWidgetSettingsOpen}
          widgets={availableWidgets}
          orderedWidgets={orderedWidgets}
          onToggle={toggleWidget}
          onReorder={reorderWidgets}
          onReset={resetWidgets}
          isKpiVisible={isKpiVisible}
          onToggleKpi={toggleKpi}
        />
      </motion.div>
    </>
  )
}
