import { useState, useEffect, useCallback } from "react"
import { productService, type ProductListResponse } from "@/services"
import type { ProductFilter } from "../types"

interface UseProductsOptions {
  pageSize?: number
}

interface UseProductsResult {
  data: ProductListResponse | null
  loading: boolean
  error: string | null
  search: string
  setSearch: (query: string) => void
  page: number
  setPage: (page: number) => void
  filter: ProductFilter
  setFilter: (filter: ProductFilter) => void
  refetch: () => Promise<void>
}

export function useProducts(options: UseProductsOptions = {}): UseProductsResult {
  const pageSize = options.pageSize ?? 10

  const [data, setData] = useState<ProductListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearchState] = useState("")
  const [page, setPageState] = useState(1)
  const [filter, setFilterState] = useState<ProductFilter>("All")

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await productService.list({ search, page, pageSize, filter })
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.")
    } finally {
      setLoading(false)
    }
  }, [search, page, pageSize, filter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const setSearch = useCallback((query: string) => {
    setSearchState(query)
    setPageState(1)
  }, [])

  const setPage = useCallback((nextPage: number) => {
    setPageState(nextPage)
  }, [])

  const setFilter = useCallback((f: ProductFilter) => {
    setFilterState(f)
    setPageState(1)
  }, [])

  return { data, loading, error, search, setSearch, page, setPage, filter, setFilter, refetch: fetchData }
}
