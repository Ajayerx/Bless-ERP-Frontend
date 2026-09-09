import { describe, expect, it } from "vitest"
import {
  SALES_ORDER_DEFAULT_FIELD_STATE,
  SALES_ORDER_DEFAULT_RULES,
  SALES_ORDER_EMPTY_HIDE_EXEMPT,
  SALES_ORDER_FIELD_META,
  isDocFieldEmpty,
  salesOrderResolveField,
  type SalesOrderFieldMeta,
} from "../useVisibilityRules"
import { evalDependsOn } from "../../../quotations/services/dependsOn"

/**
 * ERPNext form-display parity oracle.
 *
 * Same authoritative re-implementation of Frappe's field display logic used by
 * the Quotation parity suite (frappe model/perm.js get_field_display_status →
 * form/controls/base_control.js get_status → utils/datatype.js is_null), but
 * driven from sales_order.json metadata so we can assert the Sales Order form
 * matches ERPNext for EVERY field at EVERY docstatus. Null-hide applies at any
 * docstatus whenever the display status resolves to "Read".
 */
const HIDE_IF_NULL_EXEMPT_TYPES = new Set([
  "HTML",
  "Image",
  "Button",
  "Geolocation",
  // Section/Column breaks carry no value and are visibility-driven by
  // depends_on alone — they are never null-hidden (mirrors the app's
  // EMPTY_HIDE_EXEMPT treatment of section placeholders).
  "Section Break",
])

/** Child-table / multiselect grids are rendered by the grid, not base_control. */
const GRID_TYPES = new Set(["Table", "Table MultiSelect"])

type Doc = Record<string, unknown>

function getField(doc: Doc, fieldname: string): unknown {
  return doc[fieldname]
}

function oracleStatus(
  meta: SalesOrderFieldMeta,
  doc: Doc,
  docstatus: number,
  opts: { isLocal?: boolean; writePerm?: boolean } = {},
): { visible: boolean; readOnly: boolean } {
  const { isLocal = false, writePerm = true } = opts
  let status: "Write" | "Read" | "None" = writePerm ? "Write" : "Read"

  // By Hidden (perm.js) — `hidden:1` and hidden_due_to_dependency.
  if (meta.hidden) {
    status = "None"
  } else if (meta.dependsOn && !evalDependsOn(meta.dependsOn, { getField: (f) => getField(doc, f) })) {
    status = "None"
  }
  if (status === "None") return { visible: false, readOnly: false }

  // By Submit — submitted/cancelled locks Write fields to Read.
  if (status === "Write" && docstatus > 0) status = "Read"

  // By Allow on Submit — docstatus 1 only, needs write perm.
  if (status === "Read" && meta.allowOnSubmit && docstatus === 1 && writePerm) {
    status = "Write"
  }

  // By Read Only.
  if (status === "Write" && meta.readOnly) status = "Read"

  // By Set Only Once — named once no longer local.
  if (status === "Write" && meta.setOnlyOnce && !isLocal) status = "Read"

  // Hide-if-null (base_control.get_status) — a field in final "Read" state
  // with a null value is hidden, unless the fieldtype is exempt or it's a
  // child-table grid. Applies at EVERY docstatus (Frappe keys off the display
  // status, not docstatus); `0`/`false` are not null (datatype.js is_null).
  const fieldtype = meta.fieldtype ?? ""
  const value = getField(doc, meta.fieldname)
  const isGrid = GRID_TYPES.has(fieldtype)
  if (
    status === "Read" &&
    !isGrid &&
    !HIDE_IF_NULL_EXEMPT_TYPES.has(fieldtype) &&
    isDocFieldEmpty(value)
  ) {
    status = "None"
  }

  return { visible: status !== "None", readOnly: status === "Read" }
}

