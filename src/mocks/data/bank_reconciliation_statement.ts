// Mock data for the "Bank Reconciliation Statement" script report
// (erpnext/accounts/report/bank_reconciliation_statement/bank_reconciliation_statement.py).
//
// Framework-free so src/mocks/server.ts (vitest) and the browser worker
// (src/mocks/handlers/reports.ts) share the exact same generator.

export interface BankReconStatementColumn {
  label: string
  fieldname: string
  fieldtype: string
  width?: number
  options?: string
}

export interface BankReconStatementRow {
  [key: string]: unknown
}

export interface BankReconStatementFilters {
  company?: string
  account?: string
  report_date?: string
  include_pos_transactions?: number | boolean
}

interface Entry {
  posting_date: string
  payment_document: string
  payment_entry: string
  debit: number
  credit: number
  against_account: string
  reference_no: string
  ref_date: string
  clearance_date: string
  account_currency: string
}

const COLUMNS: BankReconStatementColumn[] = [
  { fieldname: "posting_date", label: "Posting Date", fieldtype: "Date", width: 90 },
  { fieldname: "payment_document", label: "Payment Document Type", fieldtype: "Data", width: 220 },
  {
    fieldname: "payment_entry",
    label: "Payment Document",
    fieldtype: "Dynamic Link",
    options: "payment_document",
    width: 220,
  },
  { fieldname: "debit", label: "Debit", fieldtype: "Currency", options: "account_currency", width: 120 },
  { fieldname: "credit", label: "Credit", fieldtype: "Currency", options: "account_currency", width: 120 },
  { fieldname: "against_account", label: "Against Account", fieldtype: "Link", options: "Account", width: 200 },
  { fieldname: "reference_no", label: "Reference", fieldtype: "Data", width: 100 },
  { fieldname: "ref_date", label: "Ref Date", fieldtype: "Date", width: 110 },
  { fieldname: "clearance_date", label: "Clearance Date", fieldtype: "Date", width: 110 },
  { fieldname: "account_currency", label: "Currency", fieldtype: "Link", options: "Currency", width: 100 },
]

// Uncleared vouchers (posting_date <= report_date, clearance_date empty or
// after report_date). Mirrors the UNION over Journal Entry / Payment Entry /
// Purchase Invoice in get_entries_for_bank_reconciliation_statement.
const ENTRIES: Entry[] = [
  {
    posting_date: "2026-08-15",
    payment_document: "Purchase Invoice",
    payment_entry: "ACC-PINV-2026-00021",
    debit: 3000,
    credit: 0,
    against_account: "VendorOne",
    reference_no: "",
    ref_date: "2026-08-15",
    clearance_date: "",
    account_currency: "CAD",
  },
  {
    posting_date: "2026-08-27",
    payment_document: "Journal Entry",
    payment_entry: "ACC-JV-2026-00012",
    debit: 412.5,
    credit: 0,
    against_account: "BetaInc",
    reference_no: "",
    ref_date: "2026-08-27",
    clearance_date: "",
    account_currency: "CAD",
  },
  {
    posting_date: "2026-09-05",
    payment_document: "Payment Entry",
    payment_entry: "ACC-PAY-2026-00061",
    debit: 0,
    credit: 1500,
    against_account: "AlphaCorp",
    reference_no: "WIRE-092",
    ref_date: "2026-09-05",
    clearance_date: "",
    account_currency: "CAD",
  },
]

const POS_ENTRIES: Entry[] = [
  {
    posting_date: "2026-09-10",
    payment_document: "Sales Invoice",
    payment_entry: "ACC-SINV-2026-00088",
    debit: 250,
    credit: 0,
    against_account: "Cash",
    reference_no: "",
    ref_date: "2026-09-10",
    clearance_date: "",
    account_currency: "CAD",
  },
]

const BALANCE_AS_PER_SYSTEM = 245000.5
const AMOUNTS_NOT_REFLECTED = 412.5

function flt(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0
}

function getBalanceRow(
  label: string,
  amount: number,
  accountCurrency: string
): BankReconStatementRow {
  return {
    payment_entry: label,
    debit: amount > 0 ? amount : 0,
    credit: amount > 0 ? 0 : Math.abs(amount),
    account_currency: accountCurrency,
  }
}

export function generateBankReconciliationStatement(
  filters: BankReconStatementFilters
): { columns: BankReconStatementColumn[]; result: BankReconStatementRow[] } {
  const account = filters.account ? String(filters.account) : ""
  if (!account) return { columns: COLUMNS, result: [] }

  const accountCurrency = "CAD"
  const reportDate = String(filters.report_date ?? "")
  const includePos = Boolean(filters.include_pos_transactions)

  const pool = includePos ? [...ENTRIES, ...POS_ENTRIES] : ENTRIES
  const data = pool
    .filter((entry) => !reportDate || entry.posting_date <= reportDate)
    .sort((a, b) => a.posting_date.localeCompare(b.posting_date))
    .map((entry) => ({ ...entry }))

  let totalDebit = 0
  let totalCredit = 0
  for (const row of data) {
    totalDebit += flt(row.debit)
    totalCredit += flt(row.credit)
  }

  const balanceAsPerSystem = BALANCE_AS_PER_SYSTEM
  const amountsNotReflected = AMOUNTS_NOT_REFLECTED
  const bankBalance =
    balanceAsPerSystem - totalDebit + totalCredit + amountsNotReflected

  const result: BankReconStatementRow[] = [
    ...data,
    getBalanceRow("Bank Statement balance as per General Ledger", balanceAsPerSystem, accountCurrency),
    {},
    {
      payment_entry: "Outstanding Cheques and Deposits to clear",
      debit: totalDebit,
      credit: totalCredit,
      account_currency: accountCurrency,
    },
    getBalanceRow("Cheques and Deposits incorrectly cleared", amountsNotReflected, accountCurrency),
    {},
    getBalanceRow("Calculated Bank Statement balance", bankBalance, accountCurrency),
  ]

  return { columns: COLUMNS, result }
}
