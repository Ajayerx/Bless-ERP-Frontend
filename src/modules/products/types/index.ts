export interface Product {
    id: string
    sku: string
    name: string
    category?: string
    price: number
    cost?: number
    costPrice?: number
    stock: number
    unit: string
    description?: string
    warehouse?: string
    taxable?: boolean
    reorderLevel?: number
}

export interface ProductListResponse {
    items: Product[]
    total: number
}

export interface ProductListParams {
    search?: string
    page?: number
    pageSize?: number
    filter?: "All" | "Low Stock" | "In Stock" | "Out of Stock"
}
