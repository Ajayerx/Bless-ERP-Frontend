import { useState, useEffect, useCallback } from "react"
import { customerService, type Customer, type CustomerListResponse } from "@/services"

export type StatusFilter = "all" | "active" | "disabled" | "frozen"

interface UseCustomersOptions {
  pageSize?: number
  statusFilter?: StatusFilter
}

interface UseCustomersResult {
  data: CustomerListResponse | null
  allItems: Customer[]
  loading: boolean
  error: string | null
  search: string
  setSearch: (query: string) => void
  start: number
  setStart: (start: number) => void
  pageLength: number
  setPageLength: (size: number) => void
  fetchData: (append?: boolean) => Promise<void>
  refetch: () => Promise<void>
}

function statusToFilters(filter: StatusFilter): unknown[] {
  switch (filter) {
    case "active": return [["disabled", "=", 0]]
    case "disabled": return [["disabled", "=", 1]]
    case "frozen": return [["is_frozen", "=", 1]]
    default: return []
  }
}

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersResult {
  const pageLengthOpt = options.pageSize ?? 20
  const statusFilter = options.statusFilter ?? "all"

  const [data, setData] = useState<CustomerListResponse | null>(null)
  const [allItems, setAllItems] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchState] = useState("")
  const [start, setStart] = useState(0)
  const [pageLength, setPageLength] = useState(pageLengthOpt)

  const fetchData = useCallback(async (append = false) => {
    setLoading(true)
    setError(null)
    try {
      const filters = statusToFilters(statusFilter)
      const result = await customerService.list({
        search: search || undefined,
        start: append ? start : 0,
        pageLength,
        filters,
      })
      setData(result)
      setAllItems((prev) => (append ? [...prev, ...result.items] : result.items))
      if (!append) setStart(pageLength)
      else setStart((s) => s + pageLength)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers.")
    } finally {
      setLoading(false)
    }
  }, [search, start, pageLength, statusFilter])

  useEffect(() => {
    setStart(0)
    setAllItems([])
    fetchData(false)
  }, [search, pageLength, statusFilter])

  const setSearch = useCallback((query: string) => {
    setSearchState(query)
    setStart(0)
  }, [])

  return {
    data,
    allItems,
    loading,
    error,
    search,
    setSearch,
    start,
    setStart,
    pageLength,
    setPageLength,
    fetchData,
    refetch: () => fetchData(false),
  }
}
