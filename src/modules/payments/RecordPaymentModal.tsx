import { useState, useEffect, useCallback } from "react";
import { Save, Loader2, Search, ChevronDown } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { paymentService, type Invoice } from "../../services";
import { cn } from "@/lib/utils";
import PaymentMethodSelect, { type PaymentMethodValue } from "./PaymentMethodSelect";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(n);
}

interface RecordPaymentModalProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onRecorded: () => void;
}

export default function RecordPaymentModal({
  open,
  onClose,
  invoice,
  onRecorded,
}: RecordPaymentModalProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(invoice);
  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceDropdownOpen, setInvoiceDropdownOpen] = useState(false);

  const [amount, setAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethodValue>("bank_transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchUnpaidInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const result = await paymentService.getUnpaidInvoices();
      setUnpaidInvoices(result);
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (open && !invoice) {
      fetchUnpaidInvoices();
    }
  }, [open, invoice, fetchUnpaidInvoices]);

  useEffect(() => {
    setSelectedInvoice(invoice);
  }, [invoice]);

  useEffect(() => {
    if (selectedInvoice) {
      setAmount(selectedInvoice.total);
    }
  }, [selectedInvoice]);

  const filteredInvoices = unpaidInvoices.filter(
    (inv) =>
      inv.number.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(invoiceSearch.toLowerCase()),
  );

  const selectInvoice = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setInvoiceSearch(inv.number);
    setInvoiceDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!selectedInvoice) {
      setError("Please select an invoice.");
      return;
    }
    if (amount <= 0) {
      setError("Payment amount must be greater than zero.");
      return;
    }
    if (amount > selectedInvoice.total) {
      setError("Amount cannot exceed the invoice total.");
      return;
    }
    setSaving(true);
    try {
      await paymentService.record({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.number,
        customerName: selectedInvoice.customerName,
        amount,
        paymentDate,
        paymentMethod,
        reference,
        notes,
      });
      onRecorded();
    } catch {
      setError("Failed to record payment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200";

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Invoice selector — shown when no invoice is preselected */}
        {!invoice && (
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Select Invoice *
            </label>
            <div className="relative">
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => {
                  setInvoiceSearch(e.target.value);
                  setInvoiceDropdownOpen(true);
                }}
                onFocus={() => setInvoiceDropdownOpen(true)}
                placeholder="Search unpaid invoices..."
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <ChevronDown size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted" />
              {invoiceDropdownOpen && (
                <div className="absolute z-10 mt-1.5 w-full bg-surface border border-border rounded-[14px] shadow-xl max-h-48 overflow-y-auto">
                  {loadingInvoices ? (
                    <p className="px-4 py-3 text-sm text-muted">Loading...</p>
                  ) : filteredInvoices.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">No unpaid invoices found</p>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => selectInvoice(inv)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-sm transition-colors",
                          inv.id === selectedInvoice?.id
                            ? "bg-primary-50 text-primary-700 font-semibold"
                            : "text-body hover:bg-gray-50",
                        )}
                      >
                        <span className="font-medium">{inv.number}</span>
                        <span className="text-xs text-muted ml-2">{inv.customerName}</span>
                        <span className="float-right font-semibold tabular-nums">
                          {formatCurrency(inv.total)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invoice info — shown when invoice is selected/preselected */}
        {selectedInvoice && (
          <div className="bg-gray-50 rounded-[12px] px-4 py-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Invoice</span>
              <span className="font-semibold text-heading">{selectedInvoice.number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Customer</span>
              <span className="font-semibold text-heading">
                {selectedInvoice.customerName}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Amount Due</span>
              <span className="font-bold text-heading">
                {formatCurrency(selectedInvoice.total)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 px-3 py-2.5 rounded-[10px]">
            {error}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Payment Amount *
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-sm">
              $
            </span>
            <input
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className={`${inputClass} pl-7`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
              Method
            </label>
            <PaymentMethodSelect
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as PaymentMethodValue)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Reference #
          </label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={inputClass}
            placeholder="Check number, wire ref, etc."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-muted mb-1.5 uppercase tracking-wider">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="Optional notes..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-muted bg-surface border border-border rounded-[12px] hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !selectedInvoice}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-[12px] hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Recording..." : "Record Payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
