// ERPNext v14 parity: a link field's `link_filters` (configured via
// Customize Form → Link Filters and read by ControlLink through
// `frappe.meta.link_filters`) are applied automatically to the field's
// `search_link` call. This registry is the SPA equivalent of that server-side
// meta, keyed by `<reference doctype>.<fieldname>`. The search for that field
// resolves `getLinkFilters(...)` and sends the filters exactly like ERPNext.
export type LinkFilters = Record<
  string,
  string | number | boolean | Array<string | number>
>

export const LINK_FILTERS: Record<string, LinkFilters> = {
  // sales_team.json: sales_person Link → Sales Person (exclude groups + disabled).
  "Sales Team.sales_person": { is_group: 0, enabled: 1 },
}

export function getLinkFilters(
  referenceDoctype: string,
  fieldname: string
): LinkFilters | undefined {
  return LINK_FILTERS[`${referenceDoctype}.${fieldname}`]
}