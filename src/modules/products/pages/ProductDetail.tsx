import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Package, DollarSign, Tag, Warehouse, RefreshCw, Pencil, History } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui"
import { productService, type ProductDetail } from "@/services"
import { formatCurrency, formatNumber } from "@/lib/utils"

const warehouseColumns: Column<{ warehouse: string; actual_qty: number; valuation_rate: number; stock_value: number }>[] = [
  {
    key: "warehouse",
    header: "Warehouse",
    render: (w) => <span className="font-semibold text-heading">{w.warehouse}</span>,
  },
  {
    key: "actual_qty",
    header: "Qty",
    className: "text-right",
    render: (w) => <span className="tabular-nums font-semibold">{formatNumber(w.actual_qty)}</span>,
  },
  {
    key: "valuation_rate",
    header: "Unit Cost",
    className: "text-right",
    hideOnMobile: true,
    render: (w) => <span className="tabular-nums text-muted">{w.valuation_rate > 0 ? formatCurrency(w.valuation_rate) : "—"}</span>,
  },
  {
    key: "stock_value",
    header: "Stock Value",
    className: "text-right",
    render: (w) => <span className="tabular-nums font-semibold text-heading">{formatCurrency(w.stock_value)}</span>,
  },
]

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    productService.getById(id).then(setProduct).catch(() => null).finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    )
  }

  if (!product) {
    return <><Topbar /><div className="p-6 text-center text-muted py-24">Product not found.</div></>
  }

  const stockValue = product.stock_value
  const lowStock = product.stock > 0 && product.stock <= (product.reorder_level ?? 5)
  const hasMultipleWarehouses = product.warehouse_stock.length > 1

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
          <ArrowLeft size={15} /> Back to Products
        </Link>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-[14px] bg-primary-50 text-primary-600 flex items-center justify-center">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-heading">{product.item_name}</h1>
              <p className="text-sm text-muted mt-0.5">
                <span className="font-mono text-[11px] bg-gray-100 px-1.5 py-0.5 rounded-[4px]">{product.item_code}</span>
                {product.item_group && <> &middot; {product.item_group}</>}
                {product.brand && <> &middot; {product.brand}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/products/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
            <Badge variant={product.disabled ? "default" : "success"}>
              {product.disabled ? "Inactive" : "Active"}
            </Badge>
            {lowStock && <Badge variant="danger">Low Stock</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Selling Price</p>
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(product.standard_rate)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0"><RefreshCw size={16} /></div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Cost Price</p>
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">
                    {product.effective_cost !== null ? formatCurrency(product.effective_cost) : "N/A"}
                  </p>
                  <p className="text-xs text-muted mt-0.5">From Bin valuation</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-info-50 text-info-600 flex items-center justify-center shrink-0"><Warehouse size={16} /></div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Stock</p>
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">{formatNumber(product.stock)} {product.stock_uom}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {product.default_warehouse
                      ? `Default: ${product.default_warehouse}`
                      : hasMultipleWarehouses
                        ? `${product.warehouse_stock.length} warehouses`
                        : "No default warehouse"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-gray-100 text-muted flex items-center justify-center shrink-0"><Tag size={16} /></div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Stock Value</p>
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(stockValue)}</p>
                  {lowStock && <p className="text-xs text-danger-600 mt-0.5">Below reorder level</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-bold text-heading mb-3">Details</h3>
              <dl className="space-y-2 text-sm">
                <dt className="text-muted">Item Code</dt>
                <dd className="font-semibold text-heading font-mono">{product.item_code}</dd>
                {product.item_group && <><dt className="text-muted">Item Group</dt><dd className="font-semibold text-heading">{product.item_group}</dd></>}
                {product.brand && <><dt className="text-muted">Brand</dt><dd className="font-semibold text-heading">{product.brand}</dd></>}
                <dt className="text-muted">UOM</dt>
                <dd className="font-semibold text-heading">{product.stock_uom}</dd>
                {product.description && <><dt className="text-muted">Description</dt><dd className="font-semibold text-heading whitespace-pre-wrap">{product.description}</dd></>}
                {product.opening_stock !== undefined && product.opening_stock > 0 && (
                  <><dt className="text-muted">Opening Stock (seeded)</dt><dd className="font-semibold text-heading">{product.opening_stock} {product.stock_uom}</dd></>
                )}
                {product.reorder_level !== undefined && (
                  <><dt className="text-muted">Reorder Level</dt><dd className="font-semibold text-heading">{product.reorder_level} units</dd></>
                )}
                {product.default_warehouse && (
                  <><dt className="text-muted">Default Warehouse</dt><dd className="font-semibold text-heading">{product.default_warehouse}</dd></>
                )}
                <dt className="text-muted">Tax</dt>
                <dd className="font-semibold text-heading">
                  {product.taxes.length > 0
                    ? product.taxes.map((t) => t.item_tax_template).join(", ")
                    : "Standard / None configured"}
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <h3 className="font-bold text-heading mb-3">Warehouse Stock</h3>
              {product.warehouse_stock.length === 0 ? (
                <p className="text-sm text-muted">No stock in any warehouse.</p>
              ) : (
                <DataTable
                  columns={warehouseColumns}
                  data={product.warehouse_stock}
                  keyExtractor={(w) => w.warehouse}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[10px] bg-gray-100 text-muted flex items-center justify-center shrink-0"><History size={16} /></div>
              <div>
                <h3 className="font-bold text-heading">Sales History</h3>
                <p className="text-sm text-muted mt-0.5">Per-item sales history across Sales Invoices &amp; Sales Orders will be available in a future milestone (Phase 3).</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}
