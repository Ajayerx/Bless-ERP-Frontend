"use client"
import { useForm } from "react-hook-form"
import { Button, Input, Select } from "@/components/ui"
import type { BankAccountFormData } from "@/services/bank_accounts.service"

interface Props {
  defaultValues?: Partial<BankAccountFormData>
  onSubmit: (data: BankAccountFormData) => Promise<void>
  loading?: boolean
}

export default function BankAccountForm({ defaultValues, onSubmit, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<BankAccountFormData>({ defaultValues })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Account Name" {...register("name", { required: "Required" })} error={errors.name?.message} />
        <Input label="Account Number" {...register("accountNumber", { required: "Required" })} error={errors.accountNumber?.message} />
        <Select label="Type" {...register("type", { required: "Required" })}>
          <option value="chequing">Chequing</option>
          <option value="savings">Savings</option>
          <option value="credit">Credit</option>
        </Select>
        <Input label="Balance" type="number" {...register("balance", { valueAsNumber: true })} />
        <Input label="Currency" {...register("currency", { required: "Required" })} error={errors.currency?.message} />
        <Input label="Institution" {...register("institution", { required: "Required" })} error={errors.institution?.message} />
        <Select label="Default Account" {...register("isDefault")}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button type="submit" loading={loading}>Save Account</Button>
      </div>
    </form>
  )
}
