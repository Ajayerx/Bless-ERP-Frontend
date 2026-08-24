import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { Plus, Download, Trash2, UserRound, Tag, Printer } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import {
  Button, BulkDeleteModal, type BulkDeleteItem,
  useToast, Modal, ModalFooter, Input, LinkSearchField, ListBulkActions, messageFromError,
} from "@/components/ui"
import { useProducts } from "../hooks/useProducts"
import ProductTable from "../components/ProductTable"
import ProductImportModal from "../components/ProductImportModal"
import { productService } from "@/services"
import { PRODUCT_EXPORT_FIELDS } from "../services"

const PRINT_PAGE_SIZES = ["A4", "A3", "A5", "B5", "Letter", "Legal", "Ledger", "Executive"]

export default function Products() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { data, loading, error, search, setSearch, page, setPage, filter, setFilter, refetch } =
    useProducts({ pageSize: 10 })
  const [importOpen, setImportOpen] = useState(false)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [deleteItems, setDeleteItems] = useState<BulkDeleteItem[]>([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [actingToolbar, setActingToolbar] = useState(false)
  // Export dialog
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<"CSV" | "Excel">("CSV")
  const [exportFields, setExportFields] = useState<Record<string, string[]>>(() =>
    JSON.parse(JSON.stringify(PRODUCT_EXPORT_FIELDS))
  )
  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignee, setAssignee] = useState("")
  // Tags dialog
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsInput, setTagsInput] = useState("")
  // Print dialog
  const [printFormats, setPrintFormats] = useState<string[]>(["Standard"])
  const [printOpen, setPrintOpen] = useState(false)
  const [printFormat, setPrintFormat] = useState("Standard")
  const [printLetterhead, setPrintLetterhead] = useState("")
  const [printPageSize, setPrintPageSize] = useState("A4")

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

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const exportScopeFilters = (): unknown[] | undefined => {
    if (selectedKeys.size > 0) return [["name", "in", Array.from(selectedKeys)]]
    const filters: unknown[] = []
    if (filter !== "All") filters.push(["disabled", "=", 0])
    if (search) filters.push(["item_name", "like", `%${search}%`])
    return filters.length > 0 ? filters : undefined
  }

  const toggleExportField = (group: string, field: string) => {
    setExportFields((prev) => {
      const groupFields = prev[group] ?? []
      const has = groupFields.includes(field)
      return {
        ...prev,
        [group]: has ? groupFields.filter((f) => f !== field) : [...groupFields, field],
      }
    })
  }

  const resetExportFields = () => {
    setExportFields(JSON.parse(JSON.stringify(PRODUCT_EXPORT_FIELDS)))
  }

  const handleExport = async () => {
    setActingToolbar(true)
    try {
      const selectedGroups = Object.fromEntries(
        Object.entries(exportFields).filter(([, fields]) => fields.length > 0)
      )
      if (Object.keys(selectedGroups).length === 0) {
        throw new Error("Select at least one column to export.")
      }
      const blob = await productService.exportRecords({
        fileType: exportFormat,
        recordMode: "by_filter",
        fields: selectedGroups,
        filters: exportScopeFilters(),
      })
      downloadBlob(blob, `Items.${exportFormat === "CSV" ? "csv" : "xlsx"}`)
      setExportOpen(false)
      addToast(`Exported ${selectedKeys.size > 0 ? selectedKeys.size : "filtered"} products.`, "success")
    } catch (err) {
      const msg = messageFromError(err, "Export failed.")
      addToast(typeof msg === "string" ? msg : msg.message, "error")
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkAssign = async (remove = false) => {
    const names = Array.from(selectedKeys)
    setAssignOpen(false)
    setActingToolbar(true)
    try {
      if (remove) {
        await productService.removeAssignment(names)
      } else if (!assignee.trim()) {
        throw new Error("Please enter an assignee.")
      } else {
        await productService.assignTo(names, assignee.trim())
      }
      addToast(
        remove
          ? "Assignment cleared."
          : `Assigned ${names.length} product${names.length === 1 ? "" : "s"} to ${assignee.trim()}.`,
        "success"
      )
      setAssignee("")
    } catch (err) {
      const msg = messageFromError(err, "Assignment failed.")
      addToast(typeof msg === "string" ? msg : msg.message, "error")
    } finally {
      setActingToolbar(false)
    }
  }

  const handleBulkAddTags = async () => {
    const names = Array.from(selectedKeys)
    setTagsOpen(false)
    setActingToolbar(true)
    try {
      const labels = tagsInput.split(",").map((t) => t.trim()).filter(Boolean)
      if (labels.length === 0) throw new Error("Please enter at least one tag.")
      await productService.addTags(names, labels)
      addToast(
        `Added ${labels.length} tag${labels.length === 1 ? "" : "s"} to ${names.length} product${names.length === 1 ? "" : "s"}.`,
        "success"
      )
      setTagsInput("")
    } catch (err) {
      const msg = messageFromError(err, "Adding tags failed.")
      addToast(typeof msg === "string" ? msg : msg.message, "error")
    } finally {
      setActingToolbar(false)
    }
  }

  const handleOpenPrint = () => {
    setPrintOpen(true)
    void productService.getPrintFormats().then((formats) => {
      if (formats.length > 0) setPrintFormats(formats)
    })
  }

  const handleBulkPrint = () => {
    setPrintOpen(false)
    if (!data || selectedKeys.size === 0) return
    const names = data.items.filter((p) => selectedKeys.has(p.name)).map((p) => p.name)
    if (names.length === 0) return
    const url = productService.buildMultiPdfUrl(names, {
      printFormat,
      letterhead: printLetterhead || undefined,
      pageSize: printPageSize || undefined,
    })
    const preview = window.open(url, "_blank")
    if (!preview) {
      addToast("Popup blocked — allow pop-ups to preview and download the PDF.", "error")
      return
    }
    addToast(`Opening PDF preview for ${names.length} product${names.length === 1 ? "" : "s"}.`, "info")
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
            <ListBulkActions
              count={selectedKeys.size}
              noun="products"
              fallback={
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setExportOpen(true)}>
                    <Download size={13} /> Export
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>Import</Button>
                </div>
              }
              items={[
                {
                  label: "Export",
                  icon: <Download size={14} />,
                  onClick: () => setExportOpen(true),
                },
                {
                  label: "Assign To…",
                  icon: <UserRound size={14} />,
                  onClick: () => setAssignOpen(true),
                },
                {
                  label: "Clear Assignment",
                  icon: <UserRound size={14} />,
                  onClick: () => handleBulkAssign(true),
                },
                {
                  label: "Add Tags",
                  icon: <Tag size={14} />,
                  onClick: () => setTagsOpen(true),
                },
                {
                  label: "Print",
                  icon: <Printer size={14} />,
                  onClick: handleOpenPrint,
                },
                {
                  label: "Delete",
                  icon: <Trash2 size={14} />,
                  danger: true,
                  separatorBefore: true,
                  onClick: handleBulkDelete,
                },
              ]}
            />
          }
          onRowClick={(product) => navigate(`/products/${product.name}`)}
        />
      </motion.div>

      <ProductImportModal open={importOpen} onClose={() => setImportOpen(false)} onComplete={() => refetch()} />

      {/* Export dialog */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export Products"
        description={`Export ${selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "all filtered"} products.`}
      >
        <label className="block text-xs font-semibold text-muted mb-1.5">Format</label>
        <select
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as "CSV" | "Excel")}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          <option value="CSV">CSV (.csv)</option>
          <option value="Excel">Excel (.xlsx)</option>
        </select>
        <div className="mt-4 flex items-center justify-between">
          <label className="text-xs font-semibold text-muted mb-1.5 block">Columns</label>
          <button
            type="button"
            onClick={resetExportFields}
            className="text-xs text-primary-600 hover:underline"
          >
            Reset to all
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto pr-1 space-y-3 mt-1">
          {Object.entries(PRODUCT_EXPORT_FIELDS).map(([group, fields]) => (
            <div key={group}>
              <p className="text-xs font-semibold text-body mb-1.5">{group}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {fields.map((field) => {
                  const checked = (exportFields[group] ?? []).includes(field)
                  return (
                    <label key={field} className="flex items-center gap-2 text-sm text-body cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleExportField(group, field)}
                        className="accent-primary-600"
                      />
                      <span className="capitalize">{field.replace(/_/g, " ")}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
          <Button onClick={handleExport} loading={actingToolbar}>
            <Download size={14} /> Export
          </Button>
        </ModalFooter>
      </Modal>

      {/* Assign dialog */}
      <Modal
        open={assignOpen}
        onClose={() => {
          setAssignOpen(false)
          setAssignee("")
        }}
        title="Assign Products"
        description={`Assign ${selectedKeys.size} selected product${selectedKeys.size === 1 ? "" : "s"} to a user.`}
      >
        <LinkSearchField
          value={assignee || undefined}
          onChange={(v) => setAssignee(v ?? "")}
          searchFn={(query) =>
            productService.searchAssignableUsers(query).then((users) => ({
              items: users.map((u) => ({ value: u.value, label: u.label, description: u.description })),
            }))
          }
          placeholder="Type to search users..."
          required
          className="w-full"
          clearIconMode="hover"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setAssignOpen(false)}>Cancel</Button>
          <Button
            variant="ghost"
            className="text-danger-600 border border-danger-100 bg-danger-50 hover:bg-danger-100"
            onClick={() => handleBulkAssign(true)}
            loading={actingToolbar}
          >
            <UserRound size={14} /> Remove
          </Button>
          <Button onClick={() => handleBulkAssign(false)} loading={actingToolbar}>
            <UserRound size={14} /> Assign
          </Button>
        </ModalFooter>
      </Modal>

      {/* Tags dialog */}
      <Modal
        open={tagsOpen}
        onClose={() => {
          setTagsOpen(false)
          setTagsInput("")
        }}
        title="Add Tags"
        description={`Add tags to ${selectedKeys.size} selected product${selectedKeys.size === 1 ? "" : "s"}. Separate tags with commas.`}
      >
        <Input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. Seasonal, Bestseller, Clearance"
          className="w-full"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setTagsOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkAddTags} loading={actingToolbar}>
            <Tag size={14} /> Add Tags
          </Button>
        </ModalFooter>
      </Modal>

      {/* Print dialog */}
      <Modal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Print Products"
        description={`Generate a PDF preview for ${selectedKeys.size} selected product${selectedKeys.size === 1 ? "" : "s"}. A new tab opens with the PDF — download it from there (mirrors ERPNext).`}
      >
        <label className="block text-xs font-semibold text-muted mb-1.5">Print Format</label>
        <select
          value={printFormat}
          onChange={(e) => setPrintFormat(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          {printFormats.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Page Size</label>
        <select
          value={printPageSize}
          onChange={(e) => setPrintPageSize(e.target.value)}
          className="w-full h-9 px-3 text-sm rounded-[10px] border border-border bg-surface text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 transition-colors"
        >
          {PRINT_PAGE_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <label className="block text-xs font-semibold text-muted mb-1.5 mt-3">Letterhead</label>
        <Input
          value={printLetterhead}
          onChange={(e) => setPrintLetterhead(e.target.value)}
          placeholder="Leave blank for no letterhead"
          className="w-full"
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setPrintOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkPrint}>
            <Printer size={14} /> Preview
          </Button>
        </ModalFooter>
      </Modal>

      <BulkDeleteModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteItems([]); }}
        onComplete={handleDeleteComplete}
        items={deleteItems}
        onDelete={(name) => productService.delete(name)}
        doctypeLabel="Product"
      />
    </>
  )
}
