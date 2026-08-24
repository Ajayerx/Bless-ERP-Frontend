import { Package, AlertTriangle, DollarSign, BarChart2 } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Badge, FitText , FilterPills } from "@/components/ui"
import type { Product } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const LOW_STOCK_THRESHOLD = 20

const columns: Column<Product>[] = [
  {
    key: "item_name",
    header: "Product",
    className: "max-w-[320px]",
    render: (p) => (
      <div>
        <p className="font-semibold text-heading">{p.item_name}</p>
        <p className="text-xs text-muted mt-0.5">{p.item_group ?? "General"}</p>
      </div>
    ),
  },
  {
    key: "item_code",
    header: "Item Code",
    width: "w-[1%]",
    render: (p) => (
      <span className="font-mono text-xs bg-gray-100 text-muted px-2 py-1 rounded-[6px]">
        {p.item_code}
      </span>
    ),
  },
  {
    key: "stock",
    header: "On Hand",
    align: "right",
    width: "w-[1%]",
    render: (p) => (
      <span className={cn(
        "font-semibold tabular-nums",
        p.stock === 0 ? "text-danger-600" : p.stock <= (p.reorder_level ?? LOW_STOCK_THRESHOLD) ? "text-warning-600" : "text-heading",
      )}>
        {p.stock} {p.stock_uom}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (p) => {
      if (p.stock === 0) return <Badge variant="danger">Out of Stock</Badge>
      if (p.stock <= (p.reorder_level ?? LOW_STOCK_THRESHOLD)) return <Badge variant="warning">Low Stock</Badge>
      return <Badge variant="success">In Stock</Badge>
    },
  },
]

function SummaryCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
  iconBg,
}: {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  iconClass: string
  iconBg: string
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

const FILTERS = ["All", "Low Stock", "In Stock", "Out of Stock"] as const
type Filter = (typeof FILTERS)[number]

export interface StockLevelTableProps {
  items: Product[]
  total?: number
  loading?: boolean
  search: string
  onSearch: (q: string) => void
  page: number
  onPageChange: (p: number) => void
  activeFilter: Filter
  onFilterChange: (f: Filter) => void
  onRowClick?: (product: Product) => void
  inventoryValue?: number
}

export default function StockLevelTable({
  items,
  total,
  loading,
  search,
  onSearch,
  page,
  onPageChange,
  activeFilter,
  onFilterChange,
  onRowClick,
  inventoryValue,
}: StockLevelTableProps) {
  const lowStockCount = items.filter((p) => p.stock > 0 && p.stock <= (p.reorder_level ?? LOW_STOCK_THRESHOLD)).length
  const outOfStockCount = items.filter((p) => p.stock === 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Stock Levels</h1>
          <p className="text-sm text-muted mt-1">Monitor product stock quantities across warehouses.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Products" value={total ?? 0} sub="Active catalog" icon={Package} iconClass="text-primary-600" iconBg="bg-primary-50" />
        <SummaryCard label="Low Stock" value={lowStockCount} sub="Below reorder level" icon={AlertTriangle} iconClass="text-danger-600" iconBg="bg-danger-50" />
        <SummaryCard label="Inventory Value" value={inventoryValue !== undefined ? formatCurrency(inventoryValue) : "—"} sub="At selling price" icon={DollarSign} iconClass="text-success-600" iconBg="bg-success-50" />
        <SummaryCard label="Out of Stock" value={outOfStockCount} sub="Needs reorder" icon={BarChart2} iconClass="text-warning-600" iconBg="bg-warning-50" />
      </div>

      <FilterPills options={FILTERS} value={activeFilter} onChange={onFilterChange} />

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(p) => p.name}
        searchable
        searchPlaceholder="Search products or item code..."
        searchQuery={search}
        onSearch={onSearch}
        loading={loading}
        page={page}
        total={total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        emptyState={
          <div className="flex flex-col items-center gap-2 py-4">
            <Package size={32} className="text-muted opacity-40" />
            <p className="font-semibold text-body">No products found</p>
            <p className="text-xs text-muted">Add products to see stock levels.</p>
          </div>
        }
      />
    </div>
  )
}

export type { Filter as StockLevelFilter }
