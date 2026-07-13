# BlessERP vs ERPNext Audit — Tab 1: Details

## Tab Structure Verification (Critical Finding First)

The **actual** ERPNext v15.115 tab list from the `field_order` array is:

| # | Tab Break Fieldname | Label |
|---|---|---|
| 1 | *(default — no tab break)* | **Details** |
| 2 | `payments_tab` | **Payments** |
| 3 | `contact_and_address_tab` | **Address & Contact** |
| 4 | `terms_tab` | **Terms** |
| 5 | `more_info_tab` | **More Info** |
| 6 | `connections_tab` | **Connections** (dashboard only, no data entry) |

This gives **6 tabs** (5 data-entry + 1 dashboard), matching your assumed order: Details → Payments → Address & Contact → Terms → More Info. The 6th "Connections" tab is dashboard-only and can be ignored for our purposes.

---

## 1. ERPNext Field Inventory (verified via `field_order` + `fields` array in `sales_invoice.json`)

The Details tab contains **all fields before `payments_tab`** in the field_order (indices 1–111). This is a massive tab containing header, items, taxes, totals, and discount sections. Grouped by section:

### Section: Customer Header (`customer_section`, icon `fa-user`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Title | `title` | Data | No | `{customer_name}` | | | `hidden`, `allow_on_submit`, `no_copy`, `print_hide` |
| Series | `naming_series` | Select | No | | | | `bold`, `no_copy` |
| Customer | `customer` | Link | **Yes** | | | → Customer | `bold`, `in_standard_filter`, `search_index` |
| Customer Name | `customer_name` | Small Text | No | | `fetch_from: customer.customer_name` | | `read_only`, `in_global_search` |
| Tax Id | `tax_id` | Data | No | | `fetch_from: customer.tax_id` | | `read_only`, `print_hide` |
| Company | `company` | Link | **Yes** | | | → Company | `in_standard_filter`, `remember_last_selected_value` |
| Company Tax ID | `company_tax_id` | Data | No | | `fetch_from: company.tax_id` | | `read_only` |

### Section: Posting & Status (columns within `customer_section`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Posting Date | `posting_date` | Date | **Yes** | `Today` | | | `bold`, `no_copy`, `search_index` |
| Posting Time | `posting_time` | Time | No | `Now` | | | `no_copy`, `print_hide` |
| Edit Posting Date and Time | `set_posting_time` | Check | No | `0` | `eval:doc.docstatus==0` | | `print_hide` |
| Payment Due Date | `due_date` | Date | No | | | | `no_copy` |
| Include Payment (POS) | `is_pos` | Check | No | `0` | | | `print_hide` |
| POS Profile | `pos_profile` | Link | No | | `is_pos` | → POS Profile | `print_hide` |
| Is Consolidated | `is_consolidated` | Check | No | `0` | `eval:(doc.is_pos && doc.is_consolidated)` | | `read_only` |
| Is Return (Credit Note) | `is_return` | Check | No | `0` | `eval:!doc.is_debit_note` | | `no_copy`, `print_hide` |
| Return Against | `return_against` | Link | No | | `eval:doc.return_against \|\| doc.is_debit_note` | → Sales Invoice | `no_copy`, `search_index`; `read_only_depends_on: eval:doc.is_return` |
| Update Outstanding for Self | `update_outstanding_for_self` | Check | No | `1` | `eval: doc.is_return && doc.return_against` | | `no_copy`, `print_hide` |
| Update Billed Amount in Sales Order | `update_billed_amount_in_sales_order` | Check | No | `0` | `eval: doc.is_return` | | |
| Update Billed Amount in Delivery Note | `update_billed_amount_in_delivery_note` | Check | No | `1` | `eval: doc.is_return && doc.return_against` | | |
| Is Rate Adjustment Entry (Debit Note) | `is_debit_note` | Check | No | `0` | `eval: !doc.is_return` | | |
| Amended From | `amended_from` | Link | No | | | → Sales Invoice | `read_only`, `no_copy` |

### Section: Accounting Dimensions (`accounting_dimensions_section`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Cost Center | `cost_center` | Link | No | | | → Cost Center | `allow_on_submit` |
| Project | `project` | Link | No | | | → Project | `in_global_search`, `allow_on_submit`, `search_index` |

### Section: Currency and Price List (`currency_and_price_list`, collapsible)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Currency | `currency` | Link | **Yes** | | | → Currency | |
| Exchange Rate | `conversion_rate` | Float | **Yes** | | | | `precision: 9` |
| Price List | `selling_price_list` | Link | **Yes** | | | → Price List | |
| Price List Currency | `price_list_currency` | Link | **Yes** | | | → Currency | `read_only` |
| Price List Exchange Rate | `plc_conversion_rate` | Float | **Yes** | | | | `precision: 9` |
| Ignore Pricing Rule | `ignore_pricing_rule` | Check | No | | | | `print_hide` |

