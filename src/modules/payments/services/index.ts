import { apiClient } from "@/services/api-client"
import { getCompany } from "@/services/company"
import type { SalesInvoice } from "@/modules/invoices/services"
import type {
  PaymentEntry,
  PaymentEntryListResponse,
  PartyDetails,
  AccountDetails,
  OutstandingReference,
  GetOutstandingArgs,
  RecordPaymentData,
} from "../types"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function buildListUrl(
  doctype: string,
  params: {
    fields: string[]
    filters?: unknown[]
    limit_page_length?: number
    limit_start?: number
    order_by?: string
  }
): string {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(params.fields))
  if (params.filters) qp.set("filters", JSON.stringify(params.filters))
  qp.set("limit_page_length", String(params.limit_page_length ?? 0))
  if (params.limit_start !== undefined) qp.set("limit_start", String(params.limit_start))
  if (params.order_by) qp.set("order_by", params.order_by)
  return `/resource/${encodeURIComponent(doctype)}?${qp.toString()}`
}

async function getCount(doctype: string, filters?: unknown[]): Promise<number> {
  const qp = new URLSearchParams()
  qp.set("doctype", doctype)
  if (filters) qp.set("filters", JSON.stringify(filters))
  const result = await apiClient<number | string>(`/method/frappe.client.get_count?${qp.toString()}`)
  return Number(result)
}

const LIST_FIELDS = [
  "name", "payment_type", "posting_date", "party", "party_name",
  "paid_amount", "received_amount", "mode_of_payment",
  "reference_no", "status", "docstatus", "company",
]

export type { PaymentEntry, PaymentEntryListResponse, RecordPaymentData, PaymentEntryReference, PartyDetails, AccountDetails, OutstandingReference, GetOutstandingArgs } from "../types"

export interface PaymentListFilters {
  page?: number
  pageSize?: number
  status?: string
  paymentType?: string
  modeOfPayment?: string
  party?: string
  postingDateFrom?: string
  postingDateTo?: string
}

function buildPaymentFilters(params: PaymentListFilters): unknown[] | undefined {
  const filters: unknown[] = []
  if (params.status) {
    const docstatus = params.status === "draft" ? 0 : params.status === "submitted" ? 1 : 2
    filters.push(["docstatus", "=", docstatus])
  }
  if (params.paymentType) {
    filters.push(["payment_type", "=", params.paymentType])
  }
  if (params.modeOfPayment) {
    filters.push(["mode_of_payment", "=", params.modeOfPayment])
  }
  if (params.party) {
    filters.push(["party_name", "like", `%${params.party}%`])
  }
  if (params.postingDateFrom) {
    filters.push(["posting_date", ">=", params.postingDateFrom])
  }
  if (params.postingDateTo) {
    filters.push(["posting_date", "<=", params.postingDateTo])
  }
  return filters.length > 0 ? filters : undefined
}

