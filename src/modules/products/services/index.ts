import { apiClient, ApiError } from "@/services/api-client"
import type {
  Product, ProductDetail, ProductListResponse, ProductListParams,
  ProductFormData, WarehouseStock, ItemDefaultRow, ReorderLevelRow,
  ProductTaxRow,
} from "../types"

export type {
  Product, ProductDetail, ProductListResponse, ProductListParams,
  ProductFormData, WarehouseStock, ItemDefaultRow, ReorderLevelRow,
  ProductTaxRow,
}

export { ApiError }

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
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

async function fetchLinkOptions(doctype: string, orderByField = "name", filters?: unknown[]): Promise<string[]> {
  const rows = await apiClient<Array<{ name: string }>>(
    buildListUrl(doctype, {
      fields: ["name"],
      order_by: `${orderByField} asc`,
      limit_page_length: 0,
      filters,
    })
  )
  return rows.map((r) => r.name)
}

export const productLookups = {
  itemGroups: () => fetchLinkOptions("Item Group", "name", [["is_group", "=", 0]]),
  uoms: () => fetchLinkOptions("UOM"),
  brands: () => fetchLinkOptions("Brand"),
  warehouses: () => fetchLinkOptions("Warehouse", "name", [["is_group", "=", 0]]),
  companies: () => fetchLinkOptions("Company"),
  weightUoms: () => fetchLinkOptions("UOM", "name", [["must_be_whole_number", "=", 1]]),
}

const ITEM_FIELDS = [
  "name", "item_code", "item_name", "item_group", "stock_uom",
  "standard_rate", "valuation_rate", "description", "image",
  "brand", "is_stock_item", "disabled", "has_variants",
  "has_batch_no", "has_serial_no", "weight_per_unit", "weight_uom",
  "opening_stock",
]

interface BinAggRow {
  item_code: string
  actual_qty: number
  stock_value: number
}

async function fetchStockAggregation(itemCodes: string[]): Promise<Record<string, { actual_qty: number; stock_value: number }>> {
  if (itemCodes.length === 0) return {}
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["item_code", "SUM(actual_qty) as actual_qty", "SUM(stock_value) as stock_value"]))
  qp.set("filters", JSON.stringify([["item_code", "in", itemCodes]]))
  qp.set("group_by", "item_code")
  const bins = await apiClient<BinAggRow[]>(`/resource/Bin?${qp.toString()}`)
  const map: Record<string, { actual_qty: number; stock_value: number }> = {}
  for (const b of bins) {
    map[b.item_code] = { actual_qty: b.actual_qty, stock_value: b.stock_value }
  }
  return map
}

async function fetchPerWarehouseStock(itemCode: string): Promise<WarehouseStock[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["warehouse", "actual_qty", "valuation_rate", "stock_value"]))
  qp.set("filters", JSON.stringify([["item_code", "=", itemCode]]))
  qp.set("limit_page_length", "0")
  return apiClient<WarehouseStock[]>(`/resource/Bin?${qp.toString()}`)
}

function computeEffectiveCost(actualQty: number, stockValue: number): number | null {
  if (actualQty > 0) return stockValue / actualQty
  return null
}

function toProduct(
  item: Record<string, unknown>,
  stockMap: Record<string, { actual_qty: number; stock_value: number }>,
): Product {
  const itemCode = (item.item_code ?? item.name) as string
  const defaults = (item.item_defaults as ItemDefaultRow[] | undefined) ?? []
  const reorderLevels = (item.reorder_levels as ReorderLevelRow[] | undefined) ?? []
  const stockData = stockMap[itemCode] ?? { actual_qty: 0, stock_value: 0 }
  const defaultWarehouse = defaults[0]?.default_warehouse

  return {
    name: item.name as string,
    item_code: itemCode,
    item_name: (item.item_name ?? item.name) as string,
    item_group: item.item_group as string | undefined,
    stock_uom: (item.stock_uom ?? "Nos") as string,
    standard_rate: (item.standard_rate as number) ?? 0,
    valuation_rate: item.valuation_rate as number | undefined,
    effective_cost: computeEffectiveCost(stockData.actual_qty, stockData.stock_value),
    description: item.description as string | undefined,
    image: item.image as string | undefined,
    brand: item.brand as string | undefined,
    is_stock_item: item.is_stock_item as number | undefined,
    disabled: item.disabled as number | undefined,
    has_variants: item.has_variants as number | undefined,
    has_batch_no: item.has_batch_no as number | undefined,
    has_serial_no: item.has_serial_no as number | undefined,
    weight_per_unit: item.weight_per_unit as number | undefined,
    weight_uom: item.weight_uom as string | undefined,
    opening_stock: item.opening_stock as number | undefined,
    stock: stockData.actual_qty,
    stock_value: stockData.stock_value,
    reorder_level: reorderLevels[0]?.warehouse_reorder_level as number | undefined,
    default_warehouse: defaultWarehouse,
    income_account: defaults[0]?.income_account,
    cost_center: defaults[0]?.cost_center,
  }
}

const LOW_STOCK_THRESHOLD = 20

function filterByStock(items: Product[], filter?: string): Product[] {
  if (!filter || filter === "All") return items
  return items.filter((p) => {
    if (filter === "Low Stock") return p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD
    if (filter === "In Stock") return p.stock >= LOW_STOCK_THRESHOLD
    if (filter === "Out of Stock") return p.stock === 0
    return true
  })
}

function toProductDocPayload(data: ProductFormData): Record<string, unknown> {
  return {
    item_code: data.item_code.trim(),
    item_name: data.item_name.trim(),
    item_group: data.item_group || undefined,
    stock_uom: data.stock_uom || "Nos",
    standard_rate: data.standard_rate || 0,
    valuation_rate: data.is_stock_item ? data.valuation_rate || 0 : undefined,
    opening_stock: data.is_stock_item ? data.opening_stock || 0 : undefined,
    description: data.description || undefined,
    brand: data.brand || undefined,
    image: data.image || undefined,
    is_stock_item: data.is_stock_item ? 1 : 0,
    disabled: data.disabled ? 1 : 0,
    weight_per_unit: data.weight_per_unit || 0,
    weight_uom: data.weight_uom || undefined,
    item_defaults: data.default_warehouse && data.company
      ? [{ company: data.company, default_warehouse: data.default_warehouse }]
      : undefined,
  }
}

export const productService = {
  lookups: productLookups,
  LOW_STOCK_THRESHOLD,

  async list(params: ProductListParams = {}): Promise<ProductListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10

    const filters: unknown[] = []
    if (params.filter === "Out of Stock" || params.filter === "Low Stock" || params.filter === "In Stock") {
      filters.push(["disabled", "=", 0])
    }
    if (params.search) {
      filters.push(["item_name", "like", `%${params.search}%`])
    }

    const [rows, total] = await Promise.all([
      apiClient<Record<string, unknown>[]>(
        buildListUrl("Item", {
          fields: ITEM_FIELDS,
          filters: filters.length > 0 ? filters : undefined,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "item_name asc",
        })
      ),
      getCount("Item", filters.length > 0 ? filters : undefined),
    ])

    const itemCodes = rows.map((r) => (r.item_code ?? r.name) as string)
    const stockMap = await fetchStockAggregation(itemCodes)
    let items = rows.map((r) => toProduct(r, stockMap))
    items = filterByStock(items, params.filter)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async get(id: string): Promise<Product> {
    const item = await apiClient<Record<string, unknown>>(`/resource/Item/${encodeURIComponent(id)}`)
    const itemCode = (item.item_code ?? item.name) as string
    const stockMap = await fetchStockAggregation([itemCode])
    return toProduct(item, stockMap)
  },

  async getById(id: string): Promise<ProductDetail> {
    const item = await apiClient<Record<string, unknown>>(`/resource/Item/${encodeURIComponent(id)}`)
    const itemCode = (item.item_code ?? item.name) as string
    const [warehouseStock] = await Promise.all([
      fetchPerWarehouseStock(itemCode),
    ])

    const defaults = (item.item_defaults as ItemDefaultRow[] | undefined) ?? []
    const reorderLevels = (item.reorder_levels as ReorderLevelRow[] | undefined) ?? []
    const taxes = (item.taxes as ProductTaxRow[] | undefined) ?? []

    const totalActualQty = warehouseStock.reduce((s, w) => s + w.actual_qty, 0)
    const totalStockValue = warehouseStock.reduce((s, w) => s + w.stock_value, 0)

    return {
      name: item.name as string,
      item_code: itemCode,
      item_name: (item.item_name ?? item.name) as string,
      item_group: item.item_group as string | undefined,
      stock_uom: (item.stock_uom ?? "Nos") as string,
      standard_rate: (item.standard_rate as number) ?? 0,
      valuation_rate: item.valuation_rate as number | undefined,
      effective_cost: computeEffectiveCost(totalActualQty, totalStockValue),
      description: item.description as string | undefined,
      image: item.image as string | undefined,
      brand: item.brand as string | undefined,
      is_stock_item: item.is_stock_item as number | undefined,
      disabled: item.disabled as number | undefined,
      has_variants: item.has_variants as number | undefined,
      has_batch_no: item.has_batch_no as number | undefined,
      has_serial_no: item.has_serial_no as number | undefined,
      weight_per_unit: item.weight_per_unit as number | undefined,
      weight_uom: item.weight_uom as string | undefined,
      opening_stock: item.opening_stock as number | undefined,
      stock: totalActualQty,
      stock_value: totalStockValue,
      reorder_level: reorderLevels[0]?.warehouse_reorder_level as number | undefined,
      default_warehouse: defaults[0]?.default_warehouse as string | undefined,
      item_defaults: defaults,
      reorder_levels: reorderLevels,
      warehouse_stock: warehouseStock,
      taxes,
    }
  },

  async create(data: ProductFormData): Promise<Product> {
    const created = await apiClient<Record<string, unknown>>("/resource/Item", {
      method: "POST",
      body: JSON.stringify(toProductDocPayload(data)),
    })
    const itemCode = (created.item_code ?? created.name) as string
    return toProduct(created, { [itemCode]: { actual_qty: 0, stock_value: 0 } })
  },

  async update(id: string, data: ProductFormData): Promise<Product> {
    const updated = await apiClient<Record<string, unknown>>(`/resource/Item/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(toProductDocPayload(data)),
    })
    const itemCode = (updated.item_code ?? updated.name) as string
    const stockMap = await fetchStockAggregation([itemCode])
    return toProduct(updated, stockMap)
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/resource/Item/${encodeURIComponent(id)}`, { method: "DELETE" })
  },
}