### Section: Items (`items_section`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Scan Barcode | `scan_barcode` | Data | No | | | `options: Barcode` | |
| Update Stock | `update_stock` | Check | No | `0` | `eval:doc.items.every((item) => !item.dn_detail)` | | |
| Last Scanned Warehouse | `last_scanned_warehouse` | Data | No | | `eval: doc.last_scanned_warehouse` | | `is_virtual` |
| Source Warehouse | `set_warehouse` | Link | No | | `update_stock` | → Warehouse | |
| Set Target Warehouse | `set_target_warehouse` | Link | No | | `eval:doc.is_internal_customer && doc.update_stock` | → Warehouse | `hidden` |
| Items | `items` | Table | **Yes** | | | → Sales Invoice Item | |

### Section: Totals Display (`section_break_30`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Total Quantity | `total_qty` | Float | No | | | | `read_only` |
| Total Net Weight | `total_net_weight` | Float | No | | `depends_on: total_net_weight` | | `read_only` |
| Total (Company Currency) | `base_total` | Currency | No | | | `options: Company:company:default_currency` | `read_only` |
| Net Total (Company Currency) | `base_net_total` | Currency | **Yes** | | | `options: Company:company:default_currency` | `read_only` |
| Total | `total` | Currency | No | | | `options: currency` | `read_only` |
| Net Total | `net_total` | Currency | No | | | `options: currency` | `read_only` |

### Section: Taxes and Charges (`taxes_section`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Tax Category | `tax_category` | Link | No | | | → Tax Category | `print_hide` |
| Sales Taxes and Charges Template | `taxes_and_charges` | Link | No | | | → Sales Taxes and Charges Template | `print_hide` |
| Shipping Rule | `shipping_rule` | Link | No | | | → Shipping Rule | `print_hide` |
| Incoterm | `incoterm` | Link | No | | | → Incoterm | |
| Named Place | `named_place` | Data | No | | `depends_on: incoterm` | | |
| Sales Taxes and Charges | `taxes` | Table | No | | | → Sales Taxes and Charges | |

### Section: Total Taxes Display (`section_break_43`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Total Taxes (Company Currency) | `base_total_taxes_and_charges` | Currency | No | | | | `read_only` |
| Total Taxes and Charges | `total_taxes_and_charges` | Currency | No | | | `options: currency` | `read_only` |

### Section: Totals (`totals`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Grand Total (Company Currency) | `base_grand_total` | Currency | **Yes** | | | | `read_only` |
| Rounding Adjustment (Company Currency) | `base_rounding_adjustment` | Currency | No | | `eval:!doc.disable_rounded_total` | | `read_only` |
| Rounded Total (Company Currency) | `base_rounded_total` | Currency | No | | `eval:!doc.disable_rounded_total` | | `read_only` |
| In Words (Company Currency) | `base_in_words` | Small Text | No | | | | `read_only` |
| Grand Total | `grand_total` | Currency | **Yes** | | | `options: currency` | `read_only` |
| Rounding Adjustment | `rounding_adjustment` | Currency | No | | `eval:!doc.disable_rounded_total` | `options: currency` | `read_only` |
| Use Company default Cost Center for Round off | `use_company_roundoff_cost_center` | Check | No | `0` | | | |
| Rounded Total | `rounded_total` | Currency | No | | `eval:!doc.disable_rounded_total` | | `read_only` |
| In Words | `in_words` | Small Text | No | | | | `read_only` |
| Total Advance | `total_advance` | Currency | No | | | `options: party_account_currency` | `read_only` |
| Outstanding Amount | `outstanding_amount` | Currency | No | | | `options: party_account_currency` | `read_only` |
| Disable Rounded Total | `disable_rounded_total` | Check | No | `0` | `depends_on: grand_total` | | |

### Section: Additional Discount (`section_break_49`)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Apply Additional Discount On | `apply_discount_on` | Select | No | `Grand Total` | | `options: \nGrand Total\nNet Total` | |
| Additional Discount Amount (Company Currency) | `base_discount_amount` | Currency | No | | | | `read_only` |
| Is Cash or Non Trade Discount | `is_cash_or_non_trade_discount` | Check | No | `0` | `eval: doc.apply_discount_on == "Grand Total"` | | |
| Discount Account | `additional_discount_account` | Link | No | | | → Account | `allow_on_submit` |
| Additional Discount Percentage | `additional_discount_percentage` | Float | No | | | | |
| Additional Discount Amount | `discount_amount` | Currency | No | | | `options: currency` | |

### Section: Tax Breakup (`sec_tax_breakup`, collapsible)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Taxes and Charges Calculation | `other_charges_calculation` | Text Editor | No | | | | `read_only` |

### Section: Pricing Rules (`pricing_rule_details`, collapsible)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Pricing Rule Detail | `pricing_rules` | Table | No | | | → Pricing Rule Detail | `read_only` |

### Section: Packing List (`packing_list`, collapsible)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Packed Items | `packed_items` | Table | No | | `depends_on: packed_items` | → Packed Item | |

### Section: Time Sheet List (`time_sheet_list`, collapsible)

