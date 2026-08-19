import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Plus, ChevronRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { invoiceService } from "@/services"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type InvoiceResult = {
  name: string
  customer_name: string
  posting_date: string
  grand_total: number
  status: string
  currency: string
}

interface ReturnAgainstSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (invoiceName: string) => void
  onCreateNew?: () => void
  customer?: string
  company?: string
}

export default function ReturnAgainstSearchModal({
  open,
  onOpenChange,
  onSelect,
  onCreateNew,
  customer,
}: ReturnAgainstSearchModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<InvoiceResult[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const PAGE_SIZE = 10

  const doSearch = useCallback(async (q: string, p: number, append = false) => {
    setLoading(true)
    try {
      const res = await invoiceService.list({
        search: q || undefined,
        page: p,
        pageSize: PAGE_SIZE,
        status: "submitted",
        customerId: customer || undefined,
      })
      const rows = (res.items || []).map((inv) => ({
        name: inv.name,
        customer_name: inv.customer_name || inv.customer || "",
        posting_date: inv.posting_date || "",
        grand_total: inv.grand_total || 0,
        status: inv.status || "",
        currency: inv.currency || "",
      }))
      if (append) {
        setResults((prev) => [...prev, ...rows])
      } else {
        setResults(rows)
      }
      setHasMore(rows.length >= PAGE_SIZE)
    } catch {
      if (!append) setResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [customer])

  useEffect(() => {
    if (open) {
      setQuery("")
      setPage(1)
      setResults([])
      setTimeout(() => searchInputRef.current?.focus(), 100)
      doSearch("", 1)
    }
  }, [open, doSearch])

  const handleSearch = (val: string) => {
    setQuery(val)
    setPage(1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val, 1), 300)
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    doSearch(query, nextPage, true)
  }

  const handleSelect = (name: string) => {
    onSelect(name)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Select Sales Invoice</DialogTitle>
        </DialogHeader>

        <div className="px-6 pt-4 pb-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Beginning with"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1)
                  doSearch(query, 1)
                }
              }}
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all bg-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2 min-h-0">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted gap-2">
              <Loader2 size={16} className="animate-spin" />
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted">No Results</p>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={() => { onCreateNew(); onOpenChange(false) }}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-[10px] hover:bg-primary-100 transition-colors"
                >
                  <Plus size={14} />
                  Create a new Sales Invoice
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-3 py-2.5 font-semibold text-muted text-xs">Invoice</th>
                      <th className="px-3 py-2.5 font-semibold text-muted text-xs">Customer</th>
                      <th className="px-3 py-2.5 font-semibold text-muted text-xs">Date</th>
                      <th className="px-3 py-2.5 font-semibold text-muted text-xs text-right">Amount</th>
                      <th className="px-3 py-2.5 font-semibold text-muted text-xs">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {results.map((inv) => (
                      <tr
                        key={inv.name}
                        onClick={() => handleSelect(inv.name)}
                        className="hover:bg-primary-50/50 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-2.5 font-semibold text-heading">{inv.name}</td>
                        <td className="px-3 py-2.5 text-body truncate max-w-[160px]">{inv.customer_name}</td>
                        <td className="px-3 py-2.5 text-muted">{inv.posting_date}</td>
                        <td className="px-3 py-2.5 text-body text-right font-medium">
                          {inv.grand_total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 text-xs font-medium rounded-full",
                            inv.status === "Paid" && "bg-green-50 text-green-700",
                            inv.status === "Unpaid" && "bg-amber-50 text-amber-700",
                            inv.status === "Overdue" && "bg-red-50 text-red-700",
                            inv.status === "Draft" && "bg-gray-100 text-gray-600",
                            inv.status === "Submitted" && "bg-blue-50 text-blue-700",
                            !["Paid", "Unpaid", "Overdue", "Draft", "Submitted"].includes(inv.status) && "bg-gray-100 text-gray-600",
                          )}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore && (
                <div className="flex justify-center py-3">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted bg-gray-100 rounded-[10px] hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
