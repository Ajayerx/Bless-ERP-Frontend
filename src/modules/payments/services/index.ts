import { apiClient } from "@/services/api-client"
import { postMethod, withDedup } from "@/services/frappe-client"
import type { SalesInvoice } from "@/modules/invoices/services"
import type {
  PaymentEntry,
  PaymentEntryListResponse,
  PartyDetails,
  AccountDetails,
  OutstandingReference,
  GetOutstandingArgs,
  RecordPaymentData,
  PaymentEntryTax,
  LedgerPreviewData,
  ContactDetails,
  BankAccountDetails,
  PartyAndAccountBalance,
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

export type { PaymentEntry, PaymentEntryListResponse, RecordPaymentData, PaymentEntryReference, PartyDetails, AccountDetails, OutstandingReference, GetOutstandingArgs, LedgerPreviewData, LedgerPreviewColumn, ContactDetails, BankAccountDetails, PartyAndAccountBalance } from "../types"

export interface PaymentListFilters {
  page?: number
  pageSize?: number
  start?: number
  pageLength?: number
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

function buildPaymentDoc(
  data: RecordPaymentData,
  opts: { omitNamingSeries?: boolean; omitAmendedFrom?: boolean } = {}
): Record<string, unknown> {
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

  if (!opts.omitNamingSeries && data.naming_series) doc.naming_series = data.naming_series
  if (data.sales_taxes_and_charges_template) doc.sales_taxes_and_charges_template = data.sales_taxes_and_charges_template
  if (data.purchase_taxes_and_charges_template) doc.purchase_taxes_and_charges_template = data.purchase_taxes_and_charges_template
  if (data.apply_tax_withholding_amount !== undefined) doc.apply_tax_withholding_amount = data.apply_tax_withholding_amount
  if (data.tax_withholding_category) doc.tax_withholding_category = data.tax_withholding_category
  if (data.print_heading) doc.print_heading = data.print_heading
  if (data.is_opening) doc.is_opening = data.is_opening
  if (!opts.omitAmendedFrom && data.amended_from) doc.amended_from = data.amended_from
  if (data.bank_account) doc.bank_account = data.bank_account
  if (data.party_bank_account) doc.party_bank_account = data.party_bank_account
  if (data.contact_person) doc.contact_person = data.contact_person
  if (data.contact_email) doc.contact_email = data.contact_email
  if (data.cost_center) doc.cost_center = data.cost_center
  if (data.project) doc.project = data.project
  if (data.letter_head) doc.letter_head = data.letter_head
  if (data.book_advance_payments_in_separate_party_account !== undefined) {
    doc.book_advance_payments_in_separate_party_account = data.book_advance_payments_in_separate_party_account
  }
  if (data.reconcile_on_advance_payment_date !== undefined) {
    doc.reconcile_on_advance_payment_date = data.reconcile_on_advance_payment_date
  }

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
        is_exchange_gain_loss: d.is_exchange_gain_loss ? 1 : undefined,
      }))
  }

  if (data.taxes && data.taxes.length > 0) {
    doc.taxes = data.taxes.map((t) => ({
      charge_type: t.charge_type,
      row_id: t.row_id || undefined,
      account_head: t.account_head,
      description: t.description || undefined,
      rate: t.rate ?? undefined,
      tax_amount: t.tax_amount ?? undefined,
      total: t.total ?? undefined,
      add_deduct_tax: t.add_deduct_tax || "Add",
      included_in_paid_amount: t.included_in_paid_amount ? 1 : undefined,
      cost_center: t.cost_center || undefined,
      project: t.project || undefined,
    }))
  }

  return doc
}

