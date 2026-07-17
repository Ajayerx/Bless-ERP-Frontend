import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Package, DollarSign, Tag, Warehouse, RefreshCw, Pencil, ShoppingCart, Truck, TrendingUp, BarChart3, Trash2, XCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import DataTable, { type Column } from "@/components/ui/DataTable"
import { Card, CardContent, Badge, Skeleton, Button, Modal } from "@/components/ui"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui"
import { productService, type ProductDetail, type ItemPriceRow } from "@/services"
import { apiClient, ApiError } from "@/services/api-client"
import { formatCurrency, formatNumber, formatDate, rewriteErpNextLinks } from "@/lib/utils"

interface SalesInvoiceItem {
  name: string
  parent: string
  posting_date: string
  customer: string
  qty: number
  rate: number
  amount: number
  docstatus: number
}

interface PurchaseInvoiceItem {
  name: string
  parent: string
  posting_date: string
  supplier: string
  qty: number
  rate: number
  amount: number
  docstatus: number
}

type PriceHistory = ItemPriceRow

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

const salesColumns: Column<SalesInvoiceItem>[] = [
  {
    key: "parent",
    header: "Invoice",
    render: (item) => (
      <Link to={`/invoices/${item.parent}`} className="font-semibold text-primary-600 hover:underline">
        {item.parent}
      </Link>
    ),
  },
  { key: "customer", header: "Customer" },
  { key: "posting_date", header: "Date",
    render: (item) => <span className="text-sm text-muted">{formatDate(item.posting_date)}</span>,
  },
  { key: "qty", header: "Qty", className: "text-right",
    render: (item) => <span className="tabular-nums">{formatNumber(item.qty)}</span>,
  },
  { key: "amount", header: "Amount", className: "text-right",
    render: (item) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(item.amount)}</span>,
  },
]

const purchaseColumns: Column<PurchaseInvoiceItem>[] = [
  {
    key: "parent",
    header: "Invoice",
    render: (item) => (
      <span className="font-semibold text-heading">{item.parent}</span>
    ),
  },
  { key: "supplier", header: "Supplier" },
  { key: "posting_date", header: "Date",
    render: (item) => <span className="text-sm text-muted">{formatDate(item.posting_date)}</span>,
  },
  { key: "qty", header: "Qty", className: "text-right",
    render: (item) => <span className="tabular-nums">{formatNumber(item.qty)}</span>,
  },
  { key: "amount", header: "Amount", className: "text-right",
    render: (item) => <span className="font-semibold tabular-nums text-heading">{formatCurrency(item.amount)}</span>,
  },
]

