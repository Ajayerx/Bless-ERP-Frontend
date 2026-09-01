import { useMemo } from "react"
import { evalDependsOn, type DependsOnContext } from "@/modules/quotations/services/dependsOn"
import type { Quotation } from "@/modules/quotations/types"

/**
 * B4 parity — re-evaluate every `depends_on`-style rule after each form
 * change (mirrors ERPNext `frm.toggle_display` / `refresh_dependency`).
 *
 * Each rule maps a fieldname to its expression; a field is *visible* when
 * its rule evaluates truthy, *read-only* when `readOnlyWhen` holds, and
 * *reqd* when `reqdWhen` holds (default: configured `reqd`).
 */

export interface QuotationFieldRule {
  fieldname: string
  /**
   * `depends_on`-style expression mirrored from ERPNext. When truthy the
   * field is VISIBLE; `hiddenWhen` is the inverse (field hidden when true).
   * Only one visibility driver should be set per field.
   */
  hiddenWhen?: string
  /** `depends_on` (positive form). Shown when the expression is truthy. */
  showWhen?: string
  /** Static `read_only: 1` from ERPNext. */
  readOnly?: boolean
  /** `read_only_depends_on` — read-only when the expression is truthy. */
  readOnlyWhen?: string
  /** `mandatory_depends_on` — required when truthy. */
  reqdWhen?: string
  /** Hard-required on this doctype (still disabled until its rule passes). */
  reqd?: boolean
  /**
   * ERPNext `allow_on_submit` parity — when true the field remains
   * editable even on submitted documents (docstatus=1).
   */
  allowOnSubmit?: boolean
  /**
   * `set_only_once: 1` — becomes read-only once the doc is saved (not local).
   * Mirrors frappe perm.js "By Set Only Once".
   */
  setOnlyOnce?: boolean
}

/**
 * Static source-of-truth extracted verbatim from
 * `erpnext/selling/doctype/quotation/quotation.json`. Every render path and
 * parity test reads from this table — no field behaviour lives in JSX.
 *
 * `hidden` / `read_only` / `depends_on` / `read_only_depends_on` /
 * `mandatory_depends_on` / `allow_on_submit` / `set_only_once` / `reqd` are
 * copied 1:1 from the doctype definition.
 */
export interface QuotationFieldMeta {
  fieldname: string
  /** `hidden: 1` — permanently hidden regardless of docstatus. */
  hidden?: boolean
  /** `depends_on` — field visible only when this evaluates truthy. */
  dependsOn?: string
  /** `read_only: 1` — always read-only. */
  readOnly?: boolean
  /** `read_only_depends_on` — read-only while truthy. */
  readOnlyDependsOn?: string
  /** `mandatory_depends_on` — required while truthy. */
  mandatoryDependsOn?: string
  /** `reqd: 1`. */
  reqd?: boolean
  /** `allow_on_submit: 1`. */
  allowOnSubmit?: boolean
  /** `set_only_once: 1`. */
  setOnlyOnce?: boolean
  /** Frappe fieldtype (for the hide-if-null HTML/Button/etc exemption). */
  fieldtype?: string
  /** `permlevel` (permissions gate; documented, default 0). */
  permLevel?: number
}

/** Convert an ERPNext field-metadata entry into a frontend rule. */
export function ruleFromMeta(meta: QuotationFieldMeta): QuotationFieldRule {
  // `hidden: 1` permanently hides a field (frappe "By Hidden" wins over the
  // dependency). Only when not permanently hidden does `depends_on` apply.
  let hiddenWhen: string | undefined
  if (meta.hidden) hiddenWhen = "1=1"
  else if (meta.dependsOn) hiddenWhen = invertDependsOn(meta.dependsOn)
  return {
    fieldname: meta.fieldname,
    hiddenWhen,
    readOnly: meta.readOnly,
    readOnlyWhen: meta.readOnlyDependsOn,
    reqdWhen: meta.mandatoryDependsOn,
    reqd: meta.reqd,
    allowOnSubmit: meta.allowOnSubmit,
    setOnlyOnce: meta.setOnlyOnce,
  }
}

/**
 * `depends_on` hides a field when its expression is FALSY; our rule model
 * stores the inverse (`hiddenWhen` = hide when truthy), so negate it.
 * Bare field refs / `eval:` expressions are kept literal.
 */
function invertDependsOn(expr: string): string {
  const src = expr.trim().replace(/^eval:\s*/, "")
  return `!(${src})`
}