| Field Label | Fieldname | Type | Mandatory | Default | Depends On | Link/Options | Notes |
|---|---|---|---|---|---|---|---|
| Time Sheets | `timesheets` | Table | No | | | → Sales Invoice Timesheet | |
| Total Billing Hours | `total_billing_hours` | Float | No | | `eval:doc.total_billing_amount > 0 \|\| doc.total_billing_hours > 0` | | `read_only` |
| Total Billing Amount | `total_billing_amount` | Currency | No | | | | `read_only` |

---

## 2. Data Flow / Links

**Customer selection cascade** (`customer()` in `sales_invoice.js` → `erpnext.utils.get_party_details()`):
- Auto-fills: `customer_name`, `tax_id`, `customer_address`, `shipping_address_name`, `contact_person`, `contact_display`, `contact_email`, `contact_mobile`, `territory`, `payment_terms_template`, `selling_price_list`, `price_list_currency`, `plc_conversion_rate`, `currency`, `conversion_rate`
- Triggers: `apply_pricing_rule()` → recalculates all item prices from the price list
- Triggers: loyalty program lookup

**Company cascade** (`company()` in selling_controller.py):
- Updates: `currency`, `selling_price_list`, `price_list_currency`, `conversion_rate`, `plc_conversion_rate`
- Recalculates accounting dimensions

**Currency change** (`currency()` in selling_controller.py):
- Updates exchange rates, recalculates all currency fields
- If timesheets exist, recalculates timesheet billing amounts

**Price List change** (`selling_price_list()`):
- Updates `price_list_currency`, `plc_conversion_rate`
- Reapplies pricing rules to all items

**Tax template change** (`taxes_and_charges()`):
- Fetches tax rows from `Sales Taxes and Charges Template`
- Populates `taxes` table
- Recalculates totals

**Tax Category change** (`tax_category()`):
- May change the effective tax template
- Recalculates taxes

**Item table changes**:
- `items_add()`: copies `income_account`, `discount_account`, `cost_center`, `project` from parent to new row
- On qty/rate change: recalculates `amount`, `base_amount`, `net_rate`, `net_amount`
- On discount change: recalculates effective rate
- On item_tax_template change: recalculates per-item taxes

**Discount cascade**:
- `apply_discount_on` determines base for discount calculation (Grand Total or Net Total)
- `additional_discount_percentage` and `discount_amount` are mutually exclusive input methods
- `is_cash_or_non_trade_discount` toggles visibility of `additional_discount_account`

**Rounding**:
- `disable_rounded_total` hides rounding fields
- `rounding_adjustment` computed server-side
- `rounded_total = grand_total + rounding_adjustment`

**Outstanding amount**: `outstanding_amount = rounded_total - total_advance - paid_amount`

---

## 3. Business Logic / Client Triggers

From `sales_invoice.js`, `selling_controller.py`, and `accounts_controller.py`:

1. **`customer()` trigger**: Calls `get_party_details()` with posting_date, party, party_type="Customer", account=debit_to, price_list=selling_price_list. Auto-fills 15+ fields. Then calls `apply_pricing_rule()` to update all item prices.

2. **`company()` trigger**: Cascades to set price list, currency, exchange rates. Calls `erpnext.accounts.dimensions.update_dimension()`.

3. **`is_pos()` trigger**: Calls `set_pos_data()` which loads POS profile, sets account details, triggers `update_stock`.

4. **`update_stock()` trigger**: Calls `hide_fields()` which toggles visibility of `project`, `due_date`, `is_opening`, `source`, `total_advance`, `get_advances`, `advances`, `from_date`, `to_date`.

5. **`is_return()` trigger**: Calls `toggle_get_items()` to show/hide "Get Items From" buttons.

6. **`items_add()` trigger**: Copies `income_account`, `discount_account`, `cost_center`, `project` from parent doc to new child row.

7. **`taxes_and_charges()` trigger** (from accounts_controller): Fetches tax template, populates taxes table, calls `calculate_taxes_and_totals()`.

8. **`calculate_taxes_and_totals()`**: The core calculation engine — computes: net_total, taxes per row, total_taxes_and_charges, grand_total, rounding, outstanding_amount, in_words, base amounts, loyalty amounts, write off, paid amount, etc.

9. **`apply_pricing_rule()`**: Fetches prices from price list for each item, applies discounts, calculates rates.

10. **`set_posting_time` dependson**: When unchecked, posting_date defaults to Today and posting_time to Now (server-side). When checked, user can edit both.

11. **`due_date`**: Auto-calculated from `payment_terms_template` when customer is selected. Manual override possible.

12. **`write_off_outstanding_amount_automatically()`**: When POS + checked, sets `write_off_amount = grand_total - paid_amount - total_advance`.

---

## 4. BlessERP Current State

