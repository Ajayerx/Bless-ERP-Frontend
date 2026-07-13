## Phase 1: MVP — Core Business Operations

### 1.1 CUSTOMER DOCTYPE
Source: erpnext/selling/doctype/customer/customer.json

#### Form Fields (reqd = mandatory)
| fieldname | label | fieldtype | options | reqd |
| customer_name | Customer Name | Data | | Yes |
| customer_type | Customer Type | Select | Individual\nCompany\nPartnership | Yes |
| customer_group | Customer Group | Link | Customer Group | Yes |
| territory | Territory | Link | Territory | Yes |
| salutation | Salutation | Link | Salutation | No |
| gender | Gender | Link | Gender | No |
| lead_name | Lead | Link | Lead | No |
| opportunity_name | Opportunity | Link | Opportunity | No |
| prospect_name | Prospect | Link | Prospect | No |
| account_manager | Account Manager | Link | User | No |
| image | Image | Attach Image | | No |
| default_currency | Default Currency | Link | Currency | No |
| default_bank_account | Default Bank Account | Link | Bank Account | No |
| default_price_list | Default Price List | Link | Price List | No |
| is_internal_customer | Is Internal Customer | Check | | No |
| represents_company | Represents Company | Link | Company | No |
| market_segment | Market Segment | Link | Market Segment | No |
| industry | Industry | Link | Industry Type | No |
| customer_pos_id | Customer POS ID | Data | | No |
| website | Website | Data | | No |
| language | Language | Link | Language | No |
| tax_id | Tax ID | Data | | No |
| tax_category | Tax Category | Link | Tax Category | No |
| tax_withholding_category | Tax Withholding Category | Link | Tax Withholding Category | No |
| payment_terms | Payment Terms | Link | Payment Terms Template | No |
| loyalty_program | Loyalty Program | Link | Loyalty Program | No |
| default_sales_partner | Default Sales Partner | Link | Sales Partner | No |
| default_commission_rate | Default Commission Rate | Float | | No |
| so_required | Sales Order Required | Check | | No |
| dn_required | Delivery Note Required | Check | | No |
| is_frozen | Is Frozen | Check | | No |
| disabled | Disabled | Check | | No |

#### Child Tables
**Customer Credit Limit:** company (Link-Company, reqd), credit_limit (Currency, reqd), bypass_credit_limit_check (Check)
**Sales Team:** sales_person (Link-Sales Person, reqd), allocated_percentage (Float), allocated_amount (Currency), commission_rate (Data), incentives (Currency)
**Accounts:** company (Link-Company, reqd), account (Link-Account), advance_account (Link-Account)

#### Tabs (Layout mirrors ERPNext)
- Basic Info: customer_name, customer_type, customer_group, territory, salutation, gender, lead_name, account_manager, image
- Address & Contact: (linked Address/Contact docs)
- Tax: tax_id, tax_category, tax_withholding_category
- Accounting: default_currency, default_price_list, payment_terms, default_sales_partner, default_commission_rate, so_required, dn_required, is_frozen
- Sales Team: Sales Team child table
- Settings: is_internal_customer, represents_company, market_segment, industry, website, language, customer_pos_id, default_bank_account

#### API
GET /api/resource/Customer?fields=[name,customer_name,customer_type,customer_group,territory,disabled,creation]
GET /api/resource/Customer/{name}
POST /api/resource/Customer
PUT /api/resource/Customer/{name}

### 1.2 ADDRESS DOCTYPE
Source: frappe/contacts/doctype/address/address.json

#### Fields
| fieldname | label | fieldtype | reqd |
| address_title | Address Title | Data | No |
| address_type | Address Type | Select (Billing/Shipping/Office/Personal/Plant/Postal/Shop/Subsidiary/Warehouse/Other) | No |
| address_line1 | Address Line 1 | Data | Yes |
| address_line2 | Address Line 2 | Data | No |
| city | City/Town | Data | Yes |
| county | County | Data | No |
| state | State | Data | No |
| country | Country | Link (Country) | Yes |
| pincode | Post Code | Data | No |
| email_id | Email Address | Data | No |
| phone | Phone | Data | No |
| is_primary_address | Preferred Billing Address | Check | No |
| is_shipping_address | Preferred Shipping Address | Check | No |
| is_your_company_address | Is Your Company Address | Check | No |
| disabled | Disabled | Check | No |
| links | Table (Dynamic Link) | Table | No |

