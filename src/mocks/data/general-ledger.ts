// ERPNext-shaped General Ledger report data for the mock servers. The report
// contract (mirroring erpnext/accounts/report/general_ledger/general_ledger.py):
//  - Summary rows (Opening / Total / Closing) carry no posting_date, with the
//    label placed in `account`.
//  - Running `balance` is computed server-side (balance += debit - credit).
//  - A hidden "GL Entry" link column leads the column list.
//  - Columns for Remarks / Cost Center / Project / transaction & company
//    currency appear conditionally based on the report filters.

export interface GlMockEntry {
  account: string
  against: string
  debit: number
  credit: number
  cost_center: string
  project: string
}

export interface GlMockVoucher {
  voucher_no: string
  voucher_type: string
  posting_date: string
  party_type: string
  party: string
  party_name: string
  remarks: string
  is_cancelled?: boolean
  against_voucher_no?: string
  entries: GlMockEntry[]
}

export interface GlColumn {
  label: string
  fieldname: string
  fieldtype: string
  width: number
  options?: string
  hidden?: number
}

export interface GlRow {
  account: string
  posting_date?: string
  debit?: number
  credit?: number
  balance?: number
  voucher_type?: string
  voucher_no?: string
  against?: string
  party_type?: string
  party?: string
  party_name?: string
  remarks?: string
  cost_center?: string
  project?: string
  gl_entry?: string
  debit_in_account_currency?: number
  credit_in_account_currency?: number
  debit_in_transaction_currency?: number | null
  credit_in_transaction_currency?: number | null
  transaction_currency?: string
  [key: string]: unknown
}

export interface GlFilters {
  voucher_no?: string
  against_voucher_no?: string
  account?: string[]
  party_type?: string
  party?: string[]
  categorize_by?: string
  cost_center?: string[]
  project?: string[]
  include_dimensions?: unknown
  show_remarks?: unknown
  show_cancelled_entries?: unknown
  show_amount_in_company_currency?: unknown
  add_values_in_transaction_currency?: unknown
}

const GL_VOUCHERS: GlMockVoucher[] = [
  {
    voucher_no: "ACC-PAY-0001",
    voucher_type: "Payment Entry",
    posting_date: "2026-08-01",
    party_type: "Customer",
    party: "AlphaCorp",
    party_name: "AlphaCorp Inc",
    remarks: "Payment received from AlphaCorp against ACC-SINV-2026-00058",
    entries: [
      { account: "Cash - BE", against: "Debtors - BE", debit: 0, credit: 200, cost_center: "Main - BE", project: "" },
      { account: "Debtors - BE", against: "Cash - BE", debit: 200, credit: 0, cost_center: "Main - BE", project: "" },
    ],
  },
  {
    voucher_no: "ACC-PAY-0002",
    voucher_type: "Payment Entry",
    posting_date: "2026-08-05",
    party_type: "Customer",
    party: "BetaInc",
    party_name: "Beta Inc",
    remarks: "Payment received from BetaInc",
    against_voucher_no: "ACC-SINV-2026-00060",
    entries: [
      { account: "Cash - BE", against: "Debtors - BE", debit: 0, credit: 150, cost_center: "Operations - BE", project: "" },
      { account: "Debtors - BE", against: "Cash - BE", debit: 150, credit: 0, cost_center: "Operations - BE", project: "" },
    ],
  },
  {
    voucher_no: "ACC-PAY-0003",
    voucher_type: "Payment Entry",
    posting_date: "2026-08-07",
    party_type: "Customer",
    party: "GammaLtd",
    party_name: "Gamma Ltd",
    remarks: "Payment cancelled after duplicate detected",
    is_cancelled: true,
    entries: [
      { account: "Cash - BE", against: "Debtors - BE", debit: 0, credit: 500, cost_center: "Sales - BE", project: "" },
      { account: "Debtors - BE", against: "Cash - BE", debit: 500, credit: 0, cost_center: "Sales - BE", project: "" },
    ],
  },
]

function summaryRow(account: string, balance: number): GlRow {
  return { account, balance }
}

