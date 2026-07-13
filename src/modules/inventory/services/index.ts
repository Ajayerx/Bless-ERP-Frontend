import { apiClient } from "@/services/api-client"
import type {
  Warehouse, WarehouseListResponse,
  StockTransfer, StockTransferListResponse, StockTransferItem,
  StockCount, StockCountListResponse,
  InventoryMovement, InventoryMovementListResponse,
  InventorySummary,
} from "../types"

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
    group_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  if (params.group_by) qp.set("group_by", params.group_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

async function getCount(doctype: string, filters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  const result = await apiClient<number | string>(
    `/method/frappe.client.get_count?${qp.toString()}`
  )
  return Number(result)
}

async function submitDoc(doctype: string, docname: string): Promise<void> {
  await apiClient("/method/frappe.client.submit", {
    method: "POST",
    body: JSON.stringify({ doctype, docname }),
  })
}

async function cancelDoc(doctype: string, docname: string): Promise<void> {
  await apiClient("/method/frappe.client.cancel", {
    method: "POST",
    body: JSON.stringify({ doctype, docname }),
  })
}

// --- Shared lookup ---
export const inventoryLookups = {
  companies: () => fetchLinkOptions("Company"),
  warehouseTypes: () => fetchLinkOptions("Warehouse Type"),
}

async function fetchLinkOptions(doctype: string, filters?: unknown[]): Promise<string[]> {
  const rows = await apiClient<Array<{ name: string }>>(
    buildListUrl(doctype, {
      fields: ["name"],
      order_by: "name asc",
      limit_page_length: 0,
      filters,
    })
  )
  return rows.map((r) => r.name)
}

// --- Warehouse helpers ---
const WAREHOUSE_FIELDS = [
  "name", "warehouse_name", "company", "parent_warehouse", "warehouse_type",
  "is_group", "disabled", "is_rejected_warehouse", "account",
  "address_line_1", "address_line_2", "city", "state", "pin",
  "phone_no", "mobile_no", "email_id",
  "creation", "modified",
]

function toWarehouse(raw: Record<string, unknown>): Warehouse {
  return {
    name: raw.name as string,
    warehouse_name: raw.warehouse_name as string,
    company: raw.company as string,
    parent_warehouse: raw.parent_warehouse as string | undefined,
    warehouse_type: raw.warehouse_type as string | undefined,
    is_group: (raw.is_group as number) ?? 0,
    disabled: (raw.disabled as number) ?? 0,
    is_rejected_warehouse: raw.is_rejected_warehouse as number | undefined,
    account: raw.account as string | undefined,
    customer: raw.customer as string | undefined,
    address_line_1: raw.address_line_1 as string | undefined,
    address_line_2: raw.address_line_2 as string | undefined,
    city: raw.city as string | undefined,
    state: raw.state as string | undefined,
    pin: raw.pin as string | undefined,
    phone_no: raw.phone_no as string | undefined,
    mobile_no: raw.mobile_no as string | undefined,
    email_id: raw.email_id as string | undefined,
    creation: raw.creation as string,
    modified: raw.modified as string,
  }
}

// --- Stock Transfer helpers ---
const TRANSFER_FIELDS = [
  "name", "stock_entry_type", "company",
  "from_warehouse", "to_warehouse", "items",
  "posting_date", "posting_time", "docstatus", "status",
  "remarks", "creation", "modified",
]

function toTransfer(raw: Record<string, unknown>): StockTransfer {
  const items = (raw.items as Array<Record<string, unknown>> | undefined) ?? []
  return {
    name: raw.name as string,
    stock_entry_type: raw.stock_entry_type as string,
    company: raw.company as string,
    from_warehouse: raw.from_warehouse as string | undefined,
    to_warehouse: raw.to_warehouse as string | undefined,
    items: items.map((i) => ({
      item_code: i.item_code as string,
      item_name: i.item_name as string | undefined,
      qty: (i.qty as number) ?? 0,
      uom: (i.uom as string) ?? "Nos",
      stock_uom: i.stock_uom as string | undefined,
      s_warehouse: i.s_warehouse as string | undefined,
      t_warehouse: i.t_warehouse as string | undefined,
      basic_rate: i.basic_rate as number | undefined,
      conversion_factor: (i.conversion_factor as number) ?? 1,
    })),
    posting_date: raw.posting_date as string,
    posting_time: raw.posting_time as string,
    docstatus: (raw.docstatus as number) ?? 0,
    status: raw.status as string | undefined,
    remarks: raw.remarks as string | undefined,
    creation: raw.creation as string,
    modified: raw.modified as string,
  }
}

// --- Stock Count helpers ---
const COUNT_FIELDS = [
  "name", "company", "purpose",
  "posting_date", "posting_time", "set_warehouse",
  "items", "docstatus",
  "expense_account", "cost_center", "difference_amount",
  "creation", "modified",
]

function toCount(raw: Record<string, unknown>): StockCount {
  const items = (raw.items as Array<Record<string, unknown>> | undefined) ?? []
  return {
    name: raw.name as string,
    company: raw.company as string,
    purpose: raw.purpose as "Opening Stock" | "Stock Reconciliation",
    posting_date: raw.posting_date as string,
    posting_time: raw.posting_time as string,
    set_warehouse: raw.set_warehouse as string | undefined,
    items: items.map((i) => ({
      item_code: i.item_code as string,
      item_name: i.item_name as string | undefined,
      warehouse: i.warehouse as string,
      qty: (i.qty as number) ?? 0,
      valuation_rate: i.valuation_rate as number | undefined,
      current_qty: i.current_qty as number | undefined,
      current_valuation_rate: i.current_valuation_rate as number | undefined,
      quantity_difference: i.quantity_difference as number | undefined,
      amount_difference: i.amount_difference as number | undefined,
      stock_uom: i.stock_uom as string | undefined,
      allow_zero_valuation_rate: i.allow_zero_valuation_rate as number | undefined,
    })),
    docstatus: (raw.docstatus as number) ?? 0,
    expense_account: raw.expense_account as string | undefined,
    cost_center: raw.cost_center as string | undefined,
    difference_amount: raw.difference_amount as number | undefined,
    creation: raw.creation as string,
    modified: raw.modified as string,
  }
}

// --- Movement helpers ---
function classifyMovement(sle: Record<string, unknown>): InventoryMovement["movement_type"] {
  const vtype = sle.voucher_type as string
  const qty = (sle.actual_qty as number) ?? 0
  if (vtype === "Stock Reconciliation") return "adjustment"
  if (vtype === "Stock Entry") return "transfer"
  if (qty > 0) return "in"
  return "out"
}

function toMovement(raw: Record<string, unknown>): InventoryMovement {
  return {
    name: raw.name as string,
    item_code: raw.item_code as string,
    warehouse: raw.warehouse as string,
    posting_date: raw.posting_date as string,
    posting_time: raw.posting_time as string,
    voucher_type: raw.voucher_type as string,
    voucher_no: raw.voucher_no as string,
    actual_qty: (raw.actual_qty as number) ?? 0,
    qty_after_transaction: (raw.qty_after_transaction as number) ?? 0,
    valuation_rate: (raw.valuation_rate as number) ?? 0,
    stock_value: (raw.stock_value as number) ?? 0,
    stock_value_difference: (raw.stock_value_difference as number) ?? 0,
    incoming_rate: raw.incoming_rate as number | undefined,
    outgoing_rate: raw.outgoing_rate as number | undefined,
    company: raw.company as string,
    is_cancelled: (raw.is_cancelled as number) ?? 0,
    movement_type: classifyMovement(raw),
  }
}

export const inventoryService = {
  // ========== Warehouses ==========
  async listWarehouses(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<WarehouseListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = []
    if (params.search) {
      filters.push(["warehouse_name", "like", `%${params.search}%`])
    }
    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl("Warehouse", {
          fields: WAREHOUSE_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "warehouse_name asc",
        })
      ),
      getCount("Warehouse", filters.length > 0 ? filters : undefined),
    ])
    return {
      items: rows.map(toWarehouse),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getWarehouse(name: string): Promise<Warehouse> {
    const raw = await apiClient<Record<string, unknown>>(`/resource/Warehouse/${encodeURIComponent(name)}`)
    return toWarehouse(raw)
  },

  async createWarehouse(data: Partial<Warehouse>): Promise<Warehouse> {
    const raw = await apiClient<Record<string, unknown>>("/resource/Warehouse", {
      method: "POST",
      body: JSON.stringify({
        warehouse_name: data.warehouse_name,
        company: data.company,
        parent_warehouse: data.parent_warehouse || undefined,
        warehouse_type: data.warehouse_type || undefined,
        is_group: data.is_group ? 1 : 0,
        disabled: data.disabled ? 1 : 0,
        account: data.account || undefined,
        address_line_1: data.address_line_1 || undefined,
        address_line_2: data.address_line_2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        pin: data.pin || undefined,
        phone_no: data.phone_no || undefined,
        mobile_no: data.mobile_no || undefined,
        email_id: data.email_id || undefined,
      }),
    })
    return toWarehouse(raw)
  },

  async updateWarehouse(name: string, data: Partial<Warehouse>): Promise<Warehouse> {
    const raw = await apiClient<Record<string, unknown>>(
      `/resource/Warehouse/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify(data) }
    )
    return toWarehouse(raw)
  },

  async deleteWarehouse(name: string): Promise<void> {
    return apiClient(`/resource/Warehouse/${encodeURIComponent(name)}`, { method: "DELETE" })
  },

  // ========== Stock Transfers ==========
  async listTransfers(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<StockTransferListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = [["stock_entry_type", "=", "Material Transfer"]]
    if (params.search) {
      filters.push(["name", "like", `%${params.search}%`])
    }
    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl("Stock Entry", {
          fields: TRANSFER_FIELDS,
          filters,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "creation desc",
        })
      ),
      getCount("Stock Entry", filters),
    ])
    return {
      items: rows.map(toTransfer),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getTransfer(name: string): Promise<StockTransfer> {
    const raw = await apiClient<Record<string, unknown>>(`/resource/Stock%20Entry/${encodeURIComponent(name)}`)
    return toTransfer(raw)
  },

  async createTransfer(data: {
    from_warehouse?: string
    to_warehouse?: string
    items: StockTransferItem[]
    remarks?: string
    company: string
    posting_date?: string
  }): Promise<StockTransfer> {
    const raw = await apiClient<Record<string, unknown>>("/resource/Stock%20Entry", {
      method: "POST",
      body: JSON.stringify({
        stock_entry_type: "Material Transfer",
        company: data.company,
        from_warehouse: data.from_warehouse || undefined,
        to_warehouse: data.to_warehouse || undefined,
        posting_date: data.posting_date || new Date().toISOString().slice(0, 10),
        remarks: data.remarks || undefined,
        items: data.items.map((i) => ({
          item_code: i.item_code,
          qty: i.qty,
          uom: i.uom,
          s_warehouse: i.s_warehouse || data.from_warehouse,
          t_warehouse: i.t_warehouse || data.to_warehouse,
          basic_rate: i.basic_rate ?? undefined,
        })),
      }),
    })
    return toTransfer(raw)
  },

  async submitTransfer(name: string): Promise<void> {
    await submitDoc("Stock Entry", name)
  },

  async cancelTransfer(name: string): Promise<void> {
    await cancelDoc("Stock Entry", name)
  },

  // ========== Stock Counts ==========
  async listCounts(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<StockCountListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters: unknown[] = [["purpose", "=", "Stock Reconciliation"]]
    if (params.search) {
      filters.push(["name", "like", `%${params.search}%`])
    }
    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl("Stock Reconciliation", {
          fields: COUNT_FIELDS,
          filters,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "creation desc",
        })
      ),
      getCount("Stock Reconciliation", filters),
    ])
    return {
      items: rows.map(toCount),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getCount(name: string): Promise<StockCount> {
    const raw = await apiClient<Record<string, unknown>>(`/resource/Stock%20Reconciliation/${encodeURIComponent(name)}`)
    return toCount(raw)
  },

  async createCount(data: {
    company: string
    set_warehouse?: string
    items: Array<{
      item_code: string
      warehouse: string
      qty: number
      valuation_rate?: number
    }>
    posting_date?: string
  }): Promise<StockCount> {
    const raw = await apiClient<Record<string, unknown>>("/resource/Stock%20Reconciliation", {
      method: "POST",
      body: JSON.stringify({
        purpose: "Stock Reconciliation",
        company: data.company,
        set_warehouse: data.set_warehouse || undefined,
        posting_date: data.posting_date || new Date().toISOString().slice(0, 10),
        items: data.items.map((i) => ({
          item_code: i.item_code,
          warehouse: i.warehouse,
          qty: i.qty,
          valuation_rate: i.valuation_rate ?? undefined,
        })),
      }),
    })
    return toCount(raw)
  },

  async submitCount(name: string): Promise<void> {
    await submitDoc("Stock Reconciliation", name)
  },

  async cancelCount(name: string): Promise<void> {
    await cancelDoc("Stock Reconciliation", name)
  },

  // ========== Inventory Movements ==========
  async listMovements(params: {
    productId?: string
    warehouse?: string
    type?: string
    page?: number
    pageSize?: number
  }): Promise<InventoryMovementListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 20
    const filters: unknown[] = [["is_cancelled", "=", 0]]
    if (params.productId) filters.push(["item_code", "=", params.productId])
    if (params.warehouse) filters.push(["warehouse", "=", params.warehouse])
    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl("Stock Ledger Entry", {
          fields: [
            "name", "item_code", "warehouse",
            "posting_date", "posting_time",
            "voucher_type", "voucher_no",
            "actual_qty", "qty_after_transaction",
            "valuation_rate", "stock_value",
            "stock_value_difference",
            "incoming_rate", "outgoing_rate",
            "company", "is_cancelled",
          ],
          filters,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "posting_datetime desc",
        })
      ),
      getCount("Stock Ledger Entry", filters),
    ])
    let items = rows.map(toMovement)
    if (params.type) {
      items = items.filter((m) => m.movement_type === params.type)
    }
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  // ========== Summary ==========
  async getSummary(): Promise<InventorySummary> {
    const [totalProducts, totalWarehouses, pendingTransfers, pendingCounts] = await Promise.all([
      getCount("Item", [["disabled", "=", 0]]),
      getCount("Warehouse", [["disabled", "=", 0]]),
      getCount("Stock Entry", [["docstatus", "=", 0], ["stock_entry_type", "=", "Material Transfer"]]),
      getCount("Stock Reconciliation", [["docstatus", "=", 0]]),
    ])

    // Total stock value from Bin
    const binRows = await apiClient<Array<{ stock_value: number }>>(
      buildListUrl("Bin", {
        fields: ["SUM(stock_value) as stock_value"],
        limit_page_length: 1,
      })
    )
    const totalValue = binRows[0]?.stock_value ?? 0

    // Low stock & out of stock — use Bin aggregation
    const allBins = await apiClient<Array<{ item_code: string; actual_qty: number }>>(
      buildListUrl("Bin", {
        fields: ["item_code", "SUM(actual_qty) as actual_qty"],
        group_by: "item_code",
        limit_page_length: 0,
      })
    )
    const outOfStockCount = allBins.filter((b) => b.actual_qty === 0).length
    const lowStockCount = allBins.filter((b) => b.actual_qty > 0 && b.actual_qty < 20).length

    return {
      totalProducts,
      totalWarehouses,
      totalValue,
      lowStockCount,
      outOfStockCount,
      pendingTransfers,
      pendingCounts,
    }
  },
}
