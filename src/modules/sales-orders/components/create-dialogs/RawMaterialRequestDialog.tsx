"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Button, useMessageDialog } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { salesOrderService } from "../../services"
import type { SalesOrderDoc } from "../../types"

interface RawMaterialRow {
  name: string
  item_code: string
  bom: string
  warehouse?: string
  required_qty: number
  selected: 0 | 1
}

interface RawMaterialRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  doc: SalesOrderDoc
  onCreated: (outcome: { doctype: "Material Request"; name?: string } | null) => void
  onDocCreated?: () => void
}

const GRID_COLS = "28px minmax(130px, 1.4fr) minmax(180px, 1.3fr) minmax(150px, 1.2fr) 110px"

// ERPNext `make_raw_material_request` dialog: per-item warehouse/BOM/qty plus
// the Include Exploded Items / Ignore Existing Ordered Qty options. The server
// submits the Material Request and returns it; returns null (msgprint) when all
// raw materials are already available.
export default function RawMaterialRequestDialog({ open, onOpenChange, doc, onCreated, onDocCreated }: RawMaterialRequestDialogProps) {
  const { showMessage } = useMessageDialog()
  const [rows, setRows] = useState<RawMaterialRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [includeExplodedItems, setIncludeExplodedItems] = useState(false)
  const [ignoreExistingOrderedQty, setIgnoreExistingOrderedQty] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows([])
    setLoading(true)
    let cancelled = false
    salesOrderService
      .getWorkOrderItems(doc.name, 1)
      .then((items) => {
        if (cancelled) return
        const available = (items ?? []).map((item) => ({
          name: item.name,
          item_code: item.item_code,
          bom: item.bom ?? "",
          warehouse: item.warehouse,
          required_qty: item.required_qty ?? item.pending_qty ?? 0,
          selected: 1 as const,
        }))
        setRows(available)
        if (available.length === 0) {
          showMessage({ message: "No Items with Bill of Materials.", indicator: "orange" })
          onOpenChange(false)
          return
        }
      })
      .catch((err) => {
        if (cancelled) return
        showMessage({ message: err instanceof Error ? err.message : "Failed to load items for material request." })
        onOpenChange(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, doc.name, onOpenChange, showMessage])

  const updateRow = (index: number, patch: Partial<RawMaterialRow>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const searchBom = async (query: string, itemCode: string) => {
    const found = await salesOrderService.searchWidget({
      doctype: "BOM",
      txt: query,
      filters: { item: itemCode },
      page_length: 10,
    })
    return {
      items: (Array.isArray(found) ? found : []).map((row) => ({
        value: String(row.name),
        label: String(row.name),
        description: "",
      })),
    }
  }

  const searchWarehouse = async (query: string) => {
    const found = await salesOrderService.searchWidget({
      doctype: "Warehouse",
      txt: query,
      page_length: 10,
    })
    return {
      items: (Array.isArray(found) ? found : []).map((row) => ({
        value: String(row.name),
        label: String(row.name),
        description: "",
      })),
    }
  }

  const handleCreate = async () => {
    const selectedRows = rows.filter((row) => row.selected === 1)
    if (selectedRows.length === 0) {
      showMessage({ title: "Items Required", message: "Please select at least one item to continue", indicator: "blue" })
      return
    }
    const incomplete = selectedRows.find((row) => !row.bom || !(row.required_qty > 0))
    if (incomplete) {
      showMessage({
        title: "Missing details",
        message: `Please select a BOM and a positive Qty against ${incomplete.item_code}.`,
        indicator: "orange",
      })
      return
    }
    setSubmitting(true)
    try {
      const created = await salesOrderService.makeRawMaterialRequest(
        selectedRows.map((row) => ({
          item_code: row.item_code,
          warehouse: row.warehouse,
          bom: row.bom,
          required_qty: row.required_qty,
        })),
        doc.company,
        doc.name,
        doc.project,
        { includeExplodedItems, ignoreExistingOrderedQty },
      )
      if (created?.name) {
        onCreated({ doctype: "Material Request", name: created.name })
      } else {
        showMessage({ message: "Material Request not created, as quantity for Raw Materials already available." })
      }
      onDocCreated?.()
      onOpenChange(false)
    } catch (err) {
      showMessage({ message: err instanceof Error ? err.message : "Failed to create material request." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Items for Raw Material Request</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-body cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={includeExplodedItems}
                onChange={(e) => setIncludeExplodedItems(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Include Exploded Items
            </label>
            <label className="flex items-center gap-2 text-sm text-body cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={ignoreExistingOrderedQty}
                onChange={(e) => setIgnoreExistingOrderedQty(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Ignore Existing Ordered Qty
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
              <Loader2 size={14} className="animate-spin" /> Loading items...
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted">Select BOM, Qty and For Warehouse</p>
              <div
                className="grid gap-4 px-4 py-2 text-xs font-semibold text-muted border border-b-0 border-border rounded-t-lg"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <span />
                <span>Item Code</span>
                <span>For Warehouse</span>
                <span>BOM</span>
                <span>Qty</span>
              </div>
              <div className="border border-border rounded-b-lg max-h-72 overflow-y-auto">
                {rows.map((row, index) => (
                  <div
                    key={row.name}
                    className="grid gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 items-center"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <input
                      type="checkbox"
                      checked={row.selected === 1}
                      onChange={(e) => updateRow(index, { selected: e.target.checked ? 1 : 0 })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm text-body font-medium truncate">{row.item_code}</span>
                    <LinkSearchField
                      value={row.warehouse}
                      onChange={(warehouse) => updateRow(index, { warehouse: warehouse ?? undefined })}
                      searchFn={searchWarehouse}
                      placeholder="Select Warehouse..."
                      docType="Warehouse"
                      suppressExternalLabelFetch
                    />
                    <LinkSearchField
                      value={row.bom}
                      onChange={(bom) => updateRow(index, { bom: bom ?? "" })}
                      searchFn={(q) => searchBom(q, row.item_code)}
                      placeholder="Select BOM..."
                      docType="BOM"
                      suppressExternalLabelFetch
                    />
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={row.required_qty}
                      onChange={(e) => updateRow(index, { required_qty: Number(e.target.value) })}
                      className="w-full px-2.5 py-2 bg-white border border-border rounded-lg text-sm text-body tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Close
          </Button>
          <Button onClick={() => void handleCreate()} disabled={loading || submitting} loading={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}