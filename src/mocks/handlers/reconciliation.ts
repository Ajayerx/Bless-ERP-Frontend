import { http, HttpResponse } from "msw"
import {
  dispatchRunDocMethod,
  getReconPartyAccount,
  reconState,
} from "../data/reconciliation"

// Browser (MOCK_MODE) handlers for Payment Reconciliation. The node test
// server handles the same paths inside src/mocks/server.ts; both delegate to
// the shared pure backend in src/mocks/data/reconciliation.ts.
async function readMethodBody(request: Request): Promise<Record<string, unknown>> {
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

export const reconciliationHandlers = [
  http.post("/api/method/run_doc_method", async ({ request }) => {
    const body = await readMethodBody(request)
    const result = dispatchRunDocMethod({
      method: String(body.method ?? ""),
      docs: body.docs,
      args: body.args,
    })
    return HttpResponse.json(result.body as Parameters<typeof HttpResponse.json>[0], {
      status: result.status ?? 200,
    })
  }),

  http.post("/api/method/erpnext.accounts.party.get_party_account", async ({ request }) => {
    const body = await readMethodBody(request)
    return HttpResponse.json({
      message: getReconPartyAccount(String(body.party_type ?? ""), String(body.party ?? "")),
    })
  }),

  http.post("/api/method/process_payment_reconciliation.is_any_doc_running", async () => {
    return HttpResponse.json({ message: reconState.runningJob })
  }),

  http.post(
    "/api/method/erpnext.accounts.doctype.payment_reconciliation.payment_reconciliation.get_queries_for_dimension_filters",
    async () => {
      return HttpResponse.json({ message: reconState.dimensionFilters })
    }
  ),
]