/**
 * ERPNext Quotation field metadata (from quotation.json). Section/placeholder
 * fields used only to drive CollapsibleSection visibility are included too.
 */
export const FIELD_META: QuotationFieldMeta[] = [
  // ── Customer / Party ────────────────────────────────────────────
  { fieldname: "title", hidden: true, allowOnSubmit: true, fieldtype: "Data" },
  { fieldname: "naming_series", reqd: true, setOnlyOnce: true, fieldtype: "Select" },
  { fieldname: "quotation_to", reqd: true, fieldtype: "Link" },
  { fieldname: "party_name", fieldtype: "Dynamic Link" },
  { fieldname: "customer_name", readOnly: true, hidden: true, fieldtype: "Data" },
  { fieldname: "amended_from", readOnly: true, fieldtype: "Link" },
  { fieldname: "company", reqd: true, fieldtype: "Link" },
  { fieldname: "transaction_date", reqd: true, fieldtype: "Date" },
  { fieldname: "valid_till", fieldtype: "Date" },
  { fieldname: "order_type", reqd: true, fieldtype: "Select" },
  { fieldname: "customer_group", hidden: true, dependsOn: "eval:(doc.quotation_to=='Customer' && doc.party_name)", fieldtype: "Link" },
  { fieldname: "territory", fieldtype: "Link" },

  // ── Address & Contact ───────────────────────────────────────────
  { fieldname: "customer_address", fieldtype: "Link" },
  { fieldname: "address_display", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "contact_person", fieldtype: "Link" },
  { fieldname: "contact_display", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "contact_mobile", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "contact_email", hidden: true, readOnly: true, fieldtype: "Data" },
  { fieldname: "shipping_address_name", fieldtype: "Link" },
  { fieldname: "shipping_address", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "company_address", fieldtype: "Link" },
  { fieldname: "company_address_display", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "company_contact_person", fieldtype: "Link" },

  // ── Currency / Price List ───────────────────────────────────────
  { fieldname: "currency", reqd: true, fieldtype: "Link" },
  { fieldname: "conversion_rate", reqd: true, fieldtype: "Float" },
  { fieldname: "selling_price_list", reqd: true, fieldtype: "Link" },
  { fieldname: "price_list_currency", readOnly: true, reqd: true, fieldtype: "Link" },
  { fieldname: "plc_conversion_rate", reqd: true, fieldtype: "Float" },
  { fieldname: "ignore_pricing_rule", permLevel: 1, fieldtype: "Check" },

  // ── Items ───────────────────────────────────────────────────────
  { fieldname: "items", reqd: true, fieldtype: "Table" },
  { fieldname: "scan_barcode", fieldtype: "Data" },
  { fieldname: "last_scanned_warehouse", fieldtype: "Data" },
  { fieldname: "has_unit_price_items", hidden: true, fieldtype: "Check" },

  // ── Pricing rules ───────────────────────────────────────────────
  { fieldname: "pricing_rules", readOnly: true, fieldtype: "Table" },

  // ── Items summary / totals ──────────────────────────────────────
  { fieldname: "total_qty", readOnly: true, fieldtype: "Float" },
  { fieldname: "base_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_net_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "net_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "total_net_weight", readOnly: true, dependsOn: "total_net_weight", fieldtype: "Float" },
  { fieldname: "base_total_taxes_and_charges", readOnly: true, fieldtype: "Currency" },
  { fieldname: "total_taxes_and_charges", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_grand_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "grand_total", readOnly: true, reqd: true, fieldtype: "Currency" },
  { fieldname: "base_rounding_adjustment", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "rounding_adjustment", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "base_rounded_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "rounded_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_in_words", readOnly: true, fieldtype: "Data" },
  { fieldname: "in_words", readOnly: true, fieldtype: "Data" },
  { fieldname: "disable_rounded_total", fieldtype: "Check" },

  // ── Taxes ───────────────────────────────────────────────────────
  { fieldname: "tax_category", fieldtype: "Link" },
  { fieldname: "shipping_rule", fieldtype: "Link" },
  { fieldname: "incoterm", fieldtype: "Link" },
  { fieldname: "named_place", dependsOn: "incoterm", fieldtype: "Data" },
  { fieldname: "taxes_and_charges", fieldtype: "Link" },
  { fieldname: "taxes", fieldtype: "Table" },

  // ── Discount / pricing ──────────────────────────────────────────
  { fieldname: "apply_discount_on", fieldtype: "Select" },
  { fieldname: "coupon_code", fieldtype: "Link" },
  { fieldname: "referral_sales_partner", fieldtype: "Link" },
  { fieldname: "additional_discount_percentage", fieldtype: "Float" },
  { fieldname: "discount_amount", fieldtype: "Currency" },
  { fieldname: "base_discount_amount", readOnly: true, fieldtype: "Currency" },

  // ── Payment / Terms ─────────────────────────────────────────────
  { fieldname: "payment_terms_template", fieldtype: "Link" },
  { fieldname: "payment_schedule", fieldtype: "Table" },
  { fieldname: "tc_name", fieldtype: "Link" },
  { fieldname: "terms", fieldtype: "Text Editor" },

  // ── Print settings ──────────────────────────────────────────────
  { fieldname: "letter_head", allowOnSubmit: true, fieldtype: "Link" },
  { fieldname: "group_same_items", allowOnSubmit: true, fieldtype: "Check" },
  { fieldname: "select_print_heading", allowOnSubmit: true, fieldtype: "Link" },
  { fieldname: "language", readOnly: true, fieldtype: "Data" },
  { fieldname: "auto_repeat", readOnly: true, fieldtype: "Link" },
  { fieldname: "update_auto_repeat_reference", dependsOn: "eval:doc.auto_repeat", allowOnSubmit: true, fieldtype: "Button" },

  // ── More Info ───────────────────────────────────────────────────
  { fieldname: "status", readOnly: true, reqd: true, fieldtype: "Select" },
  { fieldname: "territory", fieldtype: "Link" },
  { fieldname: "campaign", fieldtype: "Link" },
  { fieldname: "source", fieldtype: "Link" },
  { fieldname: "opportunity", readOnly: true, fieldtype: "Link" },
  { fieldname: "supplier_quotation", fieldtype: "Link" },
  { fieldname: "enq_det", hidden: true, readOnly: true, fieldtype: "Text" },

  // ── Lost reasons / competitors ──────────────────────────────────
  { fieldname: "order_lost_reason", dependsOn: "eval:doc.status=='Lost'", allowOnSubmit: true, fieldtype: "Small Text" },
  { fieldname: "lost_reasons", allowOnSubmit: true, readOnly: true, fieldtype: "Table MultiSelect" },
  { fieldname: "competitors", allowOnSubmit: true, fieldtype: "Table MultiSelect" },

  // ── Section-level placeholders ──────────────────────────────────
  { fieldname: "lost_reasons_section", dependsOn: "eval:(doc.lost_reasons || doc.order_lost_reason)", fieldtype: "Section Break" },
  { fieldname: "bundle_items_section", dependsOn: "packed_items", fieldtype: "Section Break" },
  { fieldname: "packed_items", fieldtype: "Table" },
]

/**
 * B4 field visibility/read-only/reqd resolution.
 * `hiddenWhen`/`readOnlyWhen`/`reqdWhen` are Frappe `depends_on`-style
 * expressions evaluated against the current doc snapshot.
 * `isLocal` mirrors `__islocal` (new/unsaved doc) and only gates
 * `set_only_once` fields (which stay editable until first save).
 */
export function useVisibilityRules(
  doc: QuotationFormDataPartial,
  rules: QuotationFieldRule[] = DEFAULT_RULES,
  isLocal = true,
) {
  return useMemo(() => {
    const ctx: DependsOnContext = {
      getField: (fieldname) => {
        return (doc as Record<string, unknown>)[fieldname] as
          | string
          | number
          | boolean
          | Array<string | number>
          | null
          | undefined
      },
    }

    const resolved: Record<string, { visible: boolean; readOnly: boolean; reqd: boolean; allowOnSubmit: boolean }> = {}
    for (const rule of rules) {
      const visible = rule.showWhen
        ? evalDependsOn(rule.showWhen, ctx)
        : rule.hiddenWhen
          ? !evalDependsOn(rule.hiddenWhen, ctx)
          : true
      const readOnly =
        !!rule.readOnly ||
        (rule.readOnlyWhen ? evalDependsOn(rule.readOnlyWhen, ctx) : false) ||
        (!!rule.setOnlyOnce && !isLocal)
      const reqd = rule.reqdWhen ? evalDependsOn(rule.reqdWhen, ctx) : !!rule.reqd
      resolved[rule.fieldname] = { visible, readOnly, reqd, allowOnSubmit: !!rule.allowOnSubmit }
    }
    return resolved
  }, [doc, rules, isLocal])
}

export interface ResolvedFieldState {
  visible: boolean
  readOnly: boolean
  reqd: boolean
  allowOnSubmit: boolean
}

/**
 * Frappe `is_null` parity (datatype.js): a value is null only when it is
 * `null`, `undefined`, or a blank/whitespace string. `0` and `false` are
 * NOT null. On a submitted/cancelled doc, every read-only field with a null
 * value is hidden (base_control.get_status → "None"); `0`/`false` are shown.
 */
export function isDocFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "number") return false
  if (typeof value === "boolean") return false
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * Section placeholders and computed rows (in_words…) keep their own
 * hiddenWhen rules and are exempt from the docstatus hide-when-empty rule.
 */
