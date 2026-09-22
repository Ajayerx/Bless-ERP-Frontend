# Reconciliation Plan — Payment Reconciliation + Bank Reconciliation (ERPNext 15-exact)

Both features go into the SPA, mock-first (MOCK_MODE), following the existing `payments`/`journal_entries`/`bank_accounts` module pattern (pages / components / services / types / `__tests__`), with `run_doc_method` + `/api/method/...` MSW handlers.

Source of truth (bench at `C:\Sarthak\Blesserp\frappe-bench`, ERPNext v15.115.0):
- `erpnext/accounts/doctype/payment_reconciliation/` (`payment_reconciliation.py` / `.js` / child doctypes)
- `erpnext/accounts/doctype/bank_reconciliation_tool/` (`bank_reconciliation_tool.py` / `.js`) + `erpnext/public/js/bank_reconciliation_tool/` (`data_table_manager.js`, `dialog_manager.js`, `number_card.js`)
- `erpnext/accounts/doctype/bank_transaction/` (`.py` / `.js` / `.list.js`, `auto_match_party.py`, `bank_transaction_upload.py`)
- `erpnext/accounts/doctype/bank_statement_import/`
- `erpnext/accounts/report/bank_reconciliation_statement/`

Workspace placement in ERPNext:
- Payment Reconciliation is linked from the **Receivables** (`receivables.json:77`) and **Payables** (`payables.json:78`) workspaces; doctype URL `/app/payment-reconciliation`.
- Bank Reconciliation Tool + Bank Reconciliation Statement + Bank/Bank Account are in the Accounting module's **Banking** section (`accounting.json:273-345`).

---

## Part 1 — Payment Reconciliation workspace (mirrors `/app/payment-reconciliation`)

### Route
`payments/reconciliation` → page `src/modules/payments/pages/PaymentReconciliation.tsx`. Payment list page gets a "Payment Reconciliation" quick action linking here.

### Services (new `src/modules/payments/services/reconciliation.ts`)
Reuse `apiClientWithBody`, `postMethod`, `runDocMethod` patterns from `src/modules/payments/services/index.ts`.

- `getUnreconciledEntries(workspace)` → `run_doc_method` on `Payment Reconciliation`, method `get_unreconciled_entries`; returns workspace with `payments[]` + `invoices[]`.
- `allocateReconciliationEntries(workspace, payments, invoices)` → method `allocate_entries`; returns workspace with `allocation[]` (ERPNext waterfall: allocate payments → invoices up to outstanding, remainder bounces to next invoice, `difference_amount` per row).
- `reconcileWorkspace(workspace)` → method `reconcile` (validates then re-pulls entries, "Successfully Reconciled").
- `calculateReconDifference(workspace, paymentEntry, invoice, allocatedAmount)` → method `calculate_difference_on_allocation_change` → number.
- `isAutoReconcileEnabled()` → method `is_auto_process_enabled`.
- `getPartyReconciliationAccount(company, partyType, party)` → `erpnext.accounts.party.get_party_account` (include_advance=1): returns `account` string or `[receivable, advance]` pair → auto-fills Receivable/Payable Account + Default Advance Account (mirrors `payment_reconciliation.js:184`).
- `getDimensionFilters(company)` → `payment_reconciliation.get_queries_for_dimension_filters`.
- `isReconciliationJobRunning(filters)` → `process_payment_reconciliation.is_any_doc_running` (only when auto-reconcile on) → yellow banner "Payment Reconciliation Job: X is running for this party. Can't reconcile now."