**Files checked:**
- `src/modules/invoices/components/InvoiceForm.tsx` (lines 268–456: Details tab)
- `src/modules/invoices/components/InvoiceLineItems.tsx` (line items table)
- `src/modules/invoices/components/InvoiceTotals.tsx` (totals display)
- `src/modules/invoices/pages/CreateInvoice.tsx` (orchestrator + payload builder)
- `src/modules/invoices/services/index.ts` (API layer)
- `src/modules/invoices/types/index.ts` (type definitions)

**What exists in BlessERP's Details tab:**

| BlessERP UI Element | ERPNext Field | Status |
|---|---|---|
| Customer (search/select) | `customer` | ✅ Partial |
| Invoice Date | `posting_date` | ✅ Match |
| Due Date | `due_date` | ✅ Partial |
| Set Posting Time (checkbox) | `set_posting_time` | ⚠️ Partial |
| Update Stock (checkbox) | `update_stock` | ✅ Partial |
| Customer's PO No. | `po_no` | ⚠️ Wrong tab* |
| PO Date | `po_date` | ⚠️ Wrong tab* |
| Tax Category | `tax_category` | ✅ Match |
| Line Items (editable table) | `items` | ✅ Partial |
| Taxes & Charges (read-only) | `taxes` | ⚠️ Partial |
| Totals display | `grand_total`, etc. | ⚠️ Partial |
| Apply Discount On | `apply_discount_on` | ✅ Partial |
| Discount Amount | `discount_amount` | ✅ Match |
| Discount % | `additional_discount_percentage` | ✅ Match |
| Coupon Code | `coupon_code` | ✅ Match |
| Write Off Amount | `write_off_amount` | ⚠️ Wrong tab** |
| Write Off Account | `write_off_account` | ⚠️ Wrong tab** |
| Write Off Cost Center | `write_off_cost_center` | ⚠️ Wrong tab** |

\* `po_no`/`po_date` are in ERPNext's More Info tab, not Details. BlessERP placed them in Details for UX convenience. Data round-trips correctly — this is a placement divergence, not a data gap.

\** Write Off is in ERPNext's Payments tab, not Details. BlessERP placed it in Details. Same note — data integrity OK, tab placement differs.

**What's completely missing from BlessERP's Details tab UI:**

| Missing Field | ERPNext Field | Impact |
|---|---|---|
| Company (display) | `company` | User can't see/verify company. Value sent from defaults. |
| Naming Series | `naming_series` | Auto-generated by ERPNext. No user control needed. |
| Customer Name (read-only) | `customer_name` | Partial — shown inline in search but not as separate field. |
| Tax Id | `tax_id` | Missing. Auto-fill from customer not implemented. |
| Company Tax ID | `company_tax_id` | Missing. |
| Posting Time input | `posting_time` | Checkbox exists but time picker is absent. |
| Is Return (checkbox) | `is_return` | In More Info tab, not Details. |
| Return Against | `return_against` | In More Info tab, not Details. |
| Is Debit Note (checkbox) | `is_debit_note` | In More Info tab, not Details. |
| POS Profile | `pos_profile` | In Payments tab, not Details. |
| Is POS (checkbox) | `is_pos` | In Payments tab, not Details. |
| Currency (display) | `currency` | Not shown. Sent from defaults. |
| Conversion Rate | `conversion_rate` | Not shown. Hardcoded to 1. |
| Price List | `selling_price_list` | Not shown. Sent from defaults. |
| Price List Currency | `price_list_currency` | Not shown. |
| PLC Conversion Rate | `plc_conversion_rate` | Not shown. |
| Ignore Pricing Rule | `ignore_pricing_rule` | Missing entirely. |
| Scan Barcode input | `scan_barcode` | Placeholder button only. |
| Source Warehouse | `set_warehouse` | Missing. |
| Cost Center (invoice-level) | `cost_center` | Excluded per comment. Sent from defaults. |
| Project | `project` | Excluded per comment. Not sent. |
| Shipping Rule | `shipping_rule` | Excluded (zero configured). |
| Incoterm | `incoterm` | Excluded (zero configured). |
| Named Place | `named_place` | Excluded (zero configured). |
| Taxes & Charges Template selector | `taxes_and_charges` | Not user-selectable. Hardcoded template. |
| Editable Taxes table | `taxes` | Read-only only. User can't add/edit/remove tax rows. |
| Additional Discount Account | `additional_discount_account` | Missing. |
| Is Cash or Non Trade Discount | `is_cash_or_non_trade_discount` | Missing. |
| Disable Rounded Total | `disable_rounded_total` | Missing. |
| Use Company Roundoff CC | `use_company_roundoff_cost_center` | Missing. |
| Rounding Adjustment | `rounding_adjustment` | Shown in totals but not user-controllable. |
| Rounded Total | `rounded_total` | Shown in totals. |
| In Words | `in_words` | Not displayed. |
| Total Advance | `total_advance` | Shown in totals (always 0). |
| Outstanding Amount | `outstanding_amount` | Not computed/displayed in Details tab totals. |
| Pricing Rules table | `pricing_rules` | Missing. |
| Packed Items table | `packed_items` | Missing (Product Bundles not in use). |
| Timesheets table | `timesheets` | Missing (service model not applicable). |
| Tax Breakup display | `other_charges_calculation` | Missing. |

