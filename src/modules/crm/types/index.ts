export interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  jobTitle: string
  company: string
  customerId: string
  notes: string
  status: "active" | "inactive"
  createdAt: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

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

export interface LeadListResponse {
  items: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface Opportunity {
  id: string
  name: string
  customerId: string
  customerName: string
  contactId: string
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"
  probability: number
  expectedCloseDate: string
  estimatedValue: number
  assignedTo: string
  notes: string
  createdAt: string
}

export interface OpportunityListResponse {
  items: Opportunity[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface FollowUp {
  id: string
  title: string
  description: string
  relatedType: "lead" | "opportunity" | "contact"
  relatedId: string
  relatedName: string
  dueDate: string
  status: "pending" | "completed"
  priority: "low" | "medium" | "high"
  assignedTo: string
  createdAt: string
}

export interface FollowUpListResponse {
  items: FollowUp[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
