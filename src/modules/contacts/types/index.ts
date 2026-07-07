export interface Contact {
  id: string
  customerId: string
  name: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  notes: string
  createdAt: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
}

export interface ContactFormData {
  customerId: string
  name: string
  email: string
  phone: string
  role: string
  isPrimary: boolean
  notes: string
}