export const EMPTY_HIDE_EXEMPT = new Set([
  "lost_reasons_section",
  "bundle_items_section",
  "in_words",
  "base_in_words",
])

const DEFAULT_FIELD_STATE: ResolvedFieldState = {
  visible: true,
  readOnly: false,
  reqd: false,
  allowOnSubmit: false,
}

/**
 * ERPNext docstatus-driven rendering parity (applied to every field query):
 * - Draft (0): all fields visible and editable.
 * - Submitted (1): read-only unless allow_on_submit; empty read-only fields
 *   are hidden entirely — only fields carrying data show (allow_on_submit
 *   fields, being still writable, are exempt from the empty-hide).
 * - Cancelled (2): everything read-only (incl. allow_on_submit); allow_on_submit
 *   fields behave like other read-only fields, so empty ones are hidden.
 */
export function resolveDocstatusAware(
  base: ResolvedFieldState,
  value: unknown,
  docstatus: number,
  exemptEmptyHide = false,
): ResolvedFieldState {
  const hiddenEmpty =
    docstatus !== 0 &&
    !(docstatus === 1 && base.allowOnSubmit) &&
    !exemptEmptyHide &&
    isDocFieldEmpty(value)
  return {
    ...base,
    visible: base.visible && !hiddenEmpty,
    readOnly:
      base.readOnly || (docstatus === 2 ? true : docstatus === 1 && !base.allowOnSubmit),
  }
}

