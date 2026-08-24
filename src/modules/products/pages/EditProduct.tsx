import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, Save } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, Skeleton } from "@/components/ui"
import { productService, type ProductDetail } from "@/services"
import ProductForm from "../components/ProductForm"

export default function EditProduct() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    productService.getById(id).then(setProduct).catch((e) => {
      setLoadError(e instanceof Error ? e.message : "Failed to load product.")
    }).finally(() => setLoading(false))
  }, [id])

  return (
    <>
      <Topbar />
      <motion.div className="p-6 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(`/products/${id}`)} className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-heading">Edit Product</h1>
              <p className="text-sm text-muted mt-0.5">{product?.item_name ?? "Loading..."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/products/${id}`)}>Cancel</Button>
            <Button
              type="submit" form="product-form"
              disabled={loading || !!loadError || !product || saving}
              loading={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Update Product"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : loadError && !product ? (
          <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
            {loadError}
          </div>
        ) : !product ? (
          <p className="text-muted">Product not found.</p>
        ) : (
          <ProductForm product={product} onSaved={() => navigate(`/products/${id}`)} onCancel={() => navigate(`/products/${id}`)} onSavingChange={setSaving} />
        )}
      </motion.div>
    </>
  )
}