const priceColumns: Column<ItemPriceRow>[] = [
  { key: "price_list", header: "Price List",
    render: (p) => <span className="font-semibold text-heading">{p.price_list}</span>,
  },
  { key: "price_list_rate", header: "Rate", className: "text-right",
    render: (p) => <span className="tabular-nums font-semibold text-heading">{formatCurrency(p.price_list_rate)}</span>,
  },
  { key: "currency", header: "Currency",
    render: (p) => <span className="text-sm text-muted">{p.currency}</span>,
  },
  { key: "uom", header: "UOM",
    render: (p) => <span className="text-sm text-muted">{p.uom ?? "—"}</span>,
  },
  { key: "buying", header: "Buying", className: "text-center",
    render: (p) => p.buying ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>,
  },
  { key: "selling", header: "Selling", className: "text-center",
    render: (p) => p.selling ? <Badge variant="success">Yes</Badge> : <Badge variant="secondary">No</Badge>,
  },
  { key: "valid_from", header: "Valid From",
    render: (p) => <span className="text-sm text-muted">{p.valid_from ? formatDate(p.valid_from) : "—"}</span>,
  },
  { key: "valid_upto", header: "Valid Upto",
    render: (p) => <span className="text-sm text-muted">{p.valid_upto ? formatDate(p.valid_upto) : "—"}</span>,
  },
]

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tab, setTab] = useState("overview")
  const [salesHistory, setSalesHistory] = useState<SalesInvoiceItem[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [salesError, setSalesError] = useState<string | null>(null)
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseInvoiceItem[]>([])
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<{ message: string; rawMessage: string } | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    productService.getById(id).then(setProduct).catch((e) => {
      setLoadError(e instanceof Error ? e.message : "Failed to load product.")
    }).finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!id || tab !== "sales") return
    const fetchSales = async () => {
      setSalesLoading(true)
      try {
        const invoices = await apiClient<{ name: string; posting_date: string; customer: string; docstatus: number }[]>(
          `/resource/Sales Invoice?filters=${encodeURIComponent(JSON.stringify([["Sales Invoice Item", "item_code", "=", id]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "posting_date", "customer", "docstatus"]))}&limit_page_length=50&order_by=posting_date desc`
        )
        const filled = await Promise.allSettled(
          (invoices ?? []).map((inv) =>
            apiClient<{ name: string; items: { item_code: string; qty: number; rate: number; amount: number }[] }>(
              `/resource/Sales Invoice/${encodeURIComponent(inv.name)}?fields=${encodeURIComponent(JSON.stringify(["items"]))}`
            ).then((doc) => ({ ...inv, items: doc.items ?? [] }))
          )
        )
        const items: SalesInvoiceItem[] = []
        for (const result of filled) {
          if (result.status !== "fulfilled") continue
          const inv = result.value
          for (const line of inv.items) {
            if (line.item_code === id) {
              items.push({
                name: `${inv.name}-${line.item_code}`,
                parent: inv.name,
                posting_date: inv.posting_date,
                customer: inv.customer,
                qty: line.qty,
                rate: line.rate,
                amount: line.amount,
                docstatus: inv.docstatus,
              })
            }
          }
        }
        setSalesHistory(items)
      } catch (e) {
        setSalesError(e instanceof Error ? e.message : "Failed to load sales history.")
      } finally { setSalesLoading(false) }
    }
    fetchSales()
  }, [id, tab])

  useEffect(() => {
    if (!id || tab !== "purchases") return
    const fetchPurchases = async () => {
      setPurchaseLoading(true)
      try {
        const invoices = await apiClient<{ name: string; posting_date: string; supplier: string; docstatus: number }[]>(
          `/resource/Purchase Invoice?filters=${encodeURIComponent(JSON.stringify([["Purchase Invoice Item", "item_code", "=", id]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "posting_date", "supplier", "docstatus"]))}&limit_page_length=50&order_by=posting_date desc`
        )
        const filled = await Promise.allSettled(
          (invoices ?? []).map((inv) =>
            apiClient<{ name: string; items: { item_code: string; qty: number; rate: number; amount: number }[] }>(
              `/resource/Purchase Invoice/${encodeURIComponent(inv.name)}?fields=${encodeURIComponent(JSON.stringify(["items"]))}`
            ).then((doc) => ({ ...inv, items: doc.items ?? [] }))
          )
        )
        const items: PurchaseInvoiceItem[] = []
        for (const result of filled) {
          if (result.status !== "fulfilled") continue
          const inv = result.value
          for (const line of inv.items) {
            if (line.item_code === id) {
              items.push({
                name: `${inv.name}-${line.item_code}`,
                parent: inv.name,
                posting_date: inv.posting_date,
                supplier: inv.supplier,
                qty: line.qty,
                rate: line.rate,
                amount: line.amount,
                docstatus: inv.docstatus,
              })
            }
          }
        }
        setPurchaseHistory(items)
      } catch (e) {
        setPurchaseError(e instanceof Error ? e.message : "Failed to load purchase history.")
      } finally { setPurchaseLoading(false) }
    }
    fetchPurchases()
  }, [id, tab])

  useEffect(() => {
    if (!id || tab !== "prices") return
    const fetchPrices = async () => {
      setPriceLoading(true)
      setPriceError(null)
      try {
        const prices = await productService.getItemPrices(id)
        setPriceHistory(prices)
      } catch (e) {
        setPriceError(e instanceof Error ? e.message : "Failed to load price history.")
      } finally { setPriceLoading(false) }
    }
    fetchPrices()
  }, [id, tab])

  const handleDeleteProduct = async () => {
    if (!id) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await productService.delete(id)
      navigate("/products")
    } catch (e) {
      if (e instanceof ApiError) {
        setDeleteError({ message: e.message, rawMessage: e.rawMessage })
      } else {
        setDeleteError({ message: e instanceof Error ? e.message : "Failed to delete product", rawMessage: e instanceof Error ? e.message : "Failed to delete product" })
      }
    } finally {
      setDeleting(false)
    }
  }

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

  if (loadError && !product) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Link to="/products" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading transition-colors">
            <ArrowLeft size={15} /> Back to Products
          </Link>
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
            {loadError}
          </div>
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
            <Button variant="secondary" size="sm" onClick={() => { setShowDeleteModal(true); setDeleteError(null) }} className="text-danger-600 hover:bg-danger-50 hover:text-danger-700">
              <Trash2 size={14} /> Delete
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

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview"><Package size={14} className="mr-1.5" /> Overview</TabsTrigger>
            <TabsTrigger value="sales"><ShoppingCart size={14} className="mr-1.5" /> Sales History</TabsTrigger>
            <TabsTrigger value="purchases"><Truck size={14} className="mr-1.5" /> Purchase History</TabsTrigger>
            <TabsTrigger value="prices"><BarChart3 size={14} className="mr-1.5" /> Price History</TabsTrigger>
          </TabsList>

          {/* -- Overview -- */}
          <TabsContent value="overview" className="space-y-6">
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
          </TabsContent>

          {/* -- Sales History -- */}
          <TabsContent value="sales" className="space-y-4">
            <Card>
              <CardContent>
                <h3 className="font-bold text-heading mb-3">Sales History</h3>
                <p className="text-sm text-muted mb-4">Invoices containing this item</p>
                {salesError && (
                  <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px] mb-4">{salesError}</p>
                )}
                {salesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <DataTable
                    columns={salesColumns}
                    data={salesHistory}
                    keyExtractor={(item) => `${item.parent}-${item.name}`}
                    emptyState={
                      <div className="flex flex-col items-center gap-2 py-8">
                        <ShoppingCart size={32} className="text-muted opacity-40" />
                        <p className="font-semibold text-body">No sales history</p>
                        <p className="text-sm text-muted">This item hasn't been sold yet</p>
                      </div>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -- Purchase History -- */}
          <TabsContent value="purchases" className="space-y-4">
            <Card>
              <CardContent>
                <h3 className="font-bold text-heading mb-3">Purchase History</h3>
                <p className="text-sm text-muted mb-4">Purchase invoices containing this item</p>
                {purchaseError && (
                  <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px] mb-4">{purchaseError}</p>
                )}
                {purchaseLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <DataTable
                    columns={purchaseColumns}
                    data={purchaseHistory}
                    keyExtractor={(item) => `${item.parent}-${item.name}`}
                    emptyState={
                      <div className="flex flex-col items-center gap-2 py-8">
                        <Truck size={32} className="text-muted opacity-40" />
                        <p className="font-semibold text-body">No purchase history</p>
                        <p className="text-sm text-muted">This item hasn't been purchased yet</p>
                      </div>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* -- Price History -- */}
          <TabsContent value="prices" className="space-y-4">
            <Card>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-heading">Item Prices</h3>
                </div>
                <p className="text-sm text-muted mb-4">Price list entries for this item</p>
                {priceError && (
                  <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2 rounded-[10px] mb-4">{priceError}</p>
                )}
                {priceLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <DataTable
                    columns={priceColumns}
                    data={priceHistory}
                    keyExtractor={(p) => p.name}
                    emptyState={
                      <div className="flex flex-col items-center gap-2 py-8">
                        <TrendingUp size={32} className="text-muted opacity-40" />
                        <p className="font-semibold text-body">No price list entries</p>
                        <p className="text-sm text-muted">Prices are defined in Pricing Rules or Item Prices</p>
                      </div>
                    }
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeleteError(null) }} title="Delete Product">
        {deleteError ? (
          <>
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-100">
                  <XCircle size={14} className="text-danger-600" />
                </div>
                <div
                  className="text-sm text-danger-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: rewriteErpNextLinks(deleteError.rawMessage) }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteError(null) }}>Close</Button>
            </div>
          </>
        ) : (
          <>
            <p>Are you sure you want to delete <strong>{product.item_name}</strong>?</p>
            <p className="text-sm text-muted mt-2">This action cannot be undone. All linked transactions, stock entries, and BOM references will be affected.</p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button onClick={handleDeleteProduct} loading={deleting} className="bg-danger-600 hover:bg-danger-700">Delete</Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