Dynamic Link child: link_doctype (Link-DocType, reqd), link_name (Dynamic Link, reqd)

### 1.3 CONTACT DOCTYPE
Source: frappe/contacts/doctype/contact/contact.json

#### Fields
| fieldname | label | fieldtype | reqd |
| first_name | First Name | Data | Yes |
| last_name | Last Name | Data | No |
| salutation | Salutation | Link (Salutation) | No |
| designation | Designation | Data | No |
| company_name | Company Name | Data | No |
| email_id | Email Address | Data | No |
| mobile_no | Mobile No | Data | No |
| phone | Phone | Data | No |
| gender | Gender | Link (Gender) | No |
| is_primary_contact | Is Primary Contact | Check | No |
| is_billing_contact | Is Billing Contact | Check | No |
| image | Image | Attach Image | No |
| status | Status | Select (Open/Replied/Under Offer/Interested In Opportunity/Disabled) | No |
| links | Table (Dynamic Link) | Table | No |

### 1.4 ITEM DOCTYPE (Product)
Source: erpnext/stock/doctype/item/item.json

#### Fields (MVP subset)
| fieldname | label | fieldtype | reqd |
| item_code | Item Code | Data | Yes |
| item_name | Item Name | Data | Yes |
| item_type | Item Type | Select (Goods/Services) | Yes |
| item_group | Item Group | Link (Item Group) | Yes |
| stock_uom | Stock UOM | Link (UOM) | Yes |
| description | Description | Text Editor | No |
| image | Image | Attach Image | No |
| brand | Brand | Link (Brand) | No |
| gst_hsn_code | HSN/SAC | Data | No |
| is_purchase_item | Is Purchase Item | Check | No |
| is_sale_item | Is Sales Item | Check | No |
| disabled | Disabled | Check | No |
| standard_rate | Standard Selling Rate | Currency | No |
| item_defaults | Item Default (Table) | Table | No |

Item Default child: company (Link-Company, reqd), default_warehouse (Link-Warehouse), default_price_list (Link-Price List), expense_account (Link-Account), income_account (Link-Account)

### 1.5 SALES INVOICE DOCTYPE
Source: erpnext/accounts/doctype/sales_invoice/sales_invoice.json

#### Header Fields
| fieldname | label | fieldtype | reqd |
| customer | Customer | Link (Customer) | Yes |
| posting_date | Posting Date | Date | Yes |
| due_date | Due Date | Date | Yes |
| company | Company | Link (Company) | Yes |
| currency | Currency | Link (Currency) | Yes |
| selling_price_list | Price List | Link (Price List) | No |
| set_warehouse | Warehouse | Link (Warehouse) | No |
| update_stock | Update Stock | Check | No |

#### Child Tables
**Items (Sales Invoice Item):** item_code (Link-Item, reqd), item_name (Read Only), description (Text Editor), qty (Float, reqd), uom (Link-UOM, reqd), rate (Currency, reqd), amount (Currency, Read Only), income_account (Link-Account, reqd), cost_center (Link-Cost Center, reqd), warehouse (Link-Warehouse), serial_no (Small Text), batch_no (Link-Batch), sales_order (Link-Sales Order), delivery_note (Link-Delivery Note)

**Taxes (Sales Taxes and Charges):** charge_type (Select-Actual/On Net Total/On Previous Row Amount/On Previous Row Total/On Item Tax, reqd), account_head (Link-Account, reqd), description (Text Editor), rate (Float), tax_amount (Currency, Read Only), total (Currency, Read Only), included_in_print_rate (Check)

**Payments (Sales Invoice Payment):** mode_of_payment (Link-Mode of Payment, reqd), amount (Currency, reqd), account (Link-Account)

