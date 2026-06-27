import { apiClient } from "./api-client"

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  price: number
  cost: number
  stock: number
  warehouse: string
  unit: string
  status: "active" | "inactive"
  createdAt: string
}

export interface ProductListResponse {
  items: Product[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const productService = {
  async list(params: {
    search?: string
    page?: number
    pageSize?: number
  }): Promise<ProductListResponse> {
    const qs = new URLSearchParams()
    if (params.search) qs.set("search", params.search)
    if (params.page) qs.set("page", String(params.page))
    if (params.pageSize) qs.set("pageSize", String(params.pageSize))
    return apiClient<ProductListResponse>(`/products?${qs.toString()}`)
  },

  async getById(id: string): Promise<Product> {
    return apiClient<Product>(`/products/${id}`)
  },

  async create(data: Partial<Product>): Promise<Product> {
    return apiClient<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async update(id: string, data: Partial<Product>): Promise<Product> {
    return apiClient<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
}
