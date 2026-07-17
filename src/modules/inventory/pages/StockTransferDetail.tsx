"use client"

import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { ArrowLeft, MapPin, CheckCircle2, XCircle } from "lucide-react"
import Topbar from "@/components/layout/Topbar"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryService } from "@/modules/inventory/services"
import type { StockTransfer } from "@/modules/inventory/types"
import { formatDate } from "@/lib/utils"

const statusConfig: Record<number, { label: string; variant: "success" | "warning" | "default" | "danger" | "info" }> = {
  0: { label: "Draft", variant: "default" },
  1: { label: "Submitted", variant: "success" },
  2: { label: "Cancelled", variant: "danger" },
}

export default function StockTransferDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [transfer, setTransfer] = useState<StockTransfer | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const name = decodeURIComponent(id)
    inventoryService.getTransfer(name)
      .then(setTransfer)
      .catch((e) => { setError(e instanceof Error ? e.message : "Failed to load transfer details.") })
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async () => {
    if (!transfer) return
    setActionLoading(true)
    try {
      await inventoryService.submitTransfer(transfer.name)
      const updated = await inventoryService.getTransfer(transfer.name)
      setTransfer(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit transfer.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!transfer) return
    setActionLoading(true)
    try {
      await inventoryService.cancelTransfer(transfer.name)
      const updated = await inventoryService.getTransfer(transfer.name)
      setTransfer(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel transfer.")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <Topbar />
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 rounded-[16px]" />
          <Skeleton className="h-64 rounded-[16px]" />
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">{error}</p>
          <Button className="mt-4" onClick={() => navigate("/inventory/transfers")}>Back to Transfers</Button>
        </div>
      </>
    )
  }

  if (!transfer) {
    return (
      <>
        <Topbar />
        <div className="p-6 text-center">
          <p className="text-muted">Stock transfer not found.</p>
          <Button className="mt-4" onClick={() => navigate("/inventory/transfers")}>Back to Transfers</Button>
        </div>
      </>
    )
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
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/inventory/transfers")}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-heading">{transfer.name}</h1>
                <Badge variant={statusConfig[transfer.docstatus]?.variant ?? "default"}>
                  {statusConfig[transfer.docstatus]?.label ?? `Unknown (${transfer.docstatus})`}
                </Badge>
              </div>
              <p className="text-sm text-muted mt-0.5">{transfer.company} · Created {formatDate(transfer.creation)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {transfer.docstatus === 0 && (
              <Button onClick={handleSubmit} disabled={actionLoading}>
                <CheckCircle2 size={16} />
                {actionLoading ? "Submitting..." : "Submit"}
              </Button>
            )}
            {transfer.docstatus === 1 && (
              <Button variant="secondary" onClick={handleCancel} disabled={actionLoading}>
                <XCircle size={16} />
                {actionLoading ? "Cancelling..." : "Cancel"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Transfer Route</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-danger-50 text-danger-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">From</p>
                  <p className="text-sm font-semibold text-heading mt-0.5">{transfer.from_warehouse ?? "—"}</p>
                </div>
              </div>
              <div className="border-l-2 border-dashed border-border ml-5 h-6" />
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-success-50 text-success-600">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted uppercase tracking-wider">To</p>
                  <p className="text-sm font-semibold text-heading mt-0.5">{transfer.to_warehouse ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Row label="Reference" value={transfer.name} />
              <Row label="Status" value={statusConfig[transfer.docstatus]?.label ?? String(transfer.docstatus)} />
              <Row label="Items" value={String(transfer.items.length)} />
              <Row label="Company" value={transfer.company} />
              <Row label="Posting Date" value={transfer.posting_date} />
              <Row label="Created" value={formatDate(transfer.creation)} />
              {transfer.remarks && <Row label="Remarks" value={transfer.remarks} />}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transfer Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50/80">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted/80">Item Code</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Quantity</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">UOM</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Source</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted/80">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {transfer.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-heading">{item.item_code}</td>
                    <td className="px-5 py-3 text-sm font-semibold tabular-nums text-right">{item.qty}</td>
                    <td className="px-5 py-3 text-sm text-muted text-right">{item.uom}</td>
                    <td className="px-5 py-3 text-sm text-muted text-right">{item.s_warehouse ?? "—"}</td>
                    <td className="px-5 py-3 text-sm text-muted text-right">{item.t_warehouse ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-sm font-medium text-heading">{value}</p>
    </div>
  )
}
