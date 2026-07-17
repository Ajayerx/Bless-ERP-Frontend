import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Button, SelectionBar, BulkDeleteModal, type BulkDeleteItem } from "@/components/ui"
import { useProducts } from "../hooks/useProducts"
import ProductTable from "../components/ProductTable"
import ProductImportModal from "../components/ProductImportModal"
import { productService } from "@/services"

export default function Products() {
  const navigate = useNavigate()
  const { data, loading, error, search, setSearch, page, setPage, filter, setFilter, refetch } =
    useProducts({ pageSize: 10 })
  const [importOpen, setImportOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [deleteItems, setDeleteItems] = useState<BulkDeleteItem[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    setSelectedKeys(new Set())
  }, [search, page, filter])

  const handleBulkDelete = () => {
    if (!data || selectedKeys.size === 0) return
    const items: BulkDeleteItem[] = data.items
      .filter((p) => selectedKeys.has(p.name))
      .map((p) => ({ name: p.name, label: p.item_name }))
    setDeleteItems(items)
    setShowDeleteModal(true)
  }

  const handleDeleteComplete = () => {
    setSelectedKeys(new Set())
    setDeleteItems([])
    refetch()
  }

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Products</h1>
            <p className="text-sm text-muted mt-1">Manage your product catalog and stock levels.</p>
          </div>
          <Button onClick={() => navigate("/products/new")}>
            <Plus size={16} />
            Add Product
          </Button>
        </div>

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
            {error}
          </p>
        )}

        <ProductTable
          data={data}
          loading={loading}
          search={search}
          onSearch={setSearch}
          page={page}
          onPageChange={setPage}
          activeFilter={filter}
          onFilterChange={setFilter}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          toolbarActions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => productService.exportToCsv({ search })}>Export</Button>
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>Import</Button>
            </div>
          }
          onRowClick={(product) => navigate(`/products/${product.name}`)}
        />
      </motion.div>

      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} onComplete={() => refetch()} />

      <BulkDeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItems([]); }}
        onComplete={handleDeleteComplete}
        items={deleteItems}
        onDelete={(name) => productService.delete(name)}
        doctypeLabel="Product"
      />

      <SelectionBar
        count={selectedKeys.size}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedKeys(new Set())}
        label="product"
      />
    </>
  )
}
