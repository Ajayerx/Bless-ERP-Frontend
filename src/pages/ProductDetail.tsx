"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Package, MapPin, DollarSign, BarChart3 } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { productService, type Product } from "@/services"
import { formatCurrency, cn } from "@/lib/utils"

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    productService.getById(id)
      .then(setProduct)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-[16px]" />)}
          </div>
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (!product) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Product not found.</p>
          <Button className="mt-4" onClick={() => navigate("/products")}>Back to Products</Button>
        </div>
      </>
    )
  }

  const margin = product.price > 0
    ? ((product.price - product.cost) / product.price * 100).toFixed(1)
    : "0.0"

  const stats = [
    { label: "Selling Price", value: formatCurrency(product.price), icon: DollarSign, color: "text-primary-600 bg-primary-50" },
    { label: "Cost Price", value: formatCurrency(product.cost), icon: DollarSign, color: "text-warning-600 bg-warning-50" },
    { label: "Margin", value: `${margin}%`, icon: BarChart3, color: "text-success-600 bg-success-50" },
    { label: "Stock", value: `${product.stock} ${product.unit}`, icon: Package, color: product.stock < 10 ? "text-danger-600 bg-danger-50" : "text-info-600 bg-info-50" },
  ]

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/products")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{product.name}</h1>
                <Badge variant={product.status === "active" ? "success" : "default"}>
                  {product.status === "active" ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">SKU: {product.sku} &middot; {product.category}</p>
            </div>
          </div>
          <Button variant="secondary">Edit Product</Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-start gap-4 pt-6">
                <div className={cn("p-3 rounded-[10px]", stat.color)}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="text-xl font-bold text-heading mt-0.5 tabular-nums">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Product Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* General Information */}
          <Card>
            <CardHeader>
              <CardTitle>General Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoRow label="Product Name" value={product.name} />
                <InfoRow label="SKU" value={product.sku} />
                <InfoRow label="Category" value={product.category} />
                <InfoRow label="Unit" value={product.unit} />
                <InfoRow label="Status" value={product.status === "active" ? "Active" : "Inactive"} />
              </div>
            </CardContent>
          </Card>

          {/* Warehouse & Stock */}
          <Card>
            <CardHeader>
              <CardTitle>Warehouse Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-heading">{product.warehouse}</p>
                  <p className="text-xs text-muted">Primary storage location</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Package size={16} className="text-muted mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-heading">{product.stock} {product.unit}</p>
                  <p className="text-xs text-muted">Current stock level</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-heading mt-1">{value}</p>
    </div>
  )
}
