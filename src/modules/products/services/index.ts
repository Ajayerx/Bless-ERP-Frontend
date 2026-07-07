import { apiClient } from "@/services/api-client"
export type { Product, ProductListResponse, ProductListParams } from "../types"

export const productService = {
    list: (params: ProductListParams = {}): Promise<ProductListResponse> => {
        const qs = new URLSearchParams()
        if (params.search) qs.set("search", params.search)
        if (params.page) qs.set("page", String(params.page))
        if (params.pageSize) qs.set("pageSize", String(params.pageSize))
        if (params.filter && params.filter !== "All") qs.set("filter", params.filter)
        return apiClient(`/products?${qs}`)
    },

    get: (id: string): Promise<Product> =>
        apiClient(`/products/${id}`),

    create: (data: Omit<Product, "id">): Promise<Product> =>
        apiClient("/products", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Partial<Product>): Promise<Product> =>
        apiClient(`/products/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    delete: (id: string): Promise<void> =>
        apiClient(`/products/${id}`, { method: "DELETE" }),
}
