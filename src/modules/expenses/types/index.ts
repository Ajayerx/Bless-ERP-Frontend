export interface Expense {
  id: string
  category: string
  amount: number
  date: string
  supplier: string
  description: string
  paymentMethod: string
  status: "paid" | "unpaid"
  notes: string
  createdAt: string
}

export interface ExpenseListResponse {
  items: Expense[]
  total: number
  page: number
  pageSize: number
}

export interface ExpenseFormData {
  category: string
  amount: number
  date: string
  supplier: string
  description: string
  paymentMethod: string
  notes: string
}
