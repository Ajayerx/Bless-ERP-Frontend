export interface Bill {
  id: string
  supplierId: string
  supplierName: string
  number: string
  amount: number
  issueDate: string
  dueDate: string
  status: "received" | "paid" | "overdue"
  category: string
  notes: string
  createdAt: string
}

export interface BillListResponse {
  items: Bill[]
  total: number
  page: number
  pageSize: number
}

export interface BillFormData {
  supplierName: string
  amount: number
  issueDate: string
  dueDate: string
  status?: "received" | "paid" | "overdue"
  category?: string
  notes?: string
}