export const paymentService = {
  async list(params: PaymentListFilters = {}): Promise<PaymentEntryListResponse> {
    const page = params.page ?? 1
    const pageSize = params.pageLength ?? params.pageSize ?? 10
    const limit_start = params.start != null ? params.start : (page - 1) * pageSize
    const filters = buildPaymentFilters(params)

    const [rows, total] = await Promise.all([
      apiClient<PaymentEntry[]>(
        buildListUrl("Payment Entry", {
          fields: LIST_FIELDS,
          filters,
          limit_page_length: pageSize,
          limit_start,
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
    date: string,
    cost_center?: string
  ): Promise<PartyDetails> {
    const params: Record<string, unknown> = {
      company,
      party_type: partyType,
      party,
      date,
    }
    if (cost_center) params.cost_center = cost_center
    return postMethod<PartyDetails>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_details",
      params
    )
  },

  async getAccountDetails(account: string, date: string, cost_center?: string): Promise<AccountDetails> {
    const params: Record<string, unknown> = { account, date }
    if (cost_center) params.cost_center = cost_center
    return postMethod<AccountDetails>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_account_details",
      params
    )
  },

  async getContactDetails(contact: string): Promise<ContactDetails> {
    return postMethod<ContactDetails>(
      "frappe.contacts.doctype.contact.contact.get_contact_details",
      { contact }
    )
  },

  async getPartyAndAccountBalance(args: {
    company: string
    date: string
    paid_from: string
    paid_to: string
    party_type?: string
    party?: string
    cost_center?: string
  }): Promise<PartyAndAccountBalance> {
    return postMethod<PartyAndAccountBalance>(
      "erpnext.accounts.doctype.payment_entry.payment_entry.get_party_and_account_balance",
      args
    )
  },

  async getBankAccountDetails(bankAccount: string): Promise<BankAccountDetails> {
    return postMethod<BankAccountDetails>(
      "erpnext.accounts.doctype.bank_account.bank_account.get_bank_account_details",
      { bank_account: bankAccount }
    )
  },

  async getOutstandingReferences(args: GetOutstandingArgs): Promise<OutstandingReference[]> {
    return apiClient<OutstandingReference[]>(
      `/method/erpnext.accounts.doctype.payment_entry.payment_entry.get_outstanding_reference_documents?` +
      new URLSearchParams({ args: JSON.stringify(args) }).toString()
    )
  },

  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    date: string,
    keySuffix?: string,
    options?: { skipDedup?: boolean }
  ): Promise<number> {
    const fetchRate = () =>
      postMethod<number | string>("erpnext.setup.utils.get_exchange_rate", {
        transaction_date: date,
        from_currency: fromCurrency,
        to_currency: toCurrency,
      }).then((result) => Number(result) || 1)

    if (options?.skipDedup) return fetchRate()

    const baseKey = `get_exchange_rate:${fromCurrency}:${toCurrency}:${date}`
    const key = keySuffix ? `${baseKey}:${keySuffix}` : baseKey
    return withDedup(key, 2000, fetchRate)
  },

  async getBankCashAccount(modeOfPayment: string, company: string): Promise<string> {
    const result = await postMethod<{ account: string }>(
      "erpnext.accounts.doctype.sales_invoice.sales_invoice.get_bank_cash_account",
      { mode_of_payment: modeOfPayment, company }
    )
    return result.account
  },

  async getModeOfPaymentAccount(mop: string, company: string): Promise<string | null> {
    try {
      return await this.getBankCashAccount(mop, company)
    } catch {
      return null
    }
  },

  async fetchTaxesAndCharges(
    masterDoctype: string,
    masterName: string
  ): Promise<PaymentEntryTax[]> {
    try {
      const result = await apiClient<Array<Record<string, unknown>>>(
        "/method/erpnext.controllers.accounts_controller.get_taxes_and_charges",
        {
          method: "POST",
          body: JSON.stringify({ master_doctype: masterDoctype, master_name: masterName }),
        }
      )
      return (result || []).map((t) => ({
        charge_type: String(t.charge_type === "On Net Total" ? "On Paid Amount" : t.charge_type || ""),
        account_head: String(t.account_head || ""),
        description: t.description ? String(t.description) : undefined,
        rate: t.rate != null ? Number(t.rate) : undefined,
        tax_amount: t.tax_amount != null ? Number(t.tax_amount) : undefined,
        total: t.total != null ? Number(t.total) : undefined,
        add_deduct_tax: String(t.add_deduct_tax || "Add"),
        included_in_paid_amount: t.included_in_paid_amount ? 1 : 0,
        cost_center: t.cost_center ? String(t.cost_center) : undefined,
        project: t.project ? String(t.project) : undefined,
        currency: t.currency ? String(t.currency) : undefined,
      }))
    } catch {
      return []
    }
  },

  async getSupplierWithholding(party: string): Promise<string | null> {
    try {
      const result = await apiClient<Record<string, unknown>>(
        "/method/frappe.client.get_value?" +
        new URLSearchParams({
          doctype: "Supplier",
          fieldname: JSON.stringify(["tax_withholding_category"]),
          filters: JSON.stringify({ name: party }),
        }).toString()
      )
      return (result.tax_withholding_category as string) || null
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
    return apiClient<PaymentEntry>("/resource/Payment Entry", {
      method: "POST",
      body: JSON.stringify(buildPaymentDoc(data)),
    })
  },

  async updatePayment(name: string, data: RecordPaymentData): Promise<PaymentEntry> {
    return apiClient<PaymentEntry>(
      `/resource/Payment Entry/${encodeURIComponent(name)}`,
      {
        method: "PUT",
        body: JSON.stringify(buildPaymentDoc(data, { omitNamingSeries: true, omitAmendedFrom: true })),
      }
    )
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

  async getAccountingLedgerPreview(company: string, name: string): Promise<LedgerPreviewData> {
    return apiClient<LedgerPreviewData>(
      "/method/erpnext.controllers.stock_controller.show_accounting_ledger_preview",
      {
        method: "POST",
        body: JSON.stringify({ company, doctype: "Payment Entry", docname: name }),
      }
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