#### Read Only / Calculated
net_total, total_taxes_and_charges, grand_total, rounded_total, outstanding_amount, in_words, status, docstatus

### 1.6 PAYMENT ENTRY DOCTYPE
Source: erpnext/accounts/doctype/payment_entry/payment_entry.json

#### Fields
| fieldname | label | fieldtype | reqd |
| payment_type | Payment Type | Select (Receive/Pay/Internal Transfer) | Yes |
| posting_date | Posting Date | Date | Yes |
| company | Company | Link (Company) | Yes |
| mode_of_payment | Mode of Payment | Link (Mode of Payment) | No |
| party_type | Party Type | Link (DocType) | Yes |
| party | Party | Dynamic Link | Yes |
| paid_from_account | Paid From Account | Link (Account) | Yes |
| paid_amount | Paid Amount | Currency | Yes |
| paid_to_account | Paid To Account | Link (Account) | Yes |
| received_amount | Received Amount | Currency | Yes |
| reference_no | Reference No | Data | No |
| reference_date | Reference Date | Date | No |
| remarks | Remarks | Text | No |
| status | Status | Select (Draft/Submitted/Paid/Unpaid/Overdue/Cancelled) | Read Only |

**References child table:** reference_doctype (Link-DocType, reqd), reference_name (Dynamic Link, reqd), allocated_amount (Currency, reqd), total_amount (Currency, Read Only), outstanding_amount (Currency, Read Only)

### 1.7 DASHBOARD KPI Endpoints
GET /api/method/frappe.client.get_count?doctype=Sales Invoice&filters=[[docstatus,=,1]]
GET /api/resource/Sales Invoice?fields=[name,customer_name,grand_total,outstanding_amount,status,posting_date]&limit_page_length=5&order_by=posting_date desc
GET /api/resource/Sales Invoice?fields=[name,customer_name,grand_total,status,posting_date]&filters=[[docstatus,=,1],[outstanding_amount,>,0]]&limit_page_length=5
GET /api/resource/Payment Entry?fields=[name,party,paid_amount,received_amount,posting_date]&limit_page_length=5&order_by=posting_date desc

---

## Phase 2: Full Sales Module

### 2.1 QUOTATION DOCTYPE
Source: erpnext/selling/doctype/quotation/quotation.json

#### Fields
| fieldname | label | fieldtype | reqd |
| quotation_to | Quotation To | Select (Customer/Lead) | Yes |
| party_name | Party Name | Dynamic Link | Yes |
| company | Company | Link (Company) | Yes |
| transaction_date | Date | Date | Yes |
| valid_till | Valid Till | Date | No |
| currency | Currency | Link (Currency) | Yes |
| selling_price_list | Price List | Link (Price List) | No |
| items | Items | Table (Quotation Item) | Yes |
| taxes | Sales Taxes and Charges | Table (Sales Taxes and Charges) | No |
| sales_team | Sales Team | Table (Sales Team) | No |
| additional_discount_percentage | Additional Discount % | Float | No |
| discount_amount | Discount Amount | Currency | No |
| apply_discount_on | Apply Discount On | Select (Grand Total/Net Total) | No |
| net_total | Net Total | Currency | Read Only |
| grand_total | Grand Total | Currency | Read Only |
| rounded_total | Rounded Total | Currency | Read Only |
| status | Status | Select (Draft/Submitted/Ordered/Lost/Cancelled/Expired) | Read Only |
| customer_address | Customer Address | Link (Address) | No |
| contact_person | Contact Person | Link (Contact) | No |

**Quotation Item** same fields as Sales Invoice Item +: margin_type (Select-Percentage/Amount), margin_rate_or_amount (Float), discount_percentage (Float), discount_amount (Currency)

**Convert to Sales Order:**
POST /api/method/erpnext.selling.doctype.quotation.quotation.make_sales_order
Body: {"source_name": "QTN-0001"}

### 2.2 SALES ORDER DOCTYPE
Source: erpnext/selling/doctype/sales_order/sales_order.json

