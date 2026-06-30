"use client"

import { useEffect, useState } from "react"
import { useParams, Link, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Package, DollarSign, Tag, Warehouse, RefreshCw, AlertTriangle, Pencil } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, Badge, Skeleton, Button } from "@/components/ui"
import { productService, type Product } from "@/services"
import { formatCurrency } from "@/lib/utils"

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    productService.get(id)
      .then(setProduct)
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-32 w-full" /></div>
      </>
    )
  }

  if (!product) {
    return <><Topbar /><div className="p-6 text-center text-muted py-24">Product not found.</div></>
  }

  const stockValue = (product.stock ?? 0) * (product.costPrice ?? product.cost ?? 0)
  const lowStock = (product.stock ?? 0) <= (product.reorderLevel ?? 5)

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
              <h1 className="text-2xl font-bold text-heading">{product.name}</h1>
              <p className="text-sm text-muted mt-0.5">{product.sku ?? product.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/products/${id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
            {lowStock && <Badge variant="danger">Low Stock</Badge>}
            {product.taxable !== false && <Badge variant="info">Taxable</Badge>}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-success-50 text-success-600 flex items-center justify-center shrink-0"><DollarSign size={16} /></div>
                <div>
                  <p className="text-xs text-muted uppercase tracking-wider font-semibold">Selling Price</p>
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(product.price ?? 0)}</p>
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
                  <p className="text-lg font-bold text-heading mt-0.5 tabular-nums">{formatCurrency(product.costPrice ?? product.cost ?? 0)}</p>
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
                  <p className="text-lg font-bold text-heading mt-0.5">{product.stock ?? 0} units</p>
                  <p className="text-xs text-muted mt-0.5">in {product.warehouse ?? "Main Warehouse"}</p>
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
                  {lowStock && <p className="text-xs text-danger-600 mt-0.5 flex items-center gap-1"><AlertTriangle size={11} />Below reorder level</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent>
              <h3 className="font-bold text-heading mb-2">Details</h3>
              <dl className="space-y-2 text-sm">
                {product.category && <><dt className="text-muted">Category</dt><dd className="font-semibold text-heading">{product.category}</dd></>}
                {product.description && <><dt className="text-muted">Description</dt><dd className="font-semibold text-heading">{product.description}</dd></>}
                <dt className="text-muted">Reorder Level</dt>
                <dd className="font-semibold text-heading">{product.reorderLevel ?? 5} units</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}
