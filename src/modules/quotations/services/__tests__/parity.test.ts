import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  __resetQuotationFreshness,
  buildApplyPriceListArgs,
  buildDeskApplyPriceListDoc,
  quotationService,
} from "../index"
import type { Quotation, QuotationItem } from "../../types"

// Captures outgoing requests so we can assert the exact frappe.call-style
// wire format ERPNext desk uses (urlencoded ordered pairs).
let captured: Array<{ url: string; init: RequestInit }>

beforeEach(() => {
  captured = []
  __resetQuotationFreshness()
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(_input), init: init ?? {} })
    return new Response(JSON.stringify({ message: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  })
  vi.stubGlobal("fetch", fetchMock)
})

function lastCall(): { url: string; init: RequestInit } {
  expect(captured.length).toBeGreaterThan(0)
  return captured[captured.length - 1]
}

function decodeBody(init: RequestInit): URLSearchParams {
  return new URLSearchParams(String(init.body ?? ""))
}

describe("buildApplyPriceListArgs (desk _get_args/_get_item_list parity)", () => {
  const doc = {
    doctype: "Quotation" as const,
    name: "new-quotation-abc123",
    party_name: "CUST-0001",
    quotation_to: "Customer" as const,
    customer_group: "Commercial",
    territory: "Toronto",
    currency: "CAD",
    conversion_rate: 1,
    selling_price_list: "Standard Selling",
    price_list_currency: "CAD",
    plc_conversion_rate: 1,
    company: "BlessERP Inc.",
    transaction_date: "2026-08-21",
    ignore_pricing_rule: 0,
    items: [
      {
        name: "row1",
        item_code: "ITEM-A",
        item_name: "Item A",
        qty: 2,
        uom: "Nos",
        conversion_factor: 1,
        price_list_rate: 10,
        rate: 10,
        amount: 20,
        discount_percentage: 0,
        is_free_item: 0,
      },
      {
        // no item_code — desk skips rows without one
        item_code: "",
        item_name: "",
        qty: 1,
        uom: "",
        conversion_factor: 1,
        price_list_rate: 0,
        rate: 0,
        amount: 0,
        discount_percentage: 0,
        is_free_item: 0,
      },
    ] as QuotationItem[],
  }

  it("builds the exact _get_args key set", () => {
    const args = buildApplyPriceListArgs(doc as unknown as Partial<Quotation>)
    expect(Object.keys(args)).toEqual([
      "items",
      "customer",
      "quotation_to",
      "customer_group",
      "territory",
      "supplier",
      "supplier_group",
      "currency",
      "conversion_rate",
      "price_list",
      "price_list_currency",
      "plc_conversion_rate",
      "company",
      "transaction_date",
      "campaign",
      "sales_partner",
      "ignore_pricing_rule",
      "doctype",
      "name",
      "is_return",
      "update_stock",
      "conversion_factor",
      "pos_profile",
      "coupon_code",
      "is_internal_supplier",
      "is_internal_customer",
    ])
    expect(args.customer).toBe("CUST-0001")
    expect(args.price_list).toBe("Standard Selling")
    expect(args.doctype).toBe("Quotation")
    expect(args.is_return).toBe(0)
    expect(args.update_stock).toBe(0)
    expect(args.pos_profile).toBe("")
  })

  it("skips rows without item_code and emits desk row fields", () => {
    const args = buildApplyPriceListArgs(doc as unknown as Partial<Quotation>)
    const items = args.items as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(Object.keys(items[0])).toEqual([
      "doctype",
      "name",
      "child_docname",
      "item_code",
      "item_group",
      "brand",
      "qty",
      "stock_qty",
      "uom",
      "stock_uom",
      "parenttype",
      "parent",
      "pricing_rules",
      "is_free_item",
      "warehouse",
      "serial_no",
      "batch_no",
      "price_list_rate",
      "conversion_factor",
      "discount_percentage",
      "discount_amount",
      "margin_type",
      "margin_rate_or_amount",
    ])
    expect(items[0].child_docname).toBe("row1")
    expect(items[0].parenttype).toBe("Quotation")
    expect(items[0].parent).toBe("new-quotation-abc123")
    expect(items[0].conversion_factor).toBe(1)
  })

  it("targets a single row when an item is passed (desk uom/conversion_factor triggers)", () => {
    const args = buildApplyPriceListArgs(
      doc as unknown as Partial<Quotation>,
      doc.items[0],
    )
    expect((args.items as unknown[]).length).toBe(1)
  })

  it("drops undefined keys via JSON.stringify exactly like desk", () => {
    const args = buildApplyPriceListArgs({
      company: "BlessERP Inc.",
      selling_price_list: "Standard Selling",
    } as Partial<Quotation>)
    const serialized = JSON.parse(JSON.stringify(args))
    expect(serialized.customer).toBeUndefined()
    expect(serialized.quotation_to).toBeUndefined()
    expect(serialized.is_return).toBe(0)
    expect(serialized.pos_profile).toBe("")
  })
})

