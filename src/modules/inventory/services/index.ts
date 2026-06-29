import { apiClient } from "@/services/api-client"
import type {
  Warehouse,
  WarehouseListResponse,
  StockTransfer,
  StockTransferListResponse,
  StockCount,
  StockCountListResponse,
  InventoryMovementListResponse,
  InventorySummary,
} from "../types"

export const inventoryService = {
  // --- Warehouses ---
  async listWarehouses(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<WarehouseListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<WarehouseListResponse>(`/warehouses?${qs.toString()}`)
  },

  async getWarehouse(id: string): Promise<Warehouse> {
    return apiClient<Warehouse>(`/warehouses/${id}`)
  },

  async createWarehouse(data: Partial<Warehouse>): Promise<Warehouse> {
    return apiClient<Warehouse>("/warehouses", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<Warehouse> {
    return apiClient<Warehouse>(`/warehouses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  // --- Stock Transfers ---
  async listTransfers(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<StockTransferListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<StockTransferListResponse>(`/stock-transfers?${qs.toString()}`)
  },

  async getTransfer(id: string): Promise<StockTransfer> {
    return apiClient<StockTransfer>(`/stock-transfers/${id}`)
  },

  async createTransfer(data: Partial<StockTransfer>): Promise<StockTransfer> {
    return apiClient<StockTransfer>("/stock-transfers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateTransferStatus(id: string, status: StockTransfer["status"]): Promise<StockTransfer> {
    return apiClient<StockTransfer>(`/stock-transfers/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },

  // --- Stock Counts ---
  async listCounts(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<StockCountListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<StockCountListResponse>(`/stock-counts?${qs.toString()}`)
  },

  async getCount(id: string): Promise<StockCount> {
    return apiClient<StockCount>(`/stock-counts/${id}`)
  },

  async createCount(data: Partial<StockCount>): Promise<StockCount> {
    return apiClient<StockCount>("/stock-counts", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async updateCountStatus(id: string, status: StockCount["status"]): Promise<StockCount> {
    return apiClient<StockCount>(`/stock-counts/${id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    })
  },

  // --- Inventory Movements ---
  async listMovements(params: {
    productId?: string
    warehouse?: string
    type?: string
    page?: number
    pageSize?: number
  }): Promise<InventoryMovementListResponse> {
    const qs = new URLSearchParams()
    if (params.productId) qs.set("productId", params.productId)
    if (params.warehouse) qs.set("warehouse", params.warehouse)
    if (params.type) qs.set("type", params.type)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<InventoryMovementListResponse>(`/inventory-movements?${qs.toString()}`)
  },

  // --- Summary ---
  async getSummary(): Promise<InventorySummary> {
    return apiClient<InventorySummary>("/inventory/summary")
  },
}
