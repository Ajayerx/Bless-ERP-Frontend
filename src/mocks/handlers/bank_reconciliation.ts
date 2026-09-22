import { http, HttpResponse } from "msw"
import {
  autoReconcileVouchers,
  createBankEntries,
  createJournalEntryBts,
  createPaymentEntryBts,
  getAccountBalance,
  getBankMapping,
  getBankTransactionDoc,
  getBankTransactions,
  getHeaderMapping,
  getLinkedPayments,
  getReconcilableDoctypes,
  listBankTransactions,
  reconcileVouchers,
  saveBankMapping,
  updateBankTransaction,
  updateBankTransactionDoc,
  uploadBankStatement,
} from "../data/bank_reconciliation"

// Browser (MOCK_MODE) handlers for the Bank Reconciliation Tool. The node test
// server handles the same paths inside src/mocks/server.ts; both delegate to
// the shared pure backend in src/mocks/data/bank_reconciliation.ts.
const TOOL = "/api/method/erpnext.accounts.doctype.bank_reconciliation_tool.bank_reconciliation_tool"
const UPLOAD = "/api/method/erpnext.accounts.doctype.bank_transaction.bank_transaction_upload"

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    try {
      return (await request.json()) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  try {
    const form = await request.formData()
    const out: Record<string, unknown> = {}
    form.forEach((value, key) => {
      out[key] = value
    })
    return out
  } catch {
    return {}
  }
}

function reply(result: { body: Record<string, unknown>; status?: number }) {
  return HttpResponse.json(result.body as Parameters<typeof HttpResponse.json>[0], {
    status: result.status ?? 200,
  })
}

export const bankReconciliationHandlers = [
  http.post(`${TOOL}.get_bank_transactions`, async ({ request }) =>
    reply(getBankTransactions(await readBody(request)))
  ),
  http.post(`${TOOL}.get_account_balance`, async () => reply(getAccountBalance())),
  http.post(`${TOOL}.get_linked_payments`, async ({ request }) =>
    reply(getLinkedPayments(await readBody(request)))
  ),
  http.post(`${TOOL}.reconcile_vouchers`, async ({ request }) =>
    reply(reconcileVouchers(await readBody(request)))
  ),
  http.post(`${TOOL}.create_payment_entry_bts`, async ({ request }) =>
    reply(createPaymentEntryBts(await readBody(request)))
  ),
  http.post(`${TOOL}.create_journal_entry_bts`, async ({ request }) =>
    reply(createJournalEntryBts(await readBody(request)))
  ),
  http.post(`${TOOL}.update_bank_transaction`, async ({ request }) =>
    reply(updateBankTransaction(await readBody(request)))
  ),
  http.post(`${TOOL}.auto_reconcile_vouchers`, async ({ request }) =>
    reply(autoReconcileVouchers(await readBody(request)))
  ),
  http.post(
    "/api/method/erpnext.accounts.doctype.bank_transaction.bank_transaction.get_doctypes_for_bank_reconciliation",
    async () => HttpResponse.json({ message: getReconcilableDoctypes() })
  ),
  http.post(`${UPLOAD}.upload_bank_statement`, async ({ request }) =>
    reply(uploadBankStatement(await readBody(request)))
  ),
  http.post(`${UPLOAD}.get_bank_mapping`, async ({ request }) =>
    reply(getBankMapping(await readBody(request)))
  ),
  http.post(`${UPLOAD}.get_header_mapping`, async ({ request }) =>
    reply(getHeaderMapping(await readBody(request)))
  ),
  http.post(`${UPLOAD}.save_bank_mapping`, async ({ request }) =>
    reply(saveBankMapping(await readBody(request)))
  ),
  http.post(`${UPLOAD}.create_bank_entries`, async ({ request }) =>
    reply(createBankEntries(await readBody(request)))
  ),
  http.get("/api/resource/Bank Transaction", ({ request }) => {
    const url = new URL(request.url)
    const q: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      q[key] = value
    })
    return reply(listBankTransactions(q))
  }),
  http.get("/api/resource/Bank Transaction/:name", ({ params }) =>
    reply(getBankTransactionDoc(String(params.name)))
  ),
  http.put("/api/resource/Bank Transaction/:name", async ({ params, request }) =>
    reply(updateBankTransactionDoc(String(params.name), await readBody(request)))
  ),
]
