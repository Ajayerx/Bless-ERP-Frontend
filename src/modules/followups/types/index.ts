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
