export interface Supplier {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  taxId: string
  balance: number
  status: "active" | "inactive"
  createdAt: string
}

export interface SupplierListResponse {
  items: Supplier[]
  total: number
  page: number
  pageSize: number
}

export interface SupplierFormData {
  name: string
  contactName: string
  email: string
  phone: string
  billingAddress: string
  taxId: string
}