export { DEFAULT_FIELD_STATE }

export type QuotationFormDataPartial = Partial<Quotation>

/**
 * B4 `depends_on`-family rules — mirrors every `depends_on`,
 * `mandatory_depends_on`, `read_only_depends_on`, and
 * `allow_on_submit` property from `quotation.json`.
 *
 * Section-level rules (fieldname like `lost_reasons_section`) are used
 * to show/hide entire `CollapsibleSection` wrappers in the JSX.
 */
/**
 * ERPNext field rules, generated from `FIELD_META` (quotation.json) so the
 * two can never drift. App-level overlays that aren't pure doctype metadata
 * (e.g. the `in_words` live-compute trigger, party_name requiredness) are
 * merged on top below.
 */
function buildDefaultRules(): QuotationFieldRule[] {
  const rules = FIELD_META.map(ruleFromMeta)

  // Overlay app-level drivers (not encoded as doctype metadata):
  // - party_name is reqd via quotation.js toggle_reqd (not in doctype JSON).
  // - in_words/base_in_words: ERPNext shows these read-only once a value
  //   exists (null → hidden). On drafts the live value is computed client-side
  //   from the rounded total, so we drive visibility off rounded_total — the
  //   app keeps the field hidden until there is something to display.
  // - discount_amount: entering a percentage disables the amount entry
  //   (selling controller behaviour mirroring ERPNext's field interplay).
  const overlay: QuotationFieldRule[] = [
    { fieldname: "party_name", reqd: true },
    { fieldname: "in_words", hiddenWhen: "!rounded_total" },
    { fieldname: "base_in_words", hiddenWhen: "!base_rounded_total" },
    { fieldname: "discount_amount", readOnlyWhen: "additional_discount_percentage>0" },
  ]

  for (const o of overlay) {
    const i = rules.findIndex((r) => r.fieldname === o.fieldname)
    if (i >= 0) rules[i] = { ...rules[i], ...o }
    else rules.push(o)
  }
  return rules
}

export const DEFAULT_RULES: QuotationFieldRule[] = buildDefaultRules()