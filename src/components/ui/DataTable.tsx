import { useState, useMemo } from "react"
import { motion } from "framer-motion"
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

  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      {/* Toolbar */}
      {(searchable || toolbarActions) && (
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          {searchable && (
            <div className="relative max-w-xs w-full">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
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
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 focus:bg-white transition-all duration-200"
              />
            </div>
          )}
          {toolbarActions && <div className="flex items-center gap-2">{toolbarActions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-gray-50/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-3.5 text-left text-xs font-semibold text-muted uppercase tracking-wider",
                    col.hideOnMobile && "hidden lg:table-cell",
                    col.className
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <ChevronDown size={12} className="text-muted/50" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-5 bg-gray-100 rounded-[8px] w-3/4 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-16 text-center text-sm text-muted"
                >
                  {emptyState ?? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="font-semibold text-body">No results found</p>
                      <p className="text-xs">Try adjusting your search or filters.</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              displayedData.map((item, idx) => (
                <motion.tr
                  key={keyExtractor(item)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-gray-50/80" : ""
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-6 py-4 text-sm text-body whitespace-nowrap",
                        col.hideOnMobile && "hidden lg:table-cell",
                        col.className
                      )}
                    >
                      {col.render
                        ? col.render(item)
                        : String((item as any)[col.key] ?? "")}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-gray-50/30">
          <p className="text-xs text-muted">
            Showing{" "}
            <span className="font-semibold text-body">
              {(currentPage - 1) * pageSize + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-body">
              {Math.min(currentPage * pageSize, totalItems)}
            </span>{" "}
            of <span className="font-semibold text-body">{totalItems}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const start = Math.max(1, currentPage - 2)
              const p = start + i
              if (p > totalPages) return null
              return (
                <button
                  key={p}
                  onClick={() => goToPage(p)}
                  className={cn(
                    "w-8 h-8 rounded-[10px] text-xs font-semibold transition-colors",
                    p === currentPage
                      ? "bg-primary-600 text-white shadow-sm"
                      : "text-muted hover:bg-gray-100"
                  )}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-2 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