#### Fields (matches Quotation pattern +)
| fieldname | label | fieldtype | reqd |
| customer | Customer | Link (Customer) | Yes |
| company | Company | Link (Company) | Yes |
| transaction_date | Transaction Date | Date | Yes |
| delivery_date | Delivery Date | Date | No |
| order_type | Order Type | Select (Sales/Maintenance/Shopping Cart) | No |
| currency | Currency | Link (Currency) | Yes |
| selling_price_list | Price List | Link (Price List) | No |
| items | Items | Table (Sales Order Item) | Yes |
| taxes | Sales Taxes and Charges | Table (Sales Taxes and Charges) | No |
| sales_team | Sales Team | Table (Sales Team) | No |
| status | Status | Select (Draft/To Deliver and Bill/To Bill/To Deliver/Completed/Closed/Cancelled) | Read Only |
| per_delivered | Percent Delivered | Percent | Read Only |
| per_billed | Percent Billed | Percent | Read Only |
| skip_delivery_note | Skip Delivery Note | Check | No |
| grand_total | Grand Total | Currency | Read Only |

**Sales Order Item** same as Quotation Item +:
delivery_date (Date), delivered_qty (Float, Read Only), billed_amt (Currency, Read Only), prevdoc_docname (Link-Quotation)

### 2.3 EMAIL SENDING
POST /api/method/frappe.core.doctype.communication.email.make
Body: {"recipients": "email@example.com", "subject": "...", "content": "...", "doctype": "Sales Invoice", "name": "INV-0001", "send_email": true, "attachments": [{"fname": "invoice.pdf", "fcontent": "base64..."}]}

---

## Phase 3: Expenses, Accounting & Reports

### 3.1 SUPPLIER DOCTYPE
Source: erpnext/buying/doctype/supplier/supplier.json

| fieldname | label | fieldtype | reqd |
| supplier_name | Supplier Name | Data | Yes |
| supplier_type | Supplier Type | Link (Supplier Type) | Yes |
| supplier_group | Supplier Group | Link (Supplier Group) | Yes |
| territory | Territory | Link (Territory) | No |
| tax_id | Tax ID | Data | No |
| tax_category | Tax Category | Link (Tax Category) | No |
| payment_terms | Payment Terms | Link (Payment Terms Template) | No |
| disabled | Disabled | Check | No |
| website | Website | Data | No |
| language | Language | Link (Language) | No |
| default_currency | Default Currency | Link (Currency) | No |
| default_price_list | Default Price List | Link (Price List) | No |
| allow_purchase_invoice_creation_without_purchase_order | Allow Without PO | Check | No |
| accounts | Table (Supplier Account) | Table | No |

Supplier Account child: company (Link-Company, reqd), account (Link-Account, reqd)

### 3.2 PURCHASE INVOICE (Bill) DOCTYPE
Source: erpnext/accounts/doctype/purchase_invoice/purchase_invoice.json

| fieldname | label | fieldtype | reqd |
| supplier | Supplier | Link (Supplier) | Yes |
| posting_date | Posting Date | Date | Yes |
| due_date | Due Date | Date | Yes |
| company | Company | Link (Company) | Yes |
| currency | Currency | Link (Currency) | Yes |
| buying_price_list | Price List | Link (Price List) | No |
| set_warehouse | Warehouse | Link (Warehouse) | No |
| items | Items | Table (Purchase Invoice Item) | Yes |
| taxes | Purchase Taxes and Charges | Table | No |
| status | Status | Select (Draft/Submitted/Paid/Unpaid/Overdue/Cancelled) | Read Only |
| net_total | Net Total | Currency | Read Only |
| grand_total | Grand Total | Currency | Read Only |
| outstanding_amount | Outstanding Amount | Currency | Read Only |

**Purchase Invoice Item:** item_code (Link-Item, reqd), qty (Float, reqd), uom (Link-UOM, reqd), rate (Currency, reqd), amount (Currency, Read Only), expense_account (Link-Account, reqd), cost_center (Link-Cost Center, reqd), warehouse (Link-Warehouse), serial_no, batch_no