/** App-side resolution mirroring SalesOrderForm's `rule()` helper. */
function appState(
  fieldname: string,
  doc: Doc,
  docstatus: number,
  opts: { isLocal?: boolean } = {},
): { visible: boolean; readOnly: boolean } {
  const base = SALES_ORDER_DEFAULT_RULES.find((r) => r.fieldname === fieldname) ?? {
    fieldname,
    ...SALES_ORDER_DEFAULT_FIELD_STATE,
  }
  const ctx = { getField: (f: string) => getField(doc, f) }
  let visible: boolean
  if (base.showWhen) visible = evalDependsOn(base.showWhen, ctx)
  else if (base.hiddenWhen) visible = !evalDependsOn(base.hiddenWhen, ctx)
  else visible = true
  const readOnly =
    !!base.readOnly ||
    (base.readOnlyWhen ? evalDependsOn(base.readOnlyWhen, ctx) : false) ||
    (!!base.setOnlyOnce && !(opts.isLocal ?? false))
  const reqd = base.reqdWhen ? evalDependsOn(base.reqdWhen, ctx) : !!base.reqd
  // Child-table columns are rendered as grids in the real form, never through
  // the Field null-hide — so grids stay visible even when empty (mirrors the
  // oracle's GRID_TYPES exemption). resolveDocstatusAware is fieldtype-agnostic,
  // so we pass exemptEmptyHide for grid fieldtypes here.
  const meta = SALES_ORDER_FIELD_META.find((m) => m.fieldname === fieldname)
  const isGrid = GRID_TYPES.has(meta?.fieldtype ?? "")
  const resolved = salesOrderResolveField(
    { visible, readOnly, reqd, allowOnSubmit: !!base.allowOnSubmit },
    getField(doc, fieldname),
    docstatus,
    SALES_ORDER_EMPTY_HIDE_EXEMPT.has(fieldname) || isGrid,
  )
  // ERPNext resolves a hidden/dependency-suppressed field to "None" — it is
  // hidden and carries no read-only state. Normalise to mirror that exactly.
  if (!resolved.visible) return { visible: false, readOnly: false }
  return { visible: resolved.visible, readOnly: resolved.readOnly }
}

/** Example Sales Orders that exercise every field at every docstatus. */
const BASE_DRAFT: Doc = {
  order_type: "Sales",
  company: "BlessERP Inc.",
  transaction_date: "2026-08-21",
  delivery_date: "2026-09-21",
  currency: "CAD",
  conversion_rate: 1,
  selling_price_list: "Standard Selling",
  price_list_currency: "CAD",
  plc_conversion_rate: 1,
  status: "Draft",
  total_qty: 2,
  total_net_weight: 0,
  tax_category: "",
  taxes_and_charges: "",
  shipping_rule: "",
  incoterm: "",
  named_place: "",
  disable_rounded_total: 0,
  grand_total: 100,
  rounded_total: 100,
  rounding_adjustment: 0,
  base_grand_total: 100,
  base_rounded_total: 100,
  base_rounding_adjustment: 0,
  discount_amount: 0,
  additional_discount_percentage: 0,
  apply_discount_on: "",
  coupon_code: "",
  // in_words is only non-empty once rounding yields a total (realistic
  // server-populated value to mirror saved/document behaviour).
  in_words: "One Hundred Only",
  base_in_words: "One Hundred CAD Only",
  advance_paid: 0,
  per_delivered: 0,
  per_billed: 0,
  per_picked: 0,
  territory: "",
  autosave: 0,
  // ERPNext hides empty read-only Link fields on submitted docs — give the
  // address/party fields realistic values so they stay visible after submit.
  customer: "CUST-0001",
  customer_address: "CUST-ADDR-0001",
  address_display: "123 Main St\nToronto, ON",
  contact_person: "CONT-0001",
  contact_display: "Jane Smith\n+1 555 0100",
  contact_mobile: "+1 555 0100",
  shipping_address_name: "CUST-ADDR-0001",
  shipping_address: "123 Main St\nToronto, ON",
  dispatch_address_name: "",
  dispatch_address: "",
  company_address: "BLESS-HQ-ADDR",
  company_address_display: "BlessERP HQ\nToronto, ON",
  company_contact_person: "TING-0001",
  payment_terms_template: "",
  tc_name: "",
  terms: "",
  sales_partner: "",
  amount_eligible_for_commission: undefined,
  commission_rate: 0,
  total_commission: 0,
  letter_head: "",
  group_same_items: 0,
  select_print_heading: "",
  language: "en",
  is_internal_customer: 0,
  source: "",
  campaign: "",
  auto_repeat: "",
  from_date: "",
  to_date: "",
  update_auto_repeat_reference: 0,
  naming_series: "SAL-ORD-.YYYY.-",
  // Child-table grids render regardless of emptiness; give at least items.
  items: [{ idx: 1, item_code: "ITEM-0001", item_name: "Widget", qty: 2, amount: 100 }],
  taxes: [],
  packing_list: [],
  packed_items: [],
  pricing_rules: [],
  payment_schedule: [],
  sales_team: [],
  loyalty_points: undefined,
  loyalty_amount: undefined,
  amended_from: "",
  skip_delivery_note: 0,
  skip_delivery_note_creation: 0,
  has_unit_price_items: 0,
  customer_group: "",
  contact_email: "",
  delivery_status: "",
  billing_status: "",
  ignore_default_payment_terms_template: 0,
  party_account_currency: "",
  represents_company: "",
  inter_company_order_reference: "",
}

