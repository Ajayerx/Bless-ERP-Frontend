export type OpportunityStage = "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost"

export interface Opportunity {
  id: string
  title: string
  customerId: string
  customerName: string
  value: number
  stage: OpportunityStage
  probability: number
  expectedClose: string
  assignedTo: string
  notes: string
  createdAt: string
}

export interface OpportunityListResponse {
  items: Opportunity[]
  total: number
}

export interface OpportunityFormData {
  title: string
  customerId: string
  customerName: string
  value: number
  stage: OpportunityStage
  probability: number
  expectedClose: string
  assignedTo: string
  notes: string
}
