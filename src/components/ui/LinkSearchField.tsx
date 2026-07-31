import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X, Plus, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type SearchResult = { value: string; label: string; description: string }

interface LinkSearchFieldProps {
  value?: string
  onChange?: (value: string | undefined) => void
  searchFn: (query: string) => Promise<{ items: SearchResult[] }>
  onCreateNew?: () => void
  onAdvancedSearch?: () => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  label?: string
  required?: boolean
  className?: string
  inputClassName?: string
  docType?: string
}

export default function LinkSearchField({
  value,
  onChange,
  searchFn,
  onCreateNew,
  onAdvancedSearch,
  placeholder = "Begin typing for results.",
  disabled = false,
  readOnly = false,
  label,
  required = false,
  className,
  inputClassName,
  docType = "sales-invoice",
}: LinkSearchFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedLabel, setSelectedLabel] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchFnRef = useRef(searchFn)
  const fetchedRef = useRef(false)
  searchFnRef.current = searchFn

  const doSearch = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await searchFnRef.current(q)
      setResults(res.items)
      if (!q && value && !selectedLabel && fetchedRef.current) {
        const match = res.items.find((item) => item.value === value)
        if (match) {
          setSelectedLabel(match.label || match.value)
          setQuery(match.label || match.value)
        }
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [value, selectedLabel])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!value) {
      setQuery("")
      setSelectedLabel("")
    }
  }, [value])

  const handleSelect = (item: SearchResult) => {
    onChange?.(item.value)
    setQuery(item.label || item.value)
    setSelectedLabel(item.label || item.value)
    setResults([])
    setOpen(false)
    setHighlightedIndex(-1)
  }

  const handleClear = () => {
    onChange?.(undefined)
    setQuery("")
    setSelectedLabel("")
    setResults([])
    setHighlightedIndex(-1)
    fetchedRef.current = false
    inputRef.current?.focus()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (!open) setOpen(true)
    setHighlightedIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) {
      if (fetchedRef.current) doSearch("")
    } else {
      debounceRef.current = setTimeout(() => doSearch(val), 500)
    }
  }

  const handleFocus = () => {
    if (readOnly) return
    setOpen(true)
    if (!fetchedRef.current) {
      fetchedRef.current = true
      doSearch("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return
    const totalItems = results.length + (onCreateNew ? 1 : 0) + (onAdvancedSearch ? 1 : 0)
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev + 1) % totalItems)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < results.length) {
        handleSelect(results[highlightedIndex])
      } else if (onCreateNew && highlightedIndex === results.length) {
        onCreateNew()
        setOpen(false)
      } else if (onAdvancedSearch && highlightedIndex === results.length + (onCreateNew ? 1 : 0)) {
        onAdvancedSearch()
        setOpen(false)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const showDropdown = open && !readOnly

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="block text-xs font-semibold text-muted mb-1.5">
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <div ref={wrapperRef} className="relative">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className={cn(
              "w-full px-3 py-2.5 bg-white border border-border rounded-lg text-sm text-body placeholder:text-muted transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
              value && !query ? "pr-20" : "pr-8",
              (disabled || readOnly) ? "bg-gray-50 cursor-not-allowed opacity-70" : "",
              inputClassName,
            )}
          />
          {value && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-8 p-1 text-muted hover:text-heading transition-colors"
              tabIndex={-1}
            >
              <X size={14} />
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => {
                window.open(`/app/${docType}/${encodeURIComponent(value)}`, "_blank")
              }}
              className="absolute right-2 p-1 text-muted hover:text-heading transition-colors"
              tabIndex={-1}
            >
              <ArrowRight size={14} />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
            {loading && results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">Searching...</div>
            ) : results.length > 0 ? (
              <>
                <div className="divide-y divide-border/50">
                  {results.map((item, idx) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "w-full text-left px-3 py-2.5 transition-colors text-sm",
                        idx === highlightedIndex
                          ? "bg-primary-50"
                          : "hover:bg-gray-50"
                      )}
                    >
                      <div className="font-semibold text-heading">{item.label || item.value}</div>
                      {item.value && (
                        <div className="text-xs text-muted mt-0.5 truncate">
                          {item.value}{item.description ? `, ${item.description}` : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border divide-y divide-border/50">
                  {onCreateNew && (
                    <button
                      type="button"
                      onClick={() => { onCreateNew(); setOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm text-primary-600 hover:bg-primary-50/50 flex items-center gap-2 transition-colors",
                        highlightedIndex === results.length && "bg-primary-50"
                      )}
                    >
                      <Plus size={14} />
                      Create New
                    </button>
                  )}
                  {onAdvancedSearch && (
                    <button
                      type="button"
                      onClick={() => { onAdvancedSearch(); setOpen(false) }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm text-muted hover:bg-gray-50 flex items-center gap-2 transition-colors",
                        highlightedIndex === results.length + (onCreateNew ? 1 : 0) && "bg-gray-100"
                      )}
                    >
                      <Search size={14} />
                      Advanced Search
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="px-4 py-3">
                <p className="text-sm text-muted">No results found</p>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={() => { onCreateNew(); setOpen(false) }}
                    className="mt-2 text-sm text-primary-600 hover:underline flex items-center gap-1"
                  >
                    <Plus size={14} />
                    Create New
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
