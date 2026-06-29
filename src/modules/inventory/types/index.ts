export interface Warehouse {
  id: string
  name: string
  location: string
  capacity: number
  usedCapacity: number
  status: "active" | "inactive" | "maintenance"
  createdAt: string
}

export interface WarehouseListResponse {
  items: Warehouse[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface StockTransferItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unit: string
}

export interface StockTransfer {
  id: string
  reference: string
  fromWarehouse: string
  fromWarehouseId: string
  toWarehouse: string
  toWarehouseId: string
  items: StockTransferItem[]
  status: "draft" | "in_transit" | "completed" | "cancelled"
  notes: string
  createdAt: string
  completedAt: string | null
}

export interface StockTransferListResponse {
  items: StockTransfer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface StockCountItem {
  productId: string
  productName: string
  sku: string
  expectedQuantity: number
  actualQuantity: number
  difference: number
  unit: string
}

export interface StockCount {
  id: string
  reference: string
  warehouse: string
  warehouseId: string
  items: StockCountItem[]
  status: "draft" | "in_progress" | "completed" | "cancelled"
  notes: string
  createdAt: string
  completedAt: string | null
}

export interface StockCountListResponse {
  items: StockCount[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface InventoryMovement {
  id: string
  date: string
  productId: string
  productName: string
  sku: string
  type: "in" | "out" | "transfer" | "adjustment"
  quantity: number
  reference: string
  warehouse: string
}

export interface InventoryMovementListResponse {
  items: InventoryMovement[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface InventorySummary {
  totalProducts: number
  totalWarehouses: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  pendingTransfers: number
  pendingCounts: number
}
