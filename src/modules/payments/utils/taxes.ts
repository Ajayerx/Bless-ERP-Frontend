import type { PaymentEntryTax } from "../types"

export interface TaxCalcInput {
  taxes: PaymentEntryTax[]
  basePaidAmount: number
  paymentType: "Receive" | "Pay" | "Internal Transfer"
  sourceExchangeRate: number
  targetExchangeRate: number
  paidFromCurrency: string
  paidToCurrency: string
}

export interface TaxCalcResult {
  taxes: PaymentEntryTax[]
  paidAmountAfterTax: number
  totalTaxesAndCharges: number
  baseTotalTaxesAndCharges: number
}

const flt = (n: number, precision = 2): number => {
  const factor = Math.pow(10, precision)
  return Math.sign(n) * Math.round(Math.abs(n) * factor) / factor
}

function getCurrentTaxFraction(taxes: PaymentEntryTax[], tax: PaymentEntryTax): number {
  let fraction = 0

  if (tax.included_in_paid_amount) {
    const rate = tax.rate ?? 0
    if (tax.charge_type === "On Paid Amount") {
      fraction = rate / 100
    } else if (tax.charge_type === "On Previous Row Amount") {
      const row = taxes[Number(tax.row_id || 1) - 1]
      fraction = (rate / 100) * (row?.tax_fraction_for_current_item ?? 0)
    } else if (tax.charge_type === "On Previous Row Total") {
      const row = taxes[Number(tax.row_id || 1) - 1]
      fraction = (rate / 100) * (row?.grand_total_fraction_for_current_item ?? 0)
    }
  }

  if (tax.add_deduct_tax === "Deduct") fraction *= -1
  return fraction
}

function getCurrentTaxAmount(taxes: PaymentEntryTax[], tax: PaymentEntryTax, paidAmountAfterTax: number): number {
  const rate = tax.rate ?? 0

  if (tax.charge_type === "Actual") {
    return flt(tax.tax_amount ?? 0, 2)
  } else if (tax.charge_type === "On Paid Amount") {
    return flt((rate / 100) * paidAmountAfterTax, 2)
  } else if (tax.charge_type === "On Previous Row Amount") {
    return flt((rate / 100) * (taxes[Number(tax.row_id || 1) - 1]?.tax_amount ?? 0), 2)
  } else if (tax.charge_type === "On Previous Row Total") {
    return flt((rate / 100) * (taxes[Number(tax.row_id || 1) - 1]?.total ?? 0), 2)
  }

  return 0
}

export function calculateTaxes(input: TaxCalcInput): TaxCalcResult {
  const taxes = input.taxes.map((t) => ({ ...t }))

  let paidAmountAfterTax = input.basePaidAmount

  const hasInclusiveTax = taxes.some((t) => t.included_in_paid_amount)
  if (hasInclusiveTax) {
    let cumulatedTaxFraction = 0
    taxes.forEach((tax, i) => {
      tax.tax_fraction_for_current_item = getCurrentTaxFraction(taxes, tax)
      tax.grand_total_fraction_for_current_item =
        i === 0
          ? 1 + (tax.tax_fraction_for_current_item ?? 0)
          : (taxes[i - 1].grand_total_fraction_for_current_item ?? 0) + (tax.tax_fraction_for_current_item ?? 0)
      cumulatedTaxFraction += tax.tax_fraction_for_current_item ?? 0
      paidAmountAfterTax = flt(input.basePaidAmount / (1 + cumulatedTaxFraction), 2)
    })
  }

  let totalTaxesAndCharges = 0
  let baseTotalTaxesAndCharges = 0

  const actualTaxDict: Record<number, number> = {}
  taxes.forEach((tax, i) => {
    if (tax.charge_type === "Actual") {
      actualTaxDict[i] = flt(tax.tax_amount ?? 0, 2)
    }
  })

  taxes.forEach((tax, i) => {
    let currentTaxAmount = getCurrentTaxAmount(taxes, tax, paidAmountAfterTax)

    if (tax.charge_type === "Actual") {
      actualTaxDict[i] -= currentTaxAmount
      if (i === taxes.length - 1) currentTaxAmount += actualTaxDict[i]
    }

    tax.tax_amount = currentTaxAmount
    tax.base_tax_amount = currentTaxAmount
    const signedAmount = currentTaxAmount * (tax.add_deduct_tax === "Deduct" ? -1 : 1)

    tax.total = flt(
      i === 0 ? paidAmountAfterTax + signedAmount : (taxes[i - 1].total ?? 0) + signedAmount,
      2
    )
    tax.base_total = tax.total

    if (input.paymentType === "Pay") {
      if (tax.currency !== input.paidToCurrency) {
        totalTaxesAndCharges += flt(signedAmount / input.targetExchangeRate, 2)
      } else {
        totalTaxesAndCharges += signedAmount
      }
    } else if (input.paymentType === "Receive") {
      if (tax.currency !== input.paidFromCurrency) {
        totalTaxesAndCharges += flt(signedAmount / input.sourceExchangeRate, 2)
      } else {
        totalTaxesAndCharges += signedAmount
      }
    }

    baseTotalTaxesAndCharges += signedAmount
  })

  return {
    taxes,
    paidAmountAfterTax,
    totalTaxesAndCharges,
    baseTotalTaxesAndCharges,
  }
}