describe("on-launch endpoint wire format", () => {
  it("apply_price_list posts urlencoded args=<json>&doc=<json>", async () => {
    await quotationService.applyPriceList({ doctype: "Quotation", price_list: "Standard Selling" }, {
      doctype: "Quotation",
      company: "BlessERP Inc.",
    })
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/erpnext.stock.get_item_details.apply_price_list")
    expect(String(init.headers && (init.headers as Record<string, string>)["Content-Type"])).toContain(
      "application/x-www-form-urlencoded",
    )
    const body = decodeBody(init)
    expect(body.get("args")).toBe(
      JSON.stringify({ doctype: "Quotation", price_list: "Standard Selling" }),
    )
    expect(JSON.parse(body.get("doc") ?? "{}")).toMatchObject({ doctype: "Quotation" })
  })

  it("get_dimensions posts with NO arguments (desk sends none)", async () => {
    await quotationService.getAccountingDimensions()
    const { url, init } = lastCall()
    expect(url).toBe(
      "/api/method/erpnext.accounts.doctype.accounting_dimension.accounting_dimension.get_dimensions",
    )
    expect(String(init.body ?? "")).toBe("")
  })

  it("get_default_company_address posts name/existing_address urlencoded", async () => {
    await quotationService.getDefaultCompanyAddress("BlessERP Inc.", "")
    const { url, init } = lastCall()
    expect(url).toBe(
      "/api/method/erpnext.setup.doctype.company.company.get_default_company_address",
    )
    const body = decodeBody(init)
    expect(body.get("name")).toBe("BlessERP Inc.")
    expect(body.get("existing_address")).toBe("")
  })

  it("validate_link posts doctype/docname/fields urlencoded", async () => {
    await quotationService.validateLink("Company", "BlessERP Inc.", [])
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/frappe.client.validate_link")
    const body = decodeBody(init)
    expect(body.get("doctype")).toBe("Company")
    expect(body.get("docname")).toBe("BlessERP Inc.")
    expect(body.get("fields")).toBe("[]")
  })

  it("get_default_taxes_and_charges posts master_doctype/tax_template/company", async () => {
    await quotationService.getDefaultTaxesAndCharges("BlessERP Inc.", "")
    const { url, init } = lastCall()
    expect(url).toBe(
      "/api/method/erpnext.controllers.accounts_controller.get_default_taxes_and_charges",
    )
    const body = decodeBody(init)
    expect(body.get("master_doctype")).toBe("Sales Taxes and Charges Template")
    expect(body.get("tax_template")).toBe("")
    expect(body.get("company")).toBe("BlessERP Inc.")
  })

  it("get_conversion_factor posts item_code/uom", async () => {
    await quotationService.getConversionFactor("ITEM-A", "Box")
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/erpnext.stock.get_item_details.get_conversion_factor")
    const body = decodeBody(init)
    expect(body.get("item_code")).toBe("ITEM-A")
    expect(body.get("uom")).toBe("Box")
  })

  it("search_link for quotation_to posts the desk ControlLink envelope", async () => {
    await quotationService.searchQuotationTo("")
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/frappe.desk.search.search_link")
    expect(String(init.headers && (init.headers as Record<string, string>)["X-Frappe-Doctype"])).toBe(
      "DocType",
    )
    const body = decodeBody(init)
    // Desk serializes link.js args in this exact order.
    expect(Array.from(body.keys())).toEqual([
      "txt",
      "doctype",
      "ignore_user_permissions",
      "reference_doctype",
      "page_length",
      "filters",
    ])
    expect(body.get("txt")).toBe("")
    expect(body.get("doctype")).toBe("DocType")
    expect(body.get("ignore_user_permissions")).toBe("0")
    expect(body.get("reference_doctype")).toBe("Quotation")
    expect(body.get("page_length")).toBe("10")
    expect(JSON.parse(body.get("filters") ?? "{}")).toEqual({
      name: ["in", ["Customer", "Lead", "Prospect"]],
    })
  })

  it("search_link for items grid posts the desk item_query envelope", async () => {
    await quotationService.searchItemsDesk("PB")
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/frappe.desk.search.search_link")
    expect(String(init.headers && (init.headers as Record<string, string>)["X-Frappe-Doctype"])).toBe(
      "Item",
    )
    const body = decodeBody(init)
    expect(Array.from(body.keys())).toEqual([
      "txt",
      "doctype",
      "ignore_user_permissions",
      "reference_doctype",
      "page_length",
      "query",
      "filters",
    ])
    expect(body.get("txt")).toBe("PB")
    expect(body.get("doctype")).toBe("Item")
    expect(body.get("ignore_user_permissions")).toBe("0")
    expect(body.get("reference_doctype")).toBe("Quotation Item")
    expect(body.get("page_length")).toBe("10")
    expect(body.get("query")).toBe("erpnext.controllers.queries.item_query")
    expect(JSON.parse(body.get("filters") ?? "{}")).toEqual({ is_sales_item: 1, has_variants: 0 })
  })

  it("get_item_details posts doc=<json>&args=<json> (desk frm.call shape)", async () => {
    await quotationService.getItemDetailsDesk(
      { doctype: "Quotation", name: "new-quotation-x" },
      { item_code: "PB102", uom: null, serial_no: undefined },
    )
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/erpnext.stock.get_item_details.get_item_details")
    const body = decodeBody(init)
    expect(Array.from(body.keys())).toEqual(["doc", "args"])
    expect(JSON.parse(body.get("doc") ?? "{}")).toMatchObject({
      doctype: "Quotation",
      name: "new-quotation-x",
    })
    expect(JSON.parse(body.get("args") ?? "{}")).toEqual({ item_code: "PB102", uom: null })
  })

  it("get_item_tax_template posts args=<json>", async () => {
    await quotationService.getItemTaxTemplate({
      item_code: "PB102",
      company: "Bless Erp",
      base_net_rate: 150,
      tax_category: "",
      transaction_date: "2026-08-21",
    })
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/erpnext.stock.get_item_details.get_item_tax_template")
    const body = decodeBody(init)
    expect(Array.from(body.keys())).toEqual(["args"])
    expect(JSON.parse(body.get("args") ?? "{}")).toEqual({
      item_code: "PB102",
      company: "Bless Erp",
      base_net_rate: 150,
      tax_category: "",
      transaction_date: "2026-08-21",
    })
  })
})