export const paymentService = {
  async list(params: PaymentListFilters = {}): Promise<PaymentEntryListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10
    const filters = buildPaymentFilters(params)

    const [rows, total] = await Promise.all([
      apiClient<PaymentEntry[]>(
        buildListUrl("Payment Entry", {
          fields: LIST_FIELDS,
          filters,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "posting_date desc",
        })
      ),
      getCount("Payment Entry", filters),
    ])

    return {
      items: rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  },

  async getById(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(`/resource/Payment Entry/${encodeURIComponent(name)}`)
  },

  async getPartyDetails(
    company: string,
    partyType: string,
    party: string,
    date: string
  ): Promise<PartyDetails> {
    return apiClient<PartyDetails>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details?` +
      new URLSearchParams({
        company,
        party_type: partyType,
        party,
        date,
      }).toString()
    )
  },

  async getAccountDetails(account: string, date: string): Promise<AccountDetails> {
    return apiClient<AccountDetails>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_account_details?` +
      new URLSearchParams({ account, date }).toString()
    )
  },

  async getOutstandingReferences(args: GetOutstandingArgs): Promise<OutstandingReference[]> {
    return apiClient<OutstandingReference[]>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents?` +
      new URLSearchParams({ args: JSON.stringify(args) }).toString()
    )
  },

  async getExchangeRate(fromCurrency: string, toCurrency: string, date: string): Promise<number> {
    const result = await apiClient<number | string>(
      `/method/erpnext.setup.utils.get_exchange_rate?` +
      new URLSearchParams({
        transaction_date: date,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }).toString()
    )
    return Number(result) || 1
  },

  async getModeOfPaymentAccount(mop: string, company: string): Promise<string | null> {
    try {
      const doc = await apiClient<Record<string, unknown>>(
        `/resource/Mode%20of%20Payment/${encodeURIComponent(mop)}?fields=${encodeURIComponent(JSON.stringify(["accounts"]))}`
      )
      const accounts = (doc.accounts as Array<{ company: string; default_account: string }>) || []
      const match = accounts.find((a) => a.company === company)
      return match?.default_account || accounts[0]?.default_account || null
    } catch {
      return null
    }
  },

  async getContactsForParty(partyType: string, party: string): Promise<Array<{ name: string }>> {
    try {
      const result = await apiClient<Array<{ value: string; description?: string }>>(
        `/method/frappe.contacts.doctype.contact.contact.contact_query?` +
        new URLSearchParams({
          link_doctype: partyType,
          link_name: party,
        }).toString()
      )
      return result.map((r) => ({ name: r.value }))
    } catch {
      return []
    }
  },

  async getUnpaidInvoices(filters?: unknown[], partyType?: string): Promise<SalesInvoice[]> {
    const baseFilters: unknown[] = [["docstatus", "=", 1], ["outstanding_amount", ">", 0]]
    const allFilters = filters ? [...baseFilters, ...filters] : baseFilters

    const doctype = partyType === "Supplier" ? "Purchase Invoice" : "Sales Invoice"
    const fields = partyType === "Supplier"
      ? ["name", "supplier as customer", "supplier_name as customer_name", "grand_total", "outstanding_amount", "posting_date", "due_date", "status"]
      : ["name", "customer", "customer_name", "grand_total", "outstanding_amount", "posting_date", "due_date", "status"]

    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(fields))
    qp.set("filters", JSON.stringify(allFilters))
    qp.set("limit_page_length", "100")
    return apiClient<SalesInvoice[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
  },

  async saveDraft(data: RecordPaymentData): Promise<PaymentEntry> {
    const safeDate = (v?: string) => (v && DATE_RE.test(v) ? v : undefined)

    const doc: Record<string, unknown> = {
      doctype: "Payment Entry",
      payment_type: data.payment_type,
      party_type: data.party_type || undefined,
      party: data.party || undefined,
      posting_date: data.posting_date,
      company: data.company,
      mode_of_payment: data.mode_of_payment || undefined,
      paid_from: data.paid_from,
      paid_from_account_currency: data.paid_from_account_currency,
      paid_to: data.paid_to,
      paid_to_account_currency: data.paid_to_account_currency,
      paid_amount: data.paid_amount,
      received_amount: data.received_amount,
      source_exchange_rate: data.source_exchange_rate,
      target_exchange_rate: data.target_exchange_rate,
      base_paid_amount: data.base_paid_amount,
      base_received_amount: data.base_received_amount,
      reference_no: data.reference_no || undefined,
      reference_date: safeDate(data.reference_date),
      remarks: data.remarks || undefined,
    }

    if (data.amended_from) doc.amended_from = data.amended_from
    if (data.bank_account) doc.bank_account = data.bank_account
    if (data.party_bank_account) doc.party_bank_account = data.party_bank_account
    if (data.contact_person) doc.contact_person = data.contact_person
    if (data.contact_email) doc.contact_email = data.contact_email

    const validRefs = (data.references || []).filter((r) => r.allocated_amount > 0)
    if (validRefs.length > 0) {
      doc.references = validRefs.map((r) => ({
        reference_doctype: r.reference_doctype,
        reference_name: r.reference_name,
        total_amount: r.total_amount,
        outstanding_amount: r.outstanding_amount,
        allocated_amount: r.allocated_amount,
        due_date: safeDate(r.due_date),
        exchange_rate: r.exchange_rate || undefined,
        account: r.account || undefined,
      }))
    }

    if (data.deductions && data.deductions.length > 0) {
      doc.deductions = data.deductions
        .filter((d) => d.account && d.amount > 0)
        .map((d) => ({
          account: d.account,
          cost_center: d.cost_center,
          amount: d.amount,
          description: d.description || undefined,
        }))
    }

    return apiClient<PaymentEntry>("/resource/Payment Entry", {
      method: "POST",
      body: JSON.stringify(doc),
    })
  },

  async submitPayment(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 1 }) }
    )
  },

  async cancelPayment(name: string): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ docstatus: 2 }) }
    )
  },

  async deletePayment(name: string): Promise<void> {
    await apiClient(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    )
  },

  async getModeOfPaymentList(): Promise<string[]> {
    try {
      const items = await apiClient<Array<{ name: string }>>(
        `/resource/Mode%20of%20Payment?fields=${encodeURIComponent(JSON.stringify(["name"]))}&limit_page_length=100`
      )
      return items.map((i) => i.name)
    } catch {
      return []
    }
  },

}

export type { SalesInvoice } from "@/modules/invoices/services"
