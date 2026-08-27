"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Loader2, Target } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
} from "@/components/ui"
import { inputClass } from "@/components/ui/form-fields"
import { customerService } from "@/modules/customers/services"

interface GetItemsFromOpportunityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (sourceName: string) => void
}

const STATUS_FILTERS: unknown[][] = [["status", "not in", ["Lost", "Closed", "Converted"]]]

export default function GetItemsFromOpportunityDialog({
  open,
  onOpenChange,
  onSelect,
}: GetItemsFromOpportunityDialogProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Array<{ value: string; label: string; description: string }>>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      setResults([])
      setSelected(null)
      return
    }
    void runSearch("")
  }, [open])

  const runSearch = async (term: string) => {
    setLoading(true)
    try {
      const items = await customerService.searchLink(
        "Opportunity",
        term,
        "Quotation",
        STATUS_FILTERS,
      )
      setResults(items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleQueryChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void runSearch(value), 250)
  }

  const handleConfirm = () => {
    if (!selected) return
    onSelect(selected)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Get Items From Opportunity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted">
            Pick a non-lost, non-converted opportunity to map into a new
            quotation.
          </p>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className={`${inputClass} pl-9`}
              placeholder="Search by opportunity name, title, or customer…"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
            />
          </div>
          <div className="border border-border rounded-lg overflow-hidden min-h-[120px]">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
                <Loader2 size={16} className="animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted text-sm">
                <Target size={16} /> No open opportunities found.
              </div>
            ) : (
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {results.map((r) => (
                  <li
                    key={r.value}
                    className={`px-4 py-2.5 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      selected === r.value ? "bg-primary-50/60" : "hover:bg-gray-50"
                    }`}
                    onClick={() => setSelected(r.value)}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.label || r.value}</div>
                      <div className="text-xs text-muted truncate">
                        {r.value}
                        {r.description ? ` • ${r.description}` : ""}
                      </div>
                    </div>
                    <span className="shrink-0 h-4 w-4 rounded-full border border-border flex items-center justify-center">
                      {selected === r.value && <span className="h-2 w-2 rounded-full bg-primary-600" />}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!selected}>
            Get Items
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}