describe("launch-endpoint dedup (frappe.request.is_fresh parity)", () => {
  it("suppresses an identical apply_price_list inside the window", async () => {
    const args = { doctype: "Quotation", price_list: "Standard Selling" }
    const doc = { doctype: "Quotation", company: "BlessERP Inc." }
    await quotationService.applyPriceList(args, doc)
    await quotationService.applyPriceList(args, doc)
    const hits = captured.filter((c) => c.url.includes("apply_price_list"))
    expect(hits).toHaveLength(1)
  })

  it("lets changed args through (legit event re-fire)", async () => {
    const doc = { doctype: "Quotation", company: "BlessERP Inc." }
    await quotationService.applyPriceList({ price_list: "A" }, doc)
    await quotationService.applyPriceList({ price_list: "B" }, doc)
    const hits = captured.filter((c) => c.url.includes("apply_price_list"))
    expect(hits).toHaveLength(2)
  })

  it("fires again after the freshness log resets", async () => {
    await quotationService.getDefaultCompanyAddress("BlessERP Inc.", "")
    __resetQuotationFreshness()
    await quotationService.getDefaultCompanyAddress("BlessERP Inc.", "")
    const hits = captured.filter((c) => c.url.includes("get_default_company_address"))
    expect(hits).toHaveLength(2)
  })

  it("caches get_dimensions for the session (one request per session)", async () => {
    await quotationService.getAccountingDimensions()
    await quotationService.getAccountingDimensions()
    const hits = captured.filter((c) => c.url.includes("get_dimensions"))
    expect(hits).toHaveLength(1)
  })

  it("retries get_dimensions after a failed attempt", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })))
    await quotationService.getAccountingDimensions()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ message: [[], {}] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      ),
    )
    const result = await quotationService.getAccountingDimensions()
    expect(result.dimensionFilters).toEqual([])
    expect(result.defaultDimensionsMap).toEqual({})
  })

})

