export interface ContactEmailRow {
  name?: string
  email_id: string
  is_primary: 0 | 1
}

export interface ContactPhoneRow {
  name?: string
  phone: string
  is_primary_mobile_no: 0 | 1
}

export interface DynamicLinkRow {
  name?: string
  link_doctype: string
  link_name: string
  link_title?: string
}

export interface Contact {
  name: string
  first_name: string
  middle_name?: string
  last_name?: string
  full_name?: string
  email_id?: string
  phone?: string
  mobile_no?: string
  user?: string
  address?: string
  status: "Passive" | "Open" | "Replied"
  salutation?: string
  designation?: string
  gender?: string
  company_name?: string
  image?: string
  email_ids: ContactEmailRow[]
  phone_nos: ContactPhoneRow[]
  links: DynamicLinkRow[]
  is_primary_contact: 0 | 1
  is_billing_contact: 0 | 1
  department?: string
  unsubscribed: 0 | 1
  creation: string
  modified: string
}

export interface ContactListResponse {
  items: Contact[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ContactFormData {
  first_name: string
  middle_name?: string
  last_name?: string
  salutation?: string
  designation?: string
  gender?: string
  company_name?: string
  department?: string
  is_primary_contact: boolean
  is_billing_contact?: boolean
  email_ids: ContactEmailRow[]
  phone_nos: ContactPhoneRow[]
  links: DynamicLinkRow[]
  status?: string
}

export const CONTACT_FIELDS: (keyof Omit<Contact, "email_ids" | "phone_nos" | "links">)[] = [
  "name", "first_name", "middle_name", "last_name", "full_name",
  "email_id", "phone", "mobile_no", "user", "address",
  "status", "salutation", "designation", "gender", "company_name",
  "image", "is_primary_contact", "is_billing_contact", "department",
  "unsubscribed", "creation", "modified",
]
