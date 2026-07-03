"use client"

import { DollarSign, FileText, CreditCard, Banknote, TrendingUp, Clock, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: DollarSign },
  { value: "interac", label: "Interac", icon: Wallet },
  { value: "e_transfer", label: "E-Transfer", icon: TrendingUp },
  { value: "check", label: "Cheque", icon: FileText },
  { value: "bank_transfer", label: "Bank Transfer", icon: Banknote },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "on_account", label: "On Account", icon: Clock },
] as const

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"]

export const methodConfig: Record<string, { icon: React.ReactNode; label: string }> = {
  bank_transfer: { icon: <Banknote size={14} />, label: "Bank Transfer" },
  credit_card: { icon: <CreditCard size={14} />, label: "Credit Card" },
  check: { icon: <FileText size={14} />, label: "Cheque" },
  cash: { icon: <DollarSign size={14} />, label: "Cash" },
  interac: { icon: <Wallet size={14} />, label: "Interac" },
  e_transfer: { icon: <TrendingUp size={14} />, label: "E-Transfer" },
  on_account: { icon: <Clock size={14} />, label: "On Account" },
}

interface PaymentMethodSelectProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

const inputClass =
  "w-full px-3 py-2.5 bg-white border border-border rounded-[12px] text-sm text-body placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200"

export default function PaymentMethodSelect({ value, onChange, className }: PaymentMethodSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(inputClass, className)}
    >
      {PAYMENT_METHODS.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  )
}