const DRAFTS: Doc[] = [
  BASE_DRAFT,
  // Submitted-style order with commission + full sales team + packed items
  // (drop-ship) — exercises the Commission / Sales Team / Packing sections.
  {
    ...BASE_DRAFT,
    sales_partner: "SP-0001",
    amount_eligible_for_commission: 100,
    commission_rate: 5,
    total_commission: 5,
    sales_team: [
      { sales_person: "EMP-0001", allocated_percentage: 100, allocated_amount: 100, commission_rate: 5, incentives: 5 },
    ],
    packed_items: [{ item_code: "ITEM-0001", warehouse: "STORES" }],
    payment_terms_template: "Net 30",
    payment_schedule: [{ payment_term: "On Receipt", due_date: "2026-08-21", invoice_portion: 100, payment_amount: 100 }],
    tc_name: "Terms-1",
    terms: "Full payment on delivery.",
    coupon_code: "HOLIDAY10",
    additional_discount_percentage: 0,
    discount_amount: 10,
    territory: "Toronto",
    source: "Campaign Email",
    campaign: "Summer 2026",
    letter_head: "BlessERP Letterhead",
    select_print_heading: "Invoice",
    group_same_items: 1,
    auto_repeat: "AR-0001",
    from_date: "2026-08-21",
    to_date: "2027-08-21",
    is_internal_customer: 1,
    po_no: "PO-1001",
    po_date: "2026-08-01",
  },
]

/**
 * Every docstatus the ERPNext form can show is exercised for each saved doc:
 * 0 = Draft, 1 = Submitted (Open), 2 = Cancelled. New-doc local state also
 * exercises the naming_series / set_only_once behaviour.
 */
function buildCases(): Array<{
  meta: SalesOrderFieldMeta
  doc: Doc
  docstatus: number
  isLocal: boolean
}> {
  const cases = []
  for (const base of DRAFTS) {
    for (const docstatus of [0, 1, 2]) {
      for (const meta of SALES_ORDER_FIELD_META) {
        cases.push({ meta, doc: { ...base }, docstatus, isLocal: false })
      }
    }
  }
  // New unsaved doc (local) at draft — set_only_once must stay editable.
  for (const meta of SALES_ORDER_FIELD_META) {
    cases.push({ meta, doc: { ...DRAFTS[0] }, docstatus: 0, isLocal: true })
  }
  return cases
}

