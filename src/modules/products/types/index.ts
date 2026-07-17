export interface ItemDefaultRow {
  name?: string
  company: string
  default_warehouse?: string
  default_price_list?: string
  income_account?: string
  cost_center?: string
}

export interface ReorderLevelRow {
  name?: string
  warehouse: string
  warehouse_reorder_level?: number
  warehouse_reorder_qty?: number
  material_request_type?: string
}

export interface WarehouseStock {
  warehouse: string
  actual_qty: number
  valuation_rate: number
  stock_value: number
}

export interface ProductTaxRow {
  name?: string
  item_tax_template: string
  tax_category?: string
}

export interface Product {
  name: string
  item_code: string
  item_name: string
  item_group?: string
  stock_uom: string
  standard_rate: number
  valuation_rate?: number
  effective_cost: number | null
  description?: string
  image?: string
  brand?: string
  is_stock_item?: number
  is_sales_item?: number
  is_purchase_item?: number
  disabled?: number
  has_variants?: number
  variant_of?: string
  has_batch_no?: number
  has_serial_no?: number
  valuation_method?: string
  end_of_life?: string
  warranty_period?: string
  allow_negative_stock?: number
  purchase_uom?: string
  sales_uom?: string
  max_discount?: number
  safety_stock?: number
  min_order_qty?: number
  lead_time_days?: number
  weight_per_unit?: number
  weight_uom?: string
  opening_stock?: number
  stock: number
  stock_value: number
  reorder_level?: number
  default_warehouse?: string
  income_account?: string
  cost_center?: string
}

export interface ProductDetail extends Product {
  item_defaults: ItemDefaultRow[]
  reorder_levels: ReorderLevelRow[]
  warehouse_stock: WarehouseStock[]
  taxes: ProductTaxRow[]
}

export interface ProductFormData {
  item_code: string
  item_name: string
  item_group: string
  stock_uom: string
  standard_rate: number
  valuation_rate: number
  opening_stock: number
  description: string
  brand: string
  image: string
  is_stock_item: boolean
  is_sales_item: boolean
  is_purchase_item: boolean
  disabled: boolean
  has_batch_no: boolean
  has_serial_no: boolean
  has_variants: boolean
  valuation_method: string
  end_of_life: string
  warranty_period: string
  allow_negative_stock: boolean
  purchase_uom: string
  sales_uom: string
  max_discount: number
  safety_stock: number
  min_order_qty: number
  lead_time_days: number
  weight_per_unit: number
  weight_uom: string
  company: string
  default_warehouse: string
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ProductFilter = "All" | "Low Stock" | "In Stock" | "Out of Stock"

export interface ProductListParams {
  search?: string
  page?: number
  pageSize?: number
  filter?: ProductFilter
}