describe("get_party_details wire format (desk utils/party.js)", () => {
  it("posts desk arg order with posting_date and the x-frappe-doctype header", async () => {
    await quotationService.getPartyDetails(
      "Customer",
      "A B Dvilliers",
      "Bless Erp",
      "2026-08-21",
      { priceList: "Standard Selling", currency: "CAD" },
    )
    const { url, init } = lastCall()
    expect(url).toBe("/api/method/erpnext.accounts.party.get_party_details")
    expect(String(init.headers && (init.headers as Record<string, string>)["X-Frappe-Doctype"])).toBe(
      "Quotation",
    )
    const body = decodeBody(init)
    // Exact urlencoded key order desk sends (party.js builds args in this order).
    expect(Array.from(body.keys())).toEqual([
      "party",
      "party_type",
      "price_list",
      "posting_date",
      "fetch_payment_terms_template",
      "currency",
      "company",
      "doctype",
    ])
    expect(body.get("party")).toBe("A B Dvilliers")
    expect(body.get("party_type")).toBe("Customer")
    expect(body.get("price_list")).toBe("Standard Selling")
    expect(body.get("posting_date")).toBe("2026-08-21")
    expect(body.get("fetch_payment_terms_template")).toBe("1")
    expect(body.get("currency")).toBe("CAD")
    expect(body.get("company")).toBe("Bless Erp")
    expect(body.get("doctype")).toBe("Quotation")
  })

  it("omits price_list/currency when not provided (desk undefined keys)", async () => {
    await quotationService.getPartyDetails("Customer", "CUST-0001", "BlessERP Inc.", "2026-08-21")
    const body = decodeBody(lastCall().init)
    expect(Array.from(body.keys())).toEqual([
      "party",
      "party_type",
      "posting_date",
      "fetch_payment_terms_template",
      "company",
      "doctype",
    ])
  })
})

