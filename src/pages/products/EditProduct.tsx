"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { productService } from "@/services"
import type { Product } from "@/services/products.service"
import ProductForm from "@/modules/products/ProductForm"

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    productService.get(id).then(setProduct).catch(() => null).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6 max-w-3xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/products/${id}`)} className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Edit Product</h1>
              <p className="text-sm text-muted mt-0.5">{product?.name ?? "Loading..."}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => navigate(`/products/${id}`)}>Cancel</Button>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !product ? (
          <p className="text-muted">Product not found.</p>
        ) : (
          <ProductForm product={product} onSaved={() => navigate(`/products/${id}`)} onCancel={() => navigate(`/products/${id}`)} />
        )}
      </motion.div>
    </>
  )
}
