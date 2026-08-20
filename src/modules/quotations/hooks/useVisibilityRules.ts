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

    const resolved: Record<string, { visible: boolean; readOnly: boolean; reqd: boolean }> = {}
    for (const rule of rules) {
      const visible = rule.hiddenWhen ? !evalDependsOn(rule.hiddenWhen, ctx) : true
      const readOnly = rule.readOnlyWhen ? evalDependsOn(rule.readOnlyWhen, ctx) : false
      const reqd = rule.reqdWhen ? evalDependsOn(rule.reqdWhen, ctx) : !!rule.reqd
      resolved[rule.fieldname] = { visible, readOnly, reqd }
    }
    return resolved
  }, [doc, rules])
}

export type QuotationFormDataPartial = Partial<Quotation>

/** B4 `depends_on`-family rules (Quotation-Parity-Plan.md A5). */
export const DEFAULT_RULES: QuotationFieldRule[] = [
  { fieldname: "customer_name", hiddenWhen: "eval:true" },
  { fieldname: "customer_group", hiddenWhen: "quotation_to!='Customer' or !party_name" },
  { fieldname: "currency", reqd: true },
  { fieldname: "selling_price_list", reqd: true },
  { fieldname: "conversion_rate", reqd: true },
  { fieldname: "price_list_currency", reqd: true },
  { fieldname: "plc_conversion_rate", reqd: true },
  { fieldname: "rounding_adjustment", hiddenWhen: "disable_rounded_total" },
  { fieldname: "base_rounding_adjustment", hiddenWhen: "disable_rounded_total" },
  { fieldname: "named_place", hiddenWhen: "!incoterm" },
  { fieldname: "order_lost_reason", hiddenWhen: "status!='Lost'" },
  { fieldname: "discount_amount", readOnlyWhen: "additional_discount_percentage>0" },
  { fieldname: "party_name", readOnlyWhen: "opportunity", reqd: true },
  { fieldname: "total_qty", hiddenWhen: "!total_qty" },
  { fieldname: "total_net_weight", hiddenWhen: "!total_net_weight" },
  { fieldname: "in_words", hiddenWhen: "!in_words" },
  { fieldname: "base_in_words", hiddenWhen: "!base_in_words" },
  { fieldname: "grand_total", reqd: true },
]