import { useEffect, useState } from "react"
import Modal, { ModalFooter } from "@/components/ui/Modal"
import { Button, Input } from "@/components/ui"
import { formatCurrency } from "@/lib/utils"
import type { ReconAllocationRow } from "../../types"

export interface DifferenceRow {
  index: number
  posting_date: string
  invoice_number: string
  difference_account: string
  difference_amount: number
}

interface Props {
  open: boolean
  rows: ReconAllocationRow[]
  onClose: () => void
  onConfirm: (updates: Array<{ index: number; difference_account: string; gain_loss_posting_date: string }>) => void
  currency: string
}

export default function DifferenceAccountDialog({ open, rows, onClose, onConfirm, currency }: Props) {
  const [entries, setEntries] = useState<DifferenceRow[]>([])

  useEffect(() => {
    if (!open) return
    setEntries(
      rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => Number(row.difference_amount) !== 0)
        .map(({ row, index }) => ({
          index,
          posting_date: row.gain_loss_posting_date || row.posting_date,
          invoice_number: row.invoice_number,
          difference_account: row.difference_account,
          difference_amount: row.difference_amount,
        }))
    )
  }, [open, rows])

  const update = (index: number, patch: Partial<DifferenceRow>) => {
    setEntries((prev) => prev.map((e) => (e.index === index ? { ...e, ...patch } : e)))
  }

  return (
    <Modal open={open} onClose={onClose} title="Reconcile Entries" size="xl">
      <div className="space-y-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead>
              <tr className="bg-gray-50/50">
                {["Voucher No", "Posting Date", "Difference Account", "Difference Amount"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold text-muted uppercase tracking-wider ${
                      h === "Difference Amount" ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {entries.map((entry) => (
                <tr key={entry.index}>
                  <td className="px-4 py-3 font-medium text-heading">{entry.invoice_number}</td>
                  <td className="px-4 py-3">
                    <Input
                      type="date"
                      aria-label={`Reconcile posting date for ${entry.invoice_number}`}
                      value={entry.posting_date}
                      onChange={(e) => update(entry.index, { posting_date: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      aria-label={`Reconcile difference account for ${entry.invoice_number}`}
                      placeholder="Select Difference Account"
                      value={entry.difference_account}
                      onChange={(e) => update(entry.index, { difference_account: e.target.value })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right text-body">
                    {formatCurrency(entry.difference_amount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-muted">
          New Journal Entry will be posted for the difference amount to reconcile the entries.
        </p>

        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm(
                entries.map((e) => ({
                  index: e.index,
                  difference_account: e.difference_account,
                  gain_loss_posting_date: e.posting_date,
                }))
              )
            }
          >
            Reconcile Entries
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}