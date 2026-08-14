"use client";

import { formatCurrency } from "@/lib/utils";
import { invoiceService } from "../services";
import ChildTableGrid, { type GridColumn } from "@/components/ui/ChildTableGrid";

export interface PaymentRow {
  id: string;
  mode_of_payment: string;
  amount: number;
  account?: string;
}

const labelClass =
  "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider";

interface PaymentsTableProps {
  payments: PaymentRow[];
  grandTotal?: number;
  readOnly?: boolean;
  company?: string;
  onChange: (payments: PaymentRow[]) => void;
}

export default function PaymentsTable({
  payments,
  grandTotal,
  readOnly = false,
  company,
  onChange,
}: PaymentsTableProps) {
  const addRow = () => {
    onChange([
      ...payments,
      {
        id: crypto.randomUUID(),
        mode_of_payment: "",
        amount: grandTotal ?? 0,
        account: "",
      },
    ]);
  };

  const handleRowsChange = (rows: PaymentRow[]) => {
    if (readOnly) return;
    if (rows.length > payments.length) {
      addRow();
      return;
    }
    onChange(rows);
    rows.forEach((row, i) => {
      const old = payments[i];
      if (
        old &&
        row.mode_of_payment !== old.mode_of_payment &&
        row.mode_of_payment &&
        company
      ) {
        invoiceService.getBankCashAccount(row.mode_of_payment, company).then((acc) => {
          if (acc) {
            const withAccount = rows.map((r, j) =>
              j === i ? { ...r, account: acc } : r
            );
            onChange(withAccount);
          }
        });
      }
    });
  };

  const totalPaid = payments.reduce((sum, r) => sum + (r.amount || 0), 0);  const changeAmount = grandTotal != null ? totalPaid - grandTotal : 0;

  const columns: GridColumn<PaymentRow>[] = [
    {
      key: "mode_of_payment",
      label: "Mode of Payment",
      type: "link",
      searchFn: (q) => invoiceService.searchModesOfPayment(q),
      placeholder: "Select mode",
      weight: 1.4,
    },
    {
      key: "amount",
      label: "Amount",
      type: "number",
      align: "right",
      weight: 1,
      placeholder: "0.00",
    },
    {
      key: "account",
      label: "Account",
      type: "link",
      searchFn: (q) => invoiceService.searchAccounts(q),
      placeholder: "Select account",
      weight: 1.4,
    },
  ];

  return (
    <div className="space-y-3">
      <ChildTableGrid<PaymentRow>
        title="Payments"
        titleClassName="text-xs font-semibold text-muted"
        rows={payments}
        columns={columns}
        emptyRow={{
          id: crypto.randomUUID(),
          mode_of_payment: "",
          amount: grandTotal ?? 0,
          account: "",
        }}
        onChange={handleRowsChange}
        readOnly={readOnly}
        testId="payments_grid"
        minWidth="560px"
      />

      {payments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-border/50">
          <div>
            <label className={labelClass}>Paid Amount</label>
            <input
              type="text"
              value={formatCurrency(totalPaid)}
              className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 bg-gray-50"
              readOnly
            />
          </div>
          {changeAmount > 0 && (
            <div>
              <label className={labelClass}>Change Amount</label>
              <input
                type="text"
                value={formatCurrency(changeAmount)}
                className="w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 bg-gray-50"
                readOnly
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
