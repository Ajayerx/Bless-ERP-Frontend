import { useEffect, useState, useRef, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Users, Package, FileText, CreditCard, ShoppingBag, Warehouse, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui"
import { cn } from "@/lib/utils"
import { searchService, type SearchResult } from "@/services/search.service"

const typeConfig: Record<SearchResult["type"], { icon: typeof Users; label: string }> = {
  customer: { icon: Users, label: "Customer" },
  product: { icon: Package, label: "Product" },
  invoice: { icon: FileText, label: "Invoice" },
  payment: { icon: CreditCard, label: "Payment" },
  sales_order: { icon: ShoppingBag, label: "Sales Order" },
  warehouse: { icon: Warehouse, label: "Warehouse" },
}

export default function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery("")
      setResults([])
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await searchService.search(query)
      setResults(res)
      setLoading(false)
      setSelectedIndex(0)
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onOpenChange(false)
      navigate(result.route)
    },
    [navigate, onOpenChange],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter" && results[selectedIndex]) {
      handleSelect(results[selectedIndex])
    }
  }

  const grouped = results.reduce(
    (acc, r) => {
      const group = typeConfig[r.type]?.label || "Other"
      if (!acc[group]) acc[group] = []
      acc[group].push(r)
      return acc
    },
    {} as Record<string, SearchResult[]>,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="max-w-lg top-[15vh] -translate-x-1/2 translate-y-0 p-0 gap-0 overflow-hidden rounded-[16px]">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search size={16} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search customers, products, invoices..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full py-3.5 text-sm bg-transparent text-heading placeholder:text-muted focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-muted shrink-0">
            ESC
          </kbd>
        </div>

        <div className="max-h-[300px] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && query.trim() && Object.keys(grouped).length === 0 && (
            <div className="py-8 text-center text-sm text-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}

          {!loading &&
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-2 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wider">
                  {group}
                </p>
                {items.map((item, idx) => {
                  const globalIdx = results.indexOf(item)
                  const Icon = typeConfig[item.type]?.icon || Search
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "flex items-center gap-3 w-full px-2 py-2 rounded-[10px] text-left text-sm transition-colors",
                        selectedIndex === globalIdx
                          ? "bg-primary-50 text-primary-600"
                          : "text-body hover:bg-gray-50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0",
                          selectedIndex === globalIdx ? "bg-primary-100" : "bg-gray-100",
                        )}
                      >
                        <Icon size={14} className={cn(selectedIndex === globalIdx ? "text-primary-600" : "text-muted")} />
                      </div>
                      <span className="flex-1 truncate">{item.label}</span>
                      <ArrowRight size={12} className="text-muted shrink-0 opacity-0 group-hover:opacity-100" />
                    </button>
                  )
                })}
              </div>
            ))}

          {!query.trim() && (
            <div className="py-8 text-center text-sm text-muted">
              Start typing to search across your data
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