### UI (mirror the desk form `payment_reconciliation.js`)
- `PaymentReconciliationFilters.tsx`: Company, Party Type (party account types), Party (clears child tables + auto-fetch account), Receivable/Payable Account (query: company, is_group 0, account_type per party, root_type Asset/Liability), Default Advance Account, Bank/Cash Account, Cost Center, accounting-dimension fields; Payment section (from/to payment date, min/max payment amount, payment_name, limit 50) and Invoice section (from/to invoice date, min/max amount, invoice_name, limit 50).
- `ReconPaymentTable.tsx` (checkbox-selectable; columns Reference Type, Reference Name→link, Posting Date, Amount, Difference, Cost Center) and `ReconInvoiceTable.tsx` (Invoice Type, Invoice Number→link, Invoice Date, Amount, Outstanding Amount).
- Buttons with ERPNext visibility rules (`refresh()`): "Get Unreconciled Entries" primary when account set; "Allocate" primary when both tables populated; "Reconcile" primary when allocation rows exist. Empty-state throws verbatim: "No Unreconciled Invoices and Payments found for this party and account", "No Outstanding Invoices found for this party", "No Unreconciled Payments found for this party".
- `ReconAllocationTable.tsx`: editable `allocated_amount` (triggers `calculate_difference_on_allocation_change` → updates `difference_amount`), read-only Difference Amount / Exchange Rate; Difference Account + Gain/Loss Posting Date per row.
- `DifferenceAccountDialog.tsx`: port of the desk `reconcile()` dialog — when any allocation row has `difference_amount` ≠ 0, opens table of (Voucher No, Posting Date editable, Difference Account reqd link, Difference Amount read-only) + note "New Journal Entry will be posted for the difference amount...", "Reconcile Entries" primary. Otherwise `reconcile` runs directly.
- After reconcile: refresh tables + "Successfully Reconciled" message.

### Mocks
`src/mocks/handlers/reconciliation.ts`: in-memory workspace fixture store — Company BlessERP Inc, parties (Acme Corp, Aurora Traders, suppliers), open Sales/Purchase Invoices with `outstanding_amount`, unallocated Payment Entries + JV rows; implements the 4 `run_doc_method` methods + `get_party_account` + `is_any_doc_running`; `allocate_entries` repeats the real waterfall; `reconcile` zeroes outstanding in the fixture store (second pull excludes them) and returns a truthy doc. Register in `src/mocks/handlers/index.ts`.

### Tests
`PaymentsReconciliation.test.tsx`: mandatory-field throws, auto party-account fetch, Get Unreconciled Entries populates tables, Allocate produces correct waterfall + difference calc, Difference dialog only when FX rows exist, Reconcile → success + tables refresh, running-job banner.

---

## Part 2 — Bank Reconciliation (mirrors Accounting → Banking)

### 2a. Bank Reconciliation Tool — route `bank-reconciliation`
Page `src/modules/bank_reconciliation/pages/BankReconciliationTool.tsx`, reuse `bank_accounts` module services for the Bank Account select (query: `is_company_account: 1`).

Services (`src/modules/bank_reconciliation/services/index.ts`):
- `getBankTransactions(bank_account, from, to)` → `bank_reconciliation_tool.get_bank_transactions`.
- `getAccountBalance(bank_account, till_date, company)` → `...get_account_balance`.
- `getLinkedPayments(bank_transaction_name, document_types, dates…)` → `...get_linked_payments` (ranks matches; `subtract_allocations`).
- `reconcileVouchers(bank_transaction_name, vouchers)` → `...reconcile_vouchers` → updated transaction.
- `createPaymentEntryFromBankTransaction(...)` / `createJournalEntryFromBankTransaction(...)` → `...create_payment_entry_bts` / `...create_journal_entry_bts` (+ `allow_edit: true` variant that routes to `/payments/new?from=bt` / journal entry edit).
- `updateBankTransaction(name, ref_no, party_type, party)` → `...update_bank_transaction`.
- `autoReconcileVouchers(bank_account, dates…)` → `...auto_reconcile_vouchers` ("Auto Reconciliation has started in the background" when >10 txs; else synchronous result).
- `getReconcilableDoctypes()` → `bank_transaction.get_doctypes_for_bank_reconciliation`.

UI mirrors `bank_reconciliation_tool.js` / `data_table_manager.js` / `number_card.js`:
- Header: Company, Bank Account, From/To dates (default last 1 month → today), `filter_by_reference_date` toggling statement dates vs reference dates, `bank_statement_closing_balance` input.
- Buttons: **Upload Bank Statement** (→ 2c), **Auto Reconcile**, **Get Unreconciled Entries** (primary).
- Three number cards (`NumberCards.tsx`): Closing Balance as per Bank Statement / as per ERP (`get_account_balance` till to_date) / Difference (red when ≠ 0).
- `BankTransactionsTable.tsx` columns exactly: Date, Party Type, Party, Description, Deposit (green), Withdrawal (red), Unallocated Amount (blue), Reference Number, **Actions** button per row; "No Matching Bank Transactions Found" empty state; row removed/refreshed after reconcile (mirrors `update_dt_cards`).

