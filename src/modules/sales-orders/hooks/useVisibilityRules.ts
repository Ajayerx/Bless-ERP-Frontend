import { useMemo } from "react"
import { evalDependsOn, type DependsOnContext } from "@/modules/quotations/services/dependsOn"
import {
  isDocFieldEmpty,
  resolveDocstatusAware,
  EMPTY_HIDE_EXEMPT as QUOTATION_EMPTY_HIDE_EXEMPT,
  type ResolvedFieldState,
} from "@/modules/quotations/hooks/useVisibilityRules"
import type { SalesOrderFormData } from "../types"

/**
 * E5 parity — re-evaluate every `depends_on`-style rule after each form
 * change for the Sales Order doctype. Mirrors ERPNext `frm.toggle_display` /
 * `refresh_dependency`, reusing the generic Frappe `depends_on` evaluator and
 * the docstatus-aware rendering helpers shared with the Quotation form.
 *
 * Rules are transcribed VERBATIM from `erpnext/selling/doctype/sales_order/
 * sales_order.json` (+ the Sales Order Item child doctype).
 */

export interface SalesOrderFieldRule {
  fieldname: string
  /** `depends_on` (positive form). Shown when the expression is truthy. */
  showWhen?: string
  /** Inverse of `depends_on` — hidden when the expression is truthy. */
  hiddenWhen?: string
  /** Static `read_only: 1`. */
  readOnly?: boolean
  /** `read_only_depends_on`. */
  readOnlyWhen?: string
  /** `mandatory_depends_on`. */
  reqdWhen?: string
  /** Hard-required on the doctype (still gated by visibility). */
  reqd?: boolean
  /** `allow_on_submit: 1`. */
  allowOnSubmit?: boolean
  /** `set_only_once: 1`. */
  setOnlyOnce?: boolean
}

export interface SalesOrderFieldMeta {
  fieldname: string
  hidden?: boolean
  dependsOn?: string
  readOnly?: boolean
  readOnlyDependsOn?: string
  mandatoryDependsOn?: string
  reqd?: boolean
  allowOnSubmit?: boolean
  setOnlyOnce?: boolean
  /** Frappe fieldtype (used only to document the source metadata). */
  fieldtype?: string
  permLevel?: number
}

