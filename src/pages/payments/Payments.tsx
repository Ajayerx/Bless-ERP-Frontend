"use client";

import { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  DollarSign,
  FileText,
  CheckCircle2,
  BadgeCheck,
} from "lucide-react";
import Topbar from "@/components/layout/Topbar";
import { Button, Badge, Card, CardContent } from "@/components/ui";
import RecordPaymentModal from "@/modules/payments/RecordPaymentModal";
import PaymentTable from "@/modules/payments/PaymentTable";
import {
  paymentService,
  type Invoice,
  type PaymentListResponse,
} from "@/services";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export default function Payments() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedInvoiceId = searchParams.get("invoice");

  const [unpaidInvoices, setUnpaidInvoices] = useState<Invoice[]>([]);
  const [paymentsData, setPaymentsData] = useState<PaymentListResponse | null>(
    null,
  );
  const [loadingUnpaid, setLoadingUnpaid] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [paymentPage, setPaymentPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingUnpaid(true);
    setLoadingPayments(true);
    try {
      const [unpaid, paid] = await Promise.all([
        paymentService.getUnpaidInvoices(),
        paymentService.list({ page: paymentPage, pageSize: 10 }),
      ]);
      setUnpaidInvoices(unpaid);
      setPaymentsData(paid);

      if (preselectedInvoiceId) {
        const match = unpaid.find((inv) => inv.id === preselectedInvoiceId);
        if (match) {
          setSelectedInvoice(match);
          setModalOpen(true);
        }
      }
    } finally {
      setLoadingUnpaid(false);
      setLoadingPayments(false);
    }
  }, [paymentPage, preselectedInvoiceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecordPayment = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setModalOpen(false);
    setSelectedInvoice(null);
    fetchData();
  };

  const overdueCount = unpaidInvoices.filter(
    (inv) => inv.status === "overdue",
  ).length;

  return (
    <>
      <Topbar />
      <motion.div
        className="p-6 space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-heading">Payments</h1>
            <p className="text-sm text-muted mt-1">
              Record payments and view payment history.
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <DollarSign size={16} />
            Record Payment
          </Button>
        </div>

        <PaymentTable
          paymentsData={paymentsData}
          loading={loadingPayments}
          page={paymentPage}
          onPageChange={setPaymentPage}
          onRowClick={(payment) => navigate(`/payments/${payment.id}`)}
        />

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-heading">
              Unpaid Invoices
            </h2>
            {unpaidInvoices.length > 0 && (
              <Badge variant="warning">{unpaidInvoices.length} pending</Badge>
            )}
          </div>

          {loadingUnpaid ? (
            <div className="bg-surface rounded-[16px] border border-border shadow-card p-8">
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-[12px]" />
                ))}
              </div>
            </div>
          ) : unpaidInvoices.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-12 h-12 rounded-[14px] bg-success-50 text-success-600 flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck size={24} />
                </div>
                <p className="font-semibold text-heading">All caught up!</p>
                <p className="text-sm text-muted mt-1">
                  No unpaid invoices at this time.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead>
                    <tr className="bg-gray-50/50">
                      {["Invoice", "Date", "Due", "Amount", "Status", ""].map(
                        (h) => (
                          <th
                            key={h}
                            className={cn(
                              "px-6 py-3.5 text-xs font-semibold text-muted uppercase tracking-wider",
                              h === "Amount" || h === ""
                                ? "text-right"
                                : "text-left",
                              h === "Date" && "hidden lg:table-cell",
                            )}
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {unpaidInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-[10px] bg-warning-50 text-warning-600 flex items-center justify-center shrink-0">
                              <FileText size={16} />
                            </div>
                            <div>
                              <p className="font-semibold text-heading">
                                {inv.number}
                              </p>
                              <p className="text-xs text-muted">
                                {inv.customerName}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted hidden lg:table-cell">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={cn(
                              "text-sm",
                              inv.status === "overdue"
                                ? "text-danger-600 font-semibold"
                                : "text-muted",
                            )}
                          >
                            {formatDate(inv.dueDate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold tabular-nums text-heading">
                          {formatCurrency(inv.total)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              inv.status === "overdue" ? "danger" : "info"
                            }
                          >
                            {inv.status.charAt(0).toUpperCase() +
                              inv.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleRecordPayment(inv)}
                          >
                            <DollarSign size={13} />
                            Record Payment
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </motion.div>

      {modalOpen && (
        <RecordPaymentModal
          open={modalOpen}
          invoice={selectedInvoice}
          onClose={() => {
            setModalOpen(false);
            setSelectedInvoice(null);
          }}
          onRecorded={handlePaymentSuccess}
        />
      )}
    </>
  );
}
