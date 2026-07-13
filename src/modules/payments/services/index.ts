import { apiClient } from "@/services/api-client"
import { getCompany } from "@/services/company"
import type { SalesInvoice } from "@/modules/invoices/services"
import type { PaymentEntry, PaymentEntryListResponse, RecordPaymentData } from "../types"

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
  "reference_no", "status", "docstatus",
]

const MOP_TO_ERP: Record<string, string> = {
  cash: "Cash",
  interac: "Wire Transfer",
  e_transfer: "Wire Transfer",
  check: "Cheque",
  bank_transfer: "Wire Transfer",
  credit_card: "Credit Card",
  on_account: "Credit Card",
}

interface DocTypeOption {
  name: string
}

export type { PaymentEntry, PaymentEntryListResponse, PaymentMethod, PAYMENT_METHOD_MAP, RecordPaymentData, InvoiceAllocation, PaymentDeductionForm } from "../types"

export const paymentService = {
  async list(params: { page?: number; pageSize?: number } = {}): Promise<PaymentEntryListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 10

    const [rows, total] = await Promise.all([
      apiClient<PaymentEntry[]>(
        buildListUrl("Payment Entry", {
          fields: LIST_FIELDS,
          limit_page_length: pageSize,
          limit_start: (page - 1) * pageSize,
          order_by: "posting_date desc",
        })
      ),
      getCount("Payment Entry"),
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

  async getUnpaidInvoices(filters?: unknown[]): Promise<SalesInvoice[]> {
    const baseFilters: unknown[] = [["docstatus", "=", 1], ["outstanding_amount", ">", 0]]
    const allFilters = filters ? [...baseFilters, ...filters] : baseFilters

    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify([
      "name", "customer", "customer_name", "grand_total",
      "outstanding_amount", "posting_date", "due_date", "status",
    ]))
    qp.set("filters", JSON.stringify(allFilters))
    qp.set("limit_page_length", "100")
    return apiClient<SalesInvoice[]>(`/resource/Sales Invoice?${qp.toString()}`)
  },

  async fetchOptions(doctype: string, labelField?: string): Promise<Array<{ name: string; label?: string }>> {
    const fields = labelField ? ["name", labelField] : ["name"]
    const qp = new URLSearchParams()
    qp.set("fields", JSON.stringify(fields))
    qp.set("limit_page_length", "500")
    const items = await apiClient<DocTypeOption[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
    return items
  },

  async record(data: RecordPaymentData): Promise<PaymentEntry> {
    const modeOfPayment = MOP_TO_ERP[data.paymentMethod] || "Wire Transfer"

    let paidFrom: string
    let paidTo: string

    if (data.paymentType === "Receive") {
      paidFrom = data.paidFromOverride || "Debtors - BE"
      paidTo = data.paidToOverride || (data.bankAccount || "Cash - BE")
    } else if (data.paymentType === "Pay") {
      paidFrom = data.paidFromOverride || (data.bankAccount || "Cash - BE")
      paidTo = data.paidToOverride || "Creditors - BE"
    } else {
      paidFrom = data.paidFromOverride || (data.bankAccount || "Cash - BE")
      paidTo = data.paidToOverride || (data.bankAccount || "Cash - BE")
    }

    const company = await getCompany()
    const doc: Record<string, unknown> = {
      doctype: "Payment Entry",
      payment_type: data.paymentType,
      party_type: data.partyType,
      party: data.party.trim(),
      posting_date: data.paymentDate,
      company,
      paid_from: paidFrom,
      paid_from_account_currency: "CAD",
      paid_to: paidTo,
      paid_to_account_currency: "CAD",
      paid_amount: data.amount,
      received_amount: data.amount,
      reference_no: data.reference || undefined,
      reference_date: data.paymentDate,
      mode_of_payment: modeOfPayment,
      remarks: data.notes || undefined,
      source_exchange_rate: data.sourceExchangeRate ?? 1,
      target_exchange_rate: 1,
    }

    if (data.bankAccount) doc.bank_account = data.bankAccount
    if (data.partyBankAccount) doc.party_bank_account = data.partyBankAccount
    if (data.contactPerson) doc.contact_person = data.contactPerson
    if (data.contactEmail) doc.contact_email = data.contactEmail

    if (data.allocations && data.allocations.length > 0) {
      doc.references = data.allocations.map((a) => ({
        reference_doctype: data.paymentType === "Pay" ? "Purchase Invoice" : "Sales Invoice",
        reference_name: a.name,
        total_amount: a.grand_total,
        outstanding_amount: a.outstanding_amount,
        allocated_amount: a.allocated_amount,
      }))
    }

    if (data.deductions && data.deductions.length > 0) {
      doc.deductions = data.deductions.map((d) => ({
        account: d.account,
        amount: d.amount,
        description: d.description || undefined,
      }))
    }

    const created = await apiClient<PaymentEntry>("/resource/Payment Entry", {
      method: "POST",
      body: JSON.stringify(doc),
    })

    if (created?.name) {
      await apiClient(`/resource/Payment Entry/${encodeURIComponent(created.name)}`, {
        method: "PUT",
        body: JSON.stringify({ docstatus: 1 }),
      })
    }

    return created
  },
}

export type { SalesInvoice } from "@/modules/invoices/services"