export function salesOrderRuleFromMeta(meta: SalesOrderFieldMeta): SalesOrderFieldRule {
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

function invertDependsOn(expr: string): string {
  const src = expr.trim().replace(/^eval:\s*/, "")
  return `!(${src})`
}

/**
 * ERPNext Sales Order field metadata (sales_order.json) — copied 1:1 from the
 * doctype definition (hidden / depends_on / read_only / reqd / allow_on_submit /
 * set_only_once). Section/tab placeholders driving collapse visibility are
 * included. `__islocal` in `per_delivered`/`per_billed` resolves to the doc
 * being local (new/unsaved) via the hook's isLocal param.
 */
export const SALES_ORDER_FIELD_META: SalesOrderFieldMeta[] = [
  // ── Customer / Order ─────────────────────────────────────────────
  { fieldname: "title", hidden: true, allowOnSubmit: true, fieldtype: "Data" },
  { fieldname: "naming_series", reqd: true, setOnlyOnce: true, fieldtype: "Select" },
  { fieldname: "customer", reqd: true, fieldtype: "Link" },
  { fieldname: "customer_name", readOnly: true, fieldtype: "Data" },
  { fieldname: "tax_id", readOnly: true, fieldtype: "Data" },
  { fieldname: "order_type", reqd: true, fieldtype: "Select" },
  { fieldname: "transaction_date", reqd: true, fieldtype: "Date" },
  { fieldname: "delivery_date", dependsOn: "eval:!doc.skip_delivery_note", allowOnSubmit: true, fieldtype: "Date" },
  { fieldname: "po_no", allowOnSubmit: true, fieldtype: "Data" },
  { fieldname: "po_date", dependsOn: "eval:doc.po_no", allowOnSubmit: true, fieldtype: "Date" },
  { fieldname: "company", reqd: true, fieldtype: "Link" },
  { fieldname: "skip_delivery_note", hidden: true, fieldtype: "Check" },
  { fieldname: "has_unit_price_items", hidden: true, fieldtype: "Check" },
  { fieldname: "amended_from", hidden: true, readOnly: true, fieldtype: "Link" },

  // ── Accounting Dimensions ────────────────────────────────────────
  { fieldname: "cost_center", fieldtype: "Link" },
  { fieldname: "project", fieldtype: "Link" },

  // ── Currency and Price List ──────────────────────────────────────
  { fieldname: "currency", reqd: true, fieldtype: "Link" },
  { fieldname: "conversion_rate", reqd: true, fieldtype: "Float" },
  { fieldname: "selling_price_list", reqd: true, fieldtype: "Link" },
  { fieldname: "price_list_currency", readOnly: true, reqd: true, fieldtype: "Link" },
  { fieldname: "plc_conversion_rate", reqd: true, fieldtype: "Float" },
  { fieldname: "ignore_pricing_rule", permLevel: 1, fieldtype: "Check" },

  // ── Warehouse ────────────────────────────────────────────────────
  { fieldname: "scan_barcode", fieldtype: "Data" },
  { fieldname: "last_scanned_warehouse", dependsOn: "eval: doc.last_scanned_warehouse", fieldtype: "Data" },
  { fieldname: "set_warehouse", fieldtype: "Link" },
  { fieldname: "reserve_stock", dependsOn: "eval: (doc.docstatus == 0 || doc.reserve_stock)", fieldtype: "Check" },

  // ── Items ────────────────────────────────────────────────────────
  { fieldname: "items", reqd: true, fieldtype: "Table" },

  // ── Items footer ─────────────────────────────────────────────────
  { fieldname: "total_qty", readOnly: true, fieldtype: "Float" },
  { fieldname: "total_net_weight", readOnly: true, dependsOn: "total_net_weight", fieldtype: "Float" },
  { fieldname: "base_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_net_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "net_total", readOnly: true, fieldtype: "Currency" },

  // ── Taxes ────────────────────────────────────────────────────────
  { fieldname: "tax_category", fieldtype: "Link" },
  { fieldname: "taxes_and_charges", fieldtype: "Link" },
  { fieldname: "shipping_rule", fieldtype: "Link" },
  { fieldname: "incoterm", fieldtype: "Link" },
  { fieldname: "named_place", dependsOn: "incoterm", fieldtype: "Data" },
  { fieldname: "taxes", fieldtype: "Table" },
  { fieldname: "other_charges_calculation", readOnly: true, fieldtype: "Text Editor" },

  // ── Totals ───────────────────────────────────────────────────────
  { fieldname: "base_total_taxes_and_charges", readOnly: true, fieldtype: "Currency" },
  { fieldname: "total_taxes_and_charges", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_grand_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "base_rounding_adjustment", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "base_rounded_total", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "base_in_words", readOnly: true, fieldtype: "Data" },
  { fieldname: "grand_total", readOnly: true, fieldtype: "Currency" },
  { fieldname: "rounding_adjustment", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "rounded_total", readOnly: true, dependsOn: "eval:!doc.disable_rounded_total", fieldtype: "Currency" },
  { fieldname: "in_words", readOnly: true, fieldtype: "Data" },
  { fieldname: "advance_paid", readOnly: true, fieldtype: "Currency" },
  { fieldname: "disable_rounded_total", dependsOn: "grand_total", fieldtype: "Check" },

  // ── Additional Discount ──────────────────────────────────────────
  { fieldname: "apply_discount_on", fieldtype: "Select" },
  { fieldname: "base_discount_amount", readOnly: true, fieldtype: "Currency" },
  { fieldname: "additional_discount_percentage", fieldtype: "Float" },
  { fieldname: "discount_amount", fieldtype: "Currency" },
  { fieldname: "coupon_code", fieldtype: "Link" },

  // ── Packing List / Pricing Rules ─────────────────────────────────
  { fieldname: "packed_items", dependsOn: "packed_items", fieldtype: "Table" },
  { fieldname: "packing_list", dependsOn: "packed_items", fieldtype: "Section Break" },
  { fieldname: "pricing_rules", readOnly: true, fieldtype: "Table" },

  // ── Address & Contact ────────────────────────────────────────────
  { fieldname: "contact_info", dependsOn: "customer", fieldtype: "Tab Break" },
  { fieldname: "customer_address", fieldtype: "Link" },
  { fieldname: "address_display", readOnly: true, allowOnSubmit: true, fieldtype: "Small Text" },
  { fieldname: "customer_group", hidden: true, fieldtype: "Link" },
  { fieldname: "territory", fieldtype: "Link" },
  { fieldname: "contact_person", fieldtype: "Link" },
  { fieldname: "contact_display", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "contact_mobile", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "contact_phone", readOnly: true, fieldtype: "Data" },
  { fieldname: "contact_email", hidden: true, readOnly: true, fieldtype: "Data" },
  { fieldname: "shipping_address_name", fieldtype: "Link" },
  { fieldname: "shipping_address", readOnly: true, allowOnSubmit: true, fieldtype: "Small Text" },
  { fieldname: "dispatch_address_name", allowOnSubmit: true, fieldtype: "Link" },
  { fieldname: "dispatch_address", dependsOn: "dispatch_address_name", readOnly: true, allowOnSubmit: true, fieldtype: "Small Text" },
  { fieldname: "company_address", fieldtype: "Link" },
  { fieldname: "company_address_display", readOnly: true, fieldtype: "Small Text" },
  { fieldname: "company_contact_person", fieldtype: "Link" },

  // ── Payment Terms / Terms ────────────────────────────────────────
  { fieldname: "payment_terms_template", fieldtype: "Link" },
  { fieldname: "payment_schedule", fieldtype: "Table" },
  { fieldname: "tc_name", fieldtype: "Link" },
  { fieldname: "terms", fieldtype: "Text Editor" },

  // ── More Info / Status ───────────────────────────────────────────
  { fieldname: "status", readOnly: true, reqd: true, fieldtype: "Select" },
  { fieldname: "delivery_status", hidden: true, fieldtype: "Select" },
  { fieldname: "per_delivered", readOnly: true, dependsOn: "eval:!doc.__islocal && !doc.skip_delivery_note_creation", fieldtype: "Percent" },
  { fieldname: "per_billed", readOnly: true, dependsOn: "eval:!doc.__islocal", fieldtype: "Percent" },
  { fieldname: "per_picked", readOnly: true, fieldtype: "Percent" },
  { fieldname: "billing_status", hidden: true, fieldtype: "Select" },
  { fieldname: "skip_delivery_note_creation", hidden: true, readOnly: true, fieldtype: "Check" },

  // ── Commission / Sales Team ──────────────────────────────────────
  { fieldname: "sales_partner", fieldtype: "Link" },
  { fieldname: "amount_eligible_for_commission", readOnly: true, allowOnSubmit: true, fieldtype: "Currency" },
  { fieldname: "commission_rate", fieldtype: "Float" },
  { fieldname: "total_commission", fieldtype: "Currency" },
  { fieldname: "sales_team", allowOnSubmit: true, fieldtype: "Table" },
  { fieldname: "sales_team_section_break", dependsOn: "commission_rate", fieldtype: "Section Break" },
  { fieldname: "section_break1", dependsOn: "sales_team", fieldtype: "Section Break" },

  // ── Loyalty / Subscription / Print ───────────────────────────────
  { fieldname: "loyalty_points", hidden: true, readOnly: true, fieldtype: "Int" },
  { fieldname: "loyalty_amount", hidden: true, readOnly: true, fieldtype: "Currency" },
  { fieldname: "auto_repeat", fieldtype: "Link" },
  { fieldname: "from_date", dependsOn: "eval: doc.auto_repeat", allowOnSubmit: true, fieldtype: "Date" },
  { fieldname: "to_date", dependsOn: "eval: doc.auto_repeat", allowOnSubmit: true, fieldtype: "Date" },
  { fieldname: "update_auto_repeat_reference", dependsOn: "eval: doc.auto_repeat", allowOnSubmit: true, fieldtype: "Button" },
  { fieldname: "letter_head", allowOnSubmit: true, fieldtype: "Link" },
  { fieldname: "group_same_items", allowOnSubmit: true, fieldtype: "Check" },
  { fieldname: "select_print_heading", allowOnSubmit: true, fieldtype: "Link" },
  { fieldname: "language", readOnly: true, fieldtype: "Data" },

  // ── Additional Info ──────────────────────────────────────────────
  { fieldname: "is_internal_customer", readOnly: true, fieldtype: "Check" },
  { fieldname: "represents_company", readOnly: true, fieldtype: "Link" },
  { fieldname: "ignore_default_payment_terms_template", hidden: true, readOnly: true, fieldtype: "Check" },
  { fieldname: "source", fieldtype: "Link" },
  { fieldname: "campaign", fieldtype: "Link" },
  { fieldname: "inter_company_order_reference", readOnly: true, fieldtype: "Link" },
  { fieldname: "party_account_currency", hidden: true, readOnly: true, fieldtype: "Link" },
]

/** Fields exempt from the submitted/cancelled "hide empty read-only" rule. */
export const SALES_ORDER_EMPTY_HIDE_EXEMPT = new Set([
  ...QUOTATION_EMPTY_HIDE_EXEMPT,
  "packed_items",
  "sales_team",
  "payment_schedule",
])

function buildDefaultRules(): SalesOrderFieldRule[] {
  const rules = SALES_ORDER_FIELD_META.map(salesOrderRuleFromMeta)
  const overlay: SalesOrderFieldRule[] = [
    // JS-driven (sales_order.js toggle_delivery_date): child delivery_date is
    // required when order_type == Sales and skip_delivery_note is off.
    { fieldname: "delivery_date", reqdWhen: "order_type=='Sales' && !skip_delivery_note" },
    // Selling controller interplay: a percentage discount disables the amount.
    { fieldname: "discount_amount", readOnlyWhen: "additional_discount_percentage>0" },
    // ERPNext shows the in-words fields once a rounded total exists.
    { fieldname: "in_words", hiddenWhen: "!rounded_total" },
    { fieldname: "base_in_words", hiddenWhen: "!base_rounded_total" },
  ]
  for (const o of overlay) {
    const i = rules.findIndex((r) => r.fieldname === o.fieldname)
    if (i >= 0) rules[i] = { ...rules[i], ...o }
    else rules.push(o)
  }
  return rules
}

export const SALES_ORDER_DEFAULT_RULES: SalesOrderFieldRule[] = buildDefaultRules()

export const SALES_ORDER_DEFAULT_FIELD_STATE: ResolvedFieldState = {
  visible: true,
  readOnly: false,
  reqd: false,
  allowOnSubmit: false,
}

export type SalesOrderFormDataPartial = Partial<SalesOrderFormData>

/**
 * E5 field visibility/read-only/reqd resolution for the Sales Order doctype.
 * `isLocal` mirrors `__islocal` (new/unsaved doc) and gates `set_only_once`
 * fields plus the `per_delivered`/`per_billed` `!doc.__islocal` conditions.
 */
export function useSalesOrderVisibilityRules(
  doc: SalesOrderFormDataPartial,
  rules: SalesOrderFieldRule[] = SALES_ORDER_DEFAULT_RULES,
  isLocal = true,
) {
  return useMemo(() => {
    const ctx: DependsOnContext = {
      getField: (fieldname) => {
        if (fieldname === "__islocal") return isLocal
        return (doc as Record<string, unknown>)[fieldname] as
          | string
          | number
          | boolean
          | Array<string | number>
          | null
          | undefined
      },
    }

    const resolved: Record<string, ResolvedFieldState> = {}
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
      const allowOnSubmit = !!rule.allowOnSubmit
      resolved[rule.fieldname] = { visible, readOnly, reqd, allowOnSubmit }
    }
    return resolved
  }, [doc, rules, isLocal])
}

export function salesOrderResolveField(
  state: ResolvedFieldState,
  value: unknown,
  docstatus: number,
  exemptEmptyHide = false,
): ResolvedFieldState {
  return resolveDocstatusAware(state, value, docstatus, exemptEmptyHide)
}

export { isDocFieldEmpty }
export type { ResolvedFieldState }