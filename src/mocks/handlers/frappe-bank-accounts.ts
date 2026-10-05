import { http, HttpResponse, delay } from "msw"

export interface MockBankAccount {
  name: string
  account_name: string
  account?: string
  bank: string
  account_type?: string
  account_subtype?: string
  is_default: number
  is_company_account: number
  company?: string
  party_type?: string
  party?: string
  iban?: string
  bank_account_no?: string
  branch_code?: string
  disabled: number
  integration_id?: string
  last_integration_date?: string
  creation: string
  modified: string
}

export const initialBankAccounts: MockBankAccount[] = [
  {
    name: "Cheque - BE", account_name: "Business Chequing", bank: "Royal Bank of Canada",
    account: "Cheque - BE", account_type: "Bank", company: "Bless Erp",
    is_company_account: 1, is_default: 1, disabled: 0,
    bank_account_no: "0048-4192-1133", iban: "CA23100040008419421133", branch_code: "00484",
    creation: "2024-01-05 09:00:00", modified: "2026-06-20 11:00:00",
  },
  {
    name: "Business Chequing - TD Bank", account_name: "Business Chequing", bank: "Toronto-Dominion Bank",
    account: "Business Chequing - BE", account_type: "Bank", company: "Bless Erp",
    is_company_account: 1, is_default: 0, disabled: 0,
    bank_account_no: "7520-0019-8843", branch_code: "00002",
    creation: "2024-02-14 10:00:00", modified: "2026-05-10 09:30:00",
  },
  {
    name: "Savings - RBC", account_name: "Business Savings", bank: "Royal Bank of Canada",
    account: "Savings - BE", account_type: "Bank", company: "Bless Erp",
    is_company_account: 1, is_default: 0, disabled: 0,
    bank_account_no: "0048-7712-0401", branch_code: "00484",
    creation: "2023-11-02 08:15:00", modified: "2026-07-01 14:00:00",
  },
  {
    name: "USD Account - BMO", account_name: "USD Operations", bank: "Bank of Montreal",
    account: "USD Account - BMO", account_type: "Bank", company: "Bless Erp",
    is_company_account: 1, is_default: 0, disabled: 0,
    bank_account_no: "1190-5512-7788", iban: "CA02119000055127788", branch_code: "00119",
    creation: "2025-03-15 13:00:00", modified: "2026-04-02 10:00:00",
  },
  {
    name: "AlphaCorp CAD - BMO", account_name: "AlphaCorp A/R Collections", bank: "Bank of Montreal",
    party_type: "Customer", party: "AlphaCorp",
    is_company_account: 0, is_default: 0, disabled: 0,
    bank_account_no: "Z-5510-9988",
    creation: "2025-06-01 12:00:00", modified: "2026-06-15 15:00:00",
  },
  {
    name: "Northwind Foods - BMO", account_name: "Northwind Foods Payments", bank: "Bank of Montreal",
    party_type: "Supplier", party: "SUP-00001",
    is_company_account: 0, is_default: 0, disabled: 1,
    bank_account_no: "Y-2201-3344",
    creation: "2025-07-20 09:45:00", modified: "2026-06-22 16:00:00",
  },
]

let bankAccounts = initialBankAccounts.map((b) => ({ ...b }))

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

export function findBankAccount(name: string): MockBankAccount | undefined {
  return bankAccounts.find((b) => b.name === name)
}

export function listBankAccounts(
  filters: unknown[],
  orderBy: string,
  limitStart: number,
  limitLength: number
): MockBankAccount[] {
  let rows = bankAccounts.filter((b) => bankAccountMatchesFilters(b, filters))
  if (orderBy.trim()) {
    const [field, dir] = orderBy.trim().split(/\s+/)
    const mult = (dir ?? "asc").toLowerCase() === "asc" ? 1 : -1
    rows = [...rows].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[field] ?? "")
      const bv = String((b as unknown as Record<string, unknown>)[field] ?? "")
      return av.localeCompare(bv) * mult
    })
  }
  if (limitLength === 0) return rows
  return rows.slice(limitStart, limitStart + limitLength)
}

export function countBankAccounts(filters: unknown[]): number {
  return bankAccounts.filter((b) => bankAccountMatchesFilters(b, filters)).length
}

function bankAccountMatchesFilters(row: MockBankAccount, filters: unknown[]): boolean {
  for (const f of filters) {
    if (!Array.isArray(f) || f.length < 3) continue
    const [field, operator, value] = f as [string, string, unknown]
    const rowVal = (row as unknown as Record<string, unknown>)[field]
    if (operator === "like" && typeof value === "string") {
      const pattern = value.replace(/%/g, "").toLowerCase()
      if (!String(rowVal ?? "").toLowerCase().includes(pattern)) return false
    } else if (operator === "=") {
      // eslint-disable-next-line eqeqeq
      if (Number(rowVal) != Number(value) && rowVal != value) return false
    } else if (operator === "in" && Array.isArray(value)) {
      if (!value.includes(rowVal)) return false
    }
  }
  return true
}

