import { apiClient } from "./api-client"
import { getCompany } from "./company"

export interface TaxRow {
  chargeType: string
  accountHead: string
  rate: number
  description?: string
  includedInPrintRate: number
}

export interface TaxTemplateResult {
  name: string
  doctype: string
  rows: TaxRow[]
}

interface DocTypeOption {
  name: string
}

async function fetchOptions(doctype: string, filters?: unknown[]): Promise<string[]> {
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["name"]))
  qp.set("limit_page_length", "500")
  if (filters) qp.set("filters", JSON.stringify(filters))
  const items = await apiClient<DocTypeOption[]>(`/resource/${encodeURIComponent(doctype)}?${qp.toString()}`)
  return items.map((i) => i.name)
}

export async function getDefaultTaxTemplate(
  doctype: string,
  company?: string
): Promise<TaxTemplateResult | null> {
  const co = company ?? await getCompany()
  const templates = await fetchOptions(doctype, [
    ["company", "=", co],
    ["is_default", "=", 1],
  ])
  if (templates.length === 0) return null
  return getTaxTemplateDetails(doctype, templates[0])
}

export async function getTaxTemplateDetails(
  doctype: string,
  name: string
): Promise<TaxTemplateResult | null> {
  interface TaxRowRaw {
    charge_type: string
    account_head: string
    rate: number
    description?: string
    included_in_print_rate?: number
  }
  interface TemplateDoc {
    name: string
    taxes?: TaxRowRaw[]
  }
  const qp = new URLSearchParams()
  qp.set("fields", JSON.stringify(["*"]))
  try {
    const doc = await apiClient<TemplateDoc>(
      `/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}?${qp.toString()}`
    )
    const taxes = doc.taxes ?? []
    return {
      name: doc.name,
      doctype,
      rows: taxes.map((t) => ({
        chargeType: t.charge_type,
        accountHead: t.account_head,
        rate: t.rate / 100,
        description: t.description,
        includedInPrintRate: t.included_in_print_rate ?? 0,
      })),
    }
  } catch {
    return null
  }
}