function buildColumns(opts: {
  showRemarks: boolean
  includeDimensions: boolean
  showCompanyCurrency: boolean
  addTransactionCurrency: boolean
}): GlColumn[] {
  const cols: GlColumn[] = [
    { label: "GL Entry", fieldname: "gl_entry", fieldtype: "Link", options: "GL Entry", width: 140, hidden: 1 },
    { label: "Posting Date", fieldname: "posting_date", fieldtype: "Date", width: 100 },
    { label: "Account", fieldname: "account", fieldtype: "Link", options: "Account", width: 180 },
    { label: "Debit (CAD)", fieldname: "debit", fieldtype: "Currency", width: 130 },
    { label: "Credit (CAD)", fieldname: "credit", fieldtype: "Currency", width: 130 },
    { label: "Balance (CAD)", fieldname: "balance", fieldtype: "Currency", width: 130 },
    { label: "Voucher Type", fieldname: "voucher_type", fieldtype: "Select", width: 130 },
    { label: "Voucher No", fieldname: "voucher_no", fieldtype: "Dynamic Link", options: "voucher_type", width: 200 },
    { label: "Against Account", fieldname: "against", fieldtype: "Link", options: "Account", width: 160 },
    { label: "Party Type", fieldname: "party_type", fieldtype: "Link", options: "Party Type", width: 110 },
    { label: "Party", fieldname: "party", fieldtype: "Dynamic Link", options: "party_type", width: 150 },
  ]
  if (opts.addTransactionCurrency) {
    cols.push(
      { label: "Debit (Transaction)", fieldname: "debit_in_transaction_currency", fieldtype: "Currency", width: 130 },
      { label: "Credit (Transaction)", fieldname: "credit_in_transaction_currency", fieldtype: "Currency", width: 130 }
    )
  }
  if (opts.showCompanyCurrency) {
    cols.push(
      { label: "Debit (Company)", fieldname: "debit_in_account_currency", fieldtype: "Currency", width: 130 },
      { label: "Credit (Company)", fieldname: "credit_in_account_currency", fieldtype: "Currency", width: 130 }
    )
  }
  if (opts.includeDimensions) {
    cols.push(
      { label: "Cost Center", fieldname: "cost_center", fieldtype: "Link", options: "Cost Center", width: 150 },
      { label: "Project", fieldname: "project", fieldtype: "Link", options: "Project", width: 150 }
    )
  }
  if (opts.showRemarks) {
    cols.push({ label: "Remarks", fieldname: "remarks", fieldtype: "Data", width: 300 })
  }
  return cols
}

