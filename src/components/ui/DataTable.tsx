import { useState, useMemo } from "react"
import { Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (query: string) => void
  searchQuery?: string
  pageSize?: number
  total?: number
  page?: number
  onPageChange?: (page: number) => void
  loading?: boolean
  onRowClick?: (item: T) => void
  toolbarActions?: React.ReactNode
  emptyState?: React.ReactNode
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchable = false,
  searchPlaceholder = "Search...",
  onSearch,
  searchQuery = "",
  pageSize = 10,
  total,
  page: controlledPage,
  onPageChange,
  loading = false,
  onRowClick,
  toolbarActions,
  emptyState,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1)
  const [internalSearch, setInternalSearch] = useState("")

  const isControlled = controlledPage !== undefined && onPageChange !== undefined
  const currentPage = isControlled ? controlledPage! : internalPage
  const totalItems = total ?? data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const paginatedData = useMemo(() => {
    if (isControlled) return data
    const start = (internalPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, internalPage, pageSize, isControlled])

  const displayedData = isControlled ? data : paginatedData

  const goToPage = (p: number) => {
    if (isControlled) onPageChange(p)
    else setInternalPage(p)
  }

  const getPageNumbers = () => {
    const pages: number[] = []
    const maxVisible = 5
    const half = Math.floor(maxVisible / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      {(searchable || toolbarActions) && (
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border">
          {searchable && (
            <div className="relative max-w-xs w-full">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                value={searchQuery || internalSearch}
                onChange={(e) => {
                  const val = e.target.value
                  if (onSearch) {
                    onSearch(val)
                  } else {
                    setInternalSearch(val)
                    setInternalPage(1)
                  }
                }}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3.5 py-1.5 bg-gray-50 border border-border rounded-lg text-sm text-body placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all duration-200"
              />
            </div>
          )}
          {toolbarActions && <div className="flex items-center gap-2">{toolbarActions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50/80">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-5 py-3 text-left text-xs font-medium text-muted/80",
                    col.hideOnMobile && "hidden lg:table-cell",
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && <ChevronDown size={11} className="text-muted/40" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-5 py-3">
                      <div
                        className={cn(
                          "h-4 bg-gray-100 rounded-md animate-pulse",
                          i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3"
                        )}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-16 text-center text-sm text-muted"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center gap-1.5">
                      <p className="font-medium text-body">No results found</p>
                      <p className="text-xs text-muted">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayedData.map((item) => (
                <tr
                  key={keyExtractor(item)}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors duration-150",
                    onRowClick ? "cursor-pointer hover:bg-gray-50/60" : ""
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-5 py-3 text-sm text-body whitespace-nowrap",
                        col.hideOnMobile && "hidden lg:table-cell",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as any)[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-gray-50/30">
          <p className="text-xs text-muted">
            <span className="font-medium text-body">{(currentPage - 1) * pageSize + 1}</span>
            {" — "}
            <span className="font-medium text-body">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>
            {" of "}
            <span className="font-medium text-body">{totalItems}</span>
          </p>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md text-muted hover:text-body hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={15} />
            </button>
            {getPageNumbers().map((p) => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={cn(
                  "min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors",
                  p === currentPage
                    ? "bg-primary-600 text-white"
                    : "text-muted hover:text-body hover:bg-gray-100"
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md text-muted hover:text-body hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