describe("buildDeskApplyPriceListDoc (full desk doc envelope)", () => {
  const form = {
    doctype: "Quotation" as const,
    name: "new-quotation-tzdksaobyu",
    naming_series: "SAL-QTN-.YYYY.-",
    quotation_to: "Customer" as const,
    party_name: "A B Dvilliers",
    customer_name: "A B Dvilliers",
    transaction_date: "2026-08-21",
    valid_till: "2026-09-20",
    order_type: "Sales",
    company: "Bless Erp",
    currency: "CAD",
    conversion_rate: 1,
    selling_price_list: "Standard Selling",
    price_list_currency: "CAD",
    status: "Draft" as const,
    docstatus: 0 as const,
    taxes_and_charges: "Canada GST/QST - BE",
    items: [
      {
        name: "new-quotation-item-lhogzqqrlb",
        item_code: "",
        item_name: "",
        qty: 0,
        uom: "",
        conversion_factor: 0,
        price_list_rate: 0,
        rate: 0,
        amount: 0,
        discount_percentage: 0,
        is_free_item: 0,
      },
    ] as QuotationItem[],
    taxes: [
      {
        name: "new-sales-taxes-and-charges-hvvsenahwb",
        charge_type: "On Net Total",
        account_head: "GST Payable - BE",
        description: "GST 5%",
        rate: 5,
        tax_amount: 0,
        total: 0,
        cost_center: "Main - BE",
      },
    ],
  }

  it("emits the desk parent key order with __islocal/__unsaved for a new doc", () => {
    const doc = buildDeskApplyPriceListDoc(form as unknown as Partial<Quotation>, {
      isNew: true,
      owner: "Administrator",
    })
    expect(Object.keys(doc)).toEqual([
      "docstatus",
      "doctype",
      "name",
      "__islocal",
      "__unsaved",
      "owner",
      "naming_series",
      "quotation_to",
      "transaction_date",
      "order_type",
      "has_unit_price_items",
      "currency",
      "selling_price_list",
      "price_list_currency",
      "ignore_pricing_rule",
      "items",
      "taxes",
      "disable_rounded_total",
      "apply_discount_on",
      "packed_items",
      "pricing_rules",
      "payment_schedule",
      "group_same_items",
      "lost_reasons",
      "competitors",
      "status",
      "customer_name",
      "conversion_rate",
      "plc_conversion_rate",
      "company",
      "valid_till",
      "company_address",
      "company_address_display",
      "taxes_and_charges",
      "base_net_total",
      "net_total",
      "base_total",
      "total",
      "total_qty",
      "grand_total",
      "total_taxes_and_charges",
      "base_grand_total",
      "rounded_total",
      "rounding_adjustment",
      "base_rounding_adjustment",
      "base_rounded_total",
      "in_words",
      "base_in_words",
      "base_discount_amount",
      "party_name",
      "customer_address",
      "address_display",
      "shipping_address_name",
      "shipping_address",
      "tax_category",
      "contact_person",
      "contact_display",
      "contact_email",
      "contact_mobile",
      "customer_group",
      "territory",
      "language",
      "payment_terms_template",
    ])
    expect(doc.__islocal).toBe(1)
    expect(doc.__unsaved).toBe(1)
    expect(doc.owner).toBe("Administrator")
    expect(doc.has_unit_price_items).toBe(0)
    expect(doc.apply_discount_on).toBe("Grand Total")
    expect(doc.packed_items).toEqual([])
    expect(doc.company_address).toBeNull()
    expect(doc.company_address_display).toBeNull()
    expect(doc.payment_terms_template).toBeNull()
    expect(doc.plc_conversion_rate).toBe("")
  })

  it("maps child rows with desk meta defaults plus set overlay", () => {
    const doc = buildDeskApplyPriceListDoc(form as unknown as Partial<Quotation>, {
      isNew: true,
      owner: "Administrator",
    })
    const item = (doc.items as Array<Record<string, unknown>>)[0]
    expect(Object.keys(item)).toEqual([
      "docstatus",
      "doctype",
      "name",
      "__islocal",
      "__unsaved",
      "owner",
      "stock_uom",
      "ordered_qty",
      "margin_type",
      "is_free_item",
      "is_alternative",
      "has_alternative_item",
      "against_blanket_order",
      "page_break",
      "parent",
      "parentfield",
      "parenttype",
      "idx",
      "qty",
      "conversion_factor",
      "stock_qty",
      "actual_qty",
      "company_total_stock",
      "price_list_rate",
      "base_price_list_rate",
      "margin_rate_or_amount",
      "rate_with_margin",
      "discount_amount",
      "distributed_discount_amount",
      "base_rate_with_margin",
      "rate",
      "net_rate",
      "amount",
      "net_amount",
      "base_rate",
      "base_net_rate",
      "base_amount",
      "base_net_amount",
      "stock_uom_rate",
      "valuation_rate",
      "gross_profit",
      "weight_per_unit",
      "total_weight",
      "blanket_order_rate",
      "projected_qty",
      "discount_percentage",
    ])
    // Empty-string values stay absent, matching desk's empty-row trace
    // (no item_code/item_name/uom keys until set_value materializes them).
    expect(item.item_code).toBeUndefined()
    expect(item.item_name).toBeUndefined()
    expect(item.uom).toBeUndefined()
    expect(item.doctype).toBe("Quotation Item")
    expect(item.parent).toBe("new-quotation-tzdksaobyu")
    expect(item.parentfield).toBe("items")
    expect(item.parenttype).toBe("Quotation")
    expect(item.idx).toBe(1)
    expect(item.ordered_qty).toBe(0)
    expect(item.actual_qty).toBe(0)
    expect(item.valuation_rate).toBe(0)

    const tax = (doc.taxes as Array<Record<string, unknown>>)[0]
    expect(Object.keys(tax)).toEqual([
      "docstatus",
      "doctype",
      "name",
      "__islocal",
      "__unsaved",
      "owner",
      "charge_type",
      "included_in_print_rate",
      "included_in_paid_amount",
      "cost_center",
      "account_currency",
      "dont_recompute_tax",
      "parent",
      "parentfield",
      "parenttype",
      "idx",
      "row_id",
      "account_head",
      "description",
      "project",
      "rate",
      "tax_amount",
      "total",
      "tax_amount_after_discount_amount",
      "base_tax_amount",
      "base_total",
      "base_tax_amount_after_discount_amount",
      "net_amount",
      "base_net_amount",
    ])
    expect(tax.doctype).toBe("Sales Taxes and Charges")
    expect(tax.parentfield).toBe("taxes")
    expect(tax.row_id).toBeNull()
    expect(tax.project).toBeNull()
    expect(tax.rate).toBe(5)
  })

  it("drops __islocal/__unsaved for saved docs (edit mode)", () => {
    const doc = buildDeskApplyPriceListDoc(
      { ...form, name: "SAL-QTN-2026-0001" } as unknown as Partial<Quotation>,
      {},
    )
    expect(doc.__islocal).toBeUndefined()
    expect(doc.__unsaved).toBeUndefined()
    expect(doc.owner).toBeUndefined()
    expect(doc.name).toBe("SAL-QTN-2026-0001")
    const item = (doc.items as Array<Record<string, unknown>>)[0]
    expect(item.__islocal).toBeUndefined()
    expect(item.owner).toBeUndefined()
  })
})
