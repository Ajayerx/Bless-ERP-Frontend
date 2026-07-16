"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface PaymentRow {
  id: string;
  mode_of_payment: string;
  amount: number;
  account?: string;
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200";

const labelClass =
  "block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider";

interface PaymentsTableProps {
  payments: PaymentRow[];
  modes: string[];
  accounts: string[];
  grandTotal?: number;
  readOnly?: boolean;
  onChange: (payments: PaymentRow[]) => void;
}

export default function PaymentsTable({
  payments,
  modes,
  accounts,
  grandTotal,
  readOnly = false,
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

  const updateRow = (id: string, updates: Partial<PaymentRow>) => {
    onChange(payments.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  const removeRow = (id: string) => {
    onChange(payments.filter((r) => r.id !== id));
  };

  const totalPaid = payments.reduce((sum, r) => sum + (r.amount || 0), 0);
  const changeAmount = grandTotal != null ? totalPaid - grandTotal : 0;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                Mode of Payment
              </th>
              <th className="text-right py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                Amount
              </th>
              <th className="text-left py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                Account
              </th>
              {!readOnly && (
                <th className="w-10"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={readOnly ? 3 : 4}
                  className="py-3 text-center text-muted text-xs"
                >
                  No payments added.
                </td>
              </tr>
            ) : (
              payments.map((row) => (
                <tr key={row.id} className="border-b border-gray-50">
                  <td className="py-1.5">
                    {readOnly ? (
                      <span className="text-heading">{row.mode_of_payment}</span>
                    ) : (
                      <select
                        value={row.mode_of_payment}
                        onChange={(e) =>
                          updateRow(row.id, {
                            mode_of_payment: e.target.value,
                          })
                        }
                        className={`${inputClass} text-xs py-1.5`}
                      >
                        <option value="">Select mode</option>
                        {modes.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="py-1.5">
                    {readOnly ? (
                      <span className="text-heading text-right block">
                        {formatCurrency(row.amount)}
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={row.amount || ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            amount: e.target.value
                              ? parseFloat(e.target.value)
                              : 0,
                          })
                        }
                        className={`${inputClass} text-xs py-1.5 text-right`}
                        placeholder="0.00"
                      />
                    )}
                  </td>
                  <td className="py-1.5">
                    {readOnly ? (
                      <span className="text-heading">{row.account || ""}</span>
                    ) : (
                      <select
                        value={row.account ?? ""}
                        onChange={(e) =>
                          updateRow(row.id, {
                            account: e.target.value || undefined,
                          })
                        }
                        className={`${inputClass} text-xs py-1.5`}
                      >
                        <option value="">Select account</option>
                        {accounts.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  {!readOnly && (
                    <td className="py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="p-1.5 text-muted hover:text-danger-600 transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={addRow}
          className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1"
        >
          <Plus size={12} /> Add Payment
        </button>
      )}

      {payments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-border/50">
          <div>
            <label className={labelClass}>Paid Amount</label>
            <input
              type="text"
              value={formatCurrency(totalPaid)}
              className={`${inputClass} bg-gray-50`}
              readOnly
            />
          </div>
          {changeAmount > 0 && (
            <div>
              <label className={labelClass}>Change Amount</label>
              <input
                type="text"
                value={formatCurrency(changeAmount)}
                className={`${inputClass} bg-gray-50`}
                readOnly
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