### 3.3 PURCHASE ORDER DOCTYPE
Source: erpnext/buying/doctype/purchase_order/purchase_order.json

Mirrors Purchase Invoice structure but order-specific:
| fieldname | label | fieldtype | reqd |
| supplier | Supplier | Link (Supplier) | Yes |
| transaction_date | Transaction Date | Date | Yes |
| schedule_date | Required By | Date | No |
| company | Company | Link (Company) | Yes |
| buying_price_list | Price List | Link (Price List) | No |
| items | Items | Table (Purchase Order Item) | Yes |
| taxes | Taxes and Charges | Table | No |
| status | Status | Select (Draft/Submitted/To Receive and Bill/To Bill/To Receive/Completed/Closed/Cancelled) | Read Only |

### 3.4 JOURNAL ENTRY DOCTYPE
Source: erpnext/accounts/doctype/journal_entry/journal_entry.json

| fieldname | label | fieldtype | reqd |
| posting_date | Posting Date | Date | Yes |
| company | Company | Link (Company) | Yes |
| accounts | Accounting Entries | Table (Journal Entry Account) | Yes |
| user_remark | User Remark | Text | No |
| total_debit | Total Debit | Currency | Read Only |
| total_credit | Total Credit | Currency | Read Only |
| difference | Difference | Currency | Read Only |
| docstatus | DocStatus | Int | |

**Journal Entry Account child:** account (Link-Account, reqd), debit (Currency), credit (Currency), debit_in_account_currency (Currency), credit_in_account_currency (Currency), account_currency (Link-Currency, Read Only), party_type (Link-DocType), party (Dynamic Link), cost_center (Link-Cost Center), project (Link-Project)

### 3.5 BANK ACCOUNT DOCTYPE
Source: erpnext/accounts/doctype/bank_account/bank_account.json

| fieldname | label | fieldtype | reqd |
| bank | Bank | Data | No |
| bank_account_no | Bank Account No | Data | No |
| company | Company | Link (Company) | No |
| account_name | Account Name | Data | Yes |
| account_type | Account Type | Select (Bank/Cash/Credit Card/Receivable/Payable) | No |
| is_company_account | Is Company Account | Check | No |
| party_type | Party Type | Link (DocType) | No |
| party | Party | Dynamic Link | No |
| disabled | Disabled | Check | No |
| integration_details | Integration Details | JSON | No |

### 3.6 EXPENSE CLAIM DOCTYPE
Source: erpnext/hr/doctype/expense_claim/expense_claim.json

| fieldname | label | fieldtype | reqd |
| employee | Employee | Link (Employee) | Yes |
| expense_approver | Expense Approver | Link (User) | No |
| company | Company | Link (Company) | Yes |
| posting_date | Posting Date | Date | Yes |
| total_claimed_amount | Total Claimed Amount | Currency | Read Only |
| total_sanctioned_amount | Total Sanctioned Amount | Currency | Read Only |
| status | Status | Select (Draft/Submitted/Approved/Rejected/Cancelled) | Read Only |

**Expense Claim Detail child:** expense_date (Date, reqd), expense_category (Link-Expense Claim Type), description (Text Editor), amount (Currency, reqd), cost_center (Link-Cost Center)

### 3.7 KEY REPORTS
| Report | API |
|--------|-----|
| Accounts Receivable | GET /api/method/frappe.desk.query_report.run?report_name=Accounts Receivable Summary&company={company} |
| Accounts Payable | GET /api/method/frappe.desk.query_report.run?report_name=Accounts Payable Summary&company={company} |
| Sales Register | GET /api/method/frappe.desk.query_report.run?report_name=Sales Register&company={company} |
| Purchase Register | GET /api/method/frappe.desk.query_report.run?report_name=Purchase Register&company={company} |
| GST Sales Register | GET /api/method/frappe.desk.query_report.run?report_name=GST Sales Register&company={company} |
| Profit and Loss | GET /api/method/frappe.desk.query_report.run?report_name=Profit and Loss Statement&company={company} |
| Balance Sheet | GET /api/method/frappe.desk.query_report.run?report_name=Balance Sheet&company={company} |
| General Ledger | GET /api/method/frappe.desk.query_report.run?report_name=General Ledger&company={company} |
| Trial Balance | GET /api/method/frappe.desk.query_report.run?report_name=Trial Balance&company={company} |

