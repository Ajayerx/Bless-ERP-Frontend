import type { InvoiceAllocation } from "../types"

export interface AllocateReferencesInput {
  paymentType: string
  partyType: string
  references: InvoiceAllocation[]
  entryAmount: number
  deductions?: Array<{ amount: number }>
}

const flt = (n: number, precision = 2): number => {
  const factor = Math.pow(10, precision)
  return (Math.sign(n) * Math.round(Math.abs(n) * factor)) / factor
}

/**
 * Replicates ERPNext's `PaymentEntry.allocate_amount_to_references`
 * (payment_entry.py:1887) for references without a Payment Request.
 *
 * The user-entered Paid/Received amount is distributed first-fit (in row
 * order) across the reference rows: positive rows receive
 * `min(remaining, outstanding)`, negative rows are settled in reverse.
 */
export function allocateReferences(input: AllocateReferencesInput): InvoiceAllocation[] {
  const references = input.references.map((r) => ({ ...r, allocated_amount: 0 }))
  if (!references.length) return references

  const precision = 2
  let paidAmount = flt(
    input.entryAmount - (input.deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0),
    precision
  )

  let totalPositiveOutstanding = 0
  let totalNegativeOutstanding = 0
  for (const ref of references) {
    const outstanding = flt(ref.outstanding_amount)
    if (outstanding > 0) {
      totalPositiveOutstanding = flt(totalPositiveOutstanding + outstanding, precision)
    } else {
      totalNegativeOutstanding = flt(totalNegativeOutstanding + Math.abs(outstanding), precision)
    }
  }

  let allocatedPositiveOutstanding = 0
  let allocatedNegativeOutstanding = 0

  const directCase =
    (input.paymentType === "Receive" && input.partyType === "Customer") ||
    (input.paymentType === "Pay" && (input.partyType === "Supplier" || input.partyType === "Employee"))

  if (directCase) {
    if (totalPositiveOutstanding > paidAmount) {
      const remainingOutstanding = flt(totalPositiveOutstanding - paidAmount, precision)
      allocatedNegativeOutstanding = Math.min(remainingOutstanding, totalNegativeOutstanding)
    }
    allocatedPositiveOutstanding = flt(paidAmount + allocatedNegativeOutstanding, precision)
  } else if (input.partyType === "Supplier" || input.partyType === "Customer") {
    if (paidAmount > totalNegativeOutstanding) {
      return references
    }
    allocatedPositiveOutstanding = flt(totalNegativeOutstanding - paidAmount, precision)
    allocatedNegativeOutstanding = flt(
      paidAmount + Math.min(totalPositiveOutstanding, allocatedPositiveOutstanding),
      precision
    )
  }

  const allocateToRow = (row: InvoiceAllocation, outstanding: number): void => {
    if (outstanding > 0 && allocatedPositiveOutstanding >= 0) {
      row.allocated_amount = flt(Math.min(allocatedPositiveOutstanding, outstanding), precision)
      allocatedPositiveOutstanding = flt(allocatedPositiveOutstanding - row.allocated_amount, precision)
    } else if (outstanding < 0 && allocatedNegativeOutstanding) {
      row.allocated_amount = flt(Math.min(allocatedNegativeOutstanding, Math.abs(outstanding)) * -1, precision)
      allocatedNegativeOutstanding = flt(allocatedNegativeOutstanding - Math.abs(row.allocated_amount), precision)
    }
  }

  for (const ref of references) {
    allocateToRow(ref, flt(ref.outstanding_amount))
  }

  return references.map((r) => ({ ...r, allocated_amount: flt(r.allocated_amount, precision) }))
}
