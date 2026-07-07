export type BankAccountType = "chequing" | "savings" | "credit"

export interface BankAccount {
  id: string
  name: string
  accountNumber: string
  type: BankAccountType
  balance: number
  currency: string
  institution: string
  isDefault: boolean
  createdAt: string
}

export interface BankAccountListResponse {
  items: BankAccount[]
  total: number
}

export interface BankAccountFormData {
  name: string
  accountNumber: string
  type: BankAccountType
  balance: number
  currency: string
  institution: string
  isDefault: boolean
}