### 3.8 TAX CONFIG DOCTYPES
**Sales Taxes and Charges Template:** title (Data, reqd), company (Link-Company), is_default (Check), taxes (child: charge_type, account_head, description, rate, cost_center, included_in_print_rate)

**Item Tax Template:** title (Data, reqd), company (Link-Company), taxes (child: item_tax_template (deprecated), tax_category (Link-Tax Category), tax_rate (Float, reqd))

**Payment Terms Template:** template_name (Data, reqd), terms (child: payment_term (Link-Payment Term, reqd), description (Text), due_days_based_on (Select-Day(s)/Month(s)), credit_days (Int), credit_months (Int), discount (Float), discount_validity_based_on (Select), discount_validity (Int))

---

## Phase 4: CRM Module

### 4.1 OPPORTUNITY DOCTYPE
Source: erpnext/crm/doctype/opportunity/opportunity.json

| fieldname | label | fieldtype | reqd |
| opportunity_from | Opportunity From | Select (Customer/Lead/Prospect) | Yes |
| party_name | Party Name | Dynamic Link | Yes |
| customer_name | Customer Name | Read Only | No |
| opportunity_type | Opportunity Type | Select (Sales/Support/Retail/...see full list) | No |
| opportunity_amount | Opportunity Amount | Currency | No |
| transaction_date | Transaction Date | Date | Yes |
| expected_closing | Expected Closing | Date | No |
| sales_stage | Sales Stage | Select (Prospecting/Qualification/Negotiation/Closed Won/Closed Lost) | No |
| status | Status | Select (Open/Quotation/Converted/Closed Lost/On Hold) | No |
| customer_primary_address | Customer Address | Link (Address) | No |
| contact_person | Contact Person | Link (Contact) | No |
| items | Opportunities Items (Table) | Table | No |
| sales_team | Sales Team | Table | No |

**Opportunity Item child:** item_code (Link-Item), item_name (Data), qty (Float), rate (Currency), amount (Currency, Read Only), brand (Link-Brand), item_group (Link-Item Group)

**Convert to Quotation:**
POST /api/method/erpnext.crm.doctype.opportunity.opportunity.make_quotation
Body: {"source_name": "OPP-0001"}

### 4.2 LEAD DOCTYPE
Source: erpnext/crm/doctype/lead/lead.json

| fieldname | label | fieldtype | reqd |
| lead_name | Lead Name | Data | Yes |
| company_name | Company Name | Data | No |
| salutation | Salutation | Link (Salutation) | No |
| email_id | Email Address | Data | No |
| mobile_no | Mobile No | Data | No |
| phone | Phone | Data | No |
| website | Website | Data | No |
| source | Lead Source | Link (Lead Source) | No |
| status | Status | Select (Lead/Open/Replied/Interested/Opportunity/Quotation/Lost/Do Not Contact) | No |
| territory | Territory | Link (Territory) | No |
| industry | Industry | Link (Industry Type) | No |
| customer | Customer | Link (Customer) | No |
| company | Company | Link (Company) | No |

**Convert Lead to Customer:**
POST /api/method/erpnext.crm.doctype.lead.lead.make_customer
Body: {"source_name": "LEAD-0001"}

### 4.3 CONTACTS (reused from Phase 1 - see 1.3)

### 4.4 CRM LINKING
- Opportunity linked to Customer via party_name when opportunity_from = Customer
- Contact linked to Customer via Dynamic Link in Contact.links
- Lead can be converted to Customer
- Opportunity items reference Item doctype
- Sales Team child table shared across Customer, Opportunity, Quotation, Sales Order, Sales Invoice

---

## Phase 5: Frontend Architecture Plan