describe("ERPNext docstatus display parity (every field × every docstatus)", () => {
  const cases = buildCases()

  it(`matches ERPNext for all ${cases.length} field×docstatus combinations`, () => {
    for (const c of cases) {
      // Intentional app divergence: in_words/base_in_words are hidden on
      // drafts (docstatus 0) until rounded_total exists (live client-side
      // computation). ERPNext shows the empty read-only field on drafts and
      // only null-hides it after submit — so parity is asserted post-submit
      // only, where both engines converge.
      if (c.docstatus === 0 && (c.meta.fieldname === "in_words" || c.meta.fieldname === "base_in_words")) {
        continue
      }
      const oracle = oracleStatus(c.meta, c.doc, c.docstatus, { isLocal: c.isLocal })
      const app = appState(c.meta.fieldname, c.doc, c.docstatus, { isLocal: c.isLocal })
      expect(
        app,
        `${c.meta.fieldname} @ docstatus=${c.docstatus} isLocal=${c.isLocal} status=${c.doc.status}`,
      ).toEqual(oracle)
    }
  })

  it("sanity: customer_address is read-only after submit (v15; no allow_on_submit)", () => {
    const meta = SALES_ORDER_FIELD_META.find((m) => m.fieldname === "customer_address")!
    expect(meta.allowOnSubmit).toBeFalsy()
    // submitted + has value → shown read-only
    expect(
      appState("customer_address", { ...DRAFTS[1] }, 1),
    ).toEqual({ visible: true, readOnly: true })
    // submitted + empty → hidden (read-only + null)
    expect(
      appState("customer_address", { ...DRAFTS[0], customer_address: "" }, 1),
    ).toEqual({ visible: false, readOnly: false })
    // cancelled → forced read-only
    expect(
      appState("customer_address", { ...DRAFTS[1] }, 2),
    ).toEqual({ visible: true, readOnly: true })
  })

  it("sanity: delivery_date is editable after submit (allow_on_submit)", () => {
    const meta = SALES_ORDER_FIELD_META.find((m) => m.fieldname === "delivery_date")!
    expect(meta.allowOnSubmit).toBe(true)
    expect(
      appState("delivery_date", { ...DRAFTS[1], delivery_date: "2026-09-21" }, 1),
    ).toEqual({ visible: true, readOnly: false })
    expect(
      appState("delivery_date", { ...DRAFTS[1] }, 2),
    ).toEqual({ visible: true, readOnly: true })
  })

  it("sanity: amount_eligible_for_commission is read_only + allow_on_submit (v15)", () => {
    const rule = SALES_ORDER_DEFAULT_RULES.find((r) => r.fieldname === "amount_eligible_for_commission")!
    expect(rule.allowOnSubmit).toBe(true)
    expect(rule.readOnly).toBe(true)
    // value present → shown read-only on submitted (By Read Only wins over
    // By Allow on Submit, so the field is never writable after submit)
    expect(
      appState("amount_eligible_for_commission", { ...DRAFTS[1] }, 1),
    ).toEqual({ visible: true, readOnly: true })
    // empty → hidden on submitted
    expect(
      appState("amount_eligible_for_commission", { ...DRAFTS[0] }, 1),
    ).toEqual({ visible: false, readOnly: false })
  })

  it("sanity: zero-valued read-only fields are shown on submitted docs (M1)", () => {
    // ERPNext is_null(0) === false → rounding_adjustment 0 shows read-only.
    expect(
      appState("rounding_adjustment", { ...DRAFTS[0] }, 1),
    ).toEqual({ visible: true, readOnly: true })
    // total_net_weight=0 → hidden via depends_on (not via is_null).
    expect(
      appState("total_net_weight", { ...DRAFTS[0] }, 1),
    ).toEqual({ visible: false, readOnly: false })
    // advance_paid 0 is a Currency, not hidden by is_null → stays visible.
    expect(
      appState("advance_paid", { ...DRAFTS[0] }, 1),
    ).toEqual({ visible: true, readOnly: true })
  })

  it("sanity: empty non-exempt read-only fields are hidden on submitted docs", () => {
    // named_place empty + no incoterm → reliant base rule hides it on submit.
    expect(appState("named_place", { ...DRAFTS[0] }, 1)).toEqual({ visible: false, readOnly: false })
    // Empty string territory hidden on submitted; present value shown.
    expect(appState("territory", { ...DRAFTS[0] }, 1)).toEqual({ visible: false, readOnly: false })
    expect(
      appState("territory", { ...DRAFTS[0], territory: "Toronto" }, 1),
    ).toEqual({ visible: true, readOnly: true })
    // Non-exempt read-only fields without data disappear post-submit.
    expect(appState("source", { ...DRAFTS[0] }, 1)).toEqual({ visible: false, readOnly: false })
    expect(appState("coupon_code", { ...DRAFTS[0] }, 1)).toEqual({ visible: false, readOnly: false })
  })

  it("sanity: read-only empty fields are null-hidden on drafts too (base_control)", () => {
    // base_control.get_status null-hides a "Read" status field at ANY docstatus.
    expect(appState("tax_id", { ...DRAFTS[0], tax_id: "" }, 0)).toEqual({ visible: false, readOnly: false })
    expect(appState("customer_name", { ...DRAFTS[0], customer_name: "" }, 0)).toEqual({ visible: false, readOnly: false })
    // but zero-valued read-only fields stay visible (is_null(0) === false)
    expect(appState("total_qty", { ...DRAFTS[0], total_qty: 0 }, 0)).toEqual({ visible: true, readOnly: true })
  })

  it("sanity: hidden:1 fields are never visible at any docstatus", () => {
    for (const f of [
      "title", "skip_delivery_note", "has_unit_price_items", "amended_from",
      "customer_group", "contact_email", "delivery_status", "billing_status",
      "skip_delivery_note_creation", "loyalty_points", "loyalty_amount",
      "ignore_default_payment_terms_template", "party_account_currency",
    ]) {
      for (const docstatus of [0, 1, 2]) {
        expect(
          appState(f, { ...DRAFTS[0] }, docstatus),
          `${f} @ ${docstatus}`,
        ).toEqual({ visible: false, readOnly: false })
      }
    }
  })

  it("sanity: child tables stay visible as grids on submitted docs", () => {
    for (const f of ["items", "taxes", "payment_schedule", "sales_team", "packed_items", "pricing_rules"]) {
      const meta = SALES_ORDER_FIELD_META.find((m) => m.fieldname === f)!
      const oracle = oracleStatus(meta, { ...DRAFTS[1], [f]: [{ idx: 1 }] }, 1)
      // tables are displayed (grid) after submit; sales_team is allow_on_submit,
      // so it stays editable, the rest are locked to read-only.
      expect(oracle.visible).toBe(true)
      expect(oracle.readOnly).toBe(f !== "sales_team")
      expect(appState(f, { ...DRAFTS[1], [f]: [{ idx: 1 }] }, 1)).toEqual(oracle)
    }
  })
})

