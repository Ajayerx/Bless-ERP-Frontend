import { useState, useEffect, useCallback } from "react"
import { customerService, type CustomerListResponse } from "@/services"

interface UseCustomersOptions {
    pageSize?: number
}

interface UseCustomersResult {
    data: CustomerListResponse | null
    loading: boolean
    error: string | null
    search: string
    setSearch: (query: string) => void
    page: number
    setPage: (page: number) => void
    refetch: () => Promise<void>
}

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersResult {
    const pageSize = options.pageSize ?? 10

    const [data, setData] = useState<CustomerListResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearchState] = useState("")
    const [page, setPageState] = useState(1)

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await customerService.list({ search, page, pageSize })
            setData(result)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load customers.")
        } finally {
            setLoading(false)
        }
    }, [search, page, pageSize])

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

    return { data, loading, error, search, setSearch, page, setPage, refetch: fetchData }
}
