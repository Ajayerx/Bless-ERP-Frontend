"use client"

import { useState, useEffect, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui"
import { Button } from "@/components/ui"
import { invoiceService } from "@/services"
import { cn } from "@/lib/utils"

interface SourceDoc {
  name: string
  [key: string]: unknown
}

interface ChildItem {
  name: string
  item_code: string
  item_name: string
  qty: number
  amount: number
  [key: string]: unknown
}

interface GetItemsFromModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceDoctype: string
  method: string
  title: string
  setters?: Record<string, string | undefined>
  childFieldname?: string
  childColumns?: string[]
  customer?: string
  company?: string
  formData?: Record<string, unknown>
  onItemsFetched: (items: Array<Record<string, unknown>>) => void
}

export default function GetItemsFromModal({
  open,
  onOpenChange,
  sourceDoctype,
  method,
  title,
  setters,
  childFieldname,
  childColumns,
  customer,
  company,
  formData,
  onItemsFetched,
}: GetItemsFromModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [results, setResults] = useState<SourceDoc[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [childItems, setChildItems] = useState<ChildItem[]>([])
  const [selectedChildItems, setSelectedChildItems] = useState<Set<string>>(new Set())
  const [childLoading, setChildLoading] = useState(false)
  const [fetching, setFetching] = useState(false)

  const searchDocs = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const filters: Record<string, unknown> = {}
      if (company) filters["company"] = company
      if (sourceDoctype === "Sales Order") {
        filters["docstatus"] = 1
        filters["status"] = ["not in", ["Closed", "On Hold"]]
      }
      if (sourceDoctype === "Quotation") {
        filters["docstatus"] = 1
        filters["status"] = ["!=", "Lost"]
      }
      if (sourceDoctype === "Delivery Note") {
        filters["docstatus"] = 1
        filters["is_return"] = 0
      }

      const result = await invoiceService.searchLink(sourceDoctype, query, {
        filters,
        page_length: 20,
      })
      setResults(result.items.map((i) => ({ name: i.value, ...(i.label ? { label: i.label } : {}) })))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [sourceDoctype, company])

  useEffect(() => {
    if (open) {
      setSearchTerm("")
      setResults([])
      setSelectedDocs(new Set())
      setChildItems([])
      setSelectedChildItems(new Set())
      searchDocs("")
    }
  }, [open, searchDocs])

  const toggleDoc = (name: string) => {
    const next = new Set(selectedDocs)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelectedDocs(next)
    if (childFieldname && next.size > 0) {
      fetchChildItems(Array.from(next))
    } else {
      setChildItems([])
    }
  }

  const fetchChildItems = async (docNames: string[]) => {
    if (docNames.length === 0) return
    setChildLoading(true)
    try {
      const items: ChildItem[] = []
      for (const name of docNames) {
        const doc = await invoiceService.getDoc(sourceDoctype, name)
        const children = (doc as Record<string, unknown>)[childFieldname ?? "items"] as ChildItem[] | undefined
        if (children) {
          items.push(...children)
        }
      }
      setChildItems(items)
    } catch {
      setChildItems([])
    } finally {
      setChildLoading(false)
    }
  }

  const toggleChildItem = (name: string) => {
    const next = new Set(selectedChildItems)
    if (next.has(name)) {
      next.delete(name)
    } else {
      next.add(name)
    }
    setSelectedChildItems(next)
  }

  const handleGetItems = async () => {
    if (selectedDocs.size === 0) return
    setFetching(true)
    try {
      const targetDoc: Record<string, unknown> = {}
      if (customer) targetDoc["customer"] = customer
      if (company) targetDoc["company"] = company
      if (formData) {
        Object.assign(targetDoc, formData)
      }

      const args: Record<string, unknown> = {}
      if (childFieldname && selectedChildItems.size > 0) {
        args["filtered_children"] = Array.from(selectedChildItems)
      }

      const result = await invoiceService.mapSourceDocuments(
        method,
        Array.from(selectedDocs),
        targetDoc,
        args,
      )

      const items = (result as Record<string, unknown>)[childFieldname ?? "items"] as Array<Record<string, unknown>> | undefined
      if (items) {
        onItemsFetched(items.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
        })))
      }
      onOpenChange(false)
    } catch (e) {
      console.error("Failed to fetch items:", e)
    } finally {
      setFetching(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Search */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                searchDocs(e.target.value)
              }}
              placeholder={`Search ${sourceDoctype}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>

          {/* Setters display */}
          {setters && Object.keys(setters).length > 0 && (
            <div className="flex gap-4 text-sm text-muted">
              {Object.entries(setters).map(([key, value]) => (
                <span key={key} className="flex items-center gap-1">
                  <span className="font-semibold">{key}:</span>
                  <span>{value || "Any"}</span>
                </span>
              ))}
            </div>
          )}

          {/* Results */}
          <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted">Searching...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted">No {sourceDoctype} found.</div>
            ) : (
              results.map((doc) => (
                <label
                  key={doc.name}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors",
                    selectedDocs.has(doc.name) && "bg-primary-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.has(doc.name)}
                    onChange={() => toggleDoc(doc.name)}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span className="text-sm font-medium text-body">{doc.name}</span>
                  {(doc as Record<string, string>).label && (
                    <span className="text-xs text-muted">{(doc as Record<string, string>).label}</span>
                  )}
                </label>
              ))
            )}
          </div>

          {/* Child items */}
          {childFieldname && selectedDocs.size > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                Select Items from {sourceDoctype}
              </label>
              <div className="border border-border rounded-lg max-h-48 overflow-y-auto">
                {childLoading ? (
                  <div className="p-4 text-center text-sm text-muted">Loading items...</div>
                ) : childItems.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted">No items found.</div>
                ) : (
                  childItems.map((item) => (
                    <label
                      key={item.name}
                      className="flex items-center gap-3 px-4 py-2 border-b border-border/50 last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedChildItems.has(item.name)}
                        onChange={() => toggleChildItem(item.name)}
                        className="h-4 w-4 rounded border-border"
                      />
                      <div className="flex-1 grid grid-cols-4 gap-4 text-sm">
                        <span className="text-body font-medium">{item.item_code}</span>
                        <span className="text-muted truncate">{item.item_name}</span>
                        <span className="text-right text-body tabular-nums">{item.qty}</span>
                        <span className="text-right text-body tabular-nums">{item.amount}</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
              {childColumns && childItems.length > 0 && (
                <div className="flex gap-4 text-xs text-muted px-4 mt-1">
                  <span className="flex-1">Item Code</span>
                  <span className="flex-1">Item Name</span>
                  <span className="w-16 text-right">Qty</span>
                  <span className="w-20 text-right">Amount</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={fetching}>
            Cancel
          </Button>
          <Button onClick={handleGetItems} disabled={selectedDocs.size === 0 || fetching}>
            {fetching ? <Loader2 size={14} className="animate-spin" /> : null}
            {fetching ? "Fetching..." : "Get Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
