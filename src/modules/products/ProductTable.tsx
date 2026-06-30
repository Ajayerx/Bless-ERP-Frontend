import { Package, AlertTriangle, DollarSign, BarChart2 } from "lucide-react"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Button } from "@/components/ui"
import StockBadge, { stockColorClass } from "./StockBadge"
import type { Product } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

const columns: Column<Product>[] = [
  {
    key: "name",
    header: "Product",
    render: (p) => (
      <div>
        <p className="font-semibold text-heading">{p.name}</p>
        <p className="text-xs text-muted mt-0.5">{p.category ?? "General"}</p>
      </div>
    ),
  },
  {
    key: "sku",
    header: "SKU",
    render: (p) => (
      <span className="font-mono text-xs bg-gray-100 text-muted px-2 py-1 rounded-[6px]">
        {p.sku}
      </span>
    ),
  },
  {
    key: "price",
    header: "Selling Price",
    className: "text-right",
    render: (p) => (
      <span className="font-semibold tabular-nums text-heading">{formatCurrency(p.price)}</span>
    ),
  },
  {
    key: "cost",
    header: "Cost",
    className: "text-right",
    hideOnMobile: true,
    render: (p) => (
      <span className="tabular-nums text-muted text-sm">
        {p.cost ? formatCurrency(p.cost) : "—"}
      </span>
    ),
  },
  {
    key: "stock",
    header: "Stock",
    render: (p) => (
      <span className={cn("font-semibold tabular-nums text-sm", stockColorClass(p.stock))}>
        {p.stock} {p.unit ?? "ea"}
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
      <div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-heading tracking-tight mt-0.5">{value}</p>
        <p className="text-xs text-muted mt-0.5">{sub}</p>
      </div>
    </div>
  )
}

const FILTERS = ["All", "Low Stock", "In Stock", "Out of Stock"] as const
type Filter = (typeof FILTERS)[number]

export interface ProductTableProps {
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
  onNewProduct: () => void
}

export default function ProductTable({
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
  onNewProduct,
}: ProductTableProps) {
  const lowStockCount = items.filter((p) => p.stock > 0 && p.stock < 20).length
  const outOfStockCount = items.filter((p) => p.stock === 0).length
  const inventoryValue = items.reduce((sum, p) => sum + p.price * p.stock, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-heading">Products</h1>
          <p className="text-sm text-muted mt-1">Manage your product catalog and stock levels.</p>
        </div>
        <Button onClick={onNewProduct}>
          <Package size={16} />
          Add Product
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Products" value={total ?? 0} sub="Active catalog" icon={Package} iconClass="text-primary-600" iconBg="bg-primary-50" />
        <SummaryCard label="Low Stock" value={lowStockCount} sub="Below reorder level" icon={AlertTriangle} iconClass="text-danger-600" iconBg="bg-danger-50" />
        <SummaryCard label="Inventory Value" value={formatCurrency(inventoryValue)} sub="At selling price" icon={DollarSign} iconClass="text-success-600" iconBg="bg-success-50" />
        <SummaryCard label="Out of Stock" value={outOfStockCount} sub="Needs reorder" icon={BarChart2} iconClass="text-warning-600" iconBg="bg-warning-50" />
      </div>

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              "px-4 py-1.5 rounded-[10px] text-sm font-semibold transition-colors",
              activeFilter === f
                ? "bg-primary-600 text-white shadow-sm"
                : "text-muted hover:bg-gray-100 hover:text-body",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(p) => p.id}
        searchable
        searchPlaceholder="Search products or SKU..."
        searchQuery={search}
        onSearch={onSearch}
        loading={loading}
        page={page}
        total={total}
        pageSize={10}
        onPageChange={onPageChange}
        onRowClick={onRowClick}
        toolbarActions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm">Export</Button>
            <Button variant="secondary" size="sm">Import</Button>
          </div>
        }
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

export type { Filter as ProductFilter }