export function generateGeneralLedger(filters: GlFilters = {}): { columns: GlColumn[]; result: GlRow[] } {
  const categorizeBy = String(filters.categorize_by ?? "Categorize by Voucher (Consolidated)")
  const showCancelled = String(filters.show_cancelled_entries ?? "0") === "1"
  const showRemarks = String(filters.show_remarks ?? "0") === "1"
  const includeDimensions = String(filters.include_dimensions ?? "1") !== "0"
  const showCompanyCurrency = String(filters.show_amount_in_company_currency ?? "0") === "1"
  const addTransactionCurrency = String(filters.add_values_in_transaction_currency ?? "0") === "1"
  const voucherNo = String(filters.voucher_no ?? "")
  const againstVoucherNo = String(filters.against_voucher_no ?? "")
  const accountFilter = Array.isArray(filters.account) ? filters.account.map(String) : []
  const partyType = String(filters.party_type ?? "")
  const partyFilter = Array.isArray(filters.party) ? filters.party.map(String) : []
  const costCenterFilter = Array.isArray(filters.cost_center) ? filters.cost_center.map(String) : []
  const projectFilter = Array.isArray(filters.project) ? filters.project.map(String) : []

  let vouchers = GL_VOUCHERS.filter((v) => !v.is_cancelled || showCancelled)
  if (voucherNo) vouchers = vouchers.filter((v) => v.voucher_no === voucherNo)
  if (againstVoucherNo) vouchers = vouchers.filter((v) => v.against_voucher_no === againstVoucherNo)
  if (partyType && partyFilter.length) {
    vouchers = vouchers.filter((v) => v.party_type === partyType && partyFilter.includes(v.party))
  }
  if (costCenterFilter.length) {
    vouchers = vouchers
      .map((v) => ({ ...v, entries: v.entries.filter((e) => costCenterFilter.includes(e.cost_center)) }))
      .filter((v) => v.entries.length > 0)
  }
  if (projectFilter.length) {
    vouchers = vouchers
      .map((v) => ({ ...v, entries: v.entries.filter((e) => projectFilter.includes(e.project)) }))
      .filter((v) => v.entries.length > 0)
  }
  if (accountFilter.length) {
    vouchers = vouchers
      .map((v) => ({ ...v, entries: v.entries.filter((e) => accountFilter.includes(e.account)) }))
      .filter((v) => v.entries.length > 0)
  }

  let running = 0
  const entryRows: GlRow[] = []
  for (const v of vouchers) {
    for (const e of v.entries) {
      running += e.debit - e.credit
      entryRows.push({
        gl_entry: `GL-${v.voucher_no}`,
        posting_date: v.posting_date,
        account: e.account,
        debit: e.debit,
        credit: e.credit,
        balance: running,
        voucher_type: v.voucher_type,
        voucher_no: v.voucher_no,
        against: e.against,
        party_type: v.party_type,
        party: v.party,
        party_name: v.party_name,
        remarks: v.remarks,
        cost_center: e.cost_center,
        project: e.project,
        debit_in_account_currency: e.debit,
        credit_in_account_currency: e.credit,
        debit_in_transaction_currency: e.debit,
        credit_in_transaction_currency: e.credit,
        transaction_currency: "CAD",
      })
    }
  }

  const result: GlRow[] = []
  const finalBalance = entryRows.length ? entryRows[entryRows.length - 1].balance ?? 0 : 0
  const closing = finalBalance

  if (categorizeBy === "Categorize by Account") {
    result.push(summaryRow("Opening", 0))
    const byAccount = new Map<string, GlRow[]>()
    for (const r of entryRows) {
      const list = byAccount.get(r.account) ?? []
      list.push(r)
      byAccount.set(r.account, list)
    }
    for (const [account, rows] of byAccount) {
      result.push(...rows)
      result.push(summaryRow(account, rows[rows.length - 1].balance ?? 0))
    }
    result.push(summaryRow("Closing (Opening + Total)", closing))
  } else if (categorizeBy === "Categorize by Party") {
    result.push(summaryRow("Opening", 0))
    const byParty = new Map<string, GlRow[]>()
    for (const r of entryRows) {
      const key = r.party || "No Party"
      const list = byParty.get(key) ?? []
      list.push(r)
      byParty.set(key, list)
    }
    for (const [party, rows] of byParty) {
      result.push(...rows)
      result.push(summaryRow(party, rows[rows.length - 1].balance ?? 0))
    }
    result.push(summaryRow("Closing (Opening + Total)", closing))
  } else if (categorizeBy === "Categorize by Voucher") {
    for (const v of vouchers) {
      const vRows = entryRows.filter((r) => r.voucher_no === v.voucher_no)
      if (vRows.length === 0) continue
      const before = (vRows[0].balance ?? 0) - (vRows[0].debit ?? 0) + (vRows[0].credit ?? 0)
      result.push(summaryRow("Opening", before))
      result.push(...vRows)
      result.push(summaryRow("Closing", vRows[vRows.length - 1].balance ?? 0))
    }
    result.push(summaryRow("Total", closing))
    result.push(summaryRow("Closing (Opening + Total)", closing))
  } else if (categorizeBy === "Categorize by Voucher (Consolidated)") {
    result.push(summaryRow("Opening", 0))
    for (const v of vouchers) {
      const vRows = entryRows.filter((r) => r.voucher_no === v.voucher_no)
      if (vRows.length === 0) continue
      result.push(...vRows)
      result.push(summaryRow("Total", vRows[vRows.length - 1].balance ?? 0))
    }
    result.push(summaryRow("Closing (Opening + Total)", closing))
  } else {
    result.push(summaryRow("Opening", 0))
    result.push(...entryRows)
    result.push(summaryRow("Closing (Opening + Total)", closing))
  }

  return {
    columns: buildColumns({ showRemarks, includeDimensions, showCompanyCurrency, addTransactionCurrency }),
    result,
  }
}