export function upsertBankAccount(name: string, patch: Record<string, unknown>): MockBankAccount | undefined {
  const idx = bankAccounts.findIndex((b) => b.name === name)
  if (idx === -1) return undefined
  bankAccounts[idx] = { ...bankAccounts[idx], ...patch, modified: nowStamp() } as MockBankAccount
  return bankAccounts[idx]
}

export function addBankAccount(body: Record<string, unknown>): MockBankAccount {
  const accountName = String(body.account_name ?? "Bank Account")
  const bank = String(body.bank ?? "Bank")
  const name = String(body.name ?? `${accountName} - ${bank}`)
  const row: MockBankAccount = {
    name,
    account_name: accountName,
    bank,
    account: body.account as string | undefined,
    account_type: (body.account_type as string) || undefined,
    account_subtype: body.account_subtype as string | undefined,
    company: body.company as string | undefined,
    is_company_account: Number(body.is_company_account ?? 0),
    is_default: Number(body.is_default ?? 0),
    disabled: Number(body.disabled ?? 0),
    party_type: body.party_type as string | undefined,
    party: body.party as string | undefined,
    iban: body.iban as string | undefined,
    bank_account_no: body.bank_account_no as string | undefined,
    branch_code: body.branch_code as string | undefined,
    creation: nowStamp(),
    modified: nowStamp(),
    ...(body as Record<string, unknown>),
  } as MockBankAccount
  bankAccounts.push(row)
  return row
}

export function removeBankAccounts(names: string[]): void {
  const set = new Set(names)
  for (let i = bankAccounts.length - 1; i >= 0; i--) {
    if (set.has(bankAccounts[i].name)) bankAccounts.splice(i, 1)
  }
}

// ── Handlers ─────────────────────────────────────────────────────────
export const frappeBankAccountHandlers = [
  // ── GET /api/resource/Bank Account?fields=...&filters=...&limit... ──
  http.get("/api/resource/Bank Account", async ({ request }) => {
    await delay(150)
    const url = new URL(request.url)
    let filters: unknown[] = []
    try { filters = JSON.parse(url.searchParams.get("filters") ?? "[]") } catch { filters = [] }
    const limit_page_length = Number(url.searchParams.get("limit_page_length") ?? "0")
    const limit_start = Number(url.searchParams.get("limit_start") ?? "0")
    const order_by = url.searchParams.get("order_by") ?? ""
    const rows = listBankAccounts(filters, order_by, limit_start, limit_page_length)
    return HttpResponse.json({ data: rows })
  }),

  // ── GET /api/resource/Bank Account/{name} ─────────────────────────
  http.get("/api/resource/Bank Account/:name", async ({ params }) => {
    await delay(120)
    const doc = findBankAccount(String(params.name))
    if (!doc) {
      return HttpResponse.json({ message: "Not Found", exc_type: "DoesNotExistError" }, { status: 404 })
    }
    return HttpResponse.json({ data: doc })
  }),

  // ── POST /api/resource/Bank Account ───────────────────────────────
  http.post("/api/resource/Bank Account", async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as Record<string, unknown>
    const row = addBankAccount(body)
    return HttpResponse.json({ data: row })
  }),

  // ── PUT /api/resource/Bank Account/{name} ─────────────────────────
  http.put("/api/resource/Bank Account/:name", async ({ params, request }) => {
    await delay(150)
    const body = (await request.json()) as Record<string, unknown>
    const row = upsertBankAccount(String(params.name), body)
    if (!row) return HttpResponse.json({ message: "Not Found" }, { status: 404 })
    return HttpResponse.json({ data: row })
  }),

  // ── DELETE /api/resource/Bank Account/{name} ──────────────────────
  http.delete("/api/resource/Bank Account/:name", async ({ params }) => {
    await delay(100)
    removeBankAccounts([String(params.name)])
    return HttpResponse.json({ data: null })
  }),

  // ── get_bank_account_details (Payment Entry auto-fill) ────────────
  http.post("/api/method/erpnext.accounts.doctype.bank_account.bank_account.get_bank_account_details", async ({ request }) => {
    await delay(100)
    const fd = await request.formData().catch(() => new FormData())
    const bankAccount = String(fd.get("bank_account") ?? "")
    const doc = findBankAccount(bankAccount)
    if (!doc) return HttpResponse.json({ message: {} })
    return HttpResponse.json({
      message: {
        account: doc.account ?? "",
        bank: doc.bank,
        bank_account_no: doc.bank_account_no ?? "",
      },
    })
  }),

  // ── make_bank_account (Customer/Supplier "New Bank Account") ──────
  http.post("/api/method/erpnext.accounts.doctype.bank_account.bank_account.make_bank_account", async ({ request }) => {
    await delay(120)
    const fd = await request.formData().catch(() => new FormData())
    const doctype = String(fd.get("doctype") ?? "")
    const docname = String(fd.get("docname") ?? "")
    if (!doctype || !docname) {
      return HttpResponse.json({ message: "doctype and docname are required" }, { status: 400 })
    }
    const row = addBankAccount({
      account_name: `${docname} Bank`,
      bank: "Bank of Montreal",
      party_type: doctype,
      party: docname,
      is_company_account: 0,
      is_default: 0,
      disabled: 0,
    })
    return HttpResponse.json({ message: row })
  }),
]