### Directory Structure (mirrors ERPNext modules)
src/
  modules/
    auth/          Login, session, user
    dashboard/     KPI cards, charts, recent activity
    customers/     Customer list, detail, form; Address, Contact sub-forms
    items/         Item list, detail, form; Item Price
    invoices/      Sales Invoice list, detail, form; GST/QST calc
    payments/      Payment Entry list, detail, form
    quotations/    Quotation list, detail, form; convert to SO
    sales-orders/  Sales Order list, detail, form
    suppliers/     Supplier list, detail, form
    purchases/     Purchase Invoice list, detail, form; Purchase Order
    accounting/    Journal Entry, Bank Account, reports
    expenses/      Expense Claim list, detail, form
    crm/           Opportunity, Lead, Contact
    settings/      Company, Tax templates, Payment terms

### Shared Components (already partially in /components/ui/)
- DataTable: generic table with sort, pagination, search
- PageShell: sidebar + topbar layout
- FormField: label + input wrapper for all field types
- LinkSelect: dropdown populated from API (Link fields)
- ChildTableGrid: inline editable grid for child tables
- DatePicker: date picker
- CurrencyInput: currency formatted input
- AutoComplete: search + select

### Implementation Sequence by Phase

**PHASE 0 (3 days pre-dev):**
1. Map ALL ERPNext 15 doctype fields (done in this doc)
2. Build Frappe API client layer with typed request/response
3. Set up auth flow (login, session refresh, logout)
4. Build DataTable and ChildTableGrid reusable components

**PHASE 1 (Weeks 1-5):**
1. Login page + session management
2. Dashboard: KPI cards fetching from ERPNext counts/aggregates
3. Customer list + detail + form (with Address/Contact integration)
4. Item list + detail + form
5. Sales Invoice list + detail + form (with line items, GST/QST)
6. Payment Entry list + detail + form
7. GST/QST Summary Report

**PHASE 2 (Weeks 6-8):**
1. Quotation list + detail + form (with convert to Sales Order)
2. Sales Order list + detail + form
3. Invoice list filters (date range, status, customer)
4. Payment list with reconciliation view
5. Email send integration

**PHASE 3 (Weeks 9-11):**
1. Supplier list + detail + form
2. Purchase Invoice (Bill) list + detail + form
3. Purchase Order list + detail + form
4. Expense Claim list + detail + form
5. Journal Entry list + detail + form
6. Bank Account list + detail + form
7. GST/QST config (tax templates view)
8. Reports: Sales Register, AR, AP, P&L, Balance Sheet, Inventory

**PHASE 4 (Weeks 12-13):**
1. Lead list + detail + form (with convert to Customer)
2. Opportunity list + detail + form (with convert to Quotation)
3. Contact list + detail + form
4. CRM linkages to Invoice/Customer

**PHASE 5 (Weeks 14-17):**
1. Settings page: Company info, user permissions, tax config
2. Module plugin framework for BlessPOS/Shipping/Eats stubs
3. E2E testing, regression, documentation

### The ERPNext API Client Architecture

`	ypescript
// Core API client
class FrappeClient {
  baseURL: string
  async get(doctype: string, name?: string, params?: any)
  async list(doctype: string, params?: ListParams)
  async create(doctype: string, data: any)
  async update(doctype: string, name: string, data: any)
  async delete(doctype: string, name: string)
  async submit(doctype: string, name: string)
  async cancel(doctype: string, name: string)
  async getOptions(doctype: string, field?: string)
  async runReport(reportName: string, filters?: any)
  async call(method: string, params?: any)
}

// Typed service per doctype (mirrors ERPNext)
class CustomerService extends BaseService<Customer> {
  endpoints = { list, get, create, update, delete, submit }
}
class SalesInvoiceService extends BaseService<SalesInvoice> {
  endpoints = { list, get, create, update, delete, submit, cancel }
}
// etc.
`

### Key Rule: NO custom fields
Every field sent in API requests must match exactly the fieldname from the ERPNext doctype JSON. All Select/Link options must be fetched dynamically from the corresponding doctype (e.g., Customer Group options from /api/resource/Customer Group).
