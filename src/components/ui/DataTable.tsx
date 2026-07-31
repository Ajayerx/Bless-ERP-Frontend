import { useState, useMemo, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Checkbox } from "./checkbox"

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  sortable?: boolean
  className?: string
  hideOnMobile?: boolean
  align?: 'left' | 'right' | 'center'
  width?: string
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
  selectable?: boolean
  selectedKeys?: Set<string>
  onSelectionChange?: (keys: Set<string>) => void
  paginationMode?: "pages" | "loadMore"
  currentPageLength?: number
  onPageLengthChange?: (size: number) => void
  onLoadMore?: () => void
}

const PAGE_SIZE_OPTIONS = [20, 100, 500, 2500]

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
  selectable = false,
  selectedKeys,
  onSelectionChange,
  paginationMode = "pages",
  currentPageLength,
  onPageLengthChange,
  onLoadMore,
}: DataTableProps<T>) {
  const [internalPage, setInternalPage] = useState(1)
  const [internalSearch, setInternalSearch] = useState("")
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set())
  const lastClickedIndex = useRef<number | null>(null)

  const isControlled = controlledPage !== undefined && onPageChange !== undefined
  const currentPage = isControlled ? controlledPage! : internalPage
  const totalItems = total ?? data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const controlledSelection = selectable && selectedKeys !== undefined && onSelectionChange !== undefined
  const currentSelection = controlledSelection ? selectedKeys! : internalSelected

  const updateSelection = useCallback((next: Set<string>) => {
    if (controlledSelection) onSelectionChange!(next)
    else setInternalSelected(next)
  }, [controlledSelection, onSelectionChange])

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

  const displayedKeys = useMemo(() => displayedData.map(keyExtractor), [displayedData, keyExtractor])

  const allSelected = selectable && displayedKeys.length > 0 && displayedKeys.every((k) => currentSelection.has(k))
  const someSelected = selectable && displayedKeys.some((k) => currentSelection.has(k))

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(currentSelection)
      displayedKeys.forEach((k) => next.delete(k))
      updateSelection(next)
    } else {
      const next = new Set(currentSelection)
      displayedKeys.forEach((k) => next.add(k))
      updateSelection(next)
    }
  }

  const toggleRow = (key: string, index: number, shiftKey: boolean) => {
    if (shiftKey && lastClickedIndex.current !== null && lastClickedIndex.current !== index) {
      const start = Math.min(lastClickedIndex.current, index)
      const end = Math.max(lastClickedIndex.current, index)
      const keysToToggle = displayedKeys.slice(start, end + 1)
      const next = new Set(currentSelection)
      const allInRangeSelected = keysToToggle.every((k) => next.has(k))
      keysToToggle.forEach((k) => {
        if (allInRangeSelected) next.delete(k)
        else next.add(k)
      })
      updateSelection(next)
    } else {
      const next = new Set(currentSelection)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      updateSelection(next)
    }
    lastClickedIndex.current = index
  }

  const hasMore = total != null ? displayedData.length < total : false

  return (
    <div className="bg-surface rounded-[16px] border border-border shadow-card overflow-hidden">
      {/* Toolbar */}
      {(searchable || toolbarActions || paginationMode === "loadMore") && (
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
          <div className="flex items-center gap-4 ml-auto">
            {paginationMode === "loadMore" && total != null && (
              <span className="text-xs text-muted whitespace-nowrap">
                <span className="font-semibold text-body">{displayedData.length}</span> of{" "}
                <span className="font-semibold text-body">{total}</span>
              </span>
            )}
            {toolbarActions && <div className="flex items-center gap-2">{toolbarActions}</div>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto relative">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-gray-50/50">
              {selectable && (
                <th className="px-4 py-3.5 w-12">
                  <Checkbox
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.dataset.state = someSelected && !allSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"
                    }}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-6 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    col.hideOnMobile && "hidden lg:table-cell",
                    col.width,
                    col.className
                  )}
                >
                    <div className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && <ChevronDown size={12} className="text-muted/50" />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {loading && displayedData.length === 0 ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  {selectable && (
                    <td className="px-4 py-4 w-12">
                      <div className="h-5 w-5 bg-gray-100 rounded-md animate-pulse" />
                    </td>
                  )}
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
                  colSpan={columns.length + (selectable ? 1 : 0)}
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
              displayedData.map((item, idx) => {
                const itemKey = keyExtractor(item)
                const isSelected = currentSelection.has(itemKey)
                return (
                  <motion.tr
                    key={itemKey}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    onClick={() => onRowClick?.(item)}
                    className={cn(
                      "transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-gray-50/80" : "",
                      isSelected && "bg-primary-50/50"
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-4 w-12" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(itemKey, idx, false)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-6 py-4 text-sm text-body whitespace-nowrap",
                          col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                          col.hideOnMobile && "hidden lg:table-cell",
                          col.width,
                          col.className
                        )}
                      >
                        {col.render
                          ? col.render(item)
                          : String((item as any)[col.key] ?? "")}
                      </td>
                    ))}
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
        {loading && displayedData.length > 0 && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-3 px-4 py-2 bg-surface border border-border rounded-lg shadow-sm">
              <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-muted">Loading…</span>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {paginationMode === "loadMore" ? (
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-gray-50/30">
          <div className="flex items-center gap-1">
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => onPageLengthChange?.(size)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition-colors",
                  "border border-border first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0",
                  size === (currentPageLength || pageSize)
                    ? "bg-surface text-body border-border z-10"
                    : "bg-gray-50 text-muted hover:text-body hover:bg-gray-100",
                )}
              >
                {size}
              </button>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-semibold text-body bg-surface border border-border rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Load More
            </button>
          )}
        </div>
      ) : totalPages > 1 ? (
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
      ) : null}
    </div>
  )
}
