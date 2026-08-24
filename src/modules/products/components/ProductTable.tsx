import { Package, AlertTriangle, DollarSign, BarChart2 } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { ListFilterBar, FitText , FilterPills } from "@/components/ui"

import StockBadge, { stockColorClass } from "./StockBadge"
import type { Product, ProductListResponse, ProductFilter } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Product>[] = [
  {
    key: "item_name",
    header: "Product",
    render: (p) => (
      <div>
        <p className="font-semibold text-heading">{p.item_name}</p>
        <p className="text-xs text-muted mt-0.5">
          <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded-[4px]">{p.item_code}</span>
          {p.item_group && <> &middot; {p.item_group}</>}
        </p>
      </div>
    ),
  },
  {
    key: "stock_uom",
    header: "Unit",
    render: (p) => <span className="text-sm text-muted">{p.stock_uom}</span>,
  },
  {
    key: "standard_rate",
    header: "Selling Price",
    align: "right",
    render: (p) => (
      <span className="font-semibold tabular-nums text-heading">{formatCurrency(p.standard_rate)}</span>
    ),
  },
  {
    key: "effective_cost",
    header: "Cost",
    align: "right",
    render: (p) => (
      <span className="tabular-nums text-muted text-sm">
        {p.effective_cost !== null ? formatCurrency(p.effective_cost) : "—"}
      </span>
    ),
  },
  {
    key: "stock",
    header: "Stock Qty",
    align: "right",
    render: (p) => (
      <span className={cn("font-semibold tabular-nums text-sm", stockColorClass(p.stock))}>
        {p.stock}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (p) => <StockBadge stock={p.stock} />,
  },
]

function SummaryCard({
  label, value, sub, icon: Icon, iconClass, iconBg,
}: {
  label: string; value: string | number; sub: string
  icon: React.ElementType; iconClass: string; iconBg: string
}) {
  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card p-5 flex items-start gap-4">
      <div className={cn("p-2.5 rounded-[10px] shrink-0", iconBg, iconClass)}>
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-muted uppercase tracking-wider truncate">{label}</p>
        <FitText className="text-2xl font-bold text-heading tracking-tight mt-0.5 tabular-nums">{value}</FitText>
        <p className="text-xs text-muted mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  )
}

const FILTERS: ProductFilter[] = ["All", "Low Stock", "In Stock", "Out of Stock"]

interface ProductTableProps {
  data: ProductListResponse | null
  loading: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  activeFilter: ProductFilter
  onFilterChange: (f: ProductFilter) => void
  toolbarActions?: React.ReactNode
  onRowClick?: (product: Product) => void
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
}

export default function ProductTable({
  data, loading, search, onSearch, page, onPageChange,
  activeFilter, onFilterChange, toolbarActions, onRowClick,
  selectable, selectedKeys, onSelectionChange,
}: ProductTableProps) {
  const items = data?.items ?? []
  const lowStockCount = items.filter((p) => p.stock > 0 && p.stock < 20).length
  const outOfStockCount = items.filter((p) => p.stock === 0).length
  const inventoryValue = items.reduce((sum, p) => sum + p.standard_rate * p.stock, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Products" value={data?.total ?? 0} sub="Active catalog" icon={Package} iconClass="text-primary-600" iconBg="bg-primary-50" />
        <SummaryCard label="Low Stock" value={lowStockCount} sub="Below 20 units" icon={AlertTriangle} iconClass="text-danger-600" iconBg="bg-danger-50" />
        <SummaryCard label="Inventory Value" value={formatCurrency(inventoryValue)} sub="At selling price" icon={DollarSign} iconClass="text-success-600" iconBg="bg-success-50" />
        <SummaryCard label="Out of Stock" value={outOfStockCount} sub="Needs reorder" icon={BarChart2} iconClass="text-warning-600" iconBg="bg-warning-50" />
      </div>

      <ListFilterBar
        controls={{
          search: {
            value: search,
            onChange: onSearch,
            placeholder: "Search products...",
            width: "w-56",
          },
          extra: (
            <div className="flex items-center gap-2">
              <FilterPills options={FILTERS} value={activeFilter} onChange={onFilterChange} />
            </div>
          ),
        }}
      />

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(p) => p.name}
        loading={loading}
        page={page}
        total={data?.total}
        pageSize={10}
        onPageChange={onPageChange}
        toolbarActions={toolbarActions}
        onRowClick={onRowClick}
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectionChange={onSelectionChange}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Package size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No products found</p>
            <p className="text-xs text-muted">Add your first product to get started.</p>
          </div>
        }
      />
    </div>
  )
}
