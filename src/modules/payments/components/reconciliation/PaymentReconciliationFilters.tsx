import { Input, LinkSearchField, CollapsibleSection } from "@/components/ui"
import { searchLink } from "@/services"
import { validateLink } from "@/services/frappe-client"
import type { PaymentReconciliationWorkspace } from "../../types"

const PARTY_TYPES = ["Customer", "Employee", "Shareholder", "Supplier"]

// frappe.boot.party_account_types — the account_type each party doctype books
// to (built from the `tabParty Type` rows: Customer → Receivable, the rest → Payable).
const PARTY_ACCOUNT_TYPES: Record<string, string> = {
  Customer: "Receivable",
  Supplier: "Payable",
  Employee: "Payable",
  Shareholder: "Payable",
}

// ERPNext payment_reconciliation.js party() link handler re-invokes validate_link
// on the resolved doctype/name — LinkSearchField's validate prop does the same.
const validateLinkValue = (doctype: string, value: string) => validateLink(doctype, value)

interface Props {
  doc: PaymentReconciliationWorkspace
  onChange: (patch: Partial<PaymentReconciliationWorkspace>) => void
  onPartyTypeChange: (value: string) => void
  onPartyChange: (party: string) => void
}

// Visibility mirrors the Payment Reconciliation DocType's depends_on:
//   company:                       always (defaulted onload from Global Defaults)
//   party_type:                    always
//   party:                         eval:doc.party_type
//   receivable_payable_account:    eval:doc.company && doc.party
//   default_advance_account:       eval:doc.party
//   "Filters" section:             eval:doc.receivable_payable_account
//   "Accounting Dimensions Filter":eval:doc.receivable_payable_account
// invoice_name / payment_name live next to the "Invoices" / "Payments" tables
// on the PaymentReconciliation page (those sections render once entries exist).
//
// Field types match the bench JSON: Company/Party Type/Party/accounts are Link
// controls. Party Type searches the DocType doctype (filters = the reconcilable
// party doctypes); Party is a Dynamic Link onto the selected party_type.
export default function PaymentReconciliationFilters({
  doc,
  onChange,
  onPartyTypeChange,
  onPartyChange,
}: Props) {
  const hasAccount = Boolean(doc.receivable_payable_account)

  const partyTypeSearch = (query: string) =>
    searchLink("DocType", query, "Payment Reconciliation", [
      ["name", "in", PARTY_TYPES],
    ]).then((items) => ({ items }))

  const companySearch = (query: string) =>
    searchLink("Company", query, "Payment Reconciliation").then((items) => ({ items }))

  const partySearch = (query: string) =>
    doc.party_type
      ? searchLink(doc.party_type, query, "Payment Reconciliation").then((items) => ({ items }))
      : Promise.resolve({ items: [] })

  // Account lookups replicate the Payment Reconciliation DocType set_query
  // (erpnext/accounts/doctype/payment_reconciliation/payment_reconciliation.js):
  //   receivable_payable_account: company, is_group=0,
  //     account_type = frappe.boot.party_account_types[party_type],
  //     root_type = Customer ? "Asset" : "Liability"
  //   default_advance_account: company, is_group=0,
  //     account_type = Customer ? "Receivable" : "Payable",
  //     root_type = Customer ? "Liability" : "Asset"
  //   bank_cash_account: company, is_group=0,
  //     account_type = ["in", ["Bank", "Cash"]]
  const partyAccountType = PARTY_ACCOUNT_TYPES[doc.party_type] ?? "Payable"
  const isCustomer = doc.party_type === "Customer"

  const receivablePayableAccountSearch = (query: string) =>
    searchLink("Account", query, "Payment Reconciliation", {
      company: doc.company,
      is_group: 0,
      account_type: partyAccountType,
      root_type: isCustomer ? "Asset" : "Liability",
    }).then((items) => ({ items }))

  const defaultAdvanceAccountSearch = (query: string) =>
    searchLink("Account", query, "Payment Reconciliation", {
      company: doc.company,
      is_group: 0,
      account_type: isCustomer ? "Receivable" : "Payable",
      root_type: isCustomer ? "Liability" : "Asset",
    }).then((items) => ({ items }))

  const bankCashAccountSearch = (query: string) =>
    searchLink("Account", query, "Payment Reconciliation", {
      company: doc.company,
      is_group: 0,
      account_type: ["in", ["Bank", "Cash"]],
    }).then((items) => ({ items }))

  const costCenterSearch = (query: string) =>
    searchLink("Cost Center", query, "Payment Reconciliation", {
      company: doc.company,
      is_group: 0,
    }).then((items) => ({ items }))

  const projectSearch = (query: string) =>
    searchLink("Project", query, "Payment Reconciliation").then((items) => ({ items }))

  const money = (n: number) => n.toFixed(2)

  return (
    <div className="space-y-6">
      {/* Top fields mirror the Payment Reconciliation DocType column_break_4:
          left column = Company, Party Type (stacked); right column = Party,
          Receivable / Payable Account, Default Advance Account. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-column="1" className="space-y-4">
          <LinkSearchField
            id="recon-company"
            label="Company"
            placeholder="Select Company"
            required
            value={doc.company}
            searchFn={companySearch}
            validate={(value) => validateLinkValue("Company", value)}
            onChange={(value) => onChange({ company: value ?? "" })}
          />

          <LinkSearchField
            id="recon-party-type"
            label="Party Type"
            placeholder="Select Party Type"
            required
            value={doc.party_type}
            searchFn={partyTypeSearch}
            validate={(value) => validateLinkValue("DocType", value)}
            onChange={(value) => onPartyTypeChange(value ?? "")}
          />
        </div>

        <div data-column="2" className="space-y-4">
          {/* party: depends_on doc.party_type */}
          {doc.party_type && (
            <LinkSearchField
              id="recon-party"
              label="Party"
              placeholder="Select Party"
              required
              value={doc.party}
              searchFn={partySearch}
              validate={(value) => validateLinkValue(doc.party_type, value)}
              onChange={(value) => onPartyChange(value ?? "")}
            />
          )}

          {/* receivable_payable_account: depends_on doc.company && doc.party */}
          {doc.company && doc.party && (
            <LinkSearchField
              id="recon-receivable-payable-account"
              label="Receivable / Payable Account"
              placeholder="Select Account"
              required
              value={doc.receivable_payable_account}
              searchFn={receivablePayableAccountSearch}
              validate={(value) => validateLinkValue("Account", value)}
              onChange={(value) => onChange({ receivable_payable_account: value ?? "" })}
            />
          )}

          {/* default_advance_account: depends_on doc.party */}
          {doc.party && (
            <LinkSearchField
              id="recon-default-advance-account"
              label="Default Advance Account"
              placeholder="Select Account"
              value={doc.default_advance_account ?? ""}
              searchFn={defaultAdvanceAccountSearch}
              validate={(value) => validateLinkValue("Account", value)}
              onChange={(value) => onChange({ default_advance_account: value ?? "" })}
            />
          )}
        </div>
      </div>

      {/* Filters section: depends_on receivable_payable_account */}
      {hasAccount && (
        <CollapsibleSection title="Filters" defaultOpen>
          {/* The Payment Reconciliation DocType renders the Filters fields in
              three columns (col_break1 / column_break_11 / column_break_13):
                From Invoice Date · To Invoice Date · Invoice Limit
                From Payment Date · To Payment Date · Payment Limit
                Minimum Invoice Amount · Maximum Invoice Amount · Bank / Cash Account
                Minimum Payment Amount · Maximum Payment Amount */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              id="recon-from-invoice-date"
              label="From Invoice Date"
              type="date"
              value={doc.from_invoice_date}
              onChange={(e) => onChange({ from_invoice_date: e.target.value })}
            />
            <Input
              id="recon-to-invoice-date"
              label="To Invoice Date"
              type="date"
              value={doc.to_invoice_date}
              onChange={(e) => onChange({ to_invoice_date: e.target.value })}
            />
            <Input
              id="recon-invoice-limit"
              label="Invoice Limit"
              type="number"
              value={String(doc.invoice_limit)}
              onChange={(e) => onChange({ invoice_limit: Number(e.target.value || 0) })}
              helperText="System will fetch all the entries if limit value is zero."
            />
            <Input
              id="recon-from-posting-date"
              label="From Payment Date"
              type="date"
              value={doc.from_posting_date}
              onChange={(e) => onChange({ from_posting_date: e.target.value })}
            />
            <Input
              id="recon-to-posting-date"
              label="To Payment Date"
              type="date"
              value={doc.to_posting_date}
              onChange={(e) => onChange({ to_posting_date: e.target.value })}
            />
            <Input
              id="recon-payment-limit"
              label="Payment Limit"
              type="number"
              value={String(doc.payment_limit)}
              onChange={(e) => onChange({ payment_limit: Number(e.target.value || 0) })}
              helperText="System will fetch all the entries if limit value is zero."
            />
            <Input
              id="recon-min-invoice-amount"
              label="Minimum Invoice Amount"
              type="number"
              value={money(doc.min_invoice_amount)}
              onChange={(e) => onChange({ min_invoice_amount: Number(e.target.value || 0) })}
            />
            <Input
              id="recon-max-invoice-amount"
              label="Maximum Invoice Amount"
              type="number"
              value={money(doc.max_invoice_amount)}
              onChange={(e) => onChange({ max_invoice_amount: Number(e.target.value || 0) })}
            />
            <div>
              <LinkSearchField
                id="recon-bank-cash-account"
                label="Bank / Cash Account"
                placeholder="Select Account"
                value={doc.bank_cash_account ?? ""}
                searchFn={bankCashAccountSearch}
                validate={(value) => validateLinkValue("Account", value)}
                onChange={(value) => onChange({ bank_cash_account: value ?? "" })}
              />
              <p className="mt-1.5 text-xs text-muted">
                This filter will be applied to Journal Entry.
              </p>
            </div>
            <Input
              id="recon-min-payment-amount"
              label="Minimum Payment Amount"
              type="number"
              value={money(doc.min_payment_amount)}
              onChange={(e) => onChange({ min_payment_amount: Number(e.target.value || 0) })}
            />
            <Input
              id="recon-max-payment-amount"
              label="Maximum Payment Amount"
              type="number"
              value={money(doc.max_payment_amount)}
              onChange={(e) => onChange({ max_payment_amount: Number(e.target.value || 0) })}
            />
          </div>
        </CollapsibleSection>
      )}

      {/* Accounting Dimensions Filter: depends_on receivable_payable_account */}
      {hasAccount && (
        <CollapsibleSection title="Accounting Dimensions Filter" defaultOpen>
          <div className="grid grid-cols-2 gap-4">
            <LinkSearchField
              id="recon-cost-center"
              label="Cost Center"
              placeholder="Select Cost Center"
              value={doc.cost_center ?? ""}
              searchFn={costCenterSearch}
              validate={(value) => validateLinkValue("Cost Center", value)}
              onChange={(value) => onChange({ cost_center: value ?? "" })}
            />
            <LinkSearchField
              id="recon-project"
              label="Project"
              placeholder="Select Project"
              value={doc.project ?? ""}
              searchFn={projectSearch}
              validate={(value) => validateLinkValue("Project", value)}
              onChange={(value) => onChange({ project: value ?? "" })}
            />
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}