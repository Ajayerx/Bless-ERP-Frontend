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
  /** `depends_on` — visible when true. */
  hiddenWhen?: string
  /** Read-only when true. */
  readOnlyWhen?: string
  /** Required when true. Falls back to `reqd`. */
  reqdWhen?: string
  /** Hard-required on this doctype (still disabled until its rule passes). */
  reqd?: boolean
  /**
   * ERPNext `allow_on_submit` parity — when true the field remains
   * editable even on submitted documents (docstatus=1).
   */
  allowOnSubmit?: boolean
}

/**
 * B4 field visibility/read-only/reqd resolution.
 * `hiddenWhen`/`readOnlyWhen`/`reqdWhen` are Frappe `depends_on`-style
 * expressions evaluated against the current doc snapshot.
 */
export function useVisibilityRules(
  doc: QuotationFormDataPartial,
  rules: QuotationFieldRule[] = DEFAULT_RULES,
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
      const visible = rule.hiddenWhen ? !evalDependsOn(rule.hiddenWhen, ctx) : true
      const readOnly = rule.readOnlyWhen ? evalDependsOn(rule.readOnlyWhen, ctx) : false
      const reqd = rule.reqdWhen ? evalDependsOn(rule.reqdWhen, ctx) : !!rule.reqd
      resolved[rule.fieldname] = { visible, readOnly, reqd, allowOnSubmit: !!rule.allowOnSubmit }
    }
    return resolved
  }, [doc, rules])
}

export type { ResolvedFieldState }

export interface ResolvedFieldState {
  visible: boolean
  readOnly: boolean
  reqd: boolean
  allowOnSubmit: boolean
}

/**
 * ERPNext treats 0 / "" / [] / unchecked as "empty" (frappe `is_value_internal`).
 * On a submitted/cancelled doc every read-only field with an empty value is
 * hidden — only fields carrying data are shown.
 */
export function isDocFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "string") return value.length === 0
  if (typeof value === "number") return value === 0
  if (typeof value === "boolean") return !value
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
 *   are hidden entirely — only fields carrying data show.
 * - Cancelled (2): everything read-only (incl. allow_on_submit).
 */
export function resolveDocstatusAware(
  base: ResolvedFieldState,
  value: unknown,
  docstatus: number,
  exemptEmptyHide = false,
): ResolvedFieldState {
  const hiddenEmpty =
    docstatus !== 0 &&
    !base.allowOnSubmit &&
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
export const DEFAULT_RULES: QuotationFieldRule[] = [
  // ── Customer / Party fields ─────────────────────────────────────
  // ERPNext: customer_group is `hidden: 1` (permanent). customer_name is
  // `read_only: 1` but visible — displayed read-only, so it has no rule here.
  { fieldname: "customer_group", hiddenWhen: "1=1" },
  { fieldname: "party_name", reqd: true },

  // ── Currency / Price List (required) ────────────────────────────
  { fieldname: "currency", reqd: true },
  { fieldname: "selling_price_list", reqd: true },
  { fieldname: "conversion_rate", reqd: true },
  { fieldname: "price_list_currency", reqd: true },
  { fieldname: "plc_conversion_rate", reqd: true },

  // ── Totals: rounding depends on disable_rounded_total ───────────
  { fieldname: "rounding_adjustment", hiddenWhen: "disable_rounded_total" },
  { fieldname: "base_rounding_adjustment", hiddenWhen: "disable_rounded_total" },
  { fieldname: "grand_total", reqd: true },

  // ── Items summary fields (hidden when zero) ─────────────────────
  { fieldname: "total_qty", hiddenWhen: "!total_qty" },
  { fieldname: "total_net_weight", hiddenWhen: "!total_net_weight" },
  // in_words renders once rounding yields a total (live-computed via
  // moneyInWords on drafts; stored server value on submitted docs).
  { fieldname: "in_words", hiddenWhen: "!rounded_total" },
  { fieldname: "base_in_words", hiddenWhen: "!base_rounded_total" },

  // ── Discount ────────────────────────────────────────────────────
  { fieldname: "discount_amount", readOnlyWhen: "additional_discount_percentage>0" },

  // ── Incoterm / Named Place ──────────────────────────────────────
  { fieldname: "named_place", hiddenWhen: "!incoterm" },

  // ── Lost status fields ──────────────────────────────────────────
  { fieldname: "order_lost_reason", hiddenWhen: "status!='Lost'" },

  // ── Section-level visibility (ERPNext `depends_on` on sections) ─
  { fieldname: "lost_reasons_section", hiddenWhen: "!lost_reasons and !order_lost_reason" },
  { fieldname: "bundle_items_section", hiddenWhen: "!packed_items" },

  // ── allow_on_submit fields (editable after submission) ──────────
  // ERPNext `quotation.json` marks these with `"allow_on_submit": 1`.
  // NOTE: lost_reasons/competitors carry read_only:1 which dominates
  // allow_on_submit — the grid stays read-only on every docstatus.
  { fieldname: "title", allowOnSubmit: true },
  { fieldname: "letter_head", allowOnSubmit: true },
  { fieldname: "group_same_items", allowOnSubmit: true },
  { fieldname: "select_print_heading", allowOnSubmit: true },
  { fieldname: "order_lost_reason", hiddenWhen: "status!='Lost'", allowOnSubmit: true },
  { fieldname: "lost_reasons" },
  // competitors: allow_on_submit only (no read_only) → stays editable on submit.
  { fieldname: "competitors", allowOnSubmit: true },
]