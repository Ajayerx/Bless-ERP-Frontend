export interface Lead {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  company: string
  source: "website" | "referral" | "cold_call" | "social_media" | "event" | "other"
  status: "new" | "contacted" | "qualified" | "proposal" | "lost"
  estimatedValue: number
  notes: string
  assignedTo: string
  createdAt: string
}

export interface LeadFormData {
  firstName: string
  lastName: string
  email: string
  phone?: string
  company?: string
  source?: string
  status?: string
  estimatedValue?: number
  notes?: string
  assignedTo?: string
}

export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