export function getIncludedTaxes(taxes: PaymentEntryTax[]): number {
  return (taxes || []).reduce((sum, tax) => {
    if (tax.included_in_paid_amount) {
      const amount = tax.base_tax_amount ?? 0
      sum += tax.add_deduct_tax === "Deduct" ? -amount : amount
    }
    return sum
  }, 0)
}

export interface UnallocatedInput {
  paymentType: "Receive" | "Pay" | "Internal Transfer"
  basePaidAmount: number
  baseReceivedAmount: number
  baseTotalAllocatedAmount: number
  deductions: Array<{ amount: number; is_exchange_gain_loss?: number }>
  taxes: PaymentEntryTax[]
  sourceExchangeRate: number
  targetExchangeRate: number
}

export function computeUnallocatedAmount(input: UnallocatedInput): number {
  let unallocatedAmount = 0
  const deductionsToConsider = (input.deductions || []).reduce(
    (sum, row) => (row.is_exchange_gain_loss ? sum : sum + (row.amount || 0)),
    0
  )
  const includedTaxes = getIncludedTaxes(input.taxes)

  if (input.paymentType === "Receive" && input.baseTotalAllocatedAmount < input.basePaidAmount + deductionsToConsider) {
    unallocatedAmount =
      (input.basePaidAmount + deductionsToConsider - input.baseTotalAllocatedAmount - includedTaxes) /
      input.sourceExchangeRate
  } else if (
    input.paymentType === "Pay" &&
    input.baseTotalAllocatedAmount < input.baseReceivedAmount - deductionsToConsider
  ) {
    unallocatedAmount =
      (input.baseReceivedAmount - deductionsToConsider - input.baseTotalAllocatedAmount - includedTaxes) /
      input.targetExchangeRate
  }

  return unallocatedAmount
}

export interface DifferenceInput {
  paymentType: "Receive" | "Pay" | "Internal Transfer"
  unallocatedAmount: number
  basePaidAmount: number
  baseReceivedAmount: number
  baseTotalAllocatedAmount: number
  deductions: Array<{ amount: number }>
  taxes: PaymentEntryTax[]
  sourceExchangeRate: number
  targetExchangeRate: number
}

export function computeDifferenceAmount(input: DifferenceInput): number {
  const baseUnallocatedAmount =
    input.unallocatedAmount * (input.paymentType === "Receive" ? input.sourceExchangeRate : input.targetExchangeRate)
  const basePartyAmount = input.baseTotalAllocatedAmount + baseUnallocatedAmount
  const includedTaxes = getIncludedTaxes(input.taxes)

  let differenceAmount = 0
  if (input.paymentType === "Receive") {
    differenceAmount = basePartyAmount - input.baseReceivedAmount + includedTaxes
  } else if (input.paymentType === "Pay") {
    differenceAmount = input.basePaidAmount - basePartyAmount - includedTaxes
  } else {
    differenceAmount = input.basePaidAmount - input.baseReceivedAmount - includedTaxes
  }

  const totalDeductions = (input.deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0)

  return differenceAmount - totalDeductions
}