`ReconcileBankTransactionDialog.tsx` — port of `dialog_manager.js`:
- Action select: **Match Against Voucher** / **Create Voucher** / **Update Bank Transaction**.
- Match: checkboxes from `get_doctypes_for_bank_reconciliation` (Payment Entry, Journal Entry, Sales Invoice, Purchase Invoice, Bank Transaction…), "Show Only Exact Amount" toggle + Bank Transaction toggle; proposal datatable (Doc Type, Doc Name→link, Reference Date, Remaining, Reference №, Party) with checkbox select, "No Matching Vouchers Found"; selected rows → `reconcile_vouchers`; alert "Bank Transaction {name} Matched", cards update.
- Create: Document Type (Payment Entry / Journal Entry). PE fields: Ref №, Posting Date, Cheque/Ref Date, Mode of Payment, Party Type/Party (mandatory), Company Bank Account, Project, Cost Center, "Edit in Full Page". JE fields: Ref №, Posting Date, Cheque/Ref Date, Mode of Payment, Journal Entry Type (full option list), Account (second account; mandatory + party when Receivable/Payable); → `create_payment_entry_bts` / `create_journal_entry_bts`.
- Update: edit Reference Number, Party Type, Party on the Bank Transaction → `update_bank_transaction`.
- Read-only transaction-header strip: Date, Deposit, Withdrawal, Description, Allocated/Unallocated Amount, Currency.

### 2b. Bank Transaction module — list + detail
- New `src/modules/bank_transactions/` module: list route `bank-transactions` (filters: Status, Bank Account; columns Date, Description, Deposit, Withdrawal, Unallocated Amount, Bank Account; status indicators green "Reconciled" / orange "Unreconciled" / red "Cancelled" per `bank_transaction_list.js`) and detail route `bank-transactions/:id`.
- Detail form mirrors `bank_transaction.js` + form JSON: Date, Status, Bank Account, Company, Currency, Description, Deposit/Withdrawal, Reference Number, Transaction ID/Type, allocated/unallocated amounts, party section (Party Type/Party + bank_party_name / account number / IBAN), extended statement fee fields; payment_entries child table; **Unreconcile Transaction** button when `payment_entries.length > 0` (→ `run_doc_method` `remove_payment_entries`), plus **Reconcile** button launching the same Reconcile dialog.
- Services: `/resource/Bank Transaction` GET/list/POST/PUT + `run_doc_method` `remove_payment_entries`.

### 2c. Bank Statement Upload wizard — route `bank-reconciliation/import`
Port of `bank_statement_import` (`upload_bank_statement`, `get_header_mapping`, `get_bank_mapping`, `create_bank_entries`): CSV upload → header-mapping screen (Date, Description, Deposit, Withdrawal, Reference Number, Party, etc.) → preview grid → **Import** creates Bank Transactions (mocked) and returns to the tool with a refreshed list. Save per-bank mapping.

### 2d. Bank Reconciliation Statement report — route `reports/bank-reconciliation`
New report modeled on `bank_reconciliation_statement` under `src/modules/reports/pages/BankReconciliationStatement.tsx`: filters (Bank Account/Company/date range), GL-derived table (Ref, Posting Date, Cheque Date/№, Debit, Credit, Clearance Date) + "Amounts not reflected in system" (unmatched Bank Transaction deposits/withdrawals) → reconciliation totals, mirroring `get_entries` / `get_amounts_not_reflected_in_system`. Wire into the reports nav.

---

## Cross-cutting
- **Routes** added to `src/App.tsx`: `payments/reconciliation`, `bank-reconciliation`, `bank-reconciliation/import`, `bank-transactions`, `bank-transactions/:id`, `reports/bank-reconciliation` + nav entries in AppLayout/sidebar.
- **Types** added to each module's `types/index.ts`.
- **Verification**: `npx tsc -b --force` exit 0; `npm run lint` (only pre-existing warnings); targeted jest suites; existing PaymentForm tests must stay green.

## Implementation order
1. Part 1 (Payment Reconciliation): services → mock handler → components/page → route/nav → tests.
2. Part 2a/2b (Bank Reconciliation tool + Bank Transaction module): services → mock handler (transaction fixtures, balance calc, matching/rank, voucher reconcile creating linked PE/JE fixtures) → components/page/dialogs → routes/nav → tests.
3. 2c (import wizard) + 2d (report) → tests.

## Shared mock state
One in-memory "ledger" fixture store `src/mocks/data/reconciliation.ts` reused by both tools so cross-page consistency holds (reconciling a bank transaction creates linked Payment Entry/Journal Entry fixtures; Payment Reconciliation pulls the same outstanding balances).