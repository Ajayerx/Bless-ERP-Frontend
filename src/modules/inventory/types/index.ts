// --- Warehouse (ERPNext: Warehouse) ---
export interface Warehouse {
  name: string
  warehouse_name: string
  company: string
  parent_warehouse?: string
  warehouse_type?: string
  is_group: number
  disabled: number
  is_rejected_warehouse?: number
  account?: string
  customer?: string
  address_line_1?: string
  address_line_2?: string
  city?: string
  state?: string
  pin?: string
  phone_no?: string
  mobile_no?: string
  email_id?: string
  creation: string
  modified: string
}

export interface WarehouseListResponse {
  items: Warehouse[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Stock Transfer (ERPNext: Stock Entry, purpose "Material Transfer") ---
export interface StockTransferItem {
  item_code: string
  item_name?: string
  qty: number
  uom: string
  stock_uom?: string
  s_warehouse?: string
  t_warehouse?: string
  basic_rate?: number
  conversion_factor?: number
}

export interface StockTransfer {
  name: string
  stock_entry_type: string
  company: string
  from_warehouse?: string
  to_warehouse?: string
  items: StockTransferItem[]
  posting_date: string
  posting_time: string
  docstatus: number
  status?: string
  remarks?: string
  creation: string
  modified: string
}

export interface StockTransferListResponse {
  items: StockTransfer[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Stock Count (ERPNext: Stock Reconciliation) ---
export interface StockCountItem {
  item_code: string
  item_name?: string
  warehouse: string
  qty: number
  valuation_rate?: number
  current_qty?: number
  current_valuation_rate?: number
  quantity_difference?: number
  amount_difference?: number
  stock_uom?: string
  allow_zero_valuation_rate?: number
}

export interface StockCount {
  name: string
  company: string
  purpose: "Opening Stock" | "Stock Reconciliation"
  posting_date: string
  posting_time: string
  set_warehouse?: string
  items: StockCountItem[]
  docstatus: number
  expense_account?: string
  cost_center?: string
  difference_amount?: number
  amended_from?: string
  creation: string
  modified: string
}

export interface StockCountListResponse {
  items: StockCount[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Inventory Movement (ERPNext: Stock Ledger Entry, read-only) ---
export interface InventoryMovement {
  name: string
  item_code: string
  warehouse: string
  posting_date: string
  posting_time: string
  voucher_type: string
  voucher_no: string
  actual_qty: number
  qty_after_transaction: number
  valuation_rate: number
  stock_value: number
  stock_value_difference: number
  incoming_rate?: number
  outgoing_rate?: number
  company: string
  is_cancelled: number
  // computed
  movement_type: "in" | "out" | "transfer" | "adjustment"
  item_name?: string
}

export interface InventoryMovementListResponse {
  items: InventoryMovement[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// --- Summary ---
export interface InventorySummary {
  totalProducts: number
  totalWarehouses: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  pendingTransfers: number
  pendingCounts: number
}
