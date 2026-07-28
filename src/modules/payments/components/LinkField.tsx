import { useState, useEffect, useRef, useCallback } from "react"
import { Search, ChevronDown, X, Loader2 } from "lucide-react"
import { apiClient } from "@/services/api-client"
import { cn } from "@/lib/utils"

interface LinkFieldProps {
  doctype: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  filters?: unknown[][]
  labelField?: string
  required?: boolean
  disabled?: boolean
  className?: string
  error?: string
}

export default function LinkField({
  doctype,
  value,
  onChange,
  label,
  placeholder = "Search...",
  filters = [],
  labelField,
  required = false,
  disabled = false,
  className,
  error,
}: LinkFieldProps) {
  const [query, setQuery] = useState("")
  const [options, setOptions] = useState<Array<{ name: string; label?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Store filters/fetch config in refs so the fetch effect doesn't re-run when parent re-renders
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const doctypeRef = useRef(doctype)
  doctypeRef.current = doctype
  const labelFieldRef = useRef(labelField)
  labelFieldRef.current = labelField

  const fetchOptions = useCallback(
    async (search: string) => {
      setLoading(true)
      try {
        const searchFilters: unknown[][] = search
          ? [["name", "like", `%${search}%`]]
          : []
        const allFilters = [...filtersRef.current, ...searchFilters]

        const fields = labelFieldRef.current ? ["name", labelFieldRef.current] : ["name"]
        const qp = new URLSearchParams()
        qp.set("fields", JSON.stringify(fields))
        qp.set("filters", JSON.stringify(allFilters))
        qp.set("limit_page_length", "20")
        qp.set("order_by", "name asc")

        const items = await apiClient<Array<{ name: string; [key: string]: unknown }>>(
          `/resource/${encodeURIComponent(doctypeRef.current)}?${qp.toString()}`
        )
        setOptions(items.map((i) => ({
          name: i.name,
          label: labelFieldRef.current ? (i[labelFieldRef.current] as string) : undefined,
        })))
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    },
    [] // no deps — reads everything from refs
  )

  // Only refetch when query or open changes — NOT when filters/doctype change
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchOptions(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, open, fetchOptions])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const selectOption = (name: string) => {
    onChange(name)
    setQuery("")
    setOpen(false)
    setHighlightIndex(-1)
  }

  const clearValue = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
    setQuery("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true)
        e.preventDefault()
      }
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.min(prev + 1, options.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightIndex >= 0 && highlightIndex < options.length) {
        selectOption(options[highlightIndex].name)
      }
    } else if (e.key === "Escape") {
      setOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {label && (
        <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
          {label}{required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <div
        className={cn(
          "flex items-center w-full px-3 py-2.5 bg-white border rounded-[12px] text-sm transition-all duration-200 cursor-text",
          error ? "border-danger-500 focus-within:ring-2 focus-within:ring-danger-500/20" : "border-border focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20",
          disabled && "opacity-50 cursor-not-allowed bg-gray-50"
        )}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus() } }}
      >
        {value ? (
          <span className="flex-1 text-body font-medium truncate">{value}</span>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent outline-none text-body placeholder:text-muted"
          />
        )}
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && !disabled && (
            <button type="button" onClick={clearValue} className="p-0.5 text-muted hover:text-body transition-colors">
              <X size={14} />
            </button>
          )}
          {loading ? (
            <Loader2 size={14} className="text-muted animate-spin" />
          ) : (
            <ChevronDown size={14} className={cn("text-muted transition-transform", open && "rotate-180")} />
          )}
        </div>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-56 overflow-y-auto overscroll-contain">
          {options.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-muted">No results found</p>
          )}
          {options.map((opt, idx) => (
            <button
              key={opt.name}
              type="button"
              onClick={() => selectOption(opt.name)}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm transition-colors",
                idx === highlightIndex ? "bg-primary-50 text-primary-700" : "text-body hover:bg-gray-50",
                value === opt.name && "font-semibold bg-primary-50/50"
              )}
            >
              <span className="font-medium">{opt.name}</span>
              {opt.label && opt.label !== opt.name && (
                <span className="text-xs text-muted ml-2">{opt.label}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
    </div>
  )
}