**What BlessERP has that ERPNext Details tab does NOT:**

| BlessERP Feature | Location | ERPNext Equivalent |
|---|---|---|
| Coupon Code | Details → Additional Discount | `coupon_code` exists in ERPNext but is typically handled via pricing rules, not a standalone visible field on the standard form. BlessERP makes it explicit. |
| QST display (separate from GST) | Totals | ERPNext shows generic tax rows. QST/GST distinction is BlessERP-specific (Canadian tax). |

---

## 5. Gap Table

| # | ERPNext Field/Behavior | BlessERP Equivalent | Status | Fix Needed |
|---|---|---|---|---|
| 1 | **`customer` trigger → auto-fill 15+ fields** (address, contact, territory, payment terms, price list, currency) | Only fills: customer, customerName, customerAddress, shippingAddressName, contactPerson | **Partial** | Must-fix: customer selection should fetch party details from ERPNext API |
| 2 | `company` (Link, reqd, user-visible) | Not shown. Hardcoded from defaults. | **Partial** | Nice-to-have: show company name as read-only |
| 3 | `naming_series` (Select) | Not shown. Auto-generated. | **Match** | None — ERPNext handles server-side |
| 4 | `posting_date` (Date, reqd, default Today) | `issueDate` (Date, default Today) | **Match** | None |
| 5 | `posting_time` (Time, default Now) + `set_posting_time` toggle | Checkbox exists. No time picker UI. | **Partial** | Nice-to-have: add time picker when checkbox is checked |
| 6 | `due_date` (Date) | `dueDate` (Date, default +30 days) | **Partial** | Must-fix: should be calculated from payment terms template, not hardcoded +30 |
| 7 | `is_return`, `return_against`, `is_debit_note` in Details tab | In More Info tab | **Partial** | Nice-to-have: move to Details tab for ERPNext parity |
| 8 | `is_pos`, `pos_profile` in Details tab | In Payments tab | **Partial** | Nice-to-have: move to Details for ERPNext parity |
| 9 | `currency`, `conversion_rate`, `selling_price_list`, `price_list_currency`, `plc_conversion_rate` (collapsible section) | Not shown. Hardcoded from defaults. | **Partial** | Nice-to-have: display as read-only; must-fix if multi-currency is needed |
| 10 | `ignore_pricing_rule` (Check) | Missing entirely | **Missing** | Nice-to-have for MVP |
| 11 | `scan_barcode` (Data, Barcode options) | Placeholder "Scan Barcode" button, no functionality | **Partial** | Nice-to-have |
| 12 | `update_stock` + `set_warehouse` (depends_on: update_stock) | Checkbox exists. `set_warehouse` missing. | **Partial** | Must-fix: show Source Warehouse when update_stock is checked |
| 13 | `cost_center` (invoice-level, Link → Cost Center) | Excluded from UI. Sent from company defaults. | **Partial** | Nice-to-have: show as optional field |
| 14 | `project` (Link → Project) | Excluded from UI. Not in payload. | **Missing** | Low priority — zero projects configured |
| 15 | `taxes_and_charges` (Link → Sales Taxes and Charges Template) | Not user-selectable. Hardcoded default template. | **Partial** | Must-fix: allow user to change tax template |
| 16 | Editable `taxes` table (add/edit/remove rows) | Read-only display only | **Partial** | Must-fix: allow user to see and understand tax breakdown |
| 17 | `tax_category` (Link → Tax Category) | `taxCategory` select | **Match** | None |
| 18 | `shipping_rule`, `incoterm`, `named_place` | Excluded (none configured) | **Match** | None for MVP |
| 19 | `apply_discount_on` default = "Grand Total" | No default set (shows "None" option first) | **Partial** | Must-fix: default to "Grand Total" |
| 20 | `additional_discount_account` (Link → Account) | Missing | **Missing** | Nice-to-have |
| 21 | `is_cash_or_non_trade_discount` (Check) | Missing | **Missing** | Nice-to-have |
| 22 | `disable_rounded_total` (Check) | Missing | **Missing** | Nice-to-have |
| 23 | `use_company_roundoff_cost_center` (Check) | Missing | **Missing** | Nice-to-have |
| 24 | `rounding_adjustment` (server-computed, displayed) | Displayed in InvoiceTotals as 0 | **Match** | None |
| 25 | `rounded_total` (server-computed) | Displayed in InvoiceTotals | **Match** | None |
| 26 | `in_words` (server-computed, Small Text) | Not displayed | **Missing** | Nice-to-have |
| 27 | `outstanding_amount` (server-computed) | Computed in InvoiceTotals but not sent to server for new invoice | **Partial** | Match — server computes on save |
| 28 | `total_advance` (read-only) | Displayed in InvoiceTotals (always 0) | **Match** | None |
| 29 | Customer auto-fill: `tax_id` from customer | Not fetched | **Missing** | Nice-to-have |
| 30 | Customer auto-fill: `territory` | Not fetched | **Missing** | Nice-to-have |
| 31 | Pricing Rules (read-only table) | Missing | **Missing** | Low priority |
| 32 | Packed Items table | Missing | **Missing** | None — Product Bundles not in use |
| 33 | Timesheets table | Missing | **Missing** | None — service model not applicable |
| 34 | Tax Breakup display | Missing | **Missing** | Low priority |
| 35 | **Business logic: `calculate_taxes_and_totals()`** — full server-side recalculation engine | BlessERP does client-side-only calculation with hardcoded GST/QST rates | **Partial** | Must-fix: should call ERPNext's `calculate_taxes_and_totals` on save, or replicate key logic client-side |
| 36 | **Business logic: `apply_pricing_rule()`** — fetches item prices from price list | BlessERP uses `standard_rate` from product directly | **Partial** | Must-fix if price lists with different rates per customer/pricing rule are used |
| 37 | **Line items: `income_account` (Link, reqd, allow_on_submit)** | In expandable row as text input | **Partial** | Must-fix: should be a Link select with account filtering |
| 38 | **Line items: `cost_center` (Link, reqd, allow_on_submit)** | In expandable row as text input | **Partial** | Must-fix: should be a Link select |
| 39 | **Line items: `item_tax_template` (Link → Item Tax Template)** | Text input in expandable row | **Partial** | Should be a Link select |
| 40 | **Line items: `grant_commission` (Check, fetch_from: item_code.grant_commission)** | Checkbox exists | **Match** | None |
| 41 | **Line items: `page_break` (Check)** | Checkbox exists | **Match** | None |
| 42 | **Line items: `conversion_factor` (Float, reqd)** | Hardcoded to 1 in payload | **Partial** | Must-fix if UOM conversion is needed |
| 43 | **Line items: `stock_qty` (computed)** | Not sent | **Partial** | Server recalculates |
| 44 | **Write Off in Details tab vs ERPNext Payments tab** | BlessERP: Details tab | **Extra in BlessERP** | Move to Payments tab for parity |
| 45 | **Customer PO fields: ERPNext has them in More Info tab** | BlessERP: Details tab | **Extra in BlessERP** | Placement difference only, data OK |