describe("SALES_ORDER_FIELD_META — integrity against DEFAULT_RULES", () => {
  it("every FIELD_META fieldname has a generated rule", () => {
    for (const meta of SALES_ORDER_FIELD_META) {
      const rule = SALES_ORDER_DEFAULT_RULES.find((r) => r.fieldname === meta.fieldname)
      expect(rule, meta.fieldname).toBeDefined()
    }
  })

  it("permanently-hidden fields are the only ones with hiddenWhen='1=1'", () => {
    const permanent = SALES_ORDER_DEFAULT_RULES.filter((r) => r.hiddenWhen === "1=1").map((r) => r.fieldname)
    expect(permanent.sort()).toEqual(
      [
        "title", "skip_delivery_note", "has_unit_price_items", "amended_from",
        "customer_group", "contact_email", "delivery_status", "billing_status",
        "skip_delivery_note_creation", "loyalty_points", "loyalty_amount",
        "ignore_default_payment_terms_template", "party_account_currency",
        "shipping_contact_email",
      ].sort(),
    )
  })

  it("allow_on_submit parity matches ERPNext sales_order.json set exactly", () => {
    const allowOnSubmit = SALES_ORDER_DEFAULT_RULES.filter((r) => r.allowOnSubmit).map((r) => r.fieldname)
    expect(allowOnSubmit.sort()).toEqual(
      [
        "title",
        "delivery_date",
        "po_no",
        "po_date",
        "address_display",
        "shipping_address",
        "dispatch_address_name",
        "dispatch_address",
        "sales_team",
        "from_date",
        "to_date",
        "update_auto_repeat_reference",
        "letter_head",
        "group_same_items",
        "select_print_heading",
        "amount_eligible_for_commission",
      ].sort(),
    )
  })

  it("naming_series is reqd and set_only_once", () => {
    const rule = SALES_ORDER_DEFAULT_RULES.find((r) => r.fieldname === "naming_series")
    expect(rule?.reqd).toBe(true)
    expect(rule?.setOnlyOnce).toBe(true)
  })
})