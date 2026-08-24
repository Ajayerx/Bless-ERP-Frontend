import { apiClient, ApiError, serverDownloadTemplate } from "@/services/api-client"
import { postMethod } from "@/services/frappe-client"
import { API_CONFIG } from "@/config/api.config"
import type {
  Product, ProductDetail, ProductListResponse, ProductListParams,
  ProductFormData, WarehouseStock, ItemDefaultRow, ReorderLevelRow,
  ProductTaxRow, ProductFilter,
} from "../types"

export type {
  Product, ProductDetail, ProductListResponse, ProductListParams,
  ProductFormData, WarehouseStock, ItemDefaultRow, ReorderLevelRow,
  ProductTaxRow, ProductFilter,
}

export { ApiError }

export interface ItemPriceRow {
  name: string
  item_code: string
  price_list: string
  price_list_rate: number
  currency: string
  uom?: string
  buying?: number
  selling?: number
  valid_from?: string
  valid_upto?: string
}

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
  accounts: () => fetchLinkOptions("Account", "name", [["is_group", "=", 0], ["account_type", "in", ["Income", "Expense", "Bank", "Cash"]]]),
  costCenters: () => fetchLinkOptions("Cost Center", "name", [["is_group", "=", 0]]),
  priceLists: () => fetchLinkOptions("Price List"),
}

const ITEM_FIELDS = [
  "name", "item_code", "item_name", "item_group", "stock_uom",
  "standard_rate", "valuation_rate", "description", "image",
  "brand", "is_stock_item", "disabled", "has_variants",
  "has_batch_no", "has_serial_no", "weight_per_unit", "weight_uom",
  "opening_stock",
]

// Columns offered in the Products export dialog. Single group because Item has
// no child-table rows to export (unlike Sales Invoice -> items).
export const PRODUCT_EXPORT_FIELDS: Record<string, string[]> = {
  Item: [
    "name", "item_code", "item_name", "item_group", "stock_uom",
    "standard_rate", "valuation_rate", "brand", "is_stock_item",
    "disabled", "weight_per_unit", "weight_uom", "description",
  ],
}

interface BinRow {
  item_code: string
  actual_qty: number
  stock_value: number
}

async function fetchStockAggregation(itemCodes: string[]): Promise<Record<string, { actual_qty: number; stock_value: number }>> {
  if (itemCodes.length === 0) return {}
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["item_code", "actual_qty", "stock_value"]))
  qp.set("filters", JSON.stringify([["item_code", "in", itemCodes]]))
  qp.set("limit_page_length", "0")
  const bins = await apiClient<BinRow[]>(`/resource/Bin?${qp.toString()}`)
  const map: Record<string, { actual_qty: number; stock_value: number }> = {}
  for (const b of bins) {
    if (!map[b.item_code]) map[b.item_code] = { actual_qty: 0, stock_value: 0 }
    map[b.item_code].actual_qty += b.actual_qty
    map[b.item_code].stock_value += b.stock_value
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
  const binData = stockMap[itemCode]
  const defaultWarehouse = defaults[0]?.default_warehouse
  const openingStock = (item.opening_stock as number) ?? 0
  const valuationRate = (item.valuation_rate as number) ?? 0
  const standardRate = (item.standard_rate as number) ?? 0

  const hasBinData = binData && binData.actual_qty > 0
  const stock = hasBinData ? binData.actual_qty : openingStock
  const fallbackRate = valuationRate > 0 ? valuationRate : standardRate
  const stockValue = hasBinData ? binData.stock_value : openingStock * fallbackRate
  const costPerUnit = hasBinData
    ? computeEffectiveCost(binData.actual_qty, binData.stock_value)
    : (valuationRate > 0 ? valuationRate : (standardRate > 0 ? standardRate : null))

  return {
    name: item.name as string,
    item_code: itemCode,
    item_name: (item.item_name ?? item.name) as string,
    item_group: item.item_group as string | undefined,
    stock_uom: (item.stock_uom ?? "Nos") as string,
    standard_rate: standardRate,
    valuation_rate: item.valuation_rate as number | undefined,
    effective_cost: costPerUnit,
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
    stock,
    stock_value: stockValue,
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

function toProductDocPayload(data: ProductFormData, isEdit = false): Record<string, unknown> {
  return {
    item_code: data.item_code.trim(),
    item_name: data.item_name.trim(),
    item_group: data.item_group || undefined,
    stock_uom: data.stock_uom || "Nos",
    valuation_rate: data.is_stock_item ? data.valuation_rate || 0 : undefined,
    ...(isEdit ? {} : {
      standard_rate: data.standard_rate || 0,
      opening_stock: data.is_stock_item ? data.opening_stock || 0 : undefined,
    }),
    description: data.description || undefined,
    brand: data.brand || undefined,
    image: data.image || undefined,
    is_stock_item: data.is_stock_item ? 1 : 0,
    is_sales_item: data.is_sales_item ? 1 : 0,
    is_purchase_item: data.is_purchase_item ? 1 : 0,
    disabled: data.disabled ? 1 : 0,
    has_batch_no: data.has_batch_no ? 1 : 0,
    has_serial_no: data.has_serial_no ? 1 : 0,
    has_variants: data.has_variants ? 1 : 0,
    valuation_method: data.valuation_method || undefined,
    end_of_life: data.end_of_life || undefined,
    warranty_period: data.warranty_period || undefined,
    allow_negative_stock: data.allow_negative_stock ? 1 : 0,
    purchase_uom: data.purchase_uom || undefined,
    sales_uom: data.sales_uom || undefined,
    max_discount: data.max_discount || undefined,
    safety_stock: data.safety_stock || undefined,
    min_order_qty: data.min_order_qty || undefined,
    lead_time_days: data.lead_time_days || undefined,
    weight_per_unit: data.weight_per_unit || 0,
    weight_uom: data.weight_uom || undefined,
    item_defaults: (data.default_warehouse || data.income_account || data.cost_center || data.default_price_list) && data.company
      ? [{
          company: data.company,
          default_warehouse: data.default_warehouse || undefined,
          income_account: data.income_account || undefined,
          cost_center: data.cost_center || undefined,
          default_price_list: data.default_price_list || undefined,
        }]
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
    let [warehouseStock] = await Promise.all([
      fetchPerWarehouseStock(itemCode),
    ])

    const defaults = (item.item_defaults as ItemDefaultRow[] | undefined) ?? []
    const reorderLevels = (item.reorder_levels as ReorderLevelRow[] | undefined) ?? []
    const taxes = (item.taxes as ProductTaxRow[] | undefined) ?? []
    const defaultWarehouse = defaults[0]?.default_warehouse as string | undefined
    const openingStock = (item.opening_stock as number) ?? 0
    const valuationRate = (item.valuation_rate as number) ?? 0
    const standardRate = (item.standard_rate as number) ?? 0

    let totalActualQty = warehouseStock.reduce((s, w) => s + w.actual_qty, 0)
    let totalStockValue = warehouseStock.reduce((s, w) => s + w.stock_value, 0)
    const hasBinData = totalActualQty > 0

    if (!hasBinData && openingStock > 0) {
      totalActualQty = openingStock
      const fallbackRate = valuationRate > 0 ? valuationRate : standardRate
      totalStockValue = openingStock * fallbackRate
      if (defaultWarehouse && warehouseStock.length === 0) {
        warehouseStock = [{ warehouse: defaultWarehouse, actual_qty: openingStock, valuation_rate: fallbackRate, stock_value: totalStockValue }]
      }
    }

    const effectiveCost = hasBinData
      ? computeEffectiveCost(totalActualQty, totalStockValue)
      : (valuationRate > 0 ? valuationRate : (standardRate > 0 ? standardRate : null))

    return {
      name: item.name as string,
      item_code: itemCode,
      item_name: (item.item_name ?? item.name) as string,
      item_group: item.item_group as string | undefined,
      stock_uom: (item.stock_uom ?? "Nos") as string,
      standard_rate: standardRate,
      valuation_rate: item.valuation_rate as number | undefined,
      effective_cost: effectiveCost,
      description: item.description as string | undefined,
      image: item.image as string | undefined,
      brand: item.brand as string | undefined,
      is_stock_item: item.is_stock_item as number | undefined,
      is_sales_item: item.is_sales_item as number | undefined,
      is_purchase_item: item.is_purchase_item as number | undefined,
      disabled: item.disabled as number | undefined,
      has_variants: item.has_variants as number | undefined,
      variant_of: item.variant_of as string | undefined,
      has_batch_no: item.has_batch_no as number | undefined,
      has_serial_no: item.has_serial_no as number | undefined,
      valuation_method: item.valuation_method as string | undefined,
      end_of_life: item.end_of_life as string | undefined,
      warranty_period: item.warranty_period as string | undefined,
      allow_negative_stock: item.allow_negative_stock as number | undefined,
      purchase_uom: item.purchase_uom as string | undefined,
      sales_uom: item.sales_uom as string | undefined,
      max_discount: item.max_discount as number | undefined,
      safety_stock: item.safety_stock as number | undefined,
      min_order_qty: item.min_order_qty as number | undefined,
      lead_time_days: item.lead_time_days as number | undefined,
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
      body: JSON.stringify(toProductDocPayload(data, true)),
    })
    const itemCode = (updated.item_code ?? updated.name) as string
    const stockMap = await fetchStockAggregation([itemCode])
    return toProduct(updated, stockMap)
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/resource/Item/${encodeURIComponent(id)}`, { method: "DELETE" })
  },

  // ── Bulk assignment / tags (list toolbar, ERPNext parity) ─────────

  async searchAssignableUsers(
    query: string,
  ): Promise<{ value: string; label: string; description: string }[]> {
    const results = await apiClient<{ value: string; label?: string; description?: string }[]>(
      `/method/frappe.desk.search.search_link?` +
        new URLSearchParams({
          doctype: "User",
          txt: query,
          page_length: "10",
          filters: JSON.stringify({ user_type: "System User", enabled: 1 }),
        }).toString(),
    )
    return (results ?? []).map((u) => ({
      value: u.value,
      label: u.label ?? u.value,
      description: u.description ?? "",
    }))
  },

  async assignTo(names: string[], user: string): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.add_multiple", {
      assign_to: JSON.stringify([user]),
      doctype: "Item",
      name: JSON.stringify(names),
    })
  },

  async removeAssignment(names: string[]): Promise<void> {
    await postMethod("frappe.desk.form.assign_to.remove_multiple", {
      doctype: "Item",
      names: JSON.stringify(names),
    })
  },

  async addTags(names: string[], tags: string | string[], color = ""): Promise<void> {
    const tagLabels = Array.isArray(tags) ? tags : [tags]
    await postMethod("frappe.desk.doctype.tag.tag.add_tags", {
      tags: JSON.stringify(tagLabels),
      dt: "Item",
      docs: JSON.stringify(names),
      color,
    })
  },

  // Bulk print via frappe.utils.print_format.download_multi_pdf — one URL,
  // server concatenates all selected items into a single PDF (default format).
  buildMultiPdfUrl(
    names: string[],
    options: { printFormat?: string; letterhead?: string; pageSize?: string } = {}
  ): string {
    const params = new URLSearchParams()
    params.set("doctype", "Item")
    params.set("name", JSON.stringify(names))
    params.set("format", options.printFormat ?? "Standard")
    params.set("no_letterhead", options.letterhead ? "0" : "1")
    if (options.letterhead) params.set("letterhead", options.letterhead)
    params.set("options", JSON.stringify({ "page-size": options.pageSize ?? "A4" }))
    return `${API_CONFIG.baseUrl}/method/frappe.utils.print_format.download_multi_pdf?${params.toString()}`
  },

  async getPrintFormats(): Promise<string[]> {
    const formats = await apiClient<{ name: string }[]>(
      `/resource/Print%20Format?filters=${encodeURIComponent(JSON.stringify([["doc_type", "=", "Item"], ["disabled", "=", 0]]))}&fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=100`
    )
    return (formats ?? []).map((f) => f.name)
  },

  async getItemPrices(itemCode: string): Promise<ItemPriceRow[]> {
    const prices = await apiClient<ItemPriceRow[]>(
      `/resource/Item Price?filters=${encodeURIComponent(JSON.stringify([["item_code", "=", itemCode]]))}&fields=${encodeURIComponent(JSON.stringify(["name", "item_code", "price_list", "price_list_rate", "currency", "uom", "buying", "selling", "valid_from", "valid_upto"]))}&limit_page_length=50&order_by=creation desc`
    )
    return prices ?? []
  },

  async exportRecords(options?: {
    fileType?: "CSV" | "Excel"
    recordMode?: "all" | "by_filter" | "5_records" | "blank_template"
    fields?: Record<string, string[]>
    filters?: unknown[]
  }): Promise<Blob> {
    return serverDownloadTemplate({
      doctype: "Item",
      fileType: options?.fileType ?? "CSV",
      recordMode: options?.recordMode ?? "by_filter",
      fields: options?.fields && Object.keys(options.fields).length > 0
        ? options.fields
        : PRODUCT_EXPORT_FIELDS,
      filters: options?.filters,
    })
  },

  async importFromCsv(file: File): Promise<{ success: number; failed: number; errors: string[] }> {
    const text = await file.text()
    const lines = text.split("\n").filter((l) => l.trim())
    if (lines.length < 2) {
      return { success: 0, failed: 0, errors: ["CSV file is empty or has no data rows"] }
    }
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const codeIdx = headers.indexOf("item_code")
    const nameIdx = headers.indexOf("item_name")
    const groupIdx = headers.indexOf("item_group")
    const uomIdx = headers.indexOf("stock_uom")
    const brandIdx = headers.indexOf("brand")
    const descIdx = headers.indexOf("description")
    const rateIdx = headers.indexOf("standard_rate")
    const stockIdx = headers.indexOf("is_stock_item")
    if (nameIdx === -1 && codeIdx === -1) {
      return { success: 0, failed: 0, errors: ["CSV must have an 'item_code' or 'item_name' column"] }
    }
    let success = 0
    let failed = 0
    const errors: string[] = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      const itemCode = codeIdx >= 0 ? cols[codeIdx] : ""
      const itemName = nameIdx >= 0 ? cols[nameIdx] : ""
      if (!itemCode && !itemName) continue
      try {
        await productService.create({
          item_code: itemCode,
          item_name: itemName,
          item_group: groupIdx >= 0 ? cols[groupIdx] : "",
          stock_uom: uomIdx >= 0 && cols[uomIdx] ? cols[uomIdx] : "Nos",
          standard_rate: rateIdx >= 0 ? parseFloat(cols[rateIdx]) || 0 : 0,
          valuation_rate: 0,
          opening_stock: 0,
          description: descIdx >= 0 ? cols[descIdx] : "",
          brand: brandIdx >= 0 ? cols[brandIdx] : "",
          image: "",
          is_stock_item: stockIdx >= 0 ? cols[stockIdx] === "1" || cols[stockIdx].toLowerCase() === "true" : true,
          is_sales_item: true,
          is_purchase_item: true,
          disabled: false,
          has_batch_no: false,
          has_serial_no: false,
          has_variants: false,
          valuation_method: "",
          end_of_life: "",
          warranty_period: "",
          allow_negative_stock: true,
          purchase_uom: "",
          sales_uom: "",
          max_discount: 0,
          safety_stock: 0,
          min_order_qty: 0,
          lead_time_days: 0,
          weight_per_unit: 0,
          weight_uom: "",
          company: "",
          default_warehouse: "",
          income_account: "",
          cost_center: "",
          default_price_list: "",
        })
        success++
      } catch (e) {
        failed++
        errors.push(`Row ${i + 1} (${itemCode || itemName}): ${e instanceof Error ? e.message : "Unknown error"}`)
      }
    }
    return { success, failed, errors }
  },
}