---

## 6. Priority

### Must-fix (MVP — data won't round-trip correctly without these):

1. **Customer selection → full party details fetch** (#1): When customer is selected, BlessERP should call ERPNext's `get_party_details` API (or equivalent) to auto-fill address, contact, territory, payment terms template, currency, price list. Currently only 5 fields are set. **This is the #1 gap** — without it, customer-dependent defaults (payment terms, currency, address) are missing.

2. **Due date calculation from payment terms** (#6): Currently hardcoded to +30 days. Should calculate from the customer's payment terms template or at minimum from the selected `paymentTermsTemplate`.

3. **`apply_discount_on` default = "Grand Total"** (#19): Must default to "Grand Total" to match ERPNext. Currently shows "None".

4. **`taxes_and_charges` template selector** (#15): User should be able to change the tax template (or at least see which one is applied). Currently hardcoded with no visibility.

5. **Source Warehouse when `update_stock` checked** (#12): When Update Stock is toggled on, show a warehouse selector.

6. **Line items: `income_account` and `cost_center` as Link selects** (#37, #38): Currently plain text inputs. Should use ERPNext's account/cost center filtered Link dropdowns. The `accounts` and `costCenters` lookup data is already fetched in InvoiceForm — just needs wiring.

7. **Line items: `item_tax_template` as Link select** (#39): Should be a Link to "Item Tax Template" doctype, not a plain text input.

### Nice-to-have (UI polish / completeness):

8. **Posting Time picker** (#5): Add a time input when "Set Posting Time" checkbox is checked.
9. **Company name display** (#2): Show as read-only text.
10. **Currency / Price List display** (#9): Show as read-only section for transparency.
11. **`is_return` / `is_debit_note` / `return_against` placement** (#7): Move to Details tab.
12. **`is_pos` / `pos_profile` placement** (#8): Move to Details tab.
13. **`ignore_pricing_rule` checkbox** (#10): Add for parity.
14. **Additional Discount Account** (#20): Add Link field.
15. **`disable_rounded_total`** (#22): Add checkbox.
16. **Scan Barcode functionality** (#11): Implement barcode scanning.
17. **`in_words` display** (#26): Show computed "In Words" text.

### Low priority / excluded by design (acceptable for MVP):

18. `project` (#14) — zero projects configured.
19. `shipping_rule`, `incoterm`, `named_place` (#18) — zero configured.
20. Packed Items, Timesheets, Pricing Rules (#31–33) — features not applicable to BlessERP's goods-only model.
21. Tax Breakup display (#34) — informational only.
22. `is_cash_or_non_trade_discount` (#21) — niche accounting feature.
23. `use_company_roundoff_cost_center` (#23) — niche rounding feature.

---

## Summary Counts

| Category | Count |
|---|---|
| **Total gaps identified** | 45 |
| **Match** (no fix needed) | 10 |
| **Partial** (exists but incomplete) | 22 |
| **Missing** (does not exist in BlessERP) | 10 |
| **Extra in BlessERP** (placement difference) | 3 |
| | |
| **Must-fix for MVP** | 7 |
| **Nice-to-have** | 15 |
| **Low priority / acceptable** | 8 |

---

## Structural Alignment Audit: Information Architecture

### Critical Architectural Finding

**ERPNext Desk's `sales_invoice.json` puts 129 visible fields in the Details tab.** The field_order has its first Tab Break at index 185 (`contact_and_address_tab`). All sections — customer_header, billing_address, currency_and_price_list, items, taxes, totals, loyalty, additional_discount, advance_payments, payment_terms, payments, write_off, terms_and_conditions, print_settings, additional_info, accounting_details, commission, sales_team, subscription, accounting_dimensions — are before index 185.

The remaining tabs are structurally empty:

| Tab | Tab Break Index | Visible Fields |
|---|---|---|
| Address & Contact | 185 | 0 (section/column breaks only) |
| Payments | 186 | 0 |
| Terms | 187 | 0 |
| More Info | 188 | 0 |
| Connections | 189 | 8 (miscellaneous: incoterm, named_place, only_include_allocated_payments, use_company_roundoff_cost_center, update_billed_amount_in_delivery_note, update_outstanding_for_self, company_contact_person, last_scanned_warehouse) |

**Implication:** ERPNext's "tab structure" is a lie — it's a single mega-tab with 129 fields, plus near-empty tabs. BlessERP distributing these fields across 5 meaningful tabs is not a bug to be "fixed" to match Desk. It's a deliberate information-architecture improvement.

---

### Section-Level Structural Map

Each row maps an ERPNext Desk section (all in the Details mega-tab) to its BlessERP location. `field_order` indices cited where relevant for verifiability.

#### Aligned (same logical location, no relocation needed)

| # | Desk Section | Key Fields | BlessERP Location | Notes |
|---|---|---|---|---|
| 1 | Header (`customer_section`) | customer, customer_name, posting_date, due_date, set_posting_time | Details > Header | Core identity fields match |
| 2 | Items | update_stock, items | Details > Header (update_stock) + Details > Line Items (items) | update_stock promoted to Header; items in Line Items. Reasonable split. |
| 3 | Currency and Price List | set_warehouse | Details > Header (conditional on updateStock) | Matches Desk `depends_on: update_stock` behavior |
| 4 | Totals | total_qty, total, net_total, grand_total, rounding_adjustment, rounded_total, in_words, outstanding_amount | Details > Totals | Aligned |
| 5 | Additional Discount | apply_discount_on, discount_amount, additional_discount_percentage | Details > Additional Discount | Aligned |
| 6 | Taxes and Charges | taxes_and_charges, taxes | Details > Taxes and Charges | Template selector + read-only tax table |
| 7 | Write Off | write_off_amount, write_off_account, write_off_cost_center | Details > Write Off | Same tab (Details), different section. Desk groups in "Changes"; BlessERP has standalone collapsible |

#### Split (field group divided across BlessERP locations)

| # | Desk Section | Fields | BlessERP Locations | Notes |
|---|---|---|---|---|
| 8 | Customer PO Details | po_no, po_date | Details > Header | Same tab. Desk: collapsible section below header. BlessERP: promoted to Header. More prominent = reasonable for PO-driven workflows |
| 9 | Header | tax_category | Details > Header (separate row) | Desk groups with taxes_and_charges. BlessERP puts in Header. Minor section displacement, same tab |
| 10 | Billing Address | customer_address, shipping_address_name, contact_person | Address & Contact tab | Moved from Details mega-tab to dedicated Address tab. Simplified: 3 `<select>` inputs vs Desk's 7 fields |
| 11 | Advance Payments | allocate_advances_automatically, only_include_allocated_payments | Payments > Advances | Moved to Payments tab. Checkbox states only; advances table/button not implemented (Week 5) |
| 12 | Payment Terms | payment_terms_template, payment_schedule | Terms > Payment Terms | Moved to dedicated Terms tab |
| 13 | Terms and Conditions | tc_name, terms | Terms > Terms and Conditions | Moved to dedicated Terms tab |

#### Relocated (entire section moved to different tab)

| # | Desk Section | Fields | Desk Location | BlessERP Location | Assessment |
|---|---|---|---|---|---|
| 14 | Header flags | is_pos, pos_profile | Details (idx 7–8) | Payments > POS | **Correct relocation.** POS is a payment flow, not invoice-header metadata. ERPNext's placement in the header is the mistake — it clutters the primary "create a normal invoice" path with a rarely-toggled terminal-mode flag. BlessERP's Payments tab is the right home. |
| 15 | Header flags + Accounting Dimensions | is_return, return_against, is_debit_note | Details (idx 9, 18, 175) | More Info > Returns / Credit Note | **Correct relocation.** Returns and credit notes are rare edge cases. Tucking them into More Info keeps the Details tab focused on the primary invoice-creation flow. ERPNext's 129-field mega-tab forces these onto the same screen as customer selection — BlessERP's separation is better UX. |
| 16 | Loyalty Points Redemption | loyalty_points, loyalty_amount, redeem_loyalty_points, loyalty_program, loyalty_redemption_account, loyalty_redemption_cost_center | Details (idx 79–86) | More Info > Loyalty Points | **Correct relocation.** Loyalty redemption is a niche payment feature. Same rationale as POS — doesn't belong cluttering the primary path. |
| 17 | Print Settings | letter_head, group_same_items, language, select_print_heading | Details (idx 134–138) | More Info > Print Settings | **Correct relocation.** Print settings are configuration, not transaction data. Better in More Info than buried in a 129-field Details tab. |
| 18 | Payment Terms | payment_terms_template, payment_schedule | Details (idx 110–111) | Terms tab | **Correct relocation.** Payment terms deserve their own tab in any structured form. ERPNext crams them into Details because it has no real tab structure. |
| 19 | Terms and Conditions | tc_name, terms | Details (idx 131–132) | Terms tab | **Correct relocation.** Same as above — terms are a natural tab. |
| 20 | Accounting Details | debit_to, is_opening, remarks | Details (idx 148–152) | More Info > Accounting Details | **Acceptable relocation.** These are secondary accounting fields that don't need to be on the primary screen. |
| 21 | Commission + Sales Team | sales_partner, commission_rate, sales_team | Details (idx 154–159) | More Info > Sales Team | **Acceptable relocation.** Sales team attribution is secondary data. |

#### Merged (ERPNext separate sections combined in BlessERP)

| # | Desk Sections | BlessERP Location | Notes |
|---|---|---|---|
| 22 | Commission + Sales Team | More Info > Sales Team | Desk has separate "Commission" and "Sales Team" collapsible sections. BlessERP merges sales_partner + commission_rate into Sales Team header. total_commission (computed) omitted. Natural simplification. |
| 23 | Additional Info + Accounting Details | More Info > Accounting Details | Desk has separate "Additional Info" and "Accounting Details". BlessERP folds customer_group, remarks into Accounting Details. campaign, status, source, is_discounted, inter_company_invoice_reference omitted. Reasonable for simplified use. |

#### Absent (Desk fields not in BlessERP — intentional exclusions)

| Category | Fields | Justification |
|---|---|---|
| System/hidden | title, naming_series, amended_from, party_account_currency, ignore_default_payment_terms_template | System fields, auto-generated, or hidden in Desk |
| Display-only | address_display, contact_display, contact_mobile, contact_email, company_address_display, base_write_off_amount | Read-only computed/display fields |
| Company defaults | company, cost_center, project | Resolved server-side from company defaults |
| Not in use on instance | shipping_rule, incoterm, named_place, packed_items, timesheets, pricing_rules, is_consolidated, is_internal_customer, company_tax_id, unrealized_profit_loss_account, represents_company, set_target_warehouse, dispatch_address_name, dispatch_address, total_billing_hours | Confirmed zero records or not applicable to goods-only model |
| POS amounts | base_paid_amount, paid_amount, base_change_amount, change_amount, write_off_outstanding_amount_automatically | Week 5 scope (payment recording) |
| Subscription internals | update_auto_repeat_reference, against_income_account | System/hidden fields |
| Low priority | additional_discount_account, disable_rounded_total, is_cash_or_non_trade_discount, use_company_roundoff_cost_center, tax_id | Niche accounting features |

---

### Recommendations

**No tab-relocation changes needed.** All three genuine tab-level relocations (POS → Payments, Returns → More Info, Loyalty → More Info) are correct simplifications of ERPNext's overloaded Details mega-tab. Moving them back to Details would degrade BlessERP's UX without improving parity.

**One section-level displacement worth considering:**

- `tax_category` (Finding #9) is in the Header section in BlessERP but grouped with `taxes_and_charges` in ERPNext's "Taxes and Charges" section. This is a minor section displacement (same tab). Consider moving `tax_category` from Header to the Taxes and Charges section to improve semantic grouping — tax category is a tax-setting, not an invoice-identity field.

**Write Off placement (Finding #7) — no change recommended, but worth noting:**

Desk groups Write Off inside the "Changes" section (alongside `change_amount`, `account_for_change_amount`) after the Payments area. BlessERP has it as a standalone collapsible in Details. This is functionally equivalent (same tab), but the desk version ties Write Off more tightly to the POS "change" concept. For BlessERP's simplified use where Write Off is used for general write-offs (not just POS change), the standalone placement is appropriate.

**Summary:**

| Category | Count |
|---|---|
| Aligned (no change needed) | 7 |
| Split (same or adjacent tab, minor repositioning) | 5 |
| Relocated (different tab — all justified) | 8 |
| Merged (simplified) | 2 |
| Absent (intentional exclusions) | 11 categories |
| **Recommended change** | **1** (move tax_category to Taxes section) |
