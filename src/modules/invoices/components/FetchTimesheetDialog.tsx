"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Button } from "@/components/ui"
import LinkSearchField from "@/components/ui/LinkSearchField"
import { invoiceService } from "@/services"

interface FetchTimesheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: string
  customer?: string
  company?: string
  onItemsFetched: (items: Array<Record<string, unknown>>) => void
  onTimesheetsFetched: (rows: Array<Record<string, unknown>>) => void
}

export default function FetchTimesheetDialog({
  open,
  onOpenChange,
  project,
  customer,
  company,
  onItemsFetched,
  onTimesheetsFetched,
}: FetchTimesheetDialogProps) {
  const [fromTime, setFromTime] = useState("")
  const [toTime, setToTime] = useState("")
  const [itemCode, setItemCode] = useState<string | undefined>(undefined)
  const [selectedProject, setSelectedProject] = useState<string | undefined>(project)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const searchItems = async (query: string) =>
    invoiceService.searchItems(query, 0, 20, customer, { is_sales_item: true })

  const searchProjects = async (query: string) =>
    invoiceService.searchLink("Project", query)

  const handleFetch = async () => {
    if (!fromTime || !toTime) {
      setError("From and To dates are required")
      return
    }
    setError("")
    setLoading(true)
    try {
      const rows = await invoiceService.getProjectwiseTimesheetData({
        from_time: fromTime,
        to_time: toTime,
        project: selectedProject,
      })
      const mappedRows = (Array.isArray(rows) ? rows : []).map((r) => ({
        id: crypto.randomUUID(),
        activity_type: (r.activity_type as string) || "",
        description: (r.description as string) || "",
        billing_hours: Number(r.billing_hours ?? 0),
        billing_amount: Number(r.billing_amount ?? 0),
      }))
      if (itemCode) {
        const totalHours = mappedRows.reduce((sum, r) => sum + (r.billing_hours as number), 0)
        onItemsFetched([{ item_code: itemCode, qty: totalHours, rate: 0 }])
      }
      onTimesheetsFetched(mappedRows)
    } catch (e) {
      console.error("Failed to fetch timesheet data:", e)
      setError(e instanceof Error ? e.message : "Failed to fetch timesheet data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setError("")
          setFromTime("")
          setToTime("")
          setItemCode(undefined)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fetch Timesheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                To <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-border rounded-lg text-sm text-body focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Item Code</label>
            <LinkSearchField
              value={itemCode}
              onChange={setItemCode}
              searchFn={searchItems}
              placeholder="Search Item..."
              docType="Item"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">Project</label>
            <LinkSearchField
              value={selectedProject}
              onChange={setSelectedProject}
              searchFn={searchProjects}
              placeholder="Search Project..."
              docType="Project"
            />
          </div>

          {company && (
            <p className="text-xs text-muted">Company: {company}</p>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleFetch} disabled={loading || !fromTime || !toTime}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Fetching..." : "Get Timesheets